import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './style.css';
import logodashhome from '../assets/logodashhome.png';



function DashboardLayout({ onLogout }) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const navigate = useNavigate();
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setTimeout(() => {
      setUserState(storedUser);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 600) {
      if (sidebarVisible) {
        document.body.classList.add('no-scroll');
      } else {
        document.body.classList.remove('no-scroll');
      }
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [sidebarVisible]);

  const allowedRoles = ['Administrator', 'SGOD', 'OSDS', 'CID'];
  const isAllowed = user ? allowedRoles.includes(user.type) : false;
  const isAdmin = user?.type === 'Administrator';
  const isOfficeUser = user?.type === 'OfficeUser';

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (onLogout) onLogout();
    navigate(isOfficeUser ? '/login1' : '/login');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`app-container ${!sidebarVisible ? 'sidebar-hidden' : ''}`}>
      {/* Sidebar overlay backdrop for mobile */}
      <div
        className="sidebar-backdrop"
        aria-hidden={!sidebarVisible}
        style={{ display: sidebarVisible ? 'block' : 'none' }}
        onClick={() => setSidebarVisible(false)}
      />
      {/* Always show sidebar toggle in top left, with accessibility improvements */}
      <button
        className="sidebar-toggle-show"
        aria-label={sidebarVisible ? 'Close sidebar' : 'Open sidebar'}
        aria-pressed={sidebarVisible}
        tabIndex={0}
        onClick={() => setSidebarVisible(!sidebarVisible)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSidebarVisible(!sidebarVisible);
          }
        }}
        style={{ outline: 'none' }}
      >
        <span></span><span></span><span></span>
      </button>
      <aside className={sidebarVisible ? '' : 'sidebar-hidden'} aria-hidden={!sidebarVisible}>
        <div className="sidebar-header">
        <img
  src={logodashhome}
  alt="Dashboard Logo"
  style={{
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#fff',
    display: 'block',
    margin: '0 auto 8px auto',
    objectFit: 'cover'
  }}
/>

          <h2 className="sidebar-title">Dashboard</h2>
          <div className="sidebar-welcome">
            <p className="welcome-title">Welcome</p>
            <p className="welcome-role">{user?.type}</p>
          </div>
        </div>

        <nav aria-label="Main navigation">
          <ul>
            {isAllowed && (
              <>
                <li><Link to="/dashboard/home"><i className="fas fa-home"></i> Home</Link></li>
                <li><Link to="/dashboard/categories"><i className="fas fa-chalkboard-teacher"></i> Categories</Link></li>
                <li><Link to="/dashboard/schedule"><i className="fas fa-calendar-alt"></i> Schedule</Link></li>
                <li><Link to="/dashboard/reports"><i className="fas fa-file-alt"></i> Reports</Link></li>
              </>
            )}
            {isAdmin && (
              <>
                <li><Link to="/dashboard/users"><i className="fas fa-users"></i> Users</Link></li>
              </>
            )}
            {isOfficeUser && (
              <li><Link to="/dashboard/schedule"><i className="fas fa-calendar-alt"></i> Schedule</Link></li>
            )}
            {/* Move Logout here for better mobile visibility */}
            <li className="logout">
              <button onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Logout</button>
            </li>
          </ul>
        </nav>
      </aside>

      <main>
        <Outlet context={{ sidebarVisible }} />
      </main>
    </div>
  );
}

export default DashboardLayout;
