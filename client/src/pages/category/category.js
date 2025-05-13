import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrashAlt, FaPlus } from 'react-icons/fa';
import './category.css';

function Categories({ showOverlay }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState({ key: 'category', direction: 'asc' });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchCategories = () => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:3003/categories', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const formatted = data.map((item) => ({
          id: item.CategoryID,
          code: item.CategoryCode,
          category: item.CategoryName,
        }));
        setCategories(formatted);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch categories:', err);
        setError('Failed to load categories. Please try again later.');
        setLoading(false);
      });
  };

  const handleDelete = (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      setCategories((prevCategories) =>
        prevCategories.filter((category) => category.id !== categoryId)
      );

      fetch(`http://localhost:3003/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            alert('Category deleted successfully!');
          } else {
            alert('Failed to delete category.');
            fetchCategories();
          }
        })
        .catch((err) => {
          console.error('Delete failed:', err);
          alert('Failed to delete category.');
          fetchCategories();
        });
    }
  };

  const handleEdit = (category) => {
    showOverlay(fetchCategories, 'edit-category', category, handleCategoryUpdated);
  };

  const handleCategoryUpdated = async (updatedCategory) => {
    setCategories((prevCategories) =>
      prevCategories.map((cat) =>
        cat.id === updatedCategory.id ? updatedCategory : cat
      )
    );
  };

  const handleSort = (key) => {
    setSortBy((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortFunction = (a, b) => {
    const { key, direction } = sortBy;
    let comparison = 0;

    if (key === 'category' || key === 'code') {
      comparison = a[key].localeCompare(b[key]);
    }

    return direction === 'asc' ? comparison : -comparison;
  };

  const filteredCategories = categories
    .filter((cat) =>
      cat.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      cat.code.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
    .sort(sortFunction);

  return (
    <div className="category-page">
      <h2>Categories</h2>

      <div className="search-add-container">
        <input
          type="text"
          placeholder="Search by category or code"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-box"
        />
        <button className="add-button" onClick={() => showOverlay(fetchCategories)}>
          <FaPlus style={{ marginRight: '8px' }} />
          Add
        </button>
      </div>

      <div className="sort-buttons">
        <button onClick={() => handleSort('category')} className="b-button">
          Sort by Name: {sortBy.key === 'category' ? (sortBy.direction === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
        </button>
        <button onClick={() => handleSort('code')} className="b-button">
          Sort by Code: {sortBy.key === 'code' ? (sortBy.direction === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
        </button>
      </div>

      {loading ? (
        <p>Loading categories...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <table className="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Category</th>
              <th>Edit</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center' }}>
                  No categories found.
                </td>
              </tr>
            ) : (
              filteredCategories.map((cat, index) => (
                <tr key={cat.id}>
                  <td>{index + 1}</td>
                  <td>{cat.code}</td>
                  <td>{cat.category}</td>
                  <td>
                    <button className="category-edit-button" onClick={() => handleEdit(cat)}>
                      <FaEdit />
                    </button>
                  </td>
                  <td>
                    <button className="category-delete-button" onClick={() => handleDelete(cat.id)}>
                      <FaTrashAlt />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Categories;