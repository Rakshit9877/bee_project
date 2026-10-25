const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

// We import the express app
const app = require('../server');

test('MedQueue MVC API Suite - Full Flow', async () => {
  const baseUrl = `http://localhost:${process.env.PORT || 5001}`;

  // Helper request function
  async function request(endpoint, { method = 'GET', token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const data = res.status === 204
      ? null
      : res.headers.get('content-type')?.includes('application/json')
        ? await res.json()
        : await res.text();

    return { res, data };
  }

  // 1. Health check
  const health = await request('/api/health');
  assert.equal(health.res.status, 200);
  assert.equal(health.data.status, 'ok');

  // Random suffix for unique test users
  const suffix = Date.now() + Math.floor(Math.random() * 1000);
  const patientUsername = `testpat_${suffix}`;
  const staffUsername = `teststf_${suffix}`;

  // 2. Patient Signup
  const pSignup = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Test Patient',
      username: patientUsername,
      password: 'password123',
      role: 'patient'
    }
  });
  assert.equal(pSignup.res.status, 201);
  assert.ok(pSignup.data.token);
  assert.equal(pSignup.data.user.role, 'patient');
  const patientToken = pSignup.data.token;

  // 3. Staff Signup
  const sSignup = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Dr. Test Staff',
      username: staffUsername,
      password: 'staffpassword123',
      role: 'staff',
      staffInviteCode: process.env.STAFF_INVITE_CODE || 'MEDSTAFF2026'
    }
  });
  assert.equal(sSignup.res.status, 201);
  assert.ok(sSignup.data.user.accessCode, 'Staff must receive an access code');
  const staffAccessCode = sSignup.data.user.accessCode;

  // 4. Staff Login with Access Code
  const sLogin = await request('/api/auth/login', {
    method: 'POST',
    body: {
      username: staffUsername,
      password: 'staffpassword123',
      accessCode: staffAccessCode
    }
  });
  assert.equal(sLogin.res.status, 200);
  assert.ok(sLogin.data.token);
  const staffToken = sLogin.data.token;

  // 5. Patient Create Check-in
  const checkinRes = await request('/api/queue', {
    method: 'POST',
    token: patientToken,
    body: {
      symptoms: ['chestPain', 'breathingDifficulty'],
      severity: 8,
      duration: 'lt1h',
      additionalInfo: 'Severe pain started suddenly',
      vitalFlags: ['chestPain', 'breathingDifficulty']
    }
  });
  assert.equal(checkinRes.res.status, 201);
  const entry = checkinRes.data.entry;
  assert.ok(entry.ticket);
  assert.ok(entry.triageScore > 0);
  assert.equal(entry.status, 'waiting');
  const ticket = entry.ticket;
  const entryId = entry.id;

  // 6. Duplicate check-in prevention
  const dupCheckin = await request('/api/queue', {
    method: 'POST',
    token: patientToken,
    body: {
      symptoms: ['soreThroat'],
      severity: 2,
      duration: 'gt24h'
    }
  });
  assert.equal(dupCheckin.res.status, 409);

  // 7. Public Ticket Lookup
  const lookupRes = await request(`/api/queue/ticket/${ticket}`);
  assert.equal(lookupRes.res.status, 200);
  assert.equal(lookupRes.data.entry.ticket, ticket);
  assert.equal(lookupRes.data.entry.patientName, 'Test Patient');

  // 8. Staff Priority Override
  const overrideRes = await request(`/api/queue/${entryId}/priority`, {
    method: 'PATCH',
    token: staffToken
  });
  assert.equal(overrideRes.res.status, 200);
  assert.equal(overrideRes.data.entry.triageScore, 100);

  // 9. Staff Call Next Patient
  const callNextRes = await request('/api/queue/call-next', {
    method: 'POST',
    token: staffToken
  });
  assert.equal(callNextRes.res.status, 200);
  assert.equal(callNextRes.data.entry.id, entryId);
  assert.equal(callNextRes.data.entry.status, 'served');

  // 10. Staff Analytics
  const analyticsRes = await request('/api/analytics', {
    token: staffToken
  });
  assert.equal(analyticsRes.res.status, 200);
  assert.ok(analyticsRes.data.summary);
  assert.ok(analyticsRes.data.urgencyBreakdown);

  // Clean up created test documents from MongoDB Atlas
  const QueueEntry = require('../models/QueueEntry');
  const User = require('../models/User');
  await QueueEntry.deleteMany({ ticket });
  await User.deleteMany({ username: { $in: [patientUsername, staffUsername] } });

  console.log('ALL API TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
});
