import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './register-cashier.css';

function CashierRegister() {
  const [form, setForm] = useState({
    storeName: '',
    ownerName: '',
    storeAddress: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Registering Cashier Store:', form);

    try {
      const response = await fetch('/api/register-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        console.log('Store registration successful');
      } else {
        console.log('Error registering store');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div className="cashier-reg-wrapper">
      <div className="cashier-reg-content-wrapper">
        <div className="cashier-reg-container grid">
          <div className="cashier-reg-box">
            <h1 className="cashier-reg-title">Register As Cashier</h1>
            <div className="cashier-reg-form-wrapper">
              <form className="cashier-reg-form" onSubmit={handleSubmit}>
                <div className="cashier-reg-form-fields grid">

                  <div className="cashier-reg-form-group">
                    <input
                      type="text"
                      name="ownerName"
                      value={form.ownerName}
                      onChange={handleChange}
                      required
                      placeholder=" "
                      className="cashier-reg-form-input"
                    />
                    <label className="cashier-reg-form-label">Store Name</label>
                  </div>

                  <div className="cashier-reg-form-group">
                    <input
                      type="text"
                      name="ownerName"
                      value={form.ownerName}
                      onChange={handleChange}
                      required
                      placeholder=" "
                      className="cashier-reg-form-input"
                    />
                    <label className="cashier-reg-form-label">Store Code</label>
                  </div>
                </div>

                <button type="submit" className="cashier-reg-btn">Register Cashier</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CashierRegister;