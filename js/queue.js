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

    // Update fields
    Object.assign(queue[idx], updatedFields);
    if (newScore !== undefined) {
      queue[idx].triageScore = newScore;
    }

    // Remove and re-insert to maintain sort order
    const entry = queue.splice(idx, 1)[0];
    this.insertPatient(queue, entry);
    this.saveQueue(queue);
    return entry;
  },

  /**
   * Inserts a new patient into the queue using an Insertion Sort algorithm.
   * 
   * WHY INSERTION SORT?
   * The queue array stored in localStorage is ALWAYS kept in a sorted state. 
   * When a single new patient arrives, re-running Array.sort() on the entire array 
   * (which could be O(N log N) depending on engine) is wasteful. Insertion sort is 
   * the optimal algorithm (O(N) in worst case, often O(1) or close to it if appending 
   * near the end) for adding a single element to an already-sorted structure.
   * 
   * TIE-BREAKING RULE:
   * If two patients have identical triageScores, the one with the *earlier* 
   * registeredAt timestamp is placed first. This enforces fairness: first-come, 
   * first-served among equally urgent patients. No one can "jump" someone with 
   * the exact same priority who arrived before them.
   */
  insertPatient(queue, patientEntry) {
    // Start at the end of the array
    let i = queue.length - 1;

    // Shift elements to the right to make room for the new entry,
    // AS LONG AS the current element has a LOWER priority than the new entry.
    // Priority comparison:
    // 1. Higher triageScore wins (goes earlier in queue/lower index)
    // 2. If scores equal, earlier registeredAt timestamp wins (stays earlier in queue)
    while (i >= 0) {
      const currentElement = queue[i];
      
      // We only care about comparing against 'waiting' patients.
      // Served patients are conceptually at the end of the queue or ignored for sorting here,
      // but to be safe, if we encounter a served patient, we should skip over them.
      // In this system, all waiting patients come before all served patients.
      if (currentElement.status === 'served') {
          // If the element we are looking at is already served, the new 'waiting' patient
          // must definitely go before it. We continue moving left.
          i--;
          continue;
      }

      // Is the new patient MORE urgent than the current element?
      const isMoreUrgent = patientEntry.triageScore > currentElement.triageScore;
      
      // Is it a tie, and did the new patient register EARLIER? (Very rare, but possible)
      // For tie-breaking, since we are moving back-to-front, if scores are equal,
      // the existing currentElement (which was added previously) likely has an earlier 
      // timestamp. We only shift if the new patient somehow has an *earlier* timestamp.
      const isTieButEarlier = (patientEntry.triageScore === currentElement.triageScore) && 
                              (new Date(patientEntry.registeredAt) < new Date(currentElement.registeredAt));

      if (isMoreUrgent || isTieButEarlier) {
        // The new patient has higher priority than the element at index i.
        // We must continue moving left to find the correct spot.
        i--;
      } else {
        // The current element has higher or equal priority (and arrived earlier).
        // We have found the correct insertion point! It belongs immediately AFTER this element.
        break;
      }
    }

    // Insert the new patient at the calculated index (i + 1)
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
