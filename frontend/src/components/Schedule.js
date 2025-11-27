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

// --- HELPER: Fix Timezone & Date Parsing ---
const toLocalDateOnly = (dateLike) => {
  if (!dateLike) return null;
  if (dateLike instanceof Date) {
    return new Date(dateLike.getFullYear(), dateLike.getMonth(), dateLike.getDate());
  }
  const str = String(dateLike).split('T')[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return null;
};

// --- HELPER: Exact Date Time for Status Checks ---
const getDateTime = (dateStr, timeStr) => {
  if (!dateStr) return new Date();
  const cleanDate = dateStr.split('T')[0];
  return new Date(`${cleanDate}T${timeStr || '00:00'}`);
};

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

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      setUser(storedUser);

      if (storedUser?.type === 'OfficeUser') {
        // FIX 1: Map to .position instead of .office
        setFormData(prev => ({
          ...prev,
          department: [{ label: storedUser.department, value: storedUser.department }],
          participants: [{ label: storedUser.position, value: storedUser.position }]
        }));
      }
      document.body.style.overflow = storedUser?.type === 'OfficeUser' ? 'auto' : 'hidden';
    } catch (error) {
      console.error("Error loading user", error);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    if (window.location.pathname === '/office/schedule') {
      navigate('/login1');
    } else {
      navigate('/login');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const dateObj = toLocalDateOnly(dateStr);
    return dateObj ? dateObj.toLocaleDateString('en-US') : '';
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours || 0, 10), parseInt(minutes || 0, 10));
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // --- UPDATED LOGIC: Status Check ---
  const updateEventStatuses = useCallback(() => {
    const now = new Date();
    setEvents(prevEvents =>
      prevEvents.map(event => {
        const start = getDateTime(event.start_date, event.start_time);
        const end = getDateTime(event.end_date, event.end_time);
        
        let status = 'upcoming';

        if (now >= start && now <= end) {
          status = 'ongoing';
        } else if (now > end) {
          status = 'ended';
        }

        if (event.status !== status) {
          return { ...event, status };
        }
        return event;
      })
    );
  }, []);

  // --- UPDATED LOGIC: Fetch with Crash Protection ---
  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/events`);
      const eventsWithParsedData = res.data.map(event => {
        let participants = [];
        try {
          if (Array.isArray(event.participants)) participants = event.participants;
          else if (typeof event.participants === 'string') {
            try { participants = JSON.parse(event.participants); } 
            catch { participants = [event.participants]; }
          }
        } catch (e) { participants = []; }

        let department = [];
        try {
          if (Array.isArray(event.department)) department = event.department;
          else if (typeof event.department === 'string') {
            try { department = JSON.parse(event.department); } 
            catch { department = [event.department]; }
          }
        } catch (e) { department = []; }

        const cleanStartDate = String(event.start_date || '').split('T')[0];
        const cleanEndDate = String(event.end_date || '').split('T')[0];

        const now = new Date();
        const start = getDateTime(cleanStartDate, event.start_time);
        const end = getDateTime(cleanEndDate, event.end_time);
        let status = 'upcoming';
        if (now >= start && now <= end) status = 'ongoing';
        else if (now > end) status = 'ended';

        return {
          ...event,
          participants,
          department,
          status,
          start_date: cleanStartDate,
          end_date: cleanEndDate,
          start_date_only: toLocalDateOnly(cleanStartDate),
          end_date_only: toLocalDateOnly(cleanEndDate)
        };
      });
      setEvents(eventsWithParsedData);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    
    const loadDeps = async () => {
      try {
        const dRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/department`);
        setDepartments(dRes.data.map(d => d.department));
        const cRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/categories`);
        setCategories(cRes.data);
      } catch (e) { console.error(e); }
    };
    loadDeps();

    const socket = io(process.env.REACT_APP_API_URL);
    socket.on('connect', () => console.log('🟢 Connected to WebSocket'));
    socket.on('statusUpdated', () => fetchEvents());

    const interval = setInterval(updateEventStatuses, 5000); 
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [fetchEvents, updateEventStatuses]);

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

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    toast.dismiss();
    setIsSubmitting(true);

    try {
      // FIX 2: Use user.position here too
      const payloadParticipants = user?.type === 'OfficeUser'
        ? [user.position]
        : formData.participants.map(p => p.value);

      const payloadDepartments = user?.type === 'OfficeUser'
        ? [user.department]
        : formData.department.map(d => d.value);

      if (!payloadParticipants.length || !payloadDepartments.length) {
        setIsSubmitting(false);
        return toast.error('Please select at least one department and one participant.');
      }

      let start = getDateTime(formData.start_date, formData.start_time);
      let end = getDateTime(formData.end_date, formData.end_time);
      if (end <= start) {
        const nextDay = new Date(new Date(formData.end_date).getTime() + 86400000);
        formData.end_date = nextDay.toISOString().split('T')[0];
      }

      const payload = {
        ...formData,
        participants: payloadParticipants,
        department: payloadDepartments,
        created_by: user?.email || 'Unknown'
      };

      if (editMode) {
        await axios.put(`${process.env.REACT_APP_API_URL}/api/events/${editingId}`, payload);
        toast.success('Event updated successfully!');
      } else {
        await axios.post(`${process.env.REACT_APP_API_URL}/api/events`, payload);
        toast.success('Event added successfully!');
      }

      await fetchEvents();
      resetForm();
      setShowForm(false);
      setEditMode(false);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toast.error('Conflict: Participant already booked during selected time.');
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
      start_time: (event.start_time || '').slice(0, 5),
      end_date: event.end_date,
      end_time: (event.end_time || '').slice(0, 5),
      participants: (event.participants || []).map(p => ({ label: p, value: p })),
      department: (event.department || []).map(d => ({ label: d, value: d }))
    });
    setEditMode(true);
    setEditingId(event.id);
    setShowForm(true);
    setShowTable(false);
  };

  const canEditEvent = (event) => {
    if (user?.type === 'Administrator') return true;
    if (user?.type === 'OfficeUser') {
      // FIX 3: Check against user.position
      return event.participants && event.participants.includes(user.position);
    }
    return event.department && event.department.includes(user?.type);
  };

  const canDeleteEvent = (event) => {
    if (user?.type === 'Administrator') return true;
    if (user?.type === 'OfficeUser') {
      // FIX 4: Check against user.position
      return event.participants && event.participants.includes(user.position);
    }
    return event.department && event.department.includes(user?.type);
  };

  const handleDelete = async (id) => {
    toast.dismiss();
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/events/${id}`);
      toast.success('Event deleted successfully!');
      fetchEvents();
      setShowTable(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete event.');
    }
  };

  const allowedDepartments = user?.type === 'Administrator' ? departments : user ? [user.type] : [];
  const departmentOptions = allowedDepartments.map(dept => ({ label: dept, value: dept }));

  const filteredCategories = categories.filter(cat =>
    formData.department.some(d => d.value === cat.department.trim())
  );

  // FIX 5: Map 'cat.position' instead of 'cat.office' for the dropdown
  const participantOptions = filteredCategories
    .map(cat => ({ label: cat.position, value: cat.position }));


  // --- HANDLERS FOR TOOLTIP ---
  const handleDayMouseEnter = (tileDate, events, e) => {
    setHoveredDay(tileDate.toDateString());
    setHoveredEvents(events);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleDayMouseLeave = () => {
    setHoveredDay(null);
    setHoveredEvents([]);
  };

  // --- UPDATED LOGIC: Tile Content ---
  const tileContent = ({ date: tileDate, view }) => {
    if (view === 'month') {
      const tileDateOnly = toLocalDateOnly(tileDate);
      const matches = events.filter(event => {
        if (event.status === 'ended') return false; 
        if (!event.start_date_only || !event.end_date_only) return false;
        
        const isMatchDate = tileDateOnly >= event.start_date_only && tileDateOnly <= event.end_date_only;
        const isMatchDept = selectedDept ? (Array.isArray(event.department) && event.department.includes(selectedDept)) : true;
        
        return isMatchDate && isMatchDept;
      });

      if (matches.length === 0) return null;

      return (
        <div
          className="calendar-tile-content"
          onMouseEnter={(e) => handleDayMouseEnter(tileDate, matches, e)}
          onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
          onMouseLeave={handleDayMouseLeave}
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

  const eventsForSelectedDate = events.filter((event) => {
    if (event.status === 'ended') return false;
    if (!event.start_date_only || !event.end_date_only) return false;
    const selectedDateOnly = toLocalDateOnly(date);
    const matchesDate = (selectedDateOnly >= event.start_date_only && selectedDateOnly <= event.end_date_only);
    const matchesDept = selectedDept ? (Array.isArray(event.department) && event.department.includes(selectedDept)) : true;
    return matchesDate && matchesDept;
  });

  return (
    <div className="schedule-container">
      {user?.type === 'OfficeUser' && (
        <div style={{ textAlign: 'right', fontWeight: 'bold', marginBottom: '10px' }}>
          {/* FIX 6: Display Position */}
          Officer: {user?.position}
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
          if (user?.type === 'OfficeUser') {
            setFormData({
              program: '',
              start_date: '',
              start_time: '',
              end_date: '',
              end_time: '',
              purpose: '',
              department: [{ label: user.department, value: user.department }],
              // FIX 7: Use user.position for OfficeUser default
              participants: [{ label: user.position, value: user.position }]
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
                    <td>{Array.isArray(event.participants) ? event.participants.join(', ') : ''}</td>
                    <td>{Array.isArray(event.department) ? event.department.join(', ') : ''}</td>
                    <td>
                      <span className="status-badge">
                        {String(event.status || '').charAt(0).toUpperCase() + String(event.status || '').slice(1)}
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
                onClick={() => setShowForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  color: '#888',
                  cursor: 'pointer',
                  marginLeft: '16px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div className="form-top-right">
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
              {user?.type === 'OfficeUser' && (
                <>
                  <div className="form-col">
                    <label>Department</label>
                    <input type="text" value={user.department} disabled />
                  </div>
                  <div className="form-col">
                    {/* FIX 8: Label Position and use user.position */}
                    <label>Position</label>
                    <input type="text" value={user.position} disabled />
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