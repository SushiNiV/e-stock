require('dotenv').config();
const upload = require('./upload');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'], 
    allowedHeaders: ['Content-Type'], 
    credentials: true,
  },
});

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

    const formattedResults = results.map(product => {
      const imageUrl = product.ProductImage
        ? `http://localhost:3004/uploads/${product.ProductImage}`
        : 'http://localhost:3004/uploads/default.jpg';

      return {
        ...product,
        ProductImage: imageUrl,
      };
    });

    res.json(formattedResults);
  });
});

const path = require('path');
const pathToServe = path.join(__dirname, 'uploads');
console.log("Serving static files from:", pathToServe);
console.log('Serving from path:', path.join(__dirname, 'uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  console.log(`Request URL: ${req.url}`);
  next();
});

//creates a new product
app.post('/products', authenticateToken, upload.single('ProductImage'), (req, res) => {
  const {
    ProductName, CategoryID, UnitPrice, SalePrice,
    QuantityInStock, ReorderLevel
  } = req.body;

  const StoreID = req.user.storeId;
  const UserID = req.user.id;
  const ProductImage = req.file ? req.file.filename : null;
  if (req.file && req.file.filename) {
    console.log('Uploaded file:', req.file.filename);
  } else {
    console.error('No file uploaded');
  }

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
              (ProductName, CategoryID, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, StoreID, ProductCode, ProductImage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            insertProductQuery,
            [
              ProductName, CategoryID, UnitPrice, SalePrice,
              QuantityInStock, ReorderLevel, StoreID, ProductCode, ProductImage
            ],
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
app.put('/products/:productId', authenticateToken, validateStoreOwnership, upload.single('ProductImage'), (req, res) => {
  const { productId } = req.params;
  const { ProductName, UnitPrice, SalePrice, QuantityInStock, ReorderLevel, CategoryName } = req.body;
  const storeId = req.user.storeId;
  const userId = req.user.id;
  const file = req.file;

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

      const imagePath = file ? file.filename : existingProduct.ProductImage;

      const updateQuery = `
        UPDATE Products
        SET ProductName = ?, UnitPrice = ?, SalePrice = ?, QuantityInStock = ?, ReorderLevel = ?, CategoryID = ?, ProductImage = ?
        WHERE ProductID = ? AND StoreID = ?
      `;

      db.query(updateQuery, [
        trimmedProductName,
        UnitPrice,
        SalePrice,
        QuantityInStock,
        ReorderLevel,
        categoryID,
        imagePath,
        productId,
        storeId
      ], (err, result) => {
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

            db.query(insertLogQuery, [
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
            ], (logInsertErr) => {
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
                imagePath,
                logCode
              });
            });
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
            storeId,
            imagePath
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

  if (!quantityToAdd || isNaN(quantityToAdd)) {
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
      const logPrefix = 'L' + changeType.substring(0, 3).toUpperCase(); // LRES

      // Generate a unique LogCode for this store
      const generateUniqueLogCode = () => {
        return new Promise((resolve, reject) => {
          const getLastLogCode = `
            SELECT LogCode FROM stocklog 
            WHERE StoreID = ? AND LogCode LIKE ? 
            ORDER BY LogCode DESC LIMIT 1
          `;

          db.query(getLastLogCode, [storeId, `${logPrefix}%`], async (logErr, logResults) => {
            if (logErr) return reject(logErr);

            let nextNumber = 1;
            if (logResults.length > 0) {
              const lastCode = logResults[0].LogCode;
              const match = lastCode.match(/^L[A-Z]{3}(\d{3})$/);
              if (match) nextNumber = parseInt(match[1], 10) + 1;
            }

            const tryGenerate = () => {
              return new Promise((res, rej) => {
                const logCode = `${logPrefix}${String(nextNumber).padStart(3, '0')}`;
                db.query(
                  'SELECT 1 FROM stocklog WHERE StoreID = ? AND LogCode = ? LIMIT 1',
                  [storeId, logCode],
                  (checkErr, checkResult) => {
                    if (checkErr) return rej(checkErr);
                    if (checkResult.length === 0) return res(logCode);
                    nextNumber++;
                    res(null);
                  }
                );
              });
            };

            let uniqueCode = null;
            while (!uniqueCode) {
              try {
                uniqueCode = await tryGenerate();
              } catch (err) {
                return reject(err);
              }
            }

            resolve(uniqueCode);
          });
        });
      };

      generateUniqueLogCode()
        .then((logCode) => {
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
            `Restocked ${quantityToAdd} unit(s)`,
            storeId,
            userId
          ], (insertErr) => {
            if (insertErr) {
              console.error('Log insert failed:', insertErr);
              return res.status(500).json({ error: 'Restocked but log not saved' });
            }

            res.json({ success: true, newQuantity, logCode });
          });
        })
        .catch((err) => {
          console.error('Failed to generate unique log code:', err);
          res.status(500).json({ error: 'Failed to generate log code' });
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
      let formattedQuantity;

      if (['Sold', 'Borrowed', 'Removed'].includes(log.changeType)) {
        formattedQuantity = `-${Math.abs(log.quantityChanged)}`;
      } else {
        formattedQuantity = `+${Math.abs(log.quantityChanged)}`;
      }

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
    sl.RemainingAmount AS remainingAmount,
    sl.PaymentStatus AS paymentStatus,
    sl.PaymentMethod AS paymentMethod,
    sl.Note AS note,
    u.username AS user,
    COALESCE(c.CustomerName, 'Walk-in') AS customerName
  FROM productsaleslog sl
  LEFT JOIN users u ON sl.UserID = u.UserID
  LEFT JOIN Products p ON sl.ProductID = p.ProductID
  LEFT JOIN customers c ON sl.CustomerID = c.CustomerID
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
          if (match) nextStockNumber = parseInt(match[1], 10) + 1;
        }

        const checkStockLogCode = `SELECT LogCode FROM stocklog WHERE LogCode = ? LIMIT 1`;
        const checkSaleLogCode = `SELECT LogCode FROM productsaleslog WHERE LogCode = ? LIMIT 1`;

        const checkDuplicateLogCode = (logCode, query) => {
          return new Promise((resolve, reject) => {
            connection.query(query, [logCode], (err, result) => {
              if (err) return reject({ status: 500, error: 'Error checking for duplicate LogCode', details: err });
              resolve(result);
            });
          });
        };

        function generateSaleLogCode(num) {
          return `${salePrefix}${String(num).padStart(3, '0')}`;
        }

        function generateStockLogCode(num) {
          return `${stockPrefix}${String(num).padStart(3, '0')}`;
        }

        let customerId = null;

        if (paymentStatus === 'borrowed') {
          const customerName = (customer?.name || '').trim().toLowerCase();
          if (!customerName || customerName === 'walk-in') {
            return res.status(400).json({ error: 'Cannot borrow under Walk-in. Please select or enter a valid customer.' });
          }
        }

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

              let nextCustomerNumber = 1;
              if (result.length > 0) {
                const lastCode = result[0].CustomerCode;
                const match = lastCode.match(/^CSM(\d{3})$/);
                if (match) {
                  nextCustomerNumber = parseInt(match[1], 10) + 1;
                }
              }

              const newCustomerCode = `CSM${String(nextCustomerNumber).padStart(3, '0')}`;
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

        async function proceedWithTransaction() {
          let currentSaleNumber = nextSaleNumber;
          let currentStockNumber = nextStockNumber;

          const tasks = cartItems.map((item) => {
            return new Promise((resolve, reject) => {
              const productQuery = 'SELECT * FROM products WHERE ProductID = ? AND StoreID = ?';
              connection.query(productQuery, [item.id, storeId], (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) return reject(`Product ${item.name} not found`);

                const product = results[0];
                const stockBefore = product.QuantityInStock;
                const quantitySold = Number(item.quantity);
                const stockAfter = stockBefore - quantitySold;

                if (stockAfter < 0) return reject(`Not enough stock for ${product.ProductName}`);

                const updateStockQuery = 'UPDATE products SET QuantityInStock = ? WHERE ProductID = ?';
                connection.query(updateStockQuery, [stockAfter, item.id], async (err) => {
                  if (err) return reject(err);

                  let saleLogCode, stockLogCode;
                  try {
                    while (true) {
                      stockLogCode = generateStockLogCode(currentStockNumber++);
                      const result = await checkDuplicateLogCode(stockLogCode, checkStockLogCode);
                      if (result.length === 0) break;
                    }

                    while (true) {
                      saleLogCode = generateSaleLogCode(currentSaleNumber++);
                      const result = await checkDuplicateLogCode(saleLogCode, checkSaleLogCode);
                      if (result.length === 0) break;
                    }
                  } catch (err) {
                    return reject(err);
                  }

                  const insertStockLog = `
                    INSERT INTO stocklog
                    (LogCode, ProductID, ProductName, ProductCode, ChangeType, QuantityChanged, StockBefore, StockAfter, Note, StoreID, UserID, CustomerID)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `;
                  connection.query(insertStockLog, [
                    stockLogCode,
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
                    paymentStatus === 'borrowed' ? customerId : null
                  ], (err) => {
                    if (err) return reject(err);

                    const amount = item.price * quantitySold;
                    connection.query(`
                      INSERT INTO productsaleslog 
                      (LogCode, ProductID, CustomerID, QuantitySold, TotalAmount, RemainingAmount, PaymentStatus, PaymentMethod, Note, StoreID, UserID)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                      saleLogCode,
                      item.id,
                      paymentStatus === 'borrowed' ? customerId : null,
                      quantitySold,
                      amount,
                      paymentStatus === 'borrowed' ? amount : 0,
                      paymentStatus === 'borrowed' ? 'Borrowed' : 'Paid',
                      paymentMethodToInsert,
                      '',
                      storeId,
                      userId,
                    ], (err) => {
                      if (err) return reject(err);
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

app.post('/return', authenticateToken, validateStoreOwnership, (req, res) => {
  const { returnItems } = req.body;

  if (!Array.isArray(returnItems) || returnItems.length === 0) {
    return res.status(400).json({ message: 'No return items provided.' });
  }

  const storeId = req.user.storeId;
  const userId = req.user.id;
  const connection = db;

  const generateUniqueLogCode = (prefix, table) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT LogCode FROM ${table}
        WHERE StoreID = ? AND LogCode LIKE ?
        ORDER BY LogCode DESC LIMIT 1
      `;
      connection.query(query, [storeId, `${prefix}%`], (err, result) => {
        if (err) return reject(err);

        let nextNumber = 1;
        if (result.length > 0) {
          const match = result[0].LogCode.match(/^[A-Z]{3}(\d{3})$/);
          if (match) nextNumber = parseInt(match[1], 10) + 1;
        }

        const tryGenerate = () => {
          return new Promise((res, rej) => {
            const newCode = `${prefix}${String(nextNumber).padStart(3, '0')}`;
            connection.query(
              `SELECT 1 FROM ${table} WHERE StoreID = ? AND LogCode = ? LIMIT 1`,
              [storeId, newCode],
              (checkErr, check) => {
                if (checkErr) return rej(checkErr);
                if (check.length === 0) return res(newCode);
                nextNumber++;
                res(null);
              }
            );
          });
        };

        const loopUntilUnique = async () => {
          let code = null;
          while (!code) code = await tryGenerate();
          resolve(code);
        };

        loopUntilUnique().catch(reject);
      });
    });
  };

  connection.beginTransaction((err) => {
    if (err) {
      console.log('[ERROR] Failed to start transaction:', err);
      return res.status(500).json({ message: 'Transaction start failed.', details: err });
    }

    const salePrefix = 'SLS';
    const stockPrefix = 'RTN';

    const tasks = returnItems.map((item) => {
      return new Promise((resolve, reject) => {
        const productQuery = 'SELECT * FROM products WHERE ProductID = ? AND StoreID = ?';
        connection.query(productQuery, [item.id, storeId], (err, results) => {
          if (err || results.length === 0) return reject(`Product ${item.id} not found`);

          const product = results[0];
          const stockBefore = product.QuantityInStock;
          const quantityReturned = item.quantity;

          if (quantityReturned <= 0) return reject(`Invalid quantityReturned for product ${item.id}`);

          const price = parseFloat(product.SalePrice);
          if (isNaN(price)) return reject(`Invalid SalePrice for product ${item.id}`);

          const totalAmount = price * quantityReturned;
          const stockAfter = stockBefore + quantityReturned;

          const checkPaidSaleQuery = `
            SELECT SUM(QuantitySold) AS totalPaidSold
            FROM productsaleslog
            WHERE ProductID = ? AND StoreID = ? AND PaymentStatus = 'Paid' AND QuantitySold > 0
          `;
          connection.query(checkPaidSaleQuery, [item.id, storeId], (err, salesResults) => {
            if (err) return reject(`Error checking paid sales for product ${item.id}`);

            const totalPaidSold = salesResults[0].totalPaidSold || 0;
            if (quantityReturned > totalPaidSold) {
              return reject(`Cannot return more than sold quantity for product ${item.id}`);
            }

            const updateStockQuery = 'UPDATE products SET QuantityInStock = ? WHERE ProductID = ?';
            connection.query(updateStockQuery, [stockAfter, item.id], async (err) => {
              if (err) return reject(`Error updating stock for product ${item.id}`);

              try {
                const stockLogCode = await generateUniqueLogCode(stockPrefix, 'stocklog');
                const saleLogCode = await generateUniqueLogCode(salePrefix, 'productsaleslog');

                const insertStockLog = `
                  INSERT INTO stocklog
                  (LogCode, ProductID, ProductName, ProductCode, ChangeType, QuantityChanged, StockBefore, StockAfter, Note, StoreID, UserID)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                connection.query(insertStockLog, [
                  stockLogCode,
                  product.ProductID,
                  product.ProductName,
                  product.ProductCode,
                  'Returned',
                  quantityReturned,
                  stockBefore,
                  stockAfter,
                  `Return of ${quantityReturned} unit(s)`,
                  storeId,
                  userId
                ], (err) => {
                  if (err) return reject(`Error inserting stock log for product ${item.id}`);

                  const insertSaleLog = `
                    INSERT INTO productsaleslog
                    (LogCode, ProductID, QuantitySold, TotalAmount, RemainingAmount, PaymentStatus, PaymentMethod, Note, StoreID, UserID)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `;
                  connection.query(insertSaleLog, [
                    saleLogCode,
                    item.id,
                    -quantityReturned,
                    totalAmount,
                    0,
                    'Returned',
                    '-',
                    '',
                    storeId,
                    userId
                  ], (err) => {
                    if (err) return reject(`Error inserting sale log for product ${item.id}`);
                    console.log(`[SUCCESS] Returned ${quantityReturned} units of ProductID ${item.id}`);
                    resolve();
                  });
                });
              } catch (err) {
                reject(err);
              }
            });
          });
        });
      });
    });

    Promise.all(tasks)
      .then(() => {
        connection.commit((err) => {
          if (err) {
            console.log('[ERROR] Transaction commit failed:', err);
            return connection.rollback(() => res.status(500).json({ message: 'Transaction commit failed.', details: err }));
          }
          console.log('[SUCCESS] All returns processed and committed');
          res.json({ message: 'Product return processed successfully.' });
        });
      })
      .catch((err) => {
        console.log('[ERROR] Return failed:', err);
        connection.rollback(() => res.status(500).json({ message: 'Return failed. Please try again.', details: err }));
      });
  });
});

app.get('/customers', authenticateToken, validateStoreOwnership, (req, res) => {
  const storeId = req.user.storeId;

  const query = `
    SELECT 
      CustomerID,
      CustomerName,
      ContactInfo,
      CustomerCode,
      COALESCE(TotalUnpaid, 0) AS TotalUnpaid
    FROM customers
    WHERE StoreID = ?
    ORDER BY CustomerName
  `;

  db.query(query, [storeId], (err, results) => {
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
  const storeId = req.user.storeId;
  const customerId = req.params.customerId;

  const query = `
    SELECT 
      p.ProductName,
      ps.QuantitySold,
      ps.RemainingAmount
    FROM productsaleslog ps
    JOIN products p ON ps.ProductID = p.ProductID
    WHERE ps.CustomerID = ? AND ps.StoreID = ? AND ps.PaymentStatus IN ('Borrowed', 'Partial')
  `;

  db.query(query, [customerId, storeId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const formattedResults = results.map(product => ({
      name: product.ProductName,
      quantity: product.QuantitySold,
      remainingAmount: parseFloat(product.RemainingAmount) || 0,
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

app.post('/settle/:customerId', authenticateToken, validateStoreOwnership, (req, res) => {
  const customerId = req.params.customerId;
  const storeId = req.user.storeId;
  const { amountPaid, paymentMethod } = req.body;

  if (!amountPaid || isNaN(amountPaid) || amountPaid <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount' });
  }

  if (!paymentMethod || typeof paymentMethod !== 'string') {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  const getUnpaidQuery = `
    SELECT LogID, TotalAmount, RemainingAmount, PaymentStatus, ProductID 
    FROM productsaleslog 
    WHERE CustomerID = ? AND StoreID = ? AND PaymentStatus IN ('Borrowed', 'Partial')
    ORDER BY SaleDate ASC
  `;

  db.query(getUnpaidQuery, [customerId, storeId], (err, sales) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch sales.' });

    let remaining = amountPaid;
    const updates = [];

    for (let sale of sales) {
      if (remaining <= 0) break;

      const toPay = Math.min(sale.RemainingAmount, remaining);
      remaining -= toPay;

      const newRemaining = sale.RemainingAmount - toPay;
      const newStatus = newRemaining === 0 ? 'Paid' : 'Partial';

      updates.push([newRemaining, newStatus, paymentMethod, sale.LogID]);

      if (newStatus === 'Paid') {
        const getStockLogQuery = `
          SELECT LogID
          FROM stocklog 
          WHERE ProductID = ? AND StoreID = ? AND ChangeType = 'Borrowed' AND CustomerID = ?
        `;
        db.query(getStockLogQuery, [sale.ProductID, storeId, customerId], (err, stockEntries) => {
          if (err) return;

          stockEntries.forEach((entry) => {
            const updateStockLogQuery = `
              UPDATE stocklog 
              SET ChangeType = 'Sold' 
              WHERE LogID = ?
            `;
            db.query(updateStockLogQuery, [entry.LogID]);
          });
        });
      }
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'Nothing to update.', updatedUnpaid: 0 });
    }

    const updateSalesLogQuery = `
      UPDATE productsaleslog 
      SET RemainingAmount = ?, PaymentStatus = ?, PaymentMethod = ?
      WHERE LogID = ?
    `;

    const updateSalesPromises = updates.map(([rem, status, method, id]) =>
      new Promise((resolve, reject) => {
        db.query(updateSalesLogQuery, [rem, status, method, id], (err) => {
          if (err) return reject(err);
          resolve();
        });
      })
    );

    Promise.all(updateSalesPromises)
      .then(() => {
        const updateCustomerQuery = `
          UPDATE customers
          SET TotalUnpaid = (
            SELECT COALESCE(SUM(RemainingAmount), 0) 
            FROM productsaleslog 
            WHERE CustomerID = ? AND PaymentStatus IN ('Borrowed', 'Partial')
          )
          WHERE CustomerID = ?
        `;
        db.query(updateCustomerQuery, [customerId, customerId], (err) => {
          if (err) return res.status(500).json({ error: 'Failed to update customer balance' });

          db.query(`SELECT TotalUnpaid FROM customers WHERE CustomerID = ?`, [customerId], (err, result) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch updated unpaid' });

            res.json({
              success: true,
              message: 'Payment applied and stock updated.',
              updatedUnpaid: result[0].TotalUnpaid
            });
          });
        });
      })
      .catch(err => {
        res.status(500).json({ error: 'Failed to process settlement.' });
      });
  });
});

const lastEmittedAlerts = {};

app.get('/alerts', authenticateToken, validateStoreOwnership, (req, res) => {
  const storeId = req.user.storeId;

  const query = `
    SELECT 
      ProductID AS id,
      ProductName,
      ReorderLevel,
      QuantityInStock
    FROM Products
    WHERE StoreID = ? AND QuantityInStock <= ReorderLevel
  `;

  db.query(query, [storeId], (err, results) => {
    if (err) {
      console.error('Error fetching alerts:', err);
      return res.status(500).json({ error: 'Failed to fetch alerts' });
    }

    const formattedResults = results.map(result => {
      let actionMessage = '';

      if (result.QuantityInStock === 0) {
        actionMessage = 'Out of stock. Restock now.';
      } else if (result.QuantityInStock <= result.ReorderLevel / 2) {
        actionMessage = 'Very low stock. Restock soon.';
      } else if (result.QuantityInStock <= result.ReorderLevel) {
        actionMessage = 'Low stock. Consider restocking.';
      }

      return {
        id: result.id,
        productName: result.ProductName,
        reorderLevel: result.ReorderLevel,
        currentStock: result.QuantityInStock,
        action: actionMessage,
      };
    });

    console.log('Formatted Results:', formattedResults);

    if (formattedResults.length > 0) {
      if (!lastEmittedAlerts[storeId] || JSON.stringify(lastEmittedAlerts[storeId]) !== JSON.stringify(formattedResults)) {
        io.to(`store_${storeId}`).emit('low-inventory-alert', formattedResults);
        lastEmittedAlerts[storeId] = formattedResults;
      }
    }

    res.json(formattedResults);
  });
});

module.exports = server;  