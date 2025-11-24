import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Login1.css'; // ✅ Import the CSS

function Login1() {
  const [idnumber, setIdnumber] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post(
  `${process.env.REACT_APP_API_URL}/api/login1`,
  { idnumber }
);


      if (!res.data.success) {
        setError('Login failed: ' + res.data.message);
        return;
      }

      const user = { ...res.data.user, type: 'OfficeUser' };
      localStorage.setItem('user', JSON.stringify(user));
      toast.success('Login successful');
      // Redirect based on user type
      if (user.type === 'OfficeUser') {
        navigate('/office/schedule');
      } else {
        navigate('/dashboard/home');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="login1-container">
      <form className="login1-form" onSubmit={handleSubmit}>
        <h2>Office Login</h2>
        <input
          type="text"
          placeholder="Enter ID Number"
          value={idnumber}
          onChange={(e) => setIdnumber(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        {error && <p className="error">{error}</p>}
        <p>
          Are you an Admin? <Link to="/login">Login here</Link>
        </p>
      </form>
    </div>
  );
}

export default Login1;
