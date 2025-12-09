import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  collection, getDocs, doc, setDoc, addDoc, getDoc, 
  query, orderBy, serverTimestamp, onSnapshot, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

// Library Tambahan
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import * as XLSX from 'xlsx';

const RaportForm = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE DATA UTAMA ---
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assessmentSchema, setAssessmentSchema] = useState([]); 
  const [answers, setAnswers] = useState({});
  
  // Photo State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // UI State
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // --- STATE MODAL MANAGE SCHEMA ---
  const [showManageModal, setShowManageModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text'); 
  const [newCheckboxOptions, setNewCheckboxOptions] = useState([]);
  const [tempOption, setTempOption] = useState('');

  // --- STATE MODAL COPY ---
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');

  // 1. FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      try {
        // A. Fetch Students (Include 'className', 'nisn' fields from collection)
        const usersSnap = await getDocs(collection(db, "users"));
        const studentsList = usersSnap.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStudents(studentsList);

        // B. Fetch Schema Realtime
        const qSchema = query(collection(db, "raport_schema")); 
        const unsubscribe = onSnapshot(qSchema, (snapshot) => {
          const schemaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Client-side sorting by 'order'
          schemaData.sort((a, b) => {
              const orderA = a.order !== undefined ? a.order : 9999;
              const orderB = b.order !== undefined ? b.order : 9999;
              if (orderA === orderB) return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
              return orderA - orderB;
          });
          setAssessmentSchema(schemaData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error(error);
        toast.error("Gagal memuat data.");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 2. FETCH DATA RAPORT SISWA
  useEffect(() => {
    if (!selectedStudentId) {
        setAnswers({});
        setPhotoUrl('');
        return;
    }
    fetchStudentData(selectedStudentId);
  }, [selectedStudentId]);

  const fetchStudentData = async (studentId) => {
      setLoading(true);
      try {
          const docRef = doc(db, "raport", studentId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
              const data = docSnap.data();
              setAnswers(data.scores || {});
              setPhotoUrl(data.evidencePhoto || '');
          } else {
              setAnswers({});
              setPhotoUrl('');
          }
      } catch (error) {
          toast.error("Gagal mengambil data raport.");
      } finally {
          setLoading(false);
      }
  };

  // ==========================================
  // 3. FITUR EXPORT EXCEL (HEADER BERTINGKAT)
  // ==========================================
  const handleExportExcel = async () => {
      setIsExporting(true);
      try {
          // 1. Ambil semua data raport
          const raportSnap = await getDocs(collection(db, "raport"));
          const raportMap = {};
          raportSnap.forEach(doc => { raportMap[doc.id] = doc.data(); });

          // --- MEMBANGUN STRUKTUR EXCEL ---
          
          // Row 1: Header Utama (Nama Aspek)
          // Row 2: Sub Header (Opsi Checkbox)
          const headerRow1 = ["No", "Nama Lengkap", "Kelas", "NISN"];
          const headerRow2 = ["", "", "", ""]; // Placeholder utk kolom statis

          // Definisi Merge Cell (Start Row 0 to Row 1 for static cols)
          const merges = [
              { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // No
              { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Nama
              { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Kelas
              { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // NISN
          ];

          let currentColIndex = 4; // Mulai setelah kolom statis

          // Loop Schema untuk membuat Header
          assessmentSchema.forEach(field => {
              if (field.type === 'text') {
                  // Tipe Text: Merge Atas Bawah (R0-R1)
                  headerRow1.push(field.label);
                  headerRow2.push(""); 
                  merges.push({ s: { r: 0, c: currentColIndex }, e: { r: 1, c: currentColIndex } });
                  currentColIndex++;
              } else if (field.type === 'checkbox') {
                  // Tipe Checkbox: Merge Samping (Sebanyak jumlah opsi)
                  const optionCount = field.options?.length || 1;
                  
                  // Push Label Aspek di kolom pertama grup
                  headerRow1.push(field.label);
                  // Push kosong untuk sisa kolom agar merge berhasil
                  for(let i=1; i<optionCount; i++) headerRow1.push("");

                  // Merge Header Aspek
                  merges.push({ s: { r: 0, c: currentColIndex }, e: { r: 0, c: currentColIndex + optionCount - 1 } });

                  // Push Opsi ke Header Row 2
                  if(field.options && field.options.length > 0) {
                      field.options.forEach(opt => headerRow2.push(opt));
                  } else {
                      headerRow2.push("-"); // Fallback jika tidak ada opsi
                  }

                  currentColIndex += optionCount;
              }
          });

          // 3. Membangun Baris Data Siswa
          const dataRows = students.map((student, index) => {
              const rData = raportMap[student.id] || {};
              const scores = rData.scores || {};
              
              const row = [
                  index + 1,
                  student.name || '',
                  student.className || '-', // Pastikan field ini ada di DB Users
                  student.nisn || '-'       // Pastikan field ini ada di DB Users
              ];

              assessmentSchema.forEach(field => {
                  const studentAnswer = scores[field.label]; // Value yg tersimpan (String)

                  if (field.type === 'text') {
                      row.push(studentAnswer || '');
                  } else if (field.type === 'checkbox') {
                      // Logic Matrix: Cek setiap opsi, jika match dengan jawaban siswa, beri tanda "v"
                      field.options.forEach(opt => {
                          if (studentAnswer === opt) {
                              row.push("✔"); // Tanda Centang
                          } else {
                              row.push("");
                          }
                      });
                  }
              });
              return row;
          });

          // 4. Generate Workbook
          const wsData = [headerRow1, headerRow2, ...dataRows];
          const worksheet = XLSX.utils.aoa_to_sheet(wsData);
          
          // Terapkan Merges
          worksheet['!merges'] = merges;

          // Auto-width (Estimasi)
          const wscols = headerRow2.map(h => ({ wch: h ? h.length + 5 : 10 }));
          // Fix width for first 4 cols
          wscols[0] = { wch: 5 };  // No
          wscols[1] = { wch: 30 }; // Nama
          wscols[2] = { wch: 10 }; // Kelas
          wscols[3] = { wch: 15 }; // NISN
          worksheet['!cols'] = wscols;

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Data Raport");

          XLSX.writeFile(workbook, `Rekap_Raport_Detail_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`);
          toast.success("Excel berhasil diunduh!");

      } catch (error) {
          console.error(error);
          toast.error("Gagal export excel.");
      } finally {
          setIsExporting(false);
      }
  };

  // ==========================================
  // LOGIC MODAL: DRAG & DROP & ADD
  // ==========================================
  const handleAddOption = () => {
      if (!tempOption.trim()) return;
      setNewCheckboxOptions([...newCheckboxOptions, tempOption.trim()]);
      setTempOption('');
  };
  const handleRemoveOption = (idx) => {
      setNewCheckboxOptions(newCheckboxOptions.filter((_, i) => i !== idx));
  };

  const handleAddSchemaToDb = async () => {
      if(!newFieldName.trim()) return toast.error("Nama aspek wajib diisi");
      if(newFieldType === 'checkbox' && newCheckboxOptions.length === 0) return toast.error("Minimal 1 opsi untuk checkbox");
      
      try {
          const newOrderIndex = assessmentSchema.length; 
          await addDoc(collection(db, "raport_schema"), {
              label: newFieldName,
              type: newFieldType,
              options: newFieldType === 'checkbox' ? newCheckboxOptions : [],
              order: newOrderIndex, 
              createdAt: serverTimestamp()
          });
          
          toast.success("Aspek ditambahkan!");
          setNewFieldName('');
          setNewCheckboxOptions([]);
          setTempOption('');
          setNewFieldType('text');
      } catch (error) {
          toast.error("Gagal menambah.");
      }
  };

  // --- REORDER LOGIC ---
  const onDragEnd = async (result) => {
      if (!result.destination) return;

      const items = Array.from(assessmentSchema);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      setAssessmentSchema(items);

      try {
          const batch = writeBatch(db);
          items.forEach((item, index) => {
              const docRef = doc(db, "raport_schema", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
      } catch (error) {
          toast.error("Gagal menyimpan urutan.");
      }
  };

  // Helper Copy Option
  const copyOptionsFromExisting = (sourceId) => {
    const source = assessmentSchema.find(s => s.id === sourceId);
    if(source) setNewCheckboxOptions([...source.options]);
  };

  // ==========================================
  // LOGIC UTAMA HALAMAN
  // ==========================================

  const handlePhotoUpload = async (e) => {
      const file = e.target.files[0];
      if(!file) return;
      setIsUploadingPhoto(true);
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      try {
        const compressedFile = await imageCompression(file, options);
        const fileName = `raport/${selectedStudentId}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, compressedFile);
        const downloadURL = await getDownloadURL(storageRef);
        setPhotoUrl(downloadURL); 
        toast.success("Foto berhasil diunggah!");
      } catch (error) { toast.error("Gagal upload."); } finally { setIsUploadingPhoto(false); }
  };

  const handleInputChange = (fieldLabel, value) => {
      setAnswers(prev => ({ ...prev, [fieldLabel]: value }));
  };

  const handleSaveRaport = async () => {
      if(!selectedStudentId) return toast.error("Pilih siswa!");
      setIsSaving(true);
      try {
          const student = students.find(s => s.id === selectedStudentId);
          const raportPayload = {
              studentId: selectedStudentId,
              studentName: student?.name || "Unknown",
              scores: answers,
              evidencePhoto: photoUrl,
              updatedAt: serverTimestamp(),
          };
          await setDoc(doc(db, "raport", selectedStudentId), raportPayload);
          toast.success(`Raport ${student?.name} berhasil disimpan!`);
      } catch (error) { toast.error("Gagal simpan."); } finally { setIsSaving(false); }
  };

  const handleCopyRaport = async () => {
      if(!copySourceId) return toast.error("Pilih siswa asal!");
      try {
          const docSnap = await getDoc(doc(db, "raport", copySourceId));
          if (docSnap.exists()) {
              setAnswers(docSnap.data().scores || {}); 
              toast.success("Data berhasil disalin.");
              setShowCopyModal(false);
          } else { toast.error("Data kosong."); }
      } catch (e) { toast.error("Gagal copy."); }
  };

  const studentsForCopy = students.filter(s => s.id !== selectedStudentId);
  const existingCheckboxSchemas = assessmentSchema.filter(s => s.type === 'checkbox');

  return (
    <div style={{ width: '100%' }}>
        <div className="header-section">
            <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                <button className="mobile-toggle-btn floating-menu-btn" onClick={toggleSidebar} 
                    style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
                    <i className="fa-solid fa-bars" style={{color: '#334155', fontSize: '16px'}}></i>
                </button>
                <div className="page-title" style={{ marginLeft: window.innerWidth < 768 ? '50px' : '0' }}>
                    <h1>Form Raport</h1>
                    <p>Input penilaian & dokumentasi siswa</p>
                </div>
            </div>
            
            {/* TOMBOL EXPORT EXCEL (MATRIX) */}
            <button className="btn-add" onClick={handleExportExcel} disabled={isExporting} style={{backgroundColor:'#16a34a'}}>
                <i className="fa-solid fa-file-excel"></i> {isExporting ? '...' : 'Export Excel'}
            </button>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', gap: '20px' }}>
            
            {/* CARD 1: PILIH SISWA */}
            <div className="form-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 'bold' }}>Pilih Siswa</label>
                <select className="form-control" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} style={{ fontSize: '16px', padding: '10px' }}>
                    <option value="" disabled>-- Pilih Nama Siswa --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.nickname ? `(${s.nickname})` : ''}</option>)}
                </select>
            </div>

            {/* CARD 2: AREA FORM PENILAIAN */}
            {selectedStudentId && (
                <div className="form-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    {/* TOOLBAR */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Lembar Penilaian</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowCopyModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#fff7ed', color: '#ea580c', border: 'none', borderRadius: '8px', cursor:'pointer' }} title="Salin dari siswa lain">
                                <i className="fa-solid fa-copy"></i> Copy
                            </button>
                            <div style={{ position: 'relative', overflow: 'hidden' }}>
                                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: '8px', cursor:'pointer' }}>
                                    <i className="fa-solid fa-camera"></i> {isUploadingPhoto ? '...' : ''}
                                </button>
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingPhoto} style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                            </div>
                            <button onClick={() => setShowManageModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                <i className="fa-solid fa-list-check"></i> Atur Aspek
                            </button>
                        </div>
                    </div>

                    {photoUrl && (
                        <div style={{ marginBottom: '20px', textAlign: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                            <img src={photoUrl} alt="Bukti" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                        </div>
                    )}

                    {loading ? <p>Memuat form...</p> : assessmentSchema.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                            <p>Belum ada aspek penilaian.</p>
                            <p style={{ fontSize: '12px' }}>Klik tombol <b>Atur Aspek</b> di atas untuk menambahkan.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '20px' }}>
                            {assessmentSchema.map((field) => (
                                <div key={field.id} style={{paddingBottom:'15px', borderBottom:'1px dashed #e2e8f0'}}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>
                                        {field.label}
                                    </label>
                                    
                                    {field.type === 'checkbox' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                                            {field.options && field.options.map((option, idx) => {
                                                const isSelected = answers[field.label] === option;
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        onClick={() => handleInputChange(field.label, option)} 
                                                        style={{ 
                                                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', 
                                                            padding:'8px 12px', borderRadius:'6px', border:'1px solid',
                                                            background: isSelected ? '#eff6ff' : 'white',
                                                            borderColor: isSelected ? '#3b82f6' : '#e2e8f0',
                                                            color: isSelected ? '#1d4ed8' : '#334155',
                                                            fontWeight: isSelected ? '600' : 'normal',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width:'16px', height:'16px', borderRadius:'50%', border:'1px solid',
                                                            borderColor: isSelected ? '#3b82f6' : '#cbd5e1',
                                                            display:'flex', alignItems:'center', justifyContent:'center', background:'white'
                                                        }}>
                                                            {isSelected && <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'#3b82f6'}}></div>}
                                                        </div>
                                                        {option}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder={`Keterangan untuk ${field.label}...`}
                                            value={answers[field.label] || ''}
                                            onChange={(e) => handleInputChange(field.label, e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                                        ></textarea>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: '30px' }}>
                        <button className="btn-primary" onClick={handleSaveRaport} disabled={isSaving} style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' }}>
                            {isSaving ? 'Menyimpan...' : 'Simpan Raport'}
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* MODAL 1: MANAGE SCHEMA (REORDER & ADD) */}
        {showManageModal && (
            <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowManageModal(false)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:'600px', width:'95%'}}>
                    <div className="modal-header">
                        <h3>Atur Aspek Penilaian</h3>
                        <button className="close-modal" onClick={() => setShowManageModal(false)}>&times;</button>
                    </div>
                    <div className="modal-body" style={{maxHeight:'70vh', overflowY:'auto'}}>
                        
                        {/* A. LIST REORDER */}
                        <div style={{marginBottom:'30px', borderBottom:'1px solid #e2e8f0', paddingBottom:'20px'}}>
                            <h4 style={{fontSize:'14px', color:'#64748b', marginBottom:'10px'}}>Urutan Tampilan (Drag "=")</h4>
                            
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="schemaList">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                            {assessmentSchema.map((item, index) => (
                                                <Draggable key={item.id} draggableId={item.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            style={{
                                                                userSelect: 'none',
                                                                padding: '12px',
                                                                backgroundColor: snapshot.isDragging ? '#eff6ff' : 'white',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '8px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                ...provided.draggableProps.style
                                                            }}
                                                        >
                                                            <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                                                <div {...provided.dragHandleProps} style={{cursor:'grab', color:'#94a3b8', padding:'5px'}}>
                                                                    <i className="fa-solid fa-bars"></i> 
                                                                </div>
                                                                <div>
                                                                    <div style={{fontWeight:'600', color:'#334155', fontSize:'14px'}}>{item.label}</div>
                                                                    <div style={{fontSize:'11px', color:'#64748b'}}>{item.type === 'checkbox' ? `${item.options.length} Opsi` : 'Text Deskripsi'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </div>

                        {/* B. FORM TAMBAH */}
                        <div>
                            <h4 style={{fontSize:'14px', color:'#64748b', marginBottom:'10px'}}>Tambah Kriteria Baru</h4>
                            <div style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
                                <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                    <div style={{flex:2}}>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            placeholder="Nama Kriteria (misal: Motorik Halus)" 
                                            value={newFieldName}
                                            onChange={(e) => setNewFieldName(e.target.value)}
                                        />
                                    </div>
                                    <div style={{flex:1}}>
                                        <select 
                                            className="form-control" 
                                            value={newFieldType}
                                            onChange={(e) => setNewFieldType(e.target.value)}
                                        >
                                            <option value="text">Text</option>
                                            <option value="checkbox">Checkbox</option>
                                        </select>
                                    </div>
                                </div>

                                {newFieldType === 'checkbox' && (
                                    <div style={{background:'white', padding:'10px', borderRadius:'6px', border:'1px dashed #cbd5e1', marginBottom:'10px'}}>
                                        {existingCheckboxSchemas.length > 0 && (
                                            <select 
                                                className="form-control" 
                                                style={{fontSize:'12px', padding:'5px', color:'#64748b', marginBottom:'10px'}}
                                                onChange={(e) => { if(e.target.value) copyOptionsFromExisting(e.target.value); }}
                                                value=""
                                            >
                                                <option value="" disabled>-- Salin Opsi dari Kriteria Lain --</option>
                                                {existingCheckboxSchemas.map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
                                        )}

                                        <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                placeholder="Tambah Opsi (misal: Baik)"
                                                value={tempOption}
                                                onChange={(e) => setTempOption(e.target.value)}
                                                onKeyPress={(e) => { if(e.key === 'Enter') handleAddOption(); }}
                                            />
                                            <button onClick={handleAddOption} className="btn-add" style={{marginTop:0, width:'auto'}}>+</button>
                                        </div>
                                        <div style={{display:'flex', flexWrap:'wrap', gap:'5px'}}>
                                            {newCheckboxOptions.map((opt, idx) => (
                                                <span key={idx} style={{background:'#eff6ff', padding:'2px 8px', borderRadius:'12px', fontSize:'11px', border:'1px solid #bfdbfe', display:'flex', alignItems:'center', gap:'5px'}}>
                                                    {opt} <i className="fa-solid fa-xmark" onClick={() => handleRemoveOption(idx)} style={{cursor:'pointer', color:'#ef4444'}}></i>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button onClick={handleAddSchemaToDb} className="btn-primary" style={{width:'100%', padding:'10px', fontSize:'14px'}}>
                                    Simpan Kriteria Baru
                                </button>
                            </div>
                        </div>

                    </div>
                    <div className="modal-footer">
                        <button className="btn-cancel" onClick={() => setShowManageModal(false)}>Tutup</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL 2: COPY RAPORT */}
        {showCopyModal && (
            <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowCopyModal(false)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
                    <div className="modal-header">
                        <h3>Salin Nilai Raport</h3>
                        <button className="close-modal" onClick={() => setShowCopyModal(false)}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <p style={{fontSize:'13px', color:'#64748b', marginBottom:'15px'}}>Pilih siswa sumber.</p>
                        <select className="form-control" value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)}>
                            <option value="">-- Pilih Siswa --</option>
                            {studentsForCopy.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="modal-footer">
                        <button className="btn-cancel" onClick={() => setShowCopyModal(false)}>Batal</button>
                        <button className="btn-save" onClick={handleCopyRaport}>Salin Data</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default RaportForm;