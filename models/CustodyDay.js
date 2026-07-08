const mongoose = require('mongoose');

const custodyDaySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  source: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'manual'
  },
  type: {
    type: String,
    enum: ['evening', 'day', 'full'],
    default: 'day'
  }
});

module.exports = mongoose.model('CustodyDay', custodyDaySchema, 'custody_days');
