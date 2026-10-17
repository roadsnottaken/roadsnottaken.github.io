/* Mobile "poster" mode: the whole site on one zoomable canvas (<=700px wide). */
(function(){
var root=document.documentElement;if(!root.classList.contains('poster'))return;
var mq=window.matchMedia('(max-width:700px)');
mq.addEventListener&&mq.addEventListener('change',function(){location.reload()});
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var COLW=560,GAP=36,PAD=40;

/* ---------- build the canvas ---------- */
var pv=document.createElement('div');pv.id='pv';pv.setAttribute('aria-label','Zoomable overview of the whole site. Pinch to zoom, drag to pan, double-tap a section to read it.');
var pc=document.createElement('div');pc.id='pc';pv.appendChild(pc);
var labels=document.createElement('div');labels.id='plabels';pc.appendChild(labels);
var cols=document.createElement('div');cols.id='pcols';pc.appendChild(cols);
var hero=document.querySelector('header.hero'),main=document.querySelector('main'),foot=document.querySelector('body>footer');
cols.appendChild(hero);
[].slice.call(main.children).forEach(function(s){if(s.id!=='overview')cols.appendChild(s)});
cols.appendChild(foot);
document.body.insertBefore(pv,document.body.firstChild);
// full text: open every details panel, list every timeline event
[].forEach.call(cols.querySelectorAll('details'),function(d){d.open=true});
if(window.RNT_T){var tl=document.getElementById('tl');var ol=document.createElement('ol');ol.className='tl-all';
 window.RNT_T.forEach(function(t){var li=document.createElement('li');li.innerHTML='<b>'+t[0]+'</b> <strong>'+t[2]+'.</strong> '+t[3];ol.appendChild(li)});
 tl.parentNode.insertBefore(ol,tl.nextSibling)}
// key number + takeaway per section (from the overview tiles)
var info={top:['Roads Not Taken','1972','Vancouver stopped the freeway into its core.']};
[].forEach.call(document.querySelectorAll('#overview .tile'),function(t){info[t.dataset.target]=[t.querySelector('small').textContent,t.querySelector('b').textContent,t.querySelector('span').textContent]});
var extra={start:['Start','6 steps','The story in brief.'],gained:info.gained,terrain:['3D terrain','North Shore','Mountains and water shape the city.'],articles:['Articles','2 essays','The long reads behind this site.']};
for(var k in extra)if(!info[k]&&extra[k])info[k]=extra[k];
// static thumbnails instead of live map / 3D
function thumb(src,label,open){var b=document.createElement('button');b.type='button';b.className='pthumb';b.dataset.open=open;b.innerHTML='<img src="'+src+'" alt="" loading="lazy"><span>'+label+'</span>';return b}
var lb=document.getElementById('leaflet');lb.parentNode.insertBefore(thumb('../assets/thumb-map.jpg','Tap to open the interactive map (© OpenStreetMap contributors)','map'),lb);
[].forEach.call(document.querySelectorAll('.m3d'),function(m){m.parentNode.insertBefore(thumb('../assets/thumb-'+m.dataset.model+'.jpg','Tap to open in 3D','model:'+m.dataset.model),m)});
var ts=document.getElementById('terrain-slot');ts.parentNode.insertBefore(thumb('../assets/thumb-terrain.jpg','Tap to open the 3D terrain','terrain'),ts);

/* ---------- full-screen viewer for map / 3D ---------- */
var pov=document.createElement('div');pov.className='pov';pov.setAttribute('role','dialog');pov.setAttribute('aria-modal','true');pov.hidden=true;
pov.innerHTML='<button type="button" class="pov-close" aria-label="Close">✕ Close</button><div class="pov-body"></div>';document.body.appendChild(pov);
var body=pov.querySelector('.pov-body'),opened=null,home=null,homeNext=null;
function openItem(what){
 var el;
 if(what==='map'){el=lb}
 else if(what==='terrain'){el=document.createElement('iframe');el.src='../terrain.html';el.title='3D terrain model';el.className='pov-frame'}
 else{el=document.querySelector('.m3d[data-model="'+what.split(':')[1]+'"]')}
 if(el.parentNode){home=el.parentNode;homeNext=el.nextSibling}else home=null;
 body.appendChild(el);opened=el;pov.hidden=false;
 if(what==='map'){if(window.RNTloadMap)window.RNTloadMap();setTimeout(function(){if(window.RNTmap){window.RNTmap.invalidateSize();var a=lb.querySelector('.activate');if(a&&!lb.classList.contains('active'))a.click()}},400)}
 else if(what!=='terrain'){var tryStart=function(){if(window.RNTstartModel)window.RNTstartModel(el);else setTimeout(tryStart,200)};requestAnimationFrame(tryStart)}
 pov.querySelector('.pov-close').focus();
}
function closeItem(){pov.hidden=true;if(opened){if(home)home.insertBefore(opened,homeNext);else opened.remove()}opened=null}
pov.querySelector('.pov-close').addEventListener('click',closeItem);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!pov.hidden)closeItem()});

