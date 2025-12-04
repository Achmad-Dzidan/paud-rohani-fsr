import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase.js';
import { toast } from 'sonner';

// --- SUB-COMPONENT 1: STUDENT SAVINGS FORM ---
const StudentSavingsForm = () => {
  const [users, setUsers] = useState([]);
  const [type, setType] = useState('income');
  const [loading, setLoading] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [existingUserIds, setExistingUserIds] = useState(new Set());
  const [isUserPinned, setIsUserPinned] = useState(false);
  
  const [calculation, setCalculation] = useState({ currentBalance: 0, inputAmount: 0, fee: 0, total: 0, newBalance: 0 });
  const [formData, setFormData] = useState({ userId: '', amount: '', date: new Date().toISOString().split('T')[0], note: '' });

  // Format Date untuk Tampilan UI
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!formData.date) return;
    const q = query(collection(db, "transactions"), where("date", "==", formData.date), where("type", "==", type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const ids = new Set(); snapshot.docs.forEach(doc => ids.add(doc.data().userId));
        setExistingUserIds(ids);
    });
    return () => unsubscribe();
  }, [formData.date, type]);

  const getUserBalance = async (userId) => {
    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    let bal = 0;
    snapshot.forEach(doc => { const t = doc.data(); if (!t.skipSavings) { if (t.type === 'income') bal += t.amount; else if (t.type === 'expense') bal -= t.amount; } });
    return bal;
  };

  const handlePreSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId || !formData.amount) { toast.error("Lengkapi data!"); return; }
    
    const currentBal = await getUserBalance(formData.userId);
    const realAmount = parseInt(formData.amount) * 1000;
    let adminFee = 0, totalTransaction = realAmount;
    
    if (type === 'expense') { adminFee = realAmount * 0.1; totalTransaction = realAmount + adminFee; }
    
    setCalculation({ currentBalance: currentBal, inputAmount: realAmount, fee: adminFee, total: totalTransaction, newBalance: currentBal + (type==='income'?realAmount:-totalTransaction) });
    setShowModal(true);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const user = users.find(u => u.id === formData.userId);
      let finalNote = formData.note;
      if (type === 'expense' && calculation.fee > 0) {
          finalNote = `[Withdraw: Rp ${calculation.inputAmount.toLocaleString('id-ID')} + Adm: Rp ${calculation.fee.toLocaleString('id-ID')}] ${formData.note}`;
      }
      await addDoc(collection(db, "transactions"), {
        userId: formData.userId, userName: user ? user.name : 'Unknown', amount: type==='expense'?calculation.total:calculation.inputAmount,
        date: formData.date, note: finalNote, type: type, createdAt: serverTimestamp()
      });
      toast.success("Berhasil!"); setShowModal(false);
      setFormData(prev => ({ userId: isUserPinned ? prev.userId : '', amount: '', date: prev.date, note: '' }));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const availableUsers = users.filter(u => !existingUserIds.has(u.id) || u.id === formData.userId);

  return (
    <div className="form-card" style={{marginTop:'20px'}}>
        <h2 style={{marginBottom:'20px', fontSize:'18px', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>Income Management Form</h2>
        
        <div className="toggle-container">
          <button type="button" className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => setType('income')}><i className="fa-solid fa-plus"></i> Savings Deposit</button>
          <button type="button" className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => setType('expense')}><i className="fa-solid fa-minus"></i> Savings Withdraw</button>
        </div>

        <form onSubmit={handlePreSubmit}>
            <div className="form-group">
                <label className="form-label">Select User *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <select className="form-control" required value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} style={{flex:1}}>
                        <option value="" disabled>{availableUsers.length===0?"Semua lunas":"Pilih Siswa"}</option>
                        {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setIsUserPinned(!isUserPinned)} style={{background: isUserPinned?'var(--primary-blue)':'#f1f5f9', color: isUserPinned?'white':'#94a3b8', width:'46px', border:'1px solid #e2e8f0', borderRadius:'8px', cursor:'pointer'}}><i className="fa-solid fa-thumbtack"></i></button>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Amount (Ribuan) *</label>
                <div style={{position:'relative'}}>
                    <input 
                        type="number" 
                        className="form-control" 
                        value={formData.amount} 
                        onChange={e => setFormData({...formData, amount: e.target.value})} 
                        required 
                    />
                    {formData.amount && (
                        <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>
                            = Rp {(parseInt(formData.amount) * 1000).toLocaleString('id-ID')}
                        </div>
                    )}
                </div>
            </div>

            <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-control" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required /></div>
            
            <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea 
                  className="form-control" 
                  placeholder="Add notes" 
                  value={formData.note} 
                  onChange={e => setFormData({...formData, note: e.target.value})} 
                ></textarea>
            </div>

            <button type="submit" className="btn-submit" style={{backgroundColor: type==='income'?'var(--success-green)':'var(--danger-red)'}}>Confirm</button>
        </form>
        
        {showModal && (
            <div className="popup-overlay active" style={{display:'flex'}}>
                <div className="popup-box">
                    <h3>Confirm Transaction</h3>
                    <p style={{marginBottom:'15px', color:'#64748b'}}>Please review financial details:</p>
                    <div className="popup-details" style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', fontSize:'13px'}}>
                        
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                             <span style={{color:'#64748b'}}>Student Name:</span>
                             <span style={{fontWeight:'bold', color:'#334155'}}>{users.find(u => u.id === formData.userId)?.name || '-'}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                             <span style={{color:'#64748b'}}>Date:</span>
                             <span style={{fontWeight:'bold', color:'#334155'}}>{formatDateDisplay(formData.date)}</span>
                        </div>
                        <div style={{borderTop:'1px solid #e2e8f0', marginBottom:'10px'}}></div>

                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'#64748b'}}>
                             <span>Current Balance:</span><span>Rp {calculation.currentBalance.toLocaleString('id-ID')}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', fontWeight:'bold', color: type==='income'?'green':'red'}}>
                             <span>{type === 'income' ? 'Deposit' : 'Withdraw'}:</span><span>{type==='income'?'+':'-'} Rp {calculation.inputAmount.toLocaleString('id-ID')}</span>
                        </div>
                        {type === 'expense' && (
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'red', fontSize:'12px'}}>
                                <span>@ Admin Fee (10%):</span><span>- Rp {calculation.fee.toLocaleString('id-ID')}</span>
                            </div>
                        )}
                        <div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'15px', fontWeight:'bold'}}>
                             <span>New Balance:</span><span style={{color:'blue'}}>Rp {calculation.newBalance.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                    <div className="popup-actions">
                        <button className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="confirm-btn" onClick={handleFinalSubmit} disabled={loading}>{loading?'Processing...':'Confirm'}</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

// --- SUB-COMPONENT 2: EVENT TRANSACTION FORM ---
const EventForm = () => {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [type, setType] = useState('income'); 
  const [loading, setLoading] = useState(false);
  
  const [paidIds, setPaidIds] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  
  const [formData, setFormData] = useState({ userId: '', eventId: '', eventName: '', amount: '', date: new Date().toISOString().split('T')[0], note: '' });
  const [newEvent, setNewEvent] = useState({ name: '', price: '' });
  
  const [calculation, setCalculation] = useState({ currentBalance: 0, eventPrice: 0, fee: 0, totalDeduction: 0 });

  useEffect(() => {
      const init = async () => {
          const uSnap = await getDocs(collection(db, "users"));
          setUsers(uSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
          const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
          onSnapshot(q, (s) => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      };
      init();
  }, []);

  useEffect(() => {
      if (!formData.eventId) return;
      const check = async () => {
          const q = query(collection(db, "transactions"), where("category", "==", "event"), where("eventId", "==", formData.eventId));
          const s = await getDocs(q);
          const ids = new Set();
          s.forEach(d => { const da = d.data(); if(da.studentIdRef) ids.add(da.studentIdRef); else ids.add(da.userId); });
          setPaidIds(ids);
      };
      check();
  }, [formData.eventId]);

  const handleAddEvent = async (e) => {
      e.preventDefault();
      await addDoc(collection(db, "events"), { name: newEvent.name, price: parseInt(newEvent.price), createdAt: serverTimestamp() });
      toast.success("Event Added!"); setShowAddEvent(false);
  };

  const handlePreSubmit = async (e) => {
      e.preventDefault();
      if(!formData.userId || !formData.eventId) { toast.error("Data incomplete"); return; }
      
      const q = query(collection(db, "transactions"), where("userId", "==", formData.userId));
      const s = await getDocs(q);
      let bal = 0; s.forEach(d => { const t = d.data(); if (!t.skipSavings) { if(t.type==='income') bal+=t.amount; else if(t.type==='expense') bal-=t.amount; } });

      const realPrice = parseInt(formData.amount) * 1000;
      let fee = 0; if(type === 'expense') fee = realPrice * 0.1;
      
      setCalculation({ currentBalance: bal, eventPrice: realPrice, fee: fee, totalDeduction: realPrice + fee });
      setShowModal(true);
  };

  const handleFinalSubmit = async () => {
      setLoading(true);
      try {
          const user = users.find(u => u.id === formData.userId);
          let finalNote = `[Event] ${formData.eventName}`;
          if(formData.note) finalNote += ` - ${formData.note}`;

          let finalUserId = formData.userId;
          let finalAmount = calculation.eventPrice;
          let isSkipSavings = false;

          // LOGIC 1: TRANSAKSI SISWA (PENGURANGAN SALDO)
          if (type === 'income') {
              finalUserId = 'other'; 
              finalNote += ` (Tunai: ${user.name})`;
              isSkipSavings = true;
          } else {
              const priceStr = calculation.eventPrice.toLocaleString('id-ID');
              const feeStr = calculation.fee.toLocaleString('id-ID');
              finalNote += ` (Potong Tabungan: Rp ${priceStr} + Adm: Rp ${feeStr})`;
              finalAmount = calculation.totalDeduction;
          }

          // Simpan Transaksi Utama (Pengurangan Siswa)
          await addDoc(collection(db, "transactions"), {
              userId: finalUserId, userName: type==='income'?'Other Transaction':user.name, studentIdRef: formData.userId,
              amount: finalAmount, date: formData.date, note: finalNote, type: type, category: 'event', eventId: formData.eventId,
              skipSavings: isSkipSavings, isCheckpoint: false, createdAt: serverTimestamp()
          });

          // LOGIC 2: UANG MASUK KE SEKOLAH (JIKA PAKE TABUNGAN)
          if (type === 'expense') {
             await addDoc(collection(db, "transactions"), {
                userId: 'other', 
                userName: 'Other Transaction', 
                amount: calculation.totalDeduction, 
                date: formData.date, 
                note: `[Income from Event Savings] ${formData.eventName} - ${user.name}`, 
                type: 'income', 
                category: 'event', // <--- UPDATE: Kategori di-set 'event' agar tidak dianggap 'operational'
                eventId: formData.eventId, // Link ke event ID juga
                isCheckpoint: false, 
                createdAt: serverTimestamp()
             });
          }

          toast.success("Success!"); setShowModal(false); setPaidIds(prev => new Set(prev).add(formData.userId)); setFormData(prev => ({...prev, userId: '', note: ''}));
      } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const availableUsers = users.filter(u => !paidIds.has(u.id));

  return (
      <div className="form-card" style={{marginTop:'20px'}}>
          <h2 style={{marginBottom:'20px', fontSize:'18px', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>Event Transaction Form</h2>
          
          <div className="toggle-container">
            <button type="button" className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => setType('income')}><i className="fa-solid fa-money-bill-wave"></i> Cash (Tunai)</button>
            <button type="button" className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => setType('expense')}><i className="fa-solid fa-piggy-bank"></i> Savings (Tabungan)</button>
          </div>

          <form onSubmit={handlePreSubmit}>
              <div className="form-group">
                  <label className="form-label">Event *</label>
                  <div style={{display:'flex', gap:'10px'}}>
                      <select className="form-control" required value={formData.eventId} onChange={e => {
                          const ev = events.find(v => v.id === e.target.value);
                          if(ev) setFormData({...formData, eventId: ev.id, eventName: ev.name, amount: ev.price/1000});
                      }} style={{flex:1}}>
                          <option value="" disabled>Select Event...</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} - {ev.price}</option>)}
                      </select>
                      <button type="button" className="btn-add" style={{width:'auto', padding:'0 15px', marginTop:0}} onClick={() => setShowAddEvent(true)}><i className="fa-solid fa-plus"></i></button>
                  </div>
              </div>

              <div className="form-group">
                  <label className="form-label">Price (Ribuan)</label>
                  <div style={{position:'relative'}}>
                      <input 
                          type="number" 
                          className="form-control" 
                          value={formData.amount} 
                          onChange={e => setFormData({...formData, amount: e.target.value})} 
                      />
                      {formData.amount && (
                          <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>
                              = Rp {(parseInt(formData.amount) * 1000).toLocaleString('id-ID')}
                          </div>
                      )}
                  </div>
              </div>

              <div className="form-group">
                  <label className="form-label">Student *</label>
                  <select className="form-control" required value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})}>
                      <option value="" disabled>{availableUsers.length===0?"Semua Lunas":"Select Student..."}</option>
                      {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-control" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
              </div>

              <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Keterangan tambahan..." 
                    value={formData.note} 
                    onChange={e => setFormData({...formData, note: e.target.value})} 
                  ></textarea>
              </div>

              <button type="submit" className="btn-submit" style={{backgroundColor: type==='income'?'var(--success-green)':'var(--danger-red)'}}>Confirm</button>
          </form>
          
          {showAddEvent && <div className="modal-overlay active" style={{display:'flex'}}><div className="modal-box"><h3 style={{marginBottom:'15px'}}>Add Event</h3><input className="form-control" placeholder="Name" style={{marginBottom:'10px'}} onChange={e=>setNewEvent({...newEvent, name:e.target.value})} /><input type="number" className="form-control" placeholder="Price" onChange={e=>setNewEvent({...newEvent, price:e.target.value})} /><div style={{marginTop:'15px', display:'flex', gap:'10px'}}><button className="btn-cancel" onClick={()=>setShowAddEvent(false)}>Cancel</button><button className="btn-save" onClick={handleAddEvent}>Save</button></div></div></div>}
          
          {showModal && <div className="popup-overlay active" style={{display:'flex'}}><div className="popup-box"><h3>Confirm</h3><p>{type==='income'?'Cash Payment':'Savings Deduction'}</p><div className="popup-details" style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', fontSize:'13px'}}><div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>Event:</span><b>{formData.eventName}</b></div><div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>Student:</span><b>{users.find(u=>u.id===formData.userId)?.name}</b></div><div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', color: type==='income'?'green':'red', fontWeight:'bold'}}><span>Method:</span><span>{type === 'income' ? 'Cash (Tunai)' : 'Savings (Tabungan)'}</span></div><div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>{type === 'expense' && (<div style={{marginBottom:'10px', color:'#64748b'}}><div style={{display:'flex', justifyContent:'space-between'}}><span>Current Balance:</span><span>Rp {calculation.currentBalance.toLocaleString('id-ID')}</span></div></div>)}<div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}><span>Event Price:</span><span>Rp {calculation.eventPrice.toLocaleString('id-ID')}</span></div>{type === 'expense' && (<div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'#b91c1c'}}><span>@ Admin Fee (10%):</span><span>+ Rp {calculation.fee.toLocaleString('id-ID')}</span></div>)}<div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div><div style={{display:'flex', justifyContent:'space-between', fontSize:'15px', fontWeight:'bold'}}><span>Total {type === 'expense' ? 'Deducted' : 'Income'}:</span><span style={{color: type === 'expense' ? 'red' : 'green'}}>Rp {(type === 'expense' ? calculation.totalDeduction : calculation.eventPrice).toLocaleString('id-ID')}</span></div>{type === 'expense' && (<div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', color:'blue', fontWeight:'bold'}}><span>New Balance:</span><span>Rp {(calculation.currentBalance - calculation.totalDeduction).toLocaleString('id-ID')}</span></div>)}</div><div className="popup-actions"><button className="cancel-btn" onClick={()=>setShowModal(false)}>Cancel</button><button className="confirm-btn" onClick={handleFinalSubmit}>Confirm</button></div></div></div>}
      </div>
  );
};

// --- SUB-COMPONENT 3: OTHER TRANSACTION FORM ---
const OtherForm = () => {
  const [type, setType] = useState('income');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.note) { toast.error("Lengkapi Data"); return; }
    setShowModal(true);
  }

  const handleFinalSubmit = async () => {
      setLoading(true);
      try {
          await addDoc(collection(db, "transactions"), {
              userId: 'other', userName: 'Other Transaction', amount: parseInt(formData.amount) * 1000,
              date: formData.date, note: formData.note, type: type, isCheckpoint: false, createdAt: serverTimestamp()
          });
          toast.success("Success!"); setShowModal(false); setFormData({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
      } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
      <div className="form-card" style={{marginTop:'20px'}}>
          <h2 style={{marginBottom:'20px', fontSize:'18px', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>Other Transaction (Operasional)</h2>
          
          <div className="toggle-container">
            <button type="button" className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => setType('income')}><i className="fa-solid fa-plus"></i> Income</button>
            <button type="button" className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => setType('expense')}><i className="fa-solid fa-minus"></i> Expense</button>
          </div>

          <form onSubmit={handlePreSubmit}>
              {/* AMOUNT dengan Preview (OTHER) */}
              <div className="form-group">
                  <label className="form-label">Amount (Ribuan) *</label>
                  <div style={{position:'relative'}}>
                      <input 
                          type="number" 
                          className="form-control" 
                          value={formData.amount} 
                          onChange={e => setFormData({...formData, amount: e.target.value})} 
                          required 
                      />
                      {formData.amount && (
                          <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>
                              = Rp {(parseInt(formData.amount) * 1000).toLocaleString('id-ID')}
                          </div>
                      )}
                  </div>
              </div>

              <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-control" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Description *</label><textarea className="form-control" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} required placeholder="Dana BOS, Beli Kapur..."></textarea></div>
              <button type="submit" className="btn-submit" style={{backgroundColor: type==='income'?'var(--success-green)':'var(--danger-red)'}} disabled={loading}>Save Transaction</button>
          </form>

          {showModal && (
             <div className="popup-overlay active" style={{display:'flex'}}>
                <div className="popup-box">
                    <h3>Confirm Transaction</h3>
                    <p>Type: {type}</p>
                    <p>Amount: Rp {(parseInt(formData.amount)*1000).toLocaleString('id-ID')}</p>
                    <p>Note: {formData.note}</p>
                    <div className="popup-actions">
                        <button className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="confirm-btn" onClick={handleFinalSubmit} disabled={loading}>{loading?'Processing...':'Confirm'}</button>
                    </div>
                </div>
             </div>
          )}
      </div>
  );
};


// === MAIN COMPONENT (MENU UTAMA) ===
const Income = () => {
  const { toggleSidebar } = useOutletContext();
  const [activeTab, setActiveTab] = useState('savings'); 

  const getMenuStyle = (tabName) => ({
      background: activeTab === tabName ? '#f8fafc' : 'white',
      border: activeTab === tabName ? '2px solid var(--primary-blue)' : '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '20px 10px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: activeTab === tabName ? '0 4px 6px rgba(37, 99, 235, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)'
  });

  return (
    <div style={{ width: '100%' }}>
      <div className="centered-header">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div>
            <h1>Transaction Center</h1>
            <p>Pilih jenis transaksi yang ingin dicatat</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '0px' }}>
          
          <div onClick={() => setActiveTab('savings')} style={getMenuStyle('savings')}>
              <div style={{width:'40px', height:'40px', background:'#eff6ff', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'8px'}}>
                  <i className="fa-solid fa-piggy-bank" style={{fontSize:'18px', color:'var(--primary-blue)'}}></i>
              </div>
              <h3 style={{fontSize:'12px', color:'var(--text-dark)', marginBottom:'0', fontWeight:'600'}}>Income Mgt.</h3>
          </div>

          <div onClick={() => setActiveTab('event')} style={getMenuStyle('event')}>
              <div style={{width:'40px', height:'40px', background:'#f0fdf4', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'8px'}}>
                  <i className="fa-solid fa-calendar-check" style={{fontSize:'18px', color:'#16a34a'}}></i>
              </div>
              <h3 style={{fontSize:'12px', color:'var(--text-dark)', marginBottom:'0', fontWeight:'600'}}>Event Trans.</h3>
          </div>

          <div onClick={() => setActiveTab('other')} style={getMenuStyle('other')}>
              <div style={{width:'40px', height:'40px', background:'#fffbeb', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'8px'}}>
                  <i className="fa-solid fa-cash-register" style={{fontSize:'18px', color:'#d97706'}}></i>
              </div>
              <h3 style={{fontSize:'12px', color:'var(--text-dark)', marginBottom:'0', fontWeight:'600'}}>Other Trans.</h3>
          </div>
      </div>

      <div className="content-area">
          {activeTab === 'savings' && <StudentSavingsForm />}
          {activeTab === 'event' && <EventForm />}
          {activeTab === 'other' && <OtherForm />}
      </div>

    </div>
  );
};

export default Income;