require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(express.json()); 

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
  console.log('Connected to MySQL database (Product Service)');
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

const validateStoreOwnership = (req, res, next) => {
  if (!req.user || !req.user.storeId) {
    return res.status(400).send('Store ID is missing from request.');
  }

  const storeId = req.user.storeId;
  next();
};

const generateProductCode = (categoryName, nextNumber) => {
  const prefix = categoryName.substring(0, 2).toUpperCase();
  return `P${prefix}${String(nextNumber).padStart(3, '0')}`;
};

app.get('/products', authenticateToken, (req, res) => {
  const storeId = req.user.storeId;

  db.query('SELECT * FROM Products WHERE StoreID = ?', [storeId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/products', authenticateToken, (req, res) => {
  const { ProductName, CategoryID, UnitPrice, SalePrice, QuantityInStock, ReorderLevel } = req.body;
  const StoreID = req.user.storeId;

  if (
    !ProductName || CategoryID == null || UnitPrice == null ||
    SalePrice == null || QuantityInStock == null || ReorderLevel == null
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.query(
    'SELECT * FROM Products WHERE ProductName = ? AND CategoryID = ? AND StoreID = ?',
    [ProductName, CategoryID, StoreID],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.length > 0) {
        return res.status(400).json({ error: 'Product with the same name already exists in this category for the store' });
      }

      db.query('SELECT CategoryName FROM Categories WHERE CategoryID = ?', [CategoryID], (err, categoryResult) => {
        if (err) return res.status(500).json({ error: err.message });
        if (categoryResult.length === 0) return res.status(400).json({ error: 'Invalid CategoryID' });

        const categoryName = categoryResult[0].CategoryName;

        const getCodesQuery = `
          SELECT ProductCode FROM Products 
          WHERE CategoryID = ? AND StoreID = ? AND ProductCode LIKE ?
        `;
        db.query(getCodesQuery, [CategoryID, StoreID, `P${categoryName.substring(0, 2).toUpperCase()}%`], (err, codesResult) => {
          if (err) return res.status(500).json({ error: err.message });

          const usedNumbers = codesResult.map(prod => {
            const match = prod.ProductCode.match(/^P[A-Z]{2}(\d{3})$/);
            return match ? parseInt(match[1], 10) : null;
          }).filter(n => n !== null);

          let nextNumber = 1;
          while (usedNumbers.includes(nextNumber)) {
            nextNumber++;
          }

          const productCode = generateProductCode(categoryName, nextNumber);

          const insertQuery = `
            INSERT INTO Products 
              (ProductName, CategoryID, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, StoreID, ProductCode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            insertQuery,
            [ProductName, CategoryID, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, StoreID, productCode],
            (err, result) => {
              if (err) return res.status(500).json({ error: err.message });

              res.status(201).json({
                id: result.insertId,
                ProductCode: productCode,
                ProductName,
                CategoryID,
                UnitPrice,
                SalePrice,
                QuantityInStock,
                ReorderLevel,
                StoreID
              });
            }
          );
        });
      });
    }
  );
});

app.delete('/products/:productId', authenticateToken, (req, res) => {
  const productId = req.params.productId;

  if (!productId) return res.status(400).json({ error: 'Missing productId' });

  const deleteQuery = 'DELETE FROM Products WHERE ProductID = ?';

  db.query(deleteQuery, [productId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error deleting product' });

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });

    res.json({ success: true });
  });
});

app.put('/products/:productId', authenticateToken, validateStoreOwnership, (req, res) => {
  const { productId } = req.params;
  const { ProductName, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, CategoryName } = req.body;
  const storeId = req.user.storeId;

  if (!productId || !ProductName || !UnitPrice || !SalePrice || !QuantityInStock || !ReorderLevel || !CategoryName || !storeId) {
    return res.status(400).json({ error: 'Missing required fields (productId, ProductName, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, CategoryName, storeId)' });
  }

  const trimmedProductName = ProductName.trim();

  const categoryQuery = 'SELECT CategoryID FROM Categories WHERE CategoryName = ?';
  db.query(categoryQuery, [CategoryName], (err, categoryResults) => {
    if (err) return res.status(500).json({ error: 'Error fetching category' });
    if (categoryResults.length === 0) return res.status(404).json({ error: 'Category not found' });

    const categoryID = categoryResults[0].CategoryID;

    const productQuery = 'SELECT * FROM Products WHERE ProductID = ? AND StoreID = ?';
    db.query(productQuery, [productId, storeId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Error checking product existence' });
      if (results.length === 0) return res.status(404).json({ error: 'Product not found or does not belong to the store' });

      const updateQuery = `
        UPDATE Products
        SET ProductName = ?, UnitPrice = ?, SalePrice = ?, QuantityInStock = ?, ReorderLevel = ?, CategoryID = ?
        WHERE ProductID = ? AND StoreID = ?
      `;
      db.query(updateQuery, [trimmedProductName, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, categoryID, productId, storeId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error updating product' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });

        res.json({
          success: true,
          id: productId,
          name: trimmedProductName,
          unitPrice: UnitPrice,
          salePrice: SalePrice,
          quantityInStock: QuantityInStock,
          reorderLevel: ReorderLevel,
          categoryName: CategoryName,
          storeId,
        });
      });
    });
  });
});

module.exports = app;