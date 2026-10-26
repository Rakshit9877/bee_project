const Queue = {
  async loadQueue() {
    const result = await API.request('/api/queue');
    return result.entries;
  },

  async hasActiveRequest(userId) {
    const entries = await this.loadQueue();
    return entries.find(entry => entry.patientId === userId && entry.status === 'waiting') || null;
  },

  async getEntryByTicket(ticketNumber) {
    try {
      const result = await API.request(`/api/queue/ticket/${encodeURIComponent(ticketNumber.toUpperCase())}`);
      return result.entry;
    } catch (error) {
      if (error.message === 'Ticket not found.') return null;
      throw error;
    }
  },

  async createEntry(formData) {
    const result = await API.request('/api/queue', { method: 'POST', body: formData });
    return result.entry;
  },

  async updateEntry(entryId, updatedFields, isCritical = false) {
    const result = isCritical
      ? await API.request(`/api/queue/${encodeURIComponent(entryId)}/priority`, { method: 'PATCH' })
      : await API.request(`/api/queue/${encodeURIComponent(entryId)}`, { method: 'PUT', body: updatedFields });
    return result.entry;
  },

  async deleteEntry(entryId) {
    await API.request(`/api/queue/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
  },

  async callNextPatient() {
    const result = await API.request('/api/queue/call-next', { method: 'POST' });
    return result.entry;
  },

  getPatientPosition(queue, patientId) {
    let position = 1;
    for (const entry of queue) {
      if (entry.id === patientId) return position;
      if (entry.status === 'waiting') position++;
    }
    return -1;
  },

  getRequestCount(queue, userId) {
    return queue.filter(entry => entry.patientId === userId).length;
  }
};
