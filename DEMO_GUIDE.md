# MedQueue Presentation & Demo Guide

## 1. Project Overview & Technical Understanding

**What is MedQueue?**
MedQueue is an educational front-desk triage and priority queue system. Patients self-report symptoms, severity, and duration, and the server calculates a priority score to organize a demonstration queue. It is not a clinical decision-making tool.

**How the Priority System Works (Technical CS Overview)**
The browser interface uses vanilla JavaScript and calls the Node.js/Express API. Queue entries and accounts are stored in SQLite by the backend.

1. **Weighted Scoring (`triage.js`)**: 
   - Each symptom has a base weight (e.g., Chest Pain = 9, Fatigue = 1).
   - This base is multiplied by a **Severity Factor** (1.1x to 2.0x) derived from a 1-10 slider.
   - A **Duration Bonus** adds points for sudden onset (e.g., < 1 hour gets +10 points) because acute conditions are often more dangerous.
   - **Vital Red Flags** (like fainting or severe bleeding) add a flat +15 points each.
   - **NLP Text Analysis**: A custom script scans the "Additional Notes" field for emergency keywords (*pain, blood, crash*) and adds a +2 bonus per keyword.

2. **Server-side Queue Ordering**:
   - Queue entries persist in SQLite and the API returns waiting patients ordered by descending score.
   - Arrival time breaks ties so earlier check-ins are listed first.

---

## 2. Complete Feature List

### Core Systems
- **Authentication System**: Patient and Staff roles, hashed passwords, expiring signed login tokens, and staff access codes. Staff registration requires an administrator-configured invitation code.
- **State Management**: Accounts and queue entries persist in SQLite; authenticated API routes enforce patient ownership and staff-only actions.
- **Live Dashboard**: The staff dashboard polls the API for queue changes.

### Newly Added Polish & Features
- **Dark Mode**: A fully functional theme toggle (light/dark) accessible from the Profile page, utilizing CSS variables.
- **Text Analysis**: Lightweight keyword analysis on patient notes to objectively bump priority scores.
- **Wait Time Estimation**: The patient status page dynamically calculates estimated wait times (Queue Position × 10 mins).
- **Print Ticket**: A dedicated button on the status page hooks into the browser's native `window.print()` to generate a clean, CSS-optimized physical receipt.
- **Duplicate Prevention**: Logical checks prevent a patient from submitting a new check-in if they already have a "waiting" status in the queue.
- **Staff Emergency Override**: A "Mark Critical" button on the staff dashboard bypasses the algorithm, assigning a score of 100 to instantly snap a deteriorating patient to the front of the line.
- **Public Ticket Lookup**: A standalone page where visitors can track a patient's position using a ticket ID without seeing symptom details.
- **Visit History**: A table on the patient profile displaying past check-ins, scores, and dates.

---

## 3. Demo Presentation Flow (Step-by-Step Script)

*Use this script when presenting to your instructor. It is divided among your 3 team members. It is written to be conversational, punchy, and easy to speak aloud.*

### Introduction & Problem Statement
> **Speaker 1:** "Good evening! Today we are presenting MedQueue, an educational priority-queue project. 
> "The project demonstrates priority-based ordering and a persistent backend, rather than a first-come, first-served list.
> "Patients report their symptoms, and the Express API calculates a score and stores each check-in in SQLite. This is a software demonstration, not clinical decision support."

### Step 1: The Landing Page & Authentication
> **Speaker 1:** "First, I'll show our role-based login. We built two separate flows: Patients and Staff. This keeps data secure."
- *Action:* Go to `signup.html`. Create a patient account. 
> **Speaker 1:** "Staff signup requires an administrator-configured invitation code. For this demo, I'll sign in as a Patient."

### Step 2: Patient Check-in (Duplicate Prevention, NLP, & Editing)
> **Speaker 2:** "I'll take over to show the Patient Check-in. First, notice our strict logical checks. We don't want a panicked patient submitting the form five times. Our system actively checks their status. If they are already in the queue, it blocks them from submitting a new request until they are seen."
- *Action:* Fill out the form slowly. Select 'Severe Headache', severity 8, and duration '< 1 hour'.
> **Speaker 2:** "While filling this out, you can see we collect hard data. An issue that started an hour ago might be more dangerous than one that started a month ago, and our math reflects that."
- *Action:* In the 'Additional Notes' section, type: *"I am in extreme pain and bleeding."*
> **Speaker 2:** "Because we can't use an AI backend yet, we wrote a lightweight keyword scanner in JavaScript. It reads this text for emergency words like 'pain' or 'bleeding' and automatically bumps their priority score."
- *Action:* Click Submit. Once the status page loads, click the "Edit My Request" button.
> **Speaker 2:** "If a patient makes a mistake or gets worse while waiting, they don't need a receptionist. They can click 'Edit Request'. This pulls them out, lets them update their symptoms, recalculates their score, and puts them right back in."
- *Action:* Click Submit again.

### Step 3: Status Page & Wait Times
> **Speaker 2:** "Here is the live Status Page. You can see the math behind their score, including the keyword bonus we just triggered."
- *Action:* Point out the Estimated Wait Time and the Print Ticket button.
> **Speaker 2:** "We calculate wait times dynamically based on their exact spot in the queue. We also added a Print Ticket button, and a Dark Mode toggle in the profile."

### Step 4: Staff Dashboard & API-backed Queue
> **Speaker 3:** "Now, I'll log in as Staff to show the backend logic."
- *Action:* Split your screen into two browser windows side-by-side. Put the Staff Dashboard on the left, and a new Patient Check-in form on the right.
> **Speaker 3:** "This dashboard on the left pulls the live queue from our Express API, which persists data in SQLite. Watch what happens when a new patient arrives."
- *Action:* On the right window, quickly submit a medium-priority patient (e.g., 'Cough', severity 5). Point to the left window as the new patient instantly pops into the exact middle of the queue.
> **Speaker 3:** "The server orders patients by calculated priority, and if two have the same score, the one who arrived first wins the tie."

### Step 5: Emergency Override & Cross-Tab Sync (The "Wow" Factor)
> **Speaker 3:** "But algorithms aren't perfect. If a doctor sees a patient rapidly getting worse, we built a manual 'Emergency Override'."
- *Action:* Ensure you have the Staff Dashboard on the left, and that specific Patient's Status Page on the right window. Click the red "Mark Critical" button on the Staff Dashboard.
> **Speaker 3:** "Clicking this boosts their score to 100. Our code instantly snaps them to the front of the line. Now watch the patient's screen on the right when I click 'Call Next Patient'."
- *Action:* Click "Call Next Patient" on the Staff Dashboard. Point to the Patient window as it instantly changes to "Served!".
> **Speaker 3:** "They are removed from the queue, and thanks to local storage sync, the Patient's own screen automatically updates to 'Served' without them ever touching their device."

### Conclusion & Phase 2 Future Scope
> **Speaker 1:** "To conclude, this project demonstrates server-side CRUD, role-based access control, persistent SQLite storage, and priority scoring."
> "For **Phase 2**, we will upgrade this to a full **MERN Stack**. We'll replace Local Storage with a real MongoDB database, swap our keyword scanner for a real AI like Gemini to read patient notes, and use WebSockets for instant dashboard updates. Thank you."
