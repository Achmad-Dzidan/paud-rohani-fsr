import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const DailyIncome = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE DATA ---
  const [transactions, setTransactions] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [userMap, setUserMap] = useState({}); 
  const [attendanceMap, setAttendanceMap] = useState({});

  // --- STATE UI ---
  const [selectedDate, setSelectedDate] = useState('');
  const [activeCardId, setActiveCardId] = useState(null); 
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [editData, setEditData] = useState({
    id: '', userId: '', userName: '', amount: '', date: '', note: '', type: 'income', isCheckpoint: false
  });

  // 1. FETCH USERS
  useEffect(() => {
    const fetchUsers = async () => {
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            let uMap = {};
            usersSnap.forEach(doc => { uMap[doc.id] = doc.data(); });
            setUserMap(uMap);
        } catch (e) { console.error(e); }
    };
    fetchUsers();
  }, []);

  // 2. FETCH TRANSACTIONS
  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "desc"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
      setLoading(false);
    }, (error) => { toast.error("Gagal memuat data."); setLoading(false); });
    return () => unsubscribe();
  }, []);

  // 3. FETCH ATTENDANCE
  useEffect(() => {
    const q = query(collection(db, "attendance"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        let attMap = {};
        snapshot.docs.forEach(doc => {
            const date = doc.id; 
            const records = doc.data().records || {};
            const hCount = Object.values(records).filter(status => status === 'H').length;
            attMap[date] = hCount;
        });
        setAttendanceMap(attMap);
    });
    return () => unsubscribe();
  }, []);

  // 4. GROUPING LOGIC
  useEffect(() => {
    if (transactions.length === 0) { setGroupedData({}); return; }
    let filtered = transactions;
    if (selectedDate) { filtered = transactions.filter(t => t.date === selectedDate); }
    
    const groups = filtered.reduce((acc, curr) => {
      const dateKey = curr.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(curr);
      return acc;
    }, {});
    setGroupedData(groups);
  }, [transactions, selectedDate]);


  // --- HANDLERS ---
  const handleCardClick = (id) => { if (activeCardId !== id) setActiveCardId(id); };
  const handleCancelAction = (e) => { e.stopPropagation(); setActiveCardId(null); };

  const handleOpenEdit = (e, transaction) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditData({
      id: transaction.id, userId: transaction.userId, userName: transaction.userName,
      amount: transaction.amount / 1000, date: transaction.date, note: transaction.note || '',
      type: transaction.type, isCheckpoint: transaction.isCheckpoint || false
    });
    setShowModal(true); setActiveCardId(null);
  };

  const handleOpenDelete = (e, transaction) => {
    e.stopPropagation();
    setModalMode('delete');
    setEditData(transaction);
    setShowModal(true); setActiveCardId(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      const docRef = doc(db, "transactions", editData.id);
      await updateDoc(docRef, {
        amount: parseInt(editData.amount) * 1000, date: editData.date, note: editData.note,
        isCheckpoint: editData.isCheckpoint, updatedAt: serverTimestamp()
      });
      toast.success("Data diperbarui!"); setShowModal(false);
    } catch (error) { toast.error(error.message); } finally { setIsProcessing(false); }
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "transactions", editData.id));
      toast.success("Data dihapus."); setShowModal(false);
    } catch (error) { toast.error(error.message); } finally { setIsProcessing(false); }
  };

  // --- HELPERS ---
  const formatRupiah = (num) => {
      // Intl.NumberFormat otomatis menangani minus (-Rp 20.000)
      return new Intl.NumberFormat('id-ID', { 
          style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
      }).format(num);
  };

  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "?";
  
  const formatDateHeader = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };
  
  const formatDateDisplay = (isoDate) => {
    if (!isoDate) return "Semua Tanggal"; 
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div style={{ width: '100%' }}>
      
      {/* HEADER */}
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div className="page-title">
            <h1>Daily Flow</h1>
            <p>Monitor Pemasukan & Pengeluaran</p>
          </div>
        </div>
        <div className="date-filter-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <div className="form-control" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer', background: 'white', width: '160px', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <span style={{ fontWeight: '600', color: selectedDate ? '#334155' : '#94a3b8', fontSize:'13px' }}>{formatDateDisplay(selectedDate)}</span>
                    <i className="fa-regular fa-calendar" style={{ color: '#64748b' }}></i>
                </div>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
            </div>
            {selectedDate && <button onClick={() => setSelectedDate('')} style={{ marginLeft:'8px', background:'none', border:'none', color:'var(--danger-red)', cursor:'pointer', fontSize:'12px' }}>Clear</button>}
        </div>
      </div>

      {/* CONTENT */}
      <div className="daily-content">
        {loading ? <p style={{ color: 'var(--text-gray)' }}>Loading data...</p> : Object.keys(groupedData).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)' }}>
                <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '32px', marginBottom: '10px' }}></i>
                <p>No records found.</p>
            </div>
        ) : (
            Object.keys(groupedData).map((dateKey) => {
                
                // --- LOGIKA PERHITUNGAN BARU (NET TOTAL) ---
                
                // 1. SAVINGS: Total Income - Total Expense (Hanya Student)
                const dailySavings = groupedData[dateKey]
                    .filter(t => !t.isCheckpoint && t.userId !== 'other')
                    .reduce((sum, t) => {
                        return t.type === 'income' ? sum + t.amount : sum - t.amount;
                    }, 0);

                // 2. OTHER: Total Income - Total Expense (Hanya Other)
                const dailyOther = groupedData[dateKey]
                    .filter(t => t.userId === 'other')
                    .reduce((sum, t) => {
                        return t.type === 'income' ? sum + t.amount : sum - t.amount;
                    }, 0);

                // 3. FEE: Absensi
                const hadirCount = attendanceMap[dateKey] || 0;
                const feeTotal = hadirCount * 6000;

                return (
                    <div key={dateKey} style={{ marginBottom: '40px' }}>
                        
                        {/* HEADER TANGGAL & STATISTIK HARIAN */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px'}}>
                                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)', margin:0 }}>
                                    {formatDateHeader(dateKey)}
                                </h3>

                                <div style={{display:'flex', gap:'10px', fontSize:'12px', flexWrap:'wrap'}}>
                                    
                                    {/* SAVINGS (Net) */}
                                    <div style={{
                                        display:'flex', alignItems:'center', gap:'6px', 
                                        background:'#eff6ff', padding:'4px 10px', borderRadius:'20px',
                                        color:'var(--primary-blue)', border:'1px solid #dbeafe'
                                    }}>
                                        <i className="fa-solid fa-piggy-bank"></i>
                                        <span style={{fontWeight:'600'}}>Sav: {formatRupiah(dailySavings)}</span>
                                    </div>

                                    {/* FEE (Hijau Muda) */}
                                    <div style={{
                                        display:'flex', alignItems:'center', gap:'6px', 
                                        background:'#f0fdf4', padding:'4px 10px', borderRadius:'20px',
                                        color:'#166534', border:'1px solid #bbf7d0'
                                    }}>
                                        <i className="fa-solid fa-school"></i>
                                        <span style={{fontWeight:'600'}}>Fee: {formatRupiah(feeTotal)}</span>
                                    </div>

                                    {/* OTHER (Net) */}
                                    <div style={{
                                        display:'flex', alignItems:'center', gap:'6px', 
                                        background:'#fffbeb', padding:'4px 10px', borderRadius:'20px',
                                        color:'#b45309', border:'1px solid #fcd34d'
                                    }}>
                                        <i className="fa-solid fa-cash-register"></i>
                                        <span style={{fontWeight:'600'}}>Oth: {formatRupiah(dailyOther)}</span>
                                    </div>

                                </div>
                            </div>
                            <div style={{ height: '1px', background: 'var(--border-color)', marginTop: '8px', width: '100%' }}></div>
                        </div>

                        {/* GRID USER */}
                        <div className="user-grid">
                          {groupedData[dateKey].map((t) => {
                              const isExpense = t.type === 'expense';
                              const isOther = t.userId === 'other';
                              const userPhoto = !isOther ? userMap[t.userId]?.photo : null;
                              const displayName = isOther ? (t.note || "Other") : (userMap[t.userId]?.nickname || t.userName);
                              
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
                                          borderLeft: `4px solid ${isExpense ? 'var(--danger-red)' : 'var(--success-green)'}`,
                                          opacity: t.isCheckpoint ? 0.7 : 1,
                                          // Pastikan layout card menggunakan Flexbox yang rapi
                                          display: 'flex',
                                          alignItems: 'center', // Vertikal tengah
                                          justifyContent: 'space-between', // Kiri dan Kanan mentok
                                          padding: '12px' // Padding agar tidak mepet
                                      }}
                                      onClick={() => handleCardClick(t.id)}
                                  >
                                      {t.isCheckpoint && (
                                          <div style={{position:'absolute', top:0, right:0, fontSize:'9px', background:'#e2e8f0', padding:'2px 6px', borderBottomLeftRadius:'4px', color:'#64748b'}}>
                                              Checkpoint
                                          </div>
                                      )}

                                      {activeCardId === t.id ? (
                                          // --- TAMPILAN MENU (EDIT/DELETE) ---
                                          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: '100%', height: '100%', animation: 'fadeIn 0.2s' }}>
                                              <button onClick={(e) => handleOpenEdit(e, t)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}><i className="fa-solid fa-pen-to-square"></i></button>
                                              <button onClick={(e) => handleOpenDelete(e, t)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}><i className="fa-solid fa-trash-can"></i></button>
                                              <button onClick={handleCancelAction} style={{ background: '#9ca3af', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}><i className="fa-solid fa-rotate-left"></i></button>
                                          </div>
                                      ) : (
                                          // --- TAMPILAN INFO NORMAL ---
                                          <>
                                              {/* Wrapper Kiri: Avatar + Teks */}
                                              <div style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: '12px', 
                                                  flex: 1, // Mengambil sisa ruang yang ada
                                                  minWidth: 0 // PENTING: Agar text truncation berfungsi di flexbox
                                              }}>
                                                  
                                                  {/* 1. AVATAR (FIX BULAT) */}
                                                  <div className="avatar" style={{ 
                                                      backgroundColor: userPhoto ? 'transparent' : (isOther ? '#f59e0b' : (isExpense ? '#ef4444' : '#2563eb')),
                                                      backgroundImage: userPhoto ? `url(${userPhoto})` : 'none',
                                                      backgroundSize: 'cover',
                                                      backgroundPosition: 'center',
                                                      border: '1px solid #e2e8f0',
                                                      color: userPhoto ? 'transparent' : 'white',
                                                      // --- PERBAIKAN CSS AVATAR ---
                                                      width: '48px',      // Lebar fix
                                                      height: '48px',     // Tinggi fix
                                                      minWidth: '48px',   // Jangan pernah mengecil (squish)
                                                      flexShrink: 0,      // Jangan mau ditekan oleh elemen lain
                                                      borderRadius: '50%', // Bulat sempurna
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      fontSize: '16px',
                                                      fontWeight: 'bold'
                                                  }}>
                                                      {!userPhoto && (isOther ? <i className="fa-solid fa-school"></i> : getInitials(displayName))}
                                                  </div>
                                                  
                                                  {/* 2. TEXT INFO */}
                                                  <div className="info" style={{ minWidth: 0 }}> {/* minWidth 0 agar text-overflow jalan */}
                                                      <h3 style={{ 
                                                          display: '-webkit-box',
                                                          WebkitLineClamp: 2, // Maksimal 2 baris
                                                          WebkitBoxOrient: 'vertical',
                                                          overflow: 'hidden',
                                                          fontSize: '14px',
                                                          fontWeight: '600',
                                                          lineHeight: '1.3', // Spasi antar baris teks
                                                          margin: 0,
                                                          wordBreak: 'break-word' // Potong kata jika terlalu panjang
                                                      }}>
                                                          {displayName}
                                                      </h3>
                                                      
                                                      <div style={{
                                                          fontSize:'11px', 
                                                          color: isExpense ? 'var(--danger-red)' : 'var(--success-green)', 
                                                          fontWeight:'700', 
                                                          textTransform:'uppercase',
                                                          marginTop: '2px'
                                                      }}>
                                                          {isOther ? 'Operational' : (isExpense ? 'Expense' : 'Income')}
                                                      </div>
                                                      
                                                      {!isOther && t.note && (
                                                          <p style={{
                                                              fontSize:'11px', 
                                                              fontStyle:'italic', 
                                                              color:'#64748b', 
                                                              margin: '2px 0 0 0',
                                                              whiteSpace: 'nowrap',
                                                              overflow: 'hidden',
                                                              textOverflow: 'ellipsis'
                                                          }}>
                                                              "{t.note}"
                                                          </p>
                                                      )}
                                                  </div>
                                              </div>

                                              {/* 3. HARGA (KANAN) */}
                                              <div style={{ 
                                                  fontWeight: '700', 
                                                  color: isExpense ? 'var(--danger-red)' : 'var(--success-green)', 
                                                  fontSize: '15px',
                                                  // --- PERBAIKAN CSS HARGA ---
                                                  whiteSpace: 'nowrap', // PENTING: Agar tanda (-) dan angka tidak pisah baris
                                                  marginLeft: '10px',   // Jarak aman dari teks
                                                  flexShrink: 0         // Jangan mau mengecil
                                              }}>
                                                  {isExpense ? '-' : '+'}{formatRupiah(t.amount)}
                                              </div>
                                          </>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                    </div>
                )
            })
        )}
      </div>

      {/* MODAL */}
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
                   <div style={{ display:'inline-block', padding:'4px 8px', borderRadius:'4px', fontSize:'12px', fontWeight:'bold', marginBottom:'15px', backgroundColor: editData.type === 'expense' ? '#fee2e2' : '#dcfce7', color: editData.type === 'expense' ? '#991b1b' : '#166534' }}>{editData.type === 'expense' ? 'Substract Income (Expense)' : 'Add Income'}</div>
                   <label style={{display:'block', marginBottom:'5px', fontSize:'13px'}}>Amount (Dalam Ribuan)</label>
                   <input type="number" className="form-control" style={{marginBottom:'15px'}} value={editData.amount} onChange={(e) => setEditData({...editData, amount: e.target.value})} required />
                   <label style={{display:'block', marginBottom:'5px', fontSize:'13px'}}>Date</label>
                   <input type="date" className="form-control" style={{marginBottom:'15px'}} value={editData.date} onChange={(e) => setEditData({...editData, date: e.target.value})} required />
                   <label style={{display:'block', marginBottom:'5px', fontSize:'13px'}}>Note</label>
                   <textarea className="form-control" value={editData.note} onChange={(e) => setEditData({...editData, note: e.target.value})} style={{marginBottom:'15px'}}></textarea>
                   <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'start', gap: '10px' }}>
                       <input type="checkbox" id="checkpointCheck" checked={editData.isCheckpoint} onChange={(e) => setEditData({...editData, isCheckpoint: e.target.checked})} style={{ marginTop: '3px', cursor:'pointer' }} />
                       <div>
                           <label htmlFor="checkpointCheck" style={{ fontSize: '13px', fontWeight: '600', cursor:'pointer' }}>Jadikan Checkpoint (Saldo Awal)</label>
                           <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Nilai ini dihitung sebagai saldo tapi <b>TIDAK AKAN</b> muncul di grafik harian.</p>
                       </div>
                   </div>
                </div>
                <div className="modal-footer">
                   <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                   <button type="submit" className="btn-save" disabled={isProcessing}>{isProcessing ? 'Saving...' : 'Save Changes'}</button>
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
                   <button className="btn-save" style={{backgroundColor:'var(--danger-red)'}} onClick={handleConfirmDelete} disabled={isProcessing}>{isProcessing ? 'Deleting...' : 'Delete Permanently'}</button>
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