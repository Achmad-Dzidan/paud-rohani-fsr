import React, { useState } from 'react';
import { Toaster, toast } from 'sonner';
import './App.css'; 

// Import fungsi Firebase
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase'; 

function App() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Login Berhasil! Mengalihkan...');
        // Logika redirect bisa ditambahkan di sini
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Registrasi Berhasil! Silahkan login.');
        setIsLoginMode(true);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
  };

  return (
    // 1. WRAPPER UTAMA: Ini yang membuat posisi jadi di tengah (CENTER)
    <div className="login-page-wrapper">
      
      {/* Komponen Sonner Toaster */}
      <Toaster position="top-center" richColors />

      <div className="login-container">
        <div className="logo-container">
          <i className="fa-solid fa-school"></i>
        </div>

        <h1>PAUD Finance System</h1>
        <p class="subtitle">School Administration Portal</p>

        <form onSubmit={handleAuth}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <i className="fa-regular fa-envelope"></i>
              <input 
                type="email" 
                placeholder="admin@paud.com" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock"></i>
              <input 
                type="password" 
                placeholder="Enter password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Loading...' : (isLoginMode ? 'Login' : 'Register')}
          </button>
        </form>

        {/* 2. TOMBOL REQUEST: Render Toast (Di bawah Login) */}
        <button
          type="button" // Penting: type button agar tidak men-submit form
          className="btn-secondary"
          onClick={() => {
            toast.success('This is a success toast');
          }}
        >
          Render toast
        </button>

        <div className="info-box">
          For <b>private</b> access
        </div>

        <div className="toggle-link">
          <p>
            {isLoginMode ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <span onClick={toggleMode}>
              {isLoginMode ? 'Daftar disini' : 'Login disini'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;