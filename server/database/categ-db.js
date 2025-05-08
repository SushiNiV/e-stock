require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const app = express();

app.use(bodyParser.json());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to MySQL database (Category Service)');
});

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).send('Access denied');
  }
  const tokenWithoutBearer = token.split(' ')[1];
  jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send('Invalid token');
    }
    if (!decoded.storeId) {
      return res.status(400).send('Store ID is missing from token');
    }
    req.user = decoded;
    next();
  });
};

const validateStoreOwnership = (req, res, next) => {
  if (!req.user || !req.user.storeId) {
    return res.status(400).send('Store ID is missing from request.');
  }
  const storeId = req.user.storeId;
  next();
};

app.get('/categories', authenticateToken, validateStoreOwnership, (req, res) => {
  const storeId = req.user.storeId;
  if (!storeId) return res.status(400).json({ error: 'Missing storeId in decoded token' });
  db.query('SELECT * FROM Categories WHERE StoreID = ?', [storeId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/categories', authenticateToken, validateStoreOwnership, (req, res) => {
  const { name } = req.body;
  const storeId = req.user.storeId;
  if (!name || !storeId) return res.status(400).json({ error: 'Missing category name or storeId in body' });
  const trimmedName = name.trim();
  const namePart = trimmedName.length < 4 ? (trimmedName.toUpperCase() + 'X').substring(0, 4) : trimmedName.substring(0, 4).toUpperCase();
  const checkDuplicateQuery = 'SELECT * FROM Categories WHERE LOWER(CategoryName) = LOWER(?) AND StoreID = ?';
  db.query(checkDuplicateQuery, [trimmedName, storeId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error checking for duplicate category' });
    if (result.length > 0) return res.status(409).json({ error: 'Category name already exists for this store' });
    const availableNumberQuery = `
      SELECT CategoryCode
      FROM Categories
      WHERE StoreID = ?
      ORDER BY CategoryCode ASC
    `;
    db.query(availableNumberQuery, [storeId], (err, existingCategories) => {
      if (err) return res.status(500).json({ error: 'Error retrieving existing category codes' });
      const usedNumbers = existingCategories.map(category => {
        const number = parseInt(category.CategoryCode.substring(5), 10);
        return number;
      });
      let nextNumber = 1;
      while (usedNumbers.includes(nextNumber)) {
        nextNumber++;
      }
      const categoryCode = `C${namePart}${String(nextNumber).padStart(3, '0')}`;
      const insertQuery = `INSERT INTO Categories (CategoryCode, CategoryName, StoreID) VALUES (?, ?, ?)`;
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
          storeId,
        });
      });
    });
  });
});

app.delete('/categories/:categoryId', authenticateToken, validateStoreOwnership, (req, res) => {
  const { categoryId } = req.params;
  const storeId = req.user.storeId;
  if (!categoryId || !storeId) return res.status(400).json({ error: 'Missing categoryId or storeId in request' });
  const deleteQuery = 'DELETE FROM Categories WHERE CategoryID = ? AND StoreID = ?';
  db.query(deleteQuery, [categoryId, storeId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error deleting category' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found or does not belong to the store' });
    res.json({ success: true });
  });
});

app.put('/categories/:categoryId', authenticateToken, validateStoreOwnership, (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;
  const storeId = req.user.storeId;
  if (!categoryId || !name || !storeId) {
    return res.status(400).json({ error: 'Missing categoryId, name, or storeId in request' });
  }
  const trimmedName = name.trim();
  const categoryQuery = 'SELECT * FROM Categories WHERE CategoryID = ? AND StoreID = ?';
  db.query(categoryQuery, [categoryId, storeId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error checking category existence' });
    if (results.length === 0) return res.status(404).json({ error: 'Category not found or does not belong to the store' });
    const updateQuery = 'UPDATE Categories SET CategoryName = ? WHERE CategoryID = ? AND StoreID = ?';
    db.query(updateQuery, [trimmedName, categoryId, storeId], (err, result) => {
      if (err) return res.status(500).json({ error: 'Error updating category' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({
        success: true,
        id: categoryId,
        name: trimmedName,
        storeId,
      });
    });
  });
});

module.exports = app;