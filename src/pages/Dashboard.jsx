import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // Sesuaikan path firebase.js Anda

const Dashboard = () => {
  const { toggleSidebar } = useOutletContext(); // Ambil fungsi toggle dari Layout
  const chartRef = useRef(null); // Ref untuk Canvas Chart
  const chartInstance = useRef(null); // Ref untuk Instance Chart agar bisa di-destroy

  // STATE: Pengganti innerHTML manipulasi
  const [totalProfit, setTotalProfit] = useState(0);
  const [recentIncome, setRecentIncome] = useState([]);
  const [missingUsers, setMissingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // UTILS
  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
    }).format(number);
  };

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Ambil Users
        const usersSnap = await getDocs(collection(db, "users"));
        let allUsers = [];
        usersSnap.forEach(doc => allUsers.push({ id: doc.id, name: doc.data().name }));

        // 2. Ambil Transaksi
        const transRef = collection(db, "transactions");
        const q = query(transRef, orderBy("date", "asc"));
        const transSnap = await getDocs(q);

        let tIncome = 0;
        let tExpense = 0;
        let todayTrans = [];
        let paidUserIds = new Set();
        let chartMap = {};
        const todayStr = getTodayString();

        transSnap.forEach(doc => {
          const t = doc.data();
          const amount = parseInt(t.amount) || 0;

          if(t.type === 'income') tIncome += amount;
          else if(t.type === 'expense') tExpense += amount;

          // Cek Hari Ini
          if (t.date === todayStr && t.type === 'income') {
             todayTrans.push(t);
             paidUserIds.add(t.userId);
          }

          // Data Chart (Income)
          if(t.type === 'income') {
            chartMap[t.date] = (chartMap[t.date] || 0) + amount;
          }
        });

        // Update State
        setTotalProfit(tIncome - tExpense);
        setRecentIncome(todayTrans.reverse()); // Terbaru diatas
        setMissingUsers(allUsers.filter(u => !paidUserIds.has(u.id)));
        
        // Render Chart
        renderChart(chartMap);
        setLoading(false);

      } catch (error) {
        console.error("Error fetching dashboard:", error);
      }
    };

    fetchData();
  }, []);

  // FUNGSI RENDER CHART
  const renderChart = (dataMap) => {
    if (chartInstance.current) {
        chartInstance.current.destroy(); // Hancurkan chart lama sebelum buat baru
    }

    const ctx = chartRef.current.getContext('2d');
    const labels = [];
    const dataValues = [];

    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const labelStr = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        
        labels.push(labelStr);
        dataValues.push(dataMap[dateStr] || 0);
    }

    chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Income (Rp)',
                data: dataValues,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } }
            }
        }
    });
  };

  return (
    <div style={{width: '100%'}}> 
      {/* HEADER */}
      <div className="header-section">
        <div className="page-title-wrapper" style={{display:'flex', alignItems:'center'}}>
           {/* Tombol Hamburger (Mobile) */}
           <button className="mobile-toggle-btn" onClick={toggleSidebar}>
               <i className="fa-solid fa-bars"></i>
           </button>
           <div className="page-title">
               <h1>Dashboard</h1>
               <p>Overview of school finance</p>
           </div>
        </div>
      </div>

      {/* STAT CARD */}
      <div className="stat-card">
          <div className="stat-header">
              <div>
                  <div className="stat-title"><i className="fa-solid fa-dollar-sign"></i> Total Profit</div>
                  <div className="stat-value">{formatRupiah(totalProfit)}</div>
                  <div className="stat-desc">
                      <i className="fa-solid fa-arrow-trend-up"></i> Based on all transactions
                  </div>
              </div>
              <div className="stat-icon">
                  <i className="fa-solid fa-wallet"></i>
              </div>
          </div>
      </div>

      {/* CHART */}
      <div className="chart-section">
          <h3 className="section-title">Daily Income (Last 30 Days)</h3>
          <div style={{ height: '320px' }}>
              <canvas ref={chartRef}></canvas>
          </div>
      </div>

      {/* GRID LISTS */}
      <div className="dashboard-grid">
          
          {/* Recent Income */}
          <div className="list-box">
              <h3 className="section-title">Recent Income (Today)</h3>
              {loading ? <p style={{color:'#9ca3af', fontSize:'13px'}}>Loading data...</p> : (
                  recentIncome.length === 0 ? 
                  <p style={{color:'#9ca3af', fontSize:'13px'}}>No income recorded today.</p> :
                  recentIncome.map((t, index) => (
                      <div className="list-item" key={index}>
                          <div className="user-meta">
                              <div className="avatar-sm">{t.userName ? t.userName.substring(0, 2).toUpperCase() : "US"}</div>
                              <div className="meta-text">
                                  <h4>{t.userName}</h4>
                                  <p>{t.date}</p>
                              </div>
                          </div>
                          <div className="amount-plus">+{formatRupiah(t.amount)}</div>
                      </div>
                  ))
              )}
          </div>

          {/* Users Without Income */}
          <div className="list-box">
              <h3 className="section-title"><i className="fa-regular fa-user"></i> Users Without Income (Today)</h3>
               {loading ? <p style={{color:'#9ca3af', fontSize:'13px'}}>Checking users...</p> : (
                  missingUsers.length === 0 ? 
                  <p style={{color:'#16a34a', fontSize:'13px'}}><i className='fa-solid fa-check'></i> Great! All users contributed.</p> :
                  missingUsers.map((u) => (
                      <div className="list-item" key={u.id}>
                          <div className="user-meta">
                              <div className="avatar-sm" style={{backgroundColor:'#9ca3af'}}>{u.name.substring(0, 2).toUpperCase()}</div>
                              <div className="meta-text">
                                  <h4>{u.name}</h4>
                                  <p>No record today</p>
                              </div>
                          </div>
                          <div className="status-pending">Waiting</div>
                      </div>
                  ))
               )}
          </div>
      </div>
    </div>
  );
};

export default Dashboard;