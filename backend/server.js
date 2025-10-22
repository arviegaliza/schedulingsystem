import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import http from "http";
import { Server } from "socket.io";
import pkg from "pg"; // PostgreSQL
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import cron from "node-cron";

dotenv.config(); // Load .env

const { Pool } = pkg; // Import Pool for PostgreSQL

const app = express();

// HTTPS options
const options = {
  key: fs.readFileSync("ssl/server.key"),
  cert: fs.readFileSync("ssl/server.cert"),
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "***set***" : "***missing***");


app.use(cors({
  origin: ["https://your-netlify-site.netlify.app"],
  credentials: true,
}));
// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon
});

// Test connection
pool.connect()
  .then(() => console.log("✅ Connected to Neon PostgreSQL!"))
  .catch(err => console.error("❌ DB connection failed:", err.message));

// Create server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: { origin: "*" },
});



function safeJSONParse(input, fallback = []) {
  try {
    return JSON.parse(input || '[]');
  } catch {
    return fallback;
  }
}

// Helper to format time in 12-hour format with am/pm
function formatTime12h(timeStr) {
  // timeStr is expected to be 'HH:mm:ss' or 'HH:mm'
  const [hour, minute] = timeStr.split(':');
  let h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${minute} ${ampm}`;
}

// Improved helper to format Manila date and time for reminders, mimicking event schedule formatting
function formatManilaDateTime(dateStr, timeStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const formattedDate = date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
  let formattedTime = '';
  if (timeStr) {
    // Format time as HH:mm AM/PM
    const [hour, minute] = timeStr.split(':');
    const d = new Date();
    d.setHours(hour, minute);
    formattedTime = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
  }
  return `${formattedDate}${formattedTime ? ' ' + formattedTime : ''}`;
}

// Helper to normalize participants
function normalizeParticipants(participants) {
  if (Array.isArray(participants)) return participants.map(p => p.trim().toLowerCase());
  if (typeof participants === 'string') {
    try {
      const arr = JSON.parse(participants);
      if (Array.isArray(arr)) return arr.map(p => p.trim().toLowerCase());
      return [participants.trim().toLowerCase()];
    } catch {
      return [participants.trim().toLowerCase()];
    }
  }
  return [];
}

// Cron jobs
cron.schedule('* * * * *', () => {
  const sql = `
    UPDATE schedule_events SET status = 
      CASE
        WHEN NOW() BETWEEN CONCAT(start_date, ' ', start_time) AND CONCAT(end_date, ' ', end_time)
          THEN 'active'
        WHEN NOW() > CONCAT(end_date, ' ', end_time)
          THEN 'ended'
        ELSE 'upcoming'
      END
  `;
  pool.query(sql, (err) => {
    if (err) return console.error('❌ Failed to update statuses:', err.message);
    io.emit('statusUpdated');
  });
});

cron.schedule('0 0 * * *', () => {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const sql = `DELETE FROM schedule_events WHERE CONCAT(end_date, ' ', end_time) < ?`;
  pool.query(sql, [now], (err, results) => {
    if (err) return console.error('❌ Failed to delete expired events:', err.message);
    if (results.affectedRows > 0)
      console.log(`🧹 Deleted ${results.affectedRows} expired event(s).`);
  });
});

cron.schedule('* * * * *', () => {
  // Runs every 5 minutes
  const sql = `
    SELECT id, program AS title, participants, start_date, start_time, notified
    FROM schedule_events
    WHERE notified = 0
      AND TIMESTAMP(start_date, start_time) BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)
  `;
  pool.query(sql, (err, events) => {
    if (err) {
      console.error('❌ Failed to fetch upcoming events for notification:', err.message);
      return;
    }
    events.forEach(event => {
      let participants = [];
      try {
        participants = JSON.parse(event.participants);
      } catch {
        participants = [];
      }
      if (!participants.length) return;

      // Get all emails from categories table (ignore participants)
      const userSql = `SELECT email FROM categories`;
      pool.query(userSql, (err2, users) => {
        if (err2) {
          console.error('❌ Failed to fetch emails from categories:', err2);
          return;
        }
        users.forEach(user => {
          const reminderMsg = `Reminder: You have an event "${event.program || event.title}" starting at ${formatManilaDateTime(event.start_date, event.start_time)}.`;
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Event Reminder',
            text: reminderMsg
          };
          transporter.sendMail(mailOptions, (err3) => {
            if (err3) {
              console.error(`❌ Failed to send reminder to ${user.email}:`, err3);
            } else {
              console.log(`✅ Sent reminder to ${user.email} for event ${event.id}`);
            }
          });
        });
        // Mark event as notified after sending to all
        pool.query('UPDATE schedule_events SET notified = 1 WHERE id = $1', [event.id]);
      });
    });
  });
});

// Reset all events every week (Sunday at midnight)
cron.schedule('0 0 * * 0', () => {
  pool.query('DELETE FROM schedule_events', (err, results) => {
    if (err) return console.error('❌ Failed to reset events weekly:', err.message);
    console.log('🔄 All events have been reset (deleted) for the new week.');
    io.emit('statusUpdated');
  });
});

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER, // or your actual email
    pass: process.env.EMAIL_PASS  // or your app password
  },
  tls: {
    rejectUnauthorized: false
  }
});
// FORGOT PASSWORD - PostgreSQL version
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) 
    return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    // Generate OTP and expiration time
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60000); // 10 minutes from now

    // Find user
    const findUserQuery = 'SELECT * FROM users WHERE email = $1';
    const findResult = await pool.query(findUserQuery, [email]);

    if (findResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = findResult.rows[0];

    // Update OTP in database
    const updateOtpQuery = `
      UPDATE users 
      SET otp_code = $1, otp_expires = $2
      WHERE id = $3
    `;
    await pool.query(updateOtpQuery, [otp, otpExpires, user.id]);

    // Send OTP email
    const mailOptions = {
      from: 'arbgaliza@gmail.com',
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP code is ${otp}. It will expire in 10 minutes.`
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Failed to send OTP:', err);
        return res.status(500).json({ success: false, message: 'Failed to send OTP' });
      }

      res.json({ success: true, message: 'OTP sent to your email' });
    });

  } catch (err) {
    console.error('Error in forgot-password:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// VERIFY OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp_code } = req.body;

  const query = 'SELECT * FROM users WHERE email = $1 AND otp_code = $2 AND otp_expires > NOW()';
  pool.query(query, [email, otp_code], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    res.json({ success: true, message: 'OTP verified' });
  });
});
// RESET PASSWORD - PostgreSQL version
app.post('/api/reset-password', async (req, res) => {
  const { email, otp_code, new_password } = req.body;

  if (!email || !otp_code || !new_password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    // Find user with valid OTP
    const findQuery = `
      SELECT * FROM users 
      WHERE email = $1
        AND otp_code = $2
        AND otp_expires > NOW()
    `;
    const findResult = await pool.query(findQuery, [email, otp_code]);

    if (findResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Update password and clear OTP
    const updateQuery = `
      UPDATE users 
      SET password = $1, otp_code = NULL, otp_expires = NULL
      WHERE email = $2
    `;
    await pool.query(updateQuery, [new_password, email]);

    // Send email notification
    const mailOptions = {
      from: 'arbgaliza@gmail.com',
      to: findResult.rows[0].email,
      subject: 'Password Changed',
      text: `Hello ${findResult.rows[0].email},\n\nYour password has been successfully changed.\nIf you did not request this change, please contact support immediately.`
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Failed to send password change notification:', err);
        return res.status(500).json({
          success: true,
          message: 'Password updated, but failed to send email notification.'
        });
      }

      res.json({ success: true, message: 'Password changed and email notification sent.' });
    });

  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});


