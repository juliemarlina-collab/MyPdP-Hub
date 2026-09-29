import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

seed = json.load(open('/home/claude/mypdp/tools/seed.json'))
wb = Workbook()
ws = wb.active
ws.title = 'Start here'
lines = [
 ('MyPdP Insight — Database (Google Sheet)', True),
 ('Each tab below is one table. Row 1 = column names: do NOT rename or reorder them.', False),
 ('All sample people and data are fictional. Delete the sample rows (not the header row) before the real pilot.', False),
 ('', False),
 ('Admin quick guide', True),
 ('Add a student/lecturer: new row in Users. Type a 4–8 digit PIN in pin_hash, then menu MyPdP Insight > Convert new PINs.', False),
 ('role = student / lecturer / admin.  active = TRUE or FALSE.', False),
 ('Add a class: row in Classes (lecturer_id = the lecturer\'s user_id). Put students in the class via Enrolments.', False),
 ('Attendance codes: P = Present, L = Late, A = Absent, E = Absent with reason (approved MC / claim).', False),
 ('Rules (attendance threshold, file size, QR time…) are in the Settings tab.', False),
 ('AuditLog records every attendance change, claim decision and grade — do not edit it.', False),
 ('', False),
 ('Demo logins (PIN 1234 for all): lecturers L001, L002 · students S001–S012 · admin A001', False),
]
for i, (t, b) in enumerate(lines, 1):
    c = ws.cell(row=i, column=1, value=t)
    c.font = Font(bold=b, size=14 if i == 1 else 11, color='1F3B63' if b else '000000')
ws.column_dimensions['A'].width = 120

head_fill = PatternFill('solid', fgColor='1F3B63')
for t, cols in seed['schema'].items():
    sh = wb.create_sheet(t)
    for j, c in enumerate(cols, 1):
        cell = sh.cell(row=1, column=j, value=c)
        cell.font = Font(bold=True, color='FFFFFF'); cell.fill = head_fill
    for i, r in enumerate(seed['rows'][t], 2):
        for j, c in enumerate(cols, 1):
            cell = sh.cell(row=i, column=j, value=str(r.get(c, '')))
            cell.number_format = '@'
    # keep whole columns as text so Google Sheets doesn't convert dates
    for j, c in enumerate(cols, 1):
        L = get_column_letter(j)
        sh.column_dimensions[L].width = max(12, min(45, len(c) + 4 if t != 'Users' or c != 'pin_hash' else 20))
    sh.freeze_panes = 'A2'
wb.save('/home/claude/mypdp/backend/MyPdP_Insight_Database.xlsx')
print('saved')