/* ---------- layout: pick a column count so the canvas matches the screen shape ---------- */
var W=0,H=0,secs=[];
function layout(){
 var vw=pv.clientWidth,vh=pv.clientHeight,target=vh/vw,best=null;
 for(var n=3;n<=12;n++){
  cols.style.width=(n*COLW+(n-1)*GAP)+'px';cols.style.columnCount=n;
  var w=cols.offsetWidth+PAD*2,h=cols.offsetHeight+PAD*2,d=Math.abs(Math.log((h/w)/target));
  if(!best||d<best.d)best={n:n,d:d};
 }
 cols.style.width=(best.n*COLW+(best.n-1)*GAP)+'px';cols.style.columnCount=best.n;
 W=cols.offsetWidth+PAD*2;H=cols.offsetHeight+PAD*2;pc.style.width=W+'px';pc.style.height=H+'px';
 // section boxes in canvas coordinates (first column fragment)
 var pr=pc.getBoundingClientRect(),s0=S.s;secs=[];labels.innerHTML='';
 [].forEach.call(cols.children,function(el){
  var r=el.getClientRects()[0]||el.getBoundingClientRect();
  var box={el:el,x:(r.left-pr.left)/s0,y:(r.top-pr.top)/s0,w:r.width/s0,h:el.getBoundingClientRect().height/s0};
  var id=el.id||(el.tagName==='FOOTER'?'':'');var inf=info[id];
  var h2=el.querySelector('h1,h2');
  if(inf||h2){var L=document.createElement('div');L.className='plabel';
   var title=h2?h2.textContent.replace(/(Concept model|Speculative|Partly speculative)/g,'').trim():inf[0];
   L.innerHTML='<b>'+title+'</b>'+(inf?'<em>'+inf[1]+'</em><span>'+inf[2]+'</span>':'');
   L.style.left=box.x+'px';L.style.top=box.y+'px';labels.appendChild(L);box.label=L}
  secs.push(box);
 });
}

/* ---------- pan / zoom engine ---------- */
var S={x:0,y:0,s:1},fitS=1,raf=0,settle=0,anim=null,vel={x:0,y:0};
function minS(){return fitS*0.9}function maxS(){return 2.2}
function clamp(){
 var vw=pv.clientWidth,vh=pv.clientHeight,cw=W*S.s,chh=H*S.s,m=vw*0.3;
 S.x=cw<vw?(vw-cw)/2:Math.min(m,Math.max(vw-cw-m,S.x));
 S.y=chh<vh?(vh-chh)/2:Math.min(m,Math.max(vh-chh-m,S.y));
}
function apply(moving){
 pc.style.transform='translate3d('+S.x+'px,'+S.y+'px,0) scale('+S.s+')';
 var low=S.s<fitS*2.2,mid=!low&&S.s<0.55;
 pc.classList.toggle('z-low',low);pc.classList.toggle('z-fit',S.s<fitS*1.4);pc.classList.toggle('z-mid',mid);pc.classList.toggle('z-read',!low&&!mid);
 var inv=1/S.s,lw=COLW*S.s;
 secs.forEach(function(b){if(b.label){b.label.style.transform='scale('+inv+')';b.label.style.width=Math.max(lw,60)+'px'}});
 mini();
 if(moving){pc.classList.add('moving');clearTimeout(settle);settle=setTimeout(function(){pc.classList.remove('moving');if(window.RNTmotionCheck)window.RNTmotionCheck()},160)}
}
function zoomAt(px,py,ns){ns=Math.max(minS(),Math.min(maxS(),ns));S.x=px-(px-S.x)*(ns/S.s);S.y=py-(py-S.y)*(ns/S.s);S.s=ns}
function tween(to,ms){
 cancelAnimationFrame(raf);if(reduce){S.x=to.x;S.y=to.y;S.s=to.s;clamp();apply(false);return}
 var from={x:S.x,y:S.y,s:S.s},t0=performance.now();
 (function step(t){var k=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-k,3);
  S.s=from.s*Math.pow(to.s/from.s,e);S.x=from.x+(to.x-from.x)*e;S.y=from.y+(to.y-from.y)*e;
  apply(true);if(k<1)raf=requestAnimationFrame(step);else{clamp();apply(true)}})(t0);
}
function fitAll(animate){var vw=pv.clientWidth,vh=pv.clientHeight;fitS=Math.min(vw/W,vh/H);
 var to={s:fitS,x:(vw-W*fitS)/2,y:(vh-H*fitS)/2};if(animate)tween(to,380);else{S.x=to.x;S.y=to.y;S.s=to.s;apply(false)}}
