import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useSocket from '../hooks/useSocket';
import './style.css';

// --- Assets & Constants ---
const DEFAULT_LOGO = "https://via.placeholder.com/100?text=Logo"; // Replace with your actual logo path
const QUOTES = [
  "Success is not the key to happiness. Happiness is the key to success.",
  "The best way to get started is to quit talking and begin doing.",
  "Don't watch the clock; do what it does. Keep going.",
  "Great things never come from comfort zones.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Productivity is never an accident. It is always the result of a commitment to excellence.",
  "Small steps every day."
];

// --- Sub-Components (Icons) ---
const IconCalendar = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const IconUsers = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const IconBuilding = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="22" x2="12" y2="22.01"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
);

function Home() {
  const navigate = useNavigate();
  
  // State
  const [data, setData] = useState({ events: [], users: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  const BASE_URL = 'https://schedulingsystem-1.onrender.com';

  // --- Helpers ---
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    // Handle "HH:MM:SS" or "HH:MM"
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // --- API Fetching ---
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const axiosInstance = axios.create({ 
      baseURL: BASE_URL, 
      timeout: 15000,
      signal: controller.signal 
    });

    const fetchData = async () => {
      try {
        setLoading(true);
        const [eventsRes, usersRes, deptsRes] = await Promise.all([
          axiosInstance.get('/api/events'),
          axiosInstance.get('/api/users'),
          axiosInstance.get('/api/department'),
        ]);

        if (mounted) {
          setData({
            events: Array.isArray(eventsRes.data) ? eventsRes.data : [],
            users: Array.isArray(usersRes.data) ? usersRes.data : [],
            departments: Array.isArray(deptsRes.data) ? deptsRes.data : []
          });
          setFetchError(null);
        }
      } catch (err) {
        console.error("Dashboard Load Error:", err);
        if (mounted) setFetchError("Unable to load latest data.");
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
    console.log('Live update received');
    // Optional: Trigger re-fetch here if your socket returns a "dirty" signal
  });

  // --- Memoized Logic ---
  // Filters and sorts events. Only runs when `data.events` changes.
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return data.events
      .filter(ev => {
        const end = new Date(ev.end_date);
        return end > now && String(ev.status).toLowerCase() === 'upcoming';
      })
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  }, [data.events]);

  // --- Slider Animation ---
  useEffect(() => {
    if (upcomingEvents.length <= 1) return;
    
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentEventIdx(prev => (prev + 1) % upcomingEvents.length);
        setFadeIn(true);
      }, 500); // Wait for fade out transition (CSS matches .5s)
    }, 5000); // 5 seconds per slide

    return () => clearInterval(interval);
  }, [upcomingEvents.length]);

  // Reset index if list changes drastically
  useEffect(() => {
    if (currentEventIdx >= upcomingEvents.length) {
      setCurrentEventIdx(0);
    }
  }, [upcomingEvents.length, currentEventIdx]);


  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  const activeEvent = upcomingEvents[currentEventIdx];

  return (
    <div className="home-welcome-container dashboard-home">
      
      {/* 1. Welcome Card (Center/Top) */}
      <div className="home-welcome-card">
        {/* Placeholder Logo - Replace src with your actual import or URL */}
        <img src={DEFAULT_LOGO} alt="SDOIN Logo" className="home-logo" />
        
        <h1>{getGreeting()}!</h1>
        <p className="home-desc">
          Welcome to the <strong>SDOIN Scheduling System</strong>.<br/>
          {quote}
        </p>

        <div className="home-quick-actions">
          <button onClick={() => navigate('/dashboard/schedule')}>
            View Schedule
          </button>
          <button onClick={() => navigate('/dashboard/reports')}>
            Reports
          </button>
          <button onClick={() => navigate('/dashboard/categories')}>
            Categories
          </button>
        </div>

        {fetchError && (
          <div style={{ color: '#dc3545', marginTop: '15px', fontSize: '0.9rem' }}>
            ⚠️ {fetchError} (Showing cached or empty data)
          </div>
        )}
      </div>

      {/* 2. Stats & Events (Below Welcome Card) */}
      <div className="home-stats-events">
        
        {/* Left: Statistics */}
        <div className="home-stats">
          <div className="stat-card">
            <div style={{ color: '#007bff', marginBottom: 5 }}><IconCalendar /></div>
            <div className="stat-value">{data.events.length}</div>
            <div className="stat-label">Total Events</div>
          </div>
          
          <div className="stat-card">
            <div style={{ color: '#28a745', marginBottom: 5 }}><IconUsers /></div>
            <div className="stat-value">{data.users.length}</div>
            <div className="stat-label">System Users</div>
          </div>
          
          <div className="stat-card">
            <div style={{ color: '#6f42c1', marginBottom: 5 }}><IconBuilding /></div>
            <div className="stat-value">{data.departments.length}</div>
            <div className="stat-label">Departments</div>
          </div>
        </div>

        {/* Right: Upcoming Events Slider */}
        <div className="home-upcoming">
          <h3>Upcoming Events</h3>
          
          {upcomingEvents.length === 0 ? (
            <div className="no-events">No upcoming events scheduled.</div>
          ) : (
            <ul className="upcoming-list">
              <li className={`upcoming-item upcoming-slide-horizontal ${fadeIn ? 'show' : ''}`}>
                <div className="upcoming-title">
                  {activeEvent?.program || 'Untitled Event'}
                </div>
                
                <div className="upcoming-date">
                  {formatDate(activeEvent?.start_date)}
                  <span style={{ margin: '0 5px', color: '#ccc' }}>|</span>
                  {formatTime(activeEvent?.start_time)} - {formatTime(activeEvent?.end_time)}
                </div>
                
                <div className="upcoming-dept">
                  Department: {' '}
                  {Array.isArray(activeEvent?.department) 
                    ? activeEvent.department.join(', ') 
                    : activeEvent?.department || 'N/A'}
                </div>
              </li>
            </ul>
          )}

          {/* Pagination Dots (Visual Indicator only) */}
          {upcomingEvents.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '15px' }}>
              {upcomingEvents.map((_, idx) => (
                <div 
                  key={idx}
                  onClick={() => { setFadeIn(false); setTimeout(() => { setCurrentEventIdx(idx); setFadeIn(true); }, 200); }}
                  style={{
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: idx === currentEventIdx ? '#007bff' : '#e0e0e0',
                    cursor: 'pointer',
                    transition: 'background 0.3s'
                  }}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Home;