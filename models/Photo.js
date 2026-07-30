const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  url: {
    type: String,
    required: true
  },
  originalName: String,
  dateSource: {
    type: String,
    enum: ['exif', 'filename', 'mtime'],
    required: true
  },
  hash: {
    type: String,
    index: true,
    unique: true,
    sparse: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Photo', photoSchema, 'photos');
