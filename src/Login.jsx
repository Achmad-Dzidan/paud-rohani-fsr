import React, { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { useNavigate } from 'react-router-dom'; // 1. IMPORT NAVIGATE
import './App.css'; 

// Import fungsi Firebase
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase'; 

function Login() { // Ubah nama function jadi Login agar rapi
  const navigate = useNavigate(); // 2. INISIALISASI NAVIGATE
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLoginMode) {
        // --- LOGIKA LOGIN ---
        await signInWithEmailAndPassword(auth, email, password);
        
        toast.success('Login Berhasil! Mengalihkan...');
        
        // 3. PINDAH KE DASHBOARD SETELAH 1 DETIK (Agar toast terbaca)
        setTimeout(() => {
            navigate('/dashboard'); 
        }, 1000);

      } else {
        // --- LOGIKA REGISTER ---
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Registrasi Berhasil! Silahkan login.');
        setIsLoginMode(true); // Pindah ke mode login
      }
    } catch (error) {
      console.error("Auth Error:", error.code); // Debugging di console

      // 4. PESAN ERROR YANG LEBIH JELAS
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        toast.error('Email atau Password salah!');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Email sudah terdaftar, silakan Login.');
      } else if (error.code === 'auth/network-request-failed') {
         toast.error('Gagal koneksi. Cek internet/DNS Anda.');
      } else {
        toast.error('Gagal: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
  };

  return (
    <div className="login-page-wrapper">
      
      <Toaster position="top-center" richColors />

      <div className="login-container">
        <div className="logo-container">
          <i className="fa-solid fa-school"></i>
        </div>

        <h1>PAUD Finance System</h1>
        <p className="subtitle">School Administration Portal</p>

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

        <button
          type="button" 
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

export default Login;