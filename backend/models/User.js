const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    username: {
      type: String,
      required: [true, 'Please provide a username'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9_.-]{3,30}$/, 'Username must be 3-30 characters (letters, numbers, dots, dashes, underscores)']
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    role: {
      type: String,
      enum: ['patient', 'staff'],
      default: 'patient'
    },
    accessCode: {
      type: String,
      default: null
    },
    totalRequests: {
      type: Number,
      default: 0
    },
    totalServed: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Method to verify password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to verify staff access code
userSchema.methods.matchAccessCode = async function (enteredCode) {
  if (!this.accessCode || !enteredCode) return false;
  return await bcrypt.compare(enteredCode.toUpperCase(), this.accessCode);
};

// Transform output to strip sensitive fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.password;
  delete obj.accessCode;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
