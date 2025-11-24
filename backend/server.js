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


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Check required environment variables
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "***set***" : "***missing***");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "***set***" : "***missing***");

// Create server first
const server = http.createServer(app);


import { Server } from "socket.io";



app.use(cors({
  origin: "https://schedulingsystem-ten.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Now you can emit events anywhere if you import `io`
export const updateStatus = () => {
  io.emit("statusUpdated"); // this triggers the frontend
};

server.listen(process.env.PORT || 8081, () =>
  console.log("Server running")
);


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Neon
});

// Test initial query
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected:', res.rows[0]);
  }
});

// Optional: test acquiring a client
pool.connect()
  .then(() => console.log("✅ Connected to Neon PostgreSQL!"))
  .catch(err => console.error("❌ DB connection failed:", err.message));

// --- Utility Functions ---
/**
 * Safely parse JSON strings. Returns fallback (default []) if parsing fails.
 * @param {string} input - JSON string to parse
 * @param {any} fallback - Value to return on parse failure
 * @returns {any}
 */
function safeJSONParse(input, fallback = []) {
  try {
    return JSON.parse(input || '[]');
  } catch {
    return fallback;
  }
}


// Helper to format time in 12-hour format with AM/PM
function formatTime12h(timeStr) {
  if (!timeStr) return '';

  // Split the time string, ignore seconds if present
  const [hourStr, minuteStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';

  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${ampm}`;
}

// Example usage:
console.log(formatTime12h('13:30')); // "1:30 PM"
console.log(formatTime12h('00:15:00')); // "12:15 AM"
console.log(formatTime12h('12:00')); // "12:00 PM"


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


// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// 1️⃣ Update event statuses (every minute)
cron.schedule('* * * * *', async () => {
  try {
    const sql = `
      UPDATE schedule_events
      SET status = CASE
        WHEN NOW() BETWEEN (start_date + start_time) AND (end_date + end_time) THEN 'active'
        WHEN NOW() > (end_date + end_time) THEN 'ended'
        ELSE 'upcoming'
      END
    `;
    await pool.query(sql);
    io.emit('statusUpdated');
    console.log('✅ Event statuses updated');
  } catch (err) {
    console.error('❌ Failed to update statuses:', err.message || err);
  }
});

// 2️⃣ Delete expired events (daily at midnight)
cron.schedule('0 0 * * *', async () => {
  try {
    const sql = `DELETE FROM schedule_events WHERE (end_date + end_time) < NOW()`;
    const res = await pool.query(sql);
    console.log(`🧹 Deleted ${res.rowCount} expired event(s)`);
  } catch (err) {
    console.error('❌ Failed to delete expired events:', err.message || err);
  }
});

// 3️⃣ Notification job (every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  try {
    const sql = `
      SELECT id, program AS title, participants, start_date, start_time, notified
      FROM schedule_events
      WHERE (notified = false OR notified IS NULL)
        AND (start_date + start_time) BETWEEN NOW() AND (NOW() + INTERVAL '1 hour')
    `;
    const { rows: events } = await pool.query(sql);

    for (const event of events) {
      const participants = safeJSONParse(event.participants, []);
      if (!participants.length) {
        await pool.query('UPDATE schedule_events SET notified = true WHERE id = $1', [event.id]);
        continue;
      }

      // Fetch emails of all participants
      const userSql = `
        SELECT email FROM categories
        WHERE office = ANY($1::text[])
      `;
      const { rows: users } = await pool.query(userSql, [participants]);

      if (users.length) {
        await Promise.all(
          users.map(user => {
            const reminderMsg = `Reminder: You have an event "${event.title}" starting at ${formatManilaDateTime(event.start_date, event.start_time)}.`;
            return transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: user.email,
              subject: 'Event Reminder',
              text: reminderMsg
            }).then(() => {
              console.log(`✅ Sent reminder to ${user.email} for event ${event.id}`);
            }).catch(err => {
              console.error(`❌ Failed to send reminder to ${user.email}:`, err);
            });
          })
        );
      }

      // Mark event as notified
      await pool.query('UPDATE schedule_events SET notified = true WHERE id = $1', [event.id]);
    }
  } catch (err) {
    console.error('❌ Failed to fetch upcoming events for notification:', err.message || err);
  }
});

// 4️⃣ Reset all events every week (Sunday midnight)
cron.schedule('0 0 * * 0', async () => {
  try {
    const res = await pool.query('DELETE FROM schedule_events');
    console.log(`🔄 All events have been reset for the new week. Rows deleted: ${res.rowCount}`);
    io.emit('statusUpdated');
  } catch (err) {
    console.error('❌ Failed to reset events weekly:', err.message || err);
  }
});

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
app.get('/api/categories', async (req, res) => {
  try {
    const results = await pool.query('SELECT * FROM categories');
    res.json(results.rows); // ✅ Use .rows to get the actual array
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/department', (req, res) => {
  pool.query('SELECT DISTINCT department FROM categories', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Always include SGOD, CID, OSDS
    const baseDepartments = ['SGOD', 'CID', 'OSDS'];
    const dbDepartments = results
      .map(r => r.department)
      .filter(Boolean); // remove null/empty

    const allDepartments = Array.from(new Set([...baseDepartments, ...dbDepartments]));

    res.json(allDepartments.map(dept => ({ department: dept })));
  });
});
// POST /api/categories
app.post('/api/categories', async (req, res) => {
  const { idnumber, office, email, department } = req.body;
  const userType = (req.query.userType || 'Administrator').trim();

  if (!idnumber || !office || !email || !department) {
    return res.status(400).json({ error: 'All fields are required, including ID number.' });
  }

  // Restrict non-admins from adding to other departments
  if (userType.toLowerCase() !== 'administrator' && userType.toLowerCase() !== department.trim().toLowerCase()) {
    return res.status(403).json({ error: 'You can only add categories for your own department.' });
  }

  try {
    // Check for duplicate idnumber
    const check = await pool.query('SELECT id FROM categories WHERE idnumber = $1', [idnumber]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'ID number already exists.' });
    }

    const sql = 'INSERT INTO categories (idnumber, office, email, department) VALUES ($1, $2, $3, $4) RETURNING *';
    const { rows } = await pool.query(sql, [idnumber, office, email, department]);

    res.status(201).json({ message: 'Category added successfully', category: rows[0] });
  } catch (err) {
    console.error('Insert Error:', err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// PUT /api/categories/:id
app.put('/api/categories/:id', async (req, res) => {
  const { office, email, department } = req.body;
  const userType = (req.query.userType || 'Administrator').trim();
  const id = req.params.id;

  // Validate required fields
  if (!office || !email || !department) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // 1️⃣ Check if the category exists
    const { rows } = await pool.query(
      'SELECT department FROM categories WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const catDept = (rows[0].department || '').trim();

    // 2️⃣ Restrict based on department (if not admin)
    if (userType.toLowerCase() !== 'administrator' &&
        userType.toLowerCase() !== catDept.toLowerCase()) {
      return res.status(403).json({ error: 'You can only edit categories for your own department.' });
    }

    // 3️⃣ Update the category and return the updated row
    const sql = 'UPDATE categories SET office = $1, email = $2, department = $3 WHERE id = $4 RETURNING *';
    const { rows: updated } = await pool.query(sql, [office, email, department, id]);

    res.json({ message: 'Category updated successfully', category: updated[0] });
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ error: 'Update failed.' });
  }
});

// DELETE /api/categories/:id
app.delete('/api/categories/:id', async (req, res) => {
  const userType = (req.query.userType || 'Administrator').trim();
  const id = req.params.id;

  try {
    const { rows } = await pool.query('SELECT department FROM categories WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found.' });

    const catDept = (rows[0].department || '').trim();
    if (userType.toLowerCase() !== 'administrator' && userType.toLowerCase() !== catDept.toLowerCase()) {
      return res.status(403).json({ error: 'You can only delete categories for your own department.' });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// GET all events
app.get('/api/events', async (req, res) => {
  try {
    const sql = `
      SELECT id, program,
        start_date,
        TO_CHAR(start_time, 'HH24:MI:SS') AS start_time,
        end_date,
        TO_CHAR(end_time, 'HH24:MI:SS') AS end_time,
        purpose, participants, department, status
      FROM schedule_events
    `;
    const { rows } = await pool.query(sql);

    const events = rows.map(event => ({
      ...event,
      participants: safeJSONParse(event.participants),
      department: safeJSONParse(event.department)
    }));

    res.json(events);
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/events
app.post('/api/events', async (req, res) => {
  const {
    program,
    start_date,
    start_time,
    end_date,
    end_time,
    purpose,
    participants,
    department,
    created_by
  } = req.body;

  // Validate required fields
  if (!program || !start_date || !start_time || !end_date || !end_time || !purpose || !participants?.length || !department?.length) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const newStart = `${start_date} ${start_time}`;
  const newEnd = `${end_date} ${end_time}`;
  const payloadParticipants = normalizeParticipants(participants);

  try {
    // Check for overlapping events
    const conflictQuery = `
      SELECT * FROM schedule_events
      WHERE NOT (
        (end_date || ' ' || end_time) <= $1 OR
        (start_date || ' ' || start_time) >= $2
      )
    `;
    const conflictParams = [newStart, newEnd];
    const conflictResult = await pool.query(conflictQuery, conflictParams);

    // Check for participant/office conflict
    const hasConflict = conflictResult.rows.some(event => {
      const eventParticipants = normalizeParticipants(event.participants);
      return eventParticipants.some(p => payloadParticipants.includes(p));
    });

    if (hasConflict) {
      return res.status(409).json({
        error: 'Conflict: A selected office/participant is already booked during the selected date & time range.'
      });
    }

    // Insert the new event
    const insertQuery = `
      INSERT INTO schedule_events
        (program, start_date, start_time, end_date, end_time, purpose, participants, department, status, created_by)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,'upcoming',$9)
      RETURNING id
    `;
    const insertParams = [
      program,
      start_date,
      start_time,
      end_date,
      end_time,
      purpose,
      JSON.stringify(participants),
      JSON.stringify(department),
      created_by
    ];

    const insertResult = await pool.query(insertQuery, insertParams);
    res.status(201).json({
      message: 'Event added successfully',
      eventId: insertResult.rows[0].id
    });
  } catch (err) {
    console.error('Error adding event:', err);
    res.status(500).json({ error: 'Database error while adding event.' });
  }
});


// PATCH/PUT: Update an event
app.put('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;
  const { program, start_date, start_time, end_date, end_time, purpose, participants, department } = req.body;

  // Validate all required fields
  if (!program || !start_date || !start_time || !end_date || !end_time || !purpose || !participants?.length || !department?.length) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const newStart = `${start_date} ${start_time}`;
  const newEnd = `${end_date} ${end_time}`;
  const payloadParticipants = JSON.stringify(participants);

  try {
    // Check for overlapping events
    const conflictQuery = `
      SELECT * FROM schedule_events
      WHERE id != $1
      AND NOT ($2 >= end_date || $3 <= start_date)
    `;
    const conflictValues = [eventId, newStart, newEnd];
    const conflictResult = await pool.query(conflictQuery, conflictValues);

    // Check for participant conflicts
    const hasConflict = conflictResult.rows.some(event => {
      const eventParticipants = JSON.parse(event.participants);
      return eventParticipants.some(p => participants.includes(p));
    });

    if (hasConflict) {
      return res.status(409).json({
        error: 'Conflict: A selected office/participant is already booked during the selected date & time range.'
      });
    }

    // Update the event
    const updateQuery = `
      UPDATE schedule_events
      SET program = $1,
          start_date = $2,
          start_time = $3,
          end_date = $4,
          end_time = $5,
          purpose = $6,
          participants = $7,
          department = $8
      WHERE id = $9
      RETURNING *
    `;
    const updateValues = [
      program, start_date, start_time, end_date, end_time, purpose,
      payloadParticipants, JSON.stringify(department), eventId
    ];

    const updateResult = await pool.query(updateQuery, updateValues);
    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.json({ message: 'Event updated successfully', event: updateResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while updating event.' });
  }
});

// DELETE an event
app.delete('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    const deleteResult = await pool.query(
      'DELETE FROM schedule_events WHERE id = $1 RETURNING id',
      [eventId]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Delete failed:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Helper to get department filter safely
function getDepartmentFilter(department, userType, table = 'users') {
  if (!department || department === 'All') {
    if (userType === 'Administrator') return { sql: '', params: [] };

    if (table === 'events') {
      // PostgreSQL JSON containment operator @>
      return { sql: ' AND department @> $1', params: [JSON.stringify([userType])] };
    }

    if (table === 'categories') return { sql: ' AND department = $1', params: [userType] };
    return { sql: ' AND type = $1', params: [userType] };
  }

  if (table === 'events') return { sql: ' AND department @> $1', params: [JSON.stringify([department])] };
  if (table === 'categories') return { sql: ' AND department = $1', params: [department] };
  return { sql: ' AND type = $1', params: [department] };
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
  const categoryQuery = `SELECT * FROM categories WHERE 1=1 ${getDepartmentFilter(department, userType, 'categories')}`;
  pool.query(categoryQuery, (err, results) => (err ? reject(err) : resolve(results)));
});

// Fetch users
const users = await new Promise((resolve, reject) => {
  let userSql = 'SELECT id, employee_number, email, type FROM users WHERE 1=1';
  if (department && department !== 'All') {
    userSql += ` AND type = $1`;
    pool.query(userSql, [department], (err, results) => (err ? reject(err) : resolve(results)));
  } else {
    pool.query(userSql, (err, results) => (err ? reject(err) : resolve(results)));
  }
});

// Fetch events
let events;
if (type === 'monthly') {
  // PostgreSQL: use EXTRACT(MONTH FROM ...) and EXTRACT(YEAR FROM ...)
  events = await new Promise((resolve, reject) => {
    const eventSql = `
      SELECT * FROM schedule_events
      WHERE 1=1 ${getDepartmentFilter(department, userType, 'events')}
      AND EXTRACT(MONTH FROM start_date) = $1
      AND EXTRACT(YEAR FROM start_date) = $2
    `;
    pool.query(eventSql, [start, end], (err, results) => (err ? reject(err) : resolve(results)));
  });
} else {
  // weekly or custom range: use BETWEEN
  events = await new Promise((resolve, reject) => {
    const eventSql = `
      SELECT * FROM schedule_events
      WHERE 1=1 ${getDepartmentFilter(department, userType, 'events')} ${getDateFilter(start, end)}
    `;
    pool.query(eventSql, (err, results) => (err ? reject(err) : resolve(results)));
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


// Get all users
// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, employee_number, email, type FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Register a user
app.post('/api/users', async (req, res) => {
  const { employee_number, email, password, type } = req.body;

  if (!employee_number || !email || !password || !type) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!/^\d{7}$/.test(employee_number)) {
    return res.status(400).json({ error: 'Employee number must be exactly 7 digits.' });
  }

  const fixedTypes = ['Administrator', 'OSDS', 'SGOD', 'CID'];

  try {
    // Restrict only one user for fixed types
    if (fixedTypes.includes(type)) {
      const typeCheck = await pool.query('SELECT 1 FROM users WHERE type = $1 LIMIT 1', [type]);
      if (typeCheck.rowCount > 0) {
        return res.status(409).json({ error: `A user with type ${type} already exists.` });
      }
    }

    // Check employee_number uniqueness
    const empCheck = await pool.query('SELECT 1 FROM users WHERE employee_number = $1 LIMIT 1', [employee_number]);
    if (empCheck.rowCount > 0) {
      return res.status(409).json({ error: 'Employee number already exists.' });
    }

    // Insert new user (plain text password)
    const insertResult = await pool.query(
      `INSERT INTO users (employee_number, email, password, type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [employee_number, email, password, type]
    );

    res.status(201).json({ success: true, id: insertResult.rows[0].id });
  } catch (err) {
    console.error('Error inserting user:', err);
    res.status(500).json({ error: 'Database error.' });
  }
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
app.post('/api/login', async (req, res) => {
  const { employee_number, password } = req.body;

  if (!employee_number || !password) {
    return res.status(400).json({ error: 'Missing employee number or password' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE employee_number = $1 AND password = $2',
      [employee_number, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        type: user.type,
        employee_number: user.employee_number
      }
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
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

    // ✅ PostgreSQL returns data in results.rows
    if (results.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = results.rows[0];
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

pool.query('SELECT * FROM users LIMIT 1', (err, res) => {
  if (err) console.error('DB connection error:', err);
  else console.log('DB connected, users table:', res.rows);
});


// Add a friendly root route
app.get('/', (req, res) => {
  res.send('Backend API is running!');
});

const PORT = process.env.PORT || 8081;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is live on Render (port ${PORT})`);
});
