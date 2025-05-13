import React, { useState } from 'react';

function EditCustomer({ customer, onClose, onUpdateCustomer }) {
  const [form, setForm] = useState(() => ({
  name: customer?.name || '',
  contact: customer?.contact || ''
}));

  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem('token');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customer?.id) {
      alert('Missing customer data.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:3004/customers/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          CustomerName: form.name.trim(),
          ContactInfo: form.contact.trim()
        })
      });

      if (res.ok) {
        const updatedCustomer = await res.json();
        alert('Customer updated successfully!');
        if (onUpdateCustomer) onUpdateCustomer(updatedCustomer);
        if (onClose) onClose();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to update customer'}`);
      }
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update customer.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) return null;

  return (
    <div className="a-wrapper">
      <div className="a-content-wrapper">
        <button className="a-close-btn" onClick={onClose}>×</button>
        <div className="a-container grid">
          <div className="a-box">
            <h1 className="a-title">Edit Customer</h1>
            <form className="a-form" onSubmit={handleSubmit}>
              <div className="a-form-fields grid">
                <div className="a-form-group1">
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder=" "
                    className="a-input"
                  />
                  <label className="a-label">Customer Name</label>
                </div>
                <div className="a-form-group1">
                  <input
                    type="text"
                    name="contact"
                    value={form.contact}
                    onChange={handleChange}
                    placeholder=" "
                    className="a-input"
                  />
                  <label className="a-label">Contact Info</label>
                </div>
              </div>
              <button type="submit" className="a-btn" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditCustomer;