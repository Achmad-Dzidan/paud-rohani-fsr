import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const Users = () => {
  const { toggleSidebar } = useOutletContext(); // Sidebar Mobile

  // STATE
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. REAL-TIME LISTENER (Pengganti Fetch biasa)
  // Data akan otomatis update tanpa refresh halaman
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    
    // onSnapshot akan terus "mendengar" perubahan di database
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      toast.error("Gagal memuat users: " + error.message);
      setLoading(false);
    });

    // Cleanup listener saat pindah halaman agar tidak memory leak
    return () => unsubscribe();
  }, []);

  // 2. ADD USER HANDLER
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "users"), {
        name: newName,
        createdAt: serverTimestamp()
      });
      toast.success("User berhasil ditambahkan!");
      
      // Reset & Tutup Modal
      setNewName('');
      setShowModal(false);
    } catch (error) {
      toast.error("Gagal menambah: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. DELETE USER HANDLER
  const handleDeleteUser = async (id, name) => {
    if (window.confirm(`Yakin ingin menghapus user "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "users", id));
        toast.success("User dihapus.");
      } catch (error) {
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  // Helper untuk format inisial (Misal: "Budi Santoso" -> "BS")
  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : "U";
  };

  // Helper Format Tanggal
  const formatDate = (timestamp) => {
    if (!timestamp) return "Baru saja";
    // Convert Firestore Timestamp ke JS Date
    return new Date(timestamp.seconds * 1000).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <div style={{ width: '100%' }}>
      
      {/* --- HEADER --- */}
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="page-title">
            <h1>User Management</h1>
          </div>
        </div>

        <button className="btn-add" onClick={() => setShowModal(true)}>
          <i className="fa-solid fa-user-plus"></i> Add User
        </button>
      </div>

      {/* --- GRID LIST USERS --- */}
      <div className="user-grid">
        {loading ? (
          <p style={{ color: 'var(--text-gray)' }}>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--text-gray)' }}>Belum ada user.</p>
        ) : (
          users.map((user) => (
            <div className="user-card" key={user.id}>
              <div className="user-info-wrapper">
                {/* Avatar statis biru */}
                <div className="avatar blue">
                  {getInitials(user.name)}
                </div>
                <div className="info">
                  <h3>{user.name}</h3>
                  <p>Added {formatDate(user.createdAt)}</p>
                </div>
              </div>
              <button 
                className="btn-delete" 
                onClick={() => handleDeleteUser(user.id, user.name)}
                title="Hapus User"
              >
                <i className="fa-regular fa-trash-can"></i>
              </button>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL ADD USER --- */}
      {showModal && (
        <div className="modal-overlay active" style={{display:'flex'}}>
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <h3>Add New User</h3>
                <p>Enter the name of the user you want to add.</p>
              </div>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <label>User Name *</label>
                <input 
                  type="text" 
                  placeholder="Enter full name" 
                  required 
                  autoComplete="off"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ marginBottom: '20px' }} // Fix spacing CSS
                />
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Add User'}
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