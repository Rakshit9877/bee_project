const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

test('queue API enforces CRUD rules and staff permissions', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'medqueue-api-'));
  const child = spawn(process.execPath, [path.join(projectRoot, 'server', 'index.js')], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: '0',
      JWT_SECRET: 'test-secret-value-with-at-least-32-characters',
      STAFF_INVITE_CODE: 'test-invitation',
      DATABASE_PATH: path.join(tempDirectory, 'test.sqlite'),
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });

  try {
    const deadline = Date.now() + 15000;
    let baseUrl;
    while (Date.now() < deadline && !baseUrl) {
      if (child.exitCode !== null) throw new Error(`API server exited during startup:\n${output}`);
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) baseUrl = `http://localhost:${match[1]}`;
      else await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(baseUrl, `API server did not start:\n${output}`);

    async function request(route, { method = 'GET', token, body } = {}) {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const payload = response.status === 204
        ? null
        : response.headers.get('content-type')?.includes('application/json')
          ? await response.json()
          : await response.text();
      return { response, payload };
    }

    const health = await request('/api/health');
    assert.equal(health.response.status, 200);
    const homePage = await request('/');
    assert.equal(homePage.response.status, 200);
    assert.match(homePage.payload, /MedQueue/);
    const backendSource = await request('/server/index.js');
    assert.equal(backendSource.response.status, 404);

    const patientSignup = await request('/api/auth/signup', {
      method: 'POST',
      body: { name: 'API Patient', username: 'api_patient', password: 'patient-password-123', role: 'patient' }
    });
    assert.equal(patientSignup.response.status, 201);
    assert.equal(Object.hasOwn(patientSignup.payload.user, 'password_hash'), false);

    const patientLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'api_patient', password: 'patient-password-123' }
    });
    const patientToken = patientLogin.payload.token;

    const missingAuth = await request('/api/queue');
    assert.equal(missingAuth.response.status, 401);

    const created = await request('/api/queue', {
      method: 'POST',
      token: patientToken,
      body: { symptoms: ['severeHeadache'], severity: 6, duration: '1to6h', additionalInfo: '', vitalFlags: [] }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.entry.triageScore, 10.8);
    const duplicate = await request('/api/queue', {
      method: 'POST',
      token: patientToken,
      body: { symptoms: ['fatigue'], severity: 2, duration: 'gt24h', additionalInfo: '', vitalFlags: [] }
    });
    assert.equal(duplicate.response.status, 409);

    const updated = await request(`/api/queue/${created.payload.entry.id}`, {
      method: 'PUT',
      token: patientToken,
      body: { symptoms: ['chestPain'], severity: 8, duration: 'lt1h', additionalInfo: '', vitalFlags: [] }
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.entry.triageScore, 26.2);

    const otherSignup = await request('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Other Patient', username: 'other_patient', password: 'patient-password-456', role: 'patient' }
    });
    assert.equal(otherSignup.response.status, 201);
    const otherLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'other_patient', password: 'patient-password-456' }
    });
    const forbiddenRead = await request(`/api/queue/${created.payload.entry.id}`, {
      token: otherLogin.payload.token
    });
    assert.equal(forbiddenRead.response.status, 403);

    const blockedStaffSignup = await request('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Blocked Staff', username: 'blocked_staff', password: 'staff-password-123', role: 'staff' }
    });
    assert.equal(blockedStaffSignup.response.status, 403);

    const staffSignup = await request('/api/auth/signup', {
      method: 'POST',
      body: { name: 'API Staff', username: 'api_staff', password: 'staff-password-123', role: 'staff', staffInviteCode: 'test-invitation' }
    });
    assert.equal(staffSignup.response.status, 201);
    const staffLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'api_staff', password: 'staff-password-123', accessCode: staffSignup.payload.user.accessCode }
    });
    const staffToken = staffLogin.payload.token;

    const publicLookup = await request(`/api/queue/ticket/${created.payload.entry.ticket}`);
    assert.equal(publicLookup.response.status, 200);
    assert.equal(Object.hasOwn(publicLookup.payload.entry, 'symptoms'), false);

    const override = await request(`/api/queue/${created.payload.entry.id}/priority`, {
      method: 'PATCH',
      token: staffToken
    });
    assert.equal(override.payload.entry.triageScore, 100);

    const called = await request('/api/queue/call-next', {
      method: 'POST',
      token: staffToken
    });
    assert.equal(called.payload.entry.status, 'served');

    const history = await request('/api/queue', { token: patientToken });
    assert.equal(history.payload.entries[0].status, 'served');

    const deleted = await request(`/api/queue/${called.payload.entry.id}`, {
      method: 'DELETE',
      token: staffToken
    });
    assert.equal(deleted.response.status, 204);

    const secondEntry = await request('/api/queue', {
      method: 'POST',
      token: patientToken,
      body: { symptoms: ['fatigue'], severity: 2, duration: 'gt24h', additionalInfo: '', vitalFlags: [] }
    });
    const cancelled = await request(`/api/queue/${secondEntry.payload.entry.id}`, {
      method: 'DELETE',
      token: patientToken
    });
    assert.equal(cancelled.response.status, 204);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
