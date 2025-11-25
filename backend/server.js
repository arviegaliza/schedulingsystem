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
import { format } from "date-fns";

dotenv.config(); // <-- load environment variables first



// use a verified sender in your SendGrid account
const FROM_EMAIL = process.env.EMAIL_USER || 'arbgaliza@gmail.com';


// ---------------------- PostgreSQL Pool ----------------------
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // needed for Render/Postgres SSL
});

const app = express();

// --------- TRUST PROXY & BODY PARSERS ----------
app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------- FRONTEND ORIGINS ----------
const FRONTEND_ORIGINS = [
  "https://schedulingsystem-ten.vercel.app"
];

// --------- CORS MIDDLEWARE ----------
app.use((req, res, next) => {
  const origin = req.get("origin"); // get request origin
  if (FRONTEND_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin); // allow only this origin
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});


// --------- HTTP SERVER (Render handles HTTPS) ----------
const server = http.createServer(app);

// --------- SOCKET.IO ----------
export const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// --------- SOCKET.IO CONNECTION ----------
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
});

// --------- OPTIONS for Socket.IO preflight ----------
app.options(/\/socket\.io\/.*/, (req, res) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_ORIGINS.join(","));
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});
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
    const sql = `
      DELETE FROM schedule_events
      WHERE (end_date + end_time) < NOW()
    `;
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
        AND (start_date + start_time::interval) BETWEEN NOW() AND (NOW() + INTERVAL '1 hour')
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

