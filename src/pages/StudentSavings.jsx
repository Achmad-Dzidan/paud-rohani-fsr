import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const StudentSavings = () => {
  const { toggleSidebar } = useOutletContext();

  // STATE
  const [students, setStudents] = useState([]);
  const [savingsData, setSavingsData] = useState({}); // { userId: 500000 }
  const [loading, setLoading] = useState(true);

  // 1. FETCH DATA (Users & Transactions)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // A. Ambil Data Siswa (Update untuk ambil foto)
        const usersSnap = await getDocs(collection(db, "users"));
        const usersList = usersSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          nickname: doc.data().nickname, // Ambil nickname
          photo: doc.data().photo // Ambil foto
        }));

        // B. Ambil Semua Transaksi untuk Hitung Saldo
        const transSnap = await getDocs(collection(db, "transactions"));
        const balances = {};

        transSnap.forEach(doc => {
          const t = doc.data();
          const uid = t.userId;
          const amount = parseInt(t.amount) || 0;

          if (!balances[uid]) balances[uid] = 0;

          // Rumus: Income menambah saldo, Expense mengurangi saldo
          if (t.type === 'income') {
            balances[uid] += amount;
          } else if (t.type === 'expense') {
            balances[uid] -= amount;
          }
        });

        // Simpan ke State
        setStudents(usersList);
        setSavingsData(balances);
        setLoading(false);

      } catch (error) {
        console.error(error);
        toast.error("Gagal memuat data tabungan.");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // HELPER: Format Rupiah
  const formatRupiah = (num) => {
    return "Rp " + new Intl.NumberFormat('id-ID').format(num);
  };

  // HELPER: Initials Avatar
  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : "S";
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
            <h1>Student Savings</h1>
            <p>Total saldo tabungan setiap siswa</p>
          </div>
        </div>
      </div>

      {/* --- GRID TABUNGAN --- */}
      <div className="user-grid">
        {loading ? (
          <p style={{ color: 'var(--text-gray)' }}>Menghitung saldo...</p>
        ) : students.length === 0 ? (
          <p style={{ color: 'var(--text-gray)' }}>Belum ada siswa.</p>
        ) : (
          students.map((student) => {
            const balance = savingsData[student.id] || 0;
            
            return (
              <div className="user-card" key={student.id} style={{ alignItems: 'center' }}>
                
                {/* Bagian Kiri: Avatar & Nama */}
                <div className="user-info-wrapper">
                  {/* Avatar Dynamic */}
                  <div className="avatar" style={{ 
                      backgroundColor: student.photo ? 'transparent' : 'var(--primary-blue)',
                      backgroundImage: student.photo ? `url(${student.photo})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '1px solid #e2e8f0',
                      color: student.photo ? 'transparent' : 'white' // Sembunyikan teks jika ada foto
                  }}>
                    {!student.photo && getInitials(student.nickname || student.name)}
                  </div>
                  <div className="info">
                    <h3 style={{ fontSize: '15px' }}>{student.name}</h3>
                    <p style={{ fontSize: '12px' }}>Total Saldo</p>
                  </div>
                </div>

                {/* Bagian Kanan: Nominal */}
                <div style={{ textAlign: 'right' }}>
                   <div style={{ 
                       fontSize: '16px', 
                       fontWeight: '700', 
                       color: balance >= 0 ? 'var(--primary-blue)' : 'var(--danger-red)' 
                   }}>
                      {formatRupiah(balance)}
                   </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default StudentSavings;