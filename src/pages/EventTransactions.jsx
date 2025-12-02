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
  
  // Modal Konfirmasi & Add Event
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // State Perhitungan untuk Modal
  const [calculation, setCalculation] = useState({
    currentBalance: 0,
    eventPrice: 0,  // Harga event asli
    fee: 0,         // 10% jika expense
    totalDeduction: 0 // Total yang dipotong (Price + Fee)
  });

  // Form Transaksi
  const [formData, setFormData] = useState({
    userId: '',
    eventId: '',
    eventName: '', 
    amount: '',    // Input dalam ribuan
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

  // --- HANDLERS ---

  // Saat Event Dipilih -> Auto isi Amount
  const handleEventChange = (e) => {
      const selectedId = e.target.value;
      const selectedEvent = events.find(ev => ev.id === selectedId);
      
      if (selectedEvent) {
          setFormData(prev => ({
              ...prev,
              eventId: selectedId,
              eventName: selectedEvent.name,
              amount: selectedEvent.price / 1000 // Konversi ke format ribuan (20000 -> 20)
          }));
      }
  };

  // Simpan Event Baru
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

  // Fungsi Hitung Saldo User (Untuk ditampilkan di Modal)
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

  // Pre-Submit Transaksi (Hitung-hitungan dulu)
  const handlePreSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId || !formData.eventId || !formData.amount) {
      toast.error("Mohon lengkapi data (*)");
      return;
    }

    // Hitung Rincian
    const currentBal = await getUserBalance(formData.userId);
    const realPrice = parseInt(formData.amount) * 1000;
    
    let adminFee = 0;
    let totalCut = realPrice;

    // LOGIKA ADMIN FEE 10% (Hanya jika Expense/Potong Tabungan)
    if (type === 'expense') {
        adminFee = realPrice * 0.10; // 10%
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

  // Final Submit
  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const selectedUser = users.find(u => u.id === formData.userId);
      const userName = selectedUser ? selectedUser.name : 'Unknown';
      
      // Buat Note Otomatis yang Informatif
      let noteText = `[Event] ${formData.eventName}`;
      
      if (type === 'expense') {
          const priceStr = calculation.eventPrice.toLocaleString('id-ID');
          const feeStr = calculation.fee.toLocaleString('id-ID');
          noteText += ` (Potong Tabungan: Rp ${priceStr} + Adm: Rp ${feeStr})`;
      } else {
          noteText += ` (Pembayaran Tunai)`;
      }

      await addDoc(collection(db, "transactions"), {
        userId: formData.userId,
        userName: userName,
        
        // PENTING: Jika expense, simpan TOTAL (Harga + Fee) agar saldo terpotong sesuai
        amount: type === 'expense' ? calculation.totalDeduction : calculation.eventPrice,
        
        date: formData.date,
        note: noteText,
        
        type: type, // income = nambah kas sekolah (tunai), expense = kurangi tabungan siswa
        category: 'event',
        eventId: formData.eventId,
        
        isCheckpoint: false,
        createdAt: serverTimestamp()
      });

      toast.success("Transaksi event berhasil!");
      setShowConfirmModal(false);
      
      // Reset Form (Kecuali tanggal & event, untuk input massal)
      setFormData(prev => ({
        ...prev,
        userId: '', 
      }));

    } catch (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper Format
  const fmt = (n) => n.toLocaleString('id-ID');
  const formatRupiah = (num) => "Rp " + new Intl.NumberFormat('id-ID').format(num);

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
        
        {/* Toggle Type */}
        <div className="toggle-container">
          <button type="button" className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => setType('income')}>
            <i className="fa-solid fa-money-bill-wave"></i> Pay Cash (Tunai)
          </button>
          <button type="button" className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => setType('expense')}>
            <i className="fa-solid fa-piggy-bank"></i> Pay w/ Savings (Potong)
          </button>
        </div>

        <form onSubmit={handlePreSubmit}>
          
          {/* EVENT SELECTION */}
          <div className="form-group">
             <label className="form-label">Select Event *</label>
             <div style={{display:'flex', gap:'10px'}}>
                 <select 
                    className="form-control" 
                    required 
                    value={formData.eventId} 
                    onChange={handleEventChange}
                    style={{flex:1}}
                 >
                    <option value="" disabled>Pilih Kegiatan...</option>
                    {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name} - {formatRupiah(ev.price)}</option>
                    ))}
                 </select>
                 <button 
                    type="button" 
                    className="btn-add" 
                    style={{width:'auto', padding:'0 15px', marginTop:0}}
                    onClick={() => setShowEventModal(true)}
                    title="Buat Event Baru"
                 >
                     <i className="fa-solid fa-plus"></i>
                 </button>
             </div>
          </div>

          {/* AMOUNT (AUTO FILLED) */}
          <div className="form-group">
            <label className="form-label">Amount (Dalam Ribuan) *</label>
            <div style={{position:'relative'}}>
                <input 
                    type="number" 
                    className="form-control" 
                    required 
                    min="1" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                />
                {formData.amount && <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>= {formatRupiah(parseInt(formData.amount) * 1000)}</div>}
            </div>
          </div>

          {/* STUDENT SELECTION */}
          <div className="form-group">
            <label className="form-label">Select Student *</label>
            <select 
                className="form-control" 
                required 
                value={formData.userId} 
                onChange={(e) => setFormData({...formData, userId: e.target.value})}
            >
                <option value="" disabled>Pilih Siswa...</option>
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
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

      {/* --- MODAL ADD EVENT --- */}
      {showEventModal && (
          <div className="modal-overlay active" style={{display:'flex'}}>
             <div className="modal-box">
                <div className="modal-header">
                    <h3>New Event</h3>
                    <button className="close-modal" onClick={() => setShowEventModal(false)}>&times;</button>
                </div>
                <form onSubmit={handleAddEvent}>
                    <div className="modal-body">
                        <label style={{fontSize:'13px', fontWeight:'600'}}>Nama Kegiatan</label>
                        <input type="text" className="form-control" placeholder="Contoh: Renang, Outing..." required value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} style={{marginBottom:'15px'}}/>
                        
                        <label style={{fontSize:'13px', fontWeight:'600'}}>Fixed Price (Rupiah Penuh)</label>
                        <input type="number" className="form-control" placeholder="Contoh: 20000" required value={newEvent.price} onChange={e => setNewEvent({...newEvent, price: e.target.value})}/>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-cancel" onClick={() => setShowEventModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save">Save Event</button>
                    </div>
                </form>
             </div>
          </div>
      )}

      {/* --- MODAL CONFIRM TRANSACTION --- */}
      {showConfirmModal && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup-box">
            <h3>Confirm Transaction</h3>
            <p style={{marginBottom:'15px', color:'#64748b'}}>Please review the details:</p>
            
            <div className="popup-details" style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', fontSize:'13px'}}>
              
              {/* Info Dasar */}
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                  <span>Event:</span><b>{formData.eventName}</b>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                  <span>Student:</span><b>{users.find(u=>u.id===formData.userId)?.name}</b>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', color: type==='income'?'green':'red', fontWeight:'bold'}}>
                  <span>Method:</span><span>{type === 'income' ? 'Cash (Tunai)' : 'Savings (Tabungan)'}</span>
              </div>

              <div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>

              {/* Rincian Saldo (Khusus Expense) */}
              {type === 'expense' && (
                <div style={{marginBottom:'10px', color:'#64748b'}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                        <span>Current Balance:</span><span>Rp {fmt(calculation.currentBalance)}</span>
                    </div>
                </div>
              )}

              {/* Rincian Harga */}
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                  <span>Event Price:</span>
                  <span>Rp {fmt(calculation.eventPrice)}</span>
              </div>

              {/* Admin Fee (Hanya jika Expense) */}
              {type === 'expense' && (
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'#b91c1c'}}>
                      <span>@ Admin Fee (10%):</span>
                      <span>+ Rp {fmt(calculation.fee)}</span>
                  </div>
              )}

              <div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>

              {/* TOTAL */}
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'15px', fontWeight:'bold'}}>
                  <span>Total {type === 'expense' ? 'Deducted' : 'Income'}:</span>
                  <span style={{color: type === 'expense' ? 'red' : 'green'}}>
                      Rp {fmt(type === 'expense' ? calculation.totalDeduction : calculation.eventPrice)}
                  </span>
              </div>

              {/* Estimasi Sisa Saldo (Khusus Expense) */}
              {type === 'expense' && (
                  <div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', color:'blue', fontWeight:'bold'}}>
                      <span>New Balance:</span>
                      <span>Rp {fmt(calculation.currentBalance - calculation.totalDeduction)}</span>
                  </div>
              )}

            </div>

            <div className="popup-actions">
              <button className="cancel-btn" onClick={() => setShowConfirmModal(false)} disabled={loading}>Cancel</button>
              <button className="confirm-btn" onClick={handleFinalSubmit} disabled={loading}>
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EventTransactions;