const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @desc    Get user profile
// @route   GET /api/users/me
// @access  Private
const getProfile = async (req, res) => {
  res.json({ user: req.user.toJSON() });
};

// @desc    Update user profile name
// @route   PATCH /api/users/me
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }

    req.user.name = name.trim();
    await req.user.save();

    res.json({ user: req.user.toJSON() });
  } catch (error) {
    next(error);
  }
};

// @desc    Rotate/Regenerate staff access code
// @route   POST /api/users/me/access-code
// @access  Private (Staff only)
const regenerateAccessCode = async (req, res, next) => {
  try {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rawCode = '';
    for (let i = 0; i < 6; i++) {
      rawCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const salt = await bcrypt.genSalt(10);
    req.user.accessCode = await bcrypt.hash(rawCode, salt);
    await req.user.save();

    res.json({ accessCode: rawCode });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  regenerateAccessCode
};
