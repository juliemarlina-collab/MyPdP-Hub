// v1.2: rotating QR codes, grace period, closeQR, studentInsight (rules + AI hook)
global.localStorage={getItem:()=>null,setItem:()=>{}};
const Core=require('../apps-script/Core.gs'),DB=require('../demo-db.js'),seed=require('./seed.json'),assert=require('assert');
const db=DB.create(seed,{fresh:true,persist:false,now:'2026-09-29T10:00:00'});const c=(u,a,p)=>Core.handle(db,u,a,p);
const fails=(fn,code)=>{try{fn()}catch(e){assert.strictEqual(e.code,code,e.message);return}throw new Error('expected '+code)};
const login=id=>c(null,'login',{user_id:id,pin:'1234'});
const L2=login('L002'),S3=login('S003');
const sess=c(L2,'classSessions',{class_id:'C03'})[0];
// 1 rotating code: short life, old code still accepted during the grace period
const q1=c(L2,'openQR',{session_id:sess.session_id,rotate:true});
assert(q1.rotate && q1.rotateSeconds===30 && q1.expires-Date.parse('2026-09-29T10:00:00')===50000,'rotating code lives 50 s');
const q2=c(L2,'openQR',{session_id:sess.session_id,rotate:true});
assert.notStrictEqual(q1.code,q2.code);
const r=c(S3,'checkIn',{code:q1.code}); assert(r.ok,'previous code accepted in grace period'); console.log('✓ previous code accepted during 20 s grace');
fails(()=>c(S3,'checkIn',{code:'ZZZZZZ'}),'code');
// 2 classic mode unchanged
const q3=c(L2,'openQR',{session_id:sess.session_id}); assert(q3.minutes===10 && !q3.rotate); console.log('✓ classic 10-minute code still works');
// 3 closeQR
c(L2,'closeQR',{session_id:sess.session_id});
const row=db.all('Sessions').find(s=>s.session_id===sess.session_id); assert(Number(row.qr_expires)-Date.parse('2026-09-29T10:00:00')<=20000); console.log('✓ closeQR ends the window');
fails(()=>c(S3,'closeQR',{session_id:sess.session_id}),'forbidden');
// 4 insight (rules)
const ins=c(L2,'studentInsight',{class_id:'C03',student_id:'S003'});
assert.strictEqual(ins.source,'rules'); assert(ins.summary.ms && ins.summary.en && ins.actions.length>=1 && ins.actions.length<=3);
assert(!JSON.stringify(ins.facts).includes('S003') && !JSON.stringify(ins.facts).includes('Amirul'),'facts carry no name or ID');
console.log('✓ rule summary:', ins.summary.ms.slice(0,90)+'…');
fails(()=>c(S3,'studentInsight',{class_id:'C03',student_id:'S003'}),'forbidden');
// 5 insight with AI hook
db.ai=f=>({summary:{ms:'AI ms',en:'AI en'},actions:[{ms:'a',en:'a'}],model:'test-model'});
assert.strictEqual(c(L2,'studentInsight',{class_id:'C03',student_id:'S003'}).source,'ai');
db.ai=()=>{throw new Error('down')}; assert.strictEqual(c(L2,'studentInsight',{class_id:'C03',student_id:'S003'}).source,'rules'); console.log('✓ AI used when available, falls back to rules on error');
console.log('ALL v1.2 TESTS PASSED');
