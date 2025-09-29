import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DashboardLayout from './components/DashboardLayout';
import Categories from './components/Categories';
import Schedule from './components/Schedule';
import Users from './components/Users';
import Home from './components/Home';
import Login from './components/Login';
import Login1 from './components/Login1';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Reports from './components/Reports';

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));

  const isOfficeUser = user?.type === 'OfficeUser';
  const allowedDashboardRoles = ['Administrator', 'SGOD', 'CID', 'OSDS'];

  useEffect(() => {
    const syncUser = () => setUser(JSON.parse(localStorage.getItem('user')));
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, []);

  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>

        <Route
          path="/"
          element={
            user ? (
              isOfficeUser ? <Navigate to="/office/schedule" replace /> : <Navigate to="/dashboard/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/login"
          element={
            user ? (
              allowedDashboardRoles.includes(user.type)
                ? <Navigate to="/dashboard/home" replace />
                : <Navigate to="/office/schedule" replace />
            ) : (
              <Login />
            )
          }
        />

        <Route
          path="/login1"
          element={
            user ? (
              isOfficeUser
                ? <Navigate to="/office/schedule" replace />
                : <Navigate to="/dashboard/home" replace />
            ) : (
              <Login1 />
            )
          }
        />

        <Route
          path="/dashboard"
          element={<DashboardLayout onLogout={() => setUser(null)} />}
        >
          <Route path="home" element={<Home />} />
          <Route path="categories" element={<Categories />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="users" element={<Users />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route
          path="/office/schedule"
          element={<Schedule />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
