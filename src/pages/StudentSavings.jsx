import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const StudentSavings = () => {
  const { toggleSidebar } = useOutletContext();
  const printRef = useRef(null); 

  // STATE
  const [students, setStudents] = useState([]);
  const [savingsData, setSavingsData] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Modal Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTargetId, setExportTargetId] = useState(''); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // State khusus untuk data yang akan di-render di JPG
  const [exportData, setExportData] = useState(null);

  // 1. FETCH DATA AWAL
  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const usersList = usersSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,          // Fallback
          fullName: doc.data().fullName,  // NAMA LENGKAP (Untuk Export)
          nickname: doc.data().nickname,  // NAMA PANGGILAN (Untuk Web Grid & Dropdown)
          photo: doc.data().photo
        }));

        const transSnap = await getDocs(collection(db, "transactions"));
        const balances = {};
        let minDate = new Date(); 
        let maxDate = new Date();

        transSnap.forEach(doc => {
          const t = doc.data();
          if (t.skipSavings) return; 

          const uid = t.userId;
          const amount = parseInt(t.amount) || 0;
          if (!balances[uid]) balances[uid] = 0;

          if (t.type === 'income') balances[uid] += amount;
          else if (t.type === 'expense') balances[uid] -= amount;
          
          const d = new Date(t.date);
          if(d < minDate) minDate = d;
          if(d > maxDate) maxDate = d;
        });

        setStudents(usersList);
        setSavingsData(balances);
        setStartDate(minDate.toISOString().split('T')[0]);
        setEndDate(maxDate.toISOString().split('T')[0]);
        setLoading(false);

      } catch (error) {
        toast.error("Gagal memuat data.");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- FUNGSI AMBIL DATA TRANSAKSI (Shared) ---
  const fetchTransactionData = async () => {
      const q = query(
          collection(db, "transactions"), 
          where("userId", "==", exportTargetId),
          where("date", ">=", startDate),
          where("date", "<=", endDate),
          orderBy("date", "asc")
      );
      const querySnapshot = await getDocs(q);
      
      let runningBalance = 0;
      const rows = [];
      
      querySnapshot.forEach(doc => {
          const t = doc.data();
          if (t.skipSavings) return;

          const masuk = t.type === 'income' ? t.amount : 0;
          const keluar = t.type === 'expense' ? t.amount : 0;
          runningBalance = runningBalance + masuk - keluar;

          rows.push({
              date: formatDateIndo(t.date),
              in: masuk > 0 ? formatRupiah(masuk) : '-',
              out: keluar > 0 ? formatRupiah(keluar) : '-',
              balance: formatRupiah(runningBalance)
          });
      });
      return rows;
  };

  // --- EXPORT PDF ---
  const handleExportPDF = async () => {
      if(!exportTargetId) { toast.error("Pilih siswa terlebih dahulu"); return; }
      setIsExporting(true);
      
      try {
          const rows = await fetchTransactionData();
          const tableBody = rows.map(r => [r.date, r.in, r.out, r.balance, ' ']); 

          const doc = new jsPDF();
          const student = students.find(s => s.id === exportTargetId);
          
          // TETAP GUNAKAN NAMA LENGKAP UNTUK HASIL PDF
          const studentNameExport = student?.fullName || student?.name;

          doc.setFontSize(16);
          doc.text(`BUKU TABUNGAN SISWA`, 105, 15, { align: 'center' });
          doc.setFontSize(11);
          doc.text(`Nama: ${studentNameExport}`, 14, 25); 
          doc.text(`Periode: ${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`, 14, 31);

          autoTable(doc, {
              head: [['TANGGAL', 'MASUK', 'KELUAR', 'SISA', 'PARAF']],
              body: tableBody,
              startY: 35,
              theme: 'grid',
              headStyles: { fillColor: [220, 220, 220], textColor: 0, lineColor: 0, lineWidth: 0.1 },
              styles: { lineColor: 0, lineWidth: 0.1, fontSize: 9 },
              columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
          });

          doc.save(`Tabungan_${studentNameExport}.pdf`);
          
          toast.success("PDF Berhasil!");
          setShowExportModal(false);

      } catch (error) {
          console.error(error);
          toast.error("Gagal export PDF");
      } finally {
          setIsExporting(false);
      }
  };

  // --- EXPORT JPG ---
  const handleExportJPG = async () => {
      if(!exportTargetId) { toast.error("Pilih siswa terlebih dahulu"); return; }
      setIsExporting(true);

      try {
          const rows = await fetchTransactionData();
          const student = students.find(s => s.id === exportTargetId);
          
          // TETAP GUNAKAN NAMA LENGKAP UNTUK HASIL JPG
          const studentNameExport = student?.fullName || student?.name;
          
          setExportData({
              studentName: studentNameExport, 
              rows: rows,
              period: `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`
          });

          setTimeout(async () => {
              if (printRef.current) {
                  const canvas = await html2canvas(printRef.current, { scale: 2 });
                  const imgData = canvas.toDataURL('image/jpeg', 1.0);
                  
                  const link = document.createElement('a');
                  link.href = imgData;
                  link.download = `Tabungan_${studentNameExport}.jpg`;
                  link.click();
                  
                  toast.success("JPG Berhasil!");
                  setShowExportModal(false);
                  setExportData(null);
              }
              setIsExporting(false);
          }, 500);

      } catch (error) {
          console.error(error);
          toast.error("Gagal export JPG");
          setIsExporting(false);
      }
  };

  const formatRupiah = (num) => new Intl.NumberFormat('id-ID').format(num);
  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "S";
  const formatDateIndo = (dStr) => {
      if(!dStr) return '-';
      const d = new Date(dStr);
      return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  }

  return (
    <div style={{ width: '100%' }}>
      
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div className="page-title"><h1>Student Savings</h1><p>Total saldo tabungan setiap siswa</p></div>
        </div>
        
        <button className="btn-add" onClick={() => setShowExportModal(true)} style={{backgroundColor:'#16a34a'}}>
            <i className="fa-solid fa-print"></i> Cetak Buku
        </button>
      </div>

      <div className="user-grid">
        {loading ? <p style={{ color: 'var(--text-gray)' }}>Menghitung saldo...</p> : students.length === 0 ? (
          <p style={{ color: 'var(--text-gray)' }}>Belum ada siswa.</p>
        ) : (
          students.map((student) => {
            const balance = savingsData[student.id] || 0;
            const displayName = student.nickname || student.name;

            return (
              <div className="user-card" key={student.id} style={{ alignItems: 'center' }}>
                <div className="user-info-wrapper">
                  <div className="avatar" style={{ 
                      backgroundColor: student.photo ? 'transparent' : 'var(--primary-blue)',
                      backgroundImage: student.photo ? `url(${student.photo})` : 'none',
                      backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e2e8f0',
                      color: student.photo ? 'transparent' : 'white'
                  }}>
                    {!student.photo && getInitials(displayName)}
                  </div>
                  <div className="info">
                      <h3 style={{ fontSize: '15px' }}>{displayName}</h3>
                      <p style={{ fontSize: '12px' }}>Total Saldo</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: '16px', fontWeight: '700', color: balance >= 0 ? 'var(--primary-blue)' : 'var(--danger-red)' }}>
                      {formatRupiah(balance)}
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL EXPORT --- */}
      {showExportModal && (
          <div className="modal-overlay active" style={{display:'flex'}} onClick={() => setShowExportModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
                  <div className="modal-header">
                      <h3>Cetak Buku Tabungan</h3>
                      <button className="close-modal" onClick={() => setShowExportModal(false)}>&times;</button>
                  </div>
                  <div className="modal-body">
                      <label style={{fontSize:'13px', fontWeight:'600', display:'block', marginBottom:'5px'}}>Pilih Siswa</label>
                      <select className="form-control" value={exportTargetId} onChange={(e) => setExportTargetId(e.target.value)} style={{marginBottom:'15px'}}>
                          <option value="" disabled>-- Pilih Siswa --</option>
                          {students.map(s => ( 
                              <option key={s.id} value={s.id}>
                                  {/* --- TAMPILKAN NAMA PANGGILAN DI DROPDOWN --- */}
                                  {s.nickname || s.name}
                              </option> 
                          ))}
                      </select>
                      <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                          <div style={{flex:1}}><label style={{fontSize:'13px', fontWeight:'600'}}>Dari Tanggal</label><input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                          <div style={{flex:1}}><label style={{fontSize:'13px', fontWeight:'600'}}>Sampai Tanggal</label><input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                      </div>
                      <div style={{display:'flex', gap:'10px'}}>
                          <button className="btn-submit" onClick={handleExportPDF} disabled={isExporting} style={{flex:1, background:'#ef4444'}}><i className="fa-solid fa-file-pdf"></i> PDF</button>
                          <button className="btn-submit" onClick={handleExportJPG} disabled={isExporting} style={{flex:1, background:'#3b82f6'}}><i className="fa-solid fa-image"></i> JPG</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- HIDDEN PRINT AREA (KHUSUS UNTUK RENDER JPG) --- */}
      {exportData && (
        <div 
            ref={printRef} 
            style={{
                position: 'absolute', left: '-9999px', top: 0,
                width: '800px', padding: '40px', background: 'white', color: 'black', fontFamily: 'Arial, sans-serif'
            }}
        >
            <div style={{textAlign:'center', marginBottom:'20px', borderBottom:'2px solid black', paddingBottom:'10px'}}>
                <h2 style={{margin:0, fontSize:'24px'}}>BUKU TABUNGAN SISWA</h2>
                <p style={{margin:'5px 0 0 0', fontSize:'14px'}}>PAUD ROHANI</p>
            </div>
            
            <div style={{marginBottom:'20px', fontSize:'14px'}}>
                <p><strong>Nama Siswa:</strong> {exportData.studentName}</p>
                <p><strong>Periode:</strong> {exportData.period}</p>
            </div>

            <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid black', fontSize:'12px'}}>
                <thead>
                    <tr style={{background:'#e5e7eb'}}>
                        <th style={{border:'1px solid black', padding:'8px'}}>TANGGAL</th>
                        <th style={{border:'1px solid black', padding:'8px', textAlign:'right'}}>MASUK (Rp)</th>
                        <th style={{border:'1px solid black', padding:'8px', textAlign:'right'}}>KELUAR (Rp)</th>
                        <th style={{border:'1px solid black', padding:'8px', textAlign:'right'}}>SISA (Rp)</th>
                        <th style={{border:'1px solid black', padding:'8px', textAlign:'center'}}>PARAF</th>
                    </tr>
                </thead>
                <tbody>
                    {exportData.rows.map((row, idx) => (
                        <tr key={idx}>
                            <td style={{border:'1px solid black', padding:'8px'}}>{row.date}</td>
                            <td style={{border:'1px solid black', padding:'8px', textAlign:'right'}}>{row.in}</td>
                            <td style={{border:'1px solid black', padding:'8px', textAlign:'right'}}>{row.out}</td>
                            <td style={{border:'1px solid black', padding:'8px', textAlign:'right', fontWeight:'bold'}}>{row.balance}</td>
                            <td style={{border:'1px solid black', padding:'8px'}}></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div style={{marginTop:'40px', textAlign:'right', fontSize:'12px'}}>
                <p>Dicetak secara otomatis pada {new Date().toLocaleDateString('id-ID')}</p>
            </div>
        </div>
      )}

    </div>
  );
};

export default StudentSavings;