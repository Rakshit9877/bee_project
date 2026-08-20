document.addEventListener('DOMContentLoaded', () => {
  UI.setupHeader();
  document.getElementById('site-footer').innerHTML = UI.getFooterHTML();
  const user = Auth.requireRole('patient');
  if (!user) return;

  const statusContent = document.getElementById('status-content');
  let pollInterval;
  let lastStatus = null;

  function renderStatus() {
    const queue = Queue.loadQueue();

    // Find latest entry for this patient
    const patientEntries = queue
      .filter(p => p.patientId === user.id)
      .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

    if (patientEntries.length === 0) {
      statusContent.innerHTML = `
        <div style="padding: 40px 20px; text-align: center;">
          <div class="feature-icon purple" style="margin: 0 auto 16px auto; width: 56px; height: 56px; font-size: 1.5rem; border-radius: 50%;">?</div>
          <h3 style="font-size: 1.5rem; margin-bottom: 8px;">No active check-in</h3>
          <p style="color: var(--text-muted); margin-bottom: 24px;">You haven't checked in yet today.</p>
          <a href="checkin.html" class="btn btn-primary">Check In Now</a>
        </div>`;
      return;
    }

    const entry = patientEntries[0];

    // Toast on status change
    if (lastStatus && lastStatus !== entry.status) {
      if (entry.status === 'served') {
        UI.showToast('You have been called. Please proceed to the desk.', 'success');
      }
    }
    lastStatus = entry.status;

    if (entry.status === 'served') {
      statusContent.innerHTML = `
        <div style="padding: 40px 20px; text-align: center;">
          <div class="feature-icon green" style="margin: 0 auto 16px auto; width: 56px; height: 56px; font-size: 1.5rem; border-radius: 50%;">&#10003;</div>
          <h2 style="font-size:1.5rem;color:var(--triage-routine);margin-bottom:8px;">You've been called</h2>
          <p style="color:var(--text-muted);margin-bottom:24px;">Please proceed to the front desk or examination room.</p>
          <a href="checkin.html" class="btn btn-secondary btn-sm">Start New Check-in</a>
        </div>`;
    } else {
      const position     = Queue.getPatientPosition(queue, entry.id);
      const totalWaiting = queue.filter(p => p.status === 'waiting').length;

      let scoreColor = 'var(--triage-routine)';
      if (entry.triageScore >= 30)      scoreColor = 'var(--triage-critical)';
      else if (entry.triageScore >= 15) scoreColor = 'var(--triage-emergency)';

      const estWaitTime = position * 10; // Simple estimation: 10 mins per person ahead
      const infoHtml = entry.additionalInfo ? `<div style="margin-top:16px; padding:12px; background:var(--bg-main); border-radius:var(--radius-sm); font-size:0.85rem; color:var(--text-muted); font-style:italic;"><strong>Additional Notes:</strong> "${entry.additionalInfo}"</div>` : '';

      statusContent.innerHTML = `
        <div id="printable-ticket">
          <div style="margin-bottom: 20px;">
            <div style="font-size: 0.78rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em;">Ticket</div>
            <div class="ticket-number large">${entry.ticket || '—'}</div>
          </div>

          <div style="padding: 20px 0;">
            <div style="font-size: 4rem; font-weight: 800; line-height: 1; color:${scoreColor}; margin-bottom: 8px;">#${position}</div>
            <div style="font-size: 0.95rem; color: var(--text-muted);">out of <strong>${totalWaiting}</strong> patients waiting</div>
            <div style="margin-top: 12px; display: inline-block; padding: 6px 12px; background: rgba(30, 136, 229, 0.1); color: var(--primary); border-radius: 20px; font-weight: 600; font-size: 0.85rem;">
              Est. Wait Time: ~${estWaitTime} mins
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin: 0 0 24px; text-align: center;">
            <div class="stat-card">
              <div class="stat-value" style="color:${scoreColor}; font-size: 1.3rem;">${entry.triageScore.toFixed(1)}</div>
              <div class="stat-label">Score</div>
            </div>
            <div class="stat-card">
              <span class="badge badge-semi">${entry.status}</span>
              <div class="stat-label" style="margin-top: 6px;">Status</div>
            </div>
            <div class="stat-card">
              <div style="font-size:0.95rem;font-weight:700;color:var(--text-dark);">${UI.formatRelativeTime(entry.registeredAt)}</div>
              <div class="stat-label" style="margin-top: 4px;">Checked in</div>
            </div>
          </div>
          ${infoHtml}
        </div>
        <button id="print-btn" class="btn btn-outline" style="width:100%; margin-top: 16px;">Print Ticket</button>
      `;

      document.getElementById('print-btn').addEventListener('click', () => {
        window.print();
      });
    }
  }

  renderStatus();
  pollInterval = setInterval(renderStatus, 3000);

  window.addEventListener('storage', (e) => {
    if (e.key === 'triageapp_queue') renderStatus();
  });

  window.addEventListener('beforeunload', () => clearInterval(pollInterval));
});
