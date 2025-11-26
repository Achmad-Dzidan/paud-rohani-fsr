import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, getDocs, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const Absensi = () => {
  const { toggleSidebar } = useOutletContext();

  // STATE
  const [students, setStudents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState([]); // Array 7 tanggal
  
  // Data Cache
  const [attendanceData, setAttendanceData] = useState({}); // { "2025-11-25": { userId: 'H' } }
  const [incomeData, setIncomeData] = useState({}); // { "2025-11-25": Set(userIds) }
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Enum Status
  const STATUS_CONFIG = {
    '?': { label: '?', color: '#94a3b8', bg: '#f1f5f9', title: 'Belum diabsen' },
    'H': { label: 'H', color: '#15803d', bg: '#dcfce7', title: 'Hadir' },
    'S': { label: 'S', color: '#854d0e', bg: '#fef9c3', title: 'Sakit' },
    'I': { label: 'I', color: '#1e40af', bg: '#dbeafe', title: 'Izin' },
    'A': { label: 'A', color: '#991b1b', bg: '#fee2e2', title: 'Alpha' },
  };

  // 1. GENERATE 7 HARI TERAKHIR
  // 1. GENERATE 7 HARI SEKOLAH TERAKHIR (SKIP SABTU & MINGGU)
  useEffect(() => {
    const dates = [];
    let currentDate = new Date(selectedDate);
    let count = 0;

    // Loop mundur sampai kita mendapatkan 7 hari kerja (Senin-Jumat)
    while (count < 7) {
      const dayNum = currentDate.getDay(); // 0 = Minggu, 6 = Sabtu

      // Cek: Jika BUKAN Minggu (0) DAN BUKAN Sabtu (6)
      if (dayNum !== 0 && dayNum !== 6) {
        // Masukkan ke awal array (unshift) agar urutannya dari kiri (lama) ke kanan (baru)
        dates.unshift(currentDate.toISOString().split('T')[0]);
        count++;
      }

      // Mundur 1 hari ke belakang
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

  // 3. FETCH ATTENDANCE & INCOME (Untuk 7 Hari)
  useEffect(() => {
    if (dateRange.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      const startDate = dateRange[0];
      const endDate = dateRange[dateRange.length - 1];

      try {
        // A. Ambil Data Absensi (Existing)
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

        // B. Ambil Data Income (Untuk Logika Otomatis)
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
          incMap[t.date].add(t.userId); // Catat user yg bayar di tgl ini
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
  }, [dateRange]); // Rerun jika range tanggal berubah

// 4. HELPER: Tentukan Status Efektif
  const getEffectiveStatus = (date, userId) => {
    const manualStatus = attendanceData[date] && attendanceData[date][userId];
    const hasIncome = incomeData[date] && incomeData[date].has(userId);

    // LOGIKA BARU:
    // 1. Jika guru secara sadar memilih H/S/I/A (bukan '?'), hormati pilihan guru.
    if (manualStatus && manualStatus !== '?') {
      return manualStatus;
    }

    // 2. Jika statusnya masih '?' atau kosong, TAPI ada data Income -> Otomatis 'H'
    if (hasIncome) {
      return 'H';
    }

    // 3. Jika tidak ada apa-apa, kembalikan status manual (walau '?') atau default '?'
    return manualStatus || '?';
  };

  // 5. HANDLE CHANGE CELL
  const handleStatusChange = (date, userId, newStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [userId]: newStatus
      }
    }));
  };

  // 6. SAVE ALL CHANGES
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      // Loop setiap tanggal di rentang view sekarang
      dateRange.forEach(dateStr => {
        const docRef = doc(db, "attendance", dateStr);
        
        // Kita harus menyusun record lengkap untuk tanggal tersebut
        // Menggabungkan logika otomatis ('H' dari income) menjadi data permanen
        const recordsToSave = {};
        
        students.forEach(student => {
          // Ambil status apa yang sedang tampil di layar (termasuk yang otomatis)
          // Saat disimpan, status otomatis 'H' akan menjadi permanen di DB
          recordsToSave[student.id] = getEffectiveStatus(dateStr, student.id);
        });

        batch.set(docRef, {
          date: dateStr,
          records: recordsToSave,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      toast.success("Data absensi 7 hari berhasil disimpan!");
    } catch (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper Format Header (dd/mm)
  const formatHeaderDate = (dateStr) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  return (
    <div style={{ width: '100%' }}>
      
      {/* --- HEADER --- */}
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="mobile-toggle-btn" onClick={toggleSidebar}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="page-title">
            <h1>Absensi Matriks</h1>
            <p>Rekap kehadiran 7 hari terakhir</p>
          </div>
        </div>

        {/* DATE PICKER (End Date) */}
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
             <label style={{fontSize:'11px', color:'var(--text-gray)', marginBottom:'4px'}}>Pilih Hari Terakhir:</label>
             <input 
              type="date" 
              className="form-control"
              style={{ maxWidth: '150px', cursor:'pointer', padding:'8px' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
        </div>
      </div>

      {/* --- MATRIX TABLE --- */}
      <div className="form-card" style={{ padding: '0', overflow: 'hidden' }}>
        
        {loading ? (
          <p style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading data...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', width: '200px', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 10 }}>Nama Siswa</th>
                  
                  {/* Render 7 Hari Header */}
                  {dateRange.map((date, index) => {
                      const isToday = date === selectedDate;
                      return (
                        <th key={date} style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            fontSize: '13px',
                            background: isToday ? '#eff6ff' : 'transparent', // Highlight hari terakhir
                            borderLeft: '1px solid #f1f5f9',
                            color: isToday ? 'var(--primary-blue)' : 'var(--text-dark)',
                            fontWeight: isToday ? '700' : '500'
                        }}>
                            <div style={{fontSize:'10px', color: isToday?'var(--primary-blue)':'#94a3b8', marginBottom:'2px'}}>
                                {new Date(date).toLocaleDateString('id-ID', { weekday: 'short' })}
                            </div>
                            {formatHeaderDate(date)}
                        </th>
                      )
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ 
                        padding: '12px', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#0f172a',
                        position: 'sticky', left: 0, background: 'white', zIndex: 5,
                        boxShadow: '2px 0 5px rgba(0,0,0,0.02)'
                    }}>
                      {student.name}
                    </td>

                    {/* Render 7 Kolom Absen */}
                    {dateRange.map((date) => {
                        const status = getEffectiveStatus(date, student.id);
                        const style = STATUS_CONFIG[status] || STATUS_CONFIG['?'];
                        const isToday = date === selectedDate;

                        return (
                          <td key={`${student.id}-${date}`} style={{ 
                              padding: '8px', 
                              textAlign: 'center',
                              background: isToday ? '#fbfdff' : 'transparent',
                              borderLeft: '1px solid #f1f5f9'
                          }}>
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

      {/* --- LEGEND & SAVE --- */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap:'wrap', gap:'15px' }}>
          
          {/* Legenda Warna */}
          <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
             {Object.keys(STATUS_CONFIG).map(key => {
                 if(key === '?') return null;
                 const s = STATUS_CONFIG[key];
                 return (
                     <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                         <span style={{ width:'12px', height:'12px', borderRadius:'3px', background: s.bg, border:`1px solid ${s.color}` }}></span>
                         <span style={{color: s.color, fontWeight:'600'}}>{s.title}</span>
                     </div>
                 )
             })}
          </div>

          <button 
            className="btn-submit" 
            onClick={handleSave} 
            disabled={isSaving || loading}
            style={{ width: 'auto', padding: '12px 30px', margin:0 }}
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
      </div>

    </div>
  );
};

export default Absensi;