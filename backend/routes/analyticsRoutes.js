const express = require('express');
const router = express.Router();
const { getQueueAnalytics } = require('../controllers/analyticsController');
const { protect, requireRole } = require('../middleware/authMiddleware');

router.get('/', protect, requireRole('staff'), getQueueAnalytics);

module.exports = router;
