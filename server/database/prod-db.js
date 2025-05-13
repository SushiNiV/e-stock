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
  next();
};

//get all products from the store
app.get('/products', authenticateToken, (req, res) => {
  const storeId = req.user.storeId;

  db.query('SELECT * FROM Products WHERE StoreID = ?', [storeId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

//creates a new product
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

//delete a product
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

//update a product
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

//restock a product
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

//get all stock logs from the store
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

//records a sale
app.post('/sales-log', authenticateToken, validateStoreOwnership, (req, res) => {
  const { productId, customerId, quantitySold, totalAmount, paymentStatus, paymentMethod, note } = req.body;
  const storeId = req.user.storeId;
  const userId = req.user.id;

  if (quantitySold == null || isNaN(quantitySold)) {
    return res.status(400).json({ error: 'Invalid quantitySold' });
  }

  if (totalAmount == null || isNaN(totalAmount)) {
    return res.status(400).json({ error: 'Invalid totalAmount' });
  }

  const getProductQuery = 'SELECT * FROM Products WHERE ProductID = ? AND StoreID = ?';
  db.query(getProductQuery, [productId, storeId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching product' });
    if (results.length === 0) return res.status(404).json({ error: 'Product not found' });

    const product = results[0];
    const productName = product.ProductName;
    const productCode = product.ProductCode;
    const newStock = product.QuantityInStock - quantitySold;

    if (newStock < 0) return res.status(400).json({ error: 'Not enough stock for the sale' });

    const updateProductQuery = 'UPDATE Products SET QuantityInStock = ? WHERE ProductID = ?';
    db.query(updateProductQuery, [newStock, productId], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update stock' });

      const logPrefix = 'SLS';
      const getLastLogCode = `SELECT LogCode FROM productsaleslog WHERE LogCode LIKE ? ORDER BY LogCode DESC LIMIT 1`;
      db.query(getLastLogCode, [`${logPrefix}%`], (logErr, logResult) => {
        if (logErr) return res.status(500).json({ error: 'Failed to get log code' });

        let nextLogNumber = 1;
        if (logResult.length > 0) {
          const lastCode = logResult[0].LogCode;
          const match = lastCode.match(/^SLS(\d{3})$/);
          if (match) nextLogNumber = parseInt(match[1], 10) + 1;
        }

        const logCode = `${logPrefix}${String(nextLogNumber).padStart(3, '0')}`;
        const insertLogQuery = `
          INSERT INTO productsaleslog 
          (LogCode, ProductID, CustomerID, SaleDate, QuantitySold, TotalAmount, PaymentStatus, PaymentMethod, Note, StoreID, UserID)
          VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(insertLogQuery, [
          logCode,
          productId,
          customerId || null,
          quantitySold,
          totalAmount,
          paymentStatus || 'Paid',
          paymentMethod || 'Cash',
          note || '',
          storeId,
          userId
        ], (insertErr) => {
          if (insertErr) {
            console.error('Sales log insert failed:', insertErr.sqlMessage || insertErr.message);
            return res.status(500).json({ error: 'Sales log not saved', details: insertErr.sqlMessage });
          }
          res.json({ success: true, logCode });
        });
      });
    });
  });
});

//get all sales logs from the store
app.get('/sales-log', authenticateToken, (req, res) => {
  const storeId = req.user.storeId;
  const query = `
    SELECT 
      sl.LogID AS id,
      sl.LogCode AS code,
      p.ProductName AS productName,
      sl.ProductID AS productId,
      sl.CustomerID AS customerId,
      sl.SaleDate AS date,
      sl.QuantitySold AS quantitySold,
      sl.TotalAmount AS totalAmount,
      sl.PaymentStatus AS paymentStatus,
      sl.PaymentMethod AS paymentMethod,
      sl.Note AS note,
      u.username AS user
    FROM productsaleslog sl
    LEFT JOIN users u ON sl.UserID = u.UserID
    LEFT JOIN Products p ON sl.ProductID = p.ProductID
    WHERE sl.StoreID = ?
    ORDER BY sl.SaleDate DESC
  `;
  
  db.query(query, [storeId], (err, results) => {
    if (err) {
      console.error('Failed to fetch sales logs:', err);
      return res.status(500).json({ error: 'Failed to fetch sales logs' });
    }
    res.json(results);
  });
});

//records a sale
app.post('/sales', authenticateToken, validateStoreOwnership, (req, res) => {
  const { cartItems, paymentMethod, paymentStatus, customer, total } = req.body;

  const storeId = req.user.storeId;
  const userId = req.user.id;

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty or invalid.' });
  }

  const paymentMethodToInsert =
    (paymentMethod || '').trim().toLowerCase() === 'cash'
      ? 'Cash'
      : (paymentMethod || '').trim().toLowerCase() === 'gcash'
      ? 'GCash'
      : '-';

  if (paymentStatus === 'borrowed' && paymentMethodToInsert !== '-') {
    return res.status(400).json({ error: 'Borrowed payment must use "-" as method.' });
  }

  if (paymentStatus === 'paid' && !['Cash', 'GCash'].includes(paymentMethodToInsert)) {
    return res.status(400).json({ error: 'Paid payment must use "Cash" or "GCash".' });
  }

  const connection = db;

  connection.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({ error: 'Transaction start failed.', details: err });
    }

    const salePrefix = 'SLS';
    const stockPrefix = paymentStatus === 'borrowed' ? 'LBRW' : 'LSLD';

    const getLastSaleLogCode = `SELECT LogCode FROM productsaleslog WHERE LogCode LIKE '${salePrefix}%' ORDER BY LogCode DESC LIMIT 1`;
    const getLastStockLogCode = `SELECT LogCode FROM stocklog WHERE LogCode LIKE '${stockPrefix}%' ORDER BY LogCode DESC LIMIT 1`;

    connection.query(getLastSaleLogCode, (err, saleResult) => {
      if (err) {
        return connection.rollback(() => res.status(500).json({ error: 'Failed to get last sale log.', details: err }));
      }

      connection.query(getLastStockLogCode, (err, stockResult) => {
        if (err) {
          return connection.rollback(() => res.status(500).json({ error: 'Failed to get last stock log.', details: err }));
        }

        let nextSaleNumber = 1;
        if (saleResult.length > 0) {
          const lastCode = saleResult[0].LogCode;
          const match = lastCode.match(/^SLS(\d{3})$/);
          if (match) nextSaleNumber = parseInt(match[1]) + 1;
        }

        let nextStockNumber = 1;
        if (stockResult.length > 0) {
          const lastCode = stockResult[0].LogCode;
          const match = lastCode.match(/^L[A-Z]{3}(\d{3})$/);
          if (match) nextStockNumber = parseInt(match[1]) + 1;
        }

        let customerId = null;

        if (paymentStatus === 'borrowed') {
          if (customer && customer.id) {
            const updateBalanceQuery = `
              UPDATE customers SET TotalUnpaid = TotalUnpaid + ? 
              WHERE CustomerID = ? AND StoreID = ?
            `;
            connection.query(updateBalanceQuery, [total, customer.id, storeId], (err, result) => {
              if (err) {
                return connection.rollback(() => res.status(500).json({ error: 'Failed to update customer balance.', details: err }));
              }
              customerId = customer.id;
              proceedWithTransaction();
            });
          } else {
            const customerPrefix = 'CSM';
            const getLastCustomerCodeQuery = `
              SELECT CustomerCode 
              FROM customers 
              WHERE StoreID = ? AND CustomerCode LIKE ? 
              ORDER BY CustomerCode DESC LIMIT 1
            `;

            connection.query(getLastCustomerCodeQuery, [storeId, `${customerPrefix}%`], (err, result) => {
              if (err) {
                return connection.rollback(() => res.status(500).json({ error: 'Failed to fetch customer codes.', details: err }));
              }

              let nextNumber = 1;
              if (result.length > 0) {
                const lastCode = result[0].CustomerCode;
                const match = lastCode.match(/^CSM(\d{3})$/);
                if (match) {
                  nextNumber = parseInt(match[1], 10) + 1;
                }
              }

              const newCustomerCode = `CSM${String(nextNumber).padStart(3, '0')}`;
              const toTitleCase = (str) => str.toLowerCase().split(' ').filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
              const customerNameTitleCase = toTitleCase(customer.name || '');

              const insertCustomerQuery = `
                INSERT INTO customers (CustomerName, ContactInfo, StoreID, CustomerCode, TotalUnpaid) 
                VALUES (?, ?, ?, ?, ?)
              `;

              connection.query(insertCustomerQuery, [customerNameTitleCase, customer.contact || null, storeId, newCustomerCode, total], (customerErr, customerResult) => {
                if (customerErr) {
                  return connection.rollback(() => res.status(500).json({ error: 'Failed to insert customer.', details: customerErr }));
                }
                customerId = customerResult.insertId;
                proceedWithTransaction();
              });
            });
          }
        } else {
          proceedWithTransaction();
        }

        function proceedWithTransaction() {
          const tasks = cartItems.map((item, index) => {
            return new Promise((resolve, reject) => {
              const productQuery = 'SELECT * FROM products WHERE ProductID = ? AND StoreID = ?';
              connection.query(productQuery, [item.id, storeId], (err, results) => {
                if (err) {
                  return reject(err);
                }
                if (results.length === 0) {
                  return reject(`Product ${item.name} not found`);
                }

                const product = results[0];
                const stockBefore = product.QuantityInStock;
                const quantitySold = Number(item.quantity);
                const stockAfter = stockBefore - quantitySold;

                if (stockAfter < 0) return reject(`Not enough stock for ${product.ProductName}`);

                const updateStockQuery = 'UPDATE products SET QuantityInStock = ? WHERE ProductID = ?';
                connection.query(updateStockQuery, [stockAfter, item.id], (err) => {
                  if (err) {
                    return reject(err);
                  }

                  const insertStockLog = `
                    INSERT INTO stocklog
                    (LogCode, ProductID, ProductName, ProductCode, ChangeType, QuantityChanged, StockBefore, StockAfter, Note, StoreID, UserID)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `;
                  connection.query(insertStockLog, [
                    `${stockPrefix}${String(nextStockNumber + index).padStart(3, '0')}`,
                    product.ProductID,
                    product.ProductName,
                    product.ProductCode,
                    paymentStatus === 'borrowed' ? 'Borrowed' : 'Sold',
                    quantitySold,
                    stockBefore,
                    stockAfter,
                    `Stock out ${quantitySold} unit(s)`,
                    storeId,
                    userId,
                  ], (err) => {
                    if (err) {
                      return reject(err);
                    }

                    const insertSaleLog = `
                      INSERT INTO productsaleslog 
                      (LogCode, ProductID, CustomerID, QuantitySold, TotalAmount, PaymentStatus, PaymentMethod, Note, StoreID, UserID)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    connection.query(insertSaleLog, [
                      `${salePrefix}${String(nextSaleNumber + index).padStart(3, '0')}`,
                      item.id,
                      paymentStatus === 'borrowed' ? customerId : null,
                      quantitySold,
                      item.price * quantitySold,
                      paymentStatus === 'borrowed' ? 'Borrowed' : 'Paid',
                      paymentMethodToInsert,
                      '',
                      storeId,
                      userId,
                    ], (err) => {
                      if (err) {
                        return reject(err);
                      }
                      resolve();
                    });
                  });
                });
              });
            });
          });

          Promise.all(tasks)
            .then(() => {
              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => res.status(500).json({ error: 'Transaction commit failed.', details: err }));
                }
                res.json({ success: true });
              });
            })
            .catch((err) => {
              connection.rollback(() => res.status(500).json({ error: 'Sale failed. Please try again.', details: err }));
            });
        }
      });
    });
  });
});

