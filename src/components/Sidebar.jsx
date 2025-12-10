import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Pastikan path benar

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // State untuk menyimpan role user yang login
  const [userRole, setUserRole] = useState(null); 
  const [loading, setLoading] = useState(true);

  // --- 1. HANDLE RESIZE ---
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 2. FETCH ROLE SAAT MOUNT ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const docRef = doc(db, "account", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role);
          }
        } catch (error) {
          console.error("Gagal mengambil role:", error);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/'); 
  };

  const handleLinkClick = () => {
    if (windowWidth < 768 && isOpen) {
      toggleSidebar();
    }
  };

  if (loading) return null; // Atau skeleton loading sidebar

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`} 
        onClick={toggleSidebar}
      ></div>

      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="sidebar-close-btn" onClick={toggleSidebar}>
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="brand" style={{ marginTop: windowWidth < 768 ? '50px' : '0' }}>
          <h2>PAUD Finance</h2>
          <p style={{textTransform: 'capitalize'}}>{userRole} Portal</p>
        </div>
        
        <ul className="menu-list">
          
          {/* --- MENU KHUSUS ADMIN (FULL AKSES) --- */}
          {userRole === 'admin' && (
            <>
              <li>
                <NavLink to="/dashboard" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={handleLinkClick}>
                  <i className="fa-solid fa-border-all"></i> Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/income" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={handleLinkClick}>
                  <i className="fa-solid fa-dollar-sign"></i> Balance Mgt.
                </NavLink>
              </li>
              <li>
                <NavLink to="/daily-income" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={handleLinkClick}>
                  <i className="fa-solid fa-calendar-days"></i> Daily Income
                </NavLink>
              </li>
              <li>
                <NavLink to="/savings" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={handleLinkClick}>
                  <i className="fa-solid fa-piggy-bank"></i> Student Savings
                </NavLink>
              </li>
              <li>
                <NavLink to="/absensi" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={handleLinkClick}>
                  <i className="fa-solid fa-user-check"></i> Absensi
                </NavLink>
              </li>
            </>
          )}

          {/* --- MENU SHARED (ADMIN & GURU BISA LIHAT) --- */}
          {(userRole === 'admin' || userRole === 'teacher') && (
            <>
              {/* Note: 'users' route sepertinya sudah diganti fungsinya oleh 'account', 
                  tapi jika masih dipakai untuk list siswa murni (bukan akun login), biarkan. 
                  Jika 'account' page sudah mencakup manajemen siswa, menu 'users' bisa dihapus. */}
              
              <li>
                <NavLink to="/users" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={handleLinkClick}>
                  <i className="fa-solid fa-users"></i> Student Management
                </NavLink>
              </li>
              <li>
                <NavLink to="/raport" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={handleLinkClick}>
                  <i className="fa-solid fa-clipboard-list"></i> Form Raport
                </NavLink>
              </li>
            </>
          )}

        </ul>
        
        <button onClick={handleLogout} className="menu-item logout" style={{background:'none', border:'none', width:'100%', textAlign:'left', marginTop:'auto', cursor:'pointer'}}>
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
        </button>
      </nav>
    </>
  );
};

export default Sidebar;