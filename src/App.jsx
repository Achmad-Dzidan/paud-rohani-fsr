import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'; // Router adalah alias untuk BrowserRouter
import 'sonner/dist/styles.css';
import { Toaster } from 'sonner';
import Login from './Login'; 
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import Income from './pages/Income';
import Users from './pages/Users';
import Absensi from './pages/Absensi';
import DailyIncome from './pages/DailyIncome';
import StudentSavings from './pages/StudentSavings';
import ProtectedRoute from './components/ProtectedRoute'; 
import Account from './pages/Account'; // Ganti Users jadi Account

function App() {
  return (
    // TAMBAHKAN PROPS FUTURE DI SINI
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-center" richColors />
      <Routes>
        {/* Halaman Login (Tanpa Sidebar) */}
        <Route path="/" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          {/* Halaman Admin (Dengan Sidebar & Sonner Persistent) */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/income" element={<Income />} />
            <Route path="/daily-income" element={<DailyIncome />} />
            <Route path="/savings" element={<StudentSavings />} />
            <Route path="/users" element={<Users />} />
            <Route path="/absensi" element={<Absensi />} />
            <Route path="/account" element={<Account />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;