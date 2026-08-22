document.addEventListener('DOMContentLoaded', () => {
  UI.setupHeader();
  document.getElementById('site-footer').innerHTML = UI.getFooterHTML();

  const form = document.getElementById('lookup-form');
  const resultDiv = document.getElementById('lookup-result');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const ticketInput = document.getElementById('ticket-input').value.trim().toUpperCase();
    if (!ticketInput) return;

    const entry = Queue.getEntryByTicket(ticketInput);
    resultDiv.classList.remove('hidden');

    if (!entry) {
      resultDiv.innerHTML = `
        <div class="card-panel no-hover" style="text-align: center;">
          <div class="feature-icon coral" style="margin: 0 auto 16px auto; width: 56px; height: 56px; font-size: 1.5rem; border-radius: 50%;">X</div>
          <h3 style="font-size: 1.3rem; margin-bottom: 8px;">Ticket Not Found</h3>
          <p style="color: var(--text-muted);">No entry matches <strong>${ticketInput}</strong>. Please check the number and try again.</p>
        </div>`;
      return;
    }

    if (entry.status === 'served') {
      resultDiv.innerHTML = `
        <div class="card-panel no-hover" style="text-align: center;">
          <div class="feature-icon green" style="margin: 0 auto 16px auto; width: 56px; height: 56px; font-size: 1.5rem; border-radius: 50%;">&#10003;</div>
          <h3 style="font-size: 1.3rem; margin-bottom: 8px;">Already Called</h3>
          <p style="color: var(--text-muted);">Ticket <strong class="ticket-number">${entry.ticket}</strong> for <strong>${entry.patientName}</strong> has already been called. The patient should proceed to the desk.</p>
        </div>`;
      return;
    }

    const queue = Queue.loadQueue();
    const position = Queue.getPatientPosition(queue, entry.id);
    const totalWaiting = queue.filter(p => p.status === 'waiting').length;

    let scoreColor = 'var(--triage-routine)';
    if (entry.triageScore >= 30)      scoreColor = 'var(--triage-critical)';
    else if (entry.triageScore >= 15) scoreColor = 'var(--triage-emergency)';

    resultDiv.innerHTML = `
      <div class="card-panel no-hover" style="text-align: center;">
        <div style="font-size: 0.78rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Ticket</div>
        <div class="ticket-number large" style="margin-bottom: 20px;">${entry.ticket}</div>

        <div style="font-size: 0.78rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em;">Queue Position</div>
        <div style="font-size: 3.5rem; font-weight: 800; font-family: var(--font-heading); color: ${scoreColor}; line-height: 1; margin-bottom: 8px;">#${position}</div>
        <div style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 24px;">out of <strong>${totalWaiting}</strong> patients waiting</div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="stat-card">
            <div class="stat-value" style="color:${scoreColor}; font-size: 1.3rem;">${entry.triageScore.toFixed(1)}</div>
            <div class="stat-label">Priority Score</div>
          </div>
          <div class="stat-card">
            <div style="font-weight: 700; color: var(--text-dark);">${entry.patientName}</div>
            <div class="stat-label">Patient</div>
          </div>
        </div>
      </div>

      <div class="info-banner" style="margin-top: 16px;">
        <span class="info-dot"></span>
        <span>This is a one-time lookup. Refresh or submit again to get the latest position.</span>
      </div>`;
  });
});
