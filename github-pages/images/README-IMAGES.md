# MyPdP Insight – image slots

Put your pictures in **this folder** using the **exact file names** below, then upload the folder to GitHub.
A slot with no file keeps the built-in design, so you can add pictures one at a time.
To change a file name or switch a slot off, edit `IMAGES` in `config.js` (use `''` to switch one off).

**Format:** PNG is fine for every slot (JPG and WEBP also work under the same name, e.g. `hero.png` or `hero.jpg`). PNG photos are large, so compress them at tinypng.com; aim for under 500 KB each.

**All images:** no words or letters inside the image, because the BM/EN switch cannot translate them.  Only use photos of real people with their consent.

## Included in this release
✅ hero.png · cover-bahasa.png · cover-pengajian-am.png · cover-matematik-sains.png · cover-mekanikal.png · cover-agroteknologi.png · spot-tasks.png · spot-consult.png
⬜ Still open (optional): banner-lecturer.png · banner-student.png · cover-other.png · spot-checkin.png · spot-claims.png · spot-reports.png (these pages keep the built-in design until you add them)

| File name | Where it appears | Size | Tips |
|---|---|---|---|
| `hero.png` | Login / welcome page, behind the sky header | 16:9 · 2400×1350 · under 400 KB | Keep the **centre and top plain** (sky or windows). The headline sits in the centre and the flipping cards along the bottom |
| `banner-lecturer.png` | Lecturer dashboard greeting banner | 3:1 · 2400×800 · under 250 KB | Shows on the **right side**, faded under blue. Keep it soft and low-detail, because the stat cards sit on top |
| `banner-student.png` | Student dashboard greeting banner | 3:1 · 2400×800 · under 250 KB | Same as above |
| `cover-bahasa.png` | My Courses tile – **Bahasa & Komunikasi** | 1:1 · 800×800 | Shown at 86 px, so use ONE bold object. The course code appears at the **bottom-left**; keep that corner plain |
| `cover-pengajian-am.png` | My Courses tile – **Pengajian Am** | 1:1 · 800×800 | " |
| `cover-matematik-sains.png` | My Courses tile – **Matematik & Sains** | 1:1 · 800×800 | " |
| `cover-mekanikal.png` | My Courses tile – **Kejuruteraan Mekanikal** | 1:1 · 800×800 | " |
| `cover-agroteknologi.png` | My Courses tile – **Agroteknologi & Bio-Industri** | 1:1 · 800×800 | " |
| `cover-other.png` | My Courses tile – any other field | 1:1 · 800×800 | " |
| `spot-checkin.png` | Student **Class Check-in** page, beside the code box | 1:1 · 600×600 · transparent PNG | Illustration, not a photo |
| `spot-claims.png` | Student **MC Claims** page, top strip | 1:1 · 600×600 · transparent PNG | Document + approval tick. No medical records or pills |
| `spot-tasks.png` | Student **Tasks** page, top strip | 1:1 · 600×600 · transparent PNG | |
| `spot-consult.png` | Student **Consultation** page, top strip | 1:1 · 600×600 · transparent PNG | |
| `spot-reports.png` | Lecturer **Reports** page, top strip | 1:1 · 600×600 · transparent PNG | |

**How a course gets its tile:** by the lecturer's field (the `programme` column in Users), e.g. "Pengajian Am". If that is blank, the course-code prefix is used (DUE → Bahasa, DUW/MPU → Pengajian Am, DBM → Matematik & Sains, DJJ → Mekanikal, DMT → Agroteknologi). You can add more prefixes in `BIDANG_BY_CODE` in `config.js`.

Pages with no image slot: Attendance, Take Attendance, Review Claims, Tasks & Marking, Marks & Progress, class and student pages, Notifications, PIN setup. These are working screens, where pictures would compete with the data.

---

## Ready-made prompts (AI image generator)

**Add this style block to every prompt:**
```
Style: clean, modern, premium education brand. Palette: electric blue (#3B3FE0), sky blue (#5FB2FF), deep indigo (#2D2785), lime green accents (#C8F53C), white. Soft natural daylight, uncluttered. No text, no letters, no numbers, no logos, no watermarks, no readable screens.
Negative: text, words, signage, logos, school crests, distorted hands, extra fingers, cluttered background, dark lighting.
```

**hero.png**
```
Wide realistic photo of a bright, modern Malaysian polytechnic classroom seen from the back. A lecturer and a small, diverse group of diploma students are gathered at a table at the FAR RIGHT EDGE, small in the frame. The centre and top two-thirds are large windows with bright blue sky and soft clouds, plain and uncluttered. Airy, high-key blue tones, soft focus.
```

**banner-lecturer.png**
```
Soft-focus close-up of a tidy lecturer's desk on the RIGHT side of the frame: laptop with an abstract blue chart (no text), coffee cup, small plant, lime green sticky notes. The left side is a blurred blue gradient. Calm morning light, low detail.
```

**banner-student.png**
```
Soft-focus photo of a Malaysian diploma student on campus steps checking a smartphone, placed on the RIGHT third. The left is a blurred sky and greenery in blue tones. Natural light, low detail.
```

**cover-*.png** (one for each field)
```
Single simple 3D icon object, centred slightly to the upper right, bold rounded shape, flat soft lighting, solid gradient background, empty bottom-left corner. Must read clearly at 86 pixels.
bahasa: one speech bubble on an electric-blue to sky-blue gradient
pengajian-am: one small globe on a teal to blue gradient
matematik-sains: one drawing compass on a deep indigo gradient with lime highlights
mekanikal: one gear on a near-black background with a lime rim light
agroteknologi: one leaf with a test tube on a lime-to-green gradient
other: one open book on a blue gradient
```

**spot-*.png** (transparent background)
```
checkin: soft 3D illustration of a hand holding a smartphone scanning a QR code on a small screen, lime green check bubble above
claims: soft 3D illustration of a document with a large lime green approval tick and a small magnifying glass
tasks: soft 3D illustration of a laptop showing an abstract checklist (ticks only) with a lime check badge
consult: soft 3D illustration of two simple figures (lecturer and student) at a small round table with a speech bubble between them
reports: soft 3D illustration of a clipboard with abstract bar and line chart shapes and a download arrow
```
