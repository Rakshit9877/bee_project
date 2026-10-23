const crypto = require('node:crypto');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');
const { calculateTriageScore, SYMPTOM_WEIGHTS, VALID_FLAGS, DURATION_BONUSES } = require('../utils/triageCalculator');

// Helper to compute waiting queue positions and total waiting
const computePositions = async (entries) => {
  const waitingEntries = await QueueEntry.find({ status: 'waiting' })
    .sort({ triageScore: -1, registeredAt: 1, _id: 1 })
    .select('_id');

  const positionMap = new Map();
  waitingEntries.forEach((entry, idx) => {
    positionMap.set(entry._id.toString(), idx + 1);
  });

  const totalWaiting = waitingEntries.length;

  return entries.map(entry => {
    const json = entry.toJSON();
    if (json.status === 'waiting') {
      json.queuePosition = positionMap.get(json.id) || null;
    } else {
      json.queuePosition = null;
    }
    json.totalWaiting = totalWaiting;
    return json;
  });
};

// @desc    Get queue entries (all for staff, personal history for patient)
// @route   GET /api/queue
// @access  Private
const getQueue = async (req, res, next) => {
  try {
    let entries;
    if (req.user.role === 'staff') {
      entries = await QueueEntry.find()
        .populate('patientId', 'name username')
        .populate('servedBy', 'name username')
        .sort({ status: 1, triageScore: -1, registeredAt: 1, _id: 1 });
    } else {
      entries = await QueueEntry.find({ patientId: req.user._id })
        .populate('patientId', 'name username')
        .sort({ registeredAt: -1 });
    }

    const formattedEntries = await computePositions(entries);
    res.json({ entries: formattedEntries });
  } catch (error) {
    next(error);
  }
};

