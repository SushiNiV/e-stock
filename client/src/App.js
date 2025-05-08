import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import './App.css';

import { UserProvider } from './context/user-context';

import Login from './pages/login/login';
import Register from './pages/register/register';
import AdminRegister from './roles/admin/register-admin';
import CashierRegister from './roles/cashier/register-cashier';

import Dashboard from './pages/dashboard/dashboard';
import Profile from './pages/profile/profile';
import Inventory from './pages/inventory/inventory';
import Categories from './pages/category/category';
import Products from './pages/product/product';
import SalesLog from './pages/saleslog/saleslog';
import StockLog from './pages/stocklog/stocklog';
import Customer from './pages/customer/customer';
import Settings from './pages/settings/settings';

import Menu from './components/menubar/menu';
import AddCategory from './components/add-categ/add-category';
import AddProduct from './components/add-prod/add-product';
import EditCategory from './components/edit-categ/edit-category';
import EditProduct from './components/edit-prod/edit-product';
import UpdateStocks from './components/upd-prod/update-product';

function Layout({ children }) {
  return (
    <div className="layout menu-open">
      <aside className="sidebar">
        <Menu isOpen={true} />
      </aside>
      <div className="main-area">
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

function AppRoutes({ showOverlay, setProductToRestock }) {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  const isAuthenticated = () => {
    const token = localStorage.getItem('token');
    return !!token;
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register-admin" element={<AdminRegister />} />
      <Route path="/register-cashier" element={<CashierRegister />} />

      {!isAuthRoute && (
        <>
          <Route path="/dashboard" element={isAuthenticated() ? <Layout><Dashboard /></Layout> : <Navigate to="/login" />} />
          <Route path="/profile" element={isAuthenticated() ? <Layout><Profile /></Layout> : <Navigate to="/login" />} />
          <Route path="/sales" element={isAuthenticated() ? <Layout><Inventory /></Layout> : <Navigate to="/login" />} />
          <Route path="/categories" element={isAuthenticated() ? <Layout><Categories showOverlay={showOverlay} /></Layout> : <Navigate to="/login" />} />
          <Route path="/products" element={isAuthenticated() ? <Layout><Products showOverlay={showOverlay} setProductToRestock={setProductToRestock} /></Layout> : <Navigate to="/login" />} />
          <Route path="/sales-logs" element={isAuthenticated() ? <Layout><SalesLog /></Layout> : <Navigate to="/login" />} />
          <Route path="/stock-logs" element={isAuthenticated() ? <Layout><StockLog /></Layout> : <Navigate to="/login" />} />
          <Route path="/customers" element={isAuthenticated() ? <Layout><Customer /></Layout> : <Navigate to="/login" />} />
          <Route path="/settings" element={isAuthenticated() ? <Layout><Settings /></Layout> : <Navigate to="/login" />} />
        </>
      )}
    </Routes>
  );
}

function App() {
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [onCategoryAdded, setOnCategoryAdded] = useState(null);
  const [onProductAdded, setOnProductAdded] = useState(null);
  const [onCategoryUpdated, setOnCategoryUpdated] = useState(null);
  const [onProductUpdated, setOnProductUpdated] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productToRestock, setProductToRestock] = useState(null);

  const showOverlay = (onAddedCallback, type = 'category', category = null, product = null) => {
    if (type === 'category') {
      setOnCategoryAdded(() => onAddedCallback);
      setOnProductAdded(null);
      setOnCategoryUpdated(null);
      setOnProductUpdated(null);
      setSelectedCategory(null);
      setSelectedProduct(null);
      setProductToRestock(null);
    } else if (type === 'product') {
      setOnProductAdded(() => onAddedCallback);
      setOnCategoryAdded(null);
      setOnCategoryUpdated(null);
      setOnProductUpdated(null);
      setSelectedCategory(null);
      setSelectedProduct(null);
      setProductToRestock(null);
    } else if (type === 'edit-category' && category) {
      setOnCategoryUpdated(() => onAddedCallback);
      setSelectedCategory(category);
      setOnCategoryAdded(null);
      setOnProductAdded(null);
      setOnProductUpdated(null);
      setSelectedProduct(null);
      setProductToRestock(null);
    } else if (type === 'edit-product' && product) {
      setOnProductUpdated(() => onAddedCallback);
      setSelectedProduct(product);
      setOnProductAdded(null);
      setOnCategoryAdded(null);
      setOnCategoryUpdated(null);
      setProductToRestock(null);
    } else if (type === 'update-stock' && product) {
      setOnProductUpdated(() => onAddedCallback);
      setProductToRestock(product);
      setSelectedProduct(null);
      setSelectedCategory(null);
      setOnCategoryAdded(null);
      setOnProductAdded(null);
      setOnCategoryUpdated(null);
    }

    setIsOverlayVisible(true);
  };

  const hideOverlay = () => {
    setIsOverlayVisible(false);
  };

  const handleCategoryAdded = () => {
    if (onCategoryAdded) onCategoryAdded();
    setOnCategoryAdded(null);
    setIsOverlayVisible(false);
  };

  const handleProductAdded = () => {
    if (onProductAdded) onProductAdded();
    setOnProductAdded(null);
    setIsOverlayVisible(false);
  };

  const handleCategoryUpdated = () => {
    if (onCategoryUpdated) onCategoryUpdated();
    setOnCategoryUpdated(null);
    setIsOverlayVisible(false);
  };

  const handleProductUpdated = (updatedProduct) => {
    if (onProductUpdated) onProductUpdated(updatedProduct);
    setOnProductUpdated(null);
    setIsOverlayVisible(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') hideOverlay();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <UserProvider>
      <BrowserRouter>
        <AppRoutes showOverlay={showOverlay} setProductToRestock={setProductToRestock} />
        {isOverlayVisible && (
          <div className="overlay">
            {productToRestock ? (
              <UpdateStocks
              initialStock={productToRestock.QuantityInStock}
              onClose={() => {
                setProductToRestock(null);
                setIsOverlayVisible(false);
              }}
              onSubmit={(newStock) => {
                handleProductUpdated(newStock); // JUST pass the number
              }}
            />
            ) : selectedCategory ? (
              <EditCategory
                category={selectedCategory}
                onClose={hideOverlay}
                onUpdateCategory={handleCategoryUpdated}
              />
            ) : selectedProduct ? (
              <EditProduct
                product={selectedProduct}
                onClose={hideOverlay}
                onUpdateProduct={handleProductUpdated}
              />
            ) : onCategoryAdded ? (
              <AddCategory onClose={hideOverlay} onAddCategory={handleCategoryAdded} />
            ) : (
              <AddProduct onClose={hideOverlay} onAddProduct={handleProductAdded} />
            )}
          </div>
        )}
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;