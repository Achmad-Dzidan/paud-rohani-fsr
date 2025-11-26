import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { toast } from 'sonner';

const Users = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE ---
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Penanda mode Edit/Add
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Form
  const [formData, setFormData] = useState({
    id: '', // Hanya terisi saat edit
    fullName: '',
    nickname: '',
    className: 'A',
    photo: '' // Menyimpan string Base64 gambar
  });

  // 1. REAL-TIME FETCH
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      toast.error("Gagal memuat users");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- IMAGE PROCESSING (RESIZE & CONVERT TO BASE64) ---
  // Kita ubah gambar jadi string kecil agar bisa disimpan di Firestore tanpa Storage
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi ukuran (max 2MB sebelum compress)
    if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran file terlalu besar (Max 2MB)");
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            // Buat Canvas untuk resize
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300; // Ukuran cukup untuk avatar grid
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Convert ke Base64 JPEG quality 0.7
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setFormData(prev => ({ ...prev, photo: compressedDataUrl }));
        };
    };
  };

  // --- HANDLERS ---

  // Buka Modal Add
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({ id: '', fullName: '', nickname: '', className: 'A', photo: '' });
    setShowModal(true);
  };

  // Buka Modal Edit
  const handleOpenEdit = (user) => {
    setIsEditing(true);
    setFormData({
        id: user.id,
        fullName: user.fullName || user.name, // Fallback untuk data lama
        nickname: user.nickname || user.name, // Fallback
        className: user.className || 'A',
        photo: user.photo || ''
    });
    setShowModal(true);
  };

  // Submit Form (Add & Edit Logic)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.nickname.trim()) {
      toast.error("Nama Lengkap & Panggilan wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.nickname, // Field 'name' tetap ada untuk kompatibilitas fitur lain
        fullName: formData.fullName,
        nickname: formData.nickname,
        className: formData.className,
        photo: formData.photo,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        // Logic Update
        const docRef = doc(db, "users", formData.id);
        await updateDoc(docRef, payload);
        toast.success("Data siswa diperbarui!");
      } else {
        // Logic Add
        await addDoc(collection(db, "users"), {
            ...payload,
            createdAt: serverTimestamp()
        });
        toast.success("Siswa baru ditambahkan!");
      }
      
      setShowModal(false);
    } catch (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (id, name) => {
    if (window.confirm(`Yakin ingin menghapus data "${name}"? Data absensi & tabungan mungkin akan kehilangan referensi nama.`)) {
      try {
        await deleteDoc(doc(db, "users", id));
        toast.success("User dihapus.");
      } catch (error) {
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  // Helper Initials
  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : "U";
  };

  return (
    <div style={{ width: '100%' }}>
      
      {/* HEADER */}
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="page-title">
            <h1>User Management</h1>
            <p>Kelola data siswa, kelas, dan foto</p>
          </div>
        </div>

        <button className="btn-add" onClick={handleOpenAdd}>
          <i className="fa-solid fa-user-plus"></i> Add User
        </button>
      </div>

      {/* GRID USERS */}
      <div className="user-grid">
        {loading ? (
          <p style={{ color: 'var(--text-gray)' }}>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--text-gray)' }}>Belum ada siswa.</p>
        ) : (
          users.map((user) => (
            <div className="user-card" key={user.id} style={{ position: 'relative', paddingRight: '10px' }}>
              
              <div className="user-info-wrapper">
                {/* Avatar: Jika ada foto tampilkan foto, jika tidak tampilkan inisial */}
                <div className="avatar" style={{ 
                    backgroundColor: user.photo ? 'transparent' : 'var(--primary-blue)',
                    backgroundImage: user.photo ? `url(${user.photo})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '1px solid #e2e8f0'
                }}>
                  {!user.photo && getInitials(user.nickname || user.name)}
                </div>
                
                <div className="info">
                  {/* Tampilkan Nama Panggilan di Grid */}
                  <h3 style={{fontSize:'16px'}}>{user.nickname || user.name}</h3>
                  <p style={{fontSize:'12px', color:'#64748b'}}>
                    Kelas {user.className || 'A'} • {user.fullName || user.name}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn-delete" // Pakai style btn-delete tapi warna biru untuk edit
                    onClick={() => handleOpenEdit(user)}
                    style={{ color: 'var(--primary-blue)' }}
                    title="Edit User"
                  >
                    <i className="fa-regular fa-pen-to-square"></i>
                  </button>
                  
                  <button 
                    className="btn-delete" 
                    onClick={() => handleDeleteUser(user.id, user.nickname || user.name)}
                    title="Hapus User"
                  >
                    <i className="fa-regular fa-trash-can"></i>
                  </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* MODAL FORM (ADD & EDIT) */}
      {showModal && (
        <div className="modal-overlay active" style={{display:'flex'}}>
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <h3>{isEditing ? 'Edit Siswa' : 'Tambah Siswa Baru'}</h3>
                <p>Lengkapi data profil siswa di bawah ini.</p>
              </div>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                {/* Preview Foto */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', 
                        background: formData.photo ? `url(${formData.photo}) center/cover` : '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #e2e8f0'
                    }}>
                        {!formData.photo && <i className="fa-solid fa-camera" style={{color:'#94a3b8', fontSize:'24px'}}></i>}
                    </div>
                </div>

                {/* Input Foto */}
                <label style={{fontSize:'13px', fontWeight:'600'}}>Foto Profil</label>
                <input 
                    type="file" 
                    accept="image/*" 
                    className="form-control" 
                    onChange={handleImageUpload}
                    style={{ padding: '8px', fontSize: '12px', marginBottom: '15px' }}
                />

                {/* Nama Lengkap */}
                <label style={{fontSize:'13px', fontWeight:'600'}}>Nama Lengkap *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Contoh: Muhammad Budi Santoso" 
                  required 
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  style={{ marginBottom: '15px' }} 
                />

                <div style={{ display: 'flex', gap: '15px' }}>
                    {/* Nama Panggilan */}
                    <div style={{ flex: 1 }}>
                        <label style={{fontSize:'13px', fontWeight:'600'}}>Nama Panggilan *</label>
                        <input 
                          type="text" 
                          className="form-control"
                          placeholder="Contoh: Budi" 
                          required 
                          value={formData.nickname}
                          onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                        />
                    </div>

                    {/* Dropdown Kelas */}
                    <div style={{ width: '100px' }}>
                        <label style={{fontSize:'13px', fontWeight:'600'}}>Kelas</label>
                        <select 
                            className="form-control"
                            value={formData.className}
                            onChange={(e) => setFormData({...formData, className: e.target.value})}
                        >
                            <option value="A">Kelas A</option>
                            <option value="B">Kelas B</option>
                        </select>
                    </div>
                </div>

              </div>
              
              <div className="modal-footer" style={{ marginTop: '25px' }}>
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;