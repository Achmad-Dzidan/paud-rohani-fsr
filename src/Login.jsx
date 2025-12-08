import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import './App.css'; 

import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { db, auth } from './firebase'; 

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence
  // sendEmailVerification, // <-- DIHAPUS
  // signOut // <-- DIHAPUS (Tidak perlu logout paksa lagi)
} from 'firebase/auth';

function Login() { 
  const navigate = useNavigate();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      toast.error("Email dan Password wajib diisi!");
      setLoading(false);
      return;
    }

    try {
      if (isLoginMode) {
        // --- LOGIKA LOGIN (LANGSUNG MASUK) ---
        console.log(">> Proses Login...");
        
        // 1. Atur Persistence dulu
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);

        // 2. Sign In
        await signInWithEmailAndPassword(auth, email, password);
        
        // 3. Redirect Langsung (Tanpa Cek Verifikasi)
        toast.success('Login Berhasil!');
        setTimeout(() => navigate('/dashboard'), 1000);

      } else {
        // --- LOGIKA REGISTER (TANPA KIRIM EMAIL) ---
        console.log(">> Proses Register...");
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Simpan ke Collection 'account'
        await setDoc(doc(db, "account", user.uid), {
            name: fullName,
            username: username.replace(/\s+/g, '').toLowerCase(),
            email: email,
            role: 'user', // Default role
            photo: '',
            fullName: fullName,
            phoneNumber: phone,
            status: 'active',
            createdAt: serverTimestamp()
        });

        toast.success('Registrasi Berhasil! Silakan Login.');
        setIsLoginMode(true); // Pindah ke tab login
        setPassword('');
      }
    } catch (error) {
      console.error("Error:", error);
      let errorMessage = "Terjadi kesalahan.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "Email sudah terdaftar.";
      if (error.code === 'auth/invalid-credential') errorMessage = "Email/Password salah.";
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setEmail('');
    setPassword('');
    setFullName('');
    setUsername('');
    setPhone('');
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-container" style={{ maxHeight: '90vh', overflowY: 'auto' }}> 
        <div className="logo-container"><i className="fa-solid fa-school"></i></div>
        <h1>PAUD Finance System</h1>
        <p className="subtitle">School Administration Portal</p>

        <form onSubmit={handleAuth}>
          
          {!isLoginMode && (
            <>
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <div className="input-wrapper">
                  <i className="fa-regular fa-id-card"></i>
                  <input type="text" placeholder="Budi Santoso" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-at"></i>
                  <input type="text" placeholder="budi123" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">No. WhatsApp</label>
                <div className="input-wrapper">
                  <i className="fa-brands fa-whatsapp"></i>
                  <input type="number" placeholder="0812..." value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <i className="fa-regular fa-envelope"></i>
              <input type="email" placeholder="admin@paud.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock"></i>
              <input type="password" placeholder="Enter password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          {isLoginMode && (
            <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
              <label htmlFor="rememberMe" style={{ fontSize: '14px', cursor: 'pointer', color: '#555', userSelect: 'none' }}>Tetap login di perangkat ini</label>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '20px' }}>
            {loading ? 'Processing...' : (isLoginMode ? 'Login' : 'Register Account')}
          </button>
        </form>

        <div className="toggle-link">
          <p>
            {isLoginMode ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <span onClick={toggleMode}>{isLoginMode ? 'Daftar disini' : 'Login disini'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;