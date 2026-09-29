// Tests of main flows + pilot safeguards on the KTCM dataset
global.localStorage={getItem:()=>null,setItem:()=>{}};
const Core=require('../apps-script/Core.gs'),DB=require('../github-pages/demo-db.js'),seed=require('./seed.json'),assert=require('assert');
const db=DB.create(seed,{fresh:true,persist:false,now:'2026-09-29T10:00:00'});const c=(u,a,p)=>Core.handle(db,u,a,p);
const fails=(fn,code)=>{try{fn()}catch(e){assert.strictEqual(e.code,code,e.message);return}throw new Error('expected '+code)};
const login=id=>c(null,'login',{user_id:id,pin:'1234'});
const L4=login('L004'),L2=login('L002'),S3=login('S003'),S51=login('S051');
// 1 login throttling
for(let i=0;i<5;i++) fails(()=>c(null,'login',{user_id:'S010',pin:'0000'}),'login');
fails(()=>login('S010'),'locked'); console.log('✓ locked after 5 wrong PINs');
// 2 first-login PIN change
db.update('Users',u=>u.user_id==='S011',{must_change_pin:'TRUE'});
const S11=db.all('Users').find(u=>u.user_id==='S011');
assert(c(null,'login',{user_id:'S011',pin:'1234'}).must_change_pin===true);
fails(()=>c(S11,'studentDashboard'),'pinchange');
fails(()=>c(S11,'changePin',{old_pin:'1234',new_pin:'123456'}),'pin');   // running digits
fails(()=>c(S11,'changePin',{old_pin:'1234',new_pin:'4821'}),'pin');     // too short
c(S11,'changePin',{old_pin:'1234',new_pin:'482915'});
assert(c(db.all('Users').find(u=>u.user_id==='S011'),'studentDashboard').classes.length>0); console.log('✓ first-login PIN change enforced');
// 3 claim approve -> E; QR cannot overwrite E; lecturer correction needs reason
const pend=c(L2,'listClaims',{}).find(x=>x.status==='Pending');
c(L2,'decideClaim',{claim_id:pend.claim_id,decision:'Approved'});
const sid=pend.sessions[0].session_id;
db.update('Sessions',s=>s.session_id===sid,{qr_code:'ABC123',qr_expires:String(Date.now()+600000)});
fails(()=>c(S51,'checkIn',{code:'ABC123'}),'excused');
fails(()=>c(L2,'markAttendance',{session_id:sid,marks:[{student_id:'S051',status:'P'}]}),'reason');
c(L2,'markAttendance',{session_id:sid,marks:[{student_id:'S051',status:'P'}],reason:'Claim entered for wrong date'});
assert(db.all('AuditLog').some(a=>a.action==='attendance_correction'&&a.new_value.includes('wrong date'))); console.log('✓ E protected from QR; correction documented');
// 4 intervention enrolment check
fails(()=>c(L4,'addIntervention',{class_id:'C08',student_id:'S003',action:'Meeting'}),'forbidden');
c(L4,'addIntervention',{class_id:'C08',student_id:db.all('Enrolments').find(e=>e.class_id==='C08').student_id,action:'Meeting'}); console.log('✓ intervention checks enrolment');
// 5 booking tied to a class; completed -> intervention on that class
const S5=login('S005'); const slot=c(S5,'openSlots').find(s=>s.lecturer_id==='L003');
fails(()=>c(S5,'bookSlot',{slot_id:slot.slot_id,class_id:'C03',purpose:'x'}),'class'); // C03 is L002's class
const bk=c(S5,'bookSlot',{slot_id:slot.slot_id,class_id:'C05',purpose:'Speaking practice'});
const L3=login('L003'); c(L3,'decideBooking',{booking_id:bk.booking_id,decision:'Confirmed'}); c(L3,'decideBooking',{booking_id:bk.booking_id,decision:'Completed',notes:'ok'});
assert(db.all('Interventions').some(i=>i.student_id==='S005'&&i.class_id==='C05'&&i.action==='Consultation')); console.log('✓ consultation linked to chosen class');
// 6 assessment sequence + evidence
const t=c(L4,'createTask',{class_id:'C08',title:'Task 4: Reflection',due_at:'2026-10-20T23:59',max_marks:10});
assert(db.all('Tasks').find(x=>x.task_id===t.task_id).seq==='4');
const cs=c(L4,'classStudents',{class_id:'C08'}); const r=cs.students.find(s=>s.reasons.length);
console.log('✓ task seq auto = 4; sample evidence:', r.reasons.map(x=>x.en).join(' | '));
// 7 other flows
const ss=c(L4,'createSession',{class_id:'C08',date:'2026-09-29',start:'08:00',end:'10:00',topic:'Test'});const q=c(L4,'openQR',{session_id:ss.session_id});
const st=login(db.all('Enrolments').find(e=>e.class_id==='C08').student_id); assert(c(st,'checkIn',{code:q.code}).ok);
for(const k of ['attendance','submissions','pdp']) assert(c(L4,'exportData',{kind:k,class_id:'C08'}).rows.length===15);
const mc=c(L4,'myClasses'); assert(mc[0].attendance>0 && 'atRisk' in mc[0]);
console.log('ALL KTCM TESTS PASSED');
