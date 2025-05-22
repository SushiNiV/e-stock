import React, { useState, useEffect } from 'react';
import { FaCartPlus, FaShoppingCart, FaBoxOpen } from 'react-icons/fa';
import './sales.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const SortButtons = ({ sortBy, handleSort }) => (
  <div className="sort-buttonss">
    <button onClick={() => handleSort('name')} className="b-button">
      Sort by Name: {sortBy.key === 'name' ? (sortBy.direction === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
    </button>
    <button onClick={() => handleSort('category')} className="b-button">
      Sort by Category: {sortBy.key === 'category' ? (sortBy.direction === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
    </button>
    <button onClick={() => handleSort('stock')} className="b-button">
      Sort by Stock: {sortBy.key === 'stock' ? (sortBy.direction === 'asc' ? 'Low to High' : 'High to Low') : 'Low to High'}
    </button>
    <button onClick={() => handleSort('price')} className="b-button">
      Sort by Price: {sortBy.key === 'price' ? (sortBy.direction === 'asc' ? 'Ascending' : 'Descending') : 'Ascending'}
    </button>
  </div>
);

function Sales({ showOverlay, cartItems, setCartItems, shouldRefreshProducts, setShouldRefreshProducts }) {
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [sortBy, setSortBy] = useState({ key: 'name', direction: 'asc' });
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('http://localhost:3003/categories', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        const sorted = data.sort((a, b) => a.CategoryName.localeCompare(b.CategoryName));
        setCategories(sorted);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('http://localhost:3004/products', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await res.json();
        const formatted = data.map((item) => {
          const category = categories.find((cat) => cat.CategoryID === item.CategoryID);
          return {
            id: item.ProductID,
            code: item.ProductCode,
            name: item.ProductName,
            categoryId: item.CategoryID,
            categoryName: category ? category.CategoryName : '',
            salePrice: Number(item.SalePrice) || 0,
            stock: item.QuantityInStock ?? 0,
          };
        });
        setProducts(formatted);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    if (categories.length) fetchProducts();
  }, [categories]);

  const handleSort = (key) => {
    setSortBy((prevState) =>
      prevState.key === key
        ? { ...prevState, direction: prevState.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const handleQuantityChange = (id, value) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: value === '' ? '' : Math.min(value, products.find(p => p.id === id)?.stock || 1),
    }));
  };

  const handleQuantityBlur = (id) => {
    const val = quantities[id];
    if (val === '' || val <= 0) {
      setQuantities((prev) => ({ ...prev, [id]: 1 }));
    }
  };

  const handleAddToCart = (product, quantity) => {
    if (quantity > product.stock) {
      alert(`Only ${product.stock} units of "${product.name}" are available in stock.`);
      return;
    }

    const existingItemIndex = cartItems.findIndex((item) => item.id === product.id);
    if (existingItemIndex >= 0) {
      const updatedCart = [...cartItems];
      const newQuantity = updatedCart[existingItemIndex].quantity + quantity;

      if (newQuantity > product.stock) {
        alert(`Adding ${quantity} will exceed stock. You already have ${updatedCart[existingItemIndex].quantity} in the cart.`);
        return;
      }

      updatedCart[existingItemIndex].quantity = newQuantity;
      setCartItems(updatedCart);
    } else {
      setCartItems([...cartItems, { ...product, price: product.salePrice, quantity }]);
    }
  };

  const handleViewCart = () => {
    if (typeof showOverlay === 'function') {
      showOverlay(null, 'add-cart', null, null, null, null, {
        onRefresh: () => setShouldRefreshProducts(true)
      });
    }
  };

  const searchValue = (debouncedSearchTerm || '').toLowerCase();

  const filteredProducts = products
    .filter((prod) => {
      const matchesSearch =
        (prod.name || '').toLowerCase().includes(searchValue) ||
        (prod.code || '').toLowerCase().includes(searchValue) ||
        (prod.categoryName || '').toLowerCase().includes(searchValue);
      const matchesCategory = selectedCategory === 'all' || String(prod.categoryId) === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const { key, direction } = sortBy;
      let comparison = 0;
      if (key === 'name') comparison = (a.name || '').localeCompare(b.name || '');
      else if (key === 'price') comparison = a.salePrice - b.salePrice;
      else if (key === 'stock') comparison = a.stock - b.stock;
      else if (key === 'category') comparison = (a.categoryName || '').localeCompare(b.categoryName || '');
      return direction === 'asc' ? comparison : -comparison;
    });

  const scrollCategories = (direction) => {
    const container = document.querySelector('.category-bar');
    const scrollAmount = 90;
    if (container) {
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:3004/products', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      const formatted = data.map((item) => {
        const category = categories.find((cat) => cat.CategoryID === item.CategoryID);
        return {
          id: item.ProductID,
          code: item.ProductCode,
          name: item.ProductName,
          categoryId: item.CategoryID,
          categoryName: category ? category.CategoryName : '',
          salePrice: Number(item.SalePrice) || 0,
          stock: item.QuantityInStock ?? 0,
        };
      });
      setProducts(formatted);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  if (categories.length && shouldRefreshProducts) {
    fetchProducts().then(() => setShouldRefreshProducts(false));
  }
}, [categories, shouldRefreshProducts, setShouldRefreshProducts]);

  return (
    <div className="b-page">
      <h2 className="b-title">Sales</h2>
      <div className="b-search-add-container">
        <input
          type="text"
          placeholder="Search by category, product name, or code"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="b-input"
        />
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
              className={`category-button ${selectedCategory === String(category.CategoryID) ? 'active' : ''}`}
              onClick={() => setSelectedCategory(String(category.CategoryID))}
            >
              {category.CategoryName}
            </button>
          ))}
        </div>
        <div className="scroll-arrow right" onClick={() => scrollCategories('right')}>
          <i className="fas fa-chevron-right"></i>
        </div>
      </div>

      <div className="sort-and-cart-container">
        <SortButtons sortBy={sortBy} handleSort={handleSort} />
          <div className="cart">
          <button onClick={() =>
            showOverlay(null, 'return', null, null, null, null, {
              onRefresh: () => setShouldRefreshProducts(true)
            })
          } className="return-btn">
            <FaBoxOpen style={{ marginRight: '6px' }} />
            Return
          </button>
          <button onClick={handleViewCart} className="cart-btn">
            <FaShoppingCart style={{ marginRight: '6px' }} />
            Cart ({cartItems.length})
          </button>
        </div>
      </div>

      <table className="b-table sales">
        <thead>
          <tr>
            <th>#</th>
            <th>Code</th>
            <th>Product</th>
            <th>SRP</th>
            <th>Stock</th>
            <th>Quantity</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center' }}>No Product Found</td>
            </tr>
          ) : (
            filteredProducts.map((product, index) => (
              <tr key={product.id}>
                <td>{index + 1}</td>
                <td>{product.code}</td>
                <td>{product.name}</td>
                <td>₱{product.salePrice.toFixed(2)}</td>
                <td>{product.stock}</td>
                <td>
                  <input
                    type="number"
                    value={
                      quantities[product.id] === undefined
                        ? 1
                        : quantities[product.id] === ''
                        ? ''
                        : quantities[product.id]
                    }
                    min="1"
                    max={product.stock}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleQuantityChange(product.id, value === '' ? '' : parseInt(value));
                    }}
                    onBlur={() => handleQuantityBlur(product.id)}
                    className="cart-qty-input"
                  />
                </td>
                <td>
                  <button
                    onClick={() => handleAddToCart(product, quantities[product.id] || 1)}
                    className="b-button"
                  >
                    <FaCartPlus />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Sales;