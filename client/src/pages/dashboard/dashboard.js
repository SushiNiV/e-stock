import React, { useEffect, useState } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement
} from 'chart.js';
import {
  FaBoxes,
  FaCube,
  FaBell,
  FaShoppingCart,
} from 'react-icons/fa';
import './dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

function Dashboard() {
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [activeTab, setActiveTab] = useState('monthly');

  const [totalSalesToday, setTotalSalesToday] = useState(0);
  const [totalSalesThisWeek, setTotalSalesThisWeek] = useState(0);
  const [totalSalesThisMonth, setTotalSalesThisMonth] = useState(0);

  const [categoryCount, setCategoryCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);

  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3005/top-products-of-the-month', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setTopProducts(
          data.map((product) => ({
            ...product,
            sales: parseFloat(product.sales),
            imageLoaded: false,
          }))
        );
      })
      .catch((err) => console.error('Failed to load top products:', err));
  }, []);

  useEffect(() => {
    fetch('http://localhost:3005/sales-totals', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        const today = parseFloat(data.totalSalesToday || 0);
        const week = parseFloat(data.totalSalesThisWeek || 0);
        const month = parseFloat(data.totalSalesThisMonth || 0);

        setTotalSalesToday(today);
        setTotalSalesThisWeek(week);
        setTotalSalesThisMonth(month);

        setCategoryCount(data.totalCategories || 0);
        setProductCount(data.totalProducts || 0);
        setAlertCount(data.totalAlerts || 0);
        setSaleCount(data.totalQuantitySoldToday || 0);

        const fullWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayMap = {};
        data.weeklyData.forEach(item => {
          const jsDayIndex = (item.dayOfWeek + 5) % 7;
          dayMap[jsDayIndex] = item.totalSalesThisWeek;
        });
        const transformedWeekly = fullWeek.map((label, i) => ({
          label,
          value: dayMap[i] || 0,
        }));

        const fullMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthMap = {};
        data.monthlyData.forEach(item => {
          monthMap[item.month - 1] = item.totalSalesThisMonth;
        });
        const transformedMonthly = fullMonths.map((label, i) => ({
          label,
          value: monthMap[i] || 0,
        }));

        setWeeklyData(transformedWeekly);
        setMonthlyData(transformedMonthly);

        const daysInMonth = new Date(new Date().getFullYear(), selectedMonth + 1, 0).getDate();
        const dailyMap = {};
        (data.dailyData || []).forEach(item => {
          dailyMap[item.day - 1] = item.totalSales;
        });
        const transformedDaily = Array.from({ length: daysInMonth }, (_, i) => ({
          label: `${i + 1}`,
          value: dailyMap[i] || 0,
        }));
        setDailyData(transformedDaily);
      })
      .catch(err => console.error('Failed to load sales data:', err));
  }, [selectedMonth]);

  const createChartData = (dataSet, title) => ({
    labels: dataSet.map(d => d.label || ''),
    datasets: [
      {
        label: title,
        data: dataSet.map(d => d.value ?? 0),
        fill: true,
        backgroundColor: 'rgba(75,192,192,0.2)',
        borderColor: 'rgba(75,192,192,1)',
        tension: 0.4,
      },
    ],
  });

  const createWeeklyBarData = (dataSet) => {
    const trackColor = 'lightgrey';
    const salesColor = 'rgba(75, 192, 192, 0.8)';
    return {
      labels: dataSet.map(d => d.label),
      datasets: [
        {
          label: 'Weekly Sales',
          data: dataSet.map(d => d.value),
          backgroundColor: dataSet.map(d => (d.value > 0 ? salesColor : trackColor)),
          borderRadius: 5,
          barThickness: 8,
          maxBarThickness: 10,
        },
      ],
    };
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      y: {
        display: false,
        beginAtZero: true,
      },
      x: {
        display: false,
      },
    },
    elements: {
      bar: {
        borderSkipped: false,
      },
    },
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        onClick: () => {},
      },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

    const createDonutChartData = () => {
    const topQuantity = topProducts.reduce((sum, p) => sum + parseInt(p.totalSold, 10), 0);
    const totalQuantity = saleCount;

    const otherQuantity = totalQuantity > topQuantity ? totalQuantity - topQuantity : 0;

    return {
      labels: [...topProducts.map(p => p.name), 'Others'],
      datasets: [
        {
          data: [...topProducts.map(p => parseInt(p.totalSold, 10)), otherQuantity],
          backgroundColor: [
            '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#CCCCCC'
          ],
          borderWidth: 1,
        }
      ],
    };
  };

  const donutOptions = {
    responsive: true,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'right',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.label}: ${context.raw} units`;
          }
        }
      }
    }
  };

  return (
    <div className="dashboard-page">
      <h2>Dashboard</h2>

      <div className="info-cards-container">
        <Link to="/categories" className="info-card border-left-blue">
          <div className="icon"><FaBoxes /></div>
          <div className="info">
            <span>Categories</span>
            <strong>{categoryCount}</strong>
          </div>
        </Link>
        <Link to="/products" className="info-card border-left-green">
          <div className="icon"><FaCube /></div>
          <div className="info">
            <span>Products</span>
            <strong>{productCount}</strong>
          </div>
        </Link>
        <Link to="/sales-logs" className="info-card border-left-red">
          <div className="icon"><FaShoppingCart /></div>
          <div className="info">
            <span>Sales Today</span>
            <strong>{saleCount}</strong>
          </div>
        </Link>
        <Link to="/alerts" className="info-card border-left-yellow">
          <div className="icon"><FaBell /></div>
          <div className="info">
            <span>Alerts</span>
            <strong>{alertCount}</strong>
          </div>
        </Link>
      </div>

      <div className="sales-summary">
        <div className="sales-summary-left">
          <div className="weekly-sales-bar">
            <div className="weekly-sales-info">
              <div className="weekly-sales-header">
                <h4>Weekly Sales</h4>
              </div>
              <div className="weekly-sales-total-container">
                <span className="weekly-sales-total">
                  ₱{totalSalesThisWeek.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`weekly-sales-percent ${totalSalesThisWeek >= 25000 ? 'positive' : 'negative'}`}>
                  {totalSalesThisWeek >= 25000 ? '+15%' : '-5%'}
                </span>
              </div>
            </div>
            <div style={{ width: '200px', height: '125px' }}>
              <Bar data={createWeeklyBarData(weeklyData)} options={{ ...barOptions, maintainAspectRatio: false }} />
            </div>
          </div>
          <div className="summary-sales-ldown">
            <div className='ldown-left'>
              <div className="sales-card">
                <h4>Today's Sales</h4>
                <p>₱{totalSalesToday.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className='ldown-right'>
              <div className="sales-card">
                <h4>This Month</h4>
                <p>₱{totalSalesThisMonth.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sales-summary-right">
          <div className="chart-card">
            <div className="tabs-row">
              <div className="tabs">
                <button
                  className={activeTab === 'monthly' ? 'active' : ''}
                  onClick={() => setActiveTab('monthly')}
                >
                  Monthly Sales
                </button>
                <button
                  className={activeTab === 'daily' ? 'active' : ''}
                  onClick={() => setActiveTab('daily')}
                >
                  Daily Sales
                </button>
              </div>

              {activeTab === 'daily' && (
                <select
                  className="month-dropdown"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
              )}
            </div>

            {activeTab === 'monthly' && (
              <Line
                data={createChartData(monthlyData, 'Monthly Sales')}
                options={chartOptions}
              />
            )}

            {activeTab === 'daily' && (
              <Line
                data={createChartData(
                  dailyData,
                  `Daily Sales for ${new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })}`
                )}
                options={chartOptions}
              />
            )}
          </div>
        </div>
      </div>

          <div className="top-products">
      <div className="top-products-container">
        <h3 className="top-products-title">Top Selling Products of the Month</h3>
        <div className="top-products-content">
          <div className="top-products-list">
            {topProducts.map((product, index) => (
              <div key={index} className="product-item">
                <img
                  src={product.image}
                  alt={product.name}
                  className="product-thumbnail"
                  onError={(e) => {
                    const updated = [...topProducts];
                    updated[index].image = '/placeholder.jpg';
                    setTopProducts(updated);
                  }}
                />
                <div className="product-name">{product.name}</div>
              </div>
            ))}
          </div>

              <div className="top-products-chart">
                <h4>Sales Distribution</h4>
                <div className="donut-chart">
                  <Pie data={createDonutChartData()} options={donutOptions} />
                </div>
              </div>
            </div>
          </div>
          </div>

    </div>
  );
}

export default Dashboard;