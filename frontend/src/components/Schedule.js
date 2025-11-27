// src/components/Schedule.js
import React, { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Schedule.css';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select from 'react-select';
import { io } from 'socket.io-client';
import { useNavigate, useOutletContext } from 'react-router-dom';

function Schedule() {
  const { sidebarVisible = true } = useOutletContext() || {};
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [showTable, setShowTable] = useState(false);
  const [date, setDate] = useState(new Date());
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoveredEvents, setHoveredEvents] = useState([]);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');

  const [formData, setFormData] = useState({
    program: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    purpose: '',
    participants: [],
    department: []
  });

  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ----------------------------
  // Helper Functions
  // ----------------------------
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('en-US');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const dateObj = new Date();
    dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const toLocalDateOnly = (dateLike) => {
    if (!dateLike) return null;
    const d = new Date(dateLike);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const [year, month, day] = String(dateLike).split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const getDateTime = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}`);

  // ----------------------------
  // Event status updater
  // ----------------------------
  const updateEventStatuses = useCallback(() => {
    const now = new Date();
    setEvents(prevEvents =>
      prevEvents.map(event => {
        const start = getDateTime(event.start_date, event.start_time);
        const end = getDateTime(event.end_date, event.end_time);
        let status = 'upcoming';
        if (now >= start && now <= end) status = 'ongoing';
        else if (now > end) status = 'ended';
        return { ...event, status };
      })
    );
  }, []);

  // ----------------------------
  // Fetching data
  // ----------------------------
  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/events`);
      const normalized = res.data.map(event => {
        const participants = typeof event.participants === 'string'
          ? (event.participants ? JSON.parse(event.participants) : [])
          : (event.participants || []);
        const department = typeof event.department === 'string'
          ? (event.department ? JSON.parse(event.department) : [])
          : (event.department || []);
        return {
          ...event,
          participants,
          department,
          start_date_only: toLocalDateOnly(event.start_date),
          end_date_only: toLocalDateOnly(event.end_date)
        };
      });
      setEvents(normalized);
    } catch (err) {
      console.error('Failed to load events:', err);
      toast.error('Failed to load events.');
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/department`);
      setDepartments(res.data.map(d => d.department));
    } catch (err) {
      console.error('Failed to load departments:', err);
      toast.error('Failed to load departments.');
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/categories`);
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      toast.error('Failed to load categories.');
    }
  }, []);

  // ----------------------------
  // Effects
  // ----------------------------
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchDepartments();
    fetchCategories();
  }, [fetchEvents, fetchDepartments, fetchCategories]);

  useEffect(() => {
    updateEventStatuses();
    const interval = setInterval(updateEventStatuses, 60 * 1000);
    return () => clearInterval(interval);
  }, [updateEventStatuses]);

  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL);
    socket.on('connect', () => console.log('🟢 Connected to WebSocket'));
    socket.on('statusUpdated', fetchEvents);
    return () => socket.disconnect();
  }, [fetchEvents]);

  // ----------------------------
  // Logout
  // ----------------------------
  const handleLogout = () => {
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate(window.location.pathname === '/office/schedule' ? '/login1' : '/login');
  };

  // ----------------------------
  // Tooltip handlers
  // ----------------------------
  const handleDayMouseEnter = (tileDate, events, e) => {
    setHoveredDay(tileDate.toDateString());
    setHoveredEvents(events);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  const handleDayMouseLeave = () => { setHoveredDay(null); setHoveredEvents([]); };

  // ----------------------------
  // Form Handlers
  // ----------------------------
  const handleFormChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  // ----------------------------
  // Double-booking check
  // ----------------------------
  const isOverlapping = (participant, startDT, endDT, ignoreId = null) => {
    return events.some(event => {
      if (ignoreId && event.id === ignoreId) return false;
      if (!event.participants.includes(participant)) return false;
      const evStart = getDateTime(event.start_date, event.start_time);
      const evEnd = getDateTime(event.end_date, event.end_time);
      return startDT < evEnd && endDT > evStart;
    });
  };

  const handleSubmitForm = async () => {
    const startDT = getDateTime(formData.start_date, formData.start_time);
    const endDT = getDateTime(formData.end_date, formData.end_time);
    for (let p of formData.participants.map(p => p.value)) {
      if (isOverlapping(p, startDT, endDT, editMode ? editingId : null)) {
        toast.error(`Participant "${p}" is already booked in another event during this time.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        participants: JSON.stringify(formData.participants.map(p => p.value)),
        department: JSON.stringify(formData.department.map(d => d.value))
      };
      if (editMode) {
        await axios.put(`${process.env.REACT_APP_API_URL}/api/events/${editingId}`, payload);
        toast.success('Event updated');
      } else {
        await axios.post(`${process.env.REACT_APP_API_URL}/api/events`, payload);
        toast.success('Event created');
      }
      fetchEvents();
      setShowForm(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEvent = (event) => {
    setEditingId(event.id);
    setFormData({
      ...event,
      participants: event.participants.map(p => ({ label: p, value: p })),
      department: event.department.map(d => ({ label: d, value: d }))
    });
    setEditMode(true);
    setShowForm(true);
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/events/${id}`);
      toast.success('Event deleted');
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete event');
    }
  };

  // ----------------------------
  // JSX Render
  // ----------------------------
  return (
    <div className="schedule-container">
      {user?.type === 'OfficeUser' && (
        <div style={{ textAlign: 'right', fontWeight: 'bold', marginBottom: '10px' }}>
          Officer: {user?.office}
        </div>
      )}

      <div className="schedule-header logout-relative">
        {user?.type === 'OfficeUser' && (
          <button className="logout-btn logout-top-right" onClick={handleLogout}>
            Logout
          </button>
        )}
        <h2 className="schedule-title">Schedule</h2>

        <div className="header-mobile-stack">
          <div className="filter-stack">
            <label className="dropdown-label">Filter by Department:</label>
            <select className="user-dropdown" value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setShowTable(false); }}>
              <option value="">All Departments</option>
              {departments.map((dept, i) => <option key={i} value={dept}>{dept}</option>)}
            </select>
          </div>
          <hr className="filter-hr" />
        </div>

        <button className="add-entry-btn full-width-mobile" style={{ marginTop: 8 }} onClick={() => {
          setFormData({
            program: '',
            start_date: '',
            start_time: '',
            end_date: '',
            end_time: '',
            purpose: '',
            participants: [],
            department: []
          });
          setEditMode(false);
          setShowForm(true);
        }}>
          New Entry
        </button>
      </div>

      {/* Calendar */}
      <Calendar
        onChange={(selectedDate) => { setDate(selectedDate); setShowTable(true); }}
        value={date}
        tileContent={({ date: tileDate, view }) => {
          if (view !== 'month') return null;
          const tileDateOnly = toLocalDateOnly(tileDate);
          const matches = events.filter(event => event.status !== 'ended' &&
            tileDateOnly >= event.start_date_only && tileDateOnly <= event.end_date_only &&
            (selectedDept ? event.department?.includes(selectedDept) : true)
          );
          return (
            <div
              className="calendar-tile-content"
              onMouseEnter={matches.length > 0 ? (e) => handleDayMouseEnter(tileDate, matches, e) : undefined}
              onMouseMove={matches.length > 0 ? (e) => setTooltipPos({ x: e.clientX, y: e.clientY }) : undefined}
              onMouseLeave={matches.length > 0 ? handleDayMouseLeave : undefined}
            >
              <ul className="calendar-events">
                {matches.map((event, i) => (
                  <li key={i} className="event-dot" title={event.program}>•</li>
                ))}
              </ul>
            </div>
          );
        }}
      />

      <p className="selected-date" style={{ marginTop: 0, marginBottom: 16, textAlign: 'center' }}>
        Selected Date: <strong>{date.toDateString()}</strong>
      </p>

      {/* Event Table */}
      {showTable && (
        <div className="event-table-wrapper" onClick={() => setShowTable(false)}>
          <div className={`event-table-modal${sidebarVisible === false ? ' sidebar-hidden' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button className="close-table-btn" onClick={() => setShowTable(false)}>×</button>
            <h3>Events on {date.toDateString()}</h3>
            <table className="event-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Purpose</th>
                  <th>Participants</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.filter(event => event.start_date_only <= date && event.end_date_only >= date).map(event => (
                  <tr key={event.id}>
                    <td>{event.program}</td>
                    <td>
                      <div>{formatDate(event.start_date)}</div>
                      <div>{formatTime(event.start_time)}</div>
                    </td>
                    <td>
                      <div>{formatDate(event.end_date)}</div>
                      <div>{formatTime(event.end_time)}</div>
                    </td>
                    <td>{event.purpose}</td>
                    <td>{event.participants?.join(', ')}</td>
                    <td>{event.department?.join(', ')}</td>
                    <td>
                      <span className={`status-badge status-${event.status}`}>
                        {String(event.status || '').charAt(0).toUpperCase() + String(event.status || '').slice(1)}
                      </span>
                    </td>
                    <td>
                      {user?.type === 'Administrator' && (
                        <>
                          <button onClick={() => handleEditEvent(event)}>Edit</button>
                          <button onClick={() => handleDeleteEvent(event.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {hoveredDay && hoveredEvents.length > 0 && (
        <div
          className="calendar-tooltip"
          style={{
            position: 'fixed',
            top: tooltipPos.y + 10,
            left: tooltipPos.x + 10,
            zIndex: 9999,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            padding: '12px',
            minWidth: '260px',
            pointerEvents: 'none',
            fontSize: '14px'
          }}
        >
          <strong>Events on {hoveredDay}:</strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {hoveredEvents.map((event, i) => (
              <li key={i} style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                <div><b>Program:</b> {event.program}</div>
                <div><b>Time:</b> {formatDate(event.start_date)} {formatTime(event.start_time)} - {formatDate(event.end_date)} {formatTime(event.end_time)}</div>
                <div><b>Purpose:</b> {event.purpose}</div>
                <div><b>Participants:</b> {event.participants?.join(', ')}</div>
                <div><b>Department:</b> {event.department?.join(', ')}</div>
                <div><b>Status:</b> {event.status}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add/Edit Event Form Modal */}
      {showForm && (
        <div className="form-modal-wrapper" onClick={() => setShowForm(false)}>
          <div className="form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editMode ? 'Edit Event' : 'New Event'}</h3>

            <label>Program:</label>
            <input value={formData.program} onChange={(e) => handleFormChange('program', e.target.value)} />

            <label>Purpose:</label>
            <input value={formData.purpose} onChange={(e) => handleFormChange('purpose', e.target.value)} />

            <label>Start Date:</label>
            <input type="date" value={formData.start_date} onChange={(e) => handleFormChange('start_date', e.target.value)} />

            <label>Start Time:</label>
            <input type="time" value={formData.start_time} onChange={(e) => handleFormChange('start_time', e.target.value)} />

            <label>End Date:</label>
            <input type="date" value={formData.end_date} onChange={(e) => handleFormChange('end_date', e.target.value)} />

            <label>End Time:</label>
            <input type="time" value={formData.end_time} onChange={(e) => handleFormChange('end_time', e.target.value)} />

            <label>Department:</label>
            <Select
              options={departments.map(d => ({ label: d, value: d }))}
              value={formData.department}
              onChange={(selected) => handleFormChange('department', selected)}
              isMulti
            />

            <label>Participants:</label>
            <Select
              options={categories.map(c => ({ label: c.name, value: c.name }))}
              value={formData.participants}
              onChange={(selected) => handleFormChange('participants', selected)}
              isMulti
            />

            <div className="form-buttons">
              <button onClick={handleSubmitForm} disabled={isSubmitting}>
                {editMode ? 'Update' : 'Create'}
              </button>
              <button onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={4000} hideProgressBar newestOnTop />
    </div>
  );
}

export default Schedule;