// Categories
app.get('/api/categories', (req, res) => {
  pool.query('SELECT * FROM categories', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/department', (req, res) => {
  pool.query('SELECT DISTINCT department FROM categories', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    // Always include SGOD, CID, OSDS
    const baseDepartments = ['SGOD', 'CID', 'OSDS'];
    const dbDepartments = results.map(r => r.department).filter(Boolean);
    const allDepartments = Array.from(new Set([...baseDepartments, ...dbDepartments]));
    res.json(allDepartments.map(department => ({ department })));
  });
});
app.post('/api/categories', async (req, res) => {
  const { idnumber, office, email, department } = req.body;
  const userType = req.query.userType || 'Administrator';

  // Debug logging
  console.log('userType:', userType, 'department:', department);
  console.log('Comparison:', userType.trim().toLowerCase() === department.trim().toLowerCase());

  // Restrict non-admins from adding to other departments
  if (
    userType !== 'Administrator' &&
    userType.trim().toLowerCase() !== department.trim().toLowerCase()
  ) {
    return res.status(403).json({ error: 'You can only add categories for your own department.' });
  }

  // Validate required fields
  if (!idnumber || !office || !email || !department) {
    return res.status(400).json({ error: 'All fields are required, including ID number.' });
  }

  try {
    const sql = `INSERT INTO categories (idnumber, office, email, department) VALUES ($1, $2, $3, $4)`;
    await pool.query(sql, [idnumber, office, email, department]);
    res.status(201).json({ message: 'Category added successfully' });
  } catch (err) {
    console.error('Insert Error:', err);
    res.status(500).json({ error: 'Insert failed. Possibly duplicate ID number.' });
  }
});


