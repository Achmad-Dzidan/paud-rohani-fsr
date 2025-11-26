import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const OtherTransaction = () => {
  const { toggleSidebar } = useOutletContext();

  // STATE
  const [type, setType] = useState('income'); 
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // HANDLERS
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.date || !formData.note) {
      toast.error("Mohon lengkapi jumlah, tanggal, dan keterangan.");
      return;
    }
    setShowModal(true);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      await addDoc(collection(db, "transactions"), {
        userId: 'other', // ID Khusus untuk Other Transaction
        userName: 'Other Transaction', // Nama Default
        amount: parseInt(formData.amount) * 1000,        
        date: formData.date,
        note: formData.note, // Note menjadi sangat penting disini
        type: type, 
        isCheckpoint: false,
        createdAt: serverTimestamp()
      });

      toast.success("Transaksi umum berhasil disimpan!");
      setShowModal(false);
      setFormData({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
      });

    } catch (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper Format
  const fmt = (n) => n.toLocaleString('id-ID');

  return (
    <div style={{ width: '100%' }}>
      
      {/* HEADER */}
      <div className="centered-header">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div>
            <h1>Other Transaction</h1>
            <p>Catat pemasukan/pengeluaran operasional sekolah</p>
          </div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="form-card">
        <div className="toggle-container">
          <button type="button" className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => setType('income')}>
            <i className="fa-solid fa-plus"></i> Add Income
          </button>
          <button type="button" className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => setType('expense')}>
            <i className="fa-solid fa-minus"></i> Add Expense
          </button>
        </div>

        <form onSubmit={handlePreSubmit}>
          
          <div className="form-group">
            <label className="form-label">Amount (Dalam Ribuan) * <span style={{fontSize:'11px', color:'#64748b', fontWeight:'normal'}}>Contoh: <b>50</b> = Rp 50.000</span></label>
            <div style={{position:'relative'}}>
                <input type="number" name="amount" className="form-control" placeholder="0" required min="1" value={formData.amount} onChange={handleInputChange} />
                {formData.amount && <div style={{position:'absolute', right:'10px', top:'12px', fontSize:'12px', color:'green', fontWeight:'bold'}}>= Rp {(parseInt(formData.amount) * 1000).toLocaleString('id-ID')}</div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Date *</label>
            <input type="date" name="date" className="form-control" required value={formData.date} onChange={handleInputChange} />
          </div>

          {/* Note Wajib di sini agar jelas transaksinya apa */}
          <div className="form-group">
            <label className="form-label">Description (Wajib) *</label>
            <textarea name="note" className="form-control" placeholder="Contoh: Dana BOS, Beli Kapur, Bayar Listrik..." required value={formData.note} onChange={handleInputChange}></textarea>
          </div>

          <button type="submit" className="btn-submit" style={{ backgroundColor: type === 'income' ? 'var(--success-green)' : 'var(--danger-red)' }}>
            {type === 'income' ? 'Save Income' : 'Save Expense'}
          </button>
        </form>
      </div>

      {/* MODAL KONFIRMASI */}
      {showModal && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup-box">
            <h3>Confirm {type === 'income' ? 'Income' : 'Expense'}</h3>
            <p style={{marginBottom:'15px', color:'#64748b'}}>Please review details:</p>
            
            <div className="popup-details" style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', fontSize:'13px'}}>
              
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>
                  <span>Category:</span>
                  <b>Other / Operasional</b>
              </div>

              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                  <span>Date:</span>
                  <span>{formData.date}</span>
              </div>

              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                  <span>Description:</span>
                  <span style={{maxWidth:'150px', textAlign:'right', fontStyle:'italic'}}>{formData.note}</span>
              </div>

              <div style={{borderTop:'1px dashed #cbd5e1', margin:'10px 0'}}></div>

              <div style={{display:'flex', justifyContent:'space-between', fontSize:'15px', fontWeight:'bold', color: type==='income'?'green':'red'}}>
                  <span>Total:</span>
                  <span>{type === 'income' ? '+' : '-'} Rp {fmt(parseInt(formData.amount) * 1000)}</span>
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

export default OtherTransaction;