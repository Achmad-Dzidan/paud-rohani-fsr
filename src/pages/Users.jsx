import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { toast } from 'sonner';

// Library Export
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const Users = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE ---
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Modal CRUD & Detail
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // State Modal Export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTarget, setExportTarget] = useState('all'); // 'all' atau userId specific

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  // State Form Lengkap
  const [formData, setFormData] = useState({
    id: '', fullName: '', nickname: '', className: 'A', photo: '',
    nisn: '', nik: '', birthPlace: '', birthDate: '', gender: 'L', address: '', status: 'Aktif',
    noKK: '', // TAMBAHAN
    fatherName: '', fatherNik: '', fatherBirthPlace: '', fatherBirthDate: '', // TAMBAHAN
    motherName: '', motherNik: '', motherBirthPlace: '', motherBirthDate: '', // TAMBAHAN
    guardianName: ''
  });

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. REAL-TIME FETCH
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      toast.error("Gagal memuat users");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Pastikan yang diupload adalah gambar
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar!');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        // --- PROSES KOMPRESI DENGAN CANVAS ---
        const canvas = document.createElement('canvas');

        // Tentukan resolusi maksimal (300px sudah sangat cukup untuk foto profil)
        // Ini akan membuat string Base64 menjadi sangat ringan
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        // Hitung rasio aspek agar gambar tidak gepeng
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Gambar ulang foto ke dalam canvas dengan ukuran baru
        ctx.drawImage(img, 0, 0, width, height);

        // Ekspor canvas menjadi Base64 (Format JPEG, Kualitas 60%)
        // Kualitas 0.6 sangat optimal (ukuran kecil, gambar masih jelas)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

        // Simpan hasil kompresi ke state formData
        setFormData({ ...formData, photo: compressedBase64 });
      };
    };
  };

  // --- HANDLERS CRUD ---

  const handleCardClick = (user) => { setSelectedUser(user); setShowDetailModal(true); };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: '', fullName: '', nickname: '', className: 'A', photo: '',
      nisn: '', nik: '', birthPlace: '', birthDate: '',
      gender: 'L', address: '',
      fatherName: '', motherName: '', guardianName: '',
      status: 'Aktif'
    });
    setShowModal(true);
  };

  const handleOpenEdit = () => {
    if (!selectedUser) return;
    setIsEditing(true);
    setFormData({
      id: selectedUser.id,
      fullName: selectedUser.fullName || selectedUser.name,
      nickname: selectedUser.nickname || selectedUser.name,
      className: selectedUser.className || 'A',
      photo: selectedUser.photo || '',
      nisn: selectedUser.nisn || '',
      nik: selectedUser.nik || '',
      birthPlace: selectedUser.birthPlace || '',
      birthDate: selectedUser.birthDate || '',
      gender: selectedUser.gender || 'L',
      address: selectedUser.address || '',
      fatherName: selectedUser.fatherName || '',
      motherName: selectedUser.motherName || '',
      guardianName: selectedUser.guardianName || '',
      status: selectedUser.status || 'Aktif'
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.nickname.trim()) { toast.error("Nama Lengkap & Panggilan wajib diisi"); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.nickname,
        fullName: formData.fullName,
        nickname: formData.nickname,
        className: formData.className,
        photo: formData.photo,
        nisn: formData.nisn, nik: formData.nik,
        birthPlace: formData.birthPlace, birthDate: formData.birthDate,
        gender: formData.gender, address: formData.address,
        fatherName: formData.fatherName, motherName: formData.motherName, guardianName: formData.guardianName,
        status: formData.status,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        await updateDoc(doc(db, "users", formData.id), payload);
        toast.success("Data siswa diperbarui!");
      } else {
        await addDoc(collection(db, "users"), { ...payload, createdAt: serverTimestamp() });
        toast.success("Siswa baru ditambahkan!");
      }

      setShowModal(false);
    } catch (error) { toast.error("Gagal menyimpan: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (window.confirm(`Yakin ingin menghapus data "${selectedUser.nickname}"?`)) {
      try {
        await deleteDoc(doc(db, "users", selectedUser.id));
        toast.success("User dihapus.");
        setShowDetailModal(false);
      } catch (error) { toast.error("Gagal menghapus: " + error.message); }
    }
  };

  // --- HELPERS UTILS ---
  const calculateAgeString = (birthDateStr) => {
    if (!birthDateStr) return "";
    const today = new Date();
    const birthDate = new Date(birthDateStr);
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) { years--; months += 12; }
    if (today.getDate() < birthDate.getDate()) { months--; }
    if (months < 0) { months += 12; }
    return `${years} Tahun ${months} Bulan`;
  };

  const formatDateDisplay = (isoDate) => {
    if (!isoDate) return "-";
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const isDataIncomplete = (user) => {
    return !user.nisn || !user.nik || !user.birthDate || !user.fatherName || !user.motherName;
  };

  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "U";

  // --- LOGIC FILTER EXPORT ---
  const getFilteredDataForExport = () => {
    if (exportTarget === 'all') {
      return users;
    } else {
      return users.filter(u => u.id === exportTarget);
    }
  };

  const formatGenderFull = (genderCode) => {
    return genderCode === 'L' ? 'Laki-laki' : 'Perempuan';
  };

  // --- HANDLERS EXPORT PDF ---
  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    const dataToExport = getFilteredDataForExport();

    // Judul
    doc.setFontSize(14);
    doc.text('Data Siswa PAUD', 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 20);

    // Sub-judul jika single user
    if (exportTarget !== 'all') {
      doc.text(`Filter: ${dataToExport[0]?.fullName || '-'}`, 14, 25);
    }

    // Definisi Kolom & Baris (Dipecah TTL, Gender Full)
    const tableColumn = [
      "No", "Nama Lengkap", "NISN", "NIK",
      "Tempat Lahir", "Tanggal Lahir", "Jenis Kelamin",
      "Alamat", "Ayah", "Ibu", "Wali"
    ];

    const tableRows = [];

    dataToExport.forEach((user, index) => {
      const rowData = [
        index + 1,
        user.fullName || user.name,
        user.nisn || '-',
        user.nik || '-',
        user.birthPlace || '-',
        formatDateDisplay(user.birthDate), // Kolom Tanggal Lahir sendiri
        formatGenderFull(user.gender),     // Gender Full
        user.address || '-',
        user.fatherName || '-',
        user.motherName || '-',
        user.guardianName || '-'
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: exportTarget !== 'all' ? 30 : 25,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        6: { halign: 'center', cellWidth: 20 }, // Jenis Kelamin
      }
    });

    doc.save(`Data_Siswa_${new Date().getTime()}.pdf`);
    setShowExportModal(false);
    toast.success("PDF berhasil diunduh!");
  };

  // --- HANDLERS EXPORT EXCEL ---
  const handleExportExcel = () => {
    const dataToExport = getFilteredDataForExport();

    // Map Data sesuai format Excel (Dipecah TTL, Gender Full)
    const excelData = dataToExport.map((user, index) => ({
      "No": index + 1,
      "Nama Lengkap": user.fullName || user.name,
      "NISN": user.nisn || '-',
      "NIK": user.nik || '-',
      "Tempat Lahir": user.birthPlace || '-',
      "Tanggal Lahir": formatDateDisplay(user.birthDate),
      "Jenis Kelamin": formatGenderFull(user.gender),
      "Alamat": user.address || '-',
      "Nama Ayah": user.fatherName || '-',
      "Nama Ibu": user.motherName || '-',
      "Nama Wali": user.guardianName || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto width kolom (opsional, biar rapi)
    const wscols = [
      { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");

    XLSX.writeFile(workbook, `Data_Siswa_${new Date().getTime()}.xlsx`);
    setShowExportModal(false);
    toast.success("Excel berhasil diunduh!");
  };

  // Helper: Hapus tanda petik di awal angka
  const cleanNumber = (val) => {
    if (!val) return '';
    return String(val).replace(/^'/, '').trim();
  };

  // Helper: Format Sentence Case / Title Case (Huruf depan besar)
  const toSentenceCase = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/(?:^|\s)\w/g, (match) => {
      return match.toUpperCase();
    });
  };

  // Helper: Format Tanggal (Support: 4 Februari 2022, 04/02/2022, dan Format Excel native)
  const parseImportDate = (dateStr) => {
    if (!dateStr) return '';
    let str = String(dateStr).trim();

    // Jika terbaca sebagai format serial date Excel (angka murni)
    if (!isNaN(str) && !str.includes('/') && !str.includes('-')) {
      const excelEpoch = new Date(1899, 11, 30);
      const dateObj = new Date(excelEpoch.getTime() + parseInt(str) * 86400000);
      return dateObj.toISOString().split('T')[0];
    }

    // Jika format DD/MM/YYYY
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    // Jika format teks (4 Februari 2022)
    const months = {
      'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
      'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
      'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
    };
    const parts = str.toLowerCase().split(' ');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = months[parts[1]] || '01';
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }

    return ''; // Return kosong jika format tidak dikenali
  };

  // Download Template Excel
  const handleDownloadTemplate = () => {
    const headers = [
      "Nama Lengkap", "Nama Panggilan", "Kelas (A/B)", "Jenis Kelamin (L/P)", 
      "Tempat Lahir", "Tanggal Lahir", "Status (Aktif/Tidak Aktif/Lulus)", "NISN", "NIK", "No KK", "Alamat",
      "Nama Ayah", "NIK Ayah", "Tempat Lahir Ayah", "Tanggal Lahir Ayah",
      "Nama Ibu", "NIK Ibu", "Tempat Lahir Ibu", "Tanggal Lahir Ibu",
      "Nama Wali"
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, "Template_Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
  };

  // Handle File Upload & Parsing
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      // Mapping & Formatting Data
      const formattedData = data.map(row => ({
        fullName: toSentenceCase(row["Nama Lengkap"]),
        nickname: toSentenceCase(row["Nama Panggilan"]),
        className: row["Kelas (A/B)"] || 'A',
        gender: row["Jenis Kelamin (L/P)"] || 'L',
        birthPlace: toSentenceCase(row["Tempat Lahir"]),
        birthDate: parseImportDate(row["Tanggal Lahir"]),
        status: row["Status (Aktif/Tidak Aktif/Lulus)"] || 'Aktif',
        nisn: cleanNumber(row["NISN"]),
        nik: cleanNumber(row["NIK"]),
        noKK: cleanNumber(row["No KK"]),
        address: toSentenceCase(row["Alamat"]),
        fatherName: toSentenceCase(row["Nama Ayah"]),
        fatherNik: cleanNumber(row["NIK Ayah"]),
        fatherBirthPlace: toSentenceCase(row["Tempat Lahir Ayah"]),
        fatherBirthDate: parseImportDate(row["Tanggal Lahir Ayah"]),
        motherName: toSentenceCase(row["Nama Ibu"]),
        motherNik: cleanNumber(row["NIK Ibu"]),
        motherBirthPlace: toSentenceCase(row["Tempat Lahir Ibu"]),
        motherBirthDate: parseImportDate(row["Tanggal Lahir Ibu"]),
        guardianName: toSentenceCase(row["Nama Wali"]),
      }));

      setImportPreviewData(formattedData);
      setImportResults(null); // Reset result jika ada
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // Reset input file
  };

  // Handle Confirm Import ke Firebase (Dengan Logika Timpa/Update)
  const handleConfirmImport = async () => {
    setIsImporting(true);
    let insertCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    try {
      // 1. Ambil data siswa yang sudah ada di Firebase (agar efisien)
      const usersSnap = await getDocs(collection(db, "users"));
      const existingUsers = {};
      
      usersSnap.forEach(document => {
        const data = document.data();
        // Buat index pencarian berdasarkan nickname (atau fullName jika nickname kosong)
        // Kita ubah ke huruf kecil (toLowerCase) agar "Budi" dan "budi" dianggap sama
        if (data.nickname) existingUsers[data.nickname.toLowerCase()] = document.id;
        else if (data.fullName) existingUsers[data.fullName.toLowerCase()] = document.id;
      });

      // 2. Looping data dari Excel
      for (const student of importPreviewData) {
        if (!student.fullName) {
          errorCount++;
          continue; // Lewati jika tidak ada nama lengkap
        }
        
        // Tentukan kata kunci pencarian dari baris excel ini
        const searchKey = student.nickname 
          ? student.nickname.toLowerCase() 
          : student.fullName.toLowerCase();

        const existingDocId = existingUsers[searchKey];
        
        const payload = {
          ...student,
          name: student.nickname || student.fullName, // Fallback untuk legacy sistem
          updatedAt: serverTimestamp()
        };

        if (existingDocId) {
          // JIKA SUDAH ADA -> TIMPA/UPDATE DATA
          await updateDoc(doc(db, "users", existingDocId), payload);
          updateCount++;
        } else {
          // JIKA BELUM ADA -> TAMBAH DATA BARU
          payload.createdAt = serverTimestamp();
          const newDocRef = await addDoc(collection(db, "users"), payload);
          
          // Tambahkan ke dictionary lokal (mencegah duplikat jika di excel ada 2 nama yg sama)
          existingUsers[searchKey] = newDocRef.id; 
          insertCount++;
        }
      }

      setImportResults({ success: insertCount + updateCount, inserted: insertCount, updated: updateCount, error: errorCount });
      toast.success(`Import Selesai: ${insertCount} Baru, ${updateCount} Diperbarui`);

    } catch (error) {
      console.error("Gagal melakukan import:", error);
      toast.error("Terjadi kesalahan sistem saat proses import.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>

      <style>
        {`
          .custom-scroll::-webkit-scrollbar { width: 6px; }
          .custom-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
          .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}
      </style>

      {/* HEADER */}
      <div className="header-section">
        <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className="mobile-toggle-btn floating-menu-btn" // Tambahkan class floating-menu-btn
            onClick={toggleSidebar}
            style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              zIndex: 9999,
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              // HAPUS baris 'display' dari sini
            }}
          >
            <i className="fa-solid fa-bars" style={{ color: '#334155', fontSize: '16px' }}></i>
          </button>
          <div className="page-title" style={{ marginLeft: windowWidth < 768 ? '50px' : '0' }}><h1>Student Management</h1><p>Kelola data profil siswa</p></div>
        </div>

        {/* --- TOMBOL HEADER --- */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* TOMBOL IMPORT */}
          <button 
            className="btn-add" 
            onClick={() => { setShowImportModal(true); setImportPreviewData([]); setImportResults(null); }} 
            style={{ backgroundColor: '#0284c7' }}
          >
            <i className="fa-solid fa-file-import" style={{ marginRight: '8px' }}></i> Import
          </button>

          <button
            className="btn-add"
            onClick={() => setShowExportModal(true)}
            style={{ backgroundColor: '#16a34a' }}
          >
            <i className="fa-solid fa-file-export" style={{ marginRight: '8px' }}></i> Export
          </button>

          <button className="btn-add" onClick={handleOpenAdd}>
            <i className="fa-solid fa-user-plus"></i> Add User
          </button>
        </div>


      {/* --- MODAL IMPORT --- */}
        {showImportModal && (
          <div className="modal-overlay active" style={{ display: 'flex' }}>
            <div className="modal-box" style={{ maxWidth: '800px', width: '100%' }}>
              <div className="modal-header">
                <h3>Import Data Siswa (Excel)</h3>
                <button className="close-modal" onClick={() => setShowImportModal(false)}>&times;</button>
              </div>

              <div className="modal-body custom-scroll" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                
                {/* Hasil Import */}
                {importResults && (
                  <div style={{ padding: '15px', marginBottom: '15px', borderRadius: '8px', backgroundColor: importResults.error > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${importResults.error > 0 ? '#fecaca' : '#bbf7d0'}` }}>
                    <h4 style={{ margin: '0 0 10px 0', color: importResults.error > 0 ? '#dc2626' : '#16a34a' }}>Laporan Import Selesai</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155' }}>
                      <li><b>{importResults.inserted}</b> siswa baru berhasil ditambahkan.</li>
                      <li><b>{importResults.updated}</b> data siswa lama berhasil diperbarui (ditimpa).</li>
                      {importResults.error > 0 && (
                        <li style={{ color: '#dc2626' }}><b>{importResults.error}</b> baris gagal diproses (Nama Lengkap kosong).</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Area Drag & Drop / Upload */}
                {!importResults && importPreviewData.length === 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Gunakan template agar sesuai dengan format sistem.</p>
                      <button type="button" onClick={handleDownloadTemplate} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#334155' }}>
                        <i className="fa-solid fa-download" style={{ marginRight: '5px' }}></i> Download Template
                      </button>
                    </div>

                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      height: '150px', border: '2px dashed #94a3b8', borderRadius: '12px', backgroundColor: '#f8fafc',
                      cursor: 'pointer', transition: '0.3s'
                    }}>
                      <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '30px', color: '#cbd5e1', marginBottom: '10px' }}></i>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>Klik atau Drag file Excel kesini</span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Format didukung: .xlsx, .xls</span>
                      <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} />
                    </label>
                  </>
                )}

                {/* Tabel Preview */}
                {!importResults && importPreviewData.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13px', color: '#334155', marginBottom: '10px' }}>Preview Data ({importPreviewData.length} baris)</h4>
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                          <tr>
                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Nama Lengkap</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>NIK</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>No KK</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Tanggal Lahir</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Nama Ayah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreviewData.slice(0, 10).map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>{row.fullName}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>{row.nik}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>{row.noKK}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>{row.birthDate}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>{row.fatherName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importPreviewData.length > 10 && <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>*Hanya menampilkan 10 baris pertama</p>}
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn-cancel" onClick={() => { setShowImportModal(false); setImportPreviewData([]); }} disabled={isImporting}>Tutup</button>
                
                {!importResults && importPreviewData.length > 0 && (
                  <button className="btn-save" onClick={handleConfirmImport} disabled={isImporting}>
                    {isImporting ? 'Memproses...' : 'Konfirmasi Import'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GRID USERS GROUPED BY STATUS */}
      {loading ? (
        <p style={{ color: 'var(--text-gray)' }}>Loading users...</p>
      ) : users.length === 0 ? (
        <p style={{ color: 'var(--text-gray)' }}>Belum ada siswa.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

          {/* --- MODIFIKASI: PENAMBAHAN KATEGORI BARU --- */}
          {[
            { title: 'Siswa Aktif', statusTarget: 'Aktif', color: '#16a34a' },
            { title: 'Tidak Aktif', statusTarget: 'Tidak Aktif', color: '#dc2626' },
            { title: 'Alumni (Lulus)', statusTarget: 'Lulus', color: '#2563eb' },
            { title: 'Bukan Murid PAUD', statusTarget: 'Bukan Murid PAUD', color: '#8b5cf6' } // Tambahan baru
          ].map((group) => {
            // Filter user berdasarkan status (jika tidak ada status, anggap 'Aktif')
            const filteredUsers = users.filter(u =>
              (u.status || 'Aktif') === group.statusTarget
            );

            // Jika tidak ada siswa di grup ini, sembunyikan section-nya
            if (filteredUsers.length === 0) return null;

            return (
              <div key={group.statusTarget}>
                {/* HEADER SECTION */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: group.color }}></div>
                  <h3 style={{ fontSize: '15px', color: '#334155', margin: 0, fontWeight: '700' }}>
                    {group.title} <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'normal' }}>({filteredUsers.length})</span>
                  </h3>
                </div>

                {/* THE GRID */}
                <div className="user-grid">
                  {filteredUsers.map((user) => (
                    <div
                      className="user-card"
                      key={user.id}
                      style={{ position: 'relative', cursor: 'pointer' }}
                      onClick={() => handleCardClick(user)}
                    >
                      {isDataIncomplete(user) && (
                        <div style={{
                          position: 'absolute', top: 10, right: 10,
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'var(--danger-red)', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} title="Data Belum Lengkap">!</div>
                      )}

                      {/* --- INDIKATOR WARNA KARTU --- */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
                        backgroundColor: group.color, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px'
                      }}></div>
                      {/* --------------------------------------------------------- */}

                      <div className="user-info-wrapper" style={{ paddingLeft: '8px' }}>
                        <div className="avatar" style={{
                          backgroundColor: user.photo ? 'transparent' : 'var(--primary-blue)',
                          backgroundImage: user.photo ? `url(${user.photo})` : 'none',
                          backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e2e8f0'
                        }}>
                          {!user.photo && getInitials(user.nickname || user.name)}
                        </div>
                        <div className="info">
                          <h3 style={{ fontSize: '16px' }}>{user.nickname || user.name}</h3>
                          <p style={{ fontSize: '12px', color: '#64748b' }}>Kelas {user.className || 'A'} • {user.fullName || user.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL EXPORT --- */}
      {showExportModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowExportModal(false)}>
          <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
              <h3>Export Data Siswa</h3>
              <button className="close-modal" style={{ position: 'absolute', right: 0 }} onClick={() => setShowExportModal(false)}>&times;</button>
            </div>

            <div className="modal-body" style={{ padding: '20px 0' }}>
              <label style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '600', marginBottom: '5px' }}>Pilih Siswa</label>
              <select
                className="form-control"
                style={{ marginBottom: '20px' }}
                value={exportTarget}
                onChange={(e) => setExportTarget(e.target.value)}
              >
                <option value="all">Semua Siswa (Default)</option>
                {/* Loop semua siswa agar bisa dipilih perorangan */}
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.name}
                  </option>
                ))}
              </select>

              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '15px' }}>Export to:</p>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button
                  onClick={handleExportPDF}
                  style={{
                    background: '#ef4444', color: 'white', border: 'none',
                    padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600'
                  }}
                >
                  <i className="fa-solid fa-file-pdf"></i> PDF
                </button>

                <button
                  onClick={handleExportExcel}
                  style={{
                    background: '#16a34a', color: 'white', border: 'none',
                    padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600'
                  }}
                >
                  <i className="fa-solid fa-file-excel"></i> Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DETAIL --- */}
      {showDetailModal && selectedUser && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowDetailModal(false)}>
          <div className="modal-box custom-scroll" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Profil Siswa</h3>
              <button className="close-modal" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>

            <div className="modal-body custom-scroll" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  backgroundImage: selectedUser.photo ? `url(${selectedUser.photo})` : 'none',
                  backgroundColor: selectedUser.photo ? 'transparent' : 'var(--primary-blue)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '32px', fontWeight: 'bold', border: '4px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {!selectedUser.photo && getInitials(selectedUser.nickname || selectedUser.name)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '13px' }}>
                <div style={{ gridColumn: 'span 2' }}><label style={{ color: '#64748b', fontSize: '11px' }}>Nama Lengkap</label><div style={{ fontWeight: '600', fontSize: '15px' }}>{selectedUser.fullName || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Panggilan</label><div style={{ fontWeight: '600' }}>{selectedUser.nickname || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Kelas</label><div style={{ fontWeight: '600' }}>{selectedUser.className || 'A'}</div></div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ color: '#64748b', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Status Siswa</label>
                  <div style={{
                    display: 'inline-block', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px',
                    color: (!selectedUser.status || selectedUser.status === 'Aktif') ? '#16a34a' : selectedUser.status === 'Lulus' ? '#2563eb' : '#dc2626',
                    backgroundColor: (!selectedUser.status || selectedUser.status === 'Aktif') ? '#dcfce7' : selectedUser.status === 'Lulus' ? '#dbeafe' : '#fee2e2'
                  }}>
                    {selectedUser.status || 'Aktif'}
                  </div>
                </div>

                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Tempat Lahir</label><div style={{ fontWeight: '600' }}>{selectedUser.birthPlace || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Tanggal Lahir</label><div style={{ fontWeight: '600' }}>{formatDateDisplay(selectedUser.birthDate)}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Umur</label><div style={{ fontWeight: '600' }}>{calculateAgeString(selectedUser.birthDate) || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Jenis Kelamin</label><div style={{ fontWeight: '600' }}>{formatGenderFull(selectedUser.gender)}</div></div>

                <div style={{ borderTop: '1px dashed #e2e8f0', gridColumn: 'span 2', margin: '5px 0' }}></div>

                {/* Administrasi */}
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>NISN</label><div style={{ fontWeight: '600' }}>{selectedUser.nisn || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>NIK</label><div style={{ fontWeight: '600' }}>{selectedUser.nik || '-'}</div></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{ color: '#64748b', fontSize: '11px' }}>Nomor KK</label><div style={{ fontWeight: '600' }}>{selectedUser.noKK || '-'}</div></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{ color: '#64748b', fontSize: '11px' }}>Alamat</label><div style={{ fontWeight: '600' }}>{selectedUser.address || '-'}</div></div>

                <div style={{ borderTop: '1px dashed #e2e8f0', gridColumn: 'span 2', margin: '5px 0' }}></div>

                {/* Data Ayah */}
                <h4 style={{ gridColumn: 'span 2', margin: 0, fontSize: '13px', color: '#475569' }}>Data Ayah</h4>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Nama Ayah</label><div style={{ fontWeight: '600' }}>{selectedUser.fatherName || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>NIK Ayah</label><div style={{ fontWeight: '600' }}>{selectedUser.fatherNik || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Tempat Lahir</label><div style={{ fontWeight: '600' }}>{selectedUser.fatherBirthPlace || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Tanggal Lahir</label><div style={{ fontWeight: '600' }}>{formatDateDisplay(selectedUser.fatherBirthDate) || '-'}</div></div>

                <div style={{ borderTop: '1px solid #f1f5f9', gridColumn: 'span 2', margin: '2px 0' }}></div>

                {/* Data Ibu */}
                <h4 style={{ gridColumn: 'span 2', margin: 0, fontSize: '13px', color: '#475569' }}>Data Ibu</h4>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Nama Ibu</label><div style={{ fontWeight: '600' }}>{selectedUser.motherName || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>NIK Ibu</label><div style={{ fontWeight: '600' }}>{selectedUser.motherNik || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Tempat Lahir</label><div style={{ fontWeight: '600' }}>{selectedUser.motherBirthPlace || '-'}</div></div>
                <div><label style={{ color: '#64748b', fontSize: '11px' }}>Tanggal Lahir</label><div style={{ fontWeight: '600' }}>{formatDateDisplay(selectedUser.motherBirthDate) || '-'}</div></div>

                <div style={{ borderTop: '1px dashed #e2e8f0', gridColumn: 'span 2', margin: '5px 0' }}></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{ color: '#64748b', fontSize: '11px' }}>Wali (Opsional)</label><div style={{ fontWeight: '600' }}>{selectedUser.guardianName || '-'}</div></div>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn-delete" style={{ color: 'var(--danger-red)', background: 'none', border: '1px solid #fee2e2' }} onClick={handleDeleteUser}>
                <i className="fa-solid fa-trash-can" style={{ marginRight: '5px' }}></i> Hapus
              </button>
              <button className="btn-save" onClick={handleOpenEdit}>
                <i className="fa-solid fa-pen-to-square" style={{ marginRight: '5px' }}></i> Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL FORM (ADD/EDIT) --- */}
      {showModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h3>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body custom-scroll" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '10px' }}>

                {/* Foto */}
                <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                  <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: formData.photo ? `url(${formData.photo}) center/cover` : '#f1f5f9', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!formData.photo && <i className="fa-solid fa-camera" style={{ color: '#94a3b8' }}></i>}
                    </div>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                    <div style={{ fontSize: '11px', color: 'var(--primary-blue)', marginTop: '5px' }}>Upload Foto</div>
                  </label>
                </div>

                {/* Data Utama */}
                <h4 style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Data Utama</h4>
                <input type="text" className="form-control" placeholder="Nama Lengkap *" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} style={{ marginBottom: '10px' }} />

                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input type="text" className="form-control" placeholder="Nama Panggilan *" required value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} style={{ flex: 1 }} />
                  <select className="form-control" value={formData.className} onChange={(e) => setFormData({ ...formData, className: e.target.value })} style={{ width: '90px' }}>
                    <option value="A">Kls A</option><option value="B">Kls B</option>
                  </select>
                  <select className="form-control" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} style={{ width: '90px' }}>
                    <option value="L">L</option><option value="P">P</option>
                  </select>
                </div>

                {/* Data Kelahiran */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input type="text" className="form-control" placeholder="Tempat Lahir" value={formData.birthPlace} onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })} style={{ flex: 1 }} />
                  <div style={{ position: 'relative', width: '130px' }}>
                    <div className="form-control" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', fontSize: '13px', background: 'white' }}>
                      <span style={{ color: formData.birthDate ? '#334155' : '#9ca3af' }}>{formatDateDisplay(formData.birthDate)}</span>
                    </div>
                    <input
                      type="date" value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    />
                  </div>
                </div>

                {/* Data Administrasi */}
                <h4 style={{ fontSize: '12px', color: '#64748b', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Administrasi</h4>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Status Siswa</label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{
                      fontWeight: '600',
                      // Update pewarnaan agar mendukung Bukan Murid PAUD
                      color: formData.status === 'Aktif' ? '#16a34a' : formData.status === 'Lulus' ? '#2563eb' : formData.status === 'Bukan Murid PAUD' ? '#7c3aed' : '#dc2626',
                      border: `1px solid ${formData.status === 'Aktif' ? '#bbf7d0' : formData.status === 'Lulus' ? '#bfdbfe' : formData.status === 'Bukan Murid PAUD' ? '#ddd6fe' : '#fecaca'}`,
                      backgroundColor: formData.status === 'Aktif' ? '#f0fdf4' : formData.status === 'Lulus' ? '#eff6ff' : formData.status === 'Bukan Murid PAUD' ? '#f5f3ff' : '#fef2f2'
                    }}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Tidak Aktif">Tidak Aktif</option>
                    <option value="Lulus">Lulus</option>
                    {/* Tambahan Opsi Baru */}
                    <option value="Bukan Murid PAUD">Bukan Murid PAUD</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input type="number" className="form-control" placeholder="NISN" value={formData.nisn} onChange={(e) => setFormData({ ...formData, nisn: e.target.value })} />
                  <input type="number" className="form-control" placeholder="NIK Siswa" value={formData.nik} onChange={(e) => setFormData({ ...formData, nik: e.target.value })} />
                </div>
                
                <input type="number" className="form-control" placeholder="Nomor Kartu Keluarga (KK)" value={formData.noKK} onChange={(e) => setFormData({ ...formData, noKK: e.target.value })} style={{ marginBottom: '10px' }} />
                
                <textarea className="form-control" placeholder="Alamat Lengkap" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} style={{ marginBottom: '10px', height: '60px' }}></textarea>

                {/* --- DATA BAPAK --- */}
                <h4 style={{ fontSize: '12px', color: '#64748b', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Data Ayah</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input type="text" className="form-control" placeholder="Nama Ayah" value={formData.fatherName} onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })} />
                  <input type="number" className="form-control" placeholder="NIK Ayah" value={formData.fatherNik} onChange={(e) => setFormData({ ...formData, fatherNik: e.target.value })} />
                  
                  <input type="text" className="form-control" placeholder="Tempat Lahir" value={formData.fatherBirthPlace} onChange={(e) => setFormData({ ...formData, fatherBirthPlace: e.target.value })} />
                  <div style={{ position: 'relative' }}>
                    <div className="form-control" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', fontSize: '13px', background: 'white' }}>
                      <span style={{ color: formData.fatherBirthDate ? '#334155' : '#9ca3af' }}>{formData.fatherBirthDate ? formatDateDisplay(formData.fatherBirthDate) : 'Tanggal Lahir'}</span>
                    </div>
                    <input type="date" value={formData.fatherBirthDate} onChange={(e) => setFormData({ ...formData, fatherBirthDate: e.target.value })} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
                  </div>
                </div>

                {/* --- DATA IBU --- */}
                <h4 style={{ fontSize: '12px', color: '#64748b', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Data Ibu</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input type="text" className="form-control" placeholder="Nama Ibu" value={formData.motherName} onChange={(e) => setFormData({ ...formData, motherName: e.target.value })} />
                  <input type="number" className="form-control" placeholder="NIK Ibu" value={formData.motherNik} onChange={(e) => setFormData({ ...formData, motherNik: e.target.value })} />
                  
                  <input type="text" className="form-control" placeholder="Tempat Lahir" value={formData.motherBirthPlace} onChange={(e) => setFormData({ ...formData, motherBirthPlace: e.target.value })} />
                  <div style={{ position: 'relative' }}>
                    <div className="form-control" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', fontSize: '13px', background: 'white' }}>
                      <span style={{ color: formData.motherBirthDate ? '#334155' : '#9ca3af' }}>{formData.motherBirthDate ? formatDateDisplay(formData.motherBirthDate) : 'Tanggal Lahir'}</span>
                    </div>
                    <input type="date" value={formData.motherBirthDate} onChange={(e) => setFormData({ ...formData, motherBirthDate: e.target.value })} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #e2e8f0', margin: '15px 0' }}></div>
                <input type="text" className="form-control" placeholder="Nama Wali (Opsional)" value={formData.guardianName} onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })} />

              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)} disabled={isSubmitting}>Batal</button>
                <button type="submit" className="btn-save" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;