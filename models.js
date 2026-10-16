import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.85,...o});
function rng(s){return()=>(s=(s*16807)%2147483647)/2147483647}
const builders={
timber(g){const wood=M(0xc8955a),glulam=M(0xb07c45);
 {const b=new THREE.Mesh(new THREE.BoxGeometry(14,.2,8),M(0x9aa39a));b.position.y=-.1;g.add(b);}
 for(let i=-3;i<=3;i++){const z=i*1.2;
  for(const s of[-1,1]){const col=new THREE.Mesh(new THREE.BoxGeometry(.35,4,.35),glulam);col.position.set(s*5.5,2,z);g.add(col)}
  const arch=new THREE.Mesh(new THREE.TorusGeometry(5.5,.18,8,40,Math.PI),wood);arch.position.set(0,4,z);g.add(arch)}
 for(let a=0.15;a<Math.PI;a+=Math.PI/8){const p=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,7.6),glulam);p.position.set(Math.cos(a)*5.5,4+Math.sin(a)*5.5,0);g.add(p)}
 return 16},
tunnel(g){const ground=M(0x8a7a62),road=M(0x555a5c);
 const soil=new THREE.Mesh(new THREE.BoxGeometry(16,6,6),M(0x9c8a6c,{transparent:true,opacity:.35}));soil.position.y=-3;g.add(soil);
 const surf=new THREE.Mesh(new THREE.BoxGeometry(16,.1,6),M(0x7aa06a));surf.position.y=.05;g.add(surf);
 const tube=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,10,32,1,true),M(0xcfd3d0,{side:THREE.DoubleSide}));tube.rotation.z=Math.PI/2;tube.position.set(-3,-4,0);g.add(tube);
 const deck=new THREE.Mesh(new THREE.BoxGeometry(10,.1,1.8),road);deck.position.set(-3,-4.9,0);g.add(deck);
 const ramp=new THREE.Mesh(new THREE.BoxGeometry(7,.15,1.8),road);ramp.position.set(4.6,-2.4,0);ramp.rotation.z=Math.atan2(5,7);g.add(ramp);
 for(const s of[-1,1]){const w=new THREE.Mesh(new THREE.BoxGeometry(7,1,.1),M(0xbfc3c0));w.position.set(4.6,-2,s*.95);w.rotation.z=ramp.rotation.z;g.add(w)}
 const portal=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.6,2.4),M(0x2b6e5a));portal.position.set(8,.8,0);g.add(portal);
 const shuttle=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,.9,1.1),M(0xf2f2ee));shuttle.add(body);
 const win=new THREE.Mesh(new THREE.BoxGeometry(1.4,.35,1.12),M(0x2a3b44));win.position.y=.15;shuttle.add(win);shuttle.position.set(-5,-4.35,0);g.add(shuttle);
 g.userData.tick=t=>{shuttle.position.x=-7.5+((t*1.5)%10)};return 15},
forest(g){const r=rng(7),ground=new THREE.Mesh(new THREE.BoxGeometry(16,.2,8),M(0x6b5a3e));ground.position.y=-.1;g.add(ground);
 const cols=[0x2f5d3a,0x3d6e3f,0x4f7d45,0x6a9a4e];
 const tree=(x,z,h,rad,c,trunk)=>{const t=new THREE.Mesh(new THREE.CylinderGeometry(rad*.6,rad,h*.35,8),M(0x6b4a2f));t.position.set(x,h*.175,z);g.add(t);
  const k=new THREE.Mesh(new THREE.ConeGeometry(h*.22,h*.75,8),M(c));k.position.set(x,h*.35+h*.37,z);g.add(k)};
 for(let i=0;i<30;i++)tree(-7+r()*6,-3.5+r()*7,.6+r()*.9,.05,cols[i%4]);
 const log=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,5,10),M(0x5a4430));log.rotation.z=Math.PI/2;log.rotation.y=.4;log.position.set(-3.8,.3,2.6);g.add(log);
 for(let i=0;i<9;i++){const h=5+r()*4;tree(1+r()*6,-3.3+r()*6.6,h,.3+r()*.25,cols[i%2])}
 for(let i=0;i<14;i++)tree(1+r()*6,-3.5+r()*7,1+r()*1.5,.06,0x5d8a4a);
 const snag=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,4,8),M(0x9a9088));snag.position.set(6.5,2,-2.5);g.add(snag);
 const div=new THREE.Mesh(new THREE.BoxGeometry(.05,.3,8),M(0xffffff));div.position.set(0,.1,0);g.add(div);
 return 17}};
function start(el){
 const w=el.clientWidth,h=el.clientHeight,sc=new THREE.Scene();sc.background=new THREE.Color(0xe9ece6);
 const cam=new THREE.PerspectiveCamera(40,w/h,.1,200),rd=new THREE.WebGLRenderer({antialias:true});
 rd.setPixelRatio(Math.min(devicePixelRatio,1.5));rd.setSize(w,h);el.appendChild(rd.domElement);
 sc.add(new THREE.HemisphereLight(0xffffff,0x88806a,1.6));const d=new THREE.DirectionalLight(0xffffff,1.6);d.position.set(5,10,7);sc.add(d);
 const g=new THREE.Group();sc.add(g);const dist=builders[el.dataset.model](g);
 cam.position.set(dist*.75,dist*.5,dist*.85);const ctl=new OrbitControls(cam,rd.domElement);ctl.target.set(0,el.dataset.model==='tunnel'?-1.5:2,0);ctl.enableDamping=true;ctl.autoRotate=true;ctl.autoRotateSpeed=.6;
 ctl.addEventListener('start',()=>ctl.autoRotate=false);ctl.enabled=false;ctl.update();
 const a=document.createElement('button');a.type='button';a.className='activate';a.textContent='Tap to rotate';el.appendChild(a);
 const dn=document.createElement('button');dn.type='button';dn.className='done';dn.textContent='Done';el.appendChild(dn);
 a.onclick=()=>{ctl.enabled=true;el.classList.add('active')};dn.onclick=()=>{ctl.enabled=false;el.classList.remove('active')};
 let vis=true;new IntersectionObserver(e=>vis=e[0].isIntersecting).observe(el);
 new ResizeObserver(()=>{const W=el.clientWidth,H=el.clientHeight;rd.setSize(W,H);cam.aspect=W/H;cam.updateProjectionMatrix()}).observe(el);
 const clk=new THREE.Clock();rd.setAnimationLoop(()=>{if(!vis)return;g.userData.tick&&g.userData.tick(clk.getElapsedTime());ctl.update();rd.render(sc,cam)});
}
function ok(){try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return false}}
if(!ok())document.querySelectorAll('.m3d').forEach(el=>el.innerHTML='<div class="ph">3D preview needs WebGL, which this browser does not have.</div>');
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);try{start(e.target)}catch(err){e.target.textContent='3D needs WebGL.'}}}),{rootMargin:'300px'});
window.RNTstartModel=el=>{if(el.dataset.started)return;el.dataset.started=1;start(el);const a=el.querySelector('.activate');if(a)a.click()};
if(ok()&&!document.documentElement.classList.contains('poster'))document.querySelectorAll('.m3d').forEach(el=>io.observe(el));
