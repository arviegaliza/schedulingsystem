import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Categories.css';

function Categories() {
  // UPDATED STATE: 'office' is gone, 'position' and 'personnel_type' are here
  const [formData, setFormData] = useState({
    idnumber: '',
    personnel_type: '', // Stores "Teaching" or "Non-Teaching"
    position: '',       // Stores "Teacher I" (Renamed from office)
    email: '',
    department: '',
  });

  const [personnelTypes, setPersonnelTypes] = useState([]); 
  const [positions, setPositions] = useState({});

  // ... (Settings Modal State remains same) ...
  const [showSettings, setShowSettings] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState('');
  const [newPosInput, setNewPosInput] = useState('');
  const [selectedTypeForSettings, setSelectedTypeForSettings] = useState('');

  // Main UI State
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
  const OPTIONS_URL = `${process.env.REACT_APP_API_URL}/api/options`;

  // 1. Fetch Options
  const fetchOptions = useCallback(async () => {
    try {
      const res = await axios.get(OPTIONS_URL);
      setPersonnelTypes(res.data.types);
      setPositions(res.data.positions);
      if (res.data.types.length > 0 && !selectedTypeForSettings) {
        setSelectedTypeForSettings(res.data.types[0]);
      }
    } catch (err) { console.error("Failed to load options"); }
  }, [OPTIONS_URL, selectedTypeForSettings]);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);
    fetchOptions();
  }, [fetchOptions]);

  // 2. Fetch Categories
  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}?userType=${user.type}`, { withCredentials: true });
      setCategoryList(res.data);
    } catch (err) { toast.error('Failed to fetch categories'); }
    finally { setIsLoading(false); }
  }, [API_URL, user]);

  useEffect(() => { if (user) fetchCategories(); }, [user, fetchCategories]);

  // 3. Auto-update Position when Type changes
  useEffect(() => {
    if (showForm && !editMode && formData.personnel_type) {
      const availablePositions = positions[formData.personnel_type] || [];
      const firstOption = availablePositions.length > 0 ? availablePositions[0] : '';
      setFormData(prev => ({ ...prev, position: firstOption }));
    }
  }, [formData.personnel_type, showForm, editMode, positions]);

  // ... (Settings Handlers - handleAddType etc. - Keep EXACTLY as previous code) ...
  // [Paste the HandleAddType, HandleDeleteType, HandleAddPosition, HandleDeletePosition from previous response here]
  const handleAddType = async () => {
    if (!newTypeInput.trim()) return toast.warning("Enter a type name");
    try { await axios.post(`${OPTIONS_URL}/type`, { type_name: newTypeInput }); toast.success("Type Added"); setNewTypeInput(''); fetchOptions(); } 
    catch (err) { toast.error("Failed."); }
  };
  const handleDeleteType = async (type) => {
    if (!window.confirm(`Delete "${type}"?`)) return;
    try { await axios.delete(`${OPTIONS_URL}/type/${type}`); toast.success("Type Deleted"); fetchOptions(); } 
    catch (err) { toast.error("Failed."); }
  };
  const handleAddPosition = async () => {
    if (!newPosInput.trim()) return toast.warning("Enter name");
    try { await axios.post(`${OPTIONS_URL}/position`, { type_name: selectedTypeForSettings, position_name: newPosInput }); toast.success("Position Added"); setNewPosInput(''); fetchOptions(); } 
    catch (err) { toast.error("Failed."); }
  };
  const handleDeletePosition = async (type, posName) => {
    if (!window.confirm(`Delete "${posName}"?`)) return;
    try { await axios.delete(`${OPTIONS_URL}/position`, { data: { type_name: type, position_name: posName } }); toast.success("Position Deleted"); fetchOptions(); } 
    catch (err) { toast.error("Failed."); }
  };


  // 4. Form Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewCategory = () => {
    setShowForm(!showForm);
    setEditMode(false);
    
    // Default logic
    const defaultType = personnelTypes.length > 0 ? personnelTypes[0] : '';
    const availablePositions = positions[defaultType] || [];
    const defaultPos = availablePositions.length > 0 ? availablePositions[0] : '';
    
    setFormData({ 
      idnumber: '', 
      personnel_type: defaultType, // New Field
      position: defaultPos,        // Renamed Field
      email: '', 
      department: user?.type === 'Administrator' ? 'OSDS' : user?.type
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const url = editMode ? `${API_URL}/${editId}?userType=${user?.type}` : `${API_URL}?userType=${user?.type}`;
      const method = editMode ? axios.put : axios.post;
      
      const payload = { ...formData };
      if (user?.type !== 'Administrator') payload.department = user.type; 

      await method(url, payload);

      toast.success(editMode ? 'Category updated!' : 'Category added!');
      setShowForm(false);
      setEditMode(false);
      fetchCategories();
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('duplicate')) toast.error('Error: Duplicate ID Number.');
      else toast.error(msg || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cat) => {
    // When editing, we now load personnel_type and position directly from DB data
    setFormData({
      idnumber: cat.idnumber,
      personnel_type: cat.personnel_type, // Loaded from DB
      position: cat.position,             // Loaded from DB
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
    } catch (err) { toast.error('Delete failed.'); } 
    finally { setIsLoading(false); }
  };

  const filteredList = filterDept === 'All' ? categoryList : categoryList.filter(cat => cat.department === filterDept);
  const canEditOrDelete = (cat) => (user?.type === 'Administrator' || user?.type === cat.department);

  return (
    <div className="category-container">
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar closeOnClick />

      <div className="header-actions">
        <h2>Categories</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="toggle-form-btn" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowSettings(true)} disabled={isLoading}>
            Manage Options
          </button>
          <button className="toggle-form-btn" onClick={handleNewCategory} disabled={isLoading}>
            {showForm ? 'Hide Form' : 'New Category'}
          </button>
        </div>
      </div>

      <div className="form-and-table">
        {/* SETTINGS MODAL (Same as before) */}
        {showSettings && (
          <div className="category-modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="category-modal" style={{ maxWidth:'600px' }} onClick={e => e.stopPropagation()}>
               <button className="close-view-btn" style={{position:'absolute', top:10, right:10}} onClick={() => setShowSettings(false)}>×</button>
               <h3>Manage Options</h3>
               
               <div className="settings-section" style={{marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
                 <h4>1. Personnel Types</h4>
                 <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                   <input placeholder="New Type" value={newTypeInput} onChange={(e)=>setNewTypeInput(e.target.value)} />
                   <button className="view-btn" onClick={handleAddType}>Add</button>
                 </div>
                 <div style={{display:'flex', flexWrap:'wrap', gap:'5px'}}>
                   {personnelTypes.map(type => (
                     <span key={type} style={{background:'#f0f0f0', padding:'5px 10px', borderRadius:'15px', fontSize:'14px', display:'flex', alignItems:'center'}}>
                       {type} <span style={{cursor:'pointer', color:'red', fontWeight:'bold', marginLeft:'8px'}} onClick={()=>handleDeleteType(type)}>×</span>
                     </span>
                   ))}
                 </div>
               </div>

               <div className="settings-section">
                 <h4>2. Positions</h4>
                 <label>Select Type:</label>
                 <select value={selectedTypeForSettings} onChange={(e) => setSelectedTypeForSettings(e.target.value)} style={{marginBottom:'10px', width:'100%', padding:'5px'}}>
                   {personnelTypes.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
                 <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                   <input placeholder={`Position for ${selectedTypeForSettings}`} value={newPosInput} onChange={(e)=>setNewPosInput(e.target.value)} />
                   <button className="view-btn" onClick={handleAddPosition}>Add</button>
                 </div>
                 <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #eee', padding:'5px'}}>
                   {(positions[selectedTypeForSettings] || []).map(pos => (
                      <div key={pos} style={{display:'flex', justifyContent:'space-between', padding:'6px', borderBottom:'1px solid #f9f9f9'}}>
                        <span>{pos}</span>
                        <span style={{cursor:'pointer', color:'red', fontWeight:'bold'}} onClick={()=>handleDeletePosition(selectedTypeForSettings, pos)}>Delete</span>
                      </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* ADD/EDIT FORM */}
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

                {/* PERSONNEL TYPE DROPDOWN */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display:'block', marginBottom:'5px', fontWeight:'bold', color:'#555' }}>Personnel Type:</label>
                    <select
                        name="personnel_type"
                        value={formData.personnel_type}
                        onChange={handleChange}
                        disabled={isLoading}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                    >
                        {personnelTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* POSITION DROPDOWN */}
                <div>
                  <label>Position / Designation:</label>
                  <select 
                    name="position" 
                    value={formData.position} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                  >
                    <option value="" disabled>Select Position</option>
                    {(positions[formData.personnel_type] || []).map((pos) => (
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

        {/* TABLE SECTION */}
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
                    <th style={{ width: '15%' }}>ID Number</th>
                    <th style={{ width: '15%' }}>Type</th>
                    <th style={{ width: '20%' }}>Position</th>
                    <th style={{ width: '22%' }}>Email</th>
                    <th style={{ width: '10%' }}>Dept</th>
                    <th style={{ width: '12%' }}>Actions</th>
                  </tr>
                </thead>
              </table>
              <div className="table-scroll-wrapper">
                <table className="category-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <tbody>
                    {filteredList.length === 0 ? (
                        <tr><td colSpan="7" style={{textAlign:'center', padding:'20px'}}>No categories found.</td></tr>
                    ) : (
                        filteredList.map((cat, idx) => (
                        <tr key={cat.id}>
                            <td style={{ width: '6%' }}>{idx + 1}</td>
                            <td style={{ width: '15%' }}>{cat.idnumber}</td>
                            <td style={{ width: '15%' }}>{cat.personnel_type}</td>
                            <td style={{ width: '20%' }}>{cat.position}</td>
                            <td style={{ width: '22%' }}>{cat.email}</td>
                            <td style={{ width: '10%' }}>{cat.department}</td>
                            <td style={{ width: '12%' }}>
                            <div className="action-buttons">
                                <button className="view-btn" onClick={() => setViewedCategory(cat)}>View</button>
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
                <p><strong>Type:</strong> {viewedCategory.personnel_type}</p>
                <p><strong>Position:</strong> {viewedCategory.position}</p>
                <p><strong>Email:</strong> {viewedCategory.email}</p>
                <p><strong>Department:</strong> {viewedCategory.department}</p>
            </div>
            <button className="close-view-btn" onClick={() => setViewedCategory(null)} style={{ marginTop: '20px' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categories;