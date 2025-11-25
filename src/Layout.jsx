import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import Sidebar from './components/Sidebar';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* 1. SONNER DITARUH DISINI (Global) */}
      <Toaster position="top-center" richColors />

      {/* 2. SIDEBAR */}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      {/* 3. MAIN CONTENT */}
      <main className="main-content">
        {/* Header Mobile Toggle Button (Global untuk semua halaman) */}
        <div className="mobile-header-control">
             {/* Tombol hamburger ini bisa kita taruh di tiap page, 
                 atau dipassing lewat context. 
                 Untuk simpelnya, kita handle toggle dari props di page masing-masing 
                 atau biarkan page yang render tombolnya.
             */}
        </div>

        {/* OUTLET: Disini halaman Dashboard/Income akan dirender bergantian */}
        <Outlet context={{ toggleSidebar }} /> 
      </main>
    </div>
  );
};

export default Layout;