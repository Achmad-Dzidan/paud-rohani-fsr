import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
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

  // State Form Lengkap
  const [formData, setFormData] = useState({
    id: '', 
    fullName: '', nickname: '', className: 'A', photo: '',
    nisn: '', nik: '', birthPlace: '', birthDate: '', 
    gender: 'L', address: '', 
    fatherName: '', motherName: '', guardianName: ''
  });

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

  // --- IMAGE PROCESSING ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Ukuran file terlalu besar (Max 2MB)"); return; }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300; 
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setFormData(prev => ({ ...prev, photo: compressedDataUrl }));
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
        fatherName: '', motherName: '', guardianName: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = () => {
    if(!selectedUser) return;
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
        guardianName: selectedUser.guardianName || ''
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
    if(!selectedUser) return;
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
      if(!birthDateStr) return "";
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
    if(exportTarget !== 'all') {
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
        {wch: 5}, {wch: 25}, {wch: 15}, {wch: 15}, 
        {wch: 15}, {wch: 15}, {wch: 12}, 
        {wch: 30}, {wch: 20}, {wch: 20}, {wch: 20}
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");

    XLSX.writeFile(workbook, `Data_Siswa_${new Date().getTime()}.xlsx`);
    setShowExportModal(false);
    toast.success("Excel berhasil diunduh!");
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
          <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
          <div className="page-title"><h1>User Management</h1><p>Kelola data profil siswa</p></div>
        </div>
        
        <div style={{display:'flex', gap:'10px'}}>
            <button 
                className="btn-add" 
                onClick={() => setShowExportModal(true)}
                style={{ backgroundColor: '#16a34a' }} 
            >
                <i className="fa-solid fa-file-export" style={{marginRight:'8px'}}></i> Export
            </button>

            <button className="btn-add" onClick={handleOpenAdd}>
                <i className="fa-solid fa-user-plus"></i> Add User
            </button>
        </div>
      </div>

      {/* GRID USERS */}
      <div className="user-grid">
        {loading ? <p style={{ color: 'var(--text-gray)' }}>Loading users...</p> : users.length === 0 ? (
          <p style={{ color: 'var(--text-gray)' }}>Belum ada siswa.</p>
        ) : (
          users.map((user) => (
            <div 
                className="user-card" 
                key={user.id} 
                style={{ position: 'relative', cursor:'pointer' }}
                onClick={() => handleCardClick(user)}
            >
              {isDataIncomplete(user) && (
                  <div style={{
                      position:'absolute', top:10, right:10, 
                      width:'20px', height:'20px', borderRadius:'50%', 
                      background:'var(--danger-red)', color:'white',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'12px', fontWeight:'bold', boxShadow:'0 2px 4px rgba(0,0,0,0.2)'
                  }} title="Data Belum Lengkap">!</div>
              )}
              <div className="user-info-wrapper">
                <div className="avatar" style={{ 
                    backgroundColor: user.photo ? 'transparent' : 'var(--primary-blue)',
                    backgroundImage: user.photo ? `url(${user.photo})` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e2e8f0'
                }}>
                  {!user.photo && getInitials(user.nickname || user.name)}
                </div>
                <div className="info">
                  <h3 style={{fontSize:'16px'}}>{user.nickname || user.name}</h3>
                  <p style={{fontSize:'12px', color:'#64748b'}}>Kelas {user.className || 'A'} • {user.fullName || user.name}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL EXPORT --- */}
      {showExportModal && (
          <div className="modal-overlay active" style={{display:'flex'}} onClick={() => setShowExportModal(false)}>
              <div className="modal-box" style={{maxWidth:'400px', textAlign:'center'}} onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header" style={{justifyContent:'center', position:'relative'}}>
                      <h3>Export Data Siswa</h3>
                      <button className="close-modal" style={{position:'absolute', right:0}} onClick={() => setShowExportModal(false)}>&times;</button>
                  </div>
                  
                  <div className="modal-body" style={{padding:'20px 0'}}>
                      <label style={{display:'block', textAlign:'left', fontSize:'13px', fontWeight:'600', marginBottom:'5px'}}>Pilih Siswa</label>
                      <select 
                          className="form-control" 
                          style={{marginBottom:'20px'}}
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

                      <p style={{fontSize:'14px', color:'#64748b', marginBottom:'15px'}}>Export to:</p>
                      
                      <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
                          <button 
                              onClick={handleExportPDF}
                              style={{
                                  background: '#ef4444', color:'white', border:'none', 
                                  padding:'12px 24px', borderRadius:'8px', cursor:'pointer',
                                  display:'flex', alignItems:'center', gap:'8px', fontWeight:'600'
                              }}
                          >
                              <i className="fa-solid fa-file-pdf"></i> PDF
                          </button>

                          <button 
                              onClick={handleExportExcel}
                              style={{
                                  background: '#16a34a', color:'white', border:'none', 
                                  padding:'12px 24px', borderRadius:'8px', cursor:'pointer',
                                  display:'flex', alignItems:'center', gap:'8px', fontWeight:'600'
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
          <div className="modal-overlay active" style={{display:'flex'}} onClick={() => setShowDetailModal(false)}>
              <div className="modal-box custom-scroll" style={{maxWidth:'500px'}} onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                      <h3>Profil Siswa</h3>
                      <button className="close-modal" onClick={() => setShowDetailModal(false)}>&times;</button>
                  </div>
                  
                  <div className="modal-body custom-scroll" style={{maxHeight:'70vh', overflowY:'auto'}}>
                      <div style={{display:'flex', justifyContent:'center', marginBottom:'20px'}}>
                          <div style={{
                              width:'100px', height:'100px', borderRadius:'50%',
                              backgroundImage: selectedUser.photo ? `url(${selectedUser.photo})` : 'none',
                              backgroundColor: selectedUser.photo ? 'transparent' : 'var(--primary-blue)',
                              backgroundSize:'cover', backgroundPosition:'center',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              color:'white', fontSize:'32px', fontWeight:'bold', border:'4px solid white', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'
                          }}>
                              {!selectedUser.photo && getInitials(selectedUser.nickname || selectedUser.name)}
                          </div>
                      </div>

                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', fontSize:'13px'}}>
                          <div style={{gridColumn:'span 2'}}><label style={{color:'#64748b', fontSize:'11px'}}>Nama Lengkap</label><div style={{fontWeight:'600', fontSize:'15px'}}>{selectedUser.fullName || '-'}</div></div>
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Panggilan</label><div style={{fontWeight:'600'}}>{selectedUser.nickname || '-'}</div></div>
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Kelas</label><div style={{fontWeight:'600'}}>{selectedUser.className || 'A'}</div></div>
                          
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Tempat Lahir</label><div style={{fontWeight:'600'}}>{selectedUser.birthPlace || '-'}</div></div>
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Tanggal Lahir</label><div style={{fontWeight:'600'}}>{formatDateDisplay(selectedUser.birthDate)}</div></div>
                          
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Umur</label><div style={{fontWeight:'600'}}>{calculateAgeString(selectedUser.birthDate) || '-'}</div></div>
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Jenis Kelamin</label><div style={{fontWeight:'600'}}>{formatGenderFull(selectedUser.gender)}</div></div>

                          <div style={{borderTop:'1px dashed #e2e8f0', gridColumn:'span 2', margin:'5px 0'}}></div>

                          <div><label style={{color:'#64748b', fontSize:'11px'}}>NISN</label><div style={{fontWeight:'600'}}>{selectedUser.nisn || '-'}</div></div>
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>NIK</label><div style={{fontWeight:'600'}}>{selectedUser.nik || '-'}</div></div>
                          <div style={{gridColumn:'span 2'}}><label style={{color:'#64748b', fontSize:'11px'}}>Alamat</label><div style={{fontWeight:'600'}}>{selectedUser.address || '-'}</div></div>
                          
                          <div style={{borderTop:'1px dashed #e2e8f0', gridColumn:'span 2', margin:'5px 0'}}></div>
                          
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Ayah</label><div style={{fontWeight:'600'}}>{selectedUser.fatherName || '-'}</div></div>
                          <div><label style={{color:'#64748b', fontSize:'11px'}}>Ibu</label><div style={{fontWeight:'600'}}>{selectedUser.motherName || '-'}</div></div>
                          <div style={{gridColumn:'span 2'}}><label style={{color:'#64748b', fontSize:'11px'}}>Wali</label><div style={{fontWeight:'600'}}>{selectedUser.guardianName || '-'}</div></div>
                      </div>
                  </div>

                  <div className="modal-footer" style={{justifyContent:'space-between', marginTop:'20px'}}>
                      <button className="btn-delete" style={{color:'var(--danger-red)', background:'none', border:'1px solid #fee2e2'}} onClick={handleDeleteUser}>
                          <i className="fa-solid fa-trash-can" style={{marginRight:'5px'}}></i> Hapus
                      </button>
                      <button className="btn-save" onClick={handleOpenEdit}>
                          <i className="fa-solid fa-pen-to-square" style={{marginRight:'5px'}}></i> Edit
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL FORM (ADD/EDIT) --- */}
      {showModal && (
        <div className="modal-overlay active" style={{display:'flex'}}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h3>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body custom-scroll" style={{maxHeight:'60vh', overflowY:'auto', paddingRight:'10px'}}>
                
                {/* Foto */}
                <div style={{marginBottom:'15px', textAlign:'center'}}>
                    <label style={{cursor:'pointer', display:'inline-block'}}>
                        <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: formData.photo ? `url(${formData.photo}) center/cover` : '#f1f5f9', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {!formData.photo && <i className="fa-solid fa-camera" style={{color:'#94a3b8'}}></i>}
                        </div>
                        <input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload}/>
                        <div style={{fontSize:'11px', color:'var(--primary-blue)', marginTop:'5px'}}>Upload Foto</div>
                    </label>
                </div>

                {/* Data Utama */}
                <h4 style={{fontSize:'12px', color:'#64748b', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'1px'}}>Data Utama</h4>
                <input type="text" className="form-control" placeholder="Nama Lengkap *" required value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} style={{ marginBottom: '10px' }} />
                
                <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                    <input type="text" className="form-control" placeholder="Nama Panggilan *" required value={formData.nickname} onChange={(e) => setFormData({...formData, nickname: e.target.value})} style={{flex:1}} />
                    <select className="form-control" value={formData.className} onChange={(e) => setFormData({...formData, className: e.target.value})} style={{width:'80px'}}>
                        <option value="A">Kls A</option><option value="B">Kls B</option>
                    </select>
                    <select className="form-control" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} style={{width:'80px'}}>
                        <option value="L">L</option><option value="P">P</option>
                    </select>
                </div>

                {/* Data Kelahiran */}
                <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                    <input type="text" className="form-control" placeholder="Tempat Lahir" value={formData.birthPlace} onChange={(e) => setFormData({...formData, birthPlace: e.target.value})} style={{flex:1}} />
                    
                    {/* Date Picker Custom Wrapper */}
                    <div style={{ position: 'relative', width:'130px' }}>
                        <div className="form-control" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', fontSize:'13px', background:'white' }}>
                            <span style={{color: formData.birthDate ? '#334155' : '#9ca3af'}}>{formatDateDisplay(formData.birthDate)}</span>
                        </div>
                        <input 
                            type="date" 
                            value={formData.birthDate} 
                            onChange={(e) => setFormData({...formData, birthDate: e.target.value})} 
                            style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        />
                    </div>
                </div>

                {/* Box Umur Otomatis */}
                <div style={{marginBottom:'15px'}}>
                    <label style={{fontSize:'11px', color:'#64748b'}}>Umur (Otomatis)</label>
                    <div style={{
                        background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', 
                        fontSize: '13px', fontWeight: '600', color: '#475569', border: '1px solid #e2e8f0'
                    }}>
                        {calculateAgeString(formData.birthDate) || "Pilih Tanggal Lahir dulu"}
                    </div>
                </div>

                {/* Data Administrasi */}
                <h4 style={{fontSize:'12px', color:'#64748b', margin:'15px 0 10px', textTransform:'uppercase', letterSpacing:'1px'}}>Administrasi</h4>
                <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                    <input type="number" className="form-control" placeholder="NISN" value={formData.nisn} onChange={(e) => setFormData({...formData, nisn: e.target.value})} />
                    <input type="number" className="form-control" placeholder="NIK" value={formData.nik} onChange={(e) => setFormData({...formData, nik: e.target.value})} />
                </div>
                <textarea className="form-control" placeholder="Alamat Lengkap" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} style={{marginBottom:'10px', height:'60px'}}></textarea>

                {/* Data Orang Tua */}
                <h4 style={{fontSize:'12px', color:'#64748b', margin:'15px 0 10px', textTransform:'uppercase', letterSpacing:'1px'}}>Orang Tua</h4>
                <input type="text" className="form-control" placeholder="Nama Ayah Kandung" value={formData.fatherName} onChange={(e) => setFormData({...formData, fatherName: e.target.value})} style={{ marginBottom: '10px' }} />
                <input type="text" className="form-control" placeholder="Nama Ibu Kandung" value={formData.motherName} onChange={(e) => setFormData({...formData, motherName: e.target.value})} style={{ marginBottom: '10px' }} />
                <input type="text" className="form-control" placeholder="Nama Wali (Opsional)" value={formData.guardianName} onChange={(e) => setFormData({...formData, guardianName: e.target.value})} />

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