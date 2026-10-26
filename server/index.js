require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const db = require('./database');

const app = express();
const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
const jwtSecret = process.env.JWT_SECRET;

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be a valid TCP port number.');
}
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

const symptomWeights = {
  chestPain: 9, breathingDifficulty: 9, severeBleeding: 8, highFever: 7,
  severeAbdominalPain: 6, suspectedFracture: 6, persistentVomiting: 5,
  severeHeadache: 3, soreThroat: 2, coldCough: 2, minorCutsBruises: 1, fatigue: 1
};
const validFlags = [
  'breathingDifficulty', 'chestPain', 'highFever', 'severeBleeding',
  'faintingDizziness', 'rapidHeartbeat'
];
const durationBonuses = { lt1h: 10, '1to6h': 6, '6to24h': 3, gt24h: 0 };

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateEntry(body) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Request body must be an object.');
  const { symptoms, severity, duration, additionalInfo = '', vitalFlags = [] } = body;
  if (!Array.isArray(symptoms) || symptoms.length === 0 ||
      symptoms.some(item => !Object.hasOwn(symptomWeights, item))) {
    throw httpError(400, 'Select at least one valid symptom.');
  }
  if (!Number.isInteger(severity) || severity < 1 || severity > 10) {
    throw httpError(400, 'Severity must be an integer from 1 to 10.');
  }
  if (!Object.hasOwn(durationBonuses, duration)) throw httpError(400, 'Select a valid symptom duration.');
  if (typeof additionalInfo !== 'string' || additionalInfo.length > 1000) {
    throw httpError(400, 'Additional information must be 1000 characters or fewer.');
  }
  if (!Array.isArray(vitalFlags) || vitalFlags.some(flag => !validFlags.includes(flag))) {
    throw httpError(400, 'One or more vital flags are invalid.');
  }

  const base = [...new Set(symptoms)].reduce((sum, symptom) => sum + symptomWeights[symptom], 0);
  const lower = additionalInfo.toLowerCase();
  const textBonus = Math.min(
    ['pain', 'blood', 'emergency', 'severe', 'faint', 'crash', 'unconscious', 'bleeding']
      .reduce((sum, word) => sum + (lower.includes(word) ? 2 : 0), 0),
    10
  );
  const score = (base * (1 + severity / 10)) + durationBonuses[duration] +
    (new Set(vitalFlags).size * 15) + textBonus;
  return {
    symptoms: [...new Set(symptoms)],
    severity,
    duration,
    additionalInfo: additionalInfo.trim(),
    vitalFlags: [...new Set(vitalFlags)],
    triageScore: Math.round(score * 10) / 10
  };
}

function toUser(row) {
  if (!row) return null;
  const user = {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
    totalRequests: row.total_requests,
    totalServed: row.total_served
  };
  return user;
}

function toEntry(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    username: row.username,
    symptoms: JSON.parse(row.symptoms),
    severity: row.severity,
    duration: row.duration,
    additionalInfo: row.additional_info,
    vitalFlags: JSON.parse(row.vital_flags),
    triageScore: row.triage_score,
    ticket: row.ticket,
    registeredAt: row.registered_at,
    status: row.status,
    servedAt: row.served_at,
    queuePosition: row.queue_position,
    totalWaiting: row.total_waiting
  };
}

const entrySelect = `
  SELECT q.*, u.name AS patient_name, u.username,
    CASE WHEN q.status = 'waiting' THEN (
      SELECT COUNT(*) + 1 FROM queue_entries ahead
      WHERE ahead.status = 'waiting'
        AND (ahead.triage_score > q.triage_score
          OR (ahead.triage_score = q.triage_score AND
            (ahead.registered_at < q.registered_at
              OR (ahead.registered_at = q.registered_at AND ahead.id < q.id))))
    ) ELSE NULL END AS queue_position,
    (SELECT COUNT(*) FROM queue_entries WHERE status = 'waiting') AS total_waiting
  FROM queue_entries q JOIN users u ON u.id = q.patient_id
`;

function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return next(httpError(401, 'Sign in to continue.'));
  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return next(httpError(401, 'Your session has expired. Please sign in again.'));
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return next(httpError(403, 'You do not have permission to perform this action.'));
    return next();
  };
}

function issueToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '12h' });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});
const ticketLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many ticket lookups. Please try again shortly.' }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/signup', authLimiter, async (req, res, next) => {
  try {
    const { name, username, password, role, staffInviteCode } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      throw httpError(400, 'Name must be between 2 and 100 characters.');
    }
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())) {
      throw httpError(400, 'Username must be 3-30 characters and use letters, numbers, dots, underscores, or hyphens.');
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw httpError(400, 'Password must be between 8 and 128 characters.');
    }
    if (!['patient', 'staff'].includes(role)) throw httpError(400, 'Select a valid account role.');
    if (role === 'staff' && (!process.env.STAFF_INVITE_CODE ||
        staffInviteCode !== process.env.STAFF_INVITE_CODE)) {
      throw httpError(403, 'A valid staff invitation code is required.');
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 12);
    const accessCode = role === 'staff' ? crypto.randomBytes(4).toString('hex').toUpperCase() : null;
    const accessCodeHash = accessCode ? await bcrypt.hash(accessCode, 12) : null;
    try {
      db.prepare(`
        INSERT INTO users (id, name, username, password_hash, role, access_code_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, name.trim(), username.trim(), passwordHash, role, accessCodeHash, createdAt);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw httpError(409, 'Username is already taken.');
      throw error;
    }
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const user = toUser(row);
    if (accessCode) user.accessCode = accessCode;
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password, accessCode } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw httpError(400, 'Username and password are required.');
    }
    const row = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      throw httpError(401, 'Invalid username or password.');
    }
    if (row.role === 'staff' && (typeof accessCode !== 'string' ||
        !(await bcrypt.compare(accessCode.toUpperCase(), row.access_code_hash)))) {
      throw httpError(401, 'Invalid staff access code.');
    }
    res.json({ user: toUser(row), token: issueToken(row) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', authenticate, (req, res, next) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return next(httpError(401, 'Account no longer exists.'));
  return res.json({ user: toUser(row) });
});

app.get('/api/users/me', authenticate, (req, res, next) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return next(httpError(404, 'Account not found.'));
  res.json({ user: toUser(row) });
});

app.patch('/api/users/me', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      throw httpError(400, 'Name must be between 2 and 100 characters.');
    }
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: toUser(row) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/users/me/access-code', authenticate, requireRole('staff'), async (req, res, next) => {
  try {
    const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const hash = await bcrypt.hash(accessCode, 12);
    db.prepare('UPDATE users SET access_code_hash = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ accessCode });
  } catch (error) {
    next(error);
  }
});

app.get('/api/queue', authenticate, (req, res) => {
  const rows = req.user.role === 'staff'
    ? db.prepare(`${entrySelect} ORDER BY CASE status WHEN 'waiting' THEN 0 ELSE 1 END, triage_score DESC, registered_at ASC, id ASC`).all()
    : db.prepare(`${entrySelect} WHERE patient_id = ? ORDER BY registered_at DESC`).all(req.user.id);
  res.json({ entries: rows.map(toEntry) });
});

app.get('/api/queue/ticket/:ticket', ticketLookupLimiter, (req, res, next) => {
  const ticket = req.params.ticket.toUpperCase();
  if (!/^TKT-[A-F0-9]{16}$/.test(ticket)) return next(httpError(400, 'Ticket number is invalid.'));
  const row = db.prepare(`${entrySelect} WHERE q.ticket = ?`).get(ticket);
  if (!row) return next(httpError(404, 'Ticket not found.'));
  const entry = toEntry(row);
  res.json({ entry: { id: entry.id, patientName: entry.patientName, ticket: entry.ticket, triageScore: entry.triageScore, registeredAt: entry.registeredAt, status: entry.status, servedAt: entry.servedAt, queuePosition: entry.queuePosition, totalWaiting: entry.totalWaiting } });
});

app.get('/api/queue/:id', authenticate, (req, res, next) => {
  const row = db.prepare(`${entrySelect} WHERE q.id = ?`).get(req.params.id);
  if (!row) return next(httpError(404, 'Queue entry not found.'));
  if (req.user.role !== 'staff' && row.patient_id !== req.user.id) return next(httpError(403, 'You cannot view this queue entry.'));
  res.json({ entry: toEntry(row) });
});

app.post('/api/queue', authenticate, requireRole('patient'), (req, res, next) => {
  try {
    const active = db.prepare("SELECT id FROM queue_entries WHERE patient_id = ? AND status = 'waiting'").get(req.user.id);
    if (active) throw httpError(409, 'You already have an active check-in.');
    const entry = validateEntry(req.body);
    const id = crypto.randomUUID();
    const ticket = `TKT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const registeredAt = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO queue_entries (id, patient_id, symptoms, severity, duration, additional_info, vital_flags, triage_score, ticket, registered_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting')
      `).run(id, req.user.id, JSON.stringify(entry.symptoms), entry.severity, entry.duration,
        entry.additionalInfo, JSON.stringify(entry.vitalFlags), entry.triageScore, ticket, registeredAt);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw httpError(409, 'You already have an active check-in.');
      throw error;
    }
    db.prepare('UPDATE users SET total_requests = total_requests + 1 WHERE id = ?').run(req.user.id);
    const row = db.prepare(`${entrySelect} WHERE q.id = ?`).get(id);
    res.status(201).json({ entry: toEntry(row) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/queue/:id', authenticate, requireRole('patient'), (req, res, next) => {
  try {
    const current = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.id);
    if (!current) throw httpError(404, 'Queue entry not found.');
    if (current.patient_id !== req.user.id) throw httpError(403, 'You cannot update this queue entry.');
    if (current.status !== 'waiting') throw httpError(409, 'A served request cannot be changed.');
    const entry = validateEntry(req.body);
    db.prepare(`
      UPDATE queue_entries
      SET symptoms = ?, severity = ?, duration = ?, additional_info = ?, vital_flags = ?, triage_score = ?
      WHERE id = ?
    `).run(JSON.stringify(entry.symptoms), entry.severity, entry.duration,
      entry.additionalInfo, JSON.stringify(entry.vitalFlags), entry.triageScore, current.id);
    const row = db.prepare(`${entrySelect} WHERE q.id = ?`).get(current.id);
    res.json({ entry: toEntry(row) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/queue/:id/priority', authenticate, requireRole('staff'), (req, res, next) => {
  const result = db.prepare("UPDATE queue_entries SET triage_score = 100 WHERE id = ? AND status = 'waiting'").run(req.params.id);
  if (!result.changes) return next(httpError(404, 'Waiting queue entry not found.'));
  const row = db.prepare(`${entrySelect} WHERE q.id = ?`).get(req.params.id);
  res.json({ entry: toEntry(row) });
});

app.post('/api/queue/call-next', authenticate, requireRole('staff'), (req, res, next) => {
  let row;
  db.exec('BEGIN IMMEDIATE');
  try {
    const nextEntry = db.prepare(`
      SELECT * FROM queue_entries WHERE status = 'waiting'
      ORDER BY triage_score DESC, registered_at ASC, id ASC LIMIT 1
    `).get();
    if (!nextEntry) {
      db.exec('ROLLBACK');
      return next(httpError(404, 'There are no patients waiting.'));
    }
    const servedAt = new Date().toISOString();
    db.prepare("UPDATE queue_entries SET status = 'served', served_at = ? WHERE id = ?").run(servedAt, nextEntry.id);
    db.prepare('UPDATE users SET total_served = total_served + 1 WHERE id = ?').run(req.user.id);
    row = db.prepare(`${entrySelect} WHERE q.id = ?`).get(nextEntry.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return next(error);
  }
  return res.json({ entry: toEntry(row) });
});

app.delete('/api/queue/:id', authenticate, (req, res, next) => {
  const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.id);
  if (!entry) return next(httpError(404, 'Queue entry not found.'));
  if (req.user.role !== 'staff' && (entry.patient_id !== req.user.id || entry.status !== 'waiting')) {
    return next(httpError(403, 'You can only cancel your own waiting check-in.'));
  }
  db.prepare('DELETE FROM queue_entries WHERE id = ?').run(entry.id);
  return res.status(204).end();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/server/') || req.path.startsWith('/data/') ||
      req.path.startsWith('/node_modules/') || /^\/(package(-lock)?\.json|\.env.*)$/.test(req.path)) {
    return next(httpError(404, 'Route not found.'));
  }
  return next();
});

app.use(express.static(path.resolve(__dirname, '..')));

app.use((req, res, next) => next(httpError(404, 'Route not found.')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ error: status === 500 ? 'An unexpected server error occurred.' : error.message });
});

const server = app.listen(port, () => {
  console.log(`MedQueue server listening at http://localhost:${server.address().port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
