import React, { useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './users.css';

function Users() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    employee_number: '',
    email: '',
    password: '',
    type: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ Use backend URL from environment variable or fallback to localhost
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081';

  // ✅ Define fetchUsers properly
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.users || []);
      } else {
        setUsers(data);
      }
    } catch (err) {
      console.error('Fetch failed:', err);
      toast.error('Failed to load users.');
    }
  };

  // ✅ Call fetchUsers once when component mounts
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ Prevent ESLint warning but keep correct behavior

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'employee_number') {
      if (/^\d{0,7}$/.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const openNewUserForm = () => {
    setEditingUserId(null);
    setFormData({ employee_number: '', email: '', password: '', type: '' });
    setShowForm(true);
  };

  const openEditForm = (user) => {
    setEditingUserId(user.id);
    setFormData({
      employee_number: user.employee_number,
      email: user.email,
      password: '',
      type: user.type
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    toast.dismiss();

    try {
      const method = editingUserId ? 'PUT' : 'POST';
      const url = editingUserId
        ? `${API_BASE_URL}/api/users/${editingUserId}`
        : `${API_BASE_URL}/api/users`;

      const payload = editingUserId
        ? formData
        : {
            employee_number: formData.employee_number,
            email: formData.email,
            password: formData.password,
            type: formData.type,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingUserId ? 'User updated successfully!' : 'User created successfully!');
        setShowForm(false);
        setEditingUserId(null);
        setFormData({ employee_number: '', email: '', password: '', type: '' });
        fetchUsers(); // ✅ refresh list
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    toast.dismiss();

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('User deleted successfully!');
        fetchUsers(); // ✅ refresh list
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('An error occurred while deleting');
    }
  };

  return (
    <div className="users-container">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="users-header">
        <h2>Users</h2>
        <button className="new-user-btn" onClick={openNewUserForm}>
          {showForm ? 'Cancel' : '+ New user'}
        </button>
      </div>

      {showForm && (
        <>
          <div className="popup-overlay" onClick={() => setShowForm(false)} />
          <form onSubmit={handleSubmit} className="user-form-popup">
            <button
              type="button"
              className="close-modal-btn"
              onClick={() => setShowForm(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                background: 'transparent',
                border: 'none',
                fontSize: 28,
                fontWeight: 'bold',
                color: '#333',
                cursor: 'pointer',
                zIndex: 2
              }}
            >
              &times;
            </button>
            <h3>{editingUserId ? 'Edit User' : 'Create New User'}</h3>

            {!editingUserId && (
              <input
                name="employee_number"
                placeholder="7-digit Employee Number"
                value={formData.employee_number}
                onChange={handleChange}
                required
              />
            )}

            {editingUserId && (
              <input
                name="employee_number"
                placeholder="7-digit Employee Number"
                value={formData.employee_number}
                disabled
                readOnly
              />
            )}

            <input
              name="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <input
              name="password"
              type="password"
              placeholder={editingUserId ? 'New Password (leave blank to keep current)' : 'Password'}
              value={formData.password}
              onChange={handleChange}
              {...(!editingUserId && { required: true })}
            />

            <select name="type" value={formData.type} onChange={handleChange} required>
              <option value="">Select Type</option>
              <option value="Administrator">Administrator</option>
              <option value="OSDS">OSDS</option>
              <option value="SGOD">SGOD</option>
              <option value="CID">CID</option>
            </select>

            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : editingUserId ? 'Update User' : 'Save User'}
            </button>
          </form>
        </>
      )}

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Employee Number</th>
            <th>Email</th>
            <th>Type</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan="5">No users found.</td>
            </tr>
          ) : (
            users.map((user, index) => (
              <tr key={user.id}>
                <td>{index + 1}</td>
                <td>{user.employee_number}</td>
                <td>{user.email}</td>
                <td>{user.type}</td>
                <td>
                  <button className="action-btn" onClick={() => openEditForm(user)} disabled={loading}>
                    Edit
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(user.id)} disabled={loading}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Users;
