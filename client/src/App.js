import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom'; // Add Routes and Route
import Header from './components/header/header';
import Menu from './components/menubar/menu';
import './App.css';

// Your components for different routes
//import Dashboard from './components/Dashboard'; 
//import Inventory from './components/Inventory'; 
//import Sales from './components/Sales'; 

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className={`layout ${isMenuOpen ? 'menu-open' : ''}`}>
        <Menu isOpen={isMenuOpen} />
        <div className="main-area">
          <Header onMenuClick={() => setIsMenuOpen(!isMenuOpen)} />
          <Routes> {/* Routes component wraps the different Route components */}
            {/*<Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/sales" element={<Sales />} /> */}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;