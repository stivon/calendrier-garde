const mongoose = require('mongoose');

const custodyNoteSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  text: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('CustodyNote', custodyNoteSchema, 'custody_notes');
