document.addEventListener('DOMContentLoaded', () => {
  UI.setupHeader();

  // Already logged in → redirect
  const existing = Auth.getCurrentUser();
  if (existing) {
    window.location.href = existing.role === 'staff' ? 'dashboard.html' : 'checkin.html';
    return;
  }

  const form       = document.getElementById('signup-form');
  const signupBtn  = document.getElementById('signup-btn');

  // Role toggle styling
  document.querySelectorAll('input[name="role"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.role-option').forEach(c => c.classList.remove('selected'));
      radio.closest('.role-option').classList.add('selected');
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name            = document.getElementById('name').value.trim();
    const username        = document.getElementById('username').value.trim();
    const password        = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const role            = document.querySelector('input[name="role"]:checked').value;

    // Client-side validation
    if (password !== confirmPassword) {
      UI.showMessage('signup-msg', 'Passwords do not match.', 'error');
      return;
    }

    signupBtn.classList.add('loading');
    signupBtn.textContent = 'Creating account...';

    setTimeout(() => {
      try {
        const newUser = Auth.signup({ name, username, password, role });

        signupBtn.classList.remove('loading');
        signupBtn.textContent = 'Account created';

        // If staff, show the access code modal
        if (role === 'staff' && newUser.accessCode) {
          document.getElementById('modal-access-code').textContent = newUser.accessCode;
          document.getElementById('access-code-modal').classList.remove('hidden');
          
          document.getElementById('access-code-continue').addEventListener('click', () => {
            window.location.href = 'login.html';
          });
        } else {
          // Patient: redirect to login
          UI.showMessage('signup-msg', 'Account created. Redirecting to login...', 'success');
          setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        }
      } catch (err) {
        signupBtn.classList.remove('loading');
        signupBtn.textContent = 'Create Account';
        UI.showMessage('signup-msg', err.message, 'error');
      }
    }, 500);
  });
});
