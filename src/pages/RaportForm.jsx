import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  collection, getDocs, doc, setDoc, addDoc, getDoc, 
  query, orderBy, serverTimestamp, onSnapshot, writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase'; // Hapus storage karena pakai Firestore Base64
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

// LIBRARY DRAG & DROP
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// LIBRARY EXCEL BARU (SUPPORT GAMBAR)
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const RaportForm = () => {
  const { toggleSidebar } = useOutletContext();

  // --- STATE DATA ---
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assessmentSchema, setAssessmentSchema] = useState([]); 
  const [answers, setAnswers] = useState({});
  
  // Photo State (Sekarang Array untuk Multi-Foto)
  const [existingPhotos, setExistingPhotos] = useState([]); // Foto dari DB
  const [newPhotoBase64, setNewPhotoBase64] = useState(''); // Foto baru yang akan diupload
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // UI State
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // --- STATE MODAL MANAGE ---
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
        // Fetch Students
        const usersSnap = await getDocs(collection(db, "users"));
        const studentsList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStudents(studentsList);

        // Fetch Schema
        const qSchema = query(collection(db, "raport_schema")); 
        const unsubscribe = onSnapshot(qSchema, (snapshot) => {
          const schemaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        setExistingPhotos([]);
        setNewPhotoBase64('');
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
              // Handle legacy data (string) vs new data (array)
              if (Array.isArray(data.evidencePhotos)) {
                  setExistingPhotos(data.evidencePhotos);
              } else if (data.evidencePhoto) {
                  setExistingPhotos([data.evidencePhoto]);
              } else {
                  setExistingPhotos([]);
              }
          } else {
              setAnswers({});
              setExistingPhotos([]);
          }
          setNewPhotoBase64('');
      } catch (error) {
          toast.error("Gagal mengambil data raport.");
      } finally {
          setLoading(false);
      }
  };

  // --- HELPER: BASE64 ---
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // --- HANDLER FOTO ---
  const handlePhotoUpload = async (e) => {
      const file = e.target.files[0];
      if(!file) return;

      setIsProcessingPhoto(true);
      // Kompresi agar Excel tidak crash (max 150KB per foto disarankan)
      const options = { maxSizeMB: 0.15, maxWidthOrHeight: 600, useWebWorker: true };

      try {
        const compressedFile = await imageCompression(file, options);
        const base64String = await fileToBase64(compressedFile);
        setNewPhotoBase64(base64String); 
        toast.success("Foto siap disimpan!");
      } catch (error) { 
        toast.error("Gagal memproses foto."); 
      } finally { 
        setIsProcessingPhoto(false); 
      }
  };

  // --- SAVE DATA (MULTI FOTO) ---
  const handleSaveRaport = async () => {
      if(!selectedStudentId) return toast.error("Pilih siswa!");
      setIsSaving(true);
      try {
          const student = students.find(s => s.id === selectedStudentId);
          
          // Gabungkan foto lama + foto baru (jika ada)
          let updatedPhotos = [...existingPhotos];
          if (newPhotoBase64) {
              updatedPhotos.push(newPhotoBase64);
          }

          const raportPayload = {
              studentId: selectedStudentId,
              studentName: student?.name || "Unknown",
              scores: answers,
              evidencePhotos: updatedPhotos, // Simpan Array
              updatedAt: serverTimestamp(),
          };
          
          await setDoc(doc(db, "raport", selectedStudentId), raportPayload);
          
          setExistingPhotos(updatedPhotos); // Update UI
          setNewPhotoBase64(''); // Reset input foto baru
          toast.success(`Raport berhasil disimpan!`);
      } catch (error) { 
          if (error.code === 'resource-exhausted') {
              toast.error("Data terlalu besar (Terlalu banyak foto).");
          } else {
              toast.error("Gagal menyimpan raport."); 
          }
      } finally { 
          setIsSaving(false); 
      }
  };

  // ==========================================
  // FITUR EXPORT EXCEL DENGAN GAMBAR (EXCELJS)
  // ==========================================
  const handleExportExcel = async () => {
      setIsExporting(true);
      try {
          // 1. Ambil Data
          const raportSnap = await getDocs(collection(db, "raport"));
          const raportMap = {};
          let maxPhotoCount = 0; // Untuk menghitung berapa kolom header foto dibutuhkan

          raportSnap.forEach(doc => {
              const d = doc.data();
              raportMap[doc.id] = d;
              // Cek jumlah foto terbanyak
              const pCount = d.evidencePhotos?.length || (d.evidencePhoto ? 1 : 0);
              if (pCount > maxPhotoCount) maxPhotoCount = pCount;
          });

          // 2. Setup Workbook & Worksheet
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Raport Siswa');

          // 3. Define Columns
          const columns = [
              { header: 'No', key: 'no', width: 5 },
              { header: 'Nama Lengkap', key: 'name', width: 25 },
              { header: 'Kelas', key: 'class', width: 10 },
              { header: 'NISN', key: 'nisn', width: 15 },
          ];

          // Tambah kolom Aspek Penilaian
          assessmentSchema.forEach(field => {
              columns.push({ header: field.label, key: field.id, width: 20 });
          });

          // Tambah kolom Foto Dinamis (Foto 1, Foto 2, dst)
          for (let i = 1; i <= maxPhotoCount; i++) {
              columns.push({ header: `Foto ${i}`, key: `foto_${i}`, width: 18 }); 
          }

          worksheet.columns = columns;

          // Style Header
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(1).fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFE0E0E0'} };

          // 4. Isi Data Rows & Embed Images
          for (let i = 0; i < students.length; i++) {
              const student = students[i];
              const rData = raportMap[student.id] || {};
              const scores = rData.scores || {};
              
              // Normalisasi array foto
              let photos = [];
              if (Array.isArray(rData.evidencePhotos)) photos = rData.evidencePhotos;
              else if (rData.evidencePhoto) photos = [rData.evidencePhoto];

              // Base Row Data
              const rowData = {
                  no: i + 1,
                  name: student.name || '',
                  class: student.className || '-',
                  nisn: student.nisn || '-',
              };

              // Isi Nilai Aspek
              assessmentSchema.forEach(field => {
                  let val = scores[field.label];
                  if (Array.isArray(val)) val = val.join(", ");
                  rowData[field.id] = val || '-';
              });

              // Tambahkan row ke worksheet
              const row = worksheet.addRow(rowData);
              
              // Set Tinggi Baris agar foto muat
              if (photos.length > 0) {
                  row.height = 100; // Tinggi pixel untuk menampung gambar
              }

              // EMBED GAMBAR KE CELL
              photos.forEach((base64, idx) => {
                  if (base64 && base64.startsWith('data:image')) {
                      // Hapus prefix data:image/...;base64,
                      const imageId = workbook.addImage({
                          base64: base64,
                          extension: 'jpeg', // Asumsi jpeg dari kompresi
                      });

                      // Tentukan Lokasi Kolom untuk Foto ke-(idx+1)
                      // Kolom statis (4) + Jumlah Aspek + Index Foto
                      const colIndex = 4 + assessmentSchema.length + idx;

                      worksheet.addImage(imageId, {
                          tl: { col: colIndex, row: row.number - 1 }, // Top Left (row number is 1-based, need 0-based for image)
                          br: { col: colIndex + 1, row: row.number }, // Bottom Right
                          editAs: 'oneCell' // Agar gambar ikut jika cell diresize
                      });
                  }
              });
          }

          // 5. Generate & Download
          const buffer = await workbook.xlsx.writeBuffer();
          saveAs(new Blob([buffer]), `Rekap_Raport_Foto_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`);
          toast.success("Excel dengan foto berhasil diunduh!");

      } catch (error) {
          console.error(error);
          toast.error("Gagal export excel. Foto mungkin terlalu besar.");
      } finally {
          setIsExporting(false);
      }
  };

  // --- LOGIC MANAGE SCHEMA ---
  const handleAddOption = () => { if (tempOption.trim()) { setNewCheckboxOptions([...newCheckboxOptions, tempOption.trim()]); setTempOption(''); } };
  const handleRemoveOption = (idx) => { setNewCheckboxOptions(newCheckboxOptions.filter((_, i) => i !== idx)); };
  
  const handleAddSchemaToDb = async () => {
      if(!newFieldName.trim()) return toast.error("Wajib diisi");
      try {
          const newOrder = assessmentSchema.length; 
          await addDoc(collection(db, "raport_schema"), {
              label: newFieldName, type: newFieldType, options: newCheckboxOptions, order: newOrder, createdAt: serverTimestamp()
          });
          toast.success("Berhasil!"); setNewFieldName(''); setNewCheckboxOptions([]); setTempOption('');
      } catch (e) { toast.error("Gagal."); }
  };

  const onDragEnd = async (result) => {
      if (!result.destination) return;
      const items = Array.from(assessmentSchema);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setAssessmentSchema(items);
      try {
          const batch = writeBatch(db);
          items.forEach((item, index) => { const docRef = doc(db, "raport_schema", item.id); batch.update(docRef, { order: index }); });
          await batch.commit();
      } catch (e) { toast.error("Gagal reorder."); }
  };

  const copyOptionsFromExisting = (sourceId) => {
    const source = assessmentSchema.find(s => s.id === sourceId);
    if(source) setNewCheckboxOptions([...source.options]);
  };

  // --- LOGIC INPUT ---
  const handleInputChange = (fieldLabel, value) => { setAnswers(prev => ({ ...prev, [fieldLabel]: value })); };

  // --- LOGIC COPY ---
  const handleCopyRaport = async () => {
      if(!copySourceId) return toast.error("Pilih siswa asal!");
      try {
          const docSnap = await getDoc(doc(db, "raport", copySourceId));
          if (docSnap.exists()) { setAnswers(docSnap.data().scores || {}); toast.success("Disalin!"); setShowCopyModal(false); } 
          else { toast.error("Data kosong."); }
      } catch (e) { toast.error("Gagal copy."); }
  };

  const studentsForCopy = students.filter(s => s.id !== selectedStudentId);
  const existingCheckboxSchemas = assessmentSchema.filter(s => s.type === 'checkbox');

  return (
    <div style={{ width: '100%' }}>
        <div className="header-section">
            <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                <button className="mobile-toggle-btn floating-menu-btn" onClick={toggleSidebar} style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer' }}> <i className="fa-solid fa-bars" style={{color: '#334155', fontSize: '16px'}}></i> </button>
                <div className="page-title" style={{ marginLeft: window.innerWidth < 768 ? '50px' : '0' }}><h1>Form Raport</h1><p>Input penilaian & dokumentasi</p></div>
            </div>
            
            {/* TOMBOL EXPORT */}
            <button className="btn-add" onClick={handleExportExcel} disabled={isExporting} style={{backgroundColor:'#16a34a'}}> 
                <i className="fa-solid fa-file-excel"></i> {isExporting ? '...' : 'Export Excel'} 
            </button>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', gap: '20px' }}>
            {/* CARD PILIH SISWA */}
            <div className="form-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 'bold' }}>Pilih Siswa</label>
                <select className="form-control" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} style={{ fontSize: '16px', padding: '10px' }}>
                    <option value="" disabled>-- Pilih Nama Siswa --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {selectedStudentId && (
                <div className="form-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Lembar Penilaian</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {/* TOMBOL COPY */}
                            <button onClick={() => setShowCopyModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#fff7ed', color: '#ea580c', border: 'none', borderRadius: '8px', cursor:'pointer' }} title="Copy"> <i className="fa-solid fa-copy"></i> </button>
                            
                            {/* TOMBOL TAMBAH PENILAIAN (REQ BARU) */}
                            <button onClick={() => setShowManageModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                <i className="fa-solid fa-plus"></i> Kriteria
                            </button>

                            {/* TOMBOL ATUR ASPEK (REORDER) */}
                            <button onClick={() => setShowManageModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }} title="Atur Susunan">
                                <i className="fa-solid fa-bars"></i>
                            </button>
                        </div>
                    </div>

                    {/* AREA FOTO MULTIPLE */}
                    <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border:'1px solid #e2e8f0' }}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                            <label style={{fontWeight:'600', color:'#334155', fontSize:'13px'}}>Dokumentasi ({existingPhotos.length + (newPhotoBase64 ? 1 : 0)} Foto)</label>
                            <div style={{ position: 'relative', overflow: 'hidden' }}>
                                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize:'12px', background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: '6px', cursor:'pointer' }}>
                                    <i className="fa-solid fa-camera"></i> {isProcessingPhoto ? 'Processing...' : 'Tambah Foto'}
                                </button>
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isProcessingPhoto} style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                            </div>
                        </div>
                        
                        {/* List Foto */}
                        <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'5px'}}>
                            {existingPhotos.map((photo, idx) => (
                                <img key={idx} src={photo} alt={`Foto ${idx+1}`} style={{ width: '80px', height: '80px', objectFit:'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            ))}
                            {newPhotoBase64 && (
                                <div style={{position:'relative'}}>
                                    <img src={newPhotoBase64} alt="New" style={{ width: '80px', height: '80px', objectFit:'cover', borderRadius: '6px', border: '2px solid #3b82f6' }} />
                                    <span style={{position:'absolute', top:0, right:0, background:'#3b82f6', color:'white', fontSize:'9px', padding:'2px 4px', borderRadius:'0 0 0 4px'}}>Baru</span>
                                </div>
                            )}
                            {existingPhotos.length === 0 && !newPhotoBase64 && (
                                <p style={{fontSize:'12px', color:'#94a3b8', fontStyle:'italic'}}>Belum ada foto.</p>
                            )}
                        </div>
                    </div>

                    {/* FORM DINAMIS */}
                    {loading ? <p>Memuat...</p> : (
                        <div style={{ display: 'grid', gap: '20px' }}>
                            {assessmentSchema.map((field) => (
                                <div key={field.id} style={{paddingBottom:'15px', borderBottom:'1px dashed #e2e8f0'}}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>{field.label}</label>
                                    {field.type === 'checkbox' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                                            {field.options && field.options.map((option, idx) => {
                                                const isSelected = answers[field.label] === option;
                                                return (
                                                    <div key={idx} onClick={() => handleInputChange(field.label, option)} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding:'8px 12px', borderRadius:'6px', border:'1px solid', background: isSelected ? '#eff6ff' : 'white', borderColor: isSelected ? '#3b82f6' : '#e2e8f0', color: isSelected ? '#1d4ed8' : '#334155', fontWeight: isSelected ? '600' : 'normal', transition: 'all 0.2s' }}>
                                                        <div style={{ width:'16px', height:'16px', borderRadius:'50%', border:'1px solid', borderColor: isSelected ? '#3b82f6' : '#cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', background:'white' }}>{isSelected && <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'#3b82f6'}}></div>}</div>{option}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <textarea className="form-control" rows="2" placeholder="Keterangan..." value={answers[field.label] || ''} onChange={(e) => handleInputChange(field.label, e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}></textarea>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: '30px' }}>
                        <button className="btn-primary" onClick={handleSaveRaport} disabled={isSaving} style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' }}>{isSaving ? 'Menyimpan...' : 'Simpan Raport'}</button>
                    </div>
                </div>
            )}
        </div>

        {/* MODAL MANAGE (SAMA SEPERTI SEBELUMNYA) */}
        {showManageModal && (
            <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowManageModal(false)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:'600px', width:'95%'}}>
                    <div className="modal-header"><h3>Atur Kriteria Penilaian</h3><button className="close-modal" onClick={() => setShowManageModal(false)}>&times;</button></div>
                    <div className="modal-body" style={{maxHeight:'70vh', overflowY:'auto'}}>
                        <div style={{marginBottom:'30px', borderBottom:'1px solid #e2e8f0', paddingBottom:'20px'}}>
                            <h4 style={{fontSize:'14px', color:'#64748b', marginBottom:'10px'}}>Urutan Tampilan (Geser "=")</h4>
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="schemaList">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                            {assessmentSchema.map((item, index) => (
                                                <Draggable key={item.id} draggableId={item.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} style={{ userSelect: 'none', padding: '12px', backgroundColor: snapshot.isDragging ? '#eff6ff' : 'white', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...provided.draggableProps.style }}>
                                                            <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                                                <div {...provided.dragHandleProps} style={{cursor:'grab', color:'#94a3b8', padding:'5px'}}><i className="fa-solid fa-bars"></i></div>
                                                                <div><div style={{fontWeight:'600', color:'#334155', fontSize:'14px'}}>{item.label}</div><div style={{fontSize:'11px', color:'#64748b'}}>{item.type === 'checkbox' ? `${item.options.length} Opsi` : 'Text Deskripsi'}</div></div>
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
                        <div>
                            <h4 style={{fontSize:'14px', color:'#64748b', marginBottom:'10px'}}>Tambah Kriteria Baru</h4>
                            <div style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
                                <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                    <div style={{flex:2}}><input type="text" className="form-control" placeholder="Nama Kriteria" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} /></div>
                                    <div style={{flex:1}}><select className="form-control" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}><option value="text">Text</option><option value="checkbox">Checkbox</option></select></div>
                                </div>
                                {newFieldType === 'checkbox' && (
                                    <div style={{background:'white', padding:'10px', borderRadius:'6px', border:'1px dashed #cbd5e1', marginBottom:'10px'}}>
                                        {existingCheckboxSchemas.length > 0 && (<select className="form-control" style={{fontSize:'12px', padding:'5px', color:'#64748b', marginBottom:'10px'}} onChange={(e) => { if(e.target.value) copyOptionsFromExisting(e.target.value); }} value=""><option value="" disabled>-- Salin Opsi --</option>{existingCheckboxSchemas.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}</select>)}
                                        <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}><input type="text" className="form-control" placeholder="Tambah Opsi" value={tempOption} onChange={(e) => setTempOption(e.target.value)} onKeyPress={(e) => { if(e.key === 'Enter') handleAddOption(); }} /><button onClick={handleAddOption} className="btn-add" style={{marginTop:0, width:'auto'}}>+</button></div>
                                        <div style={{display:'flex', flexWrap:'wrap', gap:'5px'}}>{newCheckboxOptions.map((opt, idx) => (<span key={idx} style={{background:'#eff6ff', padding:'2px 8px', borderRadius:'12px', fontSize:'11px', border:'1px solid #bfdbfe', display:'flex', alignItems:'center', gap:'5px'}}>{opt} <i className="fa-solid fa-xmark" onClick={() => handleRemoveOption(idx)} style={{cursor:'pointer', color:'#ef4444'}}></i></span>))}</div>
                                    </div>
                                )}
                                <button onClick={handleAddSchemaToDb} className="btn-primary" style={{width:'100%', padding:'10px', fontSize:'14px'}}>Simpan Kriteria</button>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer"><button className="btn-cancel" onClick={() => setShowManageModal(false)}>Tutup</button></div>
                </div>
            </div>
        )}

        {/* MODAL COPY (SAMA) */}
        {showCopyModal && (
            <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowCopyModal(false)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
                    <div className="modal-header"><h3>Salin Nilai</h3><button className="close-modal" onClick={() => setShowCopyModal(false)}>&times;</button></div>
                    <div className="modal-body"><p style={{fontSize:'13px', color:'#64748b', marginBottom:'15px'}}>Pilih siswa sumber.</p><select className="form-control" value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)}><option value="">-- Pilih Siswa --</option>{studentsForCopy.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
                    <div className="modal-footer"><button className="btn-cancel" onClick={() => setShowCopyModal(false)}>Batal</button><button className="btn-save" onClick={handleCopyRaport}>Salin Data</button></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default RaportForm;