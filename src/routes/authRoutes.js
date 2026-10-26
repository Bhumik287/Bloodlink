/**
 * Authentication REST API Routes
 * Course Reference: Unit-3 Express Routing & Unit-5 Security / Session Management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

// 1. POST /api/auth/register - Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, city, locality, role, bloodGroup, isAvailable, password, confirmPassword } = req.body;

    // Field Validations
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone number, and password are required.'
      });
    }

    // Password confirmation match validation
    if (confirmPassword !== undefined && confirmPassword !== null && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match. Please ensure Password and Confirm Password are identical.'
      });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address format.'
      });
    }

    if (!PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must be exactly 10 digits.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const assignedRole = role === 'donor' ? 'donor' : 'requester';
    const db = getDB();
    const usersCol = db.collection('users');

    // Check duplicate email
    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await usersCol.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    // Hash password with bcryptjs (Unit 5)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUserDoc = {
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      city: (city || '').trim(),
      locality: (locality || '').trim(),
      role: assignedRole,
      passwordHash: passwordHash,
      status: 'active',
      createdAt: new Date()
    };

    const insertResult = await usersCol.insertOne(newUserDoc);
    const userId = insertResult.insertedId;

    // If registered as donor, create donor profile record
    if (assignedRole === 'donor') {
      const donorProfilesCol = db.collection('donorProfiles');
      await donorProfilesCol.insertOne({
        userId: userId,
        bloodGroup: bloodGroup || 'O+',
        city: (city || '').trim(),
        locality: (locality || '').trim(),
        isAvailable: isAvailable !== false,
        contactPreference: 'phone',
        lastUpdated: new Date()
      });
    }

    // Set authenticated session
    const safeUser = {
      _id: userId.toString(),
      name: newUserDoc.name,
      email: newUserDoc.email,
      phone: newUserDoc.phone,
      city: newUserDoc.city,
      locality: newUserDoc.locality,
      role: newUserDoc.role
    };
    req.session.user = safeUser;

    res.status(201).json({
      success: true,
      message: 'Account successfully registered.',
      user: safeUser
    });
  } catch (error) {
    next(error);
  }
});

// 2. POST /api/auth/login - Authenticate user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const db = getDB();
    const usersCol = db.collection('users');
    const cleanEmail = email.trim().toLowerCase();

    const user = await usersCol.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This account has been temporarily suspended. Please contact administrator.'
      });
    }

    // Compare bcrypt password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Set session user
    const safeUser = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      city: user.city,
      locality: user.locality,
      role: user.role
    };
    req.session.user = safeUser;

    res.json({
      success: true,
      message: 'Login successful.',
      user: safeUser
    });
  } catch (error) {
    next(error);
  }
});

// 3. POST /api/auth/logout - Terminate session
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Could not log out at this moment.'
      });
    }
    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  });
});

// 4. GET /api/auth/me - Get current session user
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.session.user
  });
});

module.exports = router;
