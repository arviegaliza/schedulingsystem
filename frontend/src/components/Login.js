import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Login.css';
import backgroundLogin from '../assets/backgroundlogin.png';

function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [step, setStep] = useState(1);

  const [employee_number, setEmployeeNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [type, setType] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
  const res = await axios.post('https://schedulingsystem.onrender.com/login', {
        employee_number,
        password
      });
      

      const user = res.data.user || res.data;
      if (!user || !user.type) {
        setError('Invalid login response. Contact admin.');
        return;
      }

      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard/home');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid employee number or password.');
      } else {
        setError('Login failed. Server error.');
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!/^\d{7}$/.test(employee_number)) {
      setError('Employee number must be 7 digits');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }

    try {
  const res = await axios.post('https://schedulingsystem.onrender.com/api/users', {
        employee_number,
        email,
        password,
        type
      });

      if (res.data.success) {
        setSuccess('Registration successful! You can now login.');
        setIsRegistering(false);
        setEmployeeNumber('');
        setEmail('');
        setPassword('');
        setType('');
      } else {
        setError(res.data.error || 'Registration failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Server error during registration.');
    }
  };

  const handleForgotStep1 = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      const res = await axios.post('https://schedulingsystem.onrender.com/api/forgot-password', { email });
      if (res.data.success) {
        setSuccess('OTP sent to your email.');
        setStep(2);
      } else {
        setError(res.data.message || 'Failed to send OTP.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error.');
    }
  };

  const handleForgotStep2 = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
  const res = await axios.post('https://schedulingsystem.onrender.com/api/verify-otp', { email, otp_code: otp });
      if (res.data.success) {
        setSuccess('OTP verified. Set your new password.');
        setStep(3);
      } else {
        setError(res.data.message || 'OTP verification failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error.');
    }
  };

  const handleForgotStep3 = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
  const res = await axios.post('https://schedulingsystem.onrender.com/api/reset-password', {
        email,
        otp_code: otp,
        new_password: password
      });

      if (res.data.success) {
        setSuccess('Password reset successful. Please login.');
        setStep(1);
        setIsForgotPassword(false);
        setEmail('');
        setPassword('');
        setOtp('');
      } else {
        setError(res.data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error.');
    }
  };

  return (
    <div className="login-container">
      <form
        className="login-form"
        onSubmit={
          isRegistering
            ? handleRegister
            : isForgotPassword
              ? step === 1
                ? handleForgotStep1
                : step === 2
                  ? handleForgotStep2
                  : handleForgotStep3
              : handleLogin
        }
      >
        {/* Title left, logo centered below, professional spacing, no overlap */}
        <div style={{ width: '100%' }}>
          <h2 style={{ textAlign: 'left', margin: 0, fontWeight: 700 }}>
            {isRegistering
              ? 'Register'
              : isForgotPassword
                ? step === 1
                  ? 'Forgot Password'
                  : step === 2
                    ? 'Verify OTP'
                    : 'Reset Password'
                : 'Login'}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img
  src={backgroundLogin}
  alt="Login Background"
  className="login-bg-image"
  style={{ 
    width: '100px',
    height: 'auto', // Maintain aspect ratio
    aspectRatio: '1', // Optional: Force square if needed
    borderRadius: '4px',
    display: 'block',
    marginTop: '12px',
    objectFit: 'cover' // Ensures image fills space while maintaining ratio
  }}
  loading="eager" // Force immediate load
  decoding="sync" // Force synchronous decoding
  onError={(e) => {
    e.target.style.display = 'none'; // Hide if fails to load
    console.error('Failed to load login background image');
  }}
/>
          </div>
        </div>
        {/* Inputs start here */}

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {!isForgotPassword && (
          <input
            type="text"
            placeholder="Employee Number"
            value={employee_number}
            onChange={(e) => setEmployeeNumber(e.target.value)}
            required
          />
        )}

        {(isRegistering || (isForgotPassword && step === 1)) && (
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}

        {isForgotPassword && step === 2 && (
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
        )}

        {(!isForgotPassword || step === 3) && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        {isForgotPassword && step === 3 && (
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        )}

        {isRegistering && (
          <select value={type} onChange={(e) => setType(e.target.value)} required>
            <option value="">Select Type</option>
            <option value="Administrator">Administrator</option>
            <option value="OSDS">OSDS</option>
            <option value="SGOD">SGOD</option>
            <option value="CID">CID</option>
          </select>
        )}

        <button type="submit">
          {isRegistering
            ? 'Register'
            : isForgotPassword
              ? step === 1
                ? 'Send OTP'
                : step === 2
                  ? 'Verify OTP'
                  : 'Reset Password'
              : 'Login'}
        </button>

        <div className="form-footer">
          {isRegistering ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setError('');
                  setSuccess('');
                }}
                className="link-button"
              >
                Login
              </button>
            </>
          ) : isForgotPassword ? (
            <>
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setStep(1);
                  setError('');
                  setSuccess('');
                }}
                className="link-button"
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(true);
                  setError('');
                  setSuccess('');
                }}
                className="link-button"
              >
                Register
              </button>
            </>
          )}
        </div>

        {!isRegistering && !isForgotPassword && (
          <>
            <p className="forgot-password">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setStep(1);
                  setError('');
                  setSuccess('');
                }}
                className="link-button"
              >
                Forgot Password?
              </button>
            </p>

            <p className="officer-login">
              Are you an Officer?{' '}
              <Link to="/login1" className="officer-link">Login here</Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}

export default Login;
