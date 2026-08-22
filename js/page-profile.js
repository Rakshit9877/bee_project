document.addEventListener('DOMContentLoaded', () => {
  UI.setupHeader();
  document.getElementById('site-footer').innerHTML = UI.getFooterHTML();

  const user = Auth.getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const fullUser = Auth.getFullUser(user.id);
  if (!fullUser) {
    window.location.href = 'login.html';
    return;
  }

  // Avatar
  const initials = fullUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('profile-avatar').textContent = initials;

  // Name and username
  document.getElementById('profile-name').textContent = fullUser.name;
  document.getElementById('profile-username').textContent = '@' + fullUser.username;

  // Role badge
  const roleBadge = document.getElementById('profile-role');
  roleBadge.textContent = fullUser.role === 'staff' ? 'Staff' : 'Patient';
  roleBadge.className = `badge ${fullUser.role === 'staff' ? 'badge-urgent' : 'badge-info'}`;

  // Stats
  const statsContainer = document.getElementById('profile-stats');

  if (fullUser.role === 'patient') {
    const requestCount = Queue.getRequestCount(user.id);
    const activeReq = Queue.hasActiveRequest(user.id);

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${requestCount}</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: ${activeReq ? 'var(--triage-emergency)' : 'var(--text-subtle)'};">${activeReq ? 'Yes' : 'No'}</div>
        <div class="stat-label">Active Request</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size: 1.2rem;">${UI.formatDate(fullUser.createdAt)}</div>
        <div class="stat-label">Member Since</div>
      </div>
    `;

    // Patient History
    const queue = Queue.loadQueue();
    const history = queue.filter(p => p.patientId === user.id).sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
    if (history.length > 0) {
      const historyHtml = history.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border-light);">
          <div>
            <div style="font-weight:600; font-size:0.95rem;">${UI.formatDate(p.registeredAt)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${p.symptoms.map(s => UI.symptomLabel(s)).join(', ')}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${p.status === 'served' ? 'badge-routine' : 'badge-urgent'}">${p.status}</span>
            <div style="font-size:0.8rem; font-weight:700; margin-top:4px;">Score: ${p.triageScore.toFixed(1)}</div>
          </div>
        </div>
      `).join('');
      
      const historyDiv = document.createElement('div');
      historyDiv.style.marginTop = '32px';
      historyDiv.innerHTML = `
        <h3 style="font-size: 1.1rem; margin-bottom: 12px; color: var(--text-dark);">Visit History</h3>
        <div class="card-panel no-hover" style="padding: 12px 24px;">
          ${historyHtml}
        </div>
      `;
      statsContainer.parentElement.appendChild(historyDiv);
    }
  } else {
    // Staff stats
    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${fullUser.totalServed || 0}</div>
        <div class="stat-label">Patients Served</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size: 1.2rem;">${UI.formatDate(fullUser.createdAt)}</div>
        <div class="stat-label">Member Since</div>
      </div>
    `;

    // Show access code section
    const codeSection = document.getElementById('access-code-section');
    codeSection.classList.remove('hidden');
    document.getElementById('profile-access-code').textContent = fullUser.accessCode || '------';

    // Regenerate button
    document.getElementById('regenerate-code-btn').addEventListener('click', () => {
      if (confirm('Are you sure? Your current code will stop working immediately.')) {
        const newCode = Auth.regenerateAccessCode(user.id);
        document.getElementById('profile-access-code').textContent = newCode;
        UI.showToast('Access code regenerated. Save your new code.', 'warning');
      }
    });
  }

  // Add Theme Toggle
  const themeDiv = document.createElement('div');
  themeDiv.style.marginTop = '32px';
  themeDiv.style.textAlign = 'center';
  const isDark = document.body.classList.contains('dark-theme');
  themeDiv.innerHTML = `
    <button id="theme-toggle-btn" class="btn btn-outline">
      ${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    </button>
  `;
  statsContainer.parentElement.appendChild(themeDiv);

  document.getElementById('theme-toggle-btn').addEventListener('click', (e) => {
    const darkNow = UI.toggleTheme();
    e.target.textContent = darkNow ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });
});
