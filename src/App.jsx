import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'; 
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
import Account from './pages/Account'; 
import RaportForm from './pages/RaportForm';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route element={<ProtectedRoute allowedRoles={['admin','teacher']}/>}>
          <Route element={<Layout />}>
            <Route path="/users" element={<Users />} />
            <Route path="/raport" element={<RaportForm />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin']}/>}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/income" element={<Income />} />
            <Route path="/daily-income" element={<DailyIncome />} />
            <Route path="/savings" element={<StudentSavings />} />
            <Route path="/absensi" element={<Absensi />} />
            <Route path="/account" element={<Account />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;