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
  
  // savingsData sekarang menyimpan object: { balance: number, minDate: string, maxDate: string }
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
          name: doc.data().name,          
          fullName: doc.data().fullName,  
          nickname: doc.data().nickname,  
          photo: doc.data().photo
        }));

        const transSnap = await getDocs(collection(db, "transactions"));
        const stats = {}; // Object untuk menyimpan balance & range tanggal per user

        transSnap.forEach(doc => {
          const t = doc.data();
          if (t.skipSavings) return; 

          const uid = t.userId;
          const amount = parseInt(t.amount) || 0;
          
          // Inisialisasi object jika belum ada
          if (!stats[uid]) {
              stats[uid] = { balance: 0, minDate: null, maxDate: null };
          }

          // Hitung Saldo
          if (t.type === 'income') stats[uid].balance += amount;
          else if (t.type === 'expense') stats[uid].balance -= amount;
          
          // Cek Tanggal Min/Max per User
          const currentDate = t.date; // Format YYYY-MM-DD dari firebase
          if (!stats[uid].minDate || currentDate < stats[uid].minDate) {
              stats[uid].minDate = currentDate;
          }
          if (!stats[uid].maxDate || currentDate > stats[uid].maxDate) {
              stats[uid].maxDate = currentDate;
          }
        });

        setStudents(usersList);
        setSavingsData(stats);
        setLoading(false);

      } catch (error) {
        toast.error("Gagal memuat data.");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- HANDLER SAAT CARD DI KLIK ---
  const handleCardClick = (studentId) => {
      const userStats = savingsData[studentId];
      const today = new Date().toISOString().split('T')[0];

      setExportTargetId(studentId);
      
      // Set default date range berdasarkan data transaksi user tersebut
      // Jika user belum punya transaksi, default ke hari ini
      setStartDate(userStats?.minDate || today);
      setEndDate(userStats?.maxDate || today);
      
      setShowExportModal(true);
  };

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
      
      // Kita perlu menghitung saldo awal sebelum periode yang dipilih
      // Agar kolom "Balance" di PDF akurat.
      // Namun untuk simplifikasi UI (sesuai request), kita hitung running balance dari 0 
      // atau idealnya fetch saldo sebelum startDate. 
      // Di sini kita asumsikan cetak buku biasanya dari awal, atau user menerima running balance periode itu.
      
      let runningBalance = 0;
      
      // Optional: Fetch saldo sebelum startDate jika ingin presisi (tapi memperlambat)
      // Untuk sekarang running balance dimulai dari 0 untuk list yang ditampilkan
      
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
      if(!exportTargetId) return;
      setIsExporting(true);
      
      try {
          const rows = await fetchTransactionData();
          const tableBody = rows.map(r => [r.date, r.in, r.out, r.balance, ' ']); 

          const doc = new jsPDF();
          const student = students.find(s => s.id === exportTargetId);
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
      if(!exportTargetId) return;
      setIsExporting(true);

      try {
          const rows = await fetchTransactionData();
          const student = students.find(s => s.id === exportTargetId);
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

  // Helper untuk mendapatkan nama siswa yang sedang dipilih di modal
  const getSelectedStudentName = () => {
      const s = students.find(u => u.id === exportTargetId);
      return s ? (s.nickname || s.name) : "Loading...";
  }

  return (
    <div style={{ width: '100%' }}>
      
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div className="page-title"><h1>Student Savings</h1><p>Klik kartu siswa untuk mencetak buku tabungan</p></div>
        </div>
        {/* Tombol Cetak Buku di header DIHAPUS sesuai permintaan */}
      </div>

      <div className="user-grid">
        {loading ? <p style={{ color: 'var(--text-gray)' }}>Menghitung saldo...</p> : students.length === 0 ? (
          <p style={{ color: 'var(--text-gray)' }}>Belum ada siswa.</p>
        ) : (
          students.map((student) => {
            // Ambil data stats object, default ke object kosong jika belum ada transaksi
            const stats = savingsData[student.id] || { balance: 0 };
            const balance = stats.balance;
            const displayName = student.nickname || student.name;

            return (
              <div 
                className="user-card" 
                key={student.id} 
                style={{ alignItems: 'center', cursor: 'pointer', transition: 'transform 0.1s' }}
                onClick={() => handleCardClick(student.id)} // Trigger Modal Disini
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
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
                   <div style={{ fontSize: '10px', color: '#64748b', marginTop:'2px' }}>
                       <i className="fa-solid fa-print"></i> Cetak
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL EXPORT (MODIFIKASI) --- */}
      {showExportModal && (
          <div className="modal-overlay active" style={{display:'flex'}} onClick={() => setShowExportModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
                  <div className="modal-header">
                      <h3>Cetak Buku Tabungan</h3>
                      <button className="close-modal" onClick={() => setShowExportModal(false)}>&times;</button>
                  </div>
                  <div className="modal-body">
                      {/* Tampilkan Nama Siswa (Read Only) */}
                      <label style={{fontSize:'13px', fontWeight:'600', display:'block', marginBottom:'5px'}}>Siswa</label>
                      <div style={{
                          background: '#f1f5f9', padding: '10px', borderRadius: '6px', 
                          border: '1px solid #e2e8f0', marginBottom: '15px', fontWeight: 'bold', color: '#334155'
                      }}>
                          {getSelectedStudentName()}
                      </div>

                      <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                          <div style={{flex:1}}>
                              <label style={{fontSize:'13px', fontWeight:'600'}}>Dari Tanggal</label>
                              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                          </div>
                          <div style={{flex:1}}>
                              <label style={{fontSize:'13px', fontWeight:'600'}}>Sampai Tanggal</label>
                              <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                          </div>
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