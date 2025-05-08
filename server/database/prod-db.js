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
  const UserID = req.user.id; 

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
        const prefix = categoryName.substring(0, 2).toUpperCase();

        const getCodesQuery = `
          SELECT ProductCode FROM Products 
          WHERE CategoryID = ? AND StoreID = ? AND ProductCode LIKE ?
        `;

        db.query(getCodesQuery, [CategoryID, StoreID, `P${prefix}%`], (err, codesResult) => {
          if (err) return res.status(500).json({ error: err.message });

          const usedNumbers = codesResult.map(prod => {
            const match = prod.ProductCode.match(/^P[A-Z]{2}(\d{3})$/);
            return match ? parseInt(match[1], 10) : null;
          }).filter(n => n !== null);

          let nextNumber = 1;
          while (usedNumbers.includes(nextNumber)) {
            nextNumber++;
          }

          const ProductCode = `P${prefix}${String(nextNumber).padStart(3, '0')}`;

          const insertProductQuery = `
            INSERT INTO Products 
              (ProductName, CategoryID, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, StoreID, ProductCode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            insertProductQuery,
            [ProductName, CategoryID, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, StoreID, ProductCode],
            (err, result) => {
              if (err) return res.status(500).json({ error: err.message });

              const newProductId = result.insertId;
              const changeType = 'New';
              const logPrefix = 'L' + changeType.substring(0, 3).toUpperCase();

              const logPrefixQuery = `
                SELECT LogCode FROM stocklog 
                WHERE LogCode LIKE ? ORDER BY LogCode DESC LIMIT 1
              `;

              db.query(logPrefixQuery, [`${logPrefix}%`], (err, existingLogs) => {
                if (err) return res.status(500).json({ error: 'Failed to generate log code' });

                let nextLogNumber = 1;
                if (existingLogs.length > 0) {
                  const lastCode = existingLogs[0].LogCode;
                  const match = lastCode.match(/^L[A-Z]{3}(\d{3})$/);
                  if (match) {
                    nextLogNumber = parseInt(match[1], 10) + 1;
                  }
                }

                const logCode = `${logPrefix}${String(nextLogNumber).padStart(3, '0')}`;
                const formattedQuantity = (QuantityInStock > 0 ? `+${QuantityInStock}` : `${QuantityInStock}`);

                const insertLogQuery = `
                INSERT INTO stocklog 
                (LogCode, ProductID, ProductName, ProductCode, ChangeType, QuantityChanged, StockBefore, StockAfter, Note, StoreID, UserID)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

                db.query(
                  insertLogQuery,
                  [
                    logCode,
                    newProductId,
                    ProductName,
                    ProductCode,
                    changeType,
                    formattedQuantity,
                    0,
                    QuantityInStock,
                    'Initial stock on product creation',
                    StoreID,
                    UserID
                  ],
                  (logErr) => {
                    if (logErr) {
                      console.error('❌ Failed to insert into stocklog:', logErr);
                    } else {
                      console.log('✅ Stocklog inserted successfully:', logCode);
                    }

                    res.status(201).json({
                      id: newProductId,
                      ProductCode,
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
            }
          );
        });
      });
    }
  );
});

