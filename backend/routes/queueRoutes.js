const express = require('express');
const router = express.Router();
const {
  getQueue,
  getEntryByTicket,
  getEntryById,
  createEntry,
  updateEntry,
  overridePriority,
  callNext,
  cancelEntry
} = require('../controllers/queueController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { ticketLookupLimiter } = require('../middleware/rateLimiter');

// Public ticket tracking
router.get('/ticket/:ticket', ticketLookupLimiter, getEntryByTicket);

// Private routes
router.get('/', protect, getQueue);
router.post('/', protect, requireRole('patient'), upload.single('attachment'), createEntry);
router.post('/call-next', protect, requireRole('staff'), callNext);

router.get('/:id', protect, getEntryById);
router.put('/:id', protect, requireRole('patient'), upload.single('attachment'), updateEntry);
router.patch('/:id/priority', protect, requireRole('staff'), overridePriority);
router.delete('/:id', protect, cancelEntry);

module.exports = router;
