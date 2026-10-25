const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => {
  const secret = process.env.JWT_SECRET || 'medqueue_super_secret_jwt_key_2026_at_least_32_characters';
  return jwt.sign({ id, role }, secret, { expiresIn: '12h' });
};

// @desc    Register a new user (Patient or Staff)
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res, next) => {
  try {
    const { name, username, password, role = 'patient', staffInviteCode } = req.body || {};

    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }
    if (!username || !/^[a-zA-Z0-9_.\-@]{3,50}$/.test(username.trim())) {
      return res.status(400).json({ error: 'Username must be 3-50 characters (letters, numbers, @, dots, dashes, underscores).' });
    }
    if (!password || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
    }
    if (!['patient', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "patient" or "staff".' });
    }

    // Optional staff invitation code check
    if (role === 'staff' && process.env.STAFF_INVITE_CODE) {
      if (staffInviteCode !== process.env.STAFF_INVITE_CODE) {
        return res.status(403).json({ error: 'A valid staff invitation code is required.' });
      }
    }

    const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate staff access code if staff role
    let rawAccessCode = null;
    let hashedAccessCode = null;
    if (role === 'staff') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      rawAccessCode = '';
      for (let i = 0; i < 6; i++) {
        rawAccessCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      hashedAccessCode = await bcrypt.hash(rawAccessCode, salt);
    }

    const user = await User.create({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password: hashedPassword,
      role,
      accessCode: hashedAccessCode
    });

    const token = generateToken(user._id, user.role);
    const userResponse = user.toJSON();
    if (rawAccessCode) {
      userResponse.accessCode = rawAccessCode;
    }

    res.status(201).json({
      user: userResponse,
      token
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { username, password, accessCode } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (user.role === 'staff') {
      if (!accessCode || !(await user.matchAccessCode(accessCode))) {
        return res.status(401).json({ error: 'Invalid staff access code. Staff accounts require a valid access code.' });
      }
    }

    const token = generateToken(user._id, user.role);

    res.json({
      user: user.toJSON(),
      token
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get currently logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.json({ user: req.user.toJSON() });
};

module.exports = { signup, login, getMe };