//get customer
app.get('/customers', authenticateToken, validateStoreOwnership, (req, res) => {
  const storeId = req.user.storeId;

  const query = `
    SELECT 
      c.CustomerID,
      c.CustomerName,
      c.ContactInfo,
      c.CustomerCode,  -- Fetch the actual CustomerCode from the database
      COALESCE(SUM(
        CASE 
          WHEN ps.PaymentStatus = 'Borrowed' THEN ps.TotalAmount
          ELSE 0
        END
      ), 0) AS TotalUnpaid
    FROM customers c
    LEFT JOIN productsaleslog ps ON c.CustomerID = ps.CustomerID AND ps.StoreID = ?
    WHERE c.StoreID = ?
    GROUP BY c.CustomerID, c.CustomerName, c.ContactInfo, c.CustomerCode  -- Group by the CustomerCode as well
    ORDER BY c.CustomerName
  `;

  db.query(query, [storeId, storeId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const formattedResults = results.map(cust => ({
      ...cust,
      TotalUnpaid: parseFloat(cust.TotalUnpaid) || 0
    }));

    res.json(formattedResults);
  });
});

app.get('/customers/:customerId/borrowed-products', authenticateToken, validateStoreOwnership, (req, res) => {
  console.log('Entered /customers/:customerId/borrowed-products route');
  const storeId = req.user.storeId;
  const customerId = req.params.customerId;
  console.log(`CustomerID: ${customerId}, StoreID: ${storeId}`);

  const query = `
    SELECT 
      p.ProductName,
      ps.QuantitySold,  -- We're selecting QuantitySold
      ps.TotalAmount
    FROM productsaleslog ps
    JOIN products p ON ps.ProductID = p.ProductID
    WHERE ps.CustomerID = ? AND ps.StoreID = ? AND ps.PaymentStatus = 'Borrowed'
  `;

  db.query(query, [customerId, storeId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    console.log('Database query executed successfully');
    console.log('Results:', results);

    const formattedResults = results.map(product => ({
      name: product.ProductName,
      quantity: product.QuantitySold,
      totalAmount: parseFloat(product.TotalAmount) || 0
    }));

    res.json(formattedResults);
  });
});

