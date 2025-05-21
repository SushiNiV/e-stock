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
  console.log('Connected to MySQL database (Dashboard Service)');
});

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];

  console.log('Received token:', token);

  if (!token) {
    return res.status(401).json({ message: 'Access denied: No token provided' });
  }

  const tokenWithoutBearer = token.split(' ')[1];

  if (!tokenWithoutBearer) {
    return res.status(400).json({ message: 'Invalid token format' });
  }

  jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err); 
      return res.status(403).json({ message: 'Invalid token' });
    }

    if (!decoded.storeId) {
      return res.status(400).json({ message: 'Store ID is missing from token' });
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

app.get('/sales-totals', authenticateToken, async (req, res) => {
  const storeId = req.user.storeId;
  const selectedMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;  // Default to current month if not provided

  try {
    const [todayResult] = await db.promise().query(
      `SELECT 
         SUM(TotalAmount) AS totalSalesToday,
         SUM(QuantitySold) AS totalQuantitySoldToday
       FROM productsaleslog 
       WHERE StoreID = ? AND DATE(SaleDate) = CURDATE()`,
      [storeId]
    );
    console.log('Today Result:', todayResult);

    const [weekResult] = await db.promise().query(
      `SELECT 
         DAYOFWEEK(SaleDate) AS dayOfWeek,
         SUM(TotalAmount) AS totalSalesThisWeek
       FROM productsaleslog
       WHERE StoreID = ? AND YEARWEEK(SaleDate, 1) = YEARWEEK(CURDATE(), 1)
       GROUP BY DAYOFWEEK(SaleDate)
       ORDER BY DAYOFWEEK(SaleDate)`,
      [storeId]
    );

    const [lastWeekResult] = await db.promise().query(
      `SELECT 
        SUM(TotalAmount) AS totalSalesLastWeek
      FROM productsaleslog
      WHERE StoreID = ? 
        AND YEARWEEK(SaleDate, 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1)`,
      [storeId]
    );

    const [monthResult] = await db.promise().query(
      `SELECT 
         MONTH(SaleDate) AS month,
         SUM(TotalAmount) AS totalSalesThisMonth
       FROM productsaleslog
       WHERE StoreID = ? AND MONTH(SaleDate) = ?
       GROUP BY MONTH(SaleDate)`,
      [storeId, selectedMonth]
    );

    const [dailyResult] = await db.promise().query(
      `SELECT 
         DAY(SaleDate) AS day, 
         SUM(TotalAmount) AS totalSales
       FROM productsaleslog
       WHERE StoreID = ? AND MONTH(SaleDate) = ? 
       GROUP BY DAY(SaleDate)
       ORDER BY day`,
      [storeId, selectedMonth]
    );

    const [lowStockProducts] = await db.promise().query(
      `SELECT 
         ProductID, 
         ProductName, 
         QuantityInStock, 
         ReorderLevel
       FROM products
       WHERE StoreID = ? AND QuantityInStock <= ReorderLevel`,
      [storeId]
    );

    const [categoryCount] = await db.promise().query(
      `SELECT COUNT(*) AS totalCategories FROM categories WHERE StoreID = ?`,
      [storeId]
    );

    const [productCount] = await db.promise().query(
      `SELECT COUNT(*) AS totalProducts FROM products WHERE StoreID = ?`,
      [storeId]
    );

    res.json({
      totalSalesToday: todayResult[0]?.totalSalesToday || 0,
      totalQuantitySoldToday: todayResult[0]?.totalQuantitySoldToday || 0,
      totalSalesThisWeek: weekResult.map(item => item.totalSalesThisWeek).reduce((a, b) => a + b, 0),
      totalSalesThisMonth: monthResult.map(item => item.totalSalesThisMonth).reduce((a, b) => a + b, 0),
      dailyData: dailyResult,
      weeklyData: weekResult,
      lastWeekSales: lastWeekResult[0]?.totalSalesLastWeek || 0,
      monthlyData: monthResult,
      totalCategories: categoryCount[0]?.totalCategories || 0,
      totalProducts: productCount[0]?.totalProducts || 0,
      lowStockProducts: lowStockProducts,
    });
  } catch (err) {
    console.error('Error fetching sales data:', err);
    res.status(500).json({ error: 'Failed to fetch sales totals' });
  }
});

app.get('/sales-totals/monthly', authenticateToken, async (req, res) => {
  const storeId = req.user.storeId;
  const selectedYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

  try {
    const [monthlySales] = await db.promise().query(
      `SELECT 
         MONTH(SaleDate) AS month,
         SUM(TotalAmount) AS totalSalesThisMonth
       FROM productsaleslog
       WHERE StoreID = ? AND YEAR(SaleDate) = ?
       GROUP BY MONTH(SaleDate)
       ORDER BY MONTH(SaleDate)`,
      [storeId, selectedYear]
    );

    res.json(monthlySales);
  } catch (err) {
    console.error('Error fetching all monthly sales:', err);
    res.status(500).json({ error: 'Failed to fetch monthly sales data' });
  }
});

const path = require('path');const uploadsPath = path.join(__dirname, 'uploads');
console.log('Serving static uploadfiles from:', uploadsPath);
app.use('/uploads', express.static(uploadsPath));

app.get('/top-products-of-the-month', authenticateToken, async (req, res) => {
  const storeId = req.user.storeId;

  try {
    const [topProducts] = await db.promise().query(
      `SELECT 
         p.ProductID,
         p.ProductName AS name,
         p.ProductImage AS image,
         SUM(psl.QuantitySold) AS totalSold,
         CAST(SUM(psl.TotalAmount) AS DECIMAL(10,2)) AS sales
       FROM productsaleslog psl
       JOIN products p ON psl.ProductID = p.ProductID
       WHERE psl.StoreID = ? AND MONTH(psl.SaleDate) = MONTH(CURDATE())
       GROUP BY psl.ProductID
       ORDER BY totalSold DESC
       LIMIT 5`,
      [storeId]
    );

    const [totalQuantityRow] = await db.promise().query(
      `SELECT SUM(QuantitySold) AS totalQuantity
       FROM productsaleslog
       WHERE StoreID = ? AND MONTH(SaleDate) = MONTH(CURDATE())`,
      [storeId]
    );

    const totalQuantity = totalQuantityRow[0]?.totalQuantity || 0;

    const formattedProducts = topProducts.map(product => ({
      ...product,
      image: product.image
        ? `http://localhost:3004/uploads/${product.image}`
        : 'http://localhost:3004/uploads/default.jpg',
    }));

    res.json({
      topProducts: formattedProducts,
      totalQuantitySold: totalQuantity
    });
  } catch (err) {
    console.error('Error fetching top products:', err);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

app.get('/customers-with-balances', authenticateToken, async (req, res) => {
  const storeId = req.user.storeId;

  try {
    const [customersWithBalance] = await db.promise().query(
      `SELECT 
         CustomerID, 
         CustomerName, 
         TotalUnpaid AS outstandingBalance
       FROM customers
       WHERE StoreID = ? AND TotalUnpaid > 0`,
      [storeId]
    );

    if (customersWithBalance.length === 0) {
      return res.json({ message: 'No customer with balance' });
    }

    res.json(customersWithBalance);
  } catch (err) {
    console.error('Error fetching customers with balances:', err);
    res.status(500).json({ error: 'Failed to fetch customers with balances' });
  }
});

app.get('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;

  console.log('Received request to /profile');
  console.log('Authenticated user ID:', userId);

  const query = `
    SELECT u.UserID, u.Username, u.ProfilePic, u.FirstName, u.LastName, u.Role, u.Email, u.ContactNumber, u.UserCode, u.PasswordHash, u.StoreID,
          s.StoreName, s.StoreAddress, s.StoreCode
    FROM users u
    LEFT JOIN store s ON u.StoreID = s.StoreID
    WHERE u.UserID = ?`;

  console.log('Running query:', query);

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ message: 'Error fetching profile. Please try again later.' });
    }

    console.log('Query results:', results);

    if (results.length === 0) {
      console.log('No user found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const user = results[0];
    console.log('User data fetched:', user);

    res.json({
      userId: user.UserID,
      username: user.Username,
      firstName: user.FirstName,
      lastName: user.LastName,
      role: user.Role,
      email: user.Email,
      contactNumber: user.ContactNumber,
      userCode: user.UserCode,
      profilePic: user.ProfilePic,
      storeId: user.StoreID,
      storeName: user.StoreName || null,
      storeAddress: user.StoreAddress || null,
      storeCode: user.StoreCode || null
    });
  });
});

module.exports = app;