// @desc    Get queue entry by ticket (Public lookup)
// @route   GET /api/queue/ticket/:ticket
// @access  Public
const getEntryByTicket = async (req, res, next) => {
  try {
    const ticketParam = (req.params.ticket || '').trim().toUpperCase();
    if (!ticketParam.startsWith('TKT-')) {
      return res.status(400).json({ error: 'Invalid ticket format. Tickets begin with TKT-' });
    }

    const entry = await QueueEntry.findOne({ ticket: ticketParam })
      .populate('patientId', 'name username');

    if (!entry) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const [formatted] = await computePositions([entry]);

    // Return safe public fields
    res.json({
      entry: {
        id: formatted.id,
        patientName: formatted.patientName,
        ticket: formatted.ticket,
        triageScore: formatted.triageScore,
        registeredAt: formatted.registeredAt,
        status: formatted.status,
        servedAt: formatted.servedAt,
        queuePosition: formatted.queuePosition,
        totalWaiting: formatted.totalWaiting,
        attachment: formatted.attachment?.url ? formatted.attachment : null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single queue entry by ID
// @route   GET /api/queue/:id
// @access  Private
const getEntryById = async (req, res, next) => {
  try {
    const entry = await QueueEntry.findById(req.params.id)
      .populate('patientId', 'name username')
      .populate('servedBy', 'name username');

    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found.' });
    }

    if (req.user.role !== 'staff' && entry.patientId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You are not authorized to view this queue entry.' });
    }

    const [formatted] = await computePositions([entry]);
    res.json({ entry: formatted });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new queue check-in entry
// @route   POST /api/queue
// @access  Private (Patient only)
const createEntry = async (req, res, next) => {
  try {
    // Check if user already has an active waiting check-in
    const activeExisting = await QueueEntry.findOne({
      patientId: req.user._id,
      status: 'waiting'
    });

    if (activeExisting) {
      return res.status(409).json({
        error: 'You already have an active check-in. Please wait to be served or edit your existing request.'
      });
    }

    // Parse body fields (in case sent as multipart/form-data with file)
    let { symptoms, severity, duration, additionalInfo = '', vitalFlags = [] } = req.body;

    if (typeof symptoms === 'string') {
      try { symptoms = JSON.parse(symptoms); } catch { symptoms = [symptoms]; }
    }
    if (typeof vitalFlags === 'string') {
      try { vitalFlags = JSON.parse(vitalFlags); } catch { vitalFlags = [vitalFlags]; }
    }
    severity = Number(severity);

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ error: 'Please select at least one symptom.' });
    }
    if (!Number.isInteger(severity) || severity < 1 || severity > 10) {
      return res.status(400).json({ error: 'Severity must be an integer between 1 and 10.' });
    }
    if (!DURATION_BONUSES[duration]) {
      return res.status(400).json({ error: 'Please select a valid symptom duration.' });
    }

    const triageScore = calculateTriageScore({
      symptoms,
      severity,
      duration,
      additionalInfo,
      vitalFlags
    });

    // Generate ticket e.g. TKT-7482 or TKT-A3B91C2F
    const ticketRandom = crypto.randomBytes(4).toString('hex').toUpperCase();
    const ticket = `TKT-${ticketRandom}`;

    // Handle optional Multer attachment
    let attachment = null;
    if (req.file) {
      attachment = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`
      };
    }

    const newEntry = await QueueEntry.create({
      patientId: req.user._id,
      symptoms,
      severity,
      duration,
      additionalInfo: (additionalInfo || '').trim(),
      vitalFlags: Array.isArray(vitalFlags) ? vitalFlags : [],
      triageScore,
      ticket,
      attachment: attachment || undefined
    });

    // Increment user total requests
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalRequests: 1 } });

    await newEntry.populate('patientId', 'name username');
    const [formatted] = await computePositions([newEntry]);

    res.status(201).json({ entry: formatted });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a waiting queue check-in
// @route   PUT /api/queue/:id
// @access  Private (Owning patient)
const updateEntry = async (req, res, next) => {
  try {
    const entry = await QueueEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found.' });
    }

    if (entry.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You are not authorized to edit this request.' });
    }

    if (entry.status !== 'waiting') {
      return res.status(409).json({ error: 'Cannot update a request that has already been served.' });
    }

    let { symptoms, severity, duration, additionalInfo = '', vitalFlags = [] } = req.body;
    if (typeof symptoms === 'string') {
      try { symptoms = JSON.parse(symptoms); } catch { symptoms = [symptoms]; }
    }
    if (typeof vitalFlags === 'string') {
      try { vitalFlags = JSON.parse(vitalFlags); } catch { vitalFlags = [vitalFlags]; }
    }
    severity = Number(severity);

    const triageScore = calculateTriageScore({
      symptoms,
      severity,
      duration,
      additionalInfo,
      vitalFlags
    });

    entry.symptoms = symptoms;
    entry.severity = severity;
    entry.duration = duration;
    entry.additionalInfo = (additionalInfo || '').trim();
    entry.vitalFlags = Array.isArray(vitalFlags) ? vitalFlags : [];
    entry.triageScore = triageScore;

    if (req.file) {
      entry.attachment = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`
      };
    }

    await entry.save();
    await entry.populate('patientId', 'name username');
    const [formatted] = await computePositions([entry]);

    res.json({ entry: formatted });
  } catch (error) {
    next(error);
  }
};

// @desc    Emergency priority override
// @route   PATCH /api/queue/:id/priority
// @access  Private (Staff only)
const overridePriority = async (req, res, next) => {
  try {
    const entry = await QueueEntry.findOne({ _id: req.params.id, status: 'waiting' });
    if (!entry) {
      return res.status(404).json({ error: 'Waiting queue entry not found.' });
    }

    entry.triageScore = 100.0;
    await entry.save();

    await entry.populate('patientId', 'name username');
    const [formatted] = await computePositions([entry]);

    res.json({ entry: formatted });
  } catch (error) {
    next(error);
  }
};

// @desc    Call next highest-priority waiting patient
// @route   POST /api/queue/call-next
// @access  Private (Staff only)
const callNext = async (req, res, next) => {
  try {
    const nextEntry = await QueueEntry.findOne({ status: 'waiting' })
      .sort({ triageScore: -1, registeredAt: 1, _id: 1 })
      .populate('patientId', 'name username');

    if (!nextEntry) {
      return res.status(404).json({ error: 'There are currently no patients waiting in the queue.' });
    }

    nextEntry.status = 'served';
    nextEntry.servedAt = new Date();
    nextEntry.servedBy = req.user._id;
    await nextEntry.save();

    // Increment staff totalServed
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalServed: 1 } });

    await nextEntry.populate('servedBy', 'name username');
    const json = nextEntry.toJSON();
    json.queuePosition = null;

    res.json({ entry: json });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel/Delete a queue entry
// @route   DELETE /api/queue/:id
// @access  Private (Staff or owning patient)
const cancelEntry = async (req, res, next) => {
  try {
    const entry = await QueueEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found.' });
    }

    if (req.user.role !== 'staff' && (entry.patientId.toString() !== req.user._id.toString() || entry.status !== 'waiting')) {
      return res.status(403).json({ error: 'You can only cancel your own waiting check-in.' });
    }

    await QueueEntry.findByIdAndDelete(entry._id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQueue,
  getEntryByTicket,
  getEntryById,
  createEntry,
  updateEntry,
  overridePriority,
  callNext,
  cancelEntry
};