app.put('/customers/:id', authenticateToken, validateStoreOwnership, (req, res) => {
  const customerId = req.params.id;
  const { CustomerName, ContactInfo } = req.body;
  const storeId = req.user.storeId;

  if (!CustomerName || typeof CustomerName !== 'string') {
    return res.status(400).json({ error: 'Customer name is required.' });
  }

  const toTitleCase = (str) =>
    str
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join(' ');

  const updatedName = toTitleCase(CustomerName);
  const updatedContact = ContactInfo || null;

  const query = `
    UPDATE customers 
    SET CustomerName = ?, ContactInfo = ?
    WHERE CustomerID = ? AND StoreID = ?
  `;

  db.query(query, [updatedName, updatedContact, customerId, storeId], (err, result) => {
    if (err) {
      console.error('Error updating customer:', err);
      return res.status(500).json({ error: 'Failed to update customer.' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json({ 
      id: customerId,
      name: updatedName,
      contact: updatedContact 
    });
  });
});

app.delete('/customers/:id', authenticateToken, validateStoreOwnership, (req, res) => {
  const customerId = req.params.id;
  const storeId = req.user.storeId;

  const checkQuery = 'SELECT TotalUnpaid FROM customers WHERE CustomerID = ? AND StoreID = ?';
  db.query(checkQuery, [customerId, storeId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to check balance.' });
    if (result.length === 0) return res.status(404).json({ error: 'Customer not found.' });

    const unpaid = parseFloat(result[0].TotalUnpaid);
    if (unpaid > 0) return res.status(400).json({ error: 'Cannot delete customer with unpaid balance.' });

    const deleteQuery = 'DELETE FROM customers WHERE CustomerID = ? AND StoreID = ?';
    db.query(deleteQuery, [customerId, storeId], (err2) => {
      if (err2) return res.status(500).json({ error: 'Failed to delete customer.' });
      res.json({ success: true });
    });
  });
});

module.exports = app;