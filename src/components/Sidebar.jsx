import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();

  // --- 1. PINDAHKAN STATE WINDOW WIDTH KE DALAM KOMPONEN ---
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // --- 2. PINDAHKAN USE EFFECT KE DALAM KOMPONEN ---
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    navigate('/'); 
  };

  // --- FUNGSI: Tutup sidebar saat link diklik (Khusus Mobile) ---
  const handleLinkClick = () => {
    // Cek jika di mobile (lebar < 768) dan sidebar sedang terbuka
    if (windowWidth < 768 && isOpen) {
      toggleSidebar();
    }
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

        {/* LOGIKA MARGIN BERDASARKAN WINDOW WIDTH */}
        <div className="brand" style={{ marginTop: windowWidth < 768 ? '50px' : '0' }}>
          <h2>PAUD Finance</h2>
          <p>Admin Portal</p>
        </div>
        
        <ul className="menu-list">
          <li>
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
              onClick={handleLinkClick} 
            >
              <i className="fa-solid fa-border-all"></i> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/income" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
              onClick={handleLinkClick} 
            >
              <i className="fa-solid fa-dollar-sign"></i> Balance Mgt.
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/daily-income" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
              onClick={handleLinkClick} 
            >
              <i className="fa-solid fa-calendar-days"></i> Daily Income
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/savings" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
              onClick={handleLinkClick} 
            >
              <i className="fa-solid fa-piggy-bank"></i> Student Savings
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/absensi" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
              onClick={handleLinkClick} 
            >
              <i className="fa-solid fa-user-check"></i> Absensi
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/users" 
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
              onClick={handleLinkClick} 
            >
              <i className="fa-solid fa-users"></i> User Management
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