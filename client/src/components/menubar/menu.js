import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import './menu.css';

function Menu() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState(null);
  const navigate = useNavigate(); // Using useNavigate to redirect to login

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch('http://localhost:3001/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error('Failed to fetch user info');

        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    };

    fetchUser();

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

  const handleLogout = () => {
    // Clear the user data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');  // If you're saving the user data in localStorage as well

    // Reset the state
    setUser(null);

    // Redirect to login page
    navigate('/login');  // Redirect to the login page after logging out
  };

  return (
    <div className="menu-sidebar open">
      <div className="menu-content">
        <div className='menu-header'>
          <p><span style={{ marginRight: '25px' }}>{date}</span><span>{time}</span></p>
        </div>

        {user ? (
          <Link to="/profile" className="menu-profile">
            <img className='profile-pic' src={user.profilePic || '/es-logo.png'} alt="Profile" />
            <div className="profile-info">
              <p className="profile-name">{`${user.firstName} ${user.lastName}`}</p>
              <p className="profile-role">{user.role}</p>
            </div>
          </Link>
        ) : (
          <div>Loading profile...</div>
        )}

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
          <NavLink to="/sales-logs" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
            <span className="material-symbols-sharp">shopping_cart</span>
            Sales Logs
          </NavLink>
          <NavLink to="/stock-logs" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
            <span className="material-symbols-sharp">update</span>
            Stock Logs
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
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
        <button onClick={handleLogout} className="menu-link">
          <span className="material-symbols-sharp">logout</span>
          Log-out
        </button>
      </div>
    </div>
  );
}

export default Menu;