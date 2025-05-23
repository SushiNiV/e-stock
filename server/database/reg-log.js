require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
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
  database: process.env.DB_NAME
});

const dbPromise = db.promise();

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  } else {
    console.log('Connected to MySQL database (reg-log)');
  }
});

//for auth
function authenticateToken(req, res, next) {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

app.get('/me', authenticateToken, async (req, res) => {
  const user = req.user;

  try {
    const [store] = await dbPromise.execute(
      `SELECT StoreCode FROM store WHERE StoreID = ?`, 
      [user.storeId]
    );

    if (store.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      storeId: user.storeId,
      storeCode: store[0].StoreCode,
    });
  } catch (err) {
    console.error('Error fetching user and store info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//for admin
function requireAdmin(req, res, next) {
  if (!['Admin', 'Owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admins or Owners only.' });
  }
  next();
}

app.post('/register', async (req, res) => {
  const { username, password, role, firstName, lastName, email } = req.body;
  
  try {
    if (!username || !password || !firstName || !lastName || !role || !email) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (!['Owner', 'Admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Only "Owner" or "Admin" are allowed.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const [existingUser] = await dbPromise.query('SELECT * FROM users WHERE Username = ? OR Email = ?', [username, email]);

    if (existingUser.length > 0) {
      if (existingUser[0].IsRegister === false) {
        await dbPromise.query('DELETE FROM users WHERE Username = ? OR Email = ?', [username, email]);
        console.log(`Deleted incomplete registration for username: ${username}, email: ${email}`);
      } else {
        return res.status(400).json({ error: 'Username or email already in use by a registered user.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCode = `U${Math.floor(10000 + Math.random() * 90000)}`;
    
    const insertQuery = `
      INSERT INTO users (UserCode, Username, PasswordHash, Role, FirstName, LastName, Email, IsRegister)
      VALUES (?, ?, ?, ?, ?, ?, ?, false)
    `;
    const result = await dbPromise.query(insertQuery, [userCode, username, hashedPassword, role, firstName, lastName, email]);

    const userPayload = {
      UserID: result.insertId,
      UserCode: userCode,
      Username: username,
      Role: role,
      FirstName: firstName,
      LastName: lastName,
      Email: email
    };

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ message: 'User registered successfully. Please complete the registration process.', token });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const [results] = await dbPromise.query('SELECT * FROM users WHERE Username = ?', [username]);

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const user = results[0];

    if (user.IsRegister !== 1) {
      return res.status(401).json({ error: 'User not registered. Please complete your registration.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    const payload = {
      id: user.UserID,
      username: user.Username,
      firstName: user.FirstName,
      lastName: user.LastName,
      role: user.Role,
      storeId: user.StoreID,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful.',
      token,
      username: user.Username,
      firstName: user.FirstName,
      lastName: user.LastName,
      role: user.Role,
      storeId: user.StoreID,
      profilePic: user.ProfilePic,
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

//admin routes
app.use('/admin', authenticateToken);

module.exports = app;