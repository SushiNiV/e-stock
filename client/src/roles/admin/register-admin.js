import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './register-admin.css';

function AdminRegister() {
  const [form, setForm] = useState({
    storeName: '',
    ownerName: '',
    storeAddress: '',
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('Registering Admin Store:', form);

    const token = localStorage.getItem('token');
    console.log('Token retrieved from localStorage:', token); 
    if (!token) {
      console.error('No token found. Please register first.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3002/register-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, 
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        console.log('Store registration successful');
        alert('Store registered successfully! Please login to continue.');
        navigate('/login');
      } else {
        const error = await response.json();
        console.error('Error registering store:', error);
        alert(`Error registering store: ${error.message || 'Something went wrong.'}`);
      }
    } catch (err) {
      console.error('Error:', err);
      alert('An error occurred while registering the store. Please try again.');
    }
  };

  return (
    <div className="admin-reg-wrapper">
      <div className="admin-reg-content-wrapper">
        <div className="admin-reg-container grid">
          <div className="admin-reg-box">
            <h1 className="admin-reg-title">Register Your Store</h1>
            <div className="admin-reg-form-wrapper">
              <form className="admin-reg-form" onSubmit={handleSubmit}>
                <div className="admin-reg-form-fields grid">
                  <div className="admin-reg-form-group">
                    <input
                      type="text"
                      name="storeName"
                      value={form.storeName}
                      onChange={handleChange}
                      required
                      placeholder=" "
                      className="admin-reg-form-input"
                    />
                    <label className="admin-reg-form-label">Store Name</label>
                  </div>

                  <div className="admin-reg-form-group">
                    <input
                      type="text"
                      name="ownerName"
                      value={form.ownerName}
                      onChange={handleChange}
                      required
                      placeholder=" "
                      className="admin-reg-form-input"
                    />
                    <label className="admin-reg-form-label">Owner Name</label>
                  </div>

                  <div className="admin-reg-form-group">
                    <input
                      type="text"
                      name="storeAddress"
                      value={form.storeAddress}
                      onChange={handleChange}
                      required
                      placeholder=" "
                      className="admin-reg-form-input"
                    />
                    <label className="admin-reg-form-label">Store Address</label>
                  </div>
                </div>

                <button type="submit" className="admin-reg-btn">Register Store</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminRegister;