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

  accessCodeGroup.style.display = 'block';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = document.getElementById('password').value;
    const accessCode = document.getElementById('access-code').value.trim();

    loginBtn.classList.add('loading');
    loginBtn.textContent = 'Signing in...';

    try {
      const user = await Auth.login(username, password, accessCode || null);
      window.location.href = user.role === 'staff' ? 'dashboard.html' : 'checkin.html';
    } catch (err) {
      loginBtn.classList.remove('loading');
      loginBtn.textContent = 'Sign In';
      UI.showMessage('login-msg', err.message, 'error');
      const card = document.querySelector('.auth-card');
      if (card) {
        card.style.animation = 'shake 0.35s ease';
        setTimeout(() => card.style.animation = '', 350);
      }
    }
  });
});
