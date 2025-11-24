import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Reports.css';

const Reports = () => {
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('All');
  const [type, setType] = useState('weekly');
  const [format, setFormat] = useState('xlsx');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
const BASE_URL = process.env.REACT_APP_API_URL;


useEffect(() => {
  const storedUser = JSON.parse(localStorage.getItem('user'));
  setUser(storedUser);

  axios.get(`${BASE_URL}/api/department`)
    .then(res => setDepartments(res.data.map(d => d.department)))
    .catch(() => setDepartments([]));
}, [BASE_URL]);

  const handleDownload = async () => {
    if (type === 'monthly' && (!start || !end)) {
      alert('Please select both month and year for monthly reports.');
      return;
    }
    if (type === 'weekly' && (!start || !end)) {
      alert('Please select both start and end dates for weekly reports.');
      return;
    }
    setLoading(true);
    try {
      const params = {
        department,
        start,
        end,
        format,
        userType: user?.type || 'Administrator',
      };
const BASE_URL = process.env.REACT_APP_API_URL;

const response = await axios.get(`${BASE_URL}/api/reports/${type}`, {
  params,
  responseType: 'blob',
});

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${type}_${department}_${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to download report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-container">
      <h2>Generate Reports</h2>
      <div className="report-form-row">
        <div className="report-form-col">
          <label className="report-label">Department</label>
          <select className="report-select" value={department} onChange={e => setDepartment(e.target.value)}>
            {user?.type === 'Administrator' && <option value="All">All</option>}
            {departments.map((dept, i) => (
              <option key={i} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div className="report-form-col">
          <label className="report-label">Report Type</label>
          <select className="report-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      {type === 'monthly' ? (
        <div className="report-form-row">
          <div className="report-form-col">
            <label className="report-label">Month</label>
            <select
              className="report-select"
              value={start}
              onChange={e => setStart(e.target.value)}
            >
              <option value="">Select Month</option>
              {[
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
              ].map((month, idx) => (
                <option key={month} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>
          <div className="report-form-col">
            <label className="report-label">Year</label>
            <input
              className="report-input"
              type="number"
              min="2000"
              max="2100"
              value={end}
              onChange={e => setEnd(e.target.value)}
              placeholder="Year"
            />
          </div>
          <div className="report-form-col">
            <label className="report-label">Format</label>
            <select className="report-select" value={format} onChange={e => setFormat(e.target.value)}>
              <option value="xlsx">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="report-form-row">
          <div className="report-form-col">
            <label className="report-label">Start Date</label>
            <input className="report-input" type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div className="report-form-col">
            <label className="report-label">End Date</label>
            <input className="report-input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div className="report-form-col">
            <label className="report-label">Format</label>
            <select className="report-select" value={format} onChange={e => setFormat(e.target.value)}>
              <option value="xlsx">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>
      )}
      <button onClick={handleDownload} disabled={loading} className="report-download-btn">
        {loading ? 'Generating...' : 'Download Report'}
      </button>
    </div>
  );
};

export default Reports; 