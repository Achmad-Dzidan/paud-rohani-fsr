import React, { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import './App.css'; 

// 1. IMPORT FUNGSI PERSISTENCE DARI FIREBASE
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from 'firebase/auth';
import { auth } from './firebase'; 

function Login() { 
  const navigate = useNavigate();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 2. STATE UNTUK CHECKBOX REMEMBER ME
  const [rememberMe, setRememberMe] = useState(false); 
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      toast.error("Email atau Password kosong!");
      setLoading(false);
      return;
    }

    try {
      if (isLoginMode) {
        console.log(">> Mengatur Persistence...");
        
        // 3. LOGIKA PERSISTENCE (KUNCI UTAMA)
        // Jika dicentang -> Local (Tetap login walau browser tutup)
        // Jika tidak -> Session (Logout saat tab ditutup)
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        
        // Set persistence DULU sebelum sign in
        await setPersistence(auth, persistenceType);

        console.log(">> Mengeksekusi signInWithEmailAndPassword...");
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        console.log(">> HASIL LOGIN:", userCredential);
        toast.success('Login Berhasil! Mengalihkan...');
        
        setTimeout(() => {
            navigate('/dashboard'); 
        }, 1000);

      } else {
        console.log(">> Mengeksekusi Register...");
        // Register biasanya default local, tapi bisa diatur juga jika mau
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Registrasi Berhasil! Silahkan login.');
        setIsLoginMode(true);
      }
    } catch (error) {
      console.error("Code:", error.code);
      console.error("Message:", error.message);
      
      // Error handling yang lebih rapi
      let errorMessage = "Terjadi kesalahan.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        errorMessage = "Email atau password salah.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Terlalu banyak percobaan. Coba lagi nanti.";
      }
      
      toast.error(errorMessage);
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

          {/* 4. UI CHECKBOX REMEMBER ME */}
          {isLoginMode && (
            <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <input 
                type="checkbox" 
                id="rememberMe" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="rememberMe" style={{ fontSize: '14px', cursor: 'pointer', color: '#555', userSelect: 'none' }}>
                Tetap login di perangkat ini
              </label>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '20px' }}>
            {loading ? 'Loading...' : (isLoginMode ? 'Login' : 'Register')}
          </button>
        </form>

        {/* Tombol render toast dihapus saja jika tidak dipakai untuk produksi */}
        
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