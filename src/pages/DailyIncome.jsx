import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // Pastikan path ini sesuai
import { toast } from 'sonner';

const DailyIncome = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE DATA ---
  const [transactions, setTransactions] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  
  // --- STATE UI & FILTER ---
  const [selectedDate, setSelectedDate] = useState('');
  const [activeCardId, setActiveCardId] = useState(null); 
  
  // --- STATE MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data edit
  const [editData, setEditData] = useState({
    id: '',
    userId: '',
    userName: '',
    amount: '',
    date: '',
    note: '',
    type: 'income'
  });

  // State Cache User untuk Foto
  const [userMap, setUserMap] = useState({}); 

  // 1. FETCH USERS (Untuk Foto & Nickname)
  useEffect(() => {
    const fetchUsers = async () => {
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            let uMap = {};
            usersSnap.forEach(doc => {
                // Simpan data user lengkap (termasuk photo)
                uMap[doc.id] = doc.data(); 
            });
            setUserMap(uMap);
        } catch (e) {
            console.error("Error fetching users:", e);
        }
    };
    fetchUsers();
  }, []);

  // 2. FETCH DATA TRANSAKSI
  useEffect(() => {
    const q = query(
      collection(db, "transactions"), 
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error("Gagal memuat data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. GROUPING LOGIC
  useEffect(() => {
    if (transactions.length === 0) {
      setGroupedData({});
      return;
    }
    let filtered = transactions;
    if (selectedDate) {
      filtered = transactions.filter(t => t.date === selectedDate);
    }
    const groups = filtered.reduce((acc, curr) => {
      const dateKey = curr.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(curr);
      return acc;
    }, {});
    setGroupedData(groups);
  }, [transactions, selectedDate]);


  // --- HANDLERS ---

  const handleCardClick = (id) => {
    if (activeCardId === id) return; 
    setActiveCardId(id);
  };

  const handleCancelAction = (e) => {
    e.stopPropagation();
    setActiveCardId(null);
  };

  const handleOpenEdit = (e, transaction) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditData({
      id: transaction.id,
      userId: transaction.userId,
      userName: transaction.userName,
      amount: transaction.amount / 1000, 
      date: transaction.date,
      note: transaction.note || '',
      type: transaction.type
    });
    setShowModal(true);
    setActiveCardId(null);
  };

  const handleOpenDelete = (e, transaction) => {
    e.stopPropagation();
    setModalMode('delete');
    setEditData(transaction);
    setShowModal(true);
    setActiveCardId(null);
  };

  // --- CRUD ---

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const docRef = doc(db, "transactions", editData.id);
      await updateDoc(docRef, {
        amount: parseInt(editData.amount) * 1000,
        date: editData.date,
        note: editData.note,
        updatedAt: serverTimestamp()
      });
      toast.success("Data berhasil diperbarui!");
      setShowModal(false);
    } catch (error) {
      toast.error("Gagal update: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "transactions", editData.id));
      toast.success("Data dihapus.");
      setShowModal(false);
    } catch (error) {
      toast.error("Gagal hapus: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- HELPERS ---
  const formatRupiah = (num) => "Rp " + new Intl.NumberFormat('id-ID').format(num);

  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "?";

  const formatDateHeader = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
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
            <h1>Daily Flow</h1>
            <p>Monitor Pemasukan & Pengeluaran</p>
          </div>
        </div>

        <div className="date-filter-wrapper">
            <input 
                type="date" 
                className="form-control"
                style={{ cursor: 'pointer', maxWidth: '180px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
            />
            {selectedDate && (
                <button 
                    onClick={() => setSelectedDate('')}
                    style={{ marginLeft:'8px', background:'none', border:'none', color:'var(--danger-red)', cursor:'pointer', fontSize:'12px' }}
                >
                    Clear
                </button>
            )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="daily-content">
        {loading ? (
            <p style={{ color: 'var(--text-gray)' }}>Loading data...</p>
        ) : Object.keys(groupedData).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)' }}>
                <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '32px', marginBottom: '10px' }}></i>
                <p>No records found.</p>
            </div>
        ) : (
            Object.keys(groupedData).map((dateKey) => (
                <div key={dateKey} style={{ marginBottom: '40px' }}>
                    
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)' }}>
                            {formatDateHeader(dateKey)}
                        </h3>
                        <div style={{ height: '1px', background: 'var(--border-color)', marginTop: '8px', width: '100%' }}></div>
                    </div>

                    <div className="user-grid">
                        {groupedData[dateKey].map((t) => {
                            const isExpense = t.type === 'expense';
                            // Ambil data user dari state userMap
                            const userPhoto = userMap[t.userId]?.photo;
                            const userNickname = userMap[t.userId]?.nickname || t.userName;
                            
                            return (
                                <div 
                                    className="user-card" 
                                    key={t.id} 
                                    style={{ 
                                        minHeight: 'auto', 
                                        cursor: 'pointer',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s',
                                        borderLeft: `4px solid ${isExpense ? 'var(--danger-red)' : 'var(--success-green)'}`
                                    }}
                                    onClick={() => handleCardClick(t.id)}
                                >
                                    {activeCardId === t.id ? (
                                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: '100%', height: '100%', animation: 'fadeIn 0.2s' }}>
                                            <button onClick={(e) => handleOpenEdit(e, t)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}>
                                                <i className="fa-solid fa-pen-to-square"></i>
                                            </button>
                                            <button onClick={(e) => handleOpenDelete(e, t)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}>
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                            <button onClick={handleCancelAction} style={{ background: '#9ca3af', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}>
                                                <i className="fa-solid fa-rotate-left"></i>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="user-info-wrapper">
                                                {/* LOGIKA TAMPILAN AVATAR UPDATE */}
                                                <div className="avatar" style={{ 
                                                    backgroundColor: userPhoto ? 'transparent' : (isExpense ? '#ef4444' : '#2563eb'),
                                                    backgroundImage: userPhoto ? `url(${userPhoto})` : 'none',
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                    border: '1px solid #e2e8f0',
                                                    color: userPhoto ? 'transparent' : 'white'
                                                }}>
                                                    {!userPhoto && getInitials(userNickname)}
                                                </div>
                                                
                                                <div className="info">
                                                    <h3>{userNickname}</h3>
                                                    <div style={{fontSize:'11px', color: isExpense ? 'var(--danger-red)' : 'var(--success-green)', fontWeight:'600', textTransform:'uppercase'}}>
                                                        {isExpense ? 'Expense' : 'Income'}
                                                    </div>
                                                    {t.note && <p style={{fontSize:'11px', fontStyle:'italic', color:'#64748b'}}>"{t.note}"</p>}
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: '700', color: isExpense ? 'var(--danger-red)' : 'var(--success-green)', fontSize: '15px' }}>
                                                {isExpense ? '-' : '+'}{formatRupiah(t.amount)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                </div>
            ))
        )}
      </div>

      {/* --- MODAL --- */}
      {showModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{modalMode === 'edit' ? 'Edit Transaction' : 'Delete Transaction'}</h3>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            {modalMode === 'edit' ? (
              <form onSubmit={handleSaveEdit}>
                <div className="modal-body">
                   <p style={{marginBottom:'15px', fontWeight:'600'}}>User: {editData.userName}</p>
                   
                   <div style={{
                       display:'inline-block', 
                       padding:'4px 8px', 
                       borderRadius:'4px', 
                       fontSize:'12px', 
                       fontWeight:'bold', 
                       marginBottom:'15px',
                       backgroundColor: editData.type === 'expense' ? '#fee2e2' : '#dcfce7',
                       color: editData.type === 'expense' ? '#991b1b' : '#166534'
                   }}>
                       {editData.type === 'expense' ? 'Substract Income (Expense)' : 'Add Income'}
                   </div>

                   <label style={{display:'block', marginBottom:'5px', fontSize:'13px'}}>Amount (Dalam Ribuan)</label>
                   <input 
                      type="number" 
                      className="form-control" 
                      style={{marginBottom:'15px'}}
                      value={editData.amount}
                      onChange={(e) => setEditData({...editData, amount: e.target.value})}
                      required
                   />

                   <label style={{display:'block', marginBottom:'5px', fontSize:'13px'}}>Date</label>
                   <input 
                      type="date" 
                      className="form-control"
                      style={{marginBottom:'15px'}} 
                      value={editData.date}
                      onChange={(e) => setEditData({...editData, date: e.target.value})}
                      required
                   />

                   <label style={{display:'block', marginBottom:'5px', fontSize:'13px'}}>Note</label>
                   <textarea 
                      className="form-control"
                      value={editData.note}
                      onChange={(e) => setEditData({...editData, note: e.target.value})}
                   ></textarea>
                </div>
                <div className="modal-footer">
                   <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                   <button type="submit" className="btn-save" disabled={isProcessing}>
                     {isProcessing ? 'Saving...' : 'Save Changes'}
                   </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="modal-body">
                   <p>Yakin ingin menghapus data <b>{editData.type === 'expense' ? 'pengeluaran' : 'pemasukan'}</b> dari <b>{editData.userName}</b> sebesar <b>{formatRupiah(editData.amount)}</b>?</p>
                   <p style={{fontSize:'12px', color:'red', marginTop:'10px'}}>Tindakan ini tidak dapat dibatalkan.</p>
                </div>
                <div className="modal-footer">
                   <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                   <button 
                      className="btn-save" 
                      style={{backgroundColor:'var(--danger-red)'}} 
                      onClick={handleConfirmDelete}
                      disabled={isProcessing}
                   >
                     {isProcessing ? 'Deleting...' : 'Delete Permanently'}
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default DailyIncome;