import React, { useEffect, useState } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import './product.css';

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editProduct, setEditProduct] = useState(null); // For editing product

  useEffect(() => {
    // Generate 20 example products
    const fakeProducts = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      code: `P${(i + 1).toString().padStart(3, '0')}`,
      name: `Product ${String.fromCharCode(65 + (i % 26))}`,
      category: ['Electronics', 'Books', 'Clothing', 'Home'][i % 4],
      unitPrice: 10 + i * 2,
      salePrice: 12 + i * 2,
      stock: 30 + i * 5,
    }));

    setTimeout(() => {
      setProducts(fakeProducts);
      setLoading(false);
    }, 500);
  }, []);

  const filteredProducts = products.filter(prod =>
    prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prod.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prod.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle delete action
  const handleDelete = (id) => {
    const updatedProducts = products.filter(prod => prod.id !== id);
    setProducts(updatedProducts);
  };

  // Handle edit action
  const handleEdit = (prod) => {
    setEditProduct(prod); // Show product details for editing (you can later create an edit form)
    alert(`Edit Product: ${prod.name}`);
  };

  return (
    <div className="products-page">
      <h2>Products</h2>

      <div className="search-add-container">
        <input
          type="text"
          placeholder="Search by name, code, or category"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-box"
        />
        <button className="add-button">
          <FaPlus style={{ marginRight: '8px' }} />
          Add
        </button>
      </div>

      {loading ? (
        <p>Loading products...</p>
      ) : (
        <div className="table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Unit Price</th>
                <th>Sale Price</th>
                <th>Stock</th>
                <th>Actions</th> {/* New column for Edit and Delete */}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((prod, index) => (
                <tr key={prod.id}>
                  <td>{index + 1}</td>
                  <td>{prod.code}</td>
                  <td>{prod.name}</td>
                  <td>{prod.category}</td>
                  <td>${prod.unitPrice.toFixed(2)}</td>
                  <td>${prod.salePrice.toFixed(2)}</td>
                  <td>{prod.stock}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(prod)}
                      className="edit-button"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(prod.id)}
                      className="delete-button"
                    >
                      <FaTrash /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Products;