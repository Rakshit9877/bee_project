const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, regenerateAccessCode } = require('../controllers/userController');
const { protect, requireRole } = require('../middleware/authMiddleware');

router.get('/me', protect, getProfile);
router.patch('/me', protect, updateProfile);
router.post('/me/access-code', protect, requireRole('staff'), regenerateAccessCode);

module.exports = router;
