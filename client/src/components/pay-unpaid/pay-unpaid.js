import React, { useState, useEffect } from 'react';
import './pay-unpaid.css';

function PayUnpaid({ customerId, onClose }) {
  const [borrowedItems, setBorrowedItems] = useState([]);
  const [amountPaid, setAmountPaid] = useState('');

  useEffect(() => {
    if (!customerId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`http://localhost:3004/borrowed/${customerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setBorrowedItems(data))
      .catch((err) => console.error('Failed to fetch borrowed items:', err));
  }, [customerId]);

  const applyPayment = (amount, items) => {
    const result = [];
    let remainingAmount = amount;

    for (let item of items) {
      const itemTotal = item.price * item.quantity;

      if (remainingAmount >= itemTotal) {
        result.push({ ...item, paidAmount: itemTotal, remaining: 0 });
        remainingAmount -= itemTotal;
      } else if (remainingAmount > 0) {
        result.push({ ...item, paidAmount: remainingAmount, remaining: itemTotal - remainingAmount });
        remainingAmount = 0;
      } else {
        result.push({ ...item, paidAmount: 0, remaining: itemTotal });
      }
    }

    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(amountPaid);

    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const breakdown = applyPayment(amount, borrowedItems);

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Authentication token missing');
      return;
    }

    try {
      const res = await fetch(`http://localhost:3004/settle/${customerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amountPaid: amount,
          breakdown,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Payment processed successfully!');
        onClose();
      } else {
        alert(data.error || 'Failed to process payment');
      }
    } catch (err) {
      console.error('Error processing payment:', err);
    }
  };

  const updatedBreakdown = applyPayment(parseFloat(amountPaid || 0), borrowedItems);
  const totalBorrowed = borrowedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalPaid = updatedBreakdown.reduce((sum, item) => sum + item.paidAmount, 0);
  const totalRemaining = updatedBreakdown.reduce((sum, item) => sum + item.remaining, 0);

  return (
    <div className="a-wrapper">
      <div className="a-content-wrapper">
        <button className="a-close-btn" onClick={onClose}>×</button>
        <div className="a-container grid">
          <div className="a-box">
            <h1 className="a-title">Settle Balance</h1>
            <div className="a-form-wrapper">
              <form className="a-form" onSubmit={handleSubmit}>
                <div className="a-form-fields grid">
                  <div className="aform-group">
                    <input
                      type="number"
                      name="amountPaid"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      required
                      placeholder=" "
                      className="a-form-input"
                      min="0"
                      step="0.01"
                    />
                    <label className="a-form-label">Amount Paid</label>
                  </div>
                </div>
                <button type="submit" className="a-btn">
                  Submit Payment
                </button>
              </form>
            </div>
          </div>
        <div className="pay-summary">
            <h3>SUMMARY</h3>
            <table className="summary-table">
                <tbody>
                <tr>
                    <td><strong>Total Borrowed:</strong></td>
                    <td>₱{totalBorrowed.toFixed(2)}</td>
                </tr>
                <tr>
                    <td><strong>Amount Being Paid:</strong></td>
                    <td>₱{totalPaid.toFixed(2)}</td>
                </tr>
                <tr>
                    <td><strong>Remaining After Payment:</strong></td>
                    <td>₱{totalRemaining.toFixed(2)}</td>
                </tr>
                </tbody>
            </table>
            </div>
        </div>
      </div>
    </div>
  );
}

export default PayUnpaid;