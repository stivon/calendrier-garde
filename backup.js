require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const CustodyDay = require('./models/CustodyDay');
const CustodyNote = require('./models/CustodyNote');

async function backup() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB Atlas.');

  const days = await CustodyDay.find().select('date source type -_id').lean();
  const notes = await CustodyNote.find().select('date text -_id').lean();

  const dir = path.join(__dirname, 'backup');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const date = new Date().toISOString().slice(0, 10);
  const daysFile = path.join(dir, `days-${date}.json`);
  const notesFile = path.join(dir, `notes-${date}.json`);

  fs.writeFileSync(daysFile, JSON.stringify(days, null, 2));
  fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));

  console.log(`✓ ${days.length} jours exportés  → backup/days-${date}.json`);
  console.log(`✓ ${notes.length} notes exportées → backup/notes-${date}.json`);

  await mongoose.disconnect();
}

backup().catch(err => { console.error('Erreur :', err.message); process.exit(1); });
