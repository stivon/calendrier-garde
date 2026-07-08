require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');
const CustodyDay = require('./models/CustodyDay');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

const INITIAL_CUSTODY_DAYS = [
  "2024-11-02","2024-11-06","2024-11-08","2024-11-12","2024-11-13","2024-11-14","2024-11-26",
  "2024-12-05","2024-12-14","2024-12-25",
  "2025-01-24",
  "2025-02-06","2025-02-10","2025-02-18","2025-02-21","2025-02-27",
  "2025-03-03","2025-03-06","2025-03-07","2025-03-18","2025-03-20","2025-03-22",
  "2025-04-01","2025-04-12",
  "2025-05-17","2025-05-18","2025-05-29",
  "2025-06-03","2025-06-04","2025-06-07","2025-06-15","2025-06-24","2025-06-28",
  "2025-07-10","2025-07-11","2025-07-12","2025-07-13","2025-07-14","2025-07-19","2025-07-20","2025-07-23","2025-07-26","2025-07-27",
  "2025-08-11","2025-08-16","2025-08-22","2025-08-26","2025-08-28","2025-08-31",
  "2025-09-02","2025-09-06","2025-09-09","2025-09-14","2025-09-16","2025-09-19","2025-09-20","2025-09-21","2025-09-25","2025-09-28","2025-09-30",
  "2025-10-11","2025-10-23","2025-10-24","2025-10-26",
  "2025-11-01","2025-11-09","2025-11-21","2025-11-26","2025-11-29",
  "2025-12-06","2025-12-07","2025-12-12","2025-12-17",
  "2026-01-02","2026-01-09","2026-01-10","2026-01-16","2026-01-17","2026-01-18","2026-01-22","2026-01-25","2026-01-31",
  "2026-02-22","2026-02-23","2026-02-24","2026-02-25","2026-02-26","2026-02-27","2026-02-28",
  "2026-03-01","2026-03-10","2026-03-13","2026-03-14","2026-03-15","2026-03-16","2026-03-19","2026-03-22","2026-03-24","2026-03-27","2026-03-28","2026-03-30",
  "2026-04-03","2026-04-04","2026-04-05","2026-04-07","2026-04-11","2026-04-14","2026-04-21","2026-04-23","2026-04-24","2026-04-25","2026-04-26","2026-04-27","2026-04-28","2026-04-29","2026-04-30",
  "2026-05-01","2026-05-05","2026-05-06","2026-05-08","2026-05-09","2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15","2026-05-16","2026-05-17","2026-05-18","2026-05-21","2026-05-22","2026-05-23","2026-05-24","2026-05-26","2026-05-30",
  "2026-06-02","2026-06-05","2026-06-07","2026-06-09","2026-06-12","2026-06-13","2026-06-14","2026-06-15","2026-06-18","2026-06-20","2026-06-23","2026-06-28","2026-06-30"
];

function isTuesday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 2;
}

async function seedCustodyDays() {
  const count = await CustodyDay.countDocuments();
  if (count === 0) {
    await CustodyDay.insertMany(
      INITIAL_CUSTODY_DAYS.map((date) => ({
        date,
        source: 'auto',
        type: isTuesday(date) ? 'evening' : 'day'
      }))
    );
    console.log(`Initialisation : ${INITIAL_CUSTODY_DAYS.length} jours de garde insérés.`);
    return;
  }

  // Backfill : assigne un type aux jours auto déjà seedés avant l'introduction du champ "type".
  const tuesdays = INITIAL_CUSTODY_DAYS.filter(isTuesday);
  const eveningResult = await CustodyDay.updateMany(
    { date: { $in: tuesdays }, source: 'auto', type: { $ne: 'evening' } },
    { $set: { type: 'evening' } }
  );
  const dayResult = await CustodyDay.updateMany(
    { source: 'auto', type: { $exists: false } },
    { $set: { type: 'day' } }
  );
  const migrated = eveningResult.modifiedCount + dayResult.modifiedCount;
  if (migrated > 0) {
    console.log(`Migration : ${migrated} jour(s) auto mis à jour avec un type.`);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);

async function start() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI manquant : définissez-la dans .env (local) ou dans les variables d'environnement du service Cloud Run.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log('Connecté à MongoDB Atlas.');
  await seedCustodyDays();
  app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
}

start().catch((err) => {
  console.error('Échec du démarrage du serveur :', err.message);
  process.exit(1);
});
