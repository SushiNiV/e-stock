import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import './App.css';

import Login from './pages/login/login';
import Register from './pages/register/register';
import Dashboard from './pages/dashboard/dashboard';
import Products from './pages/product/product'
import Categories from './pages/category/category';

import Header from './components/header/header';
import Menu from './components/menubar/menu';


function Layout({ children }) {
  return (
    <div className="layout menu-open">
      <aside className="sidebar">
        <Menu isOpen={true} /> 
      </aside>
      <div className="main-area">
        {/*<Header /> */}
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {!isAuthRoute && (
        <>
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/products" element={<Layout><Products /></Layout>} />
          <Route path="/categories" element={<Layout><Categories /></Layout>} />
        </>
      )}
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;