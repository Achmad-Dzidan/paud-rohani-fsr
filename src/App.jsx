import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login'; // Asumsi App.jsx lama Anda direname jadi Login.jsx
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import Income from './pages/Income';
import Users from './pages/Users';
import Absensi from './pages/Absensi';
import DailyIncome from './pages/DailyIncome';
import StudentSavings from './pages/StudentSavings';
// import OtherTransaction from './pages/OtherTransaction'; 
// import EventTransactions from './pages/EventTransactions'; 

// Buat komponen dummy untuk Income/Users sementara
// const Income = () => <h1>Income Page</h1>;
// const Users = () => <h1>Users Page</h1>;

function App() {
  return (
    <Router>
      <Routes>
        {/* Halaman Login (Tanpa Sidebar) */}
        <Route path="/" element={<Login />} />

        {/* Halaman Admin (Dengan Sidebar & Sonner Persistent) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/income" element={<Income />} />
          <Route path="/daily-income" element={<DailyIncome />} />
          <Route path="/savings" element={<StudentSavings />} />
          <Route path="/users" element={<Users />} />
          <Route path="/absensi" element={<Absensi />} />
          {/* <Route path="/other-transaction" element={<OtherTransaction />} />
          <Route path="/event-transaction" element={<EventTransactions />} /> */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;