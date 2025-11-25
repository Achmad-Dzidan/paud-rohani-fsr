import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Logika logout bisa ditaruh di sini (misal clear session)
    navigate('/'); // Kembali ke Login
  };

  return (
    <>
      {/* Overlay Background (Mobile) */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`} 
        onClick={toggleSidebar}
      ></div>

      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Tombol Close (Mobile) */}
        <button className="sidebar-close-btn" onClick={toggleSidebar}>
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="brand">
          <h2>PAUD Finance</h2>
          <p>Admin Portal</p>
        </div>
        
        <ul className="menu-list">
          <li>
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            >
              <i className="fa-solid fa-border-all"></i> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/income" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            >
              <i className="fa-solid fa-dollar-sign"></i> Income Management
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/users" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            >
              <i className="fa-solid fa-user-group"></i> User Management
            </NavLink>
          </li>
        </ul>
        
        {/* Tombol Logout */}
        <button onClick={handleLogout} className="menu-item logout" style={{background:'none', border:'none', width:'100%', textAlign:'left'}}>
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
        </button>
      </nav>
    </>
  );
};

export default Sidebar;