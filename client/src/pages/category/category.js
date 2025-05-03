import React, { useEffect, useState } from 'react';
import { FaEdit, FaTrashAlt, FaPlus } from 'react-icons/fa';
import './category.css';

function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fakeCategories = [
      { id: 1, code: 'C001', category: 'Electronics' },
      { id: 2, code: 'C002', category: 'Clothing' },
      { id: 3, code: 'C003', category: 'Home Goods' },
      { id: 4, code: 'C004', category: 'Beauty' },
      { id: 5, code: 'C005', category: 'Sports' },
      { id: 6, code: 'C006', category: 'Toys' },
      { id: 7, code: 'C007', category: 'Books' },
      { id: 8, code: 'C008', category: 'Food & Drink' },
      { id: 9, code: 'C009', category: 'Automotive' },
      { id: 10, code: 'C010', category: 'Health & Wellness' }
    ];

    setTimeout(() => {
      setCategories(fakeCategories);
      setLoading(false);
    }, 1000);
  }, []);

  const handleEdit = (id) => {
    alert(`Edit category with ID: ${id}`);
  };

  const handleDelete = (id) => {
    setCategories(categories.filter(category => category.id !== id));
  };

  const handleAdd = () => {
    alert('Add new category');
  };

  const filteredCategories = categories.filter(cat =>
    cat.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="category-page">
      <h2>Categories</h2>

      <div className="search-add-container">
        <input
          type="text"
          placeholder="Search by category or code"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-box"
        />
        <button className="add-button" onClick={handleAdd}>
          <FaPlus style={{ marginRight: '8px' }} />
          Add
        </button>
      </div>

      {loading ? (
        <p>Loading categories...</p>
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
            {filteredCategories.map((cat, index) => (
              <tr key={cat.id}>
                <td>{index + 1}</td>
                <td>{cat.code}</td>
                <td>{cat.category}</td>
                <td>
                  <button className="category-edit-button" onClick={() => handleEdit(cat.id)}>
                    <FaEdit />
                  </button>
                </td>
                <td>
                  <button className="category-delete-button" onClick={() => handleDelete(cat.id)}>
                    <FaTrashAlt />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Categories;