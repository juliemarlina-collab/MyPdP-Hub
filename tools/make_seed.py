"""Generate fictional sample data (seed.json) used by the demo and the Google Sheet template."""
import json, hashlib, datetime as dt

SCHEMA = {
  "Users": ["user_id","role","name","email","programme","pin_hash","active"],
  "Classes": ["class_id","course_code","course_name","class_name","semester","lecturer_id"],
  "Enrolments": ["class_id","student_id"],
  "Sessions": ["session_id","class_id","date","start","end","topic","qr_code","qr_expires"],
  "Attendance": ["session_id","student_id","status","marked_by","marked_at"],
  "Claims": ["claim_id","student_id","class_id","session_ids","reason_type","note","file_name","file_url","status","comment","submitted_at","decided_by","decided_at"],
  "Tasks": ["task_id","class_id","title","type","description","due_at","max_marks","created_at"],
  "Submissions": ["task_id","student_id","link","file_name","file_url","submitted_at","status","marks","feedback","graded_at"],
  "Slots": ["slot_id","lecturer_id","date","start","end","mode","location","status"],
  "Bookings": ["booking_id","slot_id","student_id","lecturer_id","purpose","status","notes","created_at","updated_at"],
  "Interventions": ["intervention_id","student_id","class_id","lecturer_id","date","action","notes"],
  "Notifications": ["notif_id","user_id","message_en","message_ms","link","created_at","read"],
  "AuditLog": ["time","user_id","action","target","old_value","new_value"],
  "Settings": ["key","value","description"],
}

def h(uid, pin="1234"):
    return hashlib.sha256(f"{uid}:{pin}".encode()).hexdigest()

rows = {k: [] for k in SCHEMA}
U = rows["Users"]
U.append(dict(user_id="A001", role="admin", name="Admin Unit", email="admin@example.edu.my", programme="", pin_hash=h("A001"), active="TRUE"))
U.append(dict(user_id="L001", role="lecturer", name="Pn. Aina Rahman", email="aina@example.edu.my", programme="English Language Unit", pin_hash=h("L001"), active="TRUE"))
U.append(dict(user_id="L002", role="lecturer", name="En. Faizal Hamid", email="faizal@example.edu.my", programme="Mathematics Unit", pin_hash=h("L002"), active="TRUE"))
names = ["Aiman Hakimi","Nur Syafiqah","Daniel Lim","Kavitha Raj","Muhammad Irfan","Siti Aisyah","Harith Danial","Wong Mei Ling",
         "Arif Zulkifli","Nurul Izzah","Priya Devi","Amirul Asyraf"]
for i, n in enumerate(names, 1):
    sid = f"S{i:03d}"
    U.append(dict(user_id=sid, role="student", name=n, email=f"{sid.lower()}@student.example.edu.my",
                  programme="Diploma Kejuruteraan Mekanikal", pin_hash=h(sid), active="TRUE"))

C = rows["Classes"]
C.append(dict(class_id="C1", course_code="DUE50132", course_name="Communicative English 3", class_name="DKM3A", semester="Sesi I 2026/2027", lecturer_id="L001"))
C.append(dict(class_id="C2", course_code="DUE50132", course_name="Communicative English 3", class_name="DKM3B", semester="Sesi I 2026/2027", lecturer_id="L001"))
C.append(dict(class_id="C3", course_code="DBM30043", course_name="Engineering Mathematics 3", class_name="DKM3A", semester="Sesi I 2026/2027", lecturer_id="L002"))
enrol = {"C1": [f"S{i:03d}" for i in range(1, 9)], "C2": [f"S{i:03d}" for i in range(9, 13)], "C3": [f"S{i:03d}" for i in range(1, 7)]}
for c, ss in enrol.items():
    for s in ss:
        rows["Enrolments"].append(dict(class_id=c, student_id=s))

topics = {"C1": ["Course briefing","Presentation skills","Report writing","Describing processes","Group discussion","Negotiation language","Quiz & review"],
          "C2": ["Course briefing","Presentation skills","Report writing","Describing processes","Group discussion","Negotiation language","Quiz & review"],
          "C3": ["Complex numbers","Matrices","Determinants","Vectors","Differentiation","Integration","Review"]}
