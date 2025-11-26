import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, getDocs, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js'; // Pastikan path ini benar (.js)
import { toast } from 'sonner';

const Absensi = () => {
  const { toggleSidebar } = useOutletContext();

  // STATE
  const [students, setStudents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState([]); 
  
  const [attendanceData, setAttendanceData] = useState({});
  const [incomeData, setIncomeData] = useState({}); 
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- MODIFIKASI STATUS CONFIG ---
  const STATUS_CONFIG = {
    '-': { label: '-', color: '#94a3b8', bg: '#f1f5f9', title: 'Tanpa Keterangan' }, // Default (Tidak Disimpan)
    '?': { label: '?', color: '#7c3aed', bg: '#ede9fe', title: 'Hadir (No Income)' }, // Hadir tanpa bayar
    'H': { label: 'H', color: '#15803d', bg: '#dcfce7', title: 'Hadir (Income)' },
    'S': { label: 'S', color: '#854d0e', bg: '#fef9c3', title: 'Sakit' },
    'I': { label: 'I', color: '#1e40af', bg: '#dbeafe', title: 'Izin' },
    'A': { label: 'A', color: '#991b1b', bg: '#fee2e2', title: 'Alpha' },
  };

  // 1. GENERATE 7 HARI (SKIP SABTU MINGGU)
  useEffect(() => {
    const dates = [];
    let currentDate = new Date(selectedDate);
    let count = 0;

    while (count < 7) {
      const dayNum = currentDate.getDay();
      if (dayNum !== 0 && dayNum !== 6) {
        dates.unshift(currentDate.toISOString().split('T')[0]);
        count++;
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }
    setDateRange(dates);
  }, [selectedDate]);

  // 2. FETCH DATA SISWA
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsubscribe();
  }, []);

  // 3. FETCH DATA (Absensi & Income)
  useEffect(() => {
    if (dateRange.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      const startDate = dateRange[0];
      const endDate = dateRange[dateRange.length - 1];

      try {
        // A. Ambil Data Absensi Manual
        const attQuery = query(
          collection(db, "attendance"),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
        );
        const attSnap = await getDocs(attQuery);
        const attMap = {};
        attSnap.forEach(doc => {
          attMap[doc.id] = doc.data().records || {};
        });
        setAttendanceData(attMap);

        // B. Ambil Data Income (Otomatis H)
        const incQuery = query(
          collection(db, "transactions"),
          where("type", "==", "income"),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
        );
        const incSnap = await getDocs(incQuery);
        const incMap = {};
        
        incSnap.forEach(doc => {
          const t = doc.data();
          if (!incMap[t.date]) incMap[t.date] = new Set();
          incMap[t.date].add(t.userId);
        });
        setIncomeData(incMap);

      } catch (error) {
        console.error(error);
        toast.error("Gagal memuat data matriks");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  // 4. HELPER: LOGIKA STATUS EFEKTIF
  const getEffectiveStatus = (date, userId) => {
    const manualStatus = attendanceData[date] && attendanceData[date][userId];
    const hasIncome = incomeData[date] && incomeData[date].has(userId);

    // 1. Jika Guru pilih manual (dan bukan '-'), itu prioritas tertinggi
    if (manualStatus && manualStatus !== '-') {
      return manualStatus;
    }

    // 2. Jika manual kosong/strip, TAPI ada Income -> Otomatis 'H'
    if (hasIncome) {
      return 'H';
    }

    // 3. Fallback: Jika manual ada (walau '-') kembalikan '-', jika tidak ada kembalikan '-'
    // Intinya kalau tidak ada data apapun, tampilkan strip.
    return manualStatus || '-';
  };

  // Handler ubah status di UI (belum simpan ke DB)
  const handleStatusChange = (date, userId, newStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [date]: { ...(prev[date] || {}), [userId]: newStatus }
    }));
  };

  // 5. SIMPAN KE FIREBASE (Hanya yang bukan '-')
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      dateRange.forEach(dateStr => {
        const docRef = doc(db, "attendance", dateStr);
        const recordsToSave = {};
        
        students.forEach(student => {
          const status = getEffectiveStatus(dateStr, student.id);
          
          // FILTER PENTING: Jangan simpan jika statusnya '-'
          if (status !== '-') {
            recordsToSave[student.id] = status;
          }
        });

        // Kita gunakan set TANPA merge: true
        // Ini akan menimpa dokumen lama dengan dokumen baru yang bersih
        // Artinya jika dulu ada data 'S', lalu diubah jadi '-', data 'S' itu akan terhapus dari DB
        batch.set(docRef, {
          date: dateStr,
          records: recordsToSave,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast.success("Data absensi berhasil disimpan!");
    } catch (error) {
      toast.error("Gagal: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatHeaderDate = (dateStr) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const formatDateDisplay = (isoDate) => {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div style={{ width: '100%' }}>
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div className="page-title">
            <h1>Absensi Matriks</h1>
            <p>Rekap kehadiran 7 hari terakhir</p>
          </div>
        </div>

        {/* Date Picker Wrapper */}
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
             <label style={{fontSize:'11px', color:'var(--text-gray)', marginBottom:'4px'}}>Pilih Hari Terakhir:</label>
             
             <div style={{ position: 'relative', display: 'inline-block' }}>
                <div 
                    className="form-control"
                    style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                        cursor: 'pointer', background: 'white', width: '160px', padding: '8px 12px',
                        border: '1px solid var(--border-color)', borderRadius: '8px'
                    }}
                >
                    <span style={{ fontWeight: '600', color: '#334155', fontSize:'14px' }}>
                        {formatDateDisplay(selectedDate)}
                    </span>
                    <i className="fa-regular fa-calendar" style={{ color: '#64748b' }}></i>
                </div>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                      position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
                      opacity: 0, cursor: 'pointer', zIndex: 10
                  }}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                />
             </div>
        </div>
      </div>

      <div className="form-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading data...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', width: '200px', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 10 }}>Nama Siswa</th>
                  {dateRange.map((date) => {
                      const isToday = date === selectedDate;
                      return (
                        <th key={date} style={{ padding: '12px', textAlign: 'center', fontSize: '13px', background: isToday ? '#eff6ff' : 'transparent', borderLeft: '1px solid #f1f5f9', color: isToday ? 'var(--primary-blue)' : 'var(--text-dark)', fontWeight: isToday ? '700' : '500' }}>
                            <div style={{fontSize:'10px', color: isToday?'var(--primary-blue)':'#94a3b8', marginBottom:'2px'}}>{new Date(date).toLocaleDateString('id-ID', { weekday: 'short' })}</div>
                            {formatHeaderDate(date)}
                        </th>
                      )
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '14px', fontWeight: '500', color: '#0f172a', position: 'sticky', left: 0, background: 'white', zIndex: 5, boxShadow: '2px 0 5px rgba(0,0,0,0.02)' }}>
                      {student.name}
                    </td>
                    {dateRange.map((date) => {
                        const status = getEffectiveStatus(date, student.id);
                        const style = STATUS_CONFIG[status] || STATUS_CONFIG['-'];
                        const isToday = date === selectedDate;
                        return (
                          <td key={`${student.id}-${date}`} style={{ padding: '8px', textAlign: 'center', background: isToday ? '#fbfdff' : 'transparent', borderLeft: '1px solid #f1f5f9' }}>
                              <select
                                value={status}
                                onChange={(e) => handleStatusChange(date, student.id, e.target.value)}
                                style={{ 
                                    appearance: 'none', 
                                    backgroundColor: style.bg, 
                                    color: style.color, 
                                    border: `1px solid ${style.bg}`, 
                                    borderRadius: '6px', 
                                    padding: '6px 2px', 
                                    width: '100%', 
                                    minWidth: '40px', 
                                    textAlign: 'center', 
                                    fontWeight: 'bold', 
                                    fontSize: '13px', 
                                    cursor: 'pointer', 
                                    outline: 'none' 
                                }}
                              >
                                  <option value="-">-</option>
                                  <option value="?">?</option>
                                  <option value="H">H</option>
                                  <option value="S">S</option>
                                  <option value="I">I</option>
                                  <option value="A">A</option>
                              </select>
                          </td>
                        )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap:'wrap', gap:'15px' }}>
          <div style={{ display: 'flex', gap: '15px', fontSize: '12px', flexWrap:'wrap' }}>
             {Object.keys(STATUS_CONFIG).map(key => {
                 const s = STATUS_CONFIG[key];
                 return (
                     <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                         <span style={{ width:'12px', height:'12px', borderRadius:'3px', background: s.bg, border:`1px solid ${s.color}` }}></span>
                         <span style={{color: s.color, fontWeight:'600'}}>{s.title}</span>
                     </div>
                 )
             })}
          </div>
          <button className="btn-submit" onClick={handleSave} disabled={isSaving || loading} style={{ width: 'auto', padding: '12px 30px', margin:0 }}>
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
      </div>
    </div>
  );
};

export default Absensi;