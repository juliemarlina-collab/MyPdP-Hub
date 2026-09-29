// Runs Code.gs + Core.gs in Node with mocked Google services (Sheet adapter, migration, throttling, import tools).
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const seed=require('./seed.json');
const sheets={};
for (const [t,cols] of Object.entries(seed.schema)) {
  let c=cols.slice(); if(t==='Users') c=c.filter(x=>x!=='must_change_pin'); if(t==='Tasks') c=c.filter(x=>x!=='seq'); if(t==='Bookings') c=c.filter(x=>x!=='class_id'); // simulate an OLD sheet
  sheets[t]=[c].concat(seed.rows[t].map(r=>c.map(k=>r[k])));
}
function mk(n){const a=sheets[n];const rng=(r,c,nr=1,nc=1)=>{const o={setNumberFormat(){return o},setFontWeight(){return o},setBackground(){return o},setFontColor(){return o},
  getValues(){return [a[r-1].slice(c-1,c-1+nc)]},
  setValues(v){for(let i=0;i<v.length;i++){a[r-1+i]=a[r-1+i]||[];for(let j=0;j<v[i].length;j++)a[r-1+i][c-1+j]=v[i][j]}return o},setValue(v){a[r-1]=a[r-1]||[];a[r-1][c-1]=v;return o}};return o};
  return {getDataRange:()=>({getValues:()=>{const w=Math.max(...a.map(r=>r.length));return a.map(r=>{const x=r.slice();while(x.length<w)x.push('');return x})}}),getLastRow:()=>a.length,getLastColumn:()=>a[0].length,getRange:rng,appendRow:r=>a.push(r),setFrozenRows(){}}}
const ss={getId:()=>'X',getSheetByName:n=>sheets[n]?mk(n):null,insertSheet:n=>{sheets[n]=[[]];sheets[n]=[];sheets[n].push([]);sheets[n].length=0;return mk(n)},getSheets:()=>Object.keys(sheets),deleteSheet:()=>{}};
ss.insertSheet=n=>{sheets[n]=[];return mk(n)};
const props={},cache={};
const ctx={SpreadsheetApp:{openById:()=>ss,getActiveSpreadsheet:()=>ss,getUi:()=>{throw 1}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
 CacheService:{getScriptCache:()=>({put:(k,v)=>cache[k]=v,get:k=>cache[k]||null,remove:k=>delete cache[k]})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 ContentService:{MimeType:{JSON:1},createTextOutput:s=>({setMimeType(){return this},s})},
 Utilities:{computeDigest:(_,t)=>Array.from(crypto.createHash('sha256').update(t).digest()).map(b=>b>127?b-256:b),DigestAlgorithm:{},Charset:{},getUuid:()=>crypto.randomUUID(),
  formatDate:(d,tz,f)=>d.toISOString().slice(0,f.includes('HH')?16:10),base64Decode:s=>Buffer.from(s,'base64'),newBlob:(b,m,n)=>({n})},
 DriveApp:{createFolder:()=>({getId:()=>'F'}),getFolderById:()=>({createFile:b=>({getUrl:()=>'https://drive/'+b.n,getId:()=>'1'})})},Session:{getScriptTimeZone:()=>'Asia/Kuala_Lumpur'},Logger:{log:()=>{}},console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../apps-script/Core.gs','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/../apps-script/Code.gs','utf8'),ctx);
const post=(action,payload,token)=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({action,payload,token})}}).s);
ctx.setup();
assert(sheets.Users[0].includes('must_change_pin') && sheets.Tasks[0].includes('seq') && sheets.Bookings[0].includes('class_id')); console.log('✓ setup adds new columns to an older sheet');
for(let i=0;i<5;i++) assert.strictEqual(post('login',{user_id:'S020',pin:'9'}).error.code,'login');
assert.strictEqual(post('login',{user_id:'S020',pin:'1234'}).error.code,'locked'); console.log('✓ live login throttling');
const L=post('login',{user_id:'L004',pin:'1234'}).data.token;
assert(post('lecturerDashboard',{},L).ok); assert(post('myClasses',{},L).data.length===2); console.log('✓ dashboard & My Courses via API');
// import tools
sheets.Users.push(['S999','student','','','', '', 'TRUE']);           // missing name, not enrolled, no PIN
sheets.Enrolments.push(['C99','S003']);                             // unknown class
ctx.validateImport();
const probs=sheets.Validation.slice(1).map(r=>r[2]); console.log('✓ validateImport found', probs.length, 'problems:', probs.join(' | '));
ctx.issueInitialPins();
assert(sheets.PIN_Handout.length===2 && /^\d{6}$/.test(sheets.PIN_Handout[1][3])); console.log('✓ issueInitialPins gave S999 a 6-digit first-login PIN');
const r=post('login',{user_id:'S999',pin:sheets.PIN_Handout[1][3]}); assert(r.ok && r.data.user.must_change_pin);
assert.strictEqual(post('studentDashboard',{},r.data.token).error.code,'pinchange'); console.log('✓ new user must change PIN');
console.log('GAS TESTS PASSED');
