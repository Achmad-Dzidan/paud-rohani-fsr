import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore
import { auth, db } from '../firebase'; // Import DB

const ProtectedRoute = ({ allowedRoles }) => { // Menerima props 'allowedRoles'
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // State untuk menyimpan Role
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener status login
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // 1. Ambil data user dari collection 'account' untuk tahu role-nya
          const docRef = doc(db, "account", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();
            setRole(userData.role); // Simpan role (admin/teacher/user)
          } else {
            setRole('guest'); // Fallback jika data tidak ada
          }
          setUser(currentUser);
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole('guest');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- TAMPILAN LOADING ---
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{color:'#64748b'}}>Memuat akses...</p>
      </div>
    );
  }

  // --- CEK 1: APAKAH SUDAH LOGIN? ---
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', color: '#334155', textAlign:'center' 
      }}>
        <div style={{fontSize:'50px', color:'#ef4444', marginBottom:'10px'}}>
            <i className="fa-solid fa-ban"></i>
        </div>
        <h2 style={{margin:0}}>Akses Ditolak</h2>
        <p style={{marginTop:'10px', color:'#64748b'}}>
            Anda login sebagai <b>{role}</b>.<br/>
            Halaman ini hanya untuk <b>{allowedRoles.join(' atau ')}</b>.
        </p>
        <button 
            onClick={() => window.history.back()} 
            style={{
                marginTop:'20px', padding:'10px 20px', background:'#334155', 
                color:'white', border:'none', borderRadius:'6px', cursor:'pointer'
            }}
        >
            Kembali
        </button>
      </div>
    );
  }

  // --- LULUS SEMUA CEK ---
  // Kita kirim data user & role ke bawah (Dashboard/Sidebar) via Context
  return <Outlet context={{ user, role }} />;
};

export default ProtectedRoute;