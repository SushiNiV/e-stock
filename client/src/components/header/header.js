import React from 'react';
import './header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';

function Header({ onMenuClick }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-group">
          <img src="/es-logo-trnsc.png" alt="EaseStock Logo" className="logo-image" />
          <h1 className="logo">
            <span className="e">Ease</span><span className="s">-Stock</span>
          </h1>
        </div>
      </div>

      <div className="header-right">
        <span className="user-info">Welcome, Admin</span>
        <button className="logout-btn">Logout</button>
      </div>
    </header>
  );
}

export default Header;