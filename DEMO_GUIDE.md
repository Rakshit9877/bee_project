# MedQueue Presentation & Demo Guide

## 1. Project Overview & Technical Understanding

**What is MedQueue?**
MedQueue is a front-desk triage and priority queue system designed for clinics and emergency rooms. Instead of a traditional "first-come, first-served" approach which can be fatal in medical settings, MedQueue implements an intelligent algorithmic approach to patient check-ins. Patients self-report their symptoms, severity, and duration, and the system automatically assigns them a priority score, ensuring that critical patients are seen immediately.

**How the Priority System Works (Technical CS Overview)**
The core of the project is the `js/triage.js` and `js/queue.js` modules, built entirely in Vanilla JavaScript without backend frameworks, satisfying Phase 1 constraints. 

1. **Weighted Scoring (`triage.js`)**: 
   - Each symptom has a base weight (e.g., Chest Pain = 9, Fatigue = 1).
   - This base is multiplied by a **Severity Factor** (1.1x to 2.0x) derived from a 1-10 slider.
   - A **Duration Bonus** adds points for sudden onset (e.g., < 1 hour gets +10 points) because acute conditions are often more dangerous.
   - **Vital Red Flags** (like fainting or severe bleeding) add a flat +15 points each.
   - **NLP Text Analysis**: A custom script scans the "Additional Notes" field for emergency keywords (*pain, blood, crash*) and adds a +2 bonus per keyword.

2. **Insertion Sort Algorithm (`queue.js`)**:
   - The queue is maintained as a continuously sorted array in the browser's `localStorage`.
   - When a new patient is added, the system does not run a full `O(N log N)` sort on the entire queue. Instead, it uses an **Insertion Sort** approach (`O(N)` worst-case), iterating backwards from the end of the queue.
   - It shifts patients down until it finds the exact mathematical position where the new patient belongs.
   - **Tie-Breaking Rule**: If two patients have the exact same priority score, the algorithm checks their `registeredAt` timestamp. The patient who arrived earlier wins the tie, ensuring absolute fairness.

---

## 2. Complete Feature List

### Core Systems
- **Authentication System**: Patient and Staff roles. Staff require a secret 6-character Access Code to register/login.
- **State Management**: Uses `localStorage` and `sessionStorage` to mock a backend database perfectly.
- **Dynamic Queueing**: O(n) Insertion Sort for managing waiting patients.
- **Cross-Tab Synchronization**: Data syncs instantly across tabs. If a staff member marks a patient as served, the patient's screen updates automatically without refreshing.

### Newly Added Polish & Features
- **Dark Mode**: A fully functional theme toggle (light/dark) accessible from the Profile page, utilizing CSS variables.
- **Text Analysis**: Lightweight keyword analysis on patient notes to objectively bump priority scores.
- **Wait Time Estimation**: The patient status page dynamically calculates estimated wait times (Queue Position × 10 mins).
- **Print Ticket**: A dedicated button on the status page hooks into the browser's native `window.print()` to generate a clean, CSS-optimized physical receipt.
- **Duplicate Prevention**: Logical checks prevent a patient from submitting a new check-in if they already have a "waiting" status in the queue.
- **Staff Emergency Override**: A "Mark Critical" button on the staff dashboard bypasses the algorithm, assigning a score of 100 to instantly snap a deteriorating patient to the front of the line.
- **Public Ticket Lookup**: A standalone page where family members can track a patient's position using their unique Ticket ID (e.g., `TKT-4892`) without signing in.
- **Visit History**: A table on the patient profile displaying past check-ins, scores, and dates.

---

## 3. Demo Presentation Flow (Step-by-Step Script)

*Use this script when presenting to your instructor. It is designed to highlight the CS logic and thoughtful edge-case handling.*

### Step 1: The Landing Page & Authentication
> **Speaker:** "Welcome to MedQueue. Our goal was to build a smart triage system using only Vanilla HTML, CSS, and JS. First, I'll demonstrate the role-based authentication. We have two distinct user flows: Patients and Staff."
- *Action:* Go to `signup.html`. Create a patient account. 
> **Speaker:** "Notice how if I try to sign up as staff, the system generates a secure 6-character Access Code. For now, I'll log in as a Patient."

### Step 2: Patient Check-in (Showcasing Duplicate Prevention & NLP)
> **Speaker:** "As a patient, I'm presented with the check-in form. We built in strict logical constraints: a patient cannot spam the queue. If they already have an active request, the system blocks them from creating a new one."
- *Action:* Fill out the form. Select 'Severe Headache', severity 8. 
- *Action:* In the 'Additional Notes' section, type: *"I am in extreme pain and bleeding."*
> **Speaker:** "We also built a lightweight keyword scanner. Since we can't use an AI backend yet, our JS scans this text for keywords like 'pain' and 'bleeding', which will algorithmically bump their score."
- *Action:* Click Submit.

### Step 3: Status Page & Wait Times
> **Speaker:** "Here is the Status Page. The system generated a unique Ticket ID. You can see the math breakdown of the score, including the 'Text analysis' bonus we just triggered."
- *Action:* Point out the Estimated Wait Time and the Print Ticket button.
> **Speaker:** "We calculate estimated wait times dynamically based on their exact queue position. We also added a CSS-optimized Print Ticket feature for physical clinics."

### Step 4: The Profile & Dark Mode
> **Speaker:** "If we navigate to the Profile, patients can see their complete Visit History. We also implemented a fully functional Dark Mode using CSS variables and local storage."
- *Action:* Toggle Dark Mode on and off. 

### Step 5: Staff Dashboard & Insertion Sort
> **Speaker:** "Now, I'll open a new tab and log in as a Staff member."
- *Action:* Open a new tab, login as Staff. Go to Dashboard.
> **Speaker:** "The Staff dashboard pulls the live queue. This queue isn't just sorted with a standard `.sort()`. We wrote a custom Insertion Sort algorithm. When a new patient arrives, it iterates backward and inserts them in O(n) time, enforcing a strict first-come-first-served tie-breaker if scores match."

### Step 6: Emergency Override (The "Wow" Factor)
> **Speaker:** "Finally, algorithms aren't perfect. If a staff member visually sees a patient deteriorating in the waiting room, we built an 'Emergency Override'."
- *Action:* Click the red "Mark Critical" button on a patient.
> **Speaker:** "Clicking this overrides their score to 100. Our Insertion Sort instantly snaps them to the front of the line. If I click 'Call Next Patient', they are removed from the waiting list, and if we look at the Patient's tab, their screen has automatically updated to 'Served' via cross-tab synchronization."

### Conclusion
> **Speaker:** "By combining mathematical weighted scoring, custom sorting algorithms, and rigorous edge-case handling, we've built a robust, professional Phase 1 foundation ready for a real backend."
