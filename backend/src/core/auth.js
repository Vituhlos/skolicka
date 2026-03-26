import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

function getJwtSecret() {
  return process.env.JWT_SECRET || 'skolicka-default-secret-change-in-production';
}

function getParentPinHash() {
  return process.env.PARENT_PIN_HASH || null;
}

// POST /api/auth/verify-pin
router.post('/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN musí být 4místné číslo.' });
    }

    const pinHash = getParentPinHash();

    // If no PIN is set, allow any 4-digit PIN and set it
    if (!pinHash) {
      const newHash = await bcrypt.hash(pin, 10);
      process.env.PARENT_PIN_HASH = newHash;
      const token = jwt.sign({ role: 'parent' }, getJwtSecret(), { expiresIn: '30m' });
      return res.json({ token, message: 'PIN nastaven a ověřen.' });
    }

    const valid = await bcrypt.compare(pin, pinHash);
    if (!valid) {
      return res.status(401).json({ error: 'Nesprávný PIN.' });
    }

    const token = jwt.sign({ role: 'parent' }, getJwtSecret(), { expiresIn: '30m' });
    res.json({ token });
  } catch (err) {
    console.error('verify-pin error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/auth/change-pin
router.post('/change-pin', requirePin, async (req, res) => {
  try {
    const { new_pin } = req.body;
    if (!new_pin || !/^\d{4}$/.test(new_pin)) {
      return res.status(400).json({ error: 'Nový PIN musí být 4místné číslo.' });
    }

    const newHash = await bcrypt.hash(new_pin, 10);
    process.env.PARENT_PIN_HASH = newHash;

    // Try to persist to .env file if it exists
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('PARENT_PIN_HASH=')) {
        envContent = envContent.replace(/PARENT_PIN_HASH=.*/g, `PARENT_PIN_HASH=${newHash}`);
      } else {
        envContent += `\nPARENT_PIN_HASH=${newHash}`;
      }
      fs.writeFileSync(envPath, envContent);
    }

    res.json({ message: 'PIN byl úspěšně změněn.' });
  } catch (err) {
    console.error('change-pin error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

export function requirePin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chybí autorizační token.' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Neplatný nebo vypršelý token.' });
  }
}

export default router;