app.delete('/products/:productId', authenticateToken, (req, res) => {
  const productId = req.params.productId;
  const StoreID = req.user.storeId;
  const UserID = req.user.id;

  if (!productId) return res.status(400).json({ error: 'Missing productId' });

  const getProductQuery = 'SELECT * FROM Products WHERE ProductID = ? AND StoreID = ?';

  db.query(getProductQuery, [productId, StoreID], (err, productResult) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch product' });
    if (productResult.length === 0) return res.status(404).json({ error: 'Product not found' });

    const product = productResult[0];
    const { ProductID, ProductName, ProductCode, QuantityInStock } = product;

    const changeType = 'Removed';
    const logPrefix = 'L' + changeType.substring(0, 3).toUpperCase();

    const getLastLogCode = `
      SELECT LogCode FROM stocklog 
      WHERE LogCode LIKE ? ORDER BY LogCode DESC LIMIT 1
    `;

    db.query(getLastLogCode, [`${logPrefix}%`], (logErr, logResult) => {
      if (logErr) {
        console.error('⚠️ Failed to get last log code:', logErr);
        return res.status(500).json({ error: 'Product deleted but log creation failed' });
      }

      let nextLogNumber = 1;
      if (logResult.length > 0) {
        const lastCode = logResult[0].LogCode;
        const match = lastCode.match(/^L[A-Z]{3}(\d{3})$/);
        if (match) {
          nextLogNumber = parseInt(match[1], 10) + 1;
        }
      }

      const logCode = `${logPrefix}${String(nextLogNumber).padStart(3, '0')}`;

      const insertLogQuery = `
        INSERT INTO stocklog 
          (LogCode, ProductID, ProductName, ProductCode, ChangeType, QuantityChanged, StockBefore, StockAfter, Note, StoreID, UserID)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertLogQuery,
        [
          logCode,
          ProductID,
          ProductName,
          ProductCode,
          changeType,
          -QuantityInStock,
          QuantityInStock,
          0,
          `Product "${ProductName}" removed from inventory`,
          StoreID,
          UserID
        ],
        (logInsertErr) => {
          if (logInsertErr) {
            console.error('⚠️ Failed to insert log after delete:', logInsertErr);
            return res.json({ success: true, warning: 'Product deleted but log not created' });
          }

          const deleteQuery = 'DELETE FROM Products WHERE ProductID = ?';

          db.query(deleteQuery, [ProductID], (deleteErr, result) => {
            if (deleteErr) {
              console.error('❌ Error deleting product:', deleteErr);
              return res.status(500).json({ error: 'Error deleting product' });
            }

            if (result.affectedRows === 0) {
              return res.status(404).json({ error: 'Product not found (maybe already deleted)' });
            }

            console.log(`✅ Product ${ProductID} deleted and logged as ${logCode}`);
            res.json({ success: true, logCode });
          });
        }
      );
    });
  });
});

app.put('/products/:productId', authenticateToken, validateStoreOwnership, (req, res) => {
  const { productId } = req.params;
  const { ProductName, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, CategoryName } = req.body;
  const storeId = req.user.storeId;
  const userId = req.user.id;

  if (!productId || !ProductName || !UnitPrice || !SalePrice || !QuantityInStock || !ReorderLevel || !CategoryName || !storeId) {
    return res.status(400).json({ error: 'Missing required fields' });
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
      if (results.length === 0) return res.status(404).json({ error: 'Product not found' });

      const existingProduct = results[0];

      const updateQuery = `
        UPDATE Products
        SET ProductName = ?, UnitPrice = ?, SalePrice = ?, QuantityInStock = ?, ReorderLevel = ?, CategoryID = ?
        WHERE ProductID = ? AND StoreID = ?
      `;
      db.query(updateQuery, [trimmedProductName, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, categoryID, productId, storeId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error updating product' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });

        const quantityChanged = QuantityInStock - existingProduct.QuantityInStock;

        if (quantityChanged !== 0) {
          const changeType = 'Corrected';
          const logPrefix = 'L' + changeType.substring(0, 3).toUpperCase();

          const getLastLogCode = `
            SELECT LogCode FROM stocklog 
            WHERE LogCode LIKE ? ORDER BY LogCode DESC LIMIT 1
          `;

          db.query(getLastLogCode, [`${logPrefix}%`], (logErr, logResult) => {
            if (logErr) {
              console.error('⚠️ Failed to get last log code:', logErr);
              return res.status(500).json({ error: 'Product updated but log creation failed' });
            }

            let nextLogNumber = 1;
            if (logResult.length > 0) {
              const lastCode = logResult[0].LogCode;
              const match = lastCode.match(/^L[A-Z]{3}(\d{3})$/);
              if (match) {
                nextLogNumber = parseInt(match[1], 10) + 1;
              }
            }

            const logCode = `${logPrefix}${String(nextLogNumber).padStart(3, '0')}`;
            const note = 'Stock corrected via product update';
            const insertLogQuery = `
              INSERT INTO stocklog 
                (LogCode, ProductID, ProductName, ProductCode, ChangeType, QuantityChanged, StockBefore, StockAfter, Note, StoreID, UserID)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
              insertLogQuery,
              [
                logCode,
                existingProduct.ProductID,
                trimmedProductName,
                existingProduct.ProductCode,
                changeType,
                quantityChanged,
                existingProduct.QuantityInStock,
                QuantityInStock,
                note,
                storeId,
                userId
              ],
              (logInsertErr) => {
                if (logInsertErr) {
                  console.error('⚠️ Failed to insert correction log:', logInsertErr);
                  return res.json({ success: true, warning: 'Product updated but log not created' });
                }

                console.log(`✅ Stock correction log inserted: ${logCode}`);

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
                  logCode
                });
              }
            );
          });
        } else {
          res.json({
            success: true,
            id: productId,
            name: trimmedProductName,
            unitPrice: UnitPrice,
            salePrice: SalePrice,
            quantityInStock: QuantityInStock,
            reorderLevel: ReorderLevel,
            categoryName: CategoryName,
            storeId
          });
        }
      });
    });
  });
});

