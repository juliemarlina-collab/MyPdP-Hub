# MyPdP Insight – Demo UI update

## Version 1.3 (30 Sep 2026) – visual identity
- **Each course has its own colour** (blue, lime, black, periwinkle, sky), used everywhere: course headers, course groups on the lecturer dashboard, Kursus Saya, class pages, attendance/tasks/marks pages and course tags.
- **Long pages are split by course:** student Attendance and Tasks show a coloured header per course (number 01/02/03, course code, class, big attendance %) and a jump bar at the top.
- **Students, lecturers and admin look different:** students have round blue avatars, lecturers rounded-square lime avatars (shown as "Pensyarah" chips), admin square black avatars.
- **Numbered sections** (01, 02, 03 …) on dashboards; the admin "Semua Kelas" page groups classes under a dark band per lecturer.

## Version 1.2 (30 Sep 2026)
- **Log out on phones & tablets:** the bottom bar now shows 4 main items plus **Lagi / More**, which opens a menu with the other pages, About us, Change PIN and **Log keluar**. The name menu at the top also opens on screen now.
- **Check-in page:** the illustration no longer makes the page scroll sideways on tablets. New **Imbas kod QR / Scan QR code** button opens the camera inside the app (BarcodeDetector where available, otherwise `vendor/jsQR.min.js`).
- **Rotating QR code:** the lecturer's QR screen changes the code every 30 seconds (the previous code is still accepted for 20 seconds), so a code shared on WhatsApp stops working almost at once. Closing the QR screen ends the check-in window.
- **AI summary:** the student timeline has a **Ringkasan & cadangan tindakan** card. With `AI_API_KEY` (an Anthropic API key) set under Apps Script > Project Settings > Script properties, the summary and 2–3 suggested actions are written by Claude. Only numbers (attendance, tasks, marks) are sent, never the name or ID. Without the key (and in demo mode) a rule-based summary is shown and clearly labelled "tanpa AI". Each suggestion can be saved as a follow-up.
- **About us page** (`#/about`, also linked in the footer and the More menu): the problem, the team (Kumpulan 2), how AI was used, and data privacy.
- Landing page: the ★★★★★ row is removed and sections below the hero no longer fade in, so there are no blank gaps while scrolling.

**To publish:** upload `index.html`, `app.js`, `core.js`, `i18n.js`, `style.css`, `README.md` and the `vendor/` folder to the repository root. Paste `apps-script/Code.gs` and `apps-script/Core.gs` into the Apps Script project and deploy a new version (it will ask for permission to connect to an external service, needed for the AI summary).


## Hero assets restored (1.1.4)
The welcome hero image and animated flip cards already work on the live page. `config.js` previously left `bannerLecturer` and `bannerStudent` empty, so the dashboard greeting banners showed only their gradients. Both slots now point to the included `images/banner-lecturer.png` and `images/banner-student.png`. The images remain confined to greeting banners; the original layout and navigation colours are unchanged. `index.html` loads a fresh configuration version to avoid stale browser caching.

## Class-focused dashboards and reports (1.1.3)
Lecturer Dashboard now groups classes by course. Choose a class to see only its attendance chart, students needing attention, deadlines, and quick links for attendance, marking, and reports. Repeated global metric tiles have been removed. Attendance, Tasks, and Lecturer Reports show a clear selected-class banner, and their class picker groups options under course names.

Admin Reports now has an institution overview, a selected-class snapshot, and a separate CSV download section. Every CSV button exports the selected class only. Admin All Classes groups classes by lecturer. On the Student Marks page, cards use three columns on wide screens and the risk badge is labelled as the overall class status; the repeated description in MC Claims has been removed.

To publish, extract this ZIP and upload its five files to the root of the GitHub Pages repository, replacing matching files. `API_URL` remains blank for the fictional-data demo; Apps Script is not required for it.

## Presentation layout update (1.1.2)
The demo account samples now span the full page width below the login and feature tiles, with three horizontal account cards on desktop. All page canvases use white; the coloured navigation and animated welcome hero remain intact. The welcome page, signed-in screens and PIN setup page share a bilingual footer. To publish this build, upload the files in this ZIP to the root of the GitHub Pages repository and replace matching files. Keep the `images/` and `apps-script/` folders in their existing locations. `API_URL` remains empty, so the fictional demo works without deploying Apps Script.

Student tracking and monitoring for students and lecturers, with a BM/EN switch.

## Demo entry
The original welcome hero, animated flip cards and moving feature strip are preserved. The separate Student, Lecturer and Admin choices sit below them, before the login form. Each choice shows a role-specific login hint and fictional demo accounts. The admin demo account is A001; all demo accounts use PIN 1234. The role shown after login is determined by the authenticated account, not by the selected card.

Lecturer dashboards contain only assigned classes. The admin overview shows all classes and reports; user imports and account management remain in the connected Google Sheet / Apps Script editor. The student attendance figure in the greeting banner is labelled as the average of course attendance rates.

The generated lecturer and student banner files are included in `images/`, but `config.js` leaves both banner slots empty to preserve the gradient for the presentation. To use either photo later, set its corresponding `IMAGES` value to the file path.

- **Live site:** https://juliemarlina-collab.github.io/MyPdP-Hub/
- **This repo:** the website files sit at the top level, because GitHub Pages serves those. `images/` holds the header and illustration pictures (see `images/README-IMAGES.md`).
- **`apps-script/`:** backend code only (`Code.gs`, `Core.gs`, `appsscript.json`). Paste it into the Google Sheet under **Extensions > Apps Script**. The website does not use this folder.

## Connect to the Google Sheet
1. In the Google Sheet, go to **Extensions > Apps Script**. Paste `Code.gs` and `Core.gs`, run `setup` once, then go to **Deploy > New deployment > Web app** (Execute as: Me, Access: Anyone).
2. Copy the `/exec` URL and paste it into `config.js` → `API_URL: '...'`, then commit.
3. When `API_URL` is empty, the site runs in **demo mode** with fictional data.

## Keep private (never upload here)
Student class lists, the import template, the demo Excel data and MC files belong on Google Drive, not in this public repo.
