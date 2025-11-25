import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const DailyIncome = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE DATA ---
  const [transactions, setTransactions] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  
  // --- STATE UI & FILTER ---
  const [selectedDate, setSelectedDate] = useState('');
  const [activeCardId, setActiveCardId] = useState(null); // ID kartu yang sedang di-tap (menampilkan menu)
  
  // --- STATE MODAL (EDIT/DELETE) ---
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('edit'); // 'edit' atau 'delete'
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data sementara untuk diedit/dihapus
  const [editData, setEditData] = useState({
    id: '',
    userId: '',
    userName: '',
    amount: '',
    date: '',
    note: ''
  });

  // 1. FETCH DATA
  useEffect(() => {
    const q = query(
      collection(db, "transactions"), 
      where("type", "==", "income"), 
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
      toast.error("Gagal memuat data income.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. GROUPING LOGIC
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


  // --- HANDLERS INTERAKSI KARTU ---

  // Saat kartu di-tap
  const handleCardClick = (id) => {
    if (activeCardId === id) {
      // Jika sudah aktif, jangan lakukan apa-apa (biarkan user memilih ikon)
      return; 
    }
    setActiveCardId(id);
  };

  // Tombol Kembali (Batalkan mode edit di kartu)
  const handleCancelAction = (e) => {
    e.stopPropagation(); // Mencegah event bubbling ke card click
    setActiveCardId(null);
  };

  // Tombol Buka Modal Edit
  const handleOpenEdit = (e, transaction) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditData({
      id: transaction.id,
      userId: transaction.userId,
      userName: transaction.userName,
      amount: transaction.amount,
      date: transaction.date,
      note: transaction.note || ''
    });
    setShowModal(true);
    setActiveCardId(null); // Tutup menu kartu
  };

  // Tombol Buka Modal Delete
  const handleOpenDelete = (e, transaction) => {
    e.stopPropagation();
    setModalMode('delete');
    setEditData(transaction); // Kita butuh ID dan Nama untuk konfirmasi
    setShowModal(true);
    setActiveCardId(null);
  };

  // --- HANDLERS FIREBASE CRUD ---

  // Simpan Perubahan (Edit)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const docRef = doc(db, "transactions", editData.id);
      await updateDoc(docRef, {
        amount: parseInt(editData.amount),
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

  // Hapus Data
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

  // Format Tanggal Header: dd/mm/yyyy
  const formatDateHeader = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`; // Sesuai request
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
            <h1>Daily Income</h1>
            <p>Klik user untuk Edit/Hapus</p>
          </div>
        </div>

        {/* INPUT TANGGAL */}
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
            // LOOP TANGGAL
            Object.keys(groupedData).map((dateKey) => (
                <div key={dateKey} style={{ marginBottom: '40px' }}>
                    
                    {/* Header Tanggal dd/mm/yyyy */}
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)' }}>
                            {formatDateHeader(dateKey)}
                        </h3>
                        <div style={{ height: '1px', background: 'var(--border-color)', marginTop: '8px', width: '100%' }}></div>
                    </div>

                    {/* LOOP USER CARDS */}
                    <div className="user-grid">
                        {groupedData[dateKey].map((t) => (
                            <div 
                                className="user-card" 
                                key={t.id} 
                                style={{ 
                                    minHeight: 'auto', 
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s'
                                }}
                                onClick={() => handleCardClick(t.id)}
                            >
                                {/* KONDISI: JIKA KARTU INI AKTIF (DI-TAP) */}
                                {activeCardId === t.id ? (
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-around', 
                                        alignItems: 'center', 
                                        width: '100%', 
                                        height: '100%',
                                        animation: 'fadeIn 0.2s' 
                                    }}>
                                        {/* Tombol EDIT */}
                                        <button 
                                            onClick={(e) => handleOpenEdit(e, t)}
                                            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}
                                        >
                                            <i className="fa-solid fa-pen-to-square"></i>
                                        </button>

                                        {/* Tombol HAPUS */}
                                        <button 
                                            onClick={(e) => handleOpenDelete(e, t)}
                                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}
                                        >
                                            <i className="fa-solid fa-trash-can"></i>
                                        </button>

                                        {/* Tombol KEMBALI */}
                                        <button 
                                            onClick={handleCancelAction}
                                            style={{ background: '#9ca3af', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', cursor:'pointer' }}
                                        >
                                            <i className="fa-solid fa-rotate-left"></i>
                                        </button>
                                    </div>
                                ) : (
                                    /* TAMPILAN NORMAL */
                                    <>
                                        <div className="user-info-wrapper">
                                            <div className="avatar blue">
                                                {t.userName ? t.userName.substring(0, 2).toUpperCase() : "?"}
                                            </div>
                                            <div className="info">
                                                <h3>{t.userName}</h3>
                                                {t.note && <p style={{fontSize:'11px', fontStyle:'italic'}}>"{t.note}"</p>}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: '700', color: 'var(--success-green)', fontSize: '15px' }}>
                                            +{formatRupiah(t.amount)}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            ))
        )}
      </div>

      {/* --- MODAL EDIT & DELETE --- */}
      {showModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }}>
          <div className="modal-box">
            
            {/* HEADER MODAL */}
            <div className="modal-header">
              <h3>{modalMode === 'edit' ? 'Edit Income' : 'Delete Income'}</h3>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            {/* BODY MODAL */}
            {modalMode === 'edit' ? (
              // --- FORM EDIT ---
              <form onSubmit={handleSaveEdit}>
                <div className="modal-body">
                   <p style={{marginBottom:'15px', fontWeight:'600'}}>User: {editData.userName}</p>

                   <label style={{display:'block', marginBottom:'5px', fontSize:'13px'}}>Amount (Rp)</label>
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
              // --- KONFIRMASI DELETE ---
              <div>
                <div className="modal-body">
                   <p>Apakah Anda yakin ingin menghapus data income dari <b>{editData.userName}</b> sebesar <b>{formatRupiah(editData.amount)}</b>?</p>
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