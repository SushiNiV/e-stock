import React, { useState, useEffect } from 'react';
import { FaEdit } from 'react-icons/fa';

function SalesLog() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('https://your-api-endpoint.com/sales-logs');
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        setLogs(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.productName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      log.logCode.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

    const matchesDate = searchDate
      ? log.saleDate.startsWith(searchDate)
      : true;

    return matchesSearch && matchesDate;
  });

  const toggleRow = (id) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="b-page">
      <h2 className="b-title">Sales Log</h2>
      <div className="b-search-add-container">
        <input
          type="text"
          placeholder="Search by product name or code"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="b-input"
        />
        <input
          type="date"
          value={searchDate}
          onChange={(e) => setSearchDate(e.target.value)}
          className="b-input"
          style={{ maxWidth: '250px' }}
        />
      </div>
      <table className="b-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Code</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Total</th>
            <th>Status</th>
            <th>Method</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.length === 0 ? (
            <tr>
              <td colSpan="10" style={{ textAlign: 'center' }}>
                No sales logs found.
              </td>
            </tr>
          ) : (
            filteredLogs.map((log, index) => (
              <React.Fragment key={log.logID}>
                <tr onClick={() => toggleRow(log.logID)} className="b-row b-row-clickable">
                  <td>{index + 1}</td>
                  <td>{log.logCode}</td>
                  <td>{log.productName}</td>
                  <td>{log.quantitySold}</td>
                  <td>₱{log.totalAmount.toFixed(2)}</td>
                  <td>{log.paymentStatus}</td>
                  <td>{log.paymentMethod}</td>
                  <td>{new Date(log.saleDate).toLocaleDateString()}</td>
                  <td>{log.customerName || 'Walk-in'}</td>
                  <td>
                    <button className="b-button">
                      <FaEdit />
                    </button>
                  </td>
                </tr>
                {expandedRowId === log.logID && (
                  <tr className="b-expanded-row">
                    <td colSpan="10">
                      <div className="b-details-box">
                        <p><b>Time:</b> {new Date(log.saleDate).toLocaleString()}</p>
                        <p><b>Note:</b> {log.note || 'No note'}</p>
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
  );
}

export default SalesLog;