import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
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
    const [searchQuery, setSearchQuery] = useState('');

    // savingsData: { balance: number }
    const [savingsData, setSavingsData] = useState({});
    const [loading, setLoading] = useState(true);

    // Modal Export & Preview State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportTargetId, setExportTargetId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // State untuk Data Preview di Layar
    const [previewRows, setPreviewRows] = useState([]);

    // State khusus untuk data yang akan di-render di JPG (Hidden Div)
    const [exportData, setExportData] = useState(null);

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1. FETCH DATA SISWA & BALANCE LANGSUNG DARI DOKUMEN USER
    useEffect(() => {
        const fetchData = async () => {
            try {
                const usersSnap = await getDocs(collection(db, "users"));
                const usersList = [];
                const stats = {};

                usersSnap.forEach(docSnap => {
                    const u = docSnap.data();
                    const uid = docSnap.id;

                    usersList.push({
                        id: uid,
                        name: u.name,
                        fullName: u.fullName,
                        nickname: u.nickname,
                        photo: u.photo,
                        status: u.status
                    });

                    // Ambil nilai balance langsung dari dokumen user
                    stats[uid] = {
                        balance: u.balance || 0
                    };
                });

                setStudents(usersList);
                setSavingsData(stats);
                setLoading(false);

            } catch (error) {
                console.error("Error fetching students:", error);
                toast.error("Gagal memuat data siswa.");
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // 2. FUNGSI AMBIL SEMUA DATA TRANSAKSI SISWA TERPILIH
    const fetchTransactionData = async () => {
        if (!exportTargetId) return [];

        let q;
        if (startDate && endDate) {
            // Jika ada filter tanggal
            q = query(
                collection(db, "transactions"),
                where("userId", "==", exportTargetId),
                where("date", ">=", startDate),
                where("date", "<=", endDate),
                orderBy("date", "asc")
            );
        } else {
            // Mengambil SELURUH transaksi siswa tanpa batasan tanggal
            q = query(
                collection(db, "transactions"),
                where("userId", "==", exportTargetId),
                orderBy("date", "asc")
            );
        }

        const querySnapshot = await getDocs(q);

        let runningBalance = 0;
        const rows = [];

        querySnapshot.forEach(docSnap => {
            const t = docSnap.data();
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

    // 3. UPDATE PREVIEW SAAT TANGGAL/SISWA BERUBAH
    useEffect(() => {
        if (showExportModal && exportTargetId) {
            const loadPreview = async () => {
                const data = await fetchTransactionData();
                setPreviewRows(data);
            };
            loadPreview();
        }
    }, [showExportModal, exportTargetId, startDate, endDate]);

    // 4. HANDLER SAAT CARD DI KLIK (Mencari Rentang Awal & Akhir Transaksi Siswa)
    const handleCardClick = async (studentId) => {
        const today = new Date().toISOString().split('T')[0];
        setExportTargetId(studentId);

        try {
            // Ambil tanggal transaksi paling awal (terlama)
            const qMin = query(
                collection(db, "transactions"),
                where("userId", "==", studentId),
                orderBy("date", "asc"),
                limit(1)
            );
            // Ambil tanggal transaksi paling akhir (terbaru)
            const qMax = query(
                collection(db, "transactions"),
                where("userId", "==", studentId),
                orderBy("date", "desc"),
                limit(1)
            );

            const [snapMin, snapMax] = await Promise.all([getDocs(qMin), getDocs(qMax)]);

            let minDate = today;
            let maxDate = today;

            if (!snapMin.empty) minDate = snapMin.docs[0].data().date;
            if (!snapMax.empty) maxDate = snapMax.docs[0].data().date;

            // Set tanggal dari transaksi PERTAMA sampai TERAKHIR
            setStartDate(minDate);
            setEndDate(maxDate);

        } catch (err) {
            console.error("Error fetching date range:", err);
            setStartDate('');
            setEndDate('');
        }

        setShowExportModal(true);
    };

    // --- EXPORT PDF ---
    const handleExportPDF = async () => {
        if (!exportTargetId) return;
        setIsExporting(true);

        try {
            const rows = previewRows.length > 0 ? previewRows : await fetchTransactionData();
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
        if (!exportTargetId) return;
        setIsExporting(true);

        try {
            const rows = previewRows.length > 0 ? previewRows : await fetchTransactionData();
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
        if (!dStr) return '-';
        const d = new Date(dStr);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }

    const getSelectedStudentName = () => {
        const s = students.find(u => u.id === exportTargetId);
        return s ? (s.nickname || s.name) : "Loading...";
    }

    // LOGIKA FILTER SEARCH
    const searchedStudents = students.filter(student => {
        if (!searchQuery) return true;

        const queryStr = searchQuery.toLowerCase();
        const matchFullName = (student.fullName || '').toLowerCase().includes(queryStr);
        const matchNickname = (student.nickname || student.name || '').toLowerCase().includes(queryStr);

        return matchFullName || matchNickname;
    });

    return (
        <div style={{ width: '100%' }}>

            {/* HEADER DENGAN SEARCH BAR */}
            <div className="header-section">
                <div className="page-title-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '15px' }}>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button className="mobile-toggle-btn floating-menu-btn" onClick={toggleSidebar} style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
                            <i className="fa-solid fa-bars" style={{ color: '#334155', fontSize: '16px' }}></i>
                        </button>
                        <div className="page-title" style={{ marginLeft: windowWidth < 768 ? '50px' : '0' }}>
                            <h1>Student Savings</h1>
                            <p>Klik kartu siswa untuk melihat buku tabungan</p>
                        </div>
                    </div>

                    {/* SEARCH BAR */}
                    <div style={{ position: 'relative', minWidth: '250px', maxWidth: '350px', flex: '1', marginTop: windowWidth < 768 ? '10px' : '0' }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                        <input
                            type="text"
                            placeholder="Cari nama siswa..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="form-control"
                            style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', margin: 0 }}
                        />
                    </div>

                </div>
            </div>

            <div className="user-grid">
                {loading ? <p style={{ color: 'var(--text-gray)' }}>Memuat data saldo...</p> : searchedStudents.length === 0 ? (
                    <p style={{ color: 'var(--text-gray)' }}>
                        {searchQuery ? 'Siswa tidak ditemukan.' : 'Belum ada siswa.'}
                    </p>
                ) : (
                    searchedStudents.map((student) => {
                        const stats = savingsData[student.id] || { balance: 0 };
                        const balance = stats.balance;
                        const displayName = student.nickname || student.name;

                        return (
                            <div
                                className="user-card"
                                key={student.id}
                                style={{ alignItems: 'center', cursor: 'pointer', transition: 'transform 0.1s' }}
                                onClick={() => handleCardClick(student.id)}
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
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                        <i className="fa-solid fa-book-open"></i> Lihat Buku
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- MODAL EXPORT & PREVIEW --- */}
            {showExportModal && (
                <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowExportModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
                        <div className="modal-header">
                            <h3>Buku Tabungan</h3>
                            <button className="close-modal" onClick={() => setShowExportModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">

                            {/* 1. Filter Tanggal */}
                            <div style={{
                                background: '#f8fafc', padding: '15px', borderRadius: '8px',
                                border: '1px solid #e2e8f0', marginBottom: '15px'
                            }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '10px' }}>
                                    {getSelectedStudentName()}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '11px', color: '#64748b' }}>Dari</label>
                                        <input type="date" className="form-control" style={{ fontSize: '13px', padding: '6px' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '11px', color: '#64748b' }}>Sampai</label>
                                        <input type="date" className="form-control" style={{ fontSize: '13px', padding: '6px' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* 2. PREVIEW TABLE (SCROLLABLE) */}
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Preview Transaksi:</h4>
                                <div style={{
                                    maxHeight: '250px', overflowY: 'auto',
                                    border: '1px solid #e2e8f0', borderRadius: '6px'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 1 }}>
                                            <tr>
                                                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Tgl</th>
                                                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: 'green' }}>Masuk</th>
                                                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: 'red' }}>Keluar</th>
                                                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Sisa</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.length === 0 ? (
                                                <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Tidak ada data pada periode ini.</td></tr>
                                            ) : (
                                                previewRows.map((row, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '6px 8px' }}>{row.date}</td>
                                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: row.in !== '-' ? 'green' : '#cbd5e1' }}>{row.in}</td>
                                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: row.out !== '-' ? 'red' : '#cbd5e1' }}>{row.out}</td>
                                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>{row.balance}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* 3. Tombol Export */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-submit" onClick={handleExportPDF} disabled={isExporting} style={{ flex: 1, background: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                                    <i className="fa-solid fa-file-pdf"></i> Download PDF
                                </button>
                                <button className="btn-submit" onClick={handleExportJPG} disabled={isExporting} style={{ flex: 1, background: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                                    <i className="fa-solid fa-image"></i> Download JPG
                                </button>
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
                    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
                        <h2 style={{ margin: 0, fontSize: '24px' }}>BUKU TABUNGAN SISWA</h2>
                        <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>PAUD ROHANI</p>
                    </div>

                    <div style={{ marginBottom: '20px', fontSize: '14px' }}>
                        <p><strong>Nama Siswa:</strong> {exportData.studentName}</p>
                        <p><strong>Periode:</strong> {exportData.period}</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ background: '#e5e7eb' }}>
                                <th style={{ border: '1px solid black', padding: '8px' }}>TANGGAL</th>
                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'right' }}>MASUK (Rp)</th>
                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'right' }}>KELUAR (Rp)</th>
                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'right' }}>SISA (Rp)</th>
                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>PARAF</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exportData.rows.map((row, idx) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid black', padding: '8px' }}>{row.date}</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'right' }}>{row.in}</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'right' }}>{row.out}</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{row.balance}</td>
                                    <td style={{ border: '1px solid black', padding: '8px' }}></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '40px', textAlign: 'right', fontSize: '12px' }}>
                        <p>Dicetak secara otomatis pada {new Date().toLocaleDateString('id-ID')}</p>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StudentSavings;