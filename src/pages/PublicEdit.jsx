import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase'; 
import { toast } from 'sonner';

const PublicEdit = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [formData, setFormData] = useState(null);
  
  // State untuk validasi
  const [isSuccess, setIsSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const fetchStudentByToken = async () => {
      try {
        const q = query(collection(db, "users"), where("editToken", "==", token));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const docData = snap.docs[0];
          const data = docData.data();
          
          const now = Date.now();
          const createdAt = data.editTokenCreatedAt || 0; // Waktu link dibuat
          const oneDay = 24 * 60 * 60 * 1000;

          // 1. CEK: Apakah sudah lewat 24 Jam?
          if (now - createdAt > oneDay) {
            setIsExpired(true);
            setLoading(false);
            return;
          }

          // 2. CEK: Apakah form ini sudah pernah disubmit sebelumnya?
          if (data.editTokenUsed === true) {
            setFormData(data); // Ambil nama anak untuk ditampilkan di pesan sukses
            setIsSuccess(true);
            setLoading(false);
            return;
          }

          // Jika link aman, tampilkan form
          setStudentId(docData.id);
          setFormData(data);
        } else {
          setFormData(null); // Link ngawur / tidak ditemukan
        }
      } catch (error) {
        console.error("Error Firebase:", error);
        alert("Gagal mengambil data dari database! Error: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentByToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Menyimpan data dan MENGUBAH STATUS token menjadi TERPAKAI
      await updateDoc(doc(db, "users", studentId), {
        ...formData,
        editTokenUsed: true // <-- Ini yang mengunci link agar tidak bisa dipakai 2x
      });
      setIsSuccess(true);
    } catch (error) {
      toast.error("Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  // --- TAMPILAN JIKA LOADING ---
  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Memuat formulir...</div>;
  
  // --- TAMPILAN JIKA KADALUARSA (LEBIH DARI 24 JAM) ---
  if (isExpired) return (
    <div style={{ textAlign: 'center', padding: '50px', color: '#dc2626', maxWidth: '400px', margin: '0 auto' }}>
      <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '40px', marginBottom: '15px' }}></i>
      <h3>Link Kadaluarsa</h3>
      <p style={{ color: '#64748b' }}>Maaf, link ini sudah melewati batas waktu 24 jam. Silakan hubungi admin sekolah untuk meminta link baru.</p>
    </div>
  );

  // --- TAMPILAN JIKA LINK TIDAK VALID / TOKEN SALAH ---
  if (!formData && !isSuccess) return <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>Link tidak valid atau tidak ditemukan.</div>;
  
  // --- TAMPILAN JIKA BERHASIL SUBMIT (ATAU JIKA DIBUKA LAGI DI TAB/DEVICE LAIN) ---
  if (isSuccess) return (
    <div style={{ textAlign: 'center', padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <i className="fa-solid fa-circle-check" style={{ fontSize: '50px', color: '#16a34a', marginBottom: '20px' }}></i>
      <h3>Terima Kasih!</h3>
      <p style={{ color: '#64748b', lineHeight: '1.6' }}>
        Data ananda <b>{formData?.fullName || formData?.nickname}</b> berhasil diperbarui.<br/>Anda boleh menutup halaman ini.
      </p>
    </div>
  );

  // --- TAMPILAN FORM UTAMA JIKA SEMUA AMAN ---
  return (
    <div style={{ 
      backgroundColor: '#f8fafc', 
      height: '100vh', 
      width: '100%', 
      overflowY: 'auto', 
      position: 'fixed', 
      top: 0, 
      left: 0,
      zIndex: 9999 
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ textAlign: 'center', color: '#334155', marginBottom: '5px' }}>Pembaruan Data Siswa</h2>
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>Mohon periksa dan lengkapi data di bawah ini dengan benar.</p>

          <form onSubmit={handleSubmit}>
            
            {/* --- DATA ANAK --- */}
            <h4 style={{ color: '#475569', borderBottom: '2px solid #e2e8f0', paddingBottom: '5px' }}>Data Anak</h4>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>Nama Lengkap Anak</label>
              <input type="text" className="form-control" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Tempat Lahir Anak</label>
                <input type="text" className="form-control" value={formData.birthPlace || ''} onChange={e => setFormData({...formData, birthPlace: e.target.value})} required />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Tanggal Lahir Anak</label>
                <input type="date" className="form-control" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>NIK Anak</label>
                <input type="number" className="form-control" value={formData.nik || ''} onChange={e => setFormData({...formData, nik: e.target.value})} required />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>No. Kartu Keluarga (KK)</label>
                <input type="number" className="form-control" value={formData.noKK || ''} onChange={e => setFormData({...formData, noKK: e.target.value})} required />
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>Alamat Lengkap (Domisili / Sesuai KK)</label>
              <textarea className="form-control" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} required style={{ height: '60px' }}></textarea>
            </div>

            {/* --- DATA AYAH --- */}
            <h4 style={{ color: '#475569', borderBottom: '2px solid #e2e8f0', paddingBottom: '5px', marginTop: '25px' }}>Data Ayah</h4>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>Nama Lengkap Ayah</label>
              <input type="text" className="form-control" value={formData.fatherName || ''} onChange={e => setFormData({...formData, fatherName: e.target.value})} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Tempat Lahir Ayah</label>
                <input type="text" className="form-control" value={formData.fatherBirthPlace || ''} onChange={e => setFormData({...formData, fatherBirthPlace: e.target.value})} required />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Tanggal Lahir Ayah</label>
                <input type="date" className="form-control" value={formData.fatherBirthDate || ''} onChange={e => setFormData({...formData, fatherBirthDate: e.target.value})} required />
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>NIK Ayah</label>
              <input type="number" className="form-control" value={formData.fatherNik || ''} onChange={e => setFormData({...formData, fatherNik: e.target.value})} required />
            </div>

            {/* --- DATA IBU --- */}
            <h4 style={{ color: '#475569', borderBottom: '2px solid #e2e8f0', paddingBottom: '5px', marginTop: '25px' }}>Data Ibu</h4>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>Nama Lengkap Ibu</label>
              <input type="text" className="form-control" value={formData.motherName || ''} onChange={e => setFormData({...formData, motherName: e.target.value})} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Tempat Lahir Ibu</label>
                <input type="text" className="form-control" value={formData.motherBirthPlace || ''} onChange={e => setFormData({...formData, motherBirthPlace: e.target.value})} required />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Tanggal Lahir Ibu</label>
                <input type="date" className="form-control" value={formData.motherBirthDate || ''} onChange={e => setFormData({...formData, motherBirthDate: e.target.value})} required />
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>NIK Ibu</label>
              <input type="number" className="form-control" value={formData.motherNik || ''} onChange={e => setFormData({...formData, motherNik: e.target.value})} required />
            </div>

            <button type="submit" disabled={saving} style={{ width: '100%', padding: '15px', marginTop: '20px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              {saving ? 'Menyimpan Data...' : 'Kirim Pembaruan Data'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default PublicEdit;