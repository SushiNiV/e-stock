import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './menu.css';

function Menu({ isOpen }) {
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
    <div className={`menu-sidebar ${isOpen ? 'open' : ''}`}>
      <div className='menu-header'>
        <p><span style={{ marginRight: '25px' }}>{date}</span>
        <span>{time}</span>
        </p>
    </div>
    
    <Link to="/profile" className="menu-profile">
        <img
            className="profile-pic"
            src="/es-logo.png"
            alt="Profile"
        />
        <div className="profile-info">
            <p className="profile-name">John Doe</p>
            <p className="profile-role">Admin</p>
        </div>
    </Link>

    <nav>
        <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/inventory" className={({ isActive }) => isActive ? "active" : ""}>Inventory</NavLink>
        <NavLink to="/sales" className={({ isActive }) => isActive ? "active" : ""}>Sales</NavLink>
    </nav>
    </div>
  );
}

export default Menu;