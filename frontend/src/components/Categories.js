import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Categories.css';

function Categories() {
  const [formData, setFormData] = useState({
    idnumber: '',
    office: '',
    email: '',
    department: '',
  });
  const [categoryList, setCategoryList] = useState([]);
  const [filterDept, setFilterDept] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [viewedCategory, setViewedCategory] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);

  const departments = ['OSDS', 'SGOD', 'CID'];
  const API_URL = `${process.env.REACT_APP_API_URL}/api/categories`;

const fetchCategories = useCallback(async () => {
  if (!user) return; // Wait until user is loaded
  try {
    setIsLoading(true);
    const res = await axios.get(`${API_URL}?userType=${user.type}`, {
      withCredentials: true, // include cookies/session if needed
    });
    setCategoryList(res.data);
  } catch (err) {
    console.error('Fetch error:', err);
    toast.error(err.response?.data?.message || 'Failed to fetch categories');
  } finally {
    setIsLoading(false);
  }
}, [API_URL, user]);


  // Load user from localStorage
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);
  }, []);

  // Fetch categories once user is loaded
  useEffect(() => {
    if (user) fetchCategories();
  }, [user, fetchCategories]);

  // Lock scroll when viewing category
  useEffect(() => {
    if (viewedCategory) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [viewedCategory]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    toast.dismiss();
    try {
      const url = editMode
        ? `${API_URL}/${editId}?userType=${user?.type}`
        : `${API_URL}?userType=${user?.type}`;
      const method = editMode ? axios.put : axios.post;
      const res = await method(url, formData);

      if (res.status >= 200 && res.status < 300) {
        toast.success(editMode ? 'Category updated!' : 'Category added!');
        setFormData({ 
          idnumber: '', 
          office: '', 
          email: '', 
          department: user?.type === 'Administrator' ? 'OSDS' : user?.type || '' 
        });
        setShowForm(false);
        setEditMode(false);
        setEditId(null);
        fetchCategories();
      } else {
        toast.error(res.data?.message || 'Operation failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || '';
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists')) {
        toast.error('There is a duplicate ID number.');
      } else {
        toast.error(msg || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (cat) => setViewedCategory(cat);

  const handleEdit = (cat) => {
    setFormData({
      idnumber: cat.idnumber,
      office: cat.office,
      email: cat.email,
      department: cat.department,
    });
    setEditId(cat.id);
    setEditMode(true);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    setIsLoading(true);
    toast.dismiss();
    try {
      const res = await axios.delete(`${API_URL}/${id}?userType=${user?.type}`);
      if (res.status >= 200 && res.status < 300) {
        toast.success('Category deleted!');
        fetchCategories();
      } else {
        toast.error(res.data?.message || 'Delete failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || '';
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists')) {
        toast.error('There is a duplicate ID number.');
      } else {
        toast.error(msg || 'Error while deleting');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const closeViewModal = () => setViewedCategory(null);

  const filteredList = filterDept === 'All'
    ? categoryList
    : categoryList.filter(cat => cat.department === filterDept);

  const canEditOrDelete = (cat) => {
    if (user?.type === 'Administrator') return true;
    return user?.type === cat.department;
  };

  return (
    <div className="category-container">
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar closeOnClick pauseOnHover draggable />

      <div className="header-actions">
        <h2>Categories</h2>
        <button
          className="toggle-form-btn"
          onClick={() => {
            setShowForm(!showForm);
            setEditMode(false);
            setFormData({ 
              idnumber: '', 
              office: '', 
              email: '', 
              department: user?.type === 'Administrator' ? 'OSDS' : user?.type || '' 
            });
          }}
          disabled={isLoading}
        >
          {showForm ? 'Hide Form' : 'New Category'}
        </button>
      </div>

      <div className="form-and-table">
        {showForm && (
          <div className="category-modal-overlay" onClick={() => setShowForm(false)}>
            <div className="category-modal" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="close-view-btn"
                style={{ position: 'absolute', top: 10, right: 10 }}
                onClick={() => setShowForm(false)}
                disabled={isLoading}
              >
                ×
              </button>
              <form onSubmit={handleSubmit} className="category-form">
                <div>
                  <label>ID Number:</label>
                  <input 
                    name="idnumber" 
                    value={formData.idnumber} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label>Office:</label>
                  <input 
                    name="office" 
                    value={formData.office} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label>Email:</label>
                  <input 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label>Department:</label>
                  {user?.type === 'Administrator' ? (
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      disabled={isLoading}
                    >
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="department"
                      value={user?.type || formData.department}
                      readOnly
                      disabled
                    />
                  )}
                </div>
                <button type="submit" disabled={isLoading}>
                  {isLoading ? 'Processing...' : editMode ? 'Update' : 'Add'} Category
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="table-panel">
          <div className="filter-group">
            <label>Filter by Department:</label>
            <select 
              value={filterDept} 
              onChange={(e) => setFilterDept(e.target.value)}
              disabled={isLoading}
            >
              <option value="All">All</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <hr className="filter-hr" />

          {isLoading ? (
            <div className="loading-indicator">Loading categories...</div>
          ) : (
            <>
              <table className="category-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '6%' }}>#</th>
                    <th style={{ width: '18%' }}>ID Number</th>
                    <th style={{ width: '16%' }}>Office</th>
                    <th style={{ width: '28%' }}>Email</th>
                    <th style={{ width: '16%' }}>Department</th>
                    <th style={{ width: '16%' }}>Actions</th>
                  </tr>
                </thead>
              </table>
              <div className="table-scroll-wrapper">
                <table className="category-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <tbody>
                    {filteredList.map((cat, idx) => (
                      <tr key={cat.id}>
                        <td style={{ width: '6%' }}>{idx + 1}</td>
                        <td style={{ width: '18%' }}>{cat.idnumber}</td>
                        <td style={{ width: '16%' }}>{cat.office}</td>
                        <td style={{ width: '28%' }}>{cat.email}</td>
                        <td style={{ width: '16%' }}>{cat.department}</td>
                        <td style={{ width: '16%' }}>
                          <div className="action-buttons">
                            <button 
                              className="view-btn" 
                              onClick={() => handleView(cat)}
                              disabled={isLoading}
                            >
                              View
                            </button>
                            {canEditOrDelete(cat) && (
                              <button 
                                className="edit-btn" 
                                onClick={() => handleEdit(cat)}
                                disabled={isLoading}
                              >
                                Edit
                              </button>
                            )}
                            {canEditOrDelete(cat) && (
                              <button 
                                className="delete-btn" 
                                onClick={() => handleDelete(cat.id)}
                                disabled={isLoading}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {viewedCategory && (
        <div className="view-modal">
          <div className="view-content">
            <h3>Category Details</h3>
            <p><strong>ID Number:</strong> {viewedCategory.idnumber}</p>
            <p><strong>Office:</strong> {viewedCategory.office}</p>
            <p><strong>Email:</strong> {viewedCategory.email}</p>
            <p><strong>Department:</strong> {viewedCategory.department}</p>
            <button 
              className="close-view-btn" 
              onClick={closeViewModal}
              disabled={isLoading}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categories;
