import React, { useState } from 'react';
import './add-category.css';

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .filter(word => word.trim() !== '')
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function AddCategory({ onClose, onAddCategory }) {
  const [form, setForm] = useState({ name: '' });
  const [isLoading, setIsLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const storeId = user?.storeId;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formattedName = toTitleCase(form.name);
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:3003/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formattedName,
          storeId: storeId,
        }),
      });

      if (res.ok) {
        const newCategory = await res.json();
        alert('Category added successfully!');
        setForm({ name: '' });
        setIsLoading(false);

        if (onClose) onClose();
        if (onAddCategory) onAddCategory(newCategory);
      } else {
        const error = await res.json();
        setIsLoading(false);
        if (error.error === 'Category name already exists') {
          alert('Duplicate category name! Please choose another one.');
        } else {
          alert(`Error: ${error.error}`);
        }
      }
    } catch (err) {
      setIsLoading(false);
      alert('Failed to add category.');
    }
  };

  return (
    <div className="a-wrapper">
      <div className="a-content-wrapper">
        <button className="a-close-btn" onClick={onClose}>×</button>
        <div className="a-container grid">
          <div className="a-box">
            <h1 className="a-title">New Category</h1>
            <div className="a-form-wrapper">
              <form className="a-form" onSubmit={handleSubmit}>
                <div className="a-form-fields grid">
                  <div className="aform-group">
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder=" "
                      className="a-form-input"
                    />
                    <label className="a-form-label">Category Name</label>
                  </div>
                </div>
                <button type="submit" className="a-btn" disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddCategory;