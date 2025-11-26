import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const Income = () => {
  const { toggleSidebar } = useOutletContext();

  // 1. STATE MANAGEMENT
  const [users, setUsers] = useState([]); 
  const [type, setType] = useState('income'); 
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // State Filter & Pin
  const [existingUserIds, setExistingUserIds] = useState(new Set());
  const [isUserPinned, setIsUserPinned] = useState(false);

  // State Perhitungan untuk Modal
  const [calculation, setCalculation] = useState({
    currentBalance: 0,
    inputAmount: 0, // Nilai asli (misal 1000)
    fee: 0,         // 10% jika expense
    total: 0,       // Input + Fee (jika expense)
    newBalance: 0
  });

  const [formData, setFormData] = useState({
    userId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // 2. FETCH USERS
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
      }
    };
    fetchUsers();
  }, []);

  // 3. FETCH EXISTING TRANSACTIONS (Filter)
  useEffect(() => {
    if (!formData.date) return;
    const q = query(
        collection(db, "transactions"), 
        where("date", "==", formData.date),
        where("type", "==", type)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const ids = new Set();
        snapshot.docs.forEach(doc => ids.add(doc.data().userId));
        setExistingUserIds(ids);
    });
    return () => unsubscribe();
  }, [formData.date, type]);

  // 4. HANDLERS
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (selectedType) => {
    setType(selectedType);
    if (!isUserPinned) setFormData(prev => ({ ...prev, userId: '' }));
  };

  // --- FUNGSI HITUNG SALDO USER ---
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

  // --- SAAT TOMBOL PRE-SUBMIT DIKLIK ---
  const handlePreSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId || !formData.amount || !formData.date) {
      toast.error("Mohon lengkapi data wajib (*)");
      return;
    }

    // Hitung Angka-angka
    const currentBal = await getUserBalance(formData.userId);
    const realAmount = parseInt(formData.amount) * 1000; // Input 1 jadi 1000
    
    let adminFee = 0;
    let totalTransaction = realAmount;
    let futureBal = 0;

    if (type === 'expense') {
        adminFee = realAmount * 0.1; // 10%
        totalTransaction = realAmount + adminFee; // Total yang akan dikurang dari saldo
        futureBal = currentBal - totalTransaction;
    } else {
        futureBal = currentBal + realAmount;
    }

    // Simpan ke state calculation untuk ditampilkan di Modal
    setCalculation({
        currentBalance: currentBal,
        inputAmount: realAmount,
        fee: adminFee,
        total: totalTransaction,
        newBalance: futureBal
    });

    setShowModal(true);
  };

  // --- FINAL SUBMIT ---
  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const selectedUserObj = users.find(u => u.id === formData.userId);
      const userName = selectedUserObj ? selectedUserObj.name : 'Unknown';

      // Catatan Otomatis (Agar jelas di history)
      let finalNote = formData.note;
      if (type === 'expense' && calculation.fee > 0) {
          const feeStr = calculation.fee.toLocaleString('id-ID');
          const amtStr = calculation.inputAmount.toLocaleString('id-ID');
          finalNote = `[Withdraw: Rp ${amtStr} + Adm: Rp ${feeStr}] ${formData.note}`;
      }

      await addDoc(collection(db, "transactions"), {
        userId: formData.userId,
        userName: userName,
        // Jika Expense, kita simpan TOTAL (Pokok + Fee) agar saldo berkurang sesuai
        amount: type === 'expense' ? calculation.total : calculation.inputAmount,        
        date: formData.date,
        note: finalNote,
        type: type,
        createdAt: serverTimestamp()
      });

      toast.success("Transaksi berhasil disimpan!");
      setShowModal(false);

      setFormData(prev => ({
        userId: isUserPinned ? prev.userId : '', 
        amount: '',
        date: prev.date,
        note: ''
      }));

    } catch (error) {
      toast.error("Gagal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedUserName = () => {
    const user = users.find(u => u.id === formData.userId);
    return user ? user.name : '-';
  };

  const availableUsers = users.filter(user => 
    !existingUserIds.has(user.id) || user.id === formData.userId
  );

  // Format Rp helper
  const fmt = (n) => n.toLocaleString('id-ID');

  return (
    <div style={{ width: '100%' }}>
      <div className="centered-header">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div><h1>Income Management</h1><p>Add or subtract income for users</p></div>
        </div>
      </div>

      <div className="form-card">
        <div className="toggle-container">
          <button type="button" className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => handleTypeChange('income')}>
            <i className="fa-solid fa-plus"></i> Add Income
          </button>
          <button type="button" className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => handleTypeChange('expense')}>
            <i className="fa-solid fa-minus"></i> Subtract Income
          </button>
        </div>

        <form onSubmit={handlePreSubmit}>
          <div className="form-group">
            <label className="form-label">Select User *</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select name="userId" className="form-control" required value={formData.userId} onChange={handleInputChange} style={{ flex: 1 }}>
                  <option value="" disabled>{availableUsers.length === 0 ? "Semua user sudah lunas hari ini" : "Choose a user"}</option>
                  {availableUsers.map(user => (<option key={user.id} value={user.id}>{user.name}</option>))}
                </select>
                <button type="button" onClick={() => setIsUserPinned(!isUserPinned)} style={{ background: isUserPinned ? 'var(--primary-blue)' : '#f1f5f9', color: isUserPinned ? 'white' : '#94a3b8', border: '1px solid var(--border-color)', borderRadius: '8px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', cursor:'pointer' }}>
                    <i className="fa-solid fa-thumbtack" style={{ transform: isUserPinned ? 'rotate(-45deg)' : 'none' }}></i>
                </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (Dalam Ribuan) * <span style={{fontSize:'11px', color:'#64748b', fontWeight:'normal'}}>Contoh: <b>20</b> = Rp 20.000</span></label>
            <div style={{position:'relative'}}>
                <input type="number" name="amount" className="form-control" placeholder="0" required min="1" value={formData.amount} onChange={handleInputChange} />
                {formData.amount && <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>= Rp {(parseInt(formData.amount) * 1000).toLocaleString('id-ID')}</div>}
            </div>
          </div>

          <div className="form-group"><label className="form-label">Date *</label><input type="date" name="date" className="form-control" required value={formData.date} onChange={handleInputChange} /></div>
          <div className="form-group"><label className="form-label">Notes (Optional)</label><textarea name="note" className="form-control" placeholder="Add notes" value={formData.note} onChange={handleInputChange} ></textarea></div>

          <button type="submit" className="btn-submit" style={{ backgroundColor: type === 'income' ? 'var(--success-green)' : 'var(--danger-red)' }}>
            {type === 'income' ? 'Add Income' : 'Subtract Income'}
          </button>
        </form>
      </div>

      {/* --- MODAL KONFIRMASI (MODIFIED) --- */}
      {showModal && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup-box">
            <h3>Confirm Transaction</h3>
            <p style={{marginBottom:'15px', color:'#64748b'}}>Please review the financial details:</p>
            
            <div className="popup-details" style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', fontSize:'13px'}}>
              
              {/* Info User & Tanggal */}
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>
                  <span>User: <b>{getSelectedUserName()}</b></span>
                  <span>{formData.date}</span>
              </div>

              {/* Rincian Saldo */}
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'#64748b'}}>
                  <span>Current Savings:</span>
                  <span>Rp {fmt(calculation.currentBalance)}</span>
              </div>

              {/* Rincian Transaksi */}
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color: type==='income'?'green':'#b91c1c', fontWeight:'bold'}}>
                  <span>{type === 'income' ? 'Deposit' : 'Withdrawal'}:</span>
                  <span>{type === 'income' ? '+' : '-'} Rp {fmt(calculation.inputAmount)}</span>
              </div>

              {/* Admin Fee (Khusus Expense) */}
              {type === 'expense' && (
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'#b91c1c', fontSize:'12px'}}>
                      <span>@ : (Admin 10%)</span>
                      <span>- Rp {fmt(calculation.fee)}</span>
                  </div>
              )}

              <div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>

              {/* Total Balance Akhir */}
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'15px', fontWeight:'bold', color:'var(--text-dark)'}}>
                  <span>New Balance:</span>
                  <span style={{color: calculation.newBalance < 0 ? 'red' : 'blue'}}>
                      Rp {fmt(calculation.newBalance)}
                  </span>
              </div>

            </div>

            <div className="popup-actions">
              <button className="cancel-btn" onClick={() => setShowModal(false)} disabled={loading}>Cancel</button>
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

export default Income;