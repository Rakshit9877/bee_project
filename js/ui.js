// Shared UI helpers

const UI = {
  // Show an alert-style message element
  showMessage(elementId, message, type = 'error') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.style.color = type === 'error' ? 'var(--triage-critical)' : 'var(--triage-routine)';
    el.style.display = 'block';

    setTimeout(() => {
      el.style.display = 'none';
      el.textContent = '';
    }, 5000);
  },

  // Show a toast popup notification (no emojis — uses colored dots)
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-dot ${type}"></span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Format relative time
  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now  = new Date();
    const diffMs   = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1)   return 'Just now';
    if (diffMins < 60)  return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  },

  // Format date nicely
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  },

  // Symptom key → readable label
  symptomLabel(key) {
    const map = {
      chestPain: 'Chest pain',
      breathingDifficulty: 'Breathing difficulty',
      severeBleeding: 'Severe bleeding',
      highFever: 'High fever',
      severeAbdominalPain: 'Abdominal pain',
      suspectedFracture: 'Fracture',
      persistentVomiting: 'Vomiting',
      severeHeadache: 'Severe headache',
      soreThroat: 'Sore throat',
      coldCough: 'Cold/cough',
      minorCutsBruises: 'Minor cuts',
      fatigue: 'Fatigue',
    };
    return map[key] || key;
  },

  // Vital flag key → readable label
  vitalLabel(key) {
    const map = {
      breathingDifficulty: 'Breathing at rest',
      chestPain: 'Chest pain',
      highFever: 'High fever',
      severeBleeding: 'Bleeding',
      faintingDizziness: 'Fainting/dizziness',
      rapidHeartbeat: 'Rapid heartbeat',
    };
    return map[key] || key;
  },

  // Symptom severity color for inline indicator dots
  symptomSeverityColor(key) {
    const high = ['chestPain', 'breathingDifficulty', 'severeBleeding'];
    const med  = ['highFever', 'severeAbdominalPain', 'suspectedFracture', 'persistentVomiting', 'severeHeadache'];
    if (high.includes(key)) return 'var(--triage-critical)';
    if (med.includes(key))  return 'var(--triage-emergency)';
    return 'var(--triage-routine)';
  },

  // Setup header nav links based on login state
  setupHeader() {
    this.initTheme(); // Initialize theme on page load

    const headerNav = document.getElementById('header-nav');
    if (!headerNav) return;

    const user = Auth.getCurrentUser();
    if (user) {
      const dest = user.role === 'staff' ? 'dashboard.html' : 'checkin.html';
      const destLabel = user.role === 'staff' ? 'Dashboard' : 'Check-in';
      headerNav.innerHTML = `
        <a href="lookup.html" class="nav-link">Track Ticket</a>
        <a href="${dest}" class="nav-link">${destLabel}</a>
        <a href="profile.html" class="nav-link">Profile</a>
        <span class="nav-link" style="color:var(--text-subtle);cursor:default;">
          ${user.name}
        </span>
        <button id="logout-btn" class="btn btn-secondary btn-sm" style="width:auto;">Log out</button>
      `;
      document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
    } else {
      headerNav.innerHTML = `
        <a href="lookup.html" class="nav-link">Track Ticket</a>
        <a href="login.html" class="nav-link">Login</a>
        <a href="signup.html" class="btn btn-primary btn-sm" style="width:auto;">Get Started</a>
      `;
    }
  },

  // Create a shared footer HTML string
  getFooterHTML() {
    return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">
              <img src="assets/logo.jpg" alt="MedQueue Logo" class="logo-icon-img" style="margin-right: 8px;">
              <span class="footer-brand-name">MedQueue</span>
            </div>
            <p class="footer-desc">
              An algorithmic front-desk priority queue that orders patients by self-reported symptom urgency, using weighted scoring and hand-crafted insertion sort.
            </p>
            <div class="footer-disclaimer">
              This tool is strictly non-diagnostic. It does not provide medical advice, diagnosis, or treatment. For emergencies, call your local emergency number immediately.
            </div>
          </div>
          <div>
            <h4 class="footer-heading">Navigation</h4>
            <ul class="footer-links">
              <li><a href="index.html">Home</a></li>
              <li><a href="signup.html">Create Account</a></li>
              <li><a href="login.html">Sign In</a></li>
              <li><a href="lookup.html">Track a Ticket</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-heading">Resources</h4>
            <ul class="footer-links">
              <li><a href="checkin.html">Symptom Check-in</a></li>
              <li><a href="dashboard.html">Staff Dashboard</a></li>
              <li><a href="profile.html">My Profile</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-heading">Project</h4>
            <ul class="footer-links">
              <li><a href="https://github.com/Rakshit9877/bee_project" target="_blank">GitHub Repository</a></li>
              <li><a href="#">Backend Engineering</a></li>
              <li><a href="#">Chitkara University</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} MedQueue. Built for Backend Engineering (24CAI0303).</span>
          <span>Phase 1 — Vanilla HTML / CSS / JavaScript</span>
        </div>
      </div>
    </footer>`;
  },

  // Dark theme support
  initTheme() {
    const isDark = localStorage.getItem('triageapp_theme') === 'dark';
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  },

  toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('triageapp_theme', isDark ? 'dark' : 'light');
    return isDark;
  }
};
