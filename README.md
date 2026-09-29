# MyPdP Insight – Demo UI update

Student tracking and monitoring for students and lecturers, with a BM/EN switch.

## Demo entry
The welcome page presents separate Student, Lecturer and Admin choices. Each choice shows a role-specific login hint and fictional demo accounts. The admin demo account is A001; all demo accounts use PIN 1234. The role shown after login is determined by the authenticated account, not by the selected card.

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
