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

  // State to toggle between Teaching and Non-Teaching lists
  const [personnelType, setPersonnelType] = useState('Teaching');

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

  // --- POSITION LISTS ---
  const teachingPositions = [
    'Teacher I', 'Teacher II', 'Teacher III',
    'Master Teacher I', 'Master Teacher II', 'Master Teacher III',
    'Head Teacher I', 'Head Teacher II', 'Head Teacher III',
    'Principal I', 'Principal II', 'Principal III', 'Principal IV',
    'ALS Teacher', 'SpEd Teacher'
  ];

  const nonTeachingPositions = [
    'Administrative Officer I', 'Administrative Officer II', 
    'Administrative Officer IV', 'Administrative Officer V',
    'Administrative Assistant I', 'Administrative Assistant II', 'Administrative Assistant III',
    'Accountant I', 'Accountant II', 'Accountant III',
    'Budget Officer', 'Cashier', 'Registrar', 'Librarian', 
    'Nurse', 'Guidance Counselor', 'EPS', 'PSDS', 
    'Utility Worker', 'Security Guard'
  ];

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}?userType=${user.type}`, {
        withCredentials: true,
      });
      setCategoryList(res.data);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch categories');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, user]);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);
  }, []);

  useEffect(() => {
    if (user) fetchCategories();
  }, [user, fetchCategories]);

  useEffect(() => {
    if (viewedCategory) document.body.classList.add('no-scroll');
    else document.body.classList.remove('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [viewedCategory]);

  // --- AUTO-UPDATE OFFICE WHEN SWITCHING TYPES ---
  useEffect(() => {
    if (showForm && !editMode) {
      const firstOption = personnelType === 'Teaching' ? teachingPositions[0] : nonTeachingPositions[0];
      setFormData(prev => ({ ...prev, office: firstOption }));
    }
  }, [personnelType, showForm, editMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- HANDLE NEW / RESET FORM ---
  const handleNewCategory = () => {
    setShowForm(!showForm);
    setEditMode(false);
    setPersonnelType('Teaching');
    
    // CRITICAL: Set department based on User Role
    // If Admin: Default to first option (OSDS) but allow change
    // If SGOD/CID/OSDS: Force their own type
    const defaultDept = user?.type === 'Administrator' ? 'OSDS' : user?.type;

    setFormData({ 
      idnumber: '', 
      office: teachingPositions[0], 
      email: '', 
      department: defaultDept
    });
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
      
      // Safety: Ensure department is correct before sending
      const payload = { ...formData };
      if (user?.type !== 'Administrator') {
        payload.department = user.type; // Force overwrite to ensure security
      }

      const res = await method(url, payload);

      if (res.status >= 200 && res.status < 300) {
        toast.success(editMode ? 'Category updated!' : 'Category added!');
        
        // Reset form
        handleNewCategory(); // Toggle off
        fetchCategories();
      } else {
        toast.error(res.data?.message || 'Operation failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || '';
      if (msg.toLowerCase().includes('duplicate')) {
        toast.error('Error: Duplicate ID Number.');
      } else {
        toast.error(msg || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cat) => {
    const isTeaching = teachingPositions.includes(cat.office);
    if (isTeaching) setPersonnelType('Teaching');
    else setPersonnelType('Non-Teaching');

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
    if(!window.confirm("Are you sure you want to delete this category?")) return;
    setIsLoading(true);
    try {
      const res = await axios.delete(`${API_URL}/${id}?userType=${user?.type}`);
      if (res.status >= 200 && res.status < 300) {
        toast.success('Deleted successfully.');
        fetchCategories();
      } else {
        toast.error('Delete failed.');
      }
    } catch (err) {
      toast.error('Error while deleting.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (cat) => setViewedCategory(cat);
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
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar closeOnClick />

      <div className="header-actions">
        <h2>Categories</h2>
        <button
          className="toggle-form-btn"
          onClick={handleNewCategory}
          disabled={isLoading}
        >
          {showForm ? 'Hide Form' : 'New Category'}
        </button>
      </div>

      <div className="form-and-table">
        {/* --- FORM SECTION --- */}
        {showForm && (
          <div className="category-modal-overlay" onClick={() => setShowForm(false)}>
            <div className="category-modal" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="close-view-btn"
                style={{ position: 'absolute', top: 10, right: 10 }}
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
              
              <form onSubmit={handleSubmit} className="category-form">
                <h3>{editMode ? 'Edit Category' : 'Add New Category'}</h3>
                
                {/* ID Number */}
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

                {/* Personnel Type Selector */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display:'block', marginBottom:'5px', fontWeight:'bold', color:'#555' }}>Personnel Type:</label>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <label style={{ cursor: 'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                            <input 
                                type="radio" 
                                name="pType" 
                                value="Teaching" 
                                checked={personnelType === 'Teaching'} 
                                onChange={() => setPersonnelType('Teaching')}
                            /> Teaching
                        </label>
                        <label style={{ cursor: 'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                            <input 
                                type="radio" 
                                name="pType" 
                                value="Non-Teaching" 
                                checked={personnelType === 'Non-Teaching'} 
                                onChange={() => setPersonnelType('Non-Teaching')}
                            /> Non-Teaching
                        </label>
                    </div>
                </div>

                {/* Office / Position Dropdown */}
                <div>
                  <label>Position / Designation:</label>
                  <select 
                    name="office" 
                    value={formData.office} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                  >
                    {personnelType === 'Teaching' ? (
                        teachingPositions.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                        ))
                    ) : (
                        nonTeachingPositions.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                        ))
                    )}
                  </select>
                </div>

                {/* Email */}
                <div>
                  <label>Email:</label>
                  <input 
                    name="email" 
                    type="email"
                    value={formData.email} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading}
                  />
                </div>

                {/* DEPARTMENT SECTION - MODIFIED LOGIC */}
                <div>
                  <label>Department:</label>
                  {user?.type === 'Administrator' ? (
                    // 1. Administrators see a DROPDOWN to choose any department
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      disabled={isLoading}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                    >
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  ) : (
                    // 2. SGOD/OSDS/CID see a LOCKED INPUT with their own department name
                    <input
                      name="department"
                      value={user?.type || formData.department}
                      readOnly
                      disabled
                      style={{ backgroundColor: '#e9ecef', color: '#495057', cursor: 'not-allowed', border: '1px solid #ced4da' }}
                    />
                  )}
                </div>

                <button type="submit" disabled={isLoading} className="submit-btn" style={{ marginTop: '15px' }}>
                  {isLoading ? 'Processing...' : editMode ? 'Update' : 'Add'} Category
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- TABLE SECTION --- */}
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
                    <th style={{ width: '22%' }}>Position</th>
                    <th style={{ width: '26%' }}>Email</th>
                    <th style={{ width: '12%' }}>Dept</th>
                    <th style={{ width: '16%' }}>Actions</th>
                  </tr>
                </thead>
              </table>
              <div className="table-scroll-wrapper">
                <table className="category-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <tbody>
                    {filteredList.length === 0 ? (
                        <tr><td colSpan="6" style={{textAlign:'center', padding:'20px'}}>No categories found.</td></tr>
                    ) : (
                        filteredList.map((cat, idx) => (
                        <tr key={cat.id}>
                            <td style={{ width: '6%' }}>{idx + 1}</td>
                            <td style={{ width: '18%' }}>{cat.idnumber}</td>
                            <td style={{ width: '22%' }}>{cat.office}</td>
                            <td style={{ width: '26%' }}>{cat.email}</td>
                            <td style={{ width: '12%' }}>{cat.department}</td>
                            <td style={{ width: '16%' }}>
                            <div className="action-buttons">
                                <button className="view-btn" onClick={() => handleView(cat)}>View</button>
                                {canEditOrDelete(cat) && (
                                <button className="edit-btn" onClick={() => handleEdit(cat)}>Edit</button>
                                )}
                                {canEditOrDelete(cat) && (
                                <button className="delete-btn" onClick={() => handleDelete(cat.id)}>Delete</button>
                                )}
                            </div>
                            </td>
                        </tr>
                        ))
                    )}
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
            <div style={{ textAlign: 'left', marginTop: '15px' }}>
                <p><strong>ID Number:</strong> {viewedCategory.idnumber}</p>
                <p><strong>Position:</strong> {viewedCategory.office}</p>
                <p><strong>Email:</strong> {viewedCategory.email}</p>
                <p><strong>Department:</strong> {viewedCategory.department}</p>
            </div>
            <button className="close-view-btn" onClick={closeViewModal} style={{ marginTop: '20px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categories;