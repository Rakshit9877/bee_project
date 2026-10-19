document.addEventListener('DOMContentLoaded', () => {
  UI.setupHeader();
  document.getElementById('site-footer').innerHTML = UI.getFooterHTML();
  const user = Auth.requireRole('staff');
  if (!user) return;

  const tbody       = document.getElementById('queue-tbody');
  const table       = document.getElementById('queue-table');
  const servedTbody = document.getElementById('served-tbody');
  const servedSection = document.getElementById('served-section');
  const emptyState  = document.getElementById('empty-state');

  const durationLabels = {
    lt1h:    'Under 1 hr',
    '1to6h': '1-6 hrs',
    '6to24h':'6-24 hrs',
    gt24h:   '24+ hrs',
  };

  function badgeClass(score) {
    if (score >= 30) return 'badge-emergency';
    if (score >= 15) return 'badge-urgent';
    return 'badge-routine';
  }

  let rendering = false;
  async function renderTable() {
    if (rendering) return;
    rendering = true;
    try {
    const queue = await Queue.loadQueue();
    const waiting = queue.filter(p => p.status === 'waiting');
    const served  = queue.filter(p => p.status === 'served');
    const critical = waiting.filter(p => p.triageScore >= 30);
    const avgScore = waiting.length > 0 
      ? (waiting.reduce((acc, p) => acc + p.triageScore, 0) / waiting.length).toFixed(1) 
      : '0.0';

    if (document.getElementById('count-waiting')) document.getElementById('count-waiting').textContent = waiting.length;
    if (document.getElementById('count-served')) document.getElementById('count-served').textContent  = served.length;
    if (document.getElementById('count-critical')) document.getElementById('count-critical').textContent = critical.length;
    if (document.getElementById('avg-score')) document.getElementById('avg-score').textContent = avgScore;

    if (queue.length === 0) {
      table.style.display   = 'none';
      emptyState.style.display = 'flex';
      servedSection.classList.add('hidden');
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = '';
    waiting.forEach((p, idx) => {
      const sympHtml = p.symptoms.map(s => UI.symptomLabel(s)).join(', ');
      const flagHtml = (p.vitalFlags && p.vitalFlags.length > 0)
        ? `<div style="margin-top:4px;color:var(--triage-critical);font-weight:600;font-size:0.8rem;">${p.vitalFlags.map(v => UI.vitalLabel(v)).join(', ')}</div>`
        : '';
      const infoHtml = p.additionalInfo ? `<div style="margin-top:4px;font-size:0.8rem;color:var(--text-subtle);font-style:italic;">"${UI.escapeHTML(p.additionalInfo)}"</div>` : '';
      const attachHtml = (p.attachment && p.attachment.url)
        ? `<div style="margin-top:6px;"><a href="${API.baseUrl}${p.attachment.url}" target="_blank" class="badge badge-info" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-size:0.75rem;">📎 ${UI.escapeHTML(p.attachment.originalname || 'View Medical File')}</a></div>`
        : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:800;font-size:1.1rem;color:var(--text-muted);">${idx + 1}</td>
        <td><span class="ticket-number">${p.ticket || '—'}</span></td>
        <td>
          <div style="font-weight:700;color:var(--text-dark);">${UI.escapeHTML(p.patientName)}</div>
          <div style="font-size:0.78rem;color:var(--text-subtle);">@${UI.escapeHTML(p.username)}</div>
        </td>
        <td><span class="badge ${badgeClass(p.triageScore)}">Score: ${p.triageScore.toFixed(1)}</span></td>
        <td style="color:var(--text-muted);">${durationLabels[p.duration] || p.duration}</td>
        <td>
          <div style="font-size:0.82rem;color:var(--text-muted);">${sympHtml}</div>
          ${flagHtml}
          ${infoHtml}
          ${attachHtml}
        </td>
        <td style="color:var(--text-subtle);font-size:0.82rem;">${UI.formatRelativeTime(p.registeredAt)}</td>
        <td>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <span class="badge badge-semi" style="align-self: flex-start;">Waiting</span>
            <button class="btn btn-outline btn-sm override-btn" data-id="${p.id}" style="font-size: 0.7rem; padding: 4px 8px; border-color: var(--triage-critical); color: var(--triage-critical);">Mark Critical</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (served.length > 0) {
      servedSection.classList.remove('hidden');
      servedTbody.innerHTML = '';
      served.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="ticket-number">${p.ticket || '—'}</span></td>
          <td>
            <div style="font-weight:600;color:var(--text-muted);">${UI.escapeHTML(p.patientName)}</div>
            <div style="font-size:0.75rem;color:var(--text-subtle);">@${UI.escapeHTML(p.username)}</div>
          </td>
          <td><span class="badge badge-routine" style="opacity:0.7;">${p.triageScore.toFixed(1)}</span></td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${p.symptoms.map(s => UI.symptomLabel(s)).join(', ')}</td>
          <td style="font-size:0.8rem;color:var(--text-subtle);">${UI.formatRelativeTime(p.registeredAt)}</td>
        `;
        servedTbody.appendChild(tr);
      });
    } else {
      servedSection.classList.add('hidden');
    }

    // Attach override handlers
    document.querySelectorAll('.override-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm("Are you sure you want to mark this patient as CRITICAL? This will bypass the algorithm and push them to the front of the queue.")) {
          try {
            await Queue.updateEntry(id, {}, true);
            UI.showToast('Patient marked as critical. Queue reordered.', 'warning');
            await renderTable();
          } catch (error) {
            UI.showToast(error.message, 'error');
          }
        }
      });
    });
    } catch (error) {
      UI.showToast(error.message, 'error');
    } finally {
      rendering = false;
    }
  }

  // Call Next
  document.getElementById('call-next-btn').addEventListener('click', async () => {
    try {
      const next = await Queue.callNextPatient();
      await renderTable();
      UI.showToast(`Called ${next.patientName} (${next.ticket || ''}) — they have been notified.`, 'success');
    } catch (error) {
      UI.showToast(error.message, 'info');
    }
  });

  renderTable();

  const pollInterval = setInterval(() => { renderTable(); }, 3000);
  window.addEventListener('beforeunload', () => clearInterval(pollInterval));
});
