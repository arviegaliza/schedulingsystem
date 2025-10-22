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


function Home() {
  const navigate = useNavigate(); // ⚡ define navigate here
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [quote, setQuote] = useState(getRandomQuote());

  const BASE_URL = 'https://schedulingsystem-1.onrender.com'; // Render backend

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, usersRes, deptsRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/events`),
          axios.get(`${BASE_URL}/api/users`),
          axios.get(`${BASE_URL}/api/department`),
        ]);

        setEvents(eventsRes.data);
        setUsers(usersRes.data);
        setDepartments(deptsRes.data.map(d => d.department));
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);


  useSocket(() => {
    // You can trigger a data refresh here if needed
    console.log('Received real-time status update!');
    // Optionally, refetch events or update state
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US');
  };

  const formatTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return '';
    // If timeStr is in ISO format, extract just HH:mm:ss
    const time = timeStr.length > 8 ? timeStr.slice(11, 19) : timeStr;
    const date = new Date(`${dateStr.split('T')[0]}T${time}`);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Use only start_date (ISO string) for filtering and sorting
  const now = new Date();
  const upcomingEvents = events
    .filter(ev => {
      const end = new Date(ev.end_date);
      return end > now && String(ev.status).toLowerCase() === 'upcoming';
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // Debug output
  console.log('upcomingEvents:', upcomingEvents);

  // Reset currentEventIdx if upcomingEvents changes
  useEffect(() => {
    setCurrentEventIdx(0);
  }, [upcomingEvents.length]);

  // Automatic slider for upcoming events
  useEffect(() => {
    if (upcomingEvents.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentEventIdx(idx => (idx + 1) % upcomingEvents.length);
    }, 4000); // 4 seconds
    return () => clearInterval(interval);
  }, [upcomingEvents.length]);

  // Fade transition on event change
  useEffect(() => {
    setFadeIn(false);
    const timeout = setTimeout(() => setFadeIn(true), 50);
    return () => clearTimeout(timeout);
  }, [currentEventIdx]);

  // Optionally, refresh quote on every visit (mount)
  useEffect(() => {
    setQuote(getRandomQuote());
  }, []);

  if (loading) {
    return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  }

  return (
    <div className="home-welcome-container dashboard-home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div className="home-welcome-card" style={{ marginBottom: 40, width: '100%', maxWidth: 600 }}>
        {/* Logo replaced with logo192.png from public folder */}
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
                <div className="upcoming-date">{formatDate(upcomingEvents[currentEventIdx]?.start_date)} {formatTime(upcomingEvents[currentEventIdx]?.start_date, upcomingEvents[currentEventIdx]?.start_time)} - {formatDate(upcomingEvents[currentEventIdx]?.end_date)} {formatTime(upcomingEvents[currentEventIdx]?.end_date, upcomingEvents[currentEventIdx]?.end_time)}</div>
                <div className="upcoming-dept">Dept: {Array.isArray(upcomingEvents[currentEventIdx]?.department) ? upcomingEvents[currentEventIdx]?.department.join(', ') : upcomingEvents[currentEventIdx]?.department}</div>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
