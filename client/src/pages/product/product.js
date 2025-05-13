import React, { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCircle } from 'react-icons/fa';
import './product.css';

function Products({ showOverlay }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState({ key: 'name', direction: 'asc' });

  const token = localStorage.getItem('token');

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3003/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const sortedCategories = data.sort((a, b) => a.CategoryName.localeCompare(b.CategoryName));
      setCategories(sortedCategories);
    } catch {
      setCategories([]);
    }
  }, [token]);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:3004/products', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        const formatted = data.map((item) => {
          const category = categories.find((cat) => cat.CategoryID === item.CategoryID);
          return {
            id: item.ProductID,
            code: item.ProductCode,
            name: item.ProductName,
            category: category ? category.CategoryName : 'N/A',
            unitPrice: item.UnitPrice ?? 0,
            salePrice: item.SalePrice ?? 0,
            stock: item.QuantityInStock ?? 0,
            reorderLevel: item.ReorderLevel ?? 0,
          };
        });
        setProducts(formatted);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load products. Please try again later.');
        setLoading(false);
      });
  }, [token, categories]);

  useEffect(() => {
    if (token) fetchCategories();
  }, [token, fetchCategories]);

  useEffect(() => {
    if (categories.length) fetchProducts();
  }, [categories, fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSort = (key) => {
    setSortBy((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortFunction = (a, b) => {
    const { key, direction } = sortBy;
    let comparison = 0;

    if (key === 'name' || key === 'category') {
      comparison = a[key].localeCompare(b[key]);
    } else {
      comparison = a[key] - b[key];
    }

    return direction === 'asc' ? comparison : -comparison;
  };

  const handleDelete = (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      fetch(`http://localhost:3004/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) fetchProducts();
        });
    }
  };

  const handleEditProduct = (productId) => {
    const prod = products.find((p) => p.id === productId);
    const productToEdit = {
      ProductID: prod.id,
      ProductCode: prod.code,
      ProductName: prod.name,
      CategoryName: prod.category,
      UnitPrice: prod.unitPrice,
      SalePrice: prod.salePrice,
      QuantityInStock: prod.stock,
      ReorderLevel: prod.reorderLevel,
      CategoryID: categories.find(cat => cat.CategoryName === prod.category)?.CategoryID || null
    };

    const handleUpdated = (updatedProduct) => {
      handleProductUpdated(updatedProduct);
      fetchProducts();
    };

    showOverlay(handleUpdated, 'edit-product', null, productToEdit);
  };

  const handleProductUpdated = (updatedProduct) => {
    if (!updatedProduct || !updatedProduct.ProductID) return;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === updatedProduct.ProductID
          ? {
              ...p,
              name: updatedProduct.ProductName,
              unitPrice: updatedProduct.UnitPrice,
              salePrice: updatedProduct.SalePrice,
              stock: updatedProduct.QuantityInStock,
              reorderLevel: updatedProduct.ReorderLevel,
              category: updatedProduct.CategoryName
            }
          : p
      )
    );
  };

  const handleRestock = (productId) => {
    const product = products.find(p => p.id === productId);

    const handleStockUpdated = async (newStockToAdd) => {
      try {
        const res = await fetch(`http://localhost:3004/products/${productId}/restock`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ quantityToAdd: Number(newStockToAdd) }),
        });

        const result = await res.json();
        if (result.success || res.ok) {
          alert('Restocked successfully');
          fetchProducts();
        } else {
          alert(result.error || 'Failed to restock.');
        }
      } catch {
        alert('An error occurred while restocking.');
      }
    };

    showOverlay(handleStockUpdated, 'update-stock', null, product);
  };

  const filteredProducts = products.filter(
    (prod) =>
      (selectedCategory === 'all' || prod.category === selectedCategory) && 
      (prod?.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      prod?.code?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      prod?.category?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
  );

  const sortedProducts = [...filteredProducts].sort(sortFunction);

  const scrollCategories = (direction) => {
    const container = document.querySelector('.category-bar');
    const scrollAmount = 120;
    if (container) {
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="products-page">
      <h2>Products</h2>
      <div className="search-add-container">
        <input
          type="text"
          placeholder="Search by name, code, or category"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-box"
        />
        <button className="add-button" onClick={() => showOverlay(fetchProducts, 'product')}>
          <FaPlus style={{ marginRight: '8px' }} />
          Add
        </button>
      </div>

      <div className="category-bar-wrapper">
        <div className="scroll-arrow left" onClick={() => scrollCategories('left')}>
          <i className="fas fa-chevron-left"></i>
        </div>
        <div className="category-bar">
          <button
            className={`category-button ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            ALL
          </button>
          {categories.map((category) => (
            <button
              key={category.CategoryID}
              className={`category-button ${selectedCategory === category.CategoryName ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.CategoryName)}
            >
              {category.CategoryName}
            </button>
          ))}
        </div>
        <div className="scroll-arrow right" onClick={() => scrollCategories('right')}>
          <i className="fas fa-chevron-right"></i>
        </div>
      </div>

      <div className="sort-buttons">
        <button onClick={() => handleSort('name')} className="b-button">
          Sort by Name: {sortBy.key === 'name' ? (sortBy.direction === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
        </button>
        <button onClick={() => handleSort('category')} className="b-button">
          Sort by Category: {sortBy.key === 'category' ? (sortBy.direction === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
        </button>
        <button onClick={() => handleSort('salePrice')} className="b-button">
          Sort by Price: {sortBy.key === 'salePrice' ? (sortBy.direction === 'asc' ? 'Ascending' : 'Descending') : 'Ascending'}
        </button>
        <button onClick={() => handleSort('stock')} className="b-button">
          Sort by Stock: {sortBy.key === 'stock' ? (sortBy.direction === 'asc' ? 'Low to High' : 'High to Low') : 'Low to High'}
        </button>
      </div>

      {loading ? (
        <p>Loading products...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center' }}>No products found.</td>
                </tr>
              ) : (
                sortedProducts.map((prod, index) => (
                  <tr key={prod.id}>
                    <td>{index + 1}</td>
                    <td>{prod.code}</td>
                    <td>{prod.name}</td>
                    <td>{prod.category}</td>
                    <td>₱{!isNaN(prod.unitPrice) ? Number(prod.unitPrice).toFixed(2) : '0.00'}</td>
                    <td>₱{!isNaN(prod.salePrice) ? Number(prod.salePrice).toFixed(2) : '0.00'}</td>
                    <td>{prod.stock}</td>
                    <td>
                      <button onClick={() => handleEditProduct(prod.id)} className="edit-button">
                        <FaEdit />
                      </button>
                      <button onClick={() => handleDelete(prod.id)} className="delete-button">
                        <FaTrash />
                      </button>
                      <button onClick={() => handleRestock(prod.id)} className="restock-button">
                        <FaCircle />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Products;