times = {"C1": ("08:00","10:00"), "C2": ("10:00","12:00"), "C3": ("14:00","16:00")}
start = dt.date(2026, 8, 17)
# absences: (class, student) -> set of week indexes absent / late
absent = {("C1","S003"): {1,3,4}, ("C1","S005"): {5}, ("C1","S007"): {2}, ("C3","S003"): {2,4,5}, ("C2","S010"): {3,5}}
late = {("C1","S002"): {2}, ("C1","S008"): {4}, ("C3","S001"): {1}}
sessid = 0
session_map = {}
for c in ["C1","C2","C3"]:
    for w in range(7):
        sessid += 1
        d = start + dt.timedelta(days=7*w + (0 if c != "C3" else 2))
        sid = f"SS{sessid:03d}"
        session_map[(c, w)] = sid
        rows["Sessions"].append(dict(session_id=sid, class_id=c, date=d.isoformat(), start=times[c][0], end=times[c][1],
                                     topic=topics[c][w], qr_code="", qr_expires=""))
        lec = "L001" if c != "C3" else "L002"
        for s in enrol[c]:
            st = "P"
            if w in absent.get((c, s), set()): st = "A"
            elif w in late.get((c, s), set()): st = "L"
            rows["Attendance"].append(dict(session_id=sid, student_id=s, status=st, marked_by=lec, marked_at=f"{d.isoformat()}T{times[c][0]}:05"))

T = rows["Tasks"]
tasks = [
  ("T1","C1","Oral presentation plan","Assignment","Prepare a one-page plan for your technical presentation.","2026-09-04T23:59",20),
  ("T2","C1","Technical report draft","Assignment","Write a 500-word report describing a workshop process.","2026-09-18T23:59",20),
  ("T3","C1","Quiz 1: Presentation language","Quiz","Online quiz on signposting and presentation phrases.","2026-09-25T23:59",10),
  ("T4","C1","Group discussion script","Assignment","Submit your group's discussion script and role list.","2026-10-09T23:59",20),
  ("T5","C3","Tutorial 1: Matrices","Tutorial","Complete questions 1-10 from Tutorial 1.","2026-09-11T23:59",10),
  ("T6","C3","Quiz 1: Determinants","Quiz","Quiz on determinants and inverse matrices.","2026-10-02T23:59",10),
  ("T7","C2","Technical report draft","Assignment","Write a 500-word report describing a workshop process.","2026-09-18T23:59",20),
]
for t in tasks:
    T.append(dict(task_id=t[0], class_id=t[1], title=t[2], type=t[3], description=t[4], due_at=t[5], max_marks=str(t[6]), created_at="2026-08-20T09:00"))

S = rows["Submissions"]
def sub(task, s, when, marks=None, fb=""):
    due = next(x for x in tasks if x[0] == task)[5]
    status = "Graded" if marks is not None else ("Late" if when > due else "Submitted")
    S.append(dict(task_id=task, student_id=s, link="https://drive.google.com/example", file_name="", file_url="",
                  submitted_at=when, status=status, marks="" if marks is None else str(marks), feedback=fb,
                  graded_at="2026-09-20T10:00" if marks is not None else ""))
# T1 all C1 except S007, graded
t1 = {"S001":17,"S002":15,"S003":11,"S004":17,"S005":16,"S006":18,"S008":14}
for s, m in t1.items(): sub("T1", s, "2026-09-03T20:00", m, "Good structure." if m >= 15 else "Add more detail to your main points.")
# T2: S003, S007 missing; S008 late; S004 declining
t2 = {"S001":16,"S002":14,"S004":13,"S005":15,"S006":17}
for s, m in t2.items(): sub("T2", s, "2026-09-17T21:00", m, "Clear report." if m >= 15 else "Check tense consistency.")
sub("T2", "S008", "2026-09-19T09:30")
# T3 quiz: S007 missing, S004 low
t3 = {"S001":9,"S002":8,"S003":6,"S004":5,"S005":8,"S006":9,"S008":7}
for s, m in t3.items(): sub("T3", s, "2026-09-25T20:00", m)
# T5
for s, m in {"S001":8,"S002":9,"S004":7,"S005":8,"S006":9}.items(): sub("T5", s, "2026-09-10T20:00", m)
# T7
for s in ["S009","S011","S012"]: sub("T7", s, "2026-09-18T12:00")