app.put('/api/categories/:id', async (req, res) => {
  const { office, email, department } = req.body;
  const userType = req.query.userType || 'Administrator';
  const id = req.params.id;

  try {
    // 1️⃣ Check if the category exists
    const result = await pool.query('SELECT department FROM categories WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const catDept = result.rows[0].department;

    // 2️⃣ Restrict based on department (if not admin)
    if (
      userType !== 'Administrator' &&
      userType.trim().toLowerCase() !== catDept.trim().toLowerCase()
    ) {
      return res.status(403).json({ error: 'You can only edit categories for your own department.' });
    }

    // 3️⃣ Perform the update
    const sql = `UPDATE categories SET office = $1, email = $2, department = $3 WHERE id = $4`;
    await pool.query(sql, [office, email, department, id]);

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});


app.delete('/api/categories/:id', async (req, res) => {
  const userType = req.query.userType || 'Administrator';
  const id = req.params.id;

  try {
    // 1️⃣ Check if category exists
    const result = await pool.query('SELECT department FROM categories WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const catDept = result.rows[0].department;

    // 2️⃣ Department restriction
    if (
      userType !== 'Administrator' &&
      userType.trim().toLowerCase() !== catDept.trim().toLowerCase()
    ) {
      return res.status(403).json({ error: 'You can only delete categories for your own department.' });
    }

    // 3️⃣ Delete category
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);

    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});


// GET all events
app.get('/api/events', (req, res) => {
  const sql = `
    SELECT id, program, start_date, 
      DATE_FORMAT(start_time, '%H:%i:%s') AS start_time,
      end_date, 
      DATE_FORMAT(end_time, '%H:%i:%s') AS end_time,
      purpose, participants, department, status
    FROM schedule_events
  `;
  pool.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const events = results.map(event => ({
      ...event,
      participants: safeJSONParse(event.participants),
      department: safeJSONParse(event.department)
    }));
    res.json(events);
  });
});

// PATCH POST /api/events
app.post('/api/events', (req, res) => {
  const { program, start_date, start_time, end_date, end_time, purpose, participants, department, created_by } = req.body;
  if (!program || !start_date || !start_time || !end_date || !end_time || !purpose || !participants?.length || !department?.length)
    return res.status(400).json({ error: 'All fields are required.' });

  const newStart = new Date(`${start_date}T${start_time}`);
  const newEnd = new Date(`${end_date}T${end_time}`);
  const payloadParticipants = normalizeParticipants(participants);

  // Query all events that overlap in time
  const conflictQuery = `
    SELECT * FROM schedule_events
    WHERE NOT (
      CONCAT(end_date, ' ', end_time) <= $1 OR
      CONCAT(start_date, ' ', start_time) >= $2
    )
  `;
  const params = [start_date + ' ' + start_time, end_date + ' ' + end_time];

  pool.query(conflictQuery, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    // Check for office conflict
    const hasOfficeConflict = results.some(event => {
      const eventParticipants = normalizeParticipants(event.participants);
      return eventParticipants.some(p => payloadParticipants.includes(p));
    });
    if (hasOfficeConflict) {
      return res.status(409).json({ error: 'Conflict: A selected office is already booked during the selected date & time range.' });
    }
    // ... proceed with insert as before ...
    const sql = `INSERT INTO schedule_events (program, start_date, start_time, end_date, end_time, purpose, participants, department, status, created_by)\n               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?)`;
    pool.query(sql, [
      program, start_date, start_time, end_date, end_time, purpose,
      JSON.stringify(participants), JSON.stringify(department), created_by
    ], (err2) => {
      if (err2) return res.status(500).json({ error: 'Insert failed' });
      res.status(201).json({ message: 'Event added successfully' });
    });
  });
});

