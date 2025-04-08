const mongoose = require('mongoose');

// Define User Schema
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: Date
});

// Create model
const User = mongoose.model('User', UserSchema);


module.exports = User;