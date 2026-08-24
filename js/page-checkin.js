document.addEventListener('DOMContentLoaded', () => {
  UI.setupHeader();
  document.getElementById('site-footer').innerHTML = UI.getFooterHTML();
  const user = Auth.requireRole('patient');
  if (!user) return;

  const checkinForm   = document.getElementById('checkin-form');
  const checkinSection = document.getElementById('checkin-section');
  const activeSection = document.getElementById('active-request-section');
  const submitBtn     = document.getElementById('submit-btn');

  // Severity slider display
  const severitySlider = document.getElementById('severity');
  const severityVal    = document.getElementById('severity-val');
  if (severitySlider && severityVal) {
    severitySlider.addEventListener('input', e => {
      severityVal.textContent = e.target.value + '/10';
    });
  }


  const existingEntry = Queue.hasActiveRequest(user.id);
  if (existingEntry) {
    showActiveRequest(existingEntry);
  }


  let editingEntryId = null;

  document.getElementById('edit-request-btn').addEventListener('click', () => {
    editingEntryId = existingEntry ? existingEntry.id : null;
    activeSection.classList.add('hidden');
    checkinSection.classList.remove('hidden');


    if (existingEntry) {
      document.getElementById('checkin-title').textContent = 'Edit Your Request';
      document.getElementById('checkin-subtitle').textContent = 'Update your symptoms. Your priority score will be recalculated.';
      submitBtn.textContent = 'Update Request';


      existingEntry.symptoms.forEach(s => {
        const cb = document.querySelector(`input[name="symptoms"][value="${s}"]`);
        if (cb) { cb.checked = true; cb.closest('.check-card').classList.add('checked'); }
      });


      severitySlider.value = existingEntry.severity;
      severityVal.textContent = existingEntry.severity + '/10';


      document.getElementById('duration').value = existingEntry.duration;


      if (existingEntry.additionalInfo) {
        document.getElementById('additional-info').value = existingEntry.additionalInfo;
      }


      if (existingEntry.vitalFlags) {
        existingEntry.vitalFlags.forEach(v => {
          const cb = document.querySelector(`input[name="vitalFlags"][value="${v}"]`);
          if (cb) { cb.checked = true; cb.closest('.check-card').classList.add('checked'); }
        });
      }
    }
  });

  function showActiveRequest(entry) {
    checkinSection.classList.add('hidden');
    activeSection.classList.remove('hidden');

    document.getElementById('active-ticket').textContent = entry.ticket || '—';
    document.getElementById('active-score').textContent = entry.triageScore.toFixed(1);

    const sympContainer = document.getElementById('active-symptoms');
    sympContainer.innerHTML = entry.symptoms.map(s =>
      `<span class="badge badge-info">${UI.symptomLabel(s)}</span>`
    ).join('');
    if (entry.vitalFlags && entry.vitalFlags.length > 0) {
      sympContainer.innerHTML += entry.vitalFlags.map(v =>
        `<span class="badge badge-emergency">${UI.vitalLabel(v)}</span>`
      ).join('');
    }
  }


  checkinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const symptoms = Array.from(
      document.querySelectorAll('input[name="symptoms"]:checked')
    ).map(cb => cb.value);

    if (symptoms.length === 0) {
      UI.showMessage('checkin-msg', 'Please select at least one symptom before submitting.', 'error');
      return;
    }

    const vitalFlags = Array.from(
      document.querySelectorAll('input[name="vitalFlags"]:checked')
    ).map(cb => cb.value);

    const formData = {
      symptoms,
      severity: parseInt(severitySlider.value, 10),
      duration: document.getElementById('duration').value,
      additionalInfo: document.getElementById('additional-info').value.trim(),
      vitalFlags,
    };

    const triageScore    = computeTriageScore(formData);
    const scoreBreakdown = explainScore(formData);

    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Processing...';

    setTimeout(() => {
      let queue = Queue.loadQueue();

      if (editingEntryId) {

        Queue.updateEntry(editingEntryId, formData, triageScore);
        queue = Queue.loadQueue();
        const updatedEntry = queue.find(p => p.id === editingEntryId);
        showConfirmation(updatedEntry, scoreBreakdown, queue);
      } else {

        const ticket = Queue.generateTicket(queue);
        const patientEntry = {
          id:          'p_' + Date.now(),
          patientId:   user.id,
          patientName: user.name,
          username:    user.username,
          ...formData,
          triageScore,
          ticket,
          registeredAt: new Date().toISOString(),
          status: 'waiting',
        };

        Queue.insertPatient(queue, patientEntry);
        Queue.saveQueue(queue);


        Auth.incrementStat(user.id, 'totalRequests');

        showConfirmation(patientEntry, scoreBreakdown, queue);
      }

      submitBtn.classList.remove('loading');
    }, 600);
  });

  function showConfirmation(entry, scoreBreakdown, queue) {
    checkinSection.classList.add('hidden');
    activeSection.classList.add('hidden');
    const confirmEl = document.getElementById('confirmation-section');
    confirmEl.classList.remove('hidden');
    confirmEl.style.animation = 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both';


    document.getElementById('conf-ticket').textContent = entry.ticket || '—';
    document.getElementById('conf-ticket-repeat').textContent = entry.ticket || '—';


    document.getElementById('conf-total-score').textContent = scoreBreakdown.total;
    document.getElementById('conf-base-score').textContent  = scoreBreakdown.baseScore;
    document.getElementById('conf-severity-factor').textContent = scoreBreakdown.severityFactor;
    document.getElementById('conf-duration-bonus').textContent  = scoreBreakdown.durationBonus;
    document.getElementById('conf-text-bonus').textContent      = scoreBreakdown.textBonus;
    document.getElementById('conf-vital-bonus').textContent     = scoreBreakdown.vitalFlagBonus;


    const scoreEl = document.getElementById('conf-total-score');
    if (scoreBreakdown.total >= 30)      scoreEl.style.color = 'var(--triage-critical)';
    else if (scoreBreakdown.total >= 15) scoreEl.style.color = 'var(--triage-emergency)';
    else                                 scoreEl.style.color = 'var(--triage-routine)';


    const position     = Queue.getPatientPosition(queue, entry.id);
    const totalWaiting = queue.filter(p => p.status === 'waiting').length;
    document.getElementById('conf-queue-pos').textContent   = `#${position}`;
    document.getElementById('conf-queue-label').textContent = `out of ${totalWaiting} waiting`;
  }
});
