import React, { useState, useEffect, useCallback } from 'react';
import { FaEdit, FaTrashAlt, FaCircle } from 'react-icons/fa';
import './customer.css';

function Customers({ showOverlay }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState({ key: 'name', direction: 'asc' });
  const [expandedRowId, setExpandedRowId] = useState(null);
  const token = localStorage.getItem('token');

  const fetchBorrowedProducts = async (customerId) => {
    try {
      const res = await fetch(`http://localhost:3004/customers/${customerId}/borrowed-products`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const borrowedProducts = await res.json();
      return borrowedProducts.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        totalAmount: parseFloat(product.totalAmount) || 0,
      }));
    } catch {
      return [];
    }
  };

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:3004/customers', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then(async (res) => {
        const data = await res.json();
        const formatted = await Promise.all(
          data.map(async (item) => {
            const borrowedProducts = await fetchBorrowedProducts(item.CustomerID);
            return {
              id: item.CustomerID,
              code: item.CustomerCode,
              name: item.CustomerName,
              contact: item.ContactInfo,
              unpaid: Number(item.TotalUnpaid) || 0,
              borrowedProducts: borrowedProducts || [],
            };
          })
        );
        setCustomers(formatted);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load customers. Please try again later.');
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (token) fetchCustomers();
  }, [token, fetchCustomers]);

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
    if (key === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (key === 'unpaid') {
      comparison = a.unpaid - b.unpaid;
    }
    return direction === 'asc' ? comparison : -comparison;
  };

  const filteredCustomers = customers.filter((cust) =>
    cust.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    cust.code.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  const sortedCustomers = [...filteredCustomers].sort(sortFunction);

  const handleDelete = async (customer) => {
    if (customer.unpaid > 0) {
      alert(`${customer.name} still has an unpaid balance of ₱${customer.unpaid.toFixed(2)}. Cannot delete.`);
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete ${customer.name}?`);
    if (!confirmed) return;
    try {
      const res = await fetch(`http://localhost:3004/customers/${customer.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete customer.');
      } else {
        alert('Customer deleted successfully.');
        fetchCustomers();
      }
    } catch {
      alert('Error deleting customer. Please try again.');
    }
  };

  const toggleRow = (id) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="customer-page">
      <h2>Customers</h2>
      <div className="customer-search-add-container">
        <input
          type="text"
          placeholder="Search by name or code"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="customer-search-box"
        />
      </div>
      <div className="sort-buttons">
        <button onClick={() => handleSort('name')} className="b-button">
          Sort by Name: {sortBy.key === 'name' ? (sortBy.direction === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
        </button>
        <button onClick={() => handleSort('unpaid')} className="b-button">
          Sort by Unpaid: {sortBy.key === 'unpaid' ? (sortBy.direction === 'asc' ? 'Low to High' : 'High to Low') : 'Low to High'}
        </button>
      </div>
      {loading ? (
        <p>Loading customers...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <div className="customer-table-container">
          <table className="customer-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th>Customer Name</th>
                <th>Contact Info</th>
                <th>Total Unpaid</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>
                    No customers found.
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((cust, index) => (
                  <React.Fragment key={cust.id}>
                    <tr onClick={() => toggleRow(cust.id)} style={{ cursor: 'pointer' }}>
                      <td>{index + 1}</td>
                      <td>{cust.code}</td>
                      <td>{cust.name}</td>
                      <td>{cust.contact}</td>
                      <td>₱{cust.unpaid.toFixed(2)}</td>
                      <td>
                        <button
                          className="customer-edit-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showOverlay(fetchCustomers, 'edit-customer', null, null, cust);
                          }}
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="customer-delete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cust);
                          }}
                        >
                          <FaTrashAlt />
                        </button>
                        <button
                          className="pay-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showOverlay(null, 'pay-unpaid', null, null, cust);
                          }}
                        >
                          <FaCircle />
                        </button>
                      </td>
                    </tr>
                    {expandedRowId === cust.id && (
                      <tr className="customer-expanded-row">
                        <td colSpan="6">
                          <div style={{ padding: '10px 0' }}>
                            <h4 style={{ marginBottom: '8px', color: '#333' }}>BORROWED PRODUCTS</h4>
                            <table className="borrowed-products-table">
                              <thead>
                                <tr>
                                  <th>Product Name</th>
                                  <th>Quantity</th>
                                  <th>Total Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cust.borrowedProducts.length === 0 ? (
                                  <tr>
                                    <td colSpan="3" style={{ textAlign: 'center' }}>
                                      No borrowed products found.
                                    </td>
                                  </tr>
                                ) : (
                                  <>
                                    {cust.borrowedProducts.map((prod, i) => (
                                      <tr key={i}>
                                        <td>{prod.name}</td>
                                        <td>{prod.quantity}</td>
                                        <td>₱{Number(prod.totalAmount || 0).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                    <tr>
                                      <td colSpan="2" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        TOTAL:
                                      </td>
                                      <td style={{ fontWeight: 'bold' }}>
                                        ₱{cust.borrowedProducts.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  </>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Customers;