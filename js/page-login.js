document.addEventListener('DOMContentLoaded', () => {
  UI.setupHeader();
  const footer = document.getElementById('site-footer');
  if (footer) footer.innerHTML = UI.getFooterHTML();

  // Already logged in → redirect
  const existing = Auth.getCurrentUser();
  if (existing) {
    window.location.href = existing.role === 'staff' ? 'dashboard.html' : 'checkin.html';
    return;
  }

  const form      = document.getElementById('login-form');
  const loginBtn  = document.getElementById('login-btn');
  const usernameInput = document.getElementById('username');
  const accessCodeGroup = document.getElementById('access-code-group');

  // Show/hide access code field based on whether the username belongs to staff
  let debounceTimer;
  usernameInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const username = usernameInput.value.trim();
      if (username.length >= 2 && Auth.isStaffUsername(username)) {
        accessCodeGroup.style.display = 'block';
      } else {
        accessCodeGroup.style.display = 'none';
      }
    }, 300);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = document.getElementById('password').value;
    const accessCode = document.getElementById('access-code').value.trim();

    loginBtn.classList.add('loading');
    loginBtn.textContent = 'Signing in...';

    setTimeout(() => {
      try {
        const user = Auth.login(username, password, accessCode || null);
        loginBtn.textContent = 'Redirecting...';
        setTimeout(() => {
          window.location.href = user.role === 'staff' ? 'dashboard.html' : 'checkin.html';
        }, 400);
      } catch (err) {
        loginBtn.classList.remove('loading');
        loginBtn.textContent = 'Sign In';
        UI.showMessage('login-msg', err.message, 'error');
        // Shake the form card
        const card = document.querySelector('.auth-card');
        if (card) {
          card.style.animation = 'shake 0.35s ease';
          setTimeout(() => card.style.animation = '', 350);
        }
      }
    }, 500);
  });
});
