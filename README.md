# MyPdP Insight – Release 1.1 (Option B)

Student tracking and monitoring for students and lecturers, with a BM/EN switch.
The website runs on GitHub Pages, the backend on Google Apps Script, and the data lives in a Google Sheet plus a private Drive folder.

## What's in this zip

| Folder | What it is | Where it goes |
|---|---|---|
| `github-pages/` | The website: 8 files, `.nojekyll` and the **`images/` folder** (empty picture slots) | Upload **only the contents of this folder** to your GitHub repo |
| `apps-script/` | `Code.gs`, `Core.gs`, `appsscript.json` | Paste into the Google Sheet (**Extensions > Apps Script**) |
| `private-data/` | `MyPdP_Import_Template.xlsx` for class lists, and `MyPdP_Insight_KTCM_Demo_Data_v3.xlsx` (fictional, for testing) | Keep on Google Drive. **Never upload to GitHub** |

The website on GitHub contains **no real data**. Student lists, marks and MC files stay in the restricted Sheet and Drive folder.
`seed.js` holds fictional demo data only. Once `API_URL` is set, it is not used, and you can delete it.

---

## Changes in release 1.1 (from the code review)

**Pilot safeguards**

- **Login throttling:** after 5 wrong PINs, that ID is locked for 15 minutes.
- **Individual first-login PINs:** menu **MyPdP Insight > Issue individual first-login PINs** gives every new user a random 6-digit PIN. The PINs are listed once in a `PIN_Handout` tab. Hand them out privately, then delete the tab.
- **PIN change at first login:** users with `must_change_pin = TRUE` can do nothing until they set their own 6–8 digit PIN. Easy PINs such as `123456` or `111111` are refused.
- **QR can't overwrite an approved absence:** a QR check-in can no longer change **E** (Absent with reason) to Present.
- **Documented corrections:** a lecturer changing an **E** must type a reason. It is saved in AuditLog as `attendance_correction`.
- **Follow-up log check:** `addIntervention` now confirms that the student is enrolled in the selected class.

**Workspace and data quality**

- **My Courses:** lecturers now see **Semester → Course → Class**. Each course has a cover thumbnail with its code, and each class shows students, attendance and the number at risk.
- **Consultations:** students choose which class a consultation is about. That `class_id` is saved on the booking and used when the session is logged as a follow-up.
- **Assessment order:** new `Tasks.seq` column. "Marks dropping" follows this order, not the due date. New tasks get the next number automatically.
- **Risk evidence:** each alert shows why. For example:
  - "Attendance 62.5% (3 absent of 8 sessions; minimum 80%)"
  - "1 missing: Task 2: Proposal draft"
  - "Marks dropping: Task 1 85% → Task 2 70% → Task 3 58%"
- **Visuals:** text-free illustrations on the check-in, claims, tasks, consultation and reports pages, so no English is left inside a BM page. There are no large photos on data pages.
- **Optional welcome photo:** set `HERO_PHOTO: 'hero.jpg'` in `config.js` and upload your own photo next to `index.html`. Use a photo with no text in it, and get consent from the people shown.

**Picture slots (new):** `github-pages/images/` is ready for header and illustration pictures. Drop in files with the exact names listed in `images/README-IMAGES.md`, which also has sizes and ready-made prompts, and they appear automatically. Any missing picture keeps the built-in design. The slots are:
- the login header (`hero.png`),
- the lecturer and student dashboard banners,
- one My Courses tile per field: Bahasa & Komunikasi, Pengajian Am, Matematik & Sains, Kejuruteraan Mekanikal, Agroteknologi & Bio-Industri, plus one for any other field,
- illustrations for Check-in, Claims, Tasks, Consultation and Reports.

**Existing Sheets upgrade automatically.** Run `setup` once after pasting the new code, and it adds the new columns (`must_change_pin`, `seq`, `class_id`) without touching your data.

---

## Setup (about 30 minutes)

### 1. Google Sheet + Apps Script
1. Create a **new, empty** Google Sheet named "MyPdP Insight – Database". Use a separate copy for testing with the demo data.
2. Go to **Extensions > Apps Script** and create `Code.gs` and `Core.gs` from the `apps-script/` folder. Go to **Project Settings**, tick *Show "appsscript.json"* and paste in that file too.
3. Run **`setup`** once and allow the permissions. It:
   - creates the 14 tabs,
   - creates the private upload folder,
   - creates the first admin, **A001 / PIN 1234**, who must change it at first login.
4. Go to **Deploy > New deployment > Web app**, with *Execute as*: **Me** and *Who has access*: **Anyone**. Copy the `/exec` URL.

### 2. Website (GitHub Pages)
1. Upload the contents of `github-pages/` to a new repo.
2. In `config.js`, set `API_URL: 'https://script.google.com/macros/s/…/exec'`.
3. Go to **Settings > Pages > Deploy from branch > main / (root)**.

### 3. Importing each lecturer's Excel class list
1. Each lecturer fills in **`MyPdP_Import_Template.xlsx`**. It has three tabs:
   - **Users:** one row per person.
   - **Classes:** one row per class group, with the lecturer's `lecturer_id`.
   - **Enrolments:** one row per student per class. A student in two courses has one Users row and two Enrolments rows.
2. Paste each tab, values only, under row 1 of the matching tab in the Sheet. Leave `pin_hash` empty.
3. Run **MyPdP Insight > Validate imported class lists**. The `Validation` tab lists problems with row numbers and how to fix each one, for example:
   - duplicate IDs, missing names or unknown lecturers,
   - course codes that don't look like `DUE50132`,
   - mixed semester spellings, duplicate or broken enrolments,
   - students with no class.
4. When the Validation tab shows no problems, run **MyPdP Insight > Issue individual first-login PINs**.

### Updating the code later
Go to **Deploy > Manage deployments > Edit > Version: New version > Deploy**. The URL stays the same.

---

## Data protection (PDPA)
- The GitHub repo is public and holds code only. Real data never goes there.
- MC files are stored in a Drive folder shared only with lecturers, as Viewer. Set a retention period that follows institution policy.
- AuditLog records every attendance change, correction, claim decision, grade and PIN change.
- For full rollout after the pilot, consider Google sign-in with institution accounts instead of PINs.

## Known limits (fine for a pilot)
- Each action takes about 1–3 seconds, because Apps Script reads the Sheet. This works for a few classes and hundreds of students.
- Login sessions last up to 6 hours.
- Notifications appear inside the website only.
- Admin work (users, classes, settings) is done in the Sheet.
- A separate `Courses` table is not needed yet, because each class row already carries its course code and name. Add one when several lecturers share and edit the same course details.

## Demo logins (demo mode only, PIN 1234)
- L004: lecturer
- L002: has a pending claim to review
- S003: an at-risk student
- S005: a student in 3 courses
- S051: a student with a pending claim
