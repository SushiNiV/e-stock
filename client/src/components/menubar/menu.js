import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './menu.css';

function Menu() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const date = currentTime.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });

  const time = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="menu-sidebar open">
  <div className="menu-content">
    <div className='menu-header'>
      <p><span style={{ marginRight: '25px' }}>{date}</span><span>{time}</span></p>
    </div>

    <Link to="/profile" className="menu-profile">
      <img className="profile-pic" src="/es-logo.png" alt="Profile" />
      <div className="profile-info">
        <p className="profile-name">John Doe</p>
        <p className="profile-role">Admin</p>
      </div>
    </Link>

    <nav className='menu-nav'>
        <NavLink to="/dashboard" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">grid_view</span>
          Dashboard
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">warehouse</span>
          Inventory
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">category</span>
          Categories
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">inventory_2</span>
          Products
        </NavLink>
        <NavLink to="/sales" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">shopping_cart</span>
          Sales Logs
        </NavLink>
        <NavLink to="/stocks" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">update</span>
          Stock Logs
        </NavLink>
        <NavLink to="/customer" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">person_outline</span>
          Customer
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
        <span className="material-symbols-sharp">settings</span>
          Settings
        </NavLink>
      </nav>
  </div>

  <div className='logout-nav'>
    <NavLink to="/login" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
      <span className="material-symbols-sharp">logout</span>
      Log-out
    </NavLink>
  </div>
</div>
  );
}

export default Menu;