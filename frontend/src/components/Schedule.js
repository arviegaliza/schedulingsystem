// ...all your imports
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
  const [showTable, setShowTable] = useState(false);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoveredEvents, setHoveredEvents] = useState([]);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);

    // If OfficeUser, pre-select department and participants
    if (storedUser?.type === 'OfficeUser') {
      setFormData(formData => ({
        ...formData,
        department: [{ label: storedUser.department, value: storedUser.department }],
        participants: [{ label: storedUser.office, value: storedUser.office }]
      }));
    }

    document.body.style.overflow = storedUser?.type === 'OfficeUser' ? 'auto' : 'hidden';
  }, []);

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

  const handleLogout = () => {
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    // If on /office/schedule, always go to /login1
    if (window.location.pathname === '/office/schedule') {
      navigate('/login1');
    } else {
      navigate('/login');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get('http://sdoinschedulingsystem.loc:8081/api/events');
      const eventsWithParsedData = res.data.map(event => ({
        ...event,
        participants: typeof event.participants === 'string' ? JSON.parse(event.participants) : event.participants || [],
        department: typeof event.department === 'string' ? JSON.parse(event.department) : event.department || [],
      }));
      setEvents(eventsWithParsedData);
    } catch (err) {
      toast.error('Failed to load events.');
    }
  }, []);

  useEffect(() => {
  const socket = io('http://sdoinschedulingsystem.loc:8081');
    socket.on('connect', () => console.log('🟢 Connected to WebSocket'));
    socket.on('statusUpdated', () => fetchEvents());
    return () => socket.disconnect();
  }, [fetchEvents]);

  const fetchDepartments = useCallback(async () => {
    try {
  const res = await axios.get('http://sdoinschedulingsystem.loc:8081/api/department');
      setDepartments(res.data.map(d => d.department));
    } catch (err) {
      toast.error('Failed to load departments.');
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
  const res = await axios.get('http://sdoinschedulingsystem.loc:8081/api/categories');
      setCategories(res.data);
    } catch (err) {
      toast.error('Failed to load categories.');
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchDepartments();
    fetchCategories();
  }, [fetchEvents, fetchDepartments, fetchCategories]);

  const resetForm = () => setFormData({
    program: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    purpose: '',
    participants: [],
    department: []
  });

  const getDateTime = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}`);

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    toast.dismiss();
    setIsSubmitting(true);

    const payload = {
      ...formData,
      participants: user?.type === 'OfficeUser'
        ? [user.office]
        : formData.participants.map(p => p.value),
      department: user?.type === 'OfficeUser'
        ? [user.department]
        : formData.department.map(d => d.value),
      created_by: user?.email || 'Unknown'
    };

    if (!payload.participants.length || !payload.department.length) {
      return toast.error('Please select at least one department and one participant.');
    }

    const payloadParticipants = payload.participants.map(p => p.trim().toLowerCase());
    const newStart = getDateTime(payload.start_date, payload.start_time);
    const newEnd = getDateTime(payload.end_date, payload.end_time);

    // Robust office conflict check
    const hasOfficeConflict = events.some(event => {
      if (editMode && event.id === editingId) return false;
      const eventStart = getDateTime(event.start_date, event.start_time);
      const eventEnd = getDateTime(event.end_date, event.end_time);
      const overlaps = newStart < eventEnd && newEnd > eventStart;

      // Always treat participants as array of normalized strings
      let eventParticipants = [];
      if (Array.isArray(event.participants)) {
        eventParticipants = event.participants;
      } else if (typeof event.participants === 'string') {
        try {
          const parsed = JSON.parse(event.participants);
          eventParticipants = Array.isArray(parsed) ? parsed : [event.participants];
        } catch {
          eventParticipants = [event.participants];
        }
      }
      const normalizedEventParticipants = eventParticipants.map(p => p.trim().toLowerCase());
      const officeConflict = normalizedEventParticipants.some(p => payloadParticipants.includes(p));
      return overlaps && officeConflict;
    });

    if (hasOfficeConflict) {
      toast.error('Conflict: A selected office is already booked during the selected date & time range.');
      return;
    }

    try {
      if (editMode) {
  await axios.put(`http://sdoinschedulingsystem.loc:8081/api/events/${editingId}`, payload);
        toast.success('Event updated successfully!');
      } else {
  await axios.post('http://sdoinschedulingsystem.loc:8081/api/events', payload);
        toast.success('Event added successfully!');
      }
      fetchEvents();
      setShowForm(false);
      setEditMode(false);
      resetForm();
    } catch (err) {
      const conflictMsg = 'Conflict: A selected office is already booked during the selected date & time range.';
      if (
        err.response &&
        err.response.data &&
        err.response.data.error &&
        err.response.data.error.includes('selected office is already booked')
      ) {
        toast.error(conflictMsg);
      } else {
        toast.error('Failed to save event.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (event) => {
    setFormData({
      ...event,
      start_date: event.start_date,
      start_time: event.start_time.slice(0, 5),
      end_date: event.end_date,
      end_time: event.end_time.slice(0, 5),
      participants: (event.participants || []).map(p => ({ label: p, value: p })),
      department: (event.department || []).map(d => ({ label: d, value: d }))
    });
    setEditMode(true);
    setEditingId(event.id);
    setShowForm(true);
  };

  // Restrict department options for non-admin users
  const allowedDepartments = user?.type === 'Administrator' ? departments : user ? [user.type] : [];
  const departmentOptions = allowedDepartments
    .map(dept => ({ label: dept, value: dept }))
    .filter(option => {
      const isSelected = formData.department.some(d => d.value === option.value);
      const newStart = getDateTime(formData.start_date, formData.start_time);
      const newEnd = getDateTime(formData.end_date, formData.end_time);

      const isBooked = events.some(event => {
        if (editMode && event.id === editingId) return false;
        const eventStart = getDateTime(event.start_date, event.start_time);
        const eventEnd = getDateTime(event.end_date, event.end_time);
        const overlaps = newStart < eventEnd && newEnd > eventStart;
        return overlaps && event.department.includes(option.value);
      });

      return isSelected || !isBooked;
    });

  const filteredCategories = categories.filter(cat =>
    formData.department.some(d => d.value === cat.department.trim())
  );

  const unavailableParticipants = events
    .filter(event => {
      if (editMode && event.id === editingId) return false;
      const eventStart = getDateTime(event.start_date, event.start_time);
      const eventEnd = getDateTime(event.end_date, event.end_time);
      const newStart = getDateTime(formData.start_date, formData.start_time);
      const newEnd = getDateTime(formData.end_date, formData.end_time);
      return newStart < eventEnd && newEnd > eventStart;
    })
    .flatMap(event => event.participants || []);

  const participantOptions = filteredCategories
    .map(cat => ({ label: cat.office, value: cat.office }))
    .filter(opt => {
      const isSelected = formData.participants.some(p => p.value === opt.value);
      return isSelected || !unavailableParticipants.includes(opt.value);
    });

  const eventsForSelectedDate = events.filter((event) => {
    if (event.status === 'ended') return false;
    const eventStartDate = new Date(event.start_date);
    const eventEndDate = new Date(event.end_date);
    const isInRange = eventStartDate <= date && eventEndDate >= date;
    const matchesDept = selectedDept ? event.department?.includes(selectedDept) : true;
    return isInRange && matchesDept;
  });

  const handleDayMouseEnter = (tileDate, events, e) => {
    setHoveredDay(tileDate.toDateString());
    setHoveredEvents(events);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  const handleDayMouseLeave = () => {
    setHoveredDay(null);
    setHoveredEvents([]);
  };

  const tileContent = ({ date: tileDate, view }) => {
    if (view === 'month') {
      const matches = events.filter(event => {
        if (event.status === 'ended') return false;
        const eventStartDate = new Date(event.start_date);
        const eventEndDate = new Date(event.end_date);
        return eventStartDate <= tileDate &&
          eventEndDate >= tileDate &&
          (selectedDept ? event.department?.includes(selectedDept) : true);
      });
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
    }
    return null;
  };

  // Only allow editing events for the user's department (unless admin)
  const canEditEvent = (event) => {
    if (user?.type === 'Administrator') return true;
    if (user?.type === 'OfficeUser') {
      // Allow edit if the event's participants include the user's office
      return event.participants && event.participants.includes(user.office);
    }
    return event.department && event.department.includes(user?.type);
  };

  // Only allow deleting events for the user's department (unless admin), or for OfficeUser their own office
  const canDeleteEvent = (event) => {
    if (user?.type === 'Administrator') return true;
    if (user?.type === 'OfficeUser') {
      return event.participants && event.participants.includes(user.office);
    }
    return event.department && event.department.includes(user?.type);
  };

  const handleDelete = async (id) => {
    toast.dismiss();
    try {
      await axios.delete(`http://sdoinschedulingsystem.loc:8081/api/events/${id}`);
      toast.success('Event deleted successfully!');
      fetchEvents();
    } catch (err) {
      toast.error('Failed to delete event.');
    }
  };

  return (
    <div className="schedule-container">
      {user?.type === 'OfficeUser' && (
        <div style={{ textAlign: 'right', fontWeight: 'bold', marginBottom: '10px' }}>
          Officer: {user?.office}
        </div>
      )}
      {/* Professional Schedule Header */}
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
        <button className="add-entry-btn full-width-mobile" style={{marginTop: 8}} onClick={() => {
          if (user?.type === 'OfficeUser') {
            setFormData({
              program: '',
              start_date: '',
              start_time: '',
              end_date: '',
              end_time: '',
              purpose: '',
              department: [{ label: user.department, value: user.department }],
              participants: [{ label: user.office, value: user.office }]
            });
          } else {
            resetForm();
          }
          setEditMode(false);
          setShowForm(true);
        }}>
          New Entry
        </button>
      </div>
      {/* End Professional Schedule Header */}
      {/* Calendar */}
      <Calendar
        onChange={(selectedDate) => { setDate(selectedDate); setShowTable(true); }}
        value={date}
        tileContent={tileContent}
      />
      <p className="selected-date" style={{ marginTop: 0, marginBottom: 16, textAlign: 'center' }}>Selected Date: <strong>{date.toDateString()}</strong></p>

      {/* Event Table */}
      {showTable && eventsForSelectedDate.length > 0 && (
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
                {eventsForSelectedDate.map((event) => (
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
                      <span className="status-badge">
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      {canEditEvent(event) && <button 
                        className="edit-btn" 
                        style={{ fontWeight: 'bold', color: 'black', background: 'white', border: '2px solid #007bff' }}
                        onClick={() => handleEdit(event)}
                        disabled={isSubmitting}
                      >
                        Edit
                      </button>}
                      {canDeleteEvent(event) && <button 
                        className="delete-btn" 
                        style={{ fontWeight: 'bold', color: 'black', background: 'white', border: '2px solid #dc3545' }}
                        onClick={() => handleDelete(event.id)}
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="event-form-overlay" onClick={() => setShowForm(false)}>
          <form className="event-form" onClick={(e) => e.stopPropagation()} onSubmit={handleAddOrUpdate}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{editMode ? 'Edit Event' : 'Add New Event'}</h3>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Close"
                onClick={() => setShowForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  color: '#888',
                  cursor: 'pointer',
                  marginLeft: '16px',
                  lineHeight: 1,
                  transition: 'color 0.2s',
                }}
              >
                ×
              </button>
            </div>
            <div className="form-top-right">
              {/* Department and Participants fields for non-OfficeUser */}
              {user?.type !== 'OfficeUser' && (
                <div className="form-col">
                  <label>Department</label>
                  <Select isMulti options={departmentOptions} value={formData.department}
                    onChange={(selected) => setFormData({ ...formData, department: selected, participants: [] })} />
                </div>
              )}
              {user?.type !== 'OfficeUser' && formData.department.length > 0 && (
                <div className="form-col">
                  <label>Participants</label>
                  <Select isMulti options={participantOptions} value={formData.participants}
                    onChange={(selected) => setFormData({ ...formData, participants: selected })} />
                </div>
              )}
              {/* For OfficeUser, show department and office as disabled fields */}
              {user?.type === 'OfficeUser' && (
                <>
                  <div className="form-col">
                    <label>Department</label>
                    <input type="text" value={user.department} disabled />
                  </div>
                  <div className="form-col">
                    <label>Office</label>
                    <input type="text" value={user.office} disabled />
                  </div>
                </>
              )}
            </div>
            <div className="form-col">
              <label>Program Name</label>
              <input name="program" value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })} required />
            </div>
            <div className="form-row">
              <div className="form-col">
                <label>Start Date</label>
                <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
              </div>
              <div className="form-col">
                <label>Start Time</label>
                <input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-col">
                <label>End Date</label>
                <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
              </div>
              <div className="form-col">
                <label>End Time</label>
                <input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} required />
              </div>
            </div>
            <div className="form-col">
              <label>Purpose</label>
              <textarea value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} required />
            </div>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editMode ? 'Update' : 'Save'} Entry
            </button>
          </form>
        </div>
      )}

      {/* Tooltip for day details */}
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
            fontSize: '14px',
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

      <ToastContainer position="top-right" autoClose={4000} hideProgressBar newestOnTop />
    </div>
  );
}

export default Schedule;
