const mongoose = require('mongoose');

const queueEntrySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    symptoms: {
      type: [String],
      required: true,
      validate: [val => val.length > 0, 'Select at least one symptom']
    },
    severity: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    duration: {
      type: String,
      required: true,
      enum: ['lt1h', '1to6h', '6to24h', 'gt24h']
    },
    additionalInfo: {
      type: String,
      default: '',
      maxlength: 1000
    },
    vitalFlags: {
      type: [String],
      default: []
    },
    triageScore: {
      type: Number,
      required: true
    },
    ticket: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    status: {
      type: String,
      enum: ['waiting', 'served'],
      default: 'waiting',
      index: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    servedAt: {
      type: Date,
      default: null
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    attachment: {
      filename: { type: String, default: null },
      originalname: { type: String, default: null },
      mimetype: { type: String, default: null },
      size: { type: Number, default: 0 },
      url: { type: String, default: null }
    }
  },
  {
    timestamps: true
  }
);

// Compound index for queue priority ordering
queueEntrySchema.index({ status: 1, triageScore: -1, registeredAt: 1 });

// Helper to format output
queueEntrySchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  if (obj.patientId && typeof obj.patientId === 'object') {
    obj.patientName = obj.patientId.name;
    obj.username = obj.patientId.username;
    obj.patientId = obj.patientId._id.toString();
  }
  if (obj.servedBy && typeof obj.servedBy === 'object') {
    obj.servedByName = obj.servedBy.name;
    obj.servedBy = obj.servedBy._id.toString();
  }
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('QueueEntry', queueEntrySchema);
