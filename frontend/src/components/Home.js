import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useSocket from '../hooks/useSocket';
import './style.css'; // Ensure your CSS file is linked

// --- SVGs for Icons (Embedded to avoid external dependencies) ---
const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const IconBuilding = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="22" x2="12" y2="22.01"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
);

const QUOTES = [
  "Success is not the key to happiness. Happiness is the key to success.",
  "The best way to get started is to quit talking and begin doing.",
  "Don't watch the clock; do what it does. Keep going.",
  "Great things never come from comfort zones.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Stay positive, work hard, make it happen.",
  "Productivity is never an accident. It is always the result of a commitment to excellence.",
  "The secret of getting ahead is getting started.",
  "Small steps every day."
];

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

const MOCK_EVENTS = [
  {
    id: 'mock-1',
    program: 'Demo: Team Meeting',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 3600000).toISOString(),
    start_time: '09:00:00',
    end_time: '10:00:00',
    department: ['Admin'],
    status: 'upcoming'
  }
];

function Home() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [quote, setQuote] = useState(getRandomQuote());
  const [fetchError, setFetchError] = useState(null);

  const BASE_URL = 'https://schedulingsystem-1.onrender.com';

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const axiosInstance = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      signal: controller.signal,
    });

    const fetchWithRetry = async (fn, retries = 2, delay = 700) => {
      try {
        return await fn();
      } catch (err) {
        if (retries <= 0) throw err;
        await new Promise(r => setTimeout(r, delay));
        return fetchWithRetry(fn, retries - 1, Math.round(delay * 1.5));
      }
    };

    const fetchData = async () => {
      try {
        setLoading(true);
        setFetchError(null);

        const [eventsRes, usersRes, deptsRes] = await fetchWithRetry(() =>
          Promise.all([
            axiosInstance.get('/api/events'),
            axiosInstance.get('/api/users'),
            axiosInstance.get('/api/department'),
          ])
        );

        if (!mounted) return;

        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        const deptArray = Array.isArray(deptsRes.data) ? deptsRes.data.map(d => d.department ?? d.name ?? d) : [];
        setDepartments(deptArray);

      } catch (err) {
        console.error('Data fetch failed:', err);
        if (!mounted) return;
        setFetchError('System is currently offline or unreachable.');
        if (events.length === 0) setEvents(MOCK_EVENTS);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useSocket(() => {
    console.log('Real-time update received');
  });

  // --- Formatting Helpers ---
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // --- Data Processing ---
  const now = new Date();
  const upcomingEvents = events
    .filter(ev => {
      try {
        return new Date(ev.end_date) > now && String(ev.status).toLowerCase() === 'upcoming';
      } catch { return false; }
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // --- Effects for Slider ---
  useEffect(() => setCurrentEventIdx(0), [upcomingEvents.length]);

  useEffect(() => {
    if (upcomingEvents.length <= 1) return;
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentEventIdx(idx => (idx + 1) % upcomingEvents.length);
        setFadeIn(true);
      }, 300); // Wait for fade out
    }, 5000);
    return () => clearInterval(interval);
  }, [upcomingEvents.length]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  const activeEvent = upcomingEvents[currentEventIdx];

  return (
    <div className="dashboard-container fade-in">
      
      {/* Header Section */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>SDOIN Scheduling</h1>
          <p className="subtitle">Manage events, track schedules, and generate reports.</p>
        </div>
        <div className="quote-card">
          <blockquote>"{quote}"</blockquote>
        </div>
      </header>

      {/* Error Banner */}
      {fetchError && (
        <div className="error-banner">
          <span>⚠️ {fetchError}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="dashboard-grid">
        
        {/* Left Column: Stats & Actions */}
        <div className="grid-left">
          
          {/* Quick Stats Row */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon blue"><IconCalendar /></div>
              <div className="stat-info">
                <h3>{events.length}</h3>
                <span>Events</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><IconUsers /></div>
              <div className="stat-info">
                <h3>{users.length}</h3>
                <span>Users</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple"><IconBuilding /></div>
              <div className="stat-info">
                <h3>{departments.length}</h3>
                <span>Depts</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="actions-section">
            <h3>Quick Actions</h3>
            <div className="action-buttons">
              <button className="btn-primary" onClick={() => navigate('/dashboard/schedule')}>
                View Schedule
              </button>
              <button className="btn-secondary" onClick={() => navigate('/dashboard/reports')}>
                Reports
              </button>
              <button className="btn-outline" onClick={() => navigate('/dashboard/categories')}>
                Categories
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Events Hero */}
        <div className="grid-right">
          <div className="upcoming-card">
            <div className="card-header">
              <h3>📅 Upcoming Events</h3>
              <span className="badge">{upcomingEvents.length} Active</span>
            </div>
            
            <div className="card-body">
              {upcomingEvents.length === 0 ? (
                <div className="empty-state">No upcoming events scheduled.</div>
              ) : (
                <div className={`event-display ${fadeIn ? 'visible' : 'hidden'}`}>
                  <div className="event-date-box">
                    <span className="month">{new Date(activeEvent?.start_date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="day">{new Date(activeEvent?.start_date).getDate()}</span>
                  </div>
                  <div className="event-details">
                    <h4>{activeEvent?.program}</h4>
                    <p className="time-row">
                      {formatTime(activeEvent?.start_time)} - {formatTime(activeEvent?.end_time)}
                    </p>
                    <p className="dept-row">
                      Department: <strong>{Array.isArray(activeEvent?.department) ? activeEvent.department.join(', ') : activeEvent?.department}</strong>
                    </p>
                  </div>
                </div>
              )}
              
              {/* Slider Dots */}
              {upcomingEvents.length > 1 && (
                <div className="slider-dots">
                  {upcomingEvents.map((_, idx) => (
                    <span 
                      key={idx} 
                      className={`dot ${idx === currentEventIdx ? 'active' : ''}`}
                      onClick={() => setCurrentEventIdx(idx)} // Allow manual click
                    ></span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;