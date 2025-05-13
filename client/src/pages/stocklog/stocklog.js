import React, { useState, useEffect } from 'react';
import { FaEdit } from 'react-icons/fa';
import './stocklog.css';

function StockLog() {
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
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch('http://localhost:3004/stock-logs', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        setLogs(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchLogs();
  }, []);

  const refetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('http://localhost:3004/stock-logs', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.productName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      log.productCode.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

    const matchesDate = searchDate
      ? log.date.startsWith(searchDate)
      : true;

    return matchesSearch && matchesDate;
  });

  const toggleRow = (id) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="b-page">
      <h2 className="b-title">Stock Log</h2>
      <div className="b-search-add-container">
        <input
          type="text"
          placeholder="Search by product name, or code"
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
            <th>Type</th>
            <th>Qty</th>
            <th>Before</th>
            <th>After</th>
            <th>Date</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.length === 0 ? (
            <tr>
              <td colSpan="11" style={{ textAlign: 'center' }}>
                No stock logs found.
              </td>
            </tr>
          ) : (
            filteredLogs.map((log, index) => (
              <React.Fragment key={log.id}>
                <tr onClick={() => toggleRow(log.id)} className="b-row b-row-clickable">
                  <td>{index + 1}</td>
                  <td>{log.code}</td>
                  <td>{log.productName}</td>
                  <td>{log.changeType}</td>
                  <td>{log.quantityChanged}</td>
                  <td>{log.stockBefore}</td>
                  <td>{log.stockAfter}</td>
                  <td>{new Date(log.date).toLocaleDateString()}</td>
                  <td>{log.user}</td>
                </tr>
                {expandedRowId === log.id && (
                  <tr className="b-expanded-row">
                    <td colSpan="11">
                      <div className="b-details-box">
                        <p><b>Time and Date:</b> {new Date(log.date).toLocaleString()}</p>
                        <p><b>Note:</b> {log.note}</p>
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

export default StockLog;