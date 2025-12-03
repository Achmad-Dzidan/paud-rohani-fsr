import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const EventTransactions = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE ---
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  
  const [type, setType] = useState('income'); // income (Tunai) / expense (Potong Tabungan)
  const [loading, setLoading] = useState(false);
  
  // State untuk Filter Dropdown
  const [paidStudentIds, setPaidStudentIds] = useState(new Set());

  // Modal Konfirmasi & Add Event
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // State Perhitungan untuk Modal
  const [calculation, setCalculation] = useState({
    currentBalance: 0,
    eventPrice: 0,
    fee: 0,
    totalDeduction: 0
  });

  // Form Transaksi
  const [formData, setFormData] = useState({
    userId: '',
    eventId: '',
    eventName: '', 
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Form Tambah Event Baru
  const [newEvent, setNewEvent] = useState({ name: '', price: '' });

  // 1. FETCH USERS & EVENTS
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Get Users
        const usersSnap = await getDocs(collection(db, "users"));
        const usersList = usersSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        setUsers(usersList);

        // Get Events (Realtime)
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const evList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(evList);
        });
        return () => unsubscribe();
      } catch (error) {
        console.error(error);
      }
    };
    fetchInitialData();
  }, []);

  // 2. CEK SIAPA YANG SUDAH BAYAR (Untuk Filter Dropdown)
  useEffect(() => {
      if (!formData.eventId) return;

      const checkPaidStatus = async () => {
          // Cari transaksi dengan eventId yang sama
          const q = query(
              collection(db, "transactions"), 
              where("category", "==", "event"),
              where("eventId", "==", formData.eventId)
          );
          
          const snapshot = await getDocs(q);
          const paidIds = new Set();
          
          snapshot.forEach(doc => {
              const data = doc.data();
              
              // Jika Expense (Potong Tabungan), ID siswa ada di userId
              if (data.type === 'expense') {
                  paidIds.add(data.userId);
              } 
              // Jika Income (Tunai), ID siswa mungkin tersimpan di field khusus 'studentIdRef' atau kita parsing dari Note (tapi lebih aman simpan ref)
              // *PERBAIKAN*: Di handleFinalSubmit nanti kita akan simpan studentIdRef agar bisa dilacak
              else if (data.studentIdRef) {
                  paidIds.add(data.studentIdRef);
              }
          });
          
          setPaidStudentIds(paidIds);
      };

      checkPaidStatus();
  }, [formData.eventId]); // Jalankan ulang saat Event berubah

  // --- HANDLERS ---

  const handleEventChange = (e) => {
      const selectedId = e.target.value;
      const selectedEvent = events.find(ev => ev.id === selectedId);
      
      if (selectedEvent) {
          setFormData(prev => ({
              ...prev,
              eventId: selectedId,
              eventName: selectedEvent.name,
              amount: selectedEvent.price / 1000
          }));
      }
  };

  const handleAddEvent = async (e) => {
      e.preventDefault();
      if(!newEvent.name || !newEvent.price) return;
      try {
          await addDoc(collection(db, "events"), {
              name: newEvent.name,
              price: parseInt(newEvent.price),
              createdAt: serverTimestamp()
          });
          toast.success("Event baru ditambahkan!");
          setShowEventModal(false);
          setNewEvent({ name: '', price: '' });
      } catch (error) {
          toast.error("Gagal tambah event");
      }
  };

  const getUserBalance = async (userId) => {
    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    let bal = 0;
    snapshot.forEach(doc => {
        const t = doc.data();
        if (t.type === 'income') bal += t.amount;
        else if (t.type === 'expense') bal -= t.amount;
    });
    return bal;
  };

  const handlePreSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId || !formData.eventId || !formData.amount) {
      toast.error("Mohon lengkapi data (*)");
      return;
    }

    const currentBal = await getUserBalance(formData.userId);
    const realPrice = parseInt(formData.amount) * 1000;
    
    let adminFee = 0;
    let totalCut = realPrice;

    if (type === 'expense') {
        adminFee = realPrice * 0.10; 
        totalCut = realPrice + adminFee;
    }

    setCalculation({
        currentBalance: currentBal,
        eventPrice: realPrice,
        fee: adminFee,
        totalDeduction: totalCut
    });

    setShowConfirmModal(true);
  };

  // Final Submit (MODIFIED)
  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const selectedUser = users.find(u => u.id === formData.userId);
      const userName = selectedUser ? selectedUser.name : 'Unknown';
      
      let finalUserId = formData.userId;
      let finalUserName = userName;
      let finalNote = `[Event] ${formData.eventName}`;
      let finalAmount = calculation.eventPrice; // Default Amount

      // LOGIKA UTAMA
      if (type === 'income') {
          // --- CASH (TUNAI) ---
          // Simpan sebagai 'other' agar tidak masuk savings siswa
          finalUserId = 'other';
          finalUserName = 'Other Transaction'; 
          
          // Catat nama siswa di Note agar admin tahu
          finalNote += ` (Tunai oleh: ${userName})`;
          
          // Amount tetap harga event (pemasukan sekolah)
          finalAmount = calculation.eventPrice;

      } else {
          // --- EXPENSE (TABUNGAN) ---
          // Simpan dengan ID Siswa agar saldo terpotong
          finalUserId = formData.userId; // Tetap ID Siswa
          
          // Tambahkan info fee di note
          const priceStr = calculation.eventPrice.toLocaleString('id-ID');
          const feeStr = calculation.fee.toLocaleString('id-ID');
          finalNote += ` (Potong Tabungan: Rp ${priceStr} + Adm: Rp ${feeStr})`;
          
          // Amount adalah Total (Harga + Fee)
          finalAmount = calculation.totalDeduction;
      }

      await addDoc(collection(db, "transactions"), {
        userId: finalUserId,
        userName: finalUserName,
        
        // Field baru: Referensi Siswa Asli (PENTING UNTUK FILTER)
        // Walaupun userId='other', kita tetap tahu ini bayaran siapa
        studentIdRef: formData.userId, 

        amount: finalAmount,
        date: formData.date,
        note: finalNote,
        
        type: type, 
        category: 'event',
        eventId: formData.eventId,
        isCheckpoint: false,
        createdAt: serverTimestamp()
      });

      toast.success("Transaksi event berhasil!");
      setShowConfirmModal(false);
      
      // Update Filter Lokal (Agar nama hilang dari dropdown instan)
      setPaidStudentIds(prev => new Set(prev).add(formData.userId));
      
      setFormData(prev => ({ ...prev, userId: '' }));

    } catch (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => n.toLocaleString('id-ID');
  const formatRupiah = (num) => "Rp " + new Intl.NumberFormat('id-ID').format(num);

  // Filter User yang belum bayar
  const availableUsers = users.filter(u => !paidStudentIds.has(u.id));

  return (
    <div style={{ width: '100%' }}>
      
      {/* HEADER */}
      <div className="centered-header">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div>
            <h1>Event Transactions</h1>
            <p>Pembayaran kegiatan sekolah</p>
          </div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="form-card">
        <div className="toggle-container">
          <button type="button" className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => setType('income')}>
            <i className="fa-solid fa-money-bill-wave"></i> Pay Cash (Tunai)
          </button>
          <button type="button" className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => setType('expense')}>
            <i className="fa-solid fa-piggy-bank"></i> Pay w/ Savings (Potong)
          </button>
        </div>

        <form onSubmit={handlePreSubmit}>
          <div className="form-group">
             <label className="form-label">Select Event *</label>
             <div style={{display:'flex', gap:'10px'}}>
                 <select className="form-control" required value={formData.eventId} onChange={handleEventChange} style={{flex:1}}>
                    <option value="" disabled>Pilih Kegiatan...</option>
                    {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name} - {formatRupiah(ev.price)}</option>
                    ))}
                 </select>
                 <button type="button" className="btn-add" style={{width:'auto', padding:'0 15px', marginTop:0}} onClick={() => setShowEventModal(true)} title="Buat Event Baru"><i className="fa-solid fa-plus"></i></button>
             </div>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (Dalam Ribuan) *</label>
            <div style={{position:'relative'}}>
                <input type="number" className="form-control" required min="1" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                {formData.amount && <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>= {formatRupiah(parseInt(formData.amount) * 1000)}</div>}
            </div>
          </div>

          {/* STUDENT SELECTION (FILTERED) */}
          <div className="form-group">
            <label className="form-label">Select Student *</label>
            <select className="form-control" required value={formData.userId} onChange={(e) => setFormData({...formData, userId: e.target.value})}>
                <option value="" disabled>
                    {availableUsers.length === 0 ? (formData.eventId ? "Semua siswa sudah lunas!" : "Pilih Event dulu...") : "Pilih Siswa..."}
                </option>
                {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
            {/* Info Helper */}
            {formData.eventId && (
                <p style={{fontSize:'11px', color:'#64748b', marginTop:'5px'}}>
                    * Menampilkan siswa yang <b>belum bayar</b> untuk kegiatan ini.
                </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Date *</label>
            <input type="date" className="form-control" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
          </div>

          <button type="submit" className="btn-submit" style={{ backgroundColor: type === 'income' ? 'var(--success-green)' : 'var(--danger-red)' }}>
            {type === 'income' ? 'Receive Payment (Income)' : 'Deduct Savings (Expense)'}
          </button>
        </form>
      </div>

      {/* MODALS (Add Event & Confirm - Sama seperti sebelumnya) */}
      {showEventModal && (
          <div className="modal-overlay active" style={{display:'flex'}}>
             <div className="modal-box">
                <div className="modal-header"><h3>New Event</h3><button className="close-modal" onClick={() => setShowEventModal(false)}>&times;</button></div>
                <form onSubmit={handleAddEvent}>
                    <div className="modal-body">
                        <label style={{fontSize:'13px', fontWeight:'600'}}>Nama Kegiatan</label>
                        <input type="text" className="form-control" placeholder="Contoh: Renang..." required value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} style={{marginBottom:'15px'}}/>
                        <label style={{fontSize:'13px', fontWeight:'600'}}>Fixed Price (Rupiah Penuh)</label>
                        <input type="number" className="form-control" placeholder="Contoh: 20000" required value={newEvent.price} onChange={e => setNewEvent({...newEvent, price: e.target.value})}/>
                    </div>
                    <div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowEventModal(false)}>Cancel</button><button type="submit" className="btn-save">Save Event</button></div>
                </form>
             </div>
          </div>
      )}

      {showConfirmModal && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup-box">
            <h3>Confirm Transaction</h3>
            <p style={{marginBottom:'15px', color:'#64748b'}}>Please review the details:</p>
            <div className="popup-details" style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', fontSize:'13px'}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>Event:</span><b>{formData.eventName}</b></div>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>Student:</span><b>{users.find(u=>u.id===formData.userId)?.name}</b></div>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', color: type==='income'?'green':'red', fontWeight:'bold'}}><span>Method:</span><span>{type === 'income' ? 'Cash (Tunai)' : 'Savings (Tabungan)'}</span></div>
              <div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>
              {type === 'expense' && (<div style={{marginBottom:'10px', color:'#64748b'}}><div style={{display:'flex', justifyContent:'space-between'}}><span>Current Balance:</span><span>Rp {fmt(calculation.currentBalance)}</span></div></div>)}
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}><span>Event Price:</span><span>Rp {fmt(calculation.eventPrice)}</span></div>
              {type === 'expense' && (<div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'#b91c1c'}}><span>@ Admin Fee (10%):</span><span>+ Rp {fmt(calculation.fee)}</span></div>)}
              <div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'15px', fontWeight:'bold'}}><span>Total {type === 'expense' ? 'Deducted' : 'Income'}:</span><span style={{color: type === 'expense' ? 'red' : 'green'}}>Rp {fmt(type === 'expense' ? calculation.totalDeduction : calculation.eventPrice)}</span></div>
              {type === 'expense' && (<div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', color:'blue', fontWeight:'bold'}}><span>New Balance:</span><span>Rp {fmt(calculation.currentBalance - calculation.totalDeduction)}</span></div>)}
            </div>
            <div className="popup-actions"><button className="cancel-btn" onClick={() => setShowConfirmModal(false)} disabled={loading}>Cancel</button><button className="confirm-btn" onClick={handleFinalSubmit} disabled={loading}>{loading ? 'Processing...' : 'Confirm'}</button></div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EventTransactions;