// PATCH PUT /api/events/:id
app.put('/api/events/:id', (req, res) => {
  const { program, start_date, start_time, end_date, end_time, purpose, participants, department } = req.body;
  if (!program || !start_date || !start_time || !end_date || !end_time || !purpose || !participants?.length || !department?.length)
    return res.status(400).json({ error: 'All fields are required.' });

  const newStart = new Date(`${start_date}T${start_time}`);
  const newEnd = new Date(`${end_date}T${end_time}`);
  const payloadParticipants = normalizeParticipants(participants);

  // Query all events that overlap in time, excluding this event
  const conflictQuery = `
    SELECT * FROM schedule_events
    WHERE NOT (
      CONCAT(end_date, ' ', end_time) <= $1 OR
      CONCAT(start_date, ' ', start_time) >= $2
    ) AND id != $3
  `;
  const params = [start_date + ' ' + start_time, end_date + ' ' + end_time, req.params.id];

  pool.query(conflictQuery, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    // Check for office conflict
    const hasOfficeConflict = results.some(event => {
      const eventParticipants = normalizeParticipants(event.participants);
      return eventParticipants.some(p => payloadParticipants.includes(p));
    });
    if (hasOfficeConflict) {
      return res.status(409).json({ error: 'Conflict: A selected office is already booked during the selected date & time range.' });
    }
    // ... proceed with update as before ...
    const sql = `
  UPDATE schedule_events
  SET program = $1,
      start_date = $2,
      start_time = $3,
      end_date = $4,
      end_time = $5,
      purpose = $6,
      participants = $7,
      department = $8,
      status = 'upcoming'
  WHERE id = $9
`;

    pool.query(sql, [
      program, start_date, start_time, end_date, end_time, purpose,
      JSON.stringify(participants), JSON.stringify(department), req.params.id
    ], (err2) => {
      if (err2) return res.status(500).json({ error: 'Update failed' });
      res.json({ message: 'Event updated successfully' });
    });
  });
});

app.delete('/api/events/:id', (req, res) => {
  pool.query('DELETE FROM schedule_events WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    res.json({ message: 'Event deleted successfully' });
  });
});

