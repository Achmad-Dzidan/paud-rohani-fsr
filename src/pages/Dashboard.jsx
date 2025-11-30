import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

const Dashboard = () => {
  const { toggleSidebar } = useOutletContext();
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // STATE DATA
  const [totalSavings, setTotalSavings] = useState(0);
  const [recentIncome, setRecentIncome] = useState([]);
  const [todayMissingUsers, setTodayMissingUsers] = useState([]);
  const [historyMissingIncome, setHistoryMissingIncome] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [userMap, setUserMap] = useState({}); 

  // STATE CHART FILTER
  const [chartFilter, setChartFilter] = useState('1week'); // '1week', '2week', '3week', '1month'
  
  // STATE PAGINATION (Default 3)
  const [visibleRecent, setVisibleRecent] = useState(3);
  const [visibleMissing, setVisibleMissing] = useState(3);
  const [visibleHistory, setVisibleHistory] = useState(3);

  // DATA MAPS FOR CHART
  const [incomeMapData, setIncomeMapData] = useState({});
  const [otherMapData, setOtherMapData] = useState({});
  const [feeMapData, setFeeMapData] = useState({});

  // WEEKEND CHECK
  const isWeekend = () => {
      const day = new Date().getDay();
      return day === 0 || day === 6; // 0=Sunday, 6=Saturday
  };

  // UTILS
  const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  const getTodayString = () => { const d = new Date(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; };
  const getTodayFormatted = () => new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatDateIndo = (dateStr) => { if(!dateStr) return "-"; const d = new Date(dateStr); return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "US";

  // FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. USERS
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

        // 2. TRANSACTIONS
        const transRef = collection(db, "transactions");
        const qTrans = query(transRef, orderBy("date", "asc"));
        const transSnap = await getDocs(qTrans);

        let currentTotalSavings = 0;
        let todayTrans = [];
        let paidUserIdsToday = new Set();
        
        let iMap = {}; // Savings Income
        let oMap = {};  // Other Income
        
        const todayStr = getTodayString();

        transSnap.forEach(doc => {
          const t = doc.data();
          const amount = parseInt(t.amount) || 0;
          const isOther = t.userId === 'other';

          // Total Savings (Hanya Siswa)
          if (!isOther) {
              if(t.type === 'income') currentTotalSavings += amount;
              else if(t.type === 'expense') currentTotalSavings -= amount;
          }

          // Recent Income (Today) - Termasuk Other
          if (t.date === todayStr && t.type === 'income') {
             todayTrans.push(t);
             if(!isOther) paidUserIdsToday.add(t.userId);
          }

          // Data Chart (Harian) - Memperhitungkan Expense (Negative)
          if(!t.isCheckpoint) {
            const val = t.type === 'income' ? amount : -amount;
            
            if (isOther) {
                oMap[t.date] = (oMap[t.date] || 0) + val;
            } else {
                iMap[t.date] = (iMap[t.date] || 0) + val;
            }
          }
        });

        // 3. ABSENSI (HISTORY MISSING & FEE)
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
                if (status === '?') {
                    missingHistoryList.push({ userId, date, name: uMap[userId]?.nickname || uMap[userId]?.name || "Unknown" });
                }
                if (status === 'H') hCount++;
            });

            fMap[date] = hCount * 6000;
        });

        setTotalSavings(currentTotalSavings);
        setRecentIncome(todayTrans.reverse());
        setTodayMissingUsers(allUsers.filter(u => !paidUserIdsToday.has(u.id)));
        setHistoryMissingIncome(missingHistoryList); 
        
        // Simpan Data Maps untuk Chart
        setIncomeMapData(iMap);
        setOtherMapData(oMap);
        setFeeMapData(fMap);
        
        setLoading(false);

      } catch (error) { console.error(error); }
    };
    fetchData();
  }, []);

  // UPDATE CHART SAAT FILTER BERUBAH
  useEffect(() => {
      if(!loading) {
          renderChart();
      }
  }, [loading, chartFilter, incomeMapData, otherMapData, feeMapData]);

  // RENDER CHART
  const renderChart = () => {
    if (chartInstance.current) chartInstance.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    
    const labels = [];
    const dataSavings = [];
    const dataFee = [];
    const dataOther = [];
    const dataTotal = [];

    // Tentukan jumlah hari kerja yang akan diambil berdasarkan filter
    let daysToFetch = 0;
    if (chartFilter === '1week') daysToFetch = 5;
    else if (chartFilter === '2week') daysToFetch = 10;
    else if (chartFilter === '3week') daysToFetch = 15;
    else if (chartFilter === '1month') daysToFetch = 20; // Asumsi 4 minggu kerja

    let currentDate = new Date();
    let count = 0;

    // Loop mundur melewati Sabtu & Minggu
    while (count < daysToFetch) {
        const dayNum = currentDate.getDay(); // 0=Minggu, 6=Sabtu
        
        if (dayNum !== 0 && dayNum !== 6) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Masukkan ke awal array agar urutan dari kiri (lama) ke kanan (baru)
            labels.unshift(currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }));
            
            const valSav = incomeMapData[dateStr] || 0;
            const valFee = feeMapData[dateStr] || 0;
            const valOth = otherMapData[dateStr] || 0;
            
            dataSavings.unshift(valSav);
            dataFee.unshift(valFee);
            dataOther.unshift(valOth);
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
                {
                    label: 'Savings',
                    data: dataSavings,
                    borderColor: '#3b82f6', // Biru
                    backgroundColor: '#3b82f6',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    order: 3
                },
                {
                    label: 'School Fee',
                    data: dataFee,
                    borderColor: '#f59e0b', // Oranye
                    backgroundColor: '#f59e0b',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    order: 4
                },
                {
                    label: 'Other',
                    data: dataOther,
                    borderColor: '#8b5cf6', // Ungu
                    backgroundColor: '#8b5cf6',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    order: 2
                },
                {
                    label: 'Total Revenue',
                    data: dataTotal,
                    borderColor: '#10b981', // Hijau
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', // Area fill
                    borderWidth: 2,
                    borderDash: [5, 5], 
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    order: 1 // Paling belakang
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: true, position: 'top', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': Rp ' + ctx.parsed.y.toLocaleString('id-ID') } }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f1f5f9' }, 
                    ticks: { 
                        font: { size: 10 },
                        callback: function(value) { return (value / 1000) + 'k'; } 
                    } 
                },
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } }
            }
        }
    });
  };

  return (
    <div style={{width: '100%'}}> 
      <div className="header-section">
        <div className="page-title-wrapper" style={{display:'flex', alignItems:'center'}}>
           <button className="mobile-toggle-btn" onClick={toggleSidebar}><i className="fa-solid fa-bars"></i></button>
           <div className="page-title"><h1>Dashboard</h1><p>Overview of school finance</p></div>
        </div>
      </div>

      <div className="stat-card">
          <div className="stat-header">
              <div>
                  <div className="stat-title"><i className="fa-solid fa-piggy-bank"></i> Total Students Savings</div>
                  <div className="stat-value">{formatRupiah(totalSavings)}</div>
                  <div className="stat-desc"><i className="fa-solid fa-check-circle"></i> Current balance of all students</div>
              </div>
              <div className="stat-icon"><i className="fa-solid fa-wallet"></i></div>
          </div>
      </div>

      <div className="chart-section" style={{ width: '100%', minWidth: 0 }}> {/* Fix Smartphone Overflow */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', flexWrap:'wrap', gap:'10px'}}>
              <h3 className="section-title" style={{margin:0}}>Daily Revenue</h3>
              
              {/* FILTER BUTTONS */}
              <div style={{display:'flex', gap:'5px', background:'#f1f5f9', padding:'4px', borderRadius:'8px'}}>
                  {['1week', '2week', '3week', '1month'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setChartFilter(filter)}
                        style={{
                            border:'none',
                            background: chartFilter === filter ? 'white' : 'transparent',
                            color: chartFilter === filter ? 'var(--primary-blue)' : '#64748b',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: chartFilter === filter ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                      >
                          {filter === '1month' ? '1 Month' : filter.replace('week', ' Week')}
                      </button>
                  ))}
              </div>
          </div>
          <div style={{ height: '320px', width: '100%', position: 'relative' }}> {/* Fix Smartphone Overflow */}
              <canvas ref={chartRef}></canvas>
          </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          
          {/* 1. Recent Income */}
          <div className="list-box">
              <h3 className="section-title">Recent Income (Today)</h3>
              {loading ? <p style={{color:'#9ca3af', fontSize:'13px'}}>Loading...</p> : (
                  // LOGIC WEEKEND CHECK
                  isWeekend() ? (
                      <div style={{textAlign:'center', padding:'20px', color:'var(--success-green)'}}>
                          <i className="fa-solid fa-mug-hot" style={{fontSize:'32px', marginBottom:'10px'}}></i>
                          <p style={{fontWeight:'bold'}}>Happy Weekend!</p>
                          <p style={{fontSize:'12px', color:'#64748b'}}>Enjoy your holiday.</p>
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
                                            <h4 style={{maxWidth:'140px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{displayName}</h4>
                                            <p>{formatDateIndo(t.date)}</p>
                                        </div>
                                    </div>
                                    <div className="amount-plus">+{formatRupiah(t.amount)}</div>
                                </div>
                            );
                        })}
                        {recentIncome.length > visibleRecent && (
                            <button onClick={() => setVisibleRecent(recentIncome.length)} style={{width:'100%', padding:'8px', marginTop:'10px', background:'#f1f5f9', border:'none', borderRadius:'6px', color:'#64748b', cursor:'pointer', fontSize:'12px'}}>Show More ({recentIncome.length - visibleRecent})</button>
                        )}
                      </>
                  )
              )}
          </div>

          {/* 2. Users Without Income */}
          <div className="list-box">
              <h3 className="section-title"><i className="fa-regular fa-user"></i> No Income (Today)</h3>
               {loading ? <p style={{color:'#9ca3af', fontSize:'13px'}}>Checking...</p> : (
                  // LOGIC WEEKEND CHECK
                  isWeekend() ? (
                      <div style={{textAlign:'center', padding:'20px', color:'var(--success-green)'}}>
                          <i className="fa-solid fa-couch" style={{fontSize:'32px', marginBottom:'10px'}}></i>
                          <p style={{fontWeight:'bold'}}>Happy Weekend!</p>
                          <p style={{fontSize:'12px', color:'#64748b'}}>See you on Monday.</p>
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
                                        <p style={{fontSize:'11px', color:'#ef4444'}}><i className="fa-regular fa-clock" style={{marginRight:'4px'}}></i>{getTodayFormatted()}</p>
                                    </div>
                                </div>
                                <div className="status-pending">Waiting</div>
                            </div>
                        ))}
                        {todayMissingUsers.length > visibleMissing && (
                            <button onClick={() => setVisibleMissing(todayMissingUsers.length)} style={{width:'100%', padding:'8px', marginTop:'10px', background:'#f1f5f9', border:'none', borderRadius:'6px', color:'#64748b', cursor:'pointer', fontSize:'12px'}}>Show More ({todayMissingUsers.length - visibleMissing})</button>
                        )}
                      </>
                  )
               )}
          </div>

          {/* 3. Missing Income History */}
          <div className="list-box">
              <h3 className="section-title" style={{color:'#d97706'}}><i className="fa-solid fa-triangle-exclamation" style={{marginRight:'8px'}}></i> Unpaid Attendance</h3>
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
                                        <p style={{fontSize:'11px', color:'#d97706', fontWeight:'600'}}><i className="fa-regular fa-calendar" style={{marginRight:'4px'}}></i>{formatDateIndo(item.date)}</p>
                                    </div>
                                </div>
                                <div style={{background:'#fef3c7', color:'#d97706', padding:'4px 8px', borderRadius:'6px', fontSize:'12px', fontWeight:'bold'}}>? No Pay</div>
                            </div>
                        );
                    })}
                    {historyMissingIncome.length > visibleHistory && (
                        <button onClick={() => setVisibleHistory(historyMissingIncome.length)} style={{width:'100%', padding:'8px', marginTop:'10px', background:'#f1f5f9', border:'none', borderRadius:'6px', color:'#64748b', cursor:'pointer', fontSize:'12px'}}>Show More ({historyMissingIncome.length - visibleHistory})</button>
                    )}
                  </>
              )}
          </div>

      </div>
    </div>
  );
};

export default Dashboard;