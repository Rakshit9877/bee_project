const API = {
  // Live deployed Render backend URL
  backendUrl: 'https://medqueue-backend-9j6q.onrender.com',

  get baseUrl() {
    if (window.location.protocol === 'file:') return 'http://localhost:5001';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.includes('onrender.com')) {
      return '';
    }
    return window.MEDQUEUE_API_URL 
      || localStorage.getItem('medqueue_api_url') 
      || this.backendUrl;
  },

  async request(path, options = {}) {
    const token = sessionStorage.getItem('triageapp_token');
    const headers = new Headers(options.headers || {});
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (options.body !== undefined && !isFormData) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : (isFormData ? options.body : JSON.stringify(options.body))
    });

    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) Auth.clearSession();
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    return payload;
  }
};

const Auth = {
  signup(userData) {
    return API.request('/api/auth/signup', { method: 'POST', body: userData })
      .then(result => result.user);
  },

  async login(username, password, accessCode) {
    const result = await API.request('/api/auth/login', {
      method: 'POST',
      body: { username, password, accessCode }
    });
    sessionStorage.setItem('triageapp_token', result.token);
    sessionStorage.setItem('triageapp_currentUser', JSON.stringify(result.user));
    return result.user;
  },

  logout() {
    this.clearSession();
    window.location.href = 'login.html';
  },

  clearSession() {
    sessionStorage.removeItem('triageapp_token');
    sessionStorage.removeItem('triageapp_currentUser');
  },

  getCurrentUser() {
    const userJson = sessionStorage.getItem('triageapp_currentUser');
    if (!userJson || !sessionStorage.getItem('triageapp_token')) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      this.clearSession();
      return null;
    }
  },

  requireRole(requiredRole) {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    if (user.role !== requiredRole) {
      window.location.href = user.role === 'staff' ? 'dashboard.html' : 'checkin.html';
      return null;
    }
    return user;
  },

  async getFullUser() {
    const result = await API.request('/api/users/me');
    return result.user;
  },

  async updateUser(userId, updates) {
    const result = await API.request('/api/users/me', { method: 'PATCH', body: updates });
    sessionStorage.setItem('triageapp_currentUser', JSON.stringify(result.user));
    return result.user;
  },

  async regenerateAccessCode() {
    const result = await API.request('/api/users/me/access-code', { method: 'POST' });
    return result.accessCode;
  }
};
