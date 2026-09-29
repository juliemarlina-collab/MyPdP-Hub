# MyPdP Insight – Release 1.1

Student tracking and monitoring for students and lecturers, with a BM/EN switch.

- **Live site:** https://juliemarlina-collab.github.io/MyPdP-Hub/
- **This repo:** the website files sit at the top level, because GitHub Pages serves those. `images/` holds the header and illustration pictures (see `images/README-IMAGES.md`).
- **`apps-script/`:** backend code only (`Code.gs`, `Core.gs`, `appsscript.json`). Paste it into the Google Sheet under **Extensions > Apps Script**. The website does not use this folder.

## Connect to the Google Sheet
1. In the Google Sheet, go to **Extensions > Apps Script**. Paste `Code.gs` and `Core.gs`, run `setup` once, then go to **Deploy > New deployment > Web app** (Execute as: Me, Access: Anyone).
2. Copy the `/exec` URL and paste it into `config.js` → `API_URL: '...'`, then commit.
3. When `API_URL` is empty, the site runs in **demo mode** with fictional data.

## Keep private (never upload here)
Student class lists, the import template, the demo Excel data and MC files belong on Google Drive, not in this public repo.
