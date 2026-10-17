// Before the city: interactive 3D terrain. three.js r160 (MIT), vendored.
import * as THREE from './vendor/three.module.min.js';
export async function start(D, stage, opt){
  const G = await (await fetch('grid.json')).json();
  const WW = 1000, DZ = 1000*G.H/G.Wd, MPU = (G.E-G.W)*72.6*1000/WW, VEX = 2;
  const my = lat => Math.asinh(Math.tan(lat*Math.PI/180));
  const toWorld = (lon,lat) => [((lon-G.W)/(G.E-G.W)-0.5)*WW, ((my(G.N)-my(lat))/(my(G.N)-my(G.S))-0.5)*DZ];
  // heights
  const himg = await loadImg('height.png');
  const cv = document.createElement('canvas'); cv.width=G.gw; cv.height=G.gh;
  const cx = cv.getContext('2d'); cx.drawImage(himg,0,0);
  const px = cx.getImageData(0,0,G.gw,G.gh).data;
  const hs = new Float32Array(G.gw*G.gh);
  for(let i=0;i<hs.length;i++){ const v=px[i*4]*256+px[i*4+1]; hs[i]=Math.max(0,(v-500)/10)/MPU*VEX; }
  const hAt=(x,z)=>{ const u=(x/WW+0.5)*(G.gw-1), v=(z/DZ+0.5)*(G.gh-1); const i=Math.max(0,Math.min(G.gw-2,Math.floor(u))), j=Math.max(0,Math.min(G.gh-2,Math.floor(v))); const fu=u-i,fv=v-j, a=hs[j*G.gw+i],b=hs[j*G.gw+i+1],c=hs[(j+1)*G.gw+i],d=hs[(j+1)*G.gw+i+1]; return a*(1-fu)*(1-fv)+b*fu*(1-fv)+c*(1-fu)*fv+d*fu*fv; };
  // renderer
  const renderer = new THREE.WebGLRenderer({antialias: devicePixelRatio<2, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0c0b);
  scene.fog = new THREE.Fog(0x0d0c0b, 900, 2200);
  const camera = new THREE.PerspectiveCamera(42, stage.clientWidth/stage.clientHeight, 2, 4000);
  // terrain
  const geo = new THREE.PlaneGeometry(WW, DZ, G.gw-1, G.gh-1);
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setZ(i, hs[i]);
  geo.rotateX(-Math.PI/2);
  const tl = new THREE.TextureLoader();
  const tex = {}; const loadTex = (k,u)=> new Promise(r=>tl.load(u,t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());tex[k]=t;r(t)}));
  await loadTex('old','tex-1850s.jpg');
  const mat = new THREE.MeshBasicMaterial({map: tex.old});
  const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
  // base skirt
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(WW, 6, DZ), new THREE.MeshBasicMaterial({color:0x1a1612}));
  skirt.position.y=-3.2; scene.add(skirt);
  // markers
  const mks = D.sites.map(s=>{
    const [x,z]=toWorld(s.lon,s.lat); const b=document.createElement('button'); b.className='mk'; b.type='button';
    b.innerHTML='<b></b><small></small>'; b.firstChild.textContent=s.name; b.lastChild.textContent=s.en;
    b.setAttribute('aria-label', s.name+', '+s.en+'. Open details');
    b.addEventListener('click',e=>{e.stopPropagation(); opt.onSite(s)});
    b.addEventListener('pointerdown',e=>e.stopPropagation());
    stage.appendChild(b); return {s, el:b, v:new THREE.Vector3(x, hAt(x,z)+1, z)};
  });
  // camera state
  const [cx0,cz0]=toWorld(-123.105,49.262);
  const home={tx:cx0,tz:cz0,dist:stage.clientWidth<700?900:560,th:0,ph:0.92};
  const st={...home}; let want=false, mode=opt.mode||'orbit', dirty=true, paused=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function applyCam(){ st.ph=clamp(st.ph,0.12,1.38); st.dist=clamp(st.dist,70,1500); st.tx=clamp(st.tx,-WW/2,WW/2); st.tz=clamp(st.tz,-DZ/2,DZ/2);
    const ty=hAt(st.tx,st.tz)*0.5;
    camera.position.set(st.tx+st.dist*Math.sin(st.ph)*Math.sin(st.th), ty+st.dist*Math.cos(st.ph), st.tz+st.dist*Math.sin(st.ph)*Math.cos(st.th));
    camera.lookAt(st.tx,ty,st.tz); }
  const tmp=new THREE.Vector3();
  function placeMarkers(){ const w=stage.clientWidth,h=stage.clientHeight; const far=st.dist>650;
    for(const m of mks){ tmp.copy(m.v).project(camera); const vis=tmp.z<1&&tmp.x>-1.1&&tmp.x<1.1&&tmp.y>-1.1&&tmp.y<1.1;
      m.el.classList.toggle('hide',!vis); m.el.classList.toggle('far',far); if(vis) m.el.style.transform=`translate(${((tmp.x+1)/2*w).toFixed(1)}px,${((1-tmp.y)/2*h).toFixed(1)}px) translate(-50%,-100%)`; } }
  function render(){ applyCam(); renderer.render(scene,camera); placeMarkers(); dirty=false; }
  // FPS probe then render-on-demand
  let frames=0, t0=0, slowChecked=false;
  function loop(t){ if(!paused){ if(!slowChecked){ if(!t0)t0=t; frames++; dirty=true; if(t-t0>1500){ slowChecked=true; const fps=frames*1000/(t-t0); stage.dataset.fps=fps.toFixed(1); if(fps<12&&opt.onSlow&&!/[?&]force3d\b/.test(location.search)) opt.onSlow(); } } if(dirty) render(); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop); render(); opt.onReady&&opt.onReady();
  // input
  const el=renderer.domElement, P=new Map(); let last=null;
  const info=()=>{ const a=[...P.values()]; if(a.length===1) return {n:1,x:a[0].x,y:a[0].y,btn:a[0].btn};
    const [p,q]=a; return {n:2,x:(p.x+q.x)/2,y:(p.y+q.y)/2,d:Math.hypot(p.x-q.x,p.y-q.y),ang:Math.atan2(q.y-p.y,q.x-p.x)}; };
  function pan(dx,dy){ const k=st.dist/stage.clientHeight*1.1; const c=Math.cos(st.th),s=Math.sin(st.th);
    st.tx+=(-dx*c-dy*s)*k; st.tz+=(dx*s-dy*c)*k; }
  el.addEventListener('pointerdown',e=>{ try{el.setPointerCapture(e.pointerId)}catch(_){} P.set(e.pointerId,{x:e.clientX,y:e.clientY,btn:(e.button===2||e.shiftKey||e.ctrlKey)?'pan':null}); last=info(); });
  el.addEventListener('pointermove',e=>{ if(!P.has(e.pointerId)) return; const p=P.get(e.pointerId); p.x=e.clientX; p.y=e.clientY; const n=info();
    if(last&&n.n===last.n){ const dx=n.x-last.x, dy=n.y-last.y;
      if(n.n===1){ if(mode==='pan'||n.btn==='pan') pan(dx,dy); else { st.th-=dx*0.0065; st.ph-=dy*0.005; } }
      else { if(last.d>0) st.dist*=last.d/n.d; let da=n.ang-last.ang; if(da>Math.PI)da-=2*Math.PI; if(da<-Math.PI)da+=2*Math.PI; st.th-=da; st.ph-=dy*0.006; }
      dirty=true; }
    last=n; });
  const up=e=>{ P.delete(e.pointerId); last=P.size?info():null; };
  el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up);
  el.addEventListener('contextmenu',e=>e.preventDefault());
  el.addEventListener('wheel',e=>{ e.preventDefault(); st.dist*=Math.exp(e.deltaY*(e.ctrlKey?0.01:0.0012)); dirty=true; },{passive:false});
  addEventListener('resize',()=>{ renderer.setSize(stage.clientWidth,stage.clientHeight); camera.aspect=stage.clientWidth/stage.clientHeight; camera.updateProjectionMatrix(); dirty=true; });
  return {
    shore: async now=>{ want=now; if(now&&!tex.now) await loadTex('now','tex-today.jpg'); if(want!==now) return; mat.map= now?tex.now:tex.old; mat.needsUpdate=true; dirty=true; },
    mode: m=>{ mode=m; }, reset: ()=>{ Object.assign(st,home); dirty=true; },
    pause: p=>{ paused=p; renderer.domElement.style.visibility=p?'hidden':''; mks.forEach(m=>m.el.style.display=p?'none':''); if(!p) dirty=true; },
    state: st, set:o=>{Object.assign(st,o);dirty=true;}, fps:()=>stage.dataset.fps
  };
}
function loadImg(u){ return new Promise((r,j)=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=j; i.src=u; }); }
