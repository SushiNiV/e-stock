import React, { useState } from 'react';

function UpdateStocks({ onClose, onSubmit }) {
  const [form, setForm] = useState({ quantityToAdd: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const value = e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = Number(form.quantityToAdd);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Please enter a valid number greater than 0.');
      return;
    }
    setIsLoading(true);
    await onSubmit(parsed);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="a-wrapper">
      <div className="a-content-wrapper">
        <button className="a-close-btn" onClick={onClose}>×</button>
        <div className="a-container grid">
          <div className="a-box">
            <h1 className="a-title">Update Stocks</h1>
            <div className="a-form-wrapper">
              <form className="a-form" onSubmit={handleSubmit}>
                <div className="a-form-group1">
                  <input
                    type="number"
                    name="quantityToAdd"
                    value={form.quantityToAdd}
                    onChange={handleChange}
                    required
                    placeholder=" "
                    className="a-input"
                  />
                  <label className="a-label">Quantity of New Stock/s</label>
                </div>
                <button type="submit" className="a-btn" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateStocks;