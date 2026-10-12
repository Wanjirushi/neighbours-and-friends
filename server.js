// Neighbours and Friends starter backend
// Requires Node.js 20+. Run: node server.js
// This starter stores personal data in a local JSON file. Before public launch, deploy
// behind HTTPS, use a managed database, add rate limiting/CSRF protections and configure
// secure admin authentication. M-PESA is manually reviewed; this does not verify payments.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data.json');
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-this-admin-token-before-launch';
const MAX_GROUP = 15;
function load(){ try{return JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{return {members:[],groups:[]}} }
function save(db){fs.writeFileSync(DATA,JSON.stringify(db,null,2),'utf8')}
function send(res,status,body,type='application/json'){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(body):body)}
function readBody(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>100000)reject(new Error('Body too large'))});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'))}catch{reject(new Error('Invalid JSON'))}})})}
function norm(s){return String(s||'').trim().toLowerCase()}
function overlap(a,b){const aa=new Set(Array.isArray(a)?a:[]);return (Array.isArray(b)?b:[]).filter(x=>aa.has(x)).length}
function score(a,b){
 let s=0;
 if(norm(a.county)===norm(b.county))s+=5;
 if(norm(a.neighbourhood)===norm(b.neighbourhood))s+=10;
 if(a.budget===b.budget)s+=3;
 if(a.age&&b.age&&Math.abs(Number(a.age)-Number(b.age))<=5)s+=2;
 s+=Math.min(5,overlap(a.interests,b.interests))*2;
 s+=Math.min(3,overlap(a.availability,b.availability))*2;
 s+=Math.min(3,overlap(a.friendshipGoals,b.friendshipGoals))*2;
 return s;
}
function allocate(db,member){
 // Match only paid/confirmed members. A pending member is not placed in a group.
 if(member.paymentStatus!=='confirmed')return null;
 const eligible=db.members.filter(m=>m.id!==member.id&&m.paymentStatus==='confirmed');
 const ranked=eligible.map(m=>({m,score:score(member,m)})).sort((a,b)=>b.score-a.score);
 // First look for a group with the same neighbourhood and available space.
 const candidates=db.groups.filter(g=>g.members.length<MAX_GROUP && norm(g.county)===norm(member.county) && norm(g.neighbourhood)===norm(member.neighbourhood));
 let group=candidates.map(g=>({g,score:g.members.reduce((n,id)=>{const m=db.members.find(x=>x.id===id);return n+(m?score(member,m):0)},0)})).sort((a,b)=>b.score-a.score)[0]?.g;
 if(!group){
  group={id:'G-'+crypto.randomBytes(3).toString('hex').toUpperCase(),county:member.county,neighbourhood:member.neighbourhood,members:[],createdAt:new Date().toISOString(),status:'forming'};
  db.groups.push(group);
 }
 if(group.members.length<MAX_GROUP&&!group.members.includes(member.id))group.members.push(member.id);
 group.status=group.members.length>=MAX_GROUP?'full':'forming';
 member.groupId=group.id;
 return {groupId:group.id,groupSize:group.members.length,topMatches:ranked.slice(0,5).map(x=>({id:x.m.id,firstName:x.m.firstName,score:x.score}))};
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true,service:'Neighbours and Friends'});
 if(req.method==='POST'&&url.pathname==='/api/register'){
  try{
   const body=await readBody(req);
   for(const k of ['firstName','age','county','neighbourhood','interests','budget','availability','friendshipGoals','phone','mpesaCode']){
    if(body[k]===undefined||body[k]===null||String(body[k]).trim()==='')return send(res,400,{error:`Missing required field: ${k}`});
   }
   if(Number(body.age)<18||Number(body.age)>100)return send(res,400,{error:'Members must be 18 or older.'});
   if(!body.consent)return send(res,400,{error:'Please confirm the consent statement.'});
   const db=load();
   const member={...body,id:'M-'+crypto.randomBytes(5).toString('hex').toUpperCase(),paymentStatus:'pending',submittedAt:new Date().toISOString(),groupId:null};
   db.members.push(member);save(db);
   return send(res,201,{ok:true,id:member.id,status:'pending',message:'Submission received. Payment is pending manual confirmation.'});
  }catch(e){return send(res,400,{error:e.message})}
 }
 if(req.method==='GET'&&url.pathname==='/admin'){
  fs.readFile(path.join(PUBLIC,'admin.html'),(err,data)=>{if(err)return send(res,404,{error:'Admin page not found'});send(res,200,data.toString(),'text/html; charset=utf-8')});return;
 }
 if(url.pathname.startsWith('/api/admin/')){
  if(req.headers['x-admin-token']!==ADMIN_TOKEN)return send(res,401,{error:'Unauthorised'});
  const db=load();
  if(req.method==='GET'&&url.pathname==='/api/admin/data'){
   const members=db.members.map(m=>({...m,phone:m.phone?m.phone.replace(/.(?=.{3})/g,'•'):m.phone}));
   return send(res,200,{members,groups:db.groups});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/confirm-payment'){
   try{
    const b=await readBody(req);const m=db.members.find(x=>x.id===b.id);if(!m)return send(res,404,{error:'Member not found'});
    m.paymentStatus='confirmed';m.paymentConfirmedAt=new Date().toISOString();
    const match=allocate(db,m);save(db);
    return send(res,200,{ok:true,groupId:match?.groupId||null,groupSize:match?.groupSize||0});
   }catch(e){return send(res,400,{error:e.message})}
  }
  return send(res,404,{error:'Admin endpoint not found'});
 }
 let p=path.join(PUBLIC,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/,''));
 if(!p.startsWith(PUBLIC))return send(res,403,{error:'Forbidden'});
 fs.readFile(p,(err,data)=>{if(err)return send(res,404,{error:'Not found'});const ext=path.extname(p);const type=ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css':ext==='.js'?'text/javascript':'application/octet-stream';send(res,200,data.toString(),type)});
});
server.listen(PORT,()=>console.log(`Neighbours and Friends running on http://localhost:${PORT}`));
