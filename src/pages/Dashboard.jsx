import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const Dashboard = () => {
  const { toggleSidebar } = useOutletContext();
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // --- STATE DATA ---
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalBrankas, setTotalBrankas] = useState(0); 
  const [recentIncome, setRecentIncome] = useState([]);
  const [todayMissingUsers, setTodayMissingUsers] = useState([]);
  const [historyMissingIncome, setHistoryMissingIncome] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [userMap, setUserMap] = useState({}); 

  // --- STATE CHECKPOINT BRANKAS ---
  const [checkpointData, setCheckpointData] = useState({ amount: 0, date: '1970-01-01' });
  
  // --- STATE UI MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [tempBrankasInput, setTempBrankasInput] = useState('');
  const [tempBrankasDate, setTempBrankasDate] = useState('');

  // --- STATE UI MOBILE STACK ---
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  // --- STATE CHART ---
  const [chartFilter, setChartFilter] = useState('1week');
  const [visibleRecent, setVisibleRecent] = useState(3);
  const [visibleMissing, setVisibleMissing] = useState(3);
  const [visibleHistory, setVisibleHistory] = useState(3);
  const [incomeMapData, setIncomeMapData] = useState({});
  const [otherMapData, setOtherMapData] = useState({});
  const [feeMapData, setFeeMapData] = useState({});

  // --- RESPONSIVE ---
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- UTILS ---
  const isWeekend = () => { const day = new Date().getDay(); return day === 0 || day === 6; };
  const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  const getTodayString = () => { const d = new Date(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; };
  const getTodayFormatted = () => new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatDateIndo = (dateStr) => { if(!dateStr) return "-"; const d = new Date(dateStr); return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "US";

  // --- LOGIC TOTAL REVENUE ---
  const totalRevenue = totalBrankas - totalSavings;

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. CHECKPOINT BRANKAS
        const checkpointRef = doc(db, "settings", "brankas_checkpoint");
        const checkpointSnap = await getDoc(checkpointRef);
        
        let cpAmount = 0;
        let cpDate = '1970-01-01';

        if (checkpointSnap.exists()) {
            const data = checkpointSnap.data();
            cpAmount = parseInt(data.amount) || 0;
            cpDate = data.date || '1970-01-01';
        }
        setCheckpointData({ amount: cpAmount, date: cpDate });

        // 2. USERS
        const usersSnap = await getDocs(collection(db, "users"));
        let allUsers = [];
        let uMap = {};
        usersSnap.forEach(doc => {
            const d = doc.data();
            const userData = { id: doc.id, name: d.name, nickname: d.nickname, photo: d.photo };
            allUsers.push(userData);
            uMap[doc.id] = userData; 
        });
        setUserMap(uMap);

        // 3. TRANSACTIONS
        const transRef = collection(db, "transactions");
        const qTrans = query(transRef, orderBy("date", "asc"));
        const transSnap = await getDocs(qTrans);

        let currentTotalSavings = 0;
        let calculatedBrankas = cpAmount;

        let todayTrans = [];
        let paidUserIdsToday = new Set();
        let iMap = {}; let oMap = {}; 
        const todayStr = getTodayString();

        transSnap.forEach(doc => {
          const t = doc.data();
          const amount = parseInt(t.amount) || 0;
          const isOther = t.userId === 'other';

          // A. Savings Logic
          if (!isOther && !t.skipSavings) {
              if(t.type === 'income') currentTotalSavings += amount;
              else if(t.type === 'expense') currentTotalSavings -= amount;
          }

          // B. Brankas Logic (After Checkpoint)
          if (t.date > cpDate) {
              if (t.type === 'income') calculatedBrankas += amount;
              else if (t.type === 'expense') calculatedBrankas -= amount;
          }

          // C. Data UI
          if (t.date === todayStr && t.type === 'income') {
             todayTrans.push(t);
             if(!isOther) paidUserIdsToday.add(t.userId);
          }

          if(!t.isCheckpoint) {
            const val = t.type === 'income' ? amount : -amount;
            if (isOther) oMap[t.date] = (oMap[t.date] || 0) + val;
            else iMap[t.date] = (iMap[t.date] || 0) + val;
          }
        });

        // 4. SCHOOL FEE (ATTENDANCE)
        const attRef = collection(db, "attendance");
        const qAtt = query(attRef, orderBy("date", "desc"), limit(40)); 
        const attSnap = await getDocs(qAtt);
        let missingHistoryList = [];
        let fMap = {};

        attSnap.forEach(doc => {
            const date = doc.id; 
            const records = doc.data().records || {};
            let hCount = 0;
            Object.entries(records).forEach(([userId, status]) => {
                if (status === '?') missingHistoryList.push({ userId, date, name: uMap[userId]?.nickname || uMap[userId]?.name || "Unknown" });
                if (status === 'H') hCount++;
            });
            fMap[date] = hCount * 6000;
        });

        setTotalSavings(currentTotalSavings);
        setTotalBrankas(calculatedBrankas); 
        setRecentIncome(todayTrans.reverse());
        setTodayMissingUsers(allUsers.filter(u => !paidUserIdsToday.has(u.id)));
        setHistoryMissingIncome(missingHistoryList); 
        setIncomeMapData(iMap); setOtherMapData(oMap); setFeeMapData(fMap);
        setLoading(false);

      } catch (error) { console.error(error); toast.error("Error loading data"); }
    };
    fetchData();
  }, []); 

  // --- SAVE BRANKAS ---
  const handleSaveBrankas = async () => {
    const val = parseInt(tempBrankasInput) || 0;
    const date = tempBrankasDate || getTodayString();

    try {
        await setDoc(doc(db, "settings", "brankas_checkpoint"), {
            amount: val,
            date: date,
            updatedAt: new Date()
        });
        setCheckpointData({ amount: val, date: date });
        setTotalBrankas(val); 
        toast.success("Brankas Checkpoint Updated!");
        setShowModal(false);
        setTimeout(() => window.location.reload(), 1000); 
    } catch (error) {
        console.error(error);
        toast.error("Gagal menyimpan.");
    }
  };

  const openModal = () => {
    setTempBrankasInput(totalBrankas); 
    setTempBrankasDate(getTodayString());
    setShowModal(true);
  }

  // --- CHART RENDER ---
  useEffect(() => { if(!loading) renderChart(); }, [loading, chartFilter, incomeMapData, otherMapData, feeMapData, windowWidth]);

  const renderChart = () => {
    if (chartInstance.current) chartInstance.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    const labels = []; const dataSavings = []; const dataFee = []; const dataOther = []; const dataTotal = [];
    const isMobile = windowWidth < 768;
    let daysToFetch = chartFilter === '1week' ? 5 : chartFilter === '2week' ? 10 : chartFilter === '3week' ? 15 : 20;
    let currentDate = new Date(); let count = 0;

    while (count < daysToFetch) {
        const dayNum = currentDate.getDay(); 
        if (dayNum !== 0 && dayNum !== 6) {
            const dateStr = currentDate.toISOString().split('T')[0];
            labels.unshift(currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }));
            const valSav = incomeMapData[dateStr] || 0;
            const valFee = feeMapData[dateStr] || 0;
            const valOth = otherMapData[dateStr] || 0;
            dataSavings.unshift(valSav); dataFee.unshift(valFee); dataOther.unshift(valOth);
            dataTotal.unshift(valSav + valFee + valOth);
            count++;
        }
        currentDate.setDate(currentDate.getDate() - 1);
    }

    chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Savings', data: dataSavings, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3, pointRadius: 2 },
                { label: 'School Fee', data: dataFee, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, pointRadius: 2 },
                { label: 'Other', data: dataOther, borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.3, pointRadius: 2 },
                { label: 'Total Revenue', data: dataTotal, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderDash: [5, 5], tension: 0.4, fill: true, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: isMobile ? true : false, 
            aspectRatio: isMobile ? 1 : null,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: true }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': Rp ' + ctx.parsed.y.toLocaleString('id-ID') } } },
            scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (val) => (val/1000) + 'k' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: isMobile ? 5 : 10 } } }
        }
    });
  };

  // --- LOGIKA ANIMASI & STYLING MOBILE ---
  const isMobile = windowWidth < 768;
  const CARD_HEIGHT = 140; 
  const GAP = 20; 

  // Container style untuk animasi tinggi
  const gridContainerStyle = isMobile ? {
      position: 'relative',
      height: isStatsExpanded ? `${(CARD_HEIGHT + GAP) * 3}px` : '160px',
      transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)', 
      marginBottom: '25px',
      zIndex: 10
  } : {
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
      gap: '20px', 
      marginBottom: '25px'
  };

  // Helper style per kartu untuk mobile
  const getMobileCardStyle = (index) => {
      if (!isMobile) return {}; 

      const expandedTransform = `translateY(${index * (CARD_HEIGHT + GAP)}px)`;
      const collapsedTransform = `translateY(${index * 12}px) scale(${1 - (index * 0.05)})`;

      return {
          position: 'absolute',
          top: 0, 
          left: 0, 
          width: '100%',
          height: `${CARD_HEIGHT}px`, 
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', 
          transform: isStatsExpanded ? expandedTransform : collapsedTransform,
          zIndex: isStatsExpanded ? 1 : (3 - index), 
          opacity: isStatsExpanded ? 1 : (index === 0 ? 1 : 0.9), 
          boxShadow: !isStatsExpanded && index === 0 ? '0 4px 15px rgba(0,0,0,0.1)' : '0 4px 6px -1px rgba(0,0,0,0.1)'
      };
  };

  // --- SHARED CARD STYLE ---
  const cardBaseStyle = {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
    color: 'white',
    borderRadius: '12px',
    padding: '24px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: `${CARD_HEIGHT}px`,
    cursor: isMobile ? 'pointer' : 'default' 
  };

  const iconBoxStyle = {
      position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)',
      width: '48px', height: '48px', backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
  };

  return (
    <div style={{width: '100%'}}> 
      
      {/* MODAL INPUT BRANKAS */}
      {showModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
            <div style={{backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '320px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}>
                <h3 style={{marginTop: 0, marginBottom: '16px', color: '#1e293b', fontSize: '18px', fontWeight: '600'}}>Checkpoint Brankas</h3>
                
                <label style={{display:'block', marginBottom:'5px', fontSize:'13px', color:'#64748b'}}>Total Fisik (Opname)</label>
                <div style={{position:'relative', marginBottom: '15px'}}>
                    <span style={{position:'absolute', left:'12px', top:'11px', color:'#94a3b8', fontSize:'14px'}}>Rp</span>
                    <input 
                        type="number" 
                        value={tempBrankasInput} 
                        onChange={(e) => setTempBrankasInput(e.target.value)}
                        style={{width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing:'border-box'}}
                        placeholder="0"
                    />
                </div>

                <label style={{display:'block', marginBottom:'5px', fontSize:'13px', color:'#64748b'}}>Tanggal Opname</label>
                <input 
                    type="date" 
                    value={tempBrankasDate} 
                    onChange={(e) => setTempBrankasDate(e.target.value)}
                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', marginBottom: '20px', boxSizing:'border-box'}}
                />
                
                <div style={{fontSize:'11px', color:'#ef4444', marginBottom:'20px', lineHeight:'1.4'}}>
                    <i className="fa-solid fa-circle-info" style={{marginRight:'4px'}}></i>
                    Sistem akan mengakumulasi transaksi mulai dari hari setelah tanggal ini.
                </div>

                <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                    <button onClick={() => setShowModal(false)} style={{padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', fontWeight:'500'}}>Cancel</button>
                    <button onClick={handleSaveBrankas} style={{padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight:'500'}}>Save</button>
                </div>
            </div>
        </div>
      )}

      {/* --- HEADER SECTION DENGAN PERBAIKAN Z-INDEX DAN PADDING --- */}
      <div className="header-section">
        <div className="page-title-wrapper" style={{display:'flex', alignItems:'center'}}>
           {/* BUTTON FIXED & PERSEGI (ROUNDED 8px) */}
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
              <i className="fa-solid fa-bars" style={{color: '#334155', fontSize: '16px'}}></i>
          </button>

           <div className="page-title" style={{ marginLeft: windowWidth < 768 ? '50px' : '0' }}>
               <h1>Dashboard</h1>
               <p>Overview of school finance</p>
           </div>
        </div>
      </div>

      {/* --- STAT CARDS CONTAINER --- */}
      <div 
        style={gridContainerStyle} 
        onClick={() => isMobile && setIsStatsExpanded(!isStatsExpanded)} // Klik container untuk animasi
      >
          
          {/* CARD 1: BRANKAS (PALING ATAS = INDEX 0) */}
          <div style={{ ...cardBaseStyle, ...getMobileCardStyle(0) }}>
              <div>
                  <div style={{fontSize: '13px', opacity: 0.9, marginBottom: '8px', display:'flex', alignItems:'center', gap:'6px'}}>
                      <i className="fa-solid fa-vault"></i> Brankas / Deposit Box
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <div style={{fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px'}}>
                        {formatRupiah(totalBrankas)}
                    </div>
                    {/* StopPropagation agar klik tombol edit tidak menutup/membuka stack */}
                    <button onClick={(e) => { e.stopPropagation(); openModal(); }} style={{
                        background:'rgba(255,255,255,0.2)', border:'none', color:'white', 
                        width:'32px', height:'32px', borderRadius:'8px', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', transition: 'background 0.2s', zIndex: 20
                    }}>
                        <i className="fa-solid fa-pen" style={{fontSize:'12px'}}></i>
                    </button>
                  </div>
              </div>
              <div style={{fontSize: '11px', opacity: 0.8, marginTop: '12px'}}>
                  <i className="fa-solid fa-money-bill-wave" style={{marginRight:'4px'}}></i> Total physical cash available
              </div>
              <div style={iconBoxStyle}><i className="fa-solid fa-lock"></i></div>
          </div>

          {/* CARD 2: SAVINGS (INDEX 1) */}
          <div style={{ ...cardBaseStyle, ...getMobileCardStyle(1) }}>
              <div>
                  <div style={{fontSize: '13px', opacity: 0.9, marginBottom: '8px', display:'flex', alignItems:'center', gap:'6px'}}>
                      <i className="fa-solid fa-piggy-bank"></i> Total Students Savings
                  </div>
                  <div style={{fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px'}}>
                      {formatRupiah(totalSavings)}
                  </div>
              </div>
              <div style={{fontSize: '11px', opacity: 0.8, marginTop: '12px'}}>
                  <i className="fa-solid fa-check-circle" style={{marginRight:'4px'}}></i> Current balance of all students
              </div>
              <div style={iconBoxStyle}><i className="fa-solid fa-wallet"></i></div>
          </div>

          {/* CARD 3: REVENUE (INDEX 2) */}
          <div style={{ 
              ...cardBaseStyle, 
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
              boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
              ...getMobileCardStyle(2) 
          }}>
              <div>
                  <div style={{fontSize: '13px', opacity: 0.9, marginBottom: '8px', display:'flex', alignItems:'center', gap:'6px'}}>
                      <i className="fa-solid fa-chart-line"></i> Total Revenue
                  </div>
                  <div style={{fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px'}}>
                      {formatRupiah(totalRevenue)}
                  </div>
              </div>
              <div style={{fontSize: '11px', opacity: 0.8, marginTop: '12px'}}>
                  <i className="fa-solid fa-calculator" style={{marginRight:'4px'}}></i> (Brankas - Total Savings)
              </div>
              <div style={iconBoxStyle}><i className="fa-solid fa-sack-dollar"></i></div>
          </div>

      </div>
      {/* --- END STAT CARDS --- */}

      <div className="chart-section" style={{ height: 'auto', minHeight: windowWidth < 768 ? 'auto' : '400px', width: '100%', minWidth: 0, paddingBottom: '20px'    }}> 
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', flexWrap:'wrap', gap:'10px'}}>
              <h3 className="section-title" style={{margin:0}}>Daily Revenue</h3>
              <div style={{display:'flex', gap:'5px', background:'#f1f5f9', padding:'4px', borderRadius:'8px'}}>
                  {['1week', '2week', '3week', '1month'].map((filter) => (
                      <button key={filter} onClick={() => setChartFilter(filter)} style={{ border:'none', background: chartFilter === filter ? 'white' : 'transparent', color: chartFilter === filter ? 'var(--primary-blue)' : '#64748b', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: chartFilter === filter ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                          {filter === '1month' ? '1 Month' : filter.replace('week', ' Week')}
                      </button>
                  ))}
              </div>
          </div>
          
          <div style={{ height: windowWidth < 768 ? 'auto' : '320px', width: '100%', position: 'relative' }}>
              <canvas ref={chartRef}></canvas>
          </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          
          {/* 1. Recent Income */}
          <div className="list-box">
              <h3 className="section-title">Recent Income (Today)</h3>
              {loading ? <p style={{color:'#9ca3af', fontSize:'13px'}}>Loading...</p> : (
                  isWeekend() ? (
                      <div style={{textAlign:'center', padding:'20px', color:'var(--success-green)'}}>
                          <i className="fa-solid fa-mug-hot" style={{fontSize:'32px', marginBottom:'10px'}}></i>
                          <p style={{fontWeight:'bold'}}>Happy Weekend!</p>
                      </div>
                  ) : (
                      recentIncome.length === 0 ? <p style={{color:'#9ca3af', fontSize:'13px'}}>No income recorded today.</p> :
                      <>
                        {recentIncome.slice(0, visibleRecent).map((t, index) => {
                            const isOther = t.userId === 'other';
                            const userPhoto = !isOther ? userMap[t.userId]?.photo : null;
                            const displayName = isOther ? (t.note || "Other") : (userMap[t.userId]?.nickname || t.userName);
                            return (
                                <div className="list-item" key={index}>
                                    <div className="user-meta">
                                        <div className="avatar-sm" style={{ 
                                            backgroundColor: userPhoto ? 'transparent' : (isOther?'#f59e0b':'var(--primary-blue)'),
                                            backgroundImage: userPhoto ? `url(${userPhoto})` : 'none',
                                            backgroundSize: 'cover', backgroundPosition: 'center',
                                            color: userPhoto ? 'transparent' : 'white', border: '1px solid #e2e8f0'
                                        }}>
                                            {!userPhoto && (isOther ? <i className="fa-solid fa-school"></i> : getInitials(displayName))}
                                        </div>
                                        <div className="meta-text">
                                            <h4 style={{maxWidth:'140px', overflow:'hidden', textOverflow:'ellipsis'}}>{displayName}</h4>
                                            <p>{formatDateIndo(t.date)}</p>
                                        </div>
                                    </div>
                                    <div className="amount-plus">+{formatRupiah(t.amount)}</div>
                                </div>
                            );
                        })}
                        {recentIncome.length > visibleRecent && (
                            <button onClick={() => setVisibleRecent(recentIncome.length)} style={{width:'100%', padding:'8px', marginTop:'10px', background:'#f1f5f9', border:'none', borderRadius:'6px', color:'#64748b', cursor:'pointer', fontSize:'12px'}}>Show More</button>
                        )}
                      </>
                  )
              )}
          </div>

          {/* 2. No Income */}
          <div className="list-box">
              <h3 className="section-title"><i className="fa-regular fa-user"></i> No Income (Today)</h3>
               {loading ? <p style={{color:'#9ca3af', fontSize:'13px'}}>Checking...</p> : (
                  isWeekend() ? (
                      <div style={{textAlign:'center', padding:'20px', color:'var(--success-green)'}}>
                          <i className="fa-solid fa-couch" style={{fontSize:'32px', marginBottom:'10px'}}></i>
                          <p style={{fontWeight:'bold'}}>Happy Weekend!</p>
                      </div>
                  ) : (
                      todayMissingUsers.length === 0 ? <p style={{color:'#16a34a', fontSize:'13px'}}><i className='fa-solid fa-check'></i> All contributed.</p> :
                      <>
                        {todayMissingUsers.slice(0, visibleMissing).map((u) => (
                            <div className="list-item" key={u.id}>
                                <div className="user-meta">
                                    <div className="avatar-sm" style={{
                                        backgroundColor: u.photo ? 'transparent' : '#9ca3af',
                                        backgroundImage: u.photo ? `url(${u.photo})` : 'none',
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        color: u.photo ? 'transparent' : 'white', border: '1px solid #e2e8f0'
                                    }}>{!u.photo && getInitials(u.nickname || u.name)}</div>
                                    <div className="meta-text">
                                        <h4>{u.nickname || u.name}</h4>
                                        <p style={{fontSize:'11px', color:'#ef4444'}}><i className="fa-regular fa-clock"></i> {getTodayFormatted()}</p>
                                    </div>
                                </div>
                                <div className="status-pending">Waiting</div>
                            </div>
                        ))}
                        {todayMissingUsers.length > visibleMissing && (
                            <button onClick={() => setVisibleMissing(todayMissingUsers.length)} style={{width:'100%', padding:'8px', marginTop:'10px', background:'#f1f5f9', border:'none', borderRadius:'6px', color:'#64748b', cursor:'pointer', fontSize:'12px'}}>Show More</button>
                        )}
                      </>
                  )
               )}
          </div>

          {/* 3. Unpaid History */}
          <div className="list-box">
              <h3 className="section-title" style={{color:'#d97706'}}><i className="fa-solid fa-triangle-exclamation"></i> Unpaid Attendance</h3>
              {loading ? <p style={{color:'#9ca3af', fontSize:'13px'}}>Checking...</p> : (
                  historyMissingIncome.length === 0 ? <p style={{color:'#16a34a', fontSize:'13px'}}>No pending payments.</p> :
                  <>
                    {historyMissingIncome.slice(0, visibleHistory).map((item, idx) => {
                        const u = userMap[item.userId] || {}; 
                        return (
                            <div className="list-item" key={idx}>
                                <div className="user-meta">
                                    <div className="avatar-sm" style={{
                                        backgroundColor: u.photo ? 'transparent' : '#f59e0b',
                                        backgroundImage: u.photo ? `url(${u.photo})` : 'none',
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        color: u.photo ? 'transparent' : 'white', border: '1px solid #e2e8f0'
                                    }}>{!u.photo && getInitials(item.name)}</div>
                                    <div className="meta-text">
                                        <h4>{item.name}</h4>
                                        <p style={{fontSize:'11px', color:'#d97706', fontWeight:'600'}}><i className="fa-regular fa-calendar"></i> {formatDateIndo(item.date)}</p>
                                    </div>
                                </div>
                                <div style={{background:'#fef3c7', color:'#d97706', padding:'4px 8px', borderRadius:'6px', fontSize:'12px', fontWeight:'bold'}}>? No Pay</div>
                            </div>
                        );
                    })}
                    {historyMissingIncome.length > visibleHistory && (
                        <button onClick={() => setVisibleHistory(historyMissingIncome.length)} style={{width:'100%', padding:'8px', marginTop:'10px', background:'#f1f5f9', border:'none', borderRadius:'6px', color:'#64748b', cursor:'pointer', fontSize:'12px'}}>Show More</button>
                    )}
                  </>
              )}
          </div>

      </div>
    </div>
  );
};

export default Dashboard;