import React, { useState, useEffect } from 'react';
import './add-product.css';
import { FiChevronDown } from 'react-icons/fi';

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .filter(word => word.trim() !== '')
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function AddProduct({ onClose, onAddProduct }) {
  const [form, setForm] = useState({
    name: '',
    reorderLevel: '',
    unitPrice: '',
    salePrice: '',
    quantityInStock: ''
  });
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const storeId = user?.storeId;

  const formatPeso = (value) => {
    const numeric = value.replace(/[^\d.]/g, '');
    return numeric ? `₱${numeric}` : '';
  };

  const parsePeso = (value) => {
    return value.replace(/[^\d.]/g, '');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'unitPrice' || name === 'salePrice') {
      setForm({ ...form, [name]: formatPeso(value) });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleCategoryChange = (e) => {
    const selected = e.target.value;
    setCategory(selected);
    const selectedObj = categories.find(c => c.name === selected);
    if (selectedObj) {
      setCategoryId(selectedObj.id);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('http://localhost:3003/categories', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const sortedCategories = data
        .map(cat => ({
          id: cat.CategoryID,
          name: cat.CategoryName
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setCategories(sortedCategories);
      
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchCategories();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeId) {
      alert('Store ID not found. Please login again.');
      return;
    }

    const payload = {
      ProductCode: `P${Math.floor(Math.random() * 10000)}`,
      ProductName: toTitleCase(form.name),
      CategoryID: categoryId,
      UnitPrice: parseFloat(parsePeso(form.unitPrice)),
      SalePrice: parseFloat(parsePeso(form.salePrice)),
      QuantityInStock: parseInt(form.quantityInStock),
      ReorderLevel: parseInt(form.reorderLevel),
      StoreID: storeId
    };

    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:3004/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newProduct = await res.json();
        alert('Product added successfully!');
        setForm({ name: '', reorderLevel: '', unitPrice: '', salePrice: '', quantityInStock: '' });
        setCategory('');
        setCategoryId(null);
        if (onClose) onClose();
        if (onAddProduct) onAddProduct(newProduct);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to add product'}`);
      }
    } catch (err) {
      console.error('Add product failed:', err);
      alert('Failed to add product.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="a-wrapper">
      <div className="a-content-wrapper">
        <button className="a-close-btn" onClick={onClose}>×</button>
        <div className="a-container grid">
          <div className="a-box">
            <h1 className="a-title">New Product</h1>
            <div className="a-form-wrapper">
              <form className="a-form" onSubmit={handleSubmit}>
                <div className="a-form-fields grid">
                  <div className="a-form-group1">
                    <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder=" " className="a-input" />
                    <label className="a-label">Product Name</label>
                  </div>
                  <div className="a-form-group1">
                    <select required className={`a-input ${category ? 'selected' : ''}`} value={category} onChange={handleCategoryChange}>
                      <option value="" disabled hidden>Select Category</option>
                      {categories.length > 0 ? (
                        categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))
                      ) : (
                        <option disabled>No categories available</option>
                      )}
                    </select>
                    <label className="a-label">Category</label>
                    <span className="a-icon"><FiChevronDown /></span>
                  </div>
                  <div className="a-form-group grid">
                    <div className="a-form-groupp">
                      <input type="text" name="unitPrice" value={form.unitPrice} onChange={handleChange} required placeholder=" " className="a-input" />
                      <label className="a-label">Unit Price</label>
                    </div>
                    <div className="a-form-groupp">
                      <input type="text" name="salePrice" value={form.salePrice} onChange={handleChange} required placeholder=" " className="a-input" />
                      <label className="a-label">Sale Price</label>
                    </div>
                  </div>
                  <div className="a-form-group grid">
                    <div className="a-form-groupp">
                      <input type="number" name="quantityInStock" value={form.quantityInStock} onChange={handleChange} required placeholder=" " className="a-input" />
                      <label className="a-label">Quantity in Stock</label>
                    </div>
                    <div className="a-form-groupp">
                      <input type="number" name="reorderLevel" value={form.reorderLevel} onChange={handleChange} required placeholder=" " className="a-input" />
                      <label className="a-label">Reorder Level</label>
                    </div>
                  </div>
                </div>
                <button type="submit" className="a-btn" disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Product'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddProduct;