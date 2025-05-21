require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const { expressjwt: expressJwt } = require('express-jwt');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  } else {
    console.log('Connected to MySQL database (reg-role.js)');
  }
});

const authenticateJWT = expressJwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  credentialsRequired: true,
  requestProperty: 'user',
});

app.post('/register-owner', authenticateJWT, (req, res) => {
  console.log('Authorization Header:', req.headers.authorization);
  console.log('Decoded JWT:', req.user);

  if (!req.user) {
    return res.status(403).json({ error: 'Token decoding failed. Token may be expired or invalid.' });
  }

  const { storeName, ownerName, storeAddress } = req.body;

  if (!storeName || !ownerName || !storeAddress) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const userCode = req.user.UserCode;
  const storeCode = `S${Math.floor(10000 + Math.random() * 90000)}`;

  const insertStoreQuery = `
    INSERT INTO store (StoreCode, StoreName, OwnerName, StoreAddress, UserCode)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(insertStoreQuery, [storeCode, storeName, ownerName, storeAddress, userCode], (err, result) => {
    if (err) {
      console.error('Database error (insert store):', err);
      return res.status(500).json({ error: 'Failed to create store.' });
    }

    const storeID = result.insertId;

    const updateUserQuery = `
      UPDATE users 
      SET StoreID = ?, IsRegister = 1 
      WHERE UserCode = ?
    `;

    db.query(updateUserQuery, [storeID, userCode], (err2) => {
      if (err2) {
        console.error('Database error (update user):', err2);
        return res.status(500).json({ error: 'Store created but user update failed.' });
      }

      res.status(201).json({ message: 'Store created and linked to user successfully.', storeCode });
    });
  });
});

app.post('/register-admin', authenticateJWT, (req, res) => {
  console.log('Authorization Header:', req.headers.authorization);
  console.log('Decoded JWT:', req.user);

  if (!req.user) {
    return res.status(403).json({ error: 'Token decoding failed. Token may be expired or invalid.' });
  }

  const { storeCode } = req.body;

  if (!storeCode) {
    return res.status(400).json({ error: 'Missing storeCode.' });
  }

  const userCode = req.user.UserCode;

  const checkStoreQuery = `SELECT * FROM store WHERE StoreCode = ?`;

  db.query(checkStoreQuery, [storeCode], (err, result) => {
    if (err) {
      console.error('Database error (check store):', err);
      return res.status(500).json({ error: 'Error checking store.' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Store not found.' });
    }

    const updateUserQuery = `
      UPDATE users 
      SET StoreID = ?, IsRegister = TRUE, Role = 'Admin' 
      WHERE UserCode = ?
    `;

    db.query(updateUserQuery, [result[0].StoreID, userCode], (err2) => {
      if (err2) {
        console.error('Database error (update user):', err2);
        return res.status(500).json({ error: 'Admin registration failed.' });
      }

      res.status(201).json({ message: 'Admin linked to store successfully.' });
    });
  });
});

app.use((err, _req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    console.error('JWT middleware error:', err);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
  next(err);
});

module.exports = app;