var lastZoomT=0;function zoomToBox(b){lastZoomT=performance.now();var vw=pv.clientWidth,s=Math.min(maxS(),(vw-16)/COLW);
 var to={s:s,x:8-b.x*s,y:12-b.y*s};tween(to,420)}
function boxFor(el){var sec=el.closest('#pcols>*');for(var i=0;i<secs.length;i++)if(secs[i].el===sec)return secs[i];return null}
function boxAt(cx,cy){ // canvas point -> section whose column fragment contains it
 var el=document.elementFromPoint(cx,cy);return el?boxFor(el):null}

var ptr={},last=null,moved=0,dragEnd=0,lastTap=0,lastTapXY=null,pinch=null,hist=[];
pv.addEventListener('pointerdown',function(e){
 if(e.target.closest('.ptool'))return;
 cancelAnimationFrame(raf);ptr[e.pointerId]={x:e.clientX,y:e.clientY};
 var ids=Object.keys(ptr);
 if(ids.length===1){moved=0;last={x:e.clientX,y:e.clientY};hist=[{x:e.clientX,y:e.clientY,t:performance.now()}]}
 if(ids.length===2){var a=ptr[ids[0]],b=ptr[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s:S.s,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};moved=99}
});
pv.addEventListener('pointermove',function(e){
 if(!ptr[e.pointerId])return;ptr[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(ptr);
 if(ids.length>=2&&pinch){var a=ptr[ids[0]],b=ptr[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  S.x+=mx-pinch.mx;S.y+=my-pinch.my;pinch.mx=mx;pinch.my=my;zoomAt(mx,my,pinch.s*d/pinch.d);apply(true)}
 else if(ids.length===1&&last){var dx=e.clientX-last.x,dy=e.clientY-last.y;moved+=Math.abs(dx)+Math.abs(dy);
  if(moved>6){S.x+=dx;S.y+=dy;clamp();apply(true);if(!pv.hasPointerCapture(e.pointerId))try{pv.setPointerCapture(e.pointerId)}catch(_){} }
  last={x:e.clientX,y:e.clientY};hist.push({x:e.clientX,y:e.clientY,t:performance.now()});if(hist.length>6)hist.shift()}
});
function up(e){
 if(!ptr[e.pointerId])return;delete ptr[e.pointerId];var ids=Object.keys(ptr);
 if(ids.length===1){var p=ptr[ids[0]];last={x:p.x,y:p.y};pinch=null;return}
 if(ids.length)return;
 if(pinch){pinch=null;dragEnd=performance.now();clamp();apply(true);return}
 if(moved>6){dragEnd=performance.now(); // inertia
  var h0=hist[0],h1=hist[hist.length-1],dt=Math.max(16,h1.t-h0.t);vel={x:(h1.x-h0.x)/dt*16,y:(h1.y-h0.y)/dt*16};
  if(reduce)return;
  (function glide(){vel.x*=0.94;vel.y*=0.94;S.x+=vel.x;S.y+=vel.y;clamp();apply(true);if(Math.abs(vel.x)+Math.abs(vel.y)>0.4)raf=requestAnimationFrame(glide)})();return}
 // tap / double-tap
 var now=performance.now(),xy={x:e.clientX,y:e.clientY};
 if(now-lastZoomT>450&&now-lastTap<320&&lastTapXY&&Math.hypot(xy.x-lastTapXY.x,xy.y-lastTapXY.y)<40){lastTap=0;var b=boxAt(xy.x,xy.y);if(b){var vw=pv.clientWidth;if(Math.abs(S.s-(vw-16)/COLW)<0.02)fitAll(true);else zoomToBox(b)}return}
 lastTap=now;lastTapXY=xy;
}
pv.addEventListener('pointerup',up);pv.addEventListener('pointercancel',up);
// clicks: suppress after drags; at low zoom a tap zooms into the section instead of following links
pv.addEventListener('click',function(e){
 if(e.target.closest('.ptool'))return;
 if(performance.now()-dragEnd<350){e.preventDefault();e.stopPropagation();return}
 var th=e.target.closest('.pthumb');
 if(S.s<fitS*2.2){e.preventDefault();e.stopPropagation();var b=boxFor(e.target);if(b)zoomToBox(b);return}
 if(th){e.preventDefault();openItem(th.dataset.open);return}
 var a=e.target.closest('a[href^="#"]');
 if(a){var t=document.getElementById(a.getAttribute('href').slice(1));if(t){e.preventDefault();var b2=boxFor(t)||boxFor(t.closest('section')||t);if(b2)zoomToBox(b2)}}
},true);
pv.addEventListener('wheel',function(e){e.preventDefault();if(e.ctrlKey||Math.abs(e.deltaY)>0&&e.altKey===false&&e.deltaMode===0&&e.ctrlKey){}
 if(e.ctrlKey){zoomAt(e.clientX,e.clientY,S.s*Math.exp(-e.deltaY/200))}else{S.x-=e.deltaX;S.y-=e.deltaY}clamp();apply(true)},{passive:false});
// iOS Safari: stop the page itself from pinch-zooming while the canvas handles it
['gesturestart','gesturechange'].forEach(function(n){pv.addEventListener(n,function(e){e.preventDefault()},{passive:false})});

/* ---------- toolbar + minimap ---------- */
var tool=document.createElement('div');tool.className='ptool';
tool.innerHTML='<a class="pfit phome" href="../" aria-label="Home">← Home</a><button type="button" class="pfit" aria-label="Fit all">⤢ Fit all</button><div class="pmini" aria-hidden="true"><i></i></div>';
document.body.appendChild(tool);
tool.querySelector('.pfit').addEventListener('click',function(){fitAll(true)});
var mm=tool.querySelector('.pmini'),mr=mm.querySelector('i');
function mini(){if(!W)return;var mw=mm.clientWidth,k=mw/W;mm.style.height=(H*k)+'px';
 var vw=pv.clientWidth,vh=pv.clientHeight;mr.style.left=(-S.x/S.s*k)+'px';mr.style.top=(-S.y/S.s*k)+'px';mr.style.width=(vw/S.s*k)+'px';mr.style.height=(vh/S.s*k)+'px';
 tool.classList.toggle('zoomed',S.s>fitS*1.3)}
mm.addEventListener('click',function(e){var r=mm.getBoundingClientRect(),k=mm.clientWidth/W,cx=(e.clientX-r.left)/k,cy=(e.clientY-r.top)/k,vw=pv.clientWidth,vh=pv.clientHeight,s=Math.max(S.s,0.6);
 tween({s:s,x:vw/2-cx*s,y:vh/2-cy*s},380)});

function init(){S.s=1;S.x=0;S.y=0;pc.style.transform='none';layout();fitAll(false)}
if(document.readyState==='complete')init();else window.addEventListener('load',init);
var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){if(mq.matches)init()},200)});
window.RNTposter={fit:function(){fitAll(false)},zoomTo:function(id){var b=boxFor(document.getElementById(id));if(b){var vw=pv.clientWidth,s=(vw-16)/COLW;S.s=s;S.x=8-b.x*s;S.y=12-b.y*s;apply(false)}},set:function(s,cx,cy){var vw=pv.clientWidth,vh=pv.clientHeight;S.s=s;S.x=vw/2-cx*s;S.y=vh/2-cy*s;clamp();apply(false)},state:function(){return {s:S.s,fit:fitS,W:W,H:H}}};
})();
