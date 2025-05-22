import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import './App.css';

import { UserProvider } from './context/user-context';

import Login from './pages/login/login';
import Register from './pages/register/register';
import AdminRegister from './roles/admin/register-admin';
import OwnerRegister from './roles/owner/register-owner';

import Dashboard from './pages/dashboard/dashboard';
import Alerts from './pages/alert/alert'
import Profile from './pages/profile/profile';
import Sales from './pages/sales/sales';
import Categories from './pages/category/category';
import Products from './pages/product/product';
import SalesLog from './pages/saleslog/saleslog';
import StockLog from './pages/stocklog/stocklog';
import Customer from './pages/customer/customer';

import Menu from './components/menubar/menu';
import AddCategory from './components/add-categ/add-category';
import AddProduct from './components/add-prod/add-product';
import EditCategory from './components/edit-categ/edit-category';
import EditProduct from './components/edit-prod/edit-product';
import EditCustomer from './components/edit-cust/edit-customer';
import AddCart from './components/add-cart/add-cart';
import UpdateStocks from './components/upd-prod/update-product';
import PayUnpaid from './components/pay-unpaid/pay-unpaid';
import ProductInfo from './components/prod/prod';
import Return from './components/return/return';
import EditProfile from './components/edit-prof/edit-profile';

function Layout({ children, setCartItems, menuUpdated, alertCount }) {
  return (
    <div className="layout menu-open">
      <aside className="sidebar">
        <Menu key={`menu-${alertCount}`} isOpen={true} setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount} />
      </aside>
      <div className="main-area">
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

function AppRoutes({ showOverlay, setProductToRestock, cartItems, setCartItems, shouldRefreshProducts, setShouldRefreshProducts, alertCount,
  userProfile, menuUpdated }){
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
      <Route path="/register-owner" element={<OwnerRegister />} />
      {!isAuthRoute && (
        <>
          <Route path="/dashboard" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><Dashboard /></Layout> : <Navigate to="/login" />} />
          <Route path="/profile" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount} ><Profile showOverlay={showOverlay} userProfile={userProfile}/></Layout> : <Navigate to="/login" />} />
          <Route path="/alerts" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><Alerts /></Layout> : <Navigate to="/login" />} />
          <Route path="/sales" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><Sales showOverlay={showOverlay} cartItems={cartItems} setCartItems={setCartItems} shouldRefreshProducts={shouldRefreshProducts} setShouldRefreshProducts={setShouldRefreshProducts} /></Layout> : <Navigate to="/login" />} />
          <Route path="/categories" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><Categories showOverlay={showOverlay} /></Layout> : <Navigate to="/login" />} />
          <Route path="/products" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><Products showOverlay={showOverlay} setProductToRestock={setProductToRestock} /></Layout> : <Navigate to="/login" />} />
          <Route path="/sales-logs" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><SalesLog /></Layout> : <Navigate to="/login" />} />
          <Route path="/stock-logs" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><StockLog /></Layout> : <Navigate to="/login" />} />
          <Route path="/customers" element={isAuthenticated() ? <Layout setCartItems={setCartItems} menuUpdated={menuUpdated} alertCount={alertCount}><Customer showOverlay={showOverlay} /></Layout> : <Navigate to="/login" />} />
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
  const [shouldRefreshProducts, setShouldRefreshProducts] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [onCustomerUpdated, setOnCustomerUpdated] = useState(null);
  const [selectedCustomerToPay, setSelectedCustomerToPay] = useState(null);
  const [menuUpdated, setMenuUpdated] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [activeOverlay, setActiveOverlay] = useState(null); 

  const [overlayProps, setOverlayProps] = useState({});

  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem('cartItems');
    return saved ? JSON.parse(saved) : [];
  });

  const [alertCount, setAlertCount] = useState(0);

  const fetchAlerts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:3004/alerts', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      setAlertCount(data.length);
      setMenuUpdated(prev => !prev);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  useEffect(() => {
  const socket = io('http://localhost:3004');

  socket.on('low-inventory-alert', (alerts) => {
    setAlertCount(alerts.length);
  });

  socket.on('menu-update', () => {
    setMenuUpdated(prev => !prev);
  });

  return () => {
    socket.disconnect();
  };
}, []);

  const [onPaymentComplete, setOnPaymentComplete] = useState(null);

  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  }, [cartItems]);

  const showOverlay = (onAddedCallback, type = 'category', category = null, product = null, customer = null, sale = null, extraProps = {}) => {
  setActiveOverlay(type);
  setOverlayProps(extraProps);

      setOnCategoryAdded(null);
      setOnProductAdded(null);
      setOnCategoryUpdated(null);
      setOnProductUpdated(null);
      setSelectedCategory(null);
      setSelectedProduct(null);
      setProductToRestock(null);
      setSelectedCustomer(null);
      setSelectedCustomerToPay(null);
      setViewingProduct(null);
      setOnCustomerUpdated(null);
      setOnPaymentComplete(null);
    
    if (type === 'category') setOnCategoryAdded(() => onAddedCallback);
    else if (type === 'product') setOnProductAdded(() => onAddedCallback);
    else if (type === 'edit-category' && category) {
      setOnCategoryUpdated(() => onAddedCallback);
      setSelectedCategory(category);
    } else if (type === 'edit-product' && product) {
      setOnProductUpdated(() => onAddedCallback);
      setSelectedProduct(product);
      setMenuUpdated(prev => !prev);
    } else if (type === 'update-stock' && product) {
      setOnProductUpdated(() => onAddedCallback);
      setProductToRestock(product);
      setMenuUpdated(prev => !prev);
    } else if (type === 'edit-customer' && customer) {
      setOnCustomerUpdated(() => onAddedCallback);
      setSelectedCustomer(customer);
    } else if (type === 'pay-unpaid' && customer) {
      setSelectedCustomerToPay(customer);
      setOnPaymentComplete(() => onAddedCallback);
    } else if (type === 'view-product' && product) {
      setViewingProduct(product);
    }

    setIsOverlayVisible(true);
  };

  const hideOverlay = () => {
    setIsOverlayVisible(false);
    setActiveOverlay(null);
    setMenuUpdated(prev => !prev);
    fetchAlerts();
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

  const handleCustomerUpdated = (updatedCustomer) => {
    if (onCustomerUpdated) onCustomerUpdated(updatedCustomer);
    setOnCustomerUpdated(null);
    setSelectedCustomer(null);
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
        <AppRoutes
          showOverlay={showOverlay}
          setProductToRestock={setProductToRestock}
          cartItems={cartItems}
          setCartItems={setCartItems}
          shouldRefreshProducts={shouldRefreshProducts}
          setShouldRefreshProducts={setShouldRefreshProducts}
          alertCount={alertCount}
          menuUpdated={menuUpdated}
        />
        {isOverlayVisible && (
          <div className="overlay">
            {activeOverlay === 'add-cart' ? (
              <AddCart
                onClose={() => {
                    if (overlayProps?.onRefresh) overlayProps.onRefresh();
                    hideOverlay();
                  }}
                cartItems={cartItems}
                setCartItems={setCartItems}
              />
            ) : activeOverlay === 'category' ? (
              <AddCategory
                onClose={hideOverlay}
                onAddCategory={handleCategoryAdded}
              />
            ) : activeOverlay === 'product' ? (
              <AddProduct
                onClose={hideOverlay}
                onAddProduct={handleProductAdded}
              />
            ) : activeOverlay === 'update-stock' && productToRestock ? (
              <UpdateStocks
                initialStock={productToRestock.QuantityInStock}
                onClose={hideOverlay}
                onSubmit={handleProductUpdated}
              />
            ) : activeOverlay === 'edit-category' && selectedCategory ? (
              <EditCategory
                category={selectedCategory}
                onClose={hideOverlay}
                onUpdateCategory={handleCategoryUpdated}
              />
            ) : activeOverlay === 'edit-product' && selectedProduct ? (
              <EditProduct
                product={selectedProduct}
                onClose={hideOverlay}
                onUpdateProduct={handleProductUpdated}
              />
            ) : activeOverlay === 'pay-unpaid' && selectedCustomerToPay ? (
              <PayUnpaid
                customer={selectedCustomerToPay}
                onClose={(customerId, updatedUnpaid) => {
                  if (onPaymentComplete) onPaymentComplete(customerId, updatedUnpaid);
                  setSelectedCustomerToPay(null);
                  setOnPaymentComplete(null);
                  setIsOverlayVisible(false);
                }}
              />
            ) : activeOverlay === 'edit-customer' && selectedCustomer ? (
              <EditCustomer
                customer={selectedCustomer}
                onClose={hideOverlay}
                onUpdateCustomer={handleCustomerUpdated}
              />
            ) : activeOverlay === 'view-product' && viewingProduct ? (
              <ProductInfo
                product={viewingProduct}
                onClose={hideOverlay}
              />
            ) : activeOverlay === 'return' ? (
              <Return
                onClose={() => {
                  if (overlayProps?.onRefresh) overlayProps.onRefresh();
                  hideOverlay();
                }}
                onReturn={() => {
                  if (onCategoryAdded) onCategoryAdded(); 
                  hideOverlay();
                }}
              />
             ) : activeOverlay === 'edit-profile' ? (
              <EditProfile
                {...overlayProps}
                onClose={hideOverlay}

              />
            ) : null}
          </div>
        )}
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;