app.patch('/products/:productId/restock', authenticateToken, validateStoreOwnership, (req, res) => {
  const { productId } = req.params;
  const { quantityToAdd } = req.body;
  const storeId = req.user.storeId;
  const userId = req.user.id;

  console.log('PATCH /restock called');
  console.log('productId:', productId);
  console.log('quantityToAdd (raw):', quantityToAdd);
  console.log('Parsed quantityToAdd:', Number(quantityToAdd));

  if (!quantityToAdd || isNaN(quantityToAdd)) {
    console.log('Invalid quantityToAdd — rejecting');
    return res.status(400).json({ error: 'Invalid quantityToAdd' });
  }

  const getProductQuery = 'SELECT * FROM Products WHERE ProductID = ? AND StoreID = ?';
  db.query(getProductQuery, [productId, storeId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching product' });
    if (results.length === 0) return res.status(404).json({ error: 'Product not found' });

    const product = results[0];
    const newQuantity = product.QuantityInStock + parseInt(quantityToAdd, 10);

    const updateProductQuery = 'UPDATE Products SET QuantityInStock = ? WHERE ProductID = ?';
    db.query(updateProductQuery, [newQuantity, productId], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update stock' });

      const changeType = 'Restocked';
      const logPrefix = 'L' + changeType.substring(0, 3).toUpperCase();

      const getLastLogCode = `SELECT LogCode FROM stocklog WHERE LogCode LIKE ? ORDER BY LogCode DESC LIMIT 1`;
      db.query(getLastLogCode, [`${logPrefix}%`], (logErr, logResult) => {
        if (logErr) return res.status(500).json({ error: 'Failed to get log code' });

        let nextLogNumber = 1;
        if (logResult.length > 0) {
          const lastCode = logResult[0].LogCode;
          const match = lastCode.match(/^L[A-Z]{3}(\d{3})$/);
          if (match) nextLogNumber = parseInt(match[1], 10) + 1;
        }

        const logCode = `${logPrefix}${String(nextLogNumber).padStart(3, '0')}`;
        const note = `Restocked ${quantityToAdd} unit(s)`;
        const insertLogQuery = `
          INSERT INTO stocklog 
          (LogCode, ProductID, ProductName, ProductCode, ChangeType, QuantityChanged, StockBefore, StockAfter, Note, StoreID, UserID)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(insertLogQuery, [
          logCode,
          product.ProductID,
          product.ProductName,
          product.ProductCode,
          changeType,
          quantityToAdd,
          product.QuantityInStock,
          newQuantity,
          note,
          storeId,
          userId
        ], (insertErr) => {
          if (insertErr) {
            console.error('Log insert failed:', insertErr);
            return res.status(500).json({ error: 'Restocked but log not saved' });
          }

          res.json({ success: true, newQuantity, logCode });
        });
      });
    });
  });
});

app.get('/stock-logs', authenticateToken, (req, res) => {
  const storeId = req.user.storeId;

  const query = `
    SELECT 
      sl.LogID AS id,
      sl.LogCode AS code,
      sl.ProductName AS productName,
      sl.ProductCode AS productCode,
      sl.ChangeType AS changeType,
      sl.QuantityChanged AS quantityChanged,
      sl.StockBefore AS stockBefore,
      sl.StockAfter AS stockAfter,
      sl.Note AS note,
      sl.DateTime AS date,
      u.username AS user
    FROM stocklog sl
    LEFT JOIN users u ON sl.UserID = u.UserID
    WHERE sl.StoreID = ?
    ORDER BY sl.DateTime DESC
  `;

  db.query(query, [storeId], (err, results) => {
    if (err) {
      console.error('Failed to fetch stock logs:', err);
      return res.status(500).json({ error: 'Failed to fetch stock logs' });
    }

    const formattedResults = results.map(log => {
      const formattedQuantity = log.quantityChanged >= 0
        ? `+${log.quantityChanged}`
        : `${log.quantityChanged}`;

      return {
        ...log,
        quantityChanged: formattedQuantity,
      };
    });

    res.json(formattedResults);
  });
});

module.exports = app;