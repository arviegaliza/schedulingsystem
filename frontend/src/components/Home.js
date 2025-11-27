import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';
import axios from 'axios';
import useSocket from '../hooks/useSocket';

const QUOTES = [
  "Success is not the key to happiness. Happiness is the key to success.",
  "The best way to get started is to quit talking and begin doing.",
  "Don't watch the clock; do what it does. Keep going.",
  "Great things never come from comfort zones.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Stay positive, work hard, make it happen.",
  "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort.",
  "The secret of getting ahead is getting started.",
  "Small steps every day."
];

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

// Optional lightweight mock so UI doesn't look empty when offline.
// Remove or extend this if you have a proper cached store.
const MOCK_EVENTS = [
  {
    id: 'mock-1',
    program: 'Demo: Mock Event',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 3600000).toISOString(),
    start_time: '09:00:00',
    end_time: '10:00:00',
    department: ['SGOD'],
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

  // Point to your backend; update if needed
  const BASE_URL = 'https://schedulingsystem-1.onrender.com';

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const axiosInstance = axios.create({
      baseURL: BASE_URL,
      timeout: 10000, // 10s
      signal: controller.signal,
    });

    // Simple retry/backoff helper
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
        // department endpoint might return objects like { department: 'X' } or strings
        const deptArray = Array.isArray(deptsRes.data) ? deptsRes.data.map(d => d.department ?? d.name ?? d) : [];
        setDepartments(deptArray);

        // if everything fetched fine but arrays are empty, leave as-is
      } catch (err) {
        // verbose console info for debugging
        console.error('Failed to fetch data - message:', err?.message);
        console.error('Error code:', err?.code);                   // e.g. ECONNRESET, ECONNABORTED
        console.error('Is Axios error:', !!err?.isAxiosError);
        if (err?.request && !err?.response) {
          console.error('Request made but no response received:', err.request);
        } else if (err?.response) {
          console.error('Response status:', err.response.status, 'data:', err.response.data);
        }

        if (!mounted) return;

        setFetchError('Unable to contact scheduling backend. Check server or network.');

        // Optional fallback so UI stays useful during outages:
        if (events.length === 0) {
          setEvents(MOCK_EVENTS);
        }
        // Keep users/departments as empty or provide mock data if you prefer.
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run on mount only

  useSocket(() => {
    // You can trigger a data refresh here if desired
    // e.g. re-fetch events or call an endpoint to get delta
    console.log('Received real-time status update!');
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US');
  };

  const formatTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return '';
    const time = timeStr.length > 8 ? timeStr.slice(11, 19) : timeStr;
    const date = new Date(`${dateStr.split('T')[0]}T${time}`);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Use end_date and status for upcoming filter
  const now = new Date();
  const upcomingEvents = events
    .filter(ev => {
      try {
        const end = new Date(ev.end_date);
        return end > now && String(ev.status).toLowerCase() === 'upcoming';
      } catch (e) {
        return false;
      }
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // debug
  // console.log('upcomingEvents:', upcomingEvents);

  // Reset currentEventIdx when events change
  useEffect(() => {
    setCurrentEventIdx(0);
  }, [upcomingEvents.length]);

  // Auto slider
  useEffect(() => {
    if (upcomingEvents.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentEventIdx(idx => (idx + 1) % upcomingEvents.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [upcomingEvents.length]);

  // Fade animation when event changes
  useEffect(() => {
    setFadeIn(false);
    const timeout = setTimeout(() => setFadeIn(true), 50);
    return () => clearTimeout(timeout);
  }, [currentEventIdx]);

  // Refresh quote on mount
  useEffect(() => {
    setQuote(getRandomQuote());
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="home-welcome-container dashboard-home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div className="home-welcome-card" style={{ marginBottom: 40, width: '100%', maxWidth: 600 }}>
        <h1>Welcome to SDOIN SCHEDULING </h1>
        <p className="home-desc">
          Effortlessly manage, schedule, and track all your department's events and activities.<br/>
          Use the sidebar to navigate between Schedules, Reports, Categories, and more.
        </p>

        <div style={{ margin: '18px 0', fontStyle: 'italic', color: '#007bff', fontSize: '1.1rem' }}>
          {quote}
        </div>

        <div className="home-quick-actions">
          <button onClick={() => navigate('/dashboard/schedule')}>View Schedule</button>
          <button onClick={() => navigate('/dashboard/reports')}>Download Reports</button>
          <button onClick={() => navigate('/dashboard/categories')}>Manage Categories</button>
        </div>
      </div>

      {/* friendly error banner */}
      {fetchError && (
        <div className="alert error" style={{ maxWidth: 1200, marginBottom: 18 }}>
          {fetchError} — Try refreshing the page or check the server. (See console for details.)
        </div>
      )}

      <div className="home-stats-events" style={{ width: '100%', maxWidth: 1200 }}>
        <div className="home-stats">
          <div className="stat-card">
            <div className="stat-value">{events.length}</div>
            <div className="stat-label">Total Events</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{departments.length}</div>
            <div className="stat-label">Departments</div>
          </div>
        </div>

        <div className="home-upcoming">
          <h3>Upcoming Events</h3>
          {upcomingEvents.length === 0 ? (
            <div className="no-events">No upcoming events.</div>
          ) : (
            <ul className="upcoming-list">
              <li className={`upcoming-item upcoming-slide-horizontal${fadeIn ? ' show' : ''}`}>
                <div className="upcoming-title">{upcomingEvents[currentEventIdx]?.program}</div>
                <div className="upcoming-date">
                  {formatDate(upcomingEvents[currentEventIdx]?.start_date)} {formatTime(upcomingEvents[currentEventIdx]?.start_date, upcomingEvents[currentEventIdx]?.start_time)}
                  {' - '}
                  {formatDate(upcomingEvents[currentEventIdx]?.end_date)} {formatTime(upcomingEvents[currentEventIdx]?.end_date, upcomingEvents[currentEventIdx]?.end_time)}
                </div>
                <div className="upcoming-dept">
                  Dept: {Array.isArray(upcomingEvents[currentEventIdx]?.department) ? upcomingEvents[currentEventIdx]?.department.join(', ') : upcomingEvents[currentEventIdx]?.department}
                </div>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