app.post("/api/forgot-password", async (req, res) => {
  const { email, new_password } = req.body;
  if (!email || !new_password) {
    return res.status(400).json({ success: false, message: "Email and new password are required" });
  }

  try {
    // Check if user exists
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Update password directly
    await pool.query(
      "UPDATE users SET password = $1 WHERE email = $2",
      [new_password, email]
    );

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------ RESET PASSWORD (NO OTP) ------------------
app.post("/api/reset-password", async (req, res) => {
  const { email, new_password } = req.body || {};
  if (!email || !new_password) {
    return res.status(400).json({ success: false, message: "Email and new_password are required." });
  }

  try {
    // Normalize email and check user exists (case-insensitive)
    const normalizedEmail = email.trim().toLowerCase();
    const userResult = await pool.query(
      "SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [normalizedEmail]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userResult.rows[0];

    // WARNING: This stores plaintext passwords. Replace with hashed passwords later.
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [new_password, user.id]
    );

    // Optional: send confirmation email (non-blocking)
    if (typeof sgMail !== 'undefined' && process.env.EMAIL_USER) {
      const msg = {
        to: user.email,
        from: process.env.EMAIL_USER,
        subject: "Password Changed",
        text: `Hello ${user.email},\n\nYour password has been successfully changed. If you did not request this change, please contact support immediately.`,
      };

      try {
        await sgMail.send(msg);
        console.log("Password change confirmation sent to", user.email);
      } catch (emailErr) {
        console.error("Failed to send password change confirmation:", emailErr);
        // do not fail the request because email failed
      }
    }

    return res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Error in /api/reset-password:", err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, message: "Internal server error." });
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

    const baseDepartments = ['SGOD', 'CID', 'OSDS'];
    const dbDepartments = results.rows  // <-- use rows
      .map(r => r.department)
      .filter(Boolean);

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
  const userType = req.userType || 'Administrator';

  try {
    // Validate start/end
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required.' });
    }

    const startNum = type === 'monthly' ? Number(start) : start;
    const endNum = type === 'monthly' ? Number(end) : end;

    if (type === 'monthly' && (isNaN(startNum) || isNaN(endNum) || startNum < 1 || startNum > 12)) {
      return res.status(400).json({ error: 'Invalid month or year.' });
    }

    // Fetch categories safely
    const categoriesQuery = `SELECT * FROM categories WHERE 1=1 ${getDepartmentFilter(department, userType, 'categories')}`;
    const categories = (await pool.query(categoriesQuery)).rows;

    // Fetch users safely
    const usersQuery = 'SELECT id, employee_number, email, type FROM users WHERE 1=1' + 
                       (department && department !== 'All' ? ' AND type = $1' : '');
    const users = (await pool.query(usersQuery, department && department !== 'All' ? [department] : [])).rows;

    // Fetch events safely
    let events = [];
    if (type === 'monthly') {
      const eventsQuery = `
        SELECT * FROM schedule_events
        WHERE 1=1 ${getDepartmentFilter(department, userType, 'events')}
        AND start_date IS NOT NULL
        AND EXTRACT(MONTH FROM start_date)::INT = $1
        AND EXTRACT(YEAR FROM start_date)::INT = $2
      `;
      events = (await pool.query(eventsQuery, [startNum, endNum])).rows;
    } else { // weekly
      const eventsQuery = `
        SELECT * FROM schedule_events
        WHERE 1=1 ${getDepartmentFilter(department, userType, 'events')} ${getDateFilter(start, end)}
      `;
      events = (await pool.query(eventsQuery)).rows;
    }

    // Export XLSX
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();

      // Categories sheet
      const catSheet = workbook.addWorksheet('Categories');
      catSheet.columns = [
        { header: 'ID Number', key: 'idnumber' },
        { header: 'Office', key: 'office' },
        { header: 'Email', key: 'email' },
        { header: 'Department', key: 'department' },
      ];
      categories.forEach(row => catSheet.addRow({
        idnumber: row.idnumber || '',
        office: row.office || '',
        email: row.email || '',
        department: row.department || ''
      }));

      // Users sheet
      const userSheet = workbook.addWorksheet('Users');
      userSheet.columns = [
        { header: 'ID', key: 'id' },
        { header: 'Employee Number', key: 'employee_number' },
        { header: 'Email', key: 'email' },
        { header: 'Type', key: 'type' },
      ];
      users.forEach(row => userSheet.addRow({
        id: row.id || '',
        employee_number: row.employee_number || '',
        email: row.email || '',
        type: row.type || ''
      }));

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

      const officeMap = {};
      categories.forEach(cat => {
        if (cat.office) officeMap[cat.office] = cat.office;
      });

      const formatParticipants = (participants) => {
        if (!participants) return '';
        if (Array.isArray(participants)) return participants.join(', ');
        try {
          const arr = JSON.parse(participants);
          return Array.isArray(arr) ? arr.map(p => `${p}${officeMap[p] ? ` (${officeMap[p]})` : ''}`).join(', ') : participants;
        } catch {
          return participants.toString();
        }
      };

      events.forEach(ev => eventSheet.addRow({
        ...ev,
        participants: formatParticipants(ev.participants),
        start_date: ev.start_date ? new Date(ev.start_date).toLocaleDateString() : '',
        end_date: ev.end_date ? new Date(ev.end_date).toLocaleDateString() : ''
      }));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${department}_${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${department}_${Date.now()}.pdf`);
      doc.pipe(res);

      doc.fontSize(18).text(`Events Report (${type.toUpperCase()}) - Department: ${department}`, { align: 'center' });
      doc.moveDown();

      if (!events.length) {
        doc.text('No events found for this period.');
      } else {
        events.forEach(ev => {
          doc.moveDown(0.5);
          doc.fontSize(12).text(`Program: ${ev.program || ''}`);
          doc.text(`Start Date: ${ev.start_date ? new Date(ev.start_date).toLocaleDateString() : ''}`);
          doc.text(`End Date: ${ev.end_date ? new Date(ev.end_date).toLocaleDateString() : ''}`);
          doc.text(`Department: ${Array.isArray(ev.department) ? ev.department.join(', ') : ev.department || ''}`);
          doc.text(`Participants: ${Array.isArray(ev.participants) ? ev.participants.join(', ') : ev.participants || ''}`);
          doc.text(`Status: ${ev.status || ''}`);
          doc.text('-----------------------------');
        });
      }

      doc.end();
    } else {
      return res.status(400).json({ error: 'Invalid format' });
    }

  } catch (err) {
    console.error('Report error:', err.stack);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});
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