rows["Slots"] += [
  dict(slot_id="SL01", lecturer_id="L001", date="2026-10-05", start="10:00", end="10:30", mode="In person", location="Bilik Pensyarah ELU 2", status="Booked"),
  dict(slot_id="SL02", lecturer_id="L001", date="2026-10-05", start="10:30", end="11:00", mode="In person", location="Bilik Pensyarah ELU 2", status="Open"),
  dict(slot_id="SL03", lecturer_id="L001", date="2026-10-07", start="15:00", end="15:30", mode="Online", location="Google Meet (link sent on approval)", status="Open"),
  dict(slot_id="SL04", lecturer_id="L002", date="2026-10-06", start="11:00", end="11:30", mode="In person", location="Bilik Tutorial 3", status="Open"),
]
rows["Bookings"].append(dict(booking_id="B001", slot_id="SL01", student_id="S007", lecturer_id="L001", purpose="Missing report draft - need help to catch up",
                              status="Pending", notes="", created_at="2026-09-28T21:10", updated_at="2026-09-28T21:10"))
rows["Claims"].append(dict(claim_id="CL001", student_id="S005", class_id="C1", session_ids=session_map[("C1",5)], reason_type="MC",
                            note="Demam, klinik kesihatan.", file_name="mc_sample.pdf", file_url="", status="Pending", comment="",
                            submitted_at="2026-09-22T08:30", decided_by="", decided_at=""))
rows["Interventions"].append(dict(intervention_id="I001", student_id="S003", class_id="C1", lecturer_id="L001", date="2026-09-15",
                                   action="WhatsApp reminder", notes="Reminded about attendance and report draft. Student said transport problem."))
rows["Notifications"] += [
  dict(notif_id="N001", user_id="S007", message_en="Your consultation request was sent to Pn. Aina Rahman.", message_ms="Permohonan konsultasi anda telah dihantar kepada Pn. Aina Rahman.", link="consult", created_at="2026-09-28T21:10", read="FALSE"),
  dict(notif_id="N002", user_id="L001", message_en="New MC / absence claim from Muhammad Irfan.", message_ms="Tuntutan MC / ketidakhadiran baharu daripada Muhammad Irfan.", link="claims", created_at="2026-09-22T08:30", read="FALSE"),
]
rows["Settings"] += [
  dict(key="attendance_threshold", value="80", description="Minimum attendance % (institution policy)"),
  dict(key="monitor_margin", value="5", description="Yellow warning when attendance is within this many % above the threshold"),
  dict(key="late_counts_as_present", value="TRUE", description="TRUE = Late (L) counts as attended"),
  dict(key="excused_excluded", value="TRUE", description="TRUE = Absent with reason (E) is removed from the total sessions"),
  dict(key="missing_orange", value="2", description="Number of missing tasks that triggers Intervention Needed"),
  dict(key="max_file_mb", value="5", description="Maximum upload size in MB"),
  dict(key="qr_minutes", value="10", description="How long a class QR code stays valid"),
  dict(key="session_hours", value="6", description="Login session length in hours"),
  dict(key="mc_folder_id", value="", description="Google Drive folder ID for MC and submission files (filled by setup)"),
]

out = {"schema": SCHEMA, "rows": rows}
json.dump(out, open("/home/claude/mypdp/tools/seed.json", "w"), indent=1, ensure_ascii=False)
open("/home/claude/mypdp/frontend/seed.js", "w").write("window.MYPDP_SEED = " + json.dumps(out, ensure_ascii=False) + ";\n")
print({k: len(v) for k, v in rows.items()})
