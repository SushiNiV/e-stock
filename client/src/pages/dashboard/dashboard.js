import React, { useEffect, useState } from 'react';
import './dashboard.css'; // Optional: create this CSS file for styling

function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    totalCustomers: 0,
    lowStock: 0,
  });

  useEffect(() => {
    // Replace with real API/data fetching logic
    // This is just mock data
    setStats({
      totalSales: 1250.75,
      totalProducts: 230,
      totalCustomers: 57,
      lowStock: 8,
    });
  }, []);

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">Dashboard Overview</h2>
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <span className="material-symbols-sharp">shopping_cart</span>
          <div>
            <p>Total Sales</p>
            <h3>${stats.totalSales.toFixed(2)}</h3>
          </div>
        </div>
        <div className="dashboard-card">
          <span className="material-symbols-sharp">inventory_2</span>
          <div>
            <p>Products</p>
            <h3>{stats.totalProducts}</h3>
          </div>
        </div>
        <div className="dashboard-card">
          <span className="material-symbols-sharp">person_outline</span>
          <div>
            <p>Customers</p>
            <h3>{stats.totalCustomers}</h3>
          </div>
        </div>
        <div className="dashboard-card">
          <span className="material-symbols-sharp">warning</span>
          <div>
            <p>Low Stock</p>
            <h3>{stats.lowStock}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;