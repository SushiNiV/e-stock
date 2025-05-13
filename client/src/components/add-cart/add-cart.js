import React, { useState, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import './add-cart.css';

function AddCart({ cartItems = [], onClose, setCartItems }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [customerSelection, setCustomerSelection] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customerList, setCustomerList] = useState([]);

  useEffect(() => {
    if (paymentStatus === 'borrowed') {
      setPaymentMethod('');
    } else {
      setPaymentMethod('cash');
    }
  }, [paymentStatus]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('http://localhost:3004/customers', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(res => res.json())
      .then(data => {
        const sortedCustomers = data
          .sort((a, b) => a.CustomerName.localeCompare(b.CustomerName));
        setCustomerList(sortedCustomers);
      })
      .catch(err => console.error('Failed to fetch customers', err));
  }, []);

  const cart = cartItems;
  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleQuantityChange = (id, newQuantity) => {
    const itemToUpdate = cartItems.find(item => item.id === id);
    if (!itemToUpdate) return;
    const maxStock = itemToUpdate.stock;
    if (newQuantity <= 0) {
      const updatedCart = cartItems.filter(item => item.id !== id);
      setCartItems(updatedCart);
      return;
    }
    const validatedQuantity = Math.min(newQuantity, maxStock);
    const updatedCart = cartItems.map(item =>
      item.id === id
        ? {
            ...item,
            quantity: validatedQuantity,
            total: item.price * validatedQuantity,
          }
        : item
    );
    setCartItems(updatedCart);
  };

  const handleDeleteItem = (id) => {
    const updatedCart = cart.filter(item => item.id !== id);
    setCartItems(updatedCart);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);
  const token = localStorage.getItem('token');

  const selectedCustomer =
    customerSelection !== 'new'
      ? customerList.find(c => c.CustomerID == customerSelection)
      : null;

  const finalPaymentMethod = paymentStatus === 'borrowed' && paymentMethod === '' ? '-' : paymentMethod;

  const payload = {
    cartItems: cart,
    paymentMethod: finalPaymentMethod,
    paymentStatus,
    customer:
      paymentStatus === 'borrowed'
        ? {
            name: customerSelection === 'new' ? newCustomerName : selectedCustomer?.CustomerName,
            contact: customerSelection === 'new' ? newCustomerContact : selectedCustomer?.ContactInfo,
            id: customerSelection !== 'new' ? selectedCustomer?.CustomerID : null
          }
        : null,
    total,
  };

  try {
    const response = await fetch('http://localhost:3004/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok) {
      setCartItems([]);
      onClose();
      alert('Sale was successful!');
    } else {
      alert(data.error || 'Failed to complete transaction');
    }
  } catch (error) {
    console.error('Error submitting sale:', error);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="a-wrapper">
      <div className="a-content-wrapperr">
        <button className="a-close-btn" onClick={onClose}>×</button>
        <div className="a-container grid">
          <div className="a-box">
            <h1 className="a-title">Cart</h1>
            <div className="a-table-wrapper">
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product Name</th>
                    <th>SRP</th>
                    <th>QTY</th>
                    <th>Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length > 0 ? (
                    <>
                      {cart.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.name}</td>
                          <td>₱{item.price.toFixed(2)}</td>
                          <td>
                            <input
                              type="number"
                              value={item.quantity}
                              min="1"
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                              className="cart-qty-input"
                            />
                          </td>
                          <td>₱{(item.price * item.quantity).toFixed(2)}</td>
                          <td>
                            <button onClick={() => handleDeleteItem(item.id)} className="cart-delete-button">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>TOTAL:</td>
                        <td colSpan="2" style={{ fontWeight: 'bold' }}>₱{total.toFixed(2)}</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan="6" className="cart-empty">No items in the cart</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="a-form-wrapper">
              <form className="a-form" onSubmit={handleSubmit}>
                <div className="a-form-fields grid">
                  <div className="a-form-group1">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className={`a-input ${paymentMethod ? 'selected' : ''}`}
                      disabled={paymentStatus === 'borrowed'}
                      required
                    >
                      <option value="" disabled hidden>Choose Payment Method</option>
                      <option value="cash">Cash</option>
                      <option value="gcash">Gcash</option>
                    </select>
                    <label className="a-label">Payment Method</label>
                    <span className="a-icon"><FiChevronDown /></span>
                  </div>

                  <div className="a-form-group1">
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className={`a-input ${paymentStatus ? 'selected' : ''}`}
                      required
                    >
                      <option value="paid">Paid</option>
                      <option value="borrowed">Borrowed</option>
                    </select>
                    <label className="a-label">Payment Status</label>
                    <span className="a-icon"><FiChevronDown /></span>
                  </div>

                  {paymentStatus === 'borrowed' && (
                    <>
                      <div className="a-form-group1">
                        <select
                          value={customerSelection}
                          onChange={(e) => setCustomerSelection(e.target.value)}
                          className={`a-input ${customerSelection ? 'selected' : ''}`}
                          required
                        >
                          <option value="">-- Select Customer --</option>
                          <option value="new">New Customer</option>
                          {customerList.map((cust) => (
                            <option key={cust.CustomerID} value={cust.CustomerID}>
                              {cust.CustomerName}
                            </option>
                          ))}
                        </select>
                        <label className="a-label">Customer</label>
                        <span className="a-icon"><FiChevronDown /></span>
                      </div>

                      {customerSelection === 'new' && (
                        <>
                          <div className="a-form-group1">
                            <input
                              type="text"
                              value={newCustomerName}
                              onChange={(e) => setNewCustomerName(e.target.value)}
                              className="a-input"
                              required
                              placeholder=" "
                            />
                            <label className="a-label">New Customer Name</label>
                          </div>

                          <div className="a-form-group1">
                            <input
                              type="text"
                              value={newCustomerContact}
                              onChange={(e) => setNewCustomerContact(e.target.value)}
                              className="a-input"
                              placeholder=" "
                            />
                            <label className="a-label">Contact Info (optional)</label>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
                <button type="submit" className="a-btnn" disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Finish Transaction'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddCart;