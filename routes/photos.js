const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const exifr = require('exifr');
const { randomUUID } = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const Photo = require('../models/Photo');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILENAME_DATE_RE = /^(\d{4})(\d{2})(\d{2})_\d{6}/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 30 }
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

async function detectDate(buffer, originalName, mtime) {
  try {
    const exif = await exifr.parse(buffer, ['DateTimeOriginal']);
    if (exif && exif.DateTimeOriginal instanceof Date && !isNaN(exif.DateTimeOriginal)) {
      const d = exif.DateTimeOriginal;
      return { date: formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate()), source: 'exif' };
    }
  } catch (e) {
    // Photo sans EXIF lisible (ex: image repassée par WhatsApp) — on retente avec les repli suivants.
  }

  const match = FILENAME_DATE_RE.exec(originalName || '');
  if (match) {
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    if (DATE_RE.test(date)) return { date, source: 'filename' };
  }

  const d = new Date(mtime);
  return { date: formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate()), source: 'mtime' };
}

router.get('/', async (req, res) => {
  const { date } = req.query;
  if (date && !DATE_RE.test(date)) return res.status(400).json({ error: 'Format de date invalide' });

  const filter = date ? { date } : {};
  const photos = await Photo.find(filter).select('date url originalName').lean();
  res.json(photos);
});

// Chaque fichier "photos" doit être accompagné d'un champ "mtimes" au même index
// (FormData ne transporte pas la date de dernière modification d'un File automatiquement).
router.post('/batch', upload.array('photos', 30), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Aucune photo reçue' });
  }
  const mtimes = [].concat(req.body.mtimes || []);
  const results = [];

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    try {
      const { date, source } = await detectDate(file.buffer, file.originalname, Number(mtimes[i]) || Date.now());

      const processed = await sharp(file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();

      const key = `photos/${date}/${randomUUID()}.jpg`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: processed,
        ContentType: 'image/jpeg'
      }));

      const url = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
      await Photo.create({ date, key, url, originalName: file.originalname, dateSource: source });

      results.push({ originalName: file.originalname, date, url });
    } catch (e) {
      results.push({ originalName: file.originalname, error: "Échec de l'import de cette photo" });
    }
  }

  res.status(201).json({ results });
});

router.delete('/:id', async (req, res) => {
  const photo = await Photo.findById(req.params.id).catch(() => null);
  if (!photo) return res.status(404).json({ error: 'Photo introuvable' });

  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: photo.key }));
  await Photo.deleteOne({ _id: photo._id });
  res.status(204).end();
});

router.patch('/:id', async (req, res) => {
  const date = req.body && req.body.date;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Format de date invalide' });

  const photo = await Photo.findByIdAndUpdate(req.params.id, { date }, { new: true }).catch(() => null);
  if (!photo) return res.status(404).json({ error: 'Photo introuvable' });

  res.json({ _id: photo._id, date: photo.date, url: photo.url });
});

module.exports = router;
