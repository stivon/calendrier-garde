const express = require('express');
const router = express.Router();
const CustodyDay = require('../models/CustodyDay');
const CustodyNote = require('../models/CustodyNote');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = ['evening', 'day', 'full'];

// --- Jours de garde ---

router.get('/days', async (req, res) => {
  const days = await CustodyDay.find().select('date source type -_id').lean();
  res.json(days);
});

router.post('/days/:date', async (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Format de date invalide' });

  const requestedType = req.body && req.body.type;
  if (requestedType && !VALID_TYPES.includes(requestedType)) {
    return res.status(400).json({ error: 'Type de garde invalide' });
  }
  const type = requestedType || 'day';

  const day = await CustodyDay.findOneAndUpdate(
    { date },
    { date, type, source: 'manual' },
    { upsert: true, new: true }
  );
  res.status(201).json({ date: day.date, source: day.source, type: day.type });
});

router.delete('/days/:date', async (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Format de date invalide' });

  await CustodyDay.deleteOne({ date });
  res.status(204).end();
});

// --- Notes ---

router.get('/notes', async (req, res) => {
  const notes = await CustodyNote.find().select('date text -_id').lean();
  res.json(notes);
});

router.post('/notes/:date', async (req, res) => {
  const { date } = req.params;
  const text = (req.body && req.body.text) || '';
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Format de date invalide' });

  if (!text.trim()) {
    await CustodyNote.deleteOne({ date });
    return res.status(204).end();
  }

  const note = await CustodyNote.findOneAndUpdate(
    { date },
    { date, text: text.trim() },
    { upsert: true, new: true }
  );
  res.status(200).json({ date: note.date, text: note.text });
});

router.delete('/notes/:date', async (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Format de date invalide' });

  await CustodyNote.deleteOne({ date });
  res.status(204).end();
});

module.exports = router;