// Helper to get department filter
function getDepartmentFilter(department, userType, table = 'users') {
  if (!department || department === 'All') {
    if (userType === 'Administrator') return '';
    if (table === 'events') return ` AND JSON_CONTAINS(department, '"${userType}"')`;
    if (table === 'categories') return ` AND department = '${userType}'`;
    return ` AND type = '${userType}'`;
  }
  if (table === 'events') return ` AND JSON_CONTAINS(department, '"${department}"')`;
  if (table === 'categories') return ` AND department = '${department}'`;
  return ` AND type = '${department}'`;
}

// Helper to get date filter
function getDateFilter(start, end) {
  let filter = '';
  if (start) filter += ` AND start_date >= '${start}'`;
  if (end) filter += ` AND end_date <= '${end}'`;
  return filter;
}

// Middleware to check admin or department access
function checkReportAccess(req, res, next) {
  // For demo: get user type from query (in real app, use auth)
  const userType = req.query.userType || 'Administrator';
  req.userType = userType;
  next();
}

app.get('/api/reports/:type', checkReportAccess, async (req, res) => {
  const { department = 'All', start, end, format = 'xlsx' } = req.query;
  const { type } = req.params; // 'weekly' or 'monthly'
  const userType = req.userType;

  try {
    if (type === 'monthly' && (!start || !end)) {
      return res.status(400).json({ error: 'Month and year are required for monthly reports.' });
    }
    if (type !== 'monthly' && (!start || !end)) {
      return res.status(400).json({ error: 'Start and end dates are required for weekly reports.' });
    }
    // Fetch categories
    const categories = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT * FROM categories WHERE 1=1${getDepartmentFilter(department, userType, 'categories')}`,
        (err, results) => (err ? reject(err) : resolve(results))
      );
    });
    // Fetch users
    const users = await new Promise((resolve, reject) => {
      let userSql = 'SELECT id, employee_number, email, type FROM users WHERE 1=1';
      if (department && department !== 'All' && userType !== 'Administrator') {
        userSql += ` AND type = '${department}'`;
      } else if (department && department !== 'All' && userType === 'Administrator') {
        userSql += ` AND type = '${department}'`;
      }
      pool.query(userSql, (err, results) => (err ? reject(err) : resolve(results)));
    });
    // Fetch events
    let events;
    if (type === 'monthly') {
      // start = month (1-12), end = year (e.g., 2025)
      events = await new Promise((resolve, reject) => {
        pool.query(
          `SELECT * FROM schedule_events WHERE 1=1${getDepartmentFilter(department, userType, 'events')} AND MONTH(start_date) = $1 AND YEAR(start_date) = $2`,
          [start, end],
          (err, results) => (err ? reject(err) : resolve(results))
        );
      });
    } else {
      // weekly or other: use date range
      events = await new Promise((resolve, reject) => {
        pool.query(
          `SELECT * FROM schedule_events WHERE 1=1${getDepartmentFilter(department, userType, 'events')}${getDateFilter(start, end)}`,
          (err, results) => (err ? reject(err) : resolve(results))
        );
      });
    }

    if (format === 'xlsx') {
      // Excel export
      const workbook = new ExcelJS.Workbook();
      // Categories sheet
      const catSheet = workbook.addWorksheet('Categories');
      catSheet.columns = [
        { header: 'ID Number', key: 'idnumber' },
        { header: 'Office', key: 'office' },
        { header: 'Email', key: 'email' },
        { header: 'Department', key: 'department' },
      ];
      categories.forEach(row => catSheet.addRow(row));
      // Users sheet
      const userSheet = workbook.addWorksheet('Users');
      userSheet.columns = [
        { header: 'ID', key: 'id' },
        { header: 'Employee Number', key: 'employee_number' },
        { header: 'Email', key: 'email' },
        { header: 'Type', key: 'type' },
      ];
      users.forEach(row => userSheet.addRow(row));
      // Events sheet
      const eventSheet = workbook.addWorksheet('Events');
      eventSheet.columns = [
        { header: 'ID', key: 'id' },
        { header: 'Program', key: 'program' },
        { header: 'Start Date', key: 'start_date' },
        { header: 'Start Time', key: 'start_time' },
        { header: 'End Date', key: 'end_date' },
        { header: 'End Time', key: 'end_time' },
        { header: 'Purpose', key: 'purpose' },
        { header: 'Participants', key: 'participants' },
        { header: 'Department', key: 'department' },
        { header: 'Status', key: 'status' },
        { header: 'Created By', key: 'created_by' },
        { header: 'Created At', key: 'created_at' },
      ];
      // Build a map from participant name to office
      const officeMap = {};
      categories.forEach(cat => {
        if (cat.office) {
          officeMap[cat.office] = cat.office;
        }
        // If you want to match by name, you can add: officeMap[cat.name] = cat.office;
      });

      // Helper to format participants with office (must be outside export blocks)
      function formatParticipants(participants) {
        if (!participants) return '';
        let arr = participants;
        if (typeof arr === 'string') {
          try { arr = JSON.parse(arr); } catch { arr = [arr]; }
        }
        return arr.map(p => `${p}${officeMap[p] ? ' (' + officeMap[p] + ')' : ''}`).join(', ');
      }
   
      events.forEach(row => {
        eventSheet.addRow({
          ...row,
          participants: formatParticipants(row.participants),
          department: row.department,
          created_by: row.created_by,
          created_at: row.created_at,
          start_date: row.start_date,
          start_time: row.start_time,
          end_date: row.end_date,
          end_time: row.end_time
        });
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${department}_${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      // NEW PDF export (simple)
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${department}_${Date.now()}.pdf`);
      doc.pipe(res);
      doc.fontSize(18).text(`Events Report (${type.toUpperCase()}) - Department: ${department}`, { align: 'center' });
      doc.moveDown();
      if (events.length === 0) {
        doc.text('No events found for this period.');
      } else {
        events.forEach(ev => {
          doc.moveDown(0.5);
          doc.fontSize(12).text(`Program: ${ev.program || ''}`);
          // Format dates to 'YYYY-MM-DD' in Asia/Manila timezone
          const startDate = ev.start_date ? new Date(ev.start_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : '';
          const endDate = ev.end_date ? new Date(ev.end_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : '';
          doc.text(`Start Date: ${startDate}`);
          doc.text(`End Date: ${endDate}`);
          doc.text(`Department: ${Array.isArray(ev.department) ? ev.department.join(', ') : (ev.department || '')}`);
          doc.text(`Participants: ${Array.isArray(ev.participants) ? ev.participants.join(', ') : (ev.participants || '')}`);
          doc.text(`Status: ${ev.status || ''}`);
          doc.moveDown(0.5);
          doc.text('-----------------------------');
        });
      }
      doc.end();
    } else {
      res.status(400).json({ error: 'Invalid format' });
    }
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

app.get('/api/users', (req, res) => {
  pool.query('SELECT id, employee_number, email, type FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});
app.post('/api/users', (req, res) => {
  const { employee_number, email, password, type } = req.body;

  if (!employee_number || !email || !password || !type) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!/^\d{7}$/.test(employee_number)) {
    return res.status(400).json({ error: 'Employee number must be exactly 7 digits.' });
  }

  // Restrict only one user for these types
  const fixedTypes = ['Administrator', 'OSDS', 'SGOD', 'CID'];
  if (fixedTypes.includes(type)) {
    pool.query('SELECT id FROM users WHERE type = $1', [type], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (results.length > 0) {
        return res.status(409).json({ error: `A user with type ${type} already exists.` });
      }
      // Continue with employee_number uniqueness check
      pool.query(
        'SELECT id FROM users WHERE employee_number = ?',
        [employee_number],
        (err, results) => {
          if (err) return res.status(500).json({ error: 'Database error.' });
          if (results.length > 0) {
            return res.status(409).json({ error: 'Employee number already exists.' });
          }
          const sql = 'INSERT INTO users (employee_number, email, password, type) VALUES ($1, $2, $3, $4)';
          pool.query(sql, [employee_number, email, password, type], (err, result) => {
            if (err) return res.status(500).json({ error: 'Insert failed.' });
            res.status(201).json({ success: true, id: result.insertId });
          });
        }
      );
    });
    return;
  }

  // For other types, only check employee_number uniqueness
  pool.query(
    'SELECT id FROM users WHERE employee_number = $1',
    [employee_number],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (results.length > 0) {
        return res.status(409).json({ error: 'Employee number already exists.' });
      }
      const sql = 'INSERT INTO users (employee_number, email, password, type) VALUES ($1, $2, $3, $4)';
      pool.query(sql, [employee_number, email, password, type], (err, result) => {
        if (err) return res.status(500).json({ error: 'Insert failed.' });
        res.status(201).json({ success: true, id: result.insertId });
      });
    }
  );
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { employee_number, email, password, type } = req.body;

  if (!employee_number || !email || !type) {
    return res.status(400).json({ error: 'Employee number, email, and type are required.' });
  }

  if (!/^\d{7}$/.test(employee_number)) {
    return res.status(400).json({ error: 'Employee number must be exactly 7 digits.' });
  }

  const checkSql = 'SELECT id FROM users WHERE employee_number = $1 AND id != $2';
  pool.query(checkSql, [employee_number, id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error during validation.' });
    if (results.length > 0) {
      return res.status(409).json({ error: 'Employee number already in use by another user.' });
    }

 let sql, params;

if (password) {
  // Update with password
  sql = 'UPDATE users SET employee_number = $1, email = $2, password = $3, type = $4 WHERE id = $5';
  params = [employee_number, email, password, type, id];
} else {
  // Update without password
  sql = 'UPDATE users SET employee_number = $1, email = $2, type = $3 WHERE id = $4';
  params = [employee_number, email, type, id];
}


    pool.query(sql, params, (err, result) => {
      if (err) return res.status(500).json({ error: 'Update failed.' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
      res.json({ success: true });
    });
  });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  pool.query('DELETE FROM users WHERE id = $1', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Delete failed.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true });
  });
});

app.post('/api/login', (req, res) => {
  const { employee_number, password } = req.body;

  if (!employee_number || !password) {
    return res.status(400).json({ error: 'Missing employee number or password' });
  }

  pool.query(
    'SELECT * FROM users WHERE employee_number = $1 AND password = ?',
    [employee_number, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      const user = results[0];
      res.json({
        user: {
          id: user.id,
          email: user.email,
          type: user.type,
          employee_number: user.employee_number
        }
      });
    }
  );
});

app.post('/api/login1', (req, res) => {
  console.log('Login1 request received:', req.body);
  const { idnumber } = req.body;

  if (!idnumber) {
    return res.status(400).json({ success: false, message: 'ID number is required' });
  }

  const query = 'SELECT * FROM categories WHERE idnumber = $1 LIMIT 1';
  pool.query(query, [idnumber], (err, results) => {
    if (err) {
      console.error('Login1 Error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = results[0];
    return res.json({ success: true, user });
  });
});

// TEST EMAIL ENDPOINT
app.get('/api/test-email', (req, res) => {
  const to = req.query.to || process.env.EMAIL_USER;
  if (!to) return res.status(400).json({ success: false, message: 'No recipient specified.' });
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Test Email from Calendar App',
    text: 'This is a test email to verify your email notification setup.'
  };
  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      console.error('❌ Test email failed:', err);
      return res.status(500).json({ success: false, message: 'Failed to send test email', error: err.message });
    }
    res.json({ success: true, message: `Test email sent to ${to}` });
  });
});

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'DB connection failed' });
  }
});


// Add a friendly root route
app.get('/', (req, res) => {
  res.send('Backend API is running!');
});

const PORT = process.env.PORT || 8081;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is live on Render (port ${PORT})`);
});
