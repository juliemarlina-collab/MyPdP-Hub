# MyPdP Insight – Version 1 Prototype (Option B)

This is a student tracking and monitoring website for students and lecturers. It is **bilingual (BM / EN)**.

| Part | Where it lives | File(s) |
|---|---|---|
| Website (what users see) | GitHub Pages | `frontend/` folder |
| Backend (the logic) | Google Apps Script | `backend/Code.gs`, `backend/Core.js`, `backend/appsscript.json` |
| Database | Google Sheet (14 tabs) | `backend/MyPdP_Insight_Database.xlsx` (a copy is already in the CPCM Drive folder as a Google Sheet) |
| MC & assignment files | Private Google Drive folder | Created automatically by `setup()` |

**Try it first (no setup):** open `frontend/index.html`. With `API_URL` empty, the site runs in **demo mode** with made-up data. Lecturer: `L001`. Students: `S003`, `S005`, `S007`. **PIN: 1234** for all.

---

## What Version 1 does

**Students**
- Dashboard: attendance %, risk status, tasks due, latest marks
- Check in to class by scanning the lecturer's QR code, or typing the 6-character code
- Attendance record, with the calculation shown
- **MC / absence claim**: upload a PDF, JPG or PNG and track its status
- Tasks: submit a link or file, then see marks and feedback
- Consultation: book a lecturer's free slot and see its status
- Notifications

**Lecturers**
- Dashboard: class attendance %, submission rate, average mark, students needing attention, pending claims, work to grade
- Classes & students: risk list (🔴🟠🟡🟢) and a **timeline** for each student
- Take attendance: create a session, show a QR code, or mark P / L / A / E manually
- Review claims: **approving a claim automatically changes the attendance to "Absent with reason" (E)**, and the change is logged
- Tasks & marking: create a task (all students are notified), open submissions, give marks and feedback
- Consultation: add slots (clashes are blocked), then confirm, reject or complete requests. **A completed consultation is saved automatically in the student's follow-up log.**
- Reports: CSV downloads of attendance, task status & marks, and the PdP monitoring report

**Risk rules** (change the numbers in the *Settings* tab):
- 🔴 High Attention: attendance below the minimum **and** at least one missing task
- 🟠 Intervention Needed: attendance below the minimum, **or** 2 or more missing tasks, **or** marks dropped twice in a row
- 🟡 Monitor: 1 missing task, **or** attendance within 5% above the minimum
- 🟢 On Track: none of the above

---

## Setup (about 30 minutes, one person)

### Step 1 – The Google Sheet (database)
1. Open **MyPdP Insight – Database** in the CPCM Drive folder. It is an empty Google Sheet, and `setup()` in Step 2 creates all 14 tabs for you.
2. **Optional: load the sample data for testing.** In the Sheet, go to **File > Import > Upload** and choose `backend/MyPdP_Insight_Database.xlsx`, then pick **Replace spreadsheet**. This gives you 2 lecturers, 12 students, 3 classes and 7 weeks of records. All PINs are 1234.
3. Keep all tab names and header rows exactly as they are.

### Step 2 – Apps Script (backend)
1. In the Sheet, go to **Extensions > Apps Script**.
2. Delete the sample code, then create three files:
   - `Code.gs`: paste the contents of `backend/Code.gs`.
   - `Core.gs` (click **+ > Script**, name it `Core`): paste the contents of `backend/Core.js`.
   - `appsscript.json`: go to **Project Settings ⚙**, tick *Show "appsscript.json"*, then paste the contents of `backend/appsscript.json`. This sets the time zone to Asia/Kuala_Lumpur.
3. Save. Select the function **`setup`** and click **Run**, then allow the permissions.
   - This creates any missing tabs and a first admin login (**A001 / PIN 1234**, change it after you log in).
   - It also creates the private upload folder in your Drive and turns the PINs into secure hashes.
   - Reload the Sheet. A new **MyPdP Insight** menu appears.
4. Go to **Deploy > New deployment > Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
   - Open that URL in a browser. You should see `{"ok":true,"app":"MyPdP Insight API"...}`.

### Step 3 – GitHub Pages (website)
1. Create a new repository, e.g. `mypdp-insight`.
2. Upload everything **inside** `frontend/`.
3. Edit `config.js` and paste the Web app URL:
   ```js
   API_URL: 'https://script.google.com/macros/s/XXXX/exec',
   ```
4. Go to **Settings > Pages > Deploy from branch > main / root**. Your site will be at `https://<username>.github.io/mypdp-insight/`.

### Step 4 – Real users (before the pilot)
1. In the Sheet, delete the sample rows (**keep row 1**) in every tab **except Settings**.
2. **Users**: add one row per person.
   - `role` = student, lecturer or admin; `active` = TRUE.
   - Type a 4–8 digit PIN in `pin_hash`, then run **MyPdP Insight > Convert new PINs**.
   - Users can change their own PIN after logging in.
3. **Classes**: add each class, with `lecturer_id` set to the lecturer's `user_id`.
4. **Enrolments**: add one row for each student in each class. You can paste in a list from Excel.
5. **Settings**: check `attendance_threshold` (institution policy) and the other rules.
6. Share the **Uploads (PRIVATE)** folder with the lecturers only, as Viewer. Students can never open other people's MCs.

### Updating the code later
After changing `Code.gs` or `Core.gs`, go to **Deploy > Manage deployments > Edit ✏ > Version: New version > Deploy**. The URL stays the same.

---

## Data protection (PDPA) – please read
- Do **not** put real student data or MC files in the GitHub repository. GitHub holds the website only. All data stays in your Google Sheet and Drive.
- MC files go into a Drive folder that only you and the lecturers you share it with can open.
- Every change to attendance, every claim decision and every grade is recorded in the **AuditLog** tab.
- Set a retention period for MC files that follows your institution's policy, and delete old files at the end of each semester.
- A PIN login is fine for a pilot. For full rollout, consider Google sign-in with institution accounts.

## Known limits of Option B (fine for a pilot)
- Speed: each click takes about 1–3 seconds, because Apps Script reads the Sheet. This works well for a few classes (hundreds of students). For a whole polytechnic, move to a real database (Option A).
- Login sessions last up to 6 hours, then users log in again.
- Notifications appear inside the website only. Email reminders can be added later with `MailApp`.
- Admin work (users, classes, enrolments, settings) is done directly in the Sheet.

## Files
```
frontend/   index.html, style.css, app.js (screens), i18n.js (all BM/EN text – edit words here),
            config.js (API URL), core.js (same logic as backend, used in demo mode), demo-db.js, seed.js
backend/    Code.gs, Core.js (→ paste as Core.gs), appsscript.json, MyPdP_Insight_Database.xlsx
tools/      test scripts & sample-data generator (for developers)
```

## Ideas for Version 2
Exit tickets and an "I'm lost" button → topic mastery heatmap · CLO tracker · email and WhatsApp reminders · class comparison · auto remedial links · admin pages inside the website.
