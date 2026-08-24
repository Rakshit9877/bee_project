const Auth = {
  // Data Access
  getUsers() {
    const usersJson = localStorage.getItem('triageapp_users');
    return usersJson ? JSON.parse(usersJson) : [];
  },

  saveUsers(users) {
    localStorage.setItem('triageapp_users', JSON.stringify(users));
  },

  // Auth Actions
  signup(userData) {
    const users = this.getUsers();
    
    // Check for duplicate username
    if (users.find(u => u.username === userData.username)) {
      throw new Error('Username is already taken');
    }

    const newUser = {
      id: 'u_' + Date.now(),
      name: userData.name,
      username: userData.username,
      password: userData.password,
      role: userData.role,
      accessCode: userData.role === 'staff' ? this.generateAccessCode() : null,
      createdAt: new Date().toISOString(),
      totalRequests: 0,  // patients: times checked in
      totalServed: 0     // staff: patients called
    };

    users.push(newUser);
    this.saveUsers(users);
    return newUser;
  },

  login(username, password, accessCode) {
    const users = this.getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
      throw new Error('Invalid username or password');
    }

    // Staff accounts require access code
    if (user.role === 'staff') {
      if (!accessCode || accessCode.toUpperCase() !== user.accessCode) {
        throw new Error('Invalid access code. Staff accounts require a valid access code to sign in.');
      }
    }

    // Set current session
    const sessionUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    };
    sessionStorage.setItem('triageapp_currentUser', JSON.stringify(sessionUser));
    return user;
  },

  logout() {
    sessionStorage.removeItem('triageapp_currentUser');
    window.location.href = 'login.html';
  },

  getCurrentUser() {
    const userJson = sessionStorage.getItem('triageapp_currentUser');
    return userJson ? JSON.parse(userJson) : null;
  },

  // Route Guarding
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

  // Profile Helpers
  getFullUser(userId) {
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  },

  updateUser(userId, updates) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    Object.assign(users[idx], updates);
    this.saveUsers(users);
    return users[idx];
  },

  incrementStat(userId, field) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user[field] = (user[field] || 0) + 1;
      this.saveUsers(users);
    }
  },

  // Access Code
  generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/1/0 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  regenerateAccessCode(userId) {
    const newCode = this.generateAccessCode();
    this.updateUser(userId, { accessCode: newCode });
    return newCode;
  },

  // Check if a username belongs to a staff account
  isStaffUsername(username) {
    const users = this.getUsers();
    const user = users.find(u => u.username === username);
    return user ? user.role === 'staff' : false;
  }
};
