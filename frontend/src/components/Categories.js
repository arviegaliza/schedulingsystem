import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Categories.css';

// --- DEFAULT DATA (Loaded if nothing is in LocalStorage) ---
const DEFAULT_TYPES = ['Teaching', 'Non-Teaching'];
const DEFAULT_POSITIONS = {
  'Teaching': [
    'Teacher I', 'Teacher II', 'Teacher III',
    'Master Teacher I', 'Master Teacher II', 'Master Teacher III',
    'Head Teacher I', 'Head Teacher II', 'Head Teacher III',
    'Principal I', 'Principal II', 'Principal III', 'Principal IV',
    'ALS Teacher', 'SpEd Teacher'
  ],
  'Non-Teaching': [
    'Administrative Officer I', 'Administrative Officer II', 
    'Administrative Officer IV', 'Administrative Officer V',
    'Administrative Assistant I', 'Administrative Assistant II', 'Administrative Assistant III',
    'Accountant I', 'Accountant II', 'Accountant III',
    'Budget Officer', 'Cashier', 'Registrar', 'Librarian', 
    'Nurse', 'Guidance Counselor', 'EPS', 'PSDS', 
    'Utility Worker', 'Security Guard'
  ]
};

function Categories() {
  const [formData, setFormData] = useState({
    idnumber: '',
    office: '',
    email: '',
    department: '',
  });

  // --- DYNAMIC STATE FOR LISTS ---
  const [personnelTypes, setPersonnelTypes] = useState(DEFAULT_TYPES);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);

  // --- SETTINGS MODAL STATE ---
  const [showSettings, setShowSettings] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState('');
  const [newPosInput, setNewPosInput] = useState('');
  const [selectedTypeForSettings, setSelectedTypeForSettings] = useState('Teaching');

  // --- MAIN APP STATE ---
  const [personnelType, setPersonnelType] = useState('Teaching'); // Controls the dropdowns
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

  // --- 1. LOAD/SAVE SETTINGS (LocalStorage) ---
  useEffect(() => {
    const savedTypes = localStorage.getItem('cat_personnelTypes');
    const savedPositions = localStorage.getItem('cat_positions');

    if (savedTypes) {
        const parsedTypes = JSON.parse(savedTypes);
        setPersonnelTypes(parsedTypes);
        // Ensure selectedTypeForSettings is valid
        if (parsedTypes.length > 0) setSelectedTypeForSettings(parsedTypes[0]);
    }
    if (savedPositions) setPositions(JSON.parse(savedPositions));
  }, []);

  useEffect(() => {
    localStorage.setItem('cat_personnelTypes', JSON.stringify(personnelTypes));
    localStorage.setItem('cat_positions', JSON.stringify(positions));
  }, [personnelTypes, positions]);

  // --- 2. FETCH DATA ---
  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}?userType=${user.type}`, { withCredentials: true });
      setCategoryList(res.data);
    } catch (err) {
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

  // Lock scroll
  useEffect(() => {
    if (viewedCategory || showSettings) document.body.classList.add('no-scroll');
    else document.body.classList.remove('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [viewedCategory, showSettings]);

  // --- 3. AUTO-UPDATE POSITION WHEN TYPE CHANGES ---
  useEffect(() => {
    if (showForm && !editMode) {
      const availablePositions = positions[personnelType] || [];
      const firstOption = availablePositions.length > 0 ? availablePositions[0] : '';
      setFormData(prev => ({ ...prev, office: firstOption }));
    }
  }, [personnelType, showForm, editMode, positions]);

  // --- 4. SETTINGS HANDLERS (ADD/DELETE) ---
  const handleAddType = () => {
    if (!newTypeInput.trim()) return toast.warning("Enter a type name");
    if (personnelTypes.includes(newTypeInput)) return toast.error("Type already exists");
    
    const newTypes = [...personnelTypes, newTypeInput];
    setPersonnelTypes(newTypes);
    setPositions({ ...positions, [newTypeInput]: [] });
    setNewTypeInput('');
    toast.success("Personnel Type Added");
  };

  const handleDeleteType = (type) => {
    if (!window.confirm(`Delete "${type}"? This removes all its positions.`)) return;
    const updatedTypes = personnelTypes.filter(t => t !== type);
    const updatedPositions = { ...positions };
    delete updatedPositions[type];
    
    setPersonnelTypes(updatedTypes);
    setPositions(updatedPositions);
    
    if (personnelType === type) setPersonnelType(updatedTypes[0] || '');
    if (selectedTypeForSettings === type) setSelectedTypeForSettings(updatedTypes[0] || '');
  };

  const handleAddPosition = () => {
    if (!newPosInput.trim()) return toast.warning("Enter a position name");
    const currentList = positions[selectedTypeForSettings] || [];
    if (currentList.includes(newPosInput)) return toast.error("Position already exists");

    setPositions({
      ...positions,
      [selectedTypeForSettings]: [...currentList, newPosInput].sort()
    });
    setNewPosInput('');
    toast.success("Position Added");
  };

  const handleDeletePosition = (type, posToDelete) => {
    if (!window.confirm(`Delete position "${posToDelete}"?`)) return;
    setPositions({
      ...positions,
      [type]: positions[type].filter(p => p !== posToDelete)
    });
  };

  // --- 5. FORM HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewCategory = () => {
    setShowForm(!showForm);
    setEditMode(false);
    
    const defaultType = personnelTypes[0] || '';
    setPersonnelType(defaultType);
    
    const availablePositions = positions[defaultType] || [];
    
    setFormData({ 
      idnumber: '', 
      office: availablePositions[0] || '', 
      email: '', 
      department: user?.type === 'Administrator' ? 'OSDS' : user?.type
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    toast.dismiss();
    try {
      const url = editMode ? `${API_URL}/${editId}?userType=${user?.type}` : `${API_URL}?userType=${user?.type}`;
      const method = editMode ? axios.put : axios.post;
      
      const payload = { ...formData };
      if (user?.type !== 'Administrator') payload.department = user.type; 

      const res = await method(url, payload);

      if (res.status >= 200 && res.status < 300) {
        toast.success(editMode ? 'Category updated!' : 'Category added!');
        setShowForm(false);
        setEditMode(false);
        fetchCategories();
      } else {
        toast.error(res.data?.message || 'Operation failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || '';
      if (msg.toLowerCase().includes('duplicate')) toast.error('Error: Duplicate ID Number.');
      else toast.error(msg || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cat) => {
    // Auto-detect which type this position belongs to
    let foundType = personnelTypes[0];
    for (const type of personnelTypes) {
      if (positions[type] && positions[type].includes(cat.office)) {
        foundType = type;
        break;
      }
    }
    setPersonnelType(foundType);
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
    if(!window.confirm("Delete this category?")) return;
    setIsLoading(true);
    try {
      await axios.delete(`${API_URL}/${id}?userType=${user?.type}`);
      toast.success('Deleted successfully.');
      fetchCategories();
    } catch (err) {
      toast.error('Delete failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (cat) => setViewedCategory(cat);
  const closeViewModal = () => setViewedCategory(null);
  const filteredList = filterDept === 'All' ? categoryList : categoryList.filter(cat => cat.department === filterDept);
  const canEditOrDelete = (cat) => (user?.type === 'Administrator' || user?.type === cat.department);

  return (
    <div className="category-container">
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar closeOnClick />

      <div className="header-actions">
        <h2>Categories</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="toggle-form-btn" 
            style={{ backgroundColor: '#6c757d' }} 
            onClick={() => setShowSettings(true)}
            disabled={isLoading}
          >
            Manage Options
          </button>
          <button
            className="toggle-form-btn"
            onClick={handleNewCategory}
            disabled={isLoading}
          >
            {showForm ? 'Hide Form' : 'New Category'}
          </button>
        </div>
      </div>

      <div className="form-and-table">
        {/* --- SETTINGS MODAL (Add/Edit Lists) --- */}
        {showSettings && (
          <div className="category-modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="category-modal" style={{ maxWidth:'600px' }} onClick={e => e.stopPropagation()}>
               <button className="close-view-btn" style={{position:'absolute', top:10, right:10}} onClick={() => setShowSettings(false)}>×</button>
               <h3>Manage Options</h3>
               
               {/* 1. Manage Types */}
               <div className="settings-section" style={{marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
                 <h4>1. Personnel Types</h4>
                 <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                   <input 
                     placeholder="New Type (e.g. Contractual)" 
                     value={newTypeInput} 
                     onChange={(e)=>setNewTypeInput(e.target.value)}
                   />
                   <button className="view-btn" onClick={handleAddType}>Add</button>
                 </div>
                 <div style={{display:'flex', flexWrap:'wrap', gap:'5px'}}>
                   {personnelTypes.map(type => (
                     <span key={type} style={{background:'#f0f0f0', padding:'5px 10px', borderRadius:'15px', fontSize:'14px', display:'flex', alignItems:'center', gap:'5px'}}>
                       {type}
                       <span style={{cursor:'pointer', color:'red', fontWeight:'bold'}} onClick={()=>handleDeleteType(type)}>×</span>
                     </span>
                   ))}
                 </div>
               </div>

               {/* 2. Manage Positions */}
               <div className="settings-section">
                 <h4>2. Positions</h4>
                 <label>Select Type to Edit:</label>
                 <select 
                    value={selectedTypeForSettings} 
                    onChange={(e) => setSelectedTypeForSettings(e.target.value)}
                    style={{marginBottom:'10px', width:'100%', padding:'5px'}}
                 >
                   {personnelTypes.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>

                 <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                   <input 
                     placeholder={`New Position for ${selectedTypeForSettings}`} 
                     value={newPosInput} 
                     onChange={(e)=>setNewPosInput(e.target.value)}
                   />
                   <button className="view-btn" onClick={handleAddPosition}>Add</button>
                 </div>

                 <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #eee', padding:'5px'}}>
                   {(positions[selectedTypeForSettings] || []).map(pos => (
                      <div key={pos} style={{display:'flex', justifyContent:'space-between', padding:'4px', borderBottom:'1px solid #f9f9f9'}}>
                        <span>{pos}</span>
                        <span style={{cursor:'pointer', color:'red'}} onClick={()=>handleDeletePosition(selectedTypeForSettings, pos)}>Delete</span>
                      </div>
                   ))}
                   {(positions[selectedTypeForSettings] || []).length === 0 && <span style={{color:'#999'}}>No positions added yet.</span>}
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* --- MAIN FORM --- */}
        {showForm && (
          <div className="category-modal-overlay" onClick={() => setShowForm(false)}>
            <div className="category-modal" onClick={e => e.stopPropagation()}>
              <button className="close-view-btn" style={{ position: 'absolute', top: 10, right: 10 }} onClick={() => setShowForm(false)}>×</button>
              
              <form onSubmit={handleSubmit} className="category-form">
                <h3>{editMode ? 'Edit Category' : 'Add New Category'}</h3>
                
                <div>
                  <label>ID Number:</label>
                  <input name="idnumber" value={formData.idnumber} onChange={handleChange} required disabled={isLoading} />
                </div>

                {/* UPDATED: Personnel Type Dropdown (No Dots!) */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display:'block', marginBottom:'5px', fontWeight:'bold', color:'#555' }}>Personnel Type:</label>
                    <select
                        value={personnelType}
                        onChange={(e) => setPersonnelType(e.target.value)}
                        disabled={isLoading}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                    >
                        {personnelTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* Position Dropdown (Dynamic) */}
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
                    <option value="" disabled>Select Position</option>
                    {(positions[personnelType] || []).map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Email:</label>
                  <input name="email" type="email" value={formData.email} onChange={handleChange} required disabled={isLoading} />
                </div>

                <div>
                  <label>Department:</label>
                  {user?.type === 'Administrator' ? (
                    <select name="department" value={formData.department} onChange={handleChange} disabled={isLoading} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}>
                      {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                  ) : (
                    <input name="department" value={user?.type || formData.department} readOnly disabled style={{ backgroundColor: '#e9ecef', color: '#495057' }} />
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
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} disabled={isLoading}>
              <option value="All">All</option>
              {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
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
                                {canEditOrDelete(cat) && <button className="edit-btn" onClick={() => handleEdit(cat)}>Edit</button>}
                                {canEditOrDelete(cat) && <button className="delete-btn" onClick={() => handleDelete(cat.id)}>Delete</button>}
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
            <button className="close-view-btn" onClick={closeViewModal} style={{ marginTop: '20px' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categories;