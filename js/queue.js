// Queue management and core sorting logic

const Queue = {
  // Load queue from localStorage
  loadQueue() {
    const qJson = localStorage.getItem('triageapp_queue');
    return qJson ? JSON.parse(qJson) : [];
  },

  // Save queue to localStorage
  saveQueue(queue) {
    localStorage.setItem('triageapp_queue', JSON.stringify(queue));
  },

  /**
   * Generates a human-readable ticket number.
   * Format: TKT-XXXX where X is a random digit.
   * Checks for collisions against the existing queue.
   */
  generateTicket(queue) {
    let ticket;
    const existing = new Set(queue.map(p => p.ticket));
    do {
      const num = Math.floor(1000 + Math.random() * 9000);
      ticket = 'TKT-' + num;
    } while (existing.has(ticket));
    return ticket;
  },

  /**
   * Checks whether a user already has an active (waiting) request.
   * Returns the existing entry if found, null otherwise.
   */
  hasActiveRequest(userId) {
    const queue = this.loadQueue();
    return queue.find(p => p.patientId === userId && p.status === 'waiting') || null;
  },

  /**
   * Finds a queue entry by its ticket number (for public lookup).
   */
  getEntryByTicket(ticketNumber) {
    const queue = this.loadQueue();
    return queue.find(p => p.ticket === ticketNumber.toUpperCase()) || null;
  },

  /**
   * Updates fields on an existing queue entry, recalculates score,
   * and re-sorts the queue.
   */
  updateEntry(entryId, updatedFields, newScore) {
    let queue = this.loadQueue();
    const idx = queue.findIndex(p => p.id === entryId);
    if (idx === -1) return null;

    Object.assign(queue[idx], updatedFields);
    if (newScore !== undefined) {
      queue[idx].triageScore = newScore;
    }

    const entry = queue.splice(idx, 1)[0];
    this.insertPatient(queue, entry);
    this.saveQueue(queue);
    return entry;
  },

  /**
   * Inserts a new patient into the queue using an Insertion Sort algorithm.
   */
  insertPatient(queue, patientEntry) {
    let i = queue.length - 1;

    while (i >= 0) {
      const currentElement = queue[i];
      
      if (currentElement.status === 'served') {
          i--;
          continue;
      }

      const isMoreUrgent = patientEntry.triageScore > currentElement.triageScore;
      
      const isTieButEarlier = (patientEntry.triageScore === currentElement.triageScore) && 
                              (new Date(patientEntry.registeredAt) < new Date(currentElement.registeredAt));

      if (isMoreUrgent || isTieButEarlier) {
        i--;
      } else {
        break;
      }
    }

    queue.splice(i + 1, 0, patientEntry);
    return queue;
  },

  // Mark the top waiting patient as served
  callNextPatient(queue) {
    // Find the first patient with status 'waiting'
    const index = queue.findIndex(p => p.status === 'waiting');
    if (index !== -1) {
      queue[index].status = 'served';
      queue[index].servedAt = new Date().toISOString();
    }
    return queue;
  },

  // Get 1-based position among waiting patients
  getPatientPosition(queue, patientId) {
    let position = 1;
    for (const p of queue) {
      if (p.id === patientId) return position;
      if (p.status === 'waiting') position++;
    }
    return -1; // Not found
  },

  // Count total requests ever made by a user
  getRequestCount(userId) {
    const queue = this.loadQueue();
    return queue.filter(p => p.patientId === userId).length;
  }
};
