require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();

app.use(bodyParser.json());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to MySQL database (Category Service)');
});

app.get('/categories', (req, res) => {
  const storeId = req.query.storeId;
  if (!storeId) return res.status(400).json({ error: 'Missing storeId' });

  db.query('SELECT * FROM Categories WHERE StoreID = ?', [storeId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.delete('/categories/:categoryId', (req, res) => {
  const categoryId = req.params.categoryId;

  if (!categoryId) {
    return res.status(400).json({ error: 'Missing categoryId' });
  }

  const deleteQuery = 'DELETE FROM Categories WHERE CategoryID = ?';

  db.query(deleteQuery, [categoryId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error deleting category' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ success: true });
  });
});

app.post('/categories', (req, res) => {
  const { name, storeId } = req.body;

  if (!name || !storeId) {
    return res.status(400).json({ error: 'Missing category name or storeId' });
  }

  const trimmedName = name.trim();
  const namePart = trimmedName.substring(0, 4).toUpperCase();

  const checkDuplicateQuery = 'SELECT * FROM Categories WHERE LOWER(CategoryName) = LOWER(?) AND StoreID = ?';
  db.query(checkDuplicateQuery, [trimmedName, storeId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error checking for duplicate category' });
    }
    if (result.length > 0) {
      return res.status(409).json({ error: 'Category name already exists for this store' });
    }

    const countQuery = 'SELECT COUNT(*) AS count FROM Categories WHERE StoreID = ?';
    db.query(countQuery, [storeId], (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Error checking existing categories' });
      }

      const nextNumber = countResult[0].count + 1;
      const categoryCode = `C${namePart}00${nextNumber}`;

      const insertQuery = `
        INSERT INTO Categories (CategoryCode, CategoryName, StoreID)
        VALUES (?, ?, ?)
      `;
      db.query(insertQuery, [categoryCode, trimmedName, storeId], (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Category code already exists' });
          }
          return res.status(500).json({ error: 'Error inserting category' });
        }

        res.status(201).json({
          id: result.insertId,
          code: categoryCode,
          name: trimmedName,
          storeId
        });
      });
    });
  });
});

module.exports = app;