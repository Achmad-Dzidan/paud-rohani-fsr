import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, firebaseConfig } from '../firebase'; // Pastikan firebaseConfig di-export di firebase.js
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

// Import Modular SDK untuk Secondary App
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const Account = () => {
  const { toggleSidebar } = useOutletContext();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); 
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '', name: '', username: '', email: '', password: '', role: 'user', photo: '',
  });

  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // 1. FETCH DATA (Dari collection 'account')
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "account"));
        const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersList);
        setLoading(false);
      } catch (error) {
        toast.error("Gagal memuat data akun.");
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const options = { maxSizeMB: 0.3, maxWidthOrHeight: 500, useWebWorker: true };
    try {
      const compressedFile = await imageCompression(file, options);
      setNewPhotoFile(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));
    } catch (error) { toast.error("Gagal memproses gambar."); }
  };

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData({ id: '', name: '', username: '', email: '', password: '', role: 'user', photo: '' });
    setNewPhotoFile(null); setPreviewUrl(''); setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setModalMode('edit');
    setFormData({
      id: user.id, name: user.name || '', username: user.username || '', email: user.email || '', 
      password: '', role: user.role || 'user', photo: user.photo || ''
    });
    setNewPhotoFile(null); setPreviewUrl(user.photo || ''); setShowModal(true);
  };

  const handleOpenDelete = (e, user) => {
    e.stopPropagation(); setModalMode('delete'); setFormData(user); setShowModal(true);
  };

  // 4. LOGIC SAVE UTAMA
  const handleSave = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      let finalPhotoUrl = formData.photo;

      // Upload Foto
      if (newPhotoFile) {
        const fileId = modalMode === 'edit' ? formData.id : `new_${Date.now()}`;
        const storageRef = ref(storage, `profile_photos/${fileId}.jpg`);
        const snapshot = await uploadBytes(storageRef, newPhotoFile);
        finalPhotoUrl = await getDownloadURL(snapshot.ref);
      }

      if (modalMode === 'add') {
        // --- ADD USER VIA SECONDARY APP (Agar Admin tidak logout) ---
        
        // 1. Cek atau Buat Secondary App
        const secondaryAppName = "SecondaryAppForCreateUser";
        let secondaryApp = getApps().find(app => app.name === secondaryAppName);
        if (!secondaryApp) {
            secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        }
        const secondaryAuth = getAuth(secondaryApp);

        // 2. Create User (Tanpa kirim email verifikasi)
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const newUser = userCredential.user;

        // 3. Simpan ke Firestore 'account'
        const newUserDoc = {
            name: formData.name, 
            username: formData.username, 
            email: formData.email,
            role: formData.role, 
            photo: finalPhotoUrl, 
            status: 'active', // Langsung aktif
            createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, "account", newUser.uid), newUserDoc);

        // 4. Update UI Lokal
        setUsers(prev => [...prev, { id: newUser.uid, ...newUserDoc }]);
        
        // 5. Sign Out dari Secondary Auth (Penting!)
        await signOut(secondaryAuth);

        toast.success(`Akun ${formData.name} berhasil dibuat!`);

      } else if (modalMode === 'edit') {
        // --- EDIT USER ---
        const userRef = doc(db, "account", formData.id);
        const updatePayload = {
          name: formData.name, username: formData.username, role: formData.role,
          photo: finalPhotoUrl, updatedAt: serverTimestamp()
        };

        await updateDoc(userRef, updatePayload);
        setUsers(prev => prev.map(u => u.id === formData.id ? { ...u, ...updatePayload } : u));
        toast.success(`Data diperbarui!`);
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      let msg = "Gagal memproses data.";
      if (error.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar!";
      if (error.code === 'auth/weak-password') msg = "Password minimal 6 karakter!";
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
        await deleteDoc(doc(db, "account", formData.id));
        setUsers(prev => prev.filter(u => u.id !== formData.id));
        toast.success("Akun dihapus.");
        setShowModal(false);
    } catch (error) {
        toast.error("Gagal menghapus akun.");
    } finally {
        setIsProcessing(false);
    }
  };

  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "AC";
  const getRoleBadgeStyle = (role) => {
      switch(role) {
          case 'admin': return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }; 
          case 'teacher': return { background: '#e0f2fe', color: '#075985', border: '1px solid #bae6fd' }; 
          default: return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }; 
      }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ width: '100%' }}>
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn floating-menu-btn" onClick={toggleSidebar} style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
            <i className="fa-solid fa-bars" style={{color: '#334155', fontSize: '16px'}}></i>
          </button>
          <div className="page-title" style={{ marginLeft: window.innerWidth < 768 ? '50px' : '0' }}>
            <h1>Account Management</h1> 
            <p>Atur akun dan role pengguna</p>
          </div>
        </div>
        <div style={{ marginTop: '15px', display:'flex', gap:'10px' }}>
            <input type="text" placeholder="Cari user..." className="form-control" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
            <button className="btn-add" onClick={handleOpenAdd}><i className="fa-solid fa-plus"></i> Add User</button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
        {loading ? <p style={{color:'#64748b'}}>Loading accounts...</p> : filteredUsers.length === 0 ? <p style={{color:'#64748b'}}>Akun tidak ditemukan.</p> : (
            filteredUsers.map((user) => (
                <div key={user.id} className="user-card" onClick={() => handleOpenEdit(user)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', transition: 'transform 0.2s', position: 'relative' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    <div className="avatar" style={{ width:'50px', height:'50px', borderRadius:'50%', flexShrink:0, backgroundColor: user.photo ? 'transparent' : 'var(--primary-blue)', backgroundImage: user.photo ? `url(${user.photo})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e2e8f0', color: user.photo ? 'transparent' : 'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold' }}>
                        {!user.photo && getInitials(user.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.name}</h4>
                        <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#64748b' }}>{user.email}</p>
                        <span style={{ ...getRoleBadgeStyle(user.role), padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>{user.role}</span>
                    </div>
                    <button onClick={(e) => handleOpenDelete(e, user)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:'5px' }}><i className="fa-solid fa-trash-can"></i></button>
                </div>
            ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{modalMode === 'add' ? 'Add New Account' : (modalMode === 'edit' ? 'Edit Account' : 'Delete Account')}</h3>
                    <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                {modalMode !== 'delete' ? (
                    <form onSubmit={handleSave}>
                        <div className="modal-body" style={{maxHeight:'60vh', overflowY:'auto'}}>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'15px' }}>
                                <div style={{ width:'70px', height:'70px', borderRadius:'50%', backgroundColor: previewUrl ? 'transparent' : '#e2e8f0', backgroundImage: previewUrl ? `url(${previewUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', color:'#64748b', border:'2px solid #cbd5e1', marginBottom: '5px' }}>{!previewUrl && getInitials(formData.name)}</div>
                                <div style={{position:'relative', overflow:'hidden'}}><button type="button" className="btn-secondary" style={{padding:'4px 10px', fontSize:'11px'}}> <i className="fa-solid fa-camera"></i> Upload</button><input type="file" accept="image/*" onChange={handleImageChange} style={{position:'absolute', top:0, left:0, opacity:0, width:'100%', height:'100%', cursor:'pointer'}} /></div>
                            </div>
                            <div className="form-group" style={{marginBottom:'10px'}}><label className="form-label" style={{fontSize:'12px'}}>Nama Lengkap</label><input type="text" className="form-control" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required /></div>
                            <div className="form-group" style={{marginBottom:'10px'}}><label className="form-label" style={{fontSize:'12px'}}>Username</label><input type="text" className="form-control" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value.replace(/\s+/g, '').toLowerCase()})} required /></div>
                            {modalMode === 'add' && (<><div className="form-group" style={{marginBottom:'10px'}}><label className="form-label" style={{fontSize:'12px'}}>Email</label><input type="email" className="form-control" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required placeholder="email@contoh.com" /></div><div className="form-group" style={{marginBottom:'10px'}}><label className="form-label" style={{fontSize:'12px'}}>Password</label><input type="password" className="form-control" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required placeholder="******" /></div></>)}
                            {modalMode === 'edit' && (<div className="form-group" style={{marginBottom:'10px'}}><label className="form-label" style={{fontSize:'12px'}}>Email</label><input type="text" className="form-control" value={formData.email} disabled style={{background:'#f1f5f9', color:'#64748b'}} /></div>)}
                            <div className="form-group" style={{marginBottom:'10px'}}><label className="form-label" style={{fontSize:'12px'}}>Role</label><select className="form-control" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}><option value="user">User / Wali Murid</option><option value="teacher">Guru</option><option value="admin">Admin</option></select></div>
                        </div>
                        <div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn-save" disabled={isProcessing}>{isProcessing ? 'Saving...' : (modalMode === 'add' ? 'Create Account' : 'Save Changes')}</button></div>
                    </form>
                ) : (
                    <div><div className="modal-body"><p>Hapus akun <b>{formData.name}</b>?</p><p style={{fontSize:'12px', color:'red'}}>User tidak akan bisa login lagi.</p></div><div className="modal-footer"><button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button><button className="btn-save" style={{backgroundColor:'#ef4444'}} onClick={handleDelete} disabled={isProcessing}>{isProcessing ? 'Deleting...' : 'Delete'}</button></div></div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Account;