import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // Untuk tombol sidebar mobile
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Sesuaikan path jika berbeda
import { toast } from 'sonner';

const Income = () => {
  // 1. Ambil fungsi toggleSidebar dari Layout
  const { toggleSidebar } = useOutletContext();

  // 2. STATE MANAGEMENT
  const [users, setUsers] = useState([]); // Menyimpan list user dari DB
  const [type, setType] = useState('income'); // 'income' atau 'expense'
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false); // Kontrol Modal

  // State Form
  const [formData, setFormData] = useState({
    userId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0], // Default hari ini (YYYY-MM-DD)
    note: ''
  });

  // 3. FETCH USERS SAAT LOAD
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setUsers(usersList);
      } catch (error) {
        toast.error("Gagal memuat data user");
        console.error(error);
      }
    };
    fetchUsers();
  }, []);

  // 4. HANDLERS
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (selectedType) => {
    setType(selectedType);
  };

  // Saat tombol "Add/Subtract" diklik (Buka Modal)
  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!formData.userId || !formData.amount || !formData.date) {
      toast.error("Mohon lengkapi data wajib (*)");
      return;
    }
    setShowModal(true); // Tampilkan modal konfirmasi
  };

  // Saat tombol "Confirm" di Modal diklik (Simpan ke Firebase)
  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      // Cari nama user berdasarkan ID yang dipilih
      const selectedUserObj = users.find(u => u.id === formData.userId);
      const userName = selectedUserObj ? selectedUserObj.name : 'Unknown';

      // Simpan ke Firestore
      await addDoc(collection(db, "transactions"), {
        userId: formData.userId,
        userName: userName,
        amount: parseInt(formData.amount) * 1000,        
        date: formData.date,
        note: formData.note,
        type: type, // 'income' atau 'expense'
        createdAt: serverTimestamp()
      });

      toast.success("Transaksi berhasil disimpan!");
      
      // Reset Form & Tutup Modal
      setShowModal(false);
      setFormData({
        userId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
      });

    } catch (error) {
      toast.error("Gagal menyimpan: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper untuk mendapatkan nama user yang sedang dipilih (untuk tampilan Modal)
  const getSelectedUserName = () => {
    const user = users.find(u => u.id === formData.userId);
    return user ? user.name : '-';
  };

  return (
    <div style={{ width: '100%' }}>
      
      {/* --- HEADER --- */}
      <div className="centered-header">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div>
            <h1>Income Management</h1>
            <p>Add or subtract income for users</p>
          </div>
        </div>
      </div>

      {/* --- FORM CARD --- */}
      <div className="form-card">
        {/* Toggle Income/Expense */}
        <div className="toggle-container">
          <button 
            type="button"
            className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} 
            onClick={() => handleTypeChange('income')}
          >
            <i className="fa-solid fa-plus"></i> Add Income
          </button>
          <button 
            type="button"
            className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} 
            onClick={() => handleTypeChange('expense')}
          >
            <i className="fa-solid fa-minus"></i> Subtract Income
          </button>
        </div>

        <form onSubmit={handlePreSubmit}>
          <div className="form-group">
            <label className="form-label">Select User *</label>
            <select 
              name="userId"
              className="form-control" 
              required
              value={formData.userId}
              onChange={handleInputChange}
            >
              <option value="" disabled>Choose a user</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
                Amount (Dalam Ribuan) * <br/>
                <span style={{fontSize:'11px', color:'#64748b', fontWeight:'normal'}}>
                    Contoh: Ketik <b>20</b> untuk Rp 20.000
                </span>
            </label>
            <div style={{position:'relative'}}>
                <input 
                  type="number" 
                  name="amount"
                  className="form-control" 
                  placeholder="0" 
                  required 
                  min="1"
                  value={formData.amount}
                  onChange={handleInputChange}
                />
                {/* Helper Visual agar user tahu hasilnya */}
                {formData.amount && (
                    <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>
                        = Rp {(parseInt(formData.amount) * 1000).toLocaleString('id-ID')}
                    </div>
                )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Date *</label>
            <input 
              type="date" 
              name="date"
              className="form-control" 
              required
              value={formData.date}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <textarea 
              name="note"
              className="form-control" 
              placeholder="Add any notes about this transaction"
              value={formData.note}
              onChange={handleInputChange}
            ></textarea>
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            style={{ 
              backgroundColor: type === 'income' ? 'var(--success-green)' : 'var(--danger-red)' 
            }}
          >
            {type === 'income' ? 'Add Income' : 'Subtract Income'}
          </button>
        </form>
      </div>

      {/* --- MODAL KONFIRMASI (Conditional Rendering) --- */}
      {showModal && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup-box">
            <h3>Confirm Transaction</h3>
            <p>Please review the details:</p>
            
            <div className="popup-details">
              <p><strong>User:</strong> <span>{getSelectedUserName()}</span></p>
              <p><strong>Amount:</strong> Rp <span>{parseInt(formData.amount).toLocaleString('id-ID')}</span></p>
              <p><strong>Date:</strong> <span>{formData.date}</span></p>
              <p><strong>Type:</strong> <span style={{ textTransform: 'capitalize', fontWeight:'bold', color: type==='income'?'green':'red' }}>{type}</span></p>
            </div>

            <div className="popup-actions">
              <button 
                className="cancel-btn" 
                onClick={() => setShowModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn" 
                onClick={handleFinalSubmit}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Income;