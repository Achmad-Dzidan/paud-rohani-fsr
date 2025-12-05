import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase'; // Pastikan path import firebase benar

const ProtectedRoute = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener untuk memantau status login Firebase secara realtime
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Stop loading setelah status didapat
    });

    return () => unsubscribe();
  }, []);

  // 1. Tampilkan Loading saat Firebase sedang mengecek sesi (PENTING agar tidak langsung redirect)
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading session...</p>
      </div>
    );
  }

  // 2. Jika user null (tidak login), lempar ke halaman Login ('/')
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 3. Jika user ada, izinkan render halaman anak (Dashboard, Income, dll)
  // Outlet berfungsi sebagai placeholder untuk rute anak di App.js
  return <Outlet />;
};

export default ProtectedRoute;