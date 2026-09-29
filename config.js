/* MyPdP Insight — settings for the website.
   API_URL: paste your Apps Script Web App URL here (ends with /exec).
   Leave it empty ('') to run in DEMO MODE with fictional data (no Google account needed). */
window.MYPDP_CONFIG = {
  API_URL: '',
  INSTITUTION: 'KTCM',
  // IMAGES: put picture files in the images/ folder with these exact names and they appear automatically.
  // PNG, JPG or WEBP all work with the same name (e.g. hero.png or hero.jpg). A missing file is fine: the page keeps its built-in design. Use '' to switch one slot off.
  // Sizes and ready-made prompts: images/README-IMAGES.md
  USE_IMAGES: true,
  IMAGES: {
    hero:           'images/hero.png',            // Login / welcome sky header (16:9, 2400×1350)
    bannerLecturer: 'images/banner-lecturer.png', // Lecturer dashboard greeting banner (3:1, 2400×800)
    bannerStudent:  'images/banner-student.png',  // Student dashboard greeting banner (3:1, 2400×800)
    coverBahasa:      'images/cover-bahasa.png',            // My Courses tile – Bahasa & Komunikasi (1:1, 800×800)
    coverPengajianAm: 'images/cover-pengajian-am.png',      // My Courses tile – Pengajian Am
    coverMatSains:    'images/cover-matematik-sains.png',   // My Courses tile – Matematik & Sains
    coverMekanikal:   'images/cover-mekanikal.png',         // My Courses tile – Kejuruteraan Mekanikal
    coverAgro:        'images/cover-agroteknologi.png',     // My Courses tile – Agroteknologi & Bio-Industri
    coverOther:       'images/cover-other.png',             // My Courses tile – any other field
    spotCheckin: 'images/spot-checkin.png', // Class Check-in page (1:1, 600×600, transparent PNG)
    spotClaims:  'images/spot-claims.png',  // MC Claims page
    spotTasks:   'images/spot-tasks.png',   // Tasks page
    spotConsult: 'images/spot-consult.png', // Consultation page
    spotReports: 'images/spot-reports.png'  // Reports page (lecturer)
  },
  // Course tiles follow the lecturer's field (Users → programme). If that is blank, the course-code prefix decides.
  // Add prefixes here if needed, e.g. { DUW: 'pengajianam', DKE: 'mekanikal' }.
  // Fields: bahasa, pengajianam, matsains, mekanikal, agro
  BIDANG_BY_CODE: {},
  DEFAULT_LANG: 'ms'   // 'ms' = Bahasa Melayu, 'en' = English
};
