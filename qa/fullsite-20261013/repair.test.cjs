const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../../src');
const card=fs.readFileSync(path.join(root,'color-moment.html'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pool=card.match(/const ART_BY_MOOD = (\{[\s\S]*?\n  \});/)[1];
const pools=vm.runInNewContext('('+pool+')');
test('every possible Soul Card artwork is present in the deployed source',()=>{
 for(const [mood,arts] of Object.entries(pools)){
  assert.ok(arts.length>0,mood);
  for(const art of arts)assert.ok(fs.existsSync(path.join(root,art)),`${mood}: missing ${art}`);
 }
});
test('old missing-art records resolve to a real artwork and valid selections are retained',()=>{
 const fn=card.match(/function resolveCardArt\(source, moodId\) \{[\s\S]*?\n  \}/);
 assert.ok(fn,'No stored artwork migration');
 const resolve=vm.runInNewContext('const ART_BY_MOOD='+pool+';'+fn[0]+';resolveCardArt');
 for(const mood of Object.keys(pools)){
  const replacement=resolve('assets/color-moment-grade/IMG_5046_grade_v1.webp',mood);
  assert.ok(fs.existsSync(path.join(root,replacement)));
  for(const art of pools[mood])assert.equal(resolve(art,mood),art);
 }
 assert.ok(fs.existsSync(path.join(root,resolve('unknown.webp','old-mood'))));
});
test('explicit URL language takes precedence over saved language',()=>{
 const init=home.match(/let lang='en';[\s\S]*?(?=\nfunction setLang)/)[0];
 for(const [search,saved,expected] of [['?lang=zh','en','zh'],['?lang=en','zh','en'],['','zh','zh'],['?lang=invalid','en','en']]){
  const got=vm.runInNewContext(init+';lang',{dict:{en:{},zh:{}},localStorage:{getItem:()=>saved},location:{search},URLSearchParams});
  assert.equal(got,expected,`${search} saved=${saved}`);
 }
});
