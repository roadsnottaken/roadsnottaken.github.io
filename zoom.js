/* Infinite-zoom camera: pan, pinch, wheel, double-tap, semantic levels of detail, lazy images, minimap. No dependencies. */
(function(){
'use strict';
var VP=document.getElementById('vp'),W=document.getElementById('world');
if(!VP||!W)return;
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
var T1=0.3,T2=0.9,MAXS=6;           // LOD thresholds (on-screen scale) and max zoom
var s=1,tx=0,ty=0,minS=0.02,lod=-1,box={x:0,y:0,w:1,h:1},homeR=null,allR=null,mode='';
var VV=window.visualViewport,TOP=56,BOT=0;
function vsize(){return VV?{w:Math.round(VV.width),h:Math.round(VV.height)}:{w:innerWidth,h:innerHeight}}
var vw=vsize().w,vh=vsize().h;
var R={};['hero','t1','t2','t3','map','story','archive','essays'].forEach(function(k){R[k]=document.getElementById('rg-'+k)});
var ROWS={land:[['hero'],['t1','t2','t3'],['map','story','archive'],['essays']],port:[['hero'],['t1','t2'],['t3','map'],['story','archive'],['essays']]};
var GAP=50;
function layout(){
  var vz=vsize();vw=vz.w;vh=vz.h;
  var m=vw/vh<1.05?'port':'land';mode=m;W.setAttribute('data-mode',m);
  var rows=ROWS[m],y=0,maxw=0,placed=[];
  R.hero.style.width='';
  rows.forEach(function(r){var w=0;r.forEach(function(k,i){w+=R[k].offsetWidth+(i?GAP:0)});maxw=Math.max(maxw,w)});
  // the hero spans the full row width so there is no empty dark margin beside it
  R.hero.style.width=maxw+'px';
  rows.forEach(function(r){var w=0,h=0;r.forEach(function(k,i){w+=R[k].offsetWidth+(i?GAP:0);h=Math.max(h,R[k].offsetHeight)});
    var x=(maxw-w)/2;r.forEach(function(k){var el=R[k];el.style.left=x+'px';el.style.top=y+'px';el._r={x:x,y:y,w:el.offsetWidth,h:el.offsetHeight};x+=el.offsetWidth+GAP});y+=h+GAP});
  box={x:0,y:0,w:maxw,h:y-GAP};W.style.width=box.w+'px';W.style.height=box.h+'px';
  var hk=m==='port'?['hero','t1','t2','t3']:['hero','t1','t2','t3'];
  homeR=union(hk.map(function(k){return R[k]._r}));
  // in portrait, the "home" view is the hero plus the three theme headers
  if(m==='port'){var t3=R.t3._r,hd=R.t3.querySelector('.rh');homeR=union([R.hero._r,{x:t3.x,y:t3.y,w:t3.w,h:hd.offsetHeight+40},R.t1._r]);homeR.h=t3.y+hd.offsetHeight+40-homeR.y}
  else{var hd1=R.t1.querySelector('.rh');homeR={x:R.t1._r.x,y:0,w:R.t3._r.x+R.t3._r.w-R.t1._r.x,h:R.t1._r.y+hd1.offsetHeight+380}}
  allR=box;
  // 1898 map backdrop behind the theme rows
  var BG=document.getElementById('bgmap');if(BG){var y0=R.t1._r.y-30,y1=m==='port'?R.t3._r.y+R.t3._r.h:R.t1._r.y+Math.max(R.t1._r.h,R.t2._r.h,R.t3._r.h);BG.style.cssText='left:0;top:'+y0+'px;width:'+box.w+'px;height:'+(y1-y0+30)+'px'}
  // never zoom out past the point where the content fills the frame: on a phone this is width-fit
  minS=Math.max(vw/box.w,(vh-TOP)/box.h);
  cacheImgs();buildMinimap();
}
function union(a){var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;a.forEach(function(r){x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.h)});return{x:x0,y:y0,w:x1-x0,h:y1-y0}}
function fitScale(r,pad){pad=pad==null?14:pad;return Math.min((vw-2*pad)/r.w,(vh-TOP-BOT-2*pad)/r.h)}
// world rect of any element (independent of the current transform)
function wrect(el){var b=el.getBoundingClientRect();return{x:(b.left-tx)/s,y:(b.top-ty)/s,w:b.width/s,h:b.height/s}}
function clampS(v){return Math.max(minS,Math.min(MAXS,v))}
function clampT(){var ww=box.w*s,wh=box.h*s;
  if(ww<=vw)tx=(vw-ww)/2;else tx=Math.min(0,Math.max(vw-ww,tx));
  if(wh<=vh-TOP)ty=TOP+(vh-TOP-wh)/2;else ty=Math.min(TOP,Math.max(vh-wh,ty))}
var raf=0;
function apply(){clampT();W.style.transform='translate('+tx.toFixed(2)+'px,'+ty.toFixed(2)+'px) scale('+s.toFixed(5)+')';
  var L=s>=T2?2:s>=T1?1:0;if(L!==lod){lod=L;W.setAttribute('data-lod',L);setLvl();lazy()}
  // hide a text level only when its glyphs would be under ~2 screen px (l2 ~9-10u, l3 ~6-8u)
  var V=s>=0.28?'2':s>=0.2?'1':'0';if(V!==W.getAttribute('data-v'))W.setAttribute('data-v',V);
  if(!raf)raf=requestAnimationFrame(function(){raf=0;drawMM()})}
function zoomAt(px,py,ns){ns=clampS(ns);tx=px-(px-tx)*(ns/s);ty=py-(py-ty)*(ns/s);s=ns}
// ---- animation
var anim=null;
function fly(cx,cy,ns,dur){stopAnim();ns=clampS(ns);var cy0=((vh+TOP-BOT)/2-ty)/s,cx0=(vw/2-tx)/s,s0=s,t0=performance.now();dur=RM?0:(dur||650);
  moving();
  function set(k){var ls=Math.log(s0)+(Math.log(ns)-Math.log(s0))*k;s=Math.exp(ls);
    // keep the motion feeling like a zoom: interpolate the centre in screen space of the end state
    var c=k;var x=cx0+(cx-cx0)*c,y=cy0+(cy-cy0)*c;tx=vw/2-x*s;ty=(vh+TOP-BOT)/2-y*s;apply()}
  if(!dur){set(1);settle();return}
  anim=function(now){var k=Math.min(1,(now-t0)/dur);k=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;set(k);if(k<1)anim.id=requestAnimationFrame(anim);else{anim=null;settle()}};
  anim.id=requestAnimationFrame(anim)}
function stopAnim(){if(anim){cancelAnimationFrame(anim.id);anim=null}if(inert){cancelAnimationFrame(inert);inert=0}}
function flyRect(r,minScale,anchorTop){var ns=fitScale(r);if(minScale)ns=Math.max(ns,minScale);ns=clampS(ns);
  var cx=r.x+r.w/2,cy=r.y+r.h/2,hw=(vw/2-14)/ns,hh=((vh-TOP-BOT)/2-14)/ns;
  if(r.w>2*hw)cx=r.x+hw;if(r.h>2*hh||anchorTop)cy=r.y+Math.min(r.h/2,hh);
  fly(cx,cy,ns)}
function home(){fly(box.w/2,(vh-TOP)/2/minS,minS)}
function all(){var cx=(vw/2-tx)/s,cy=(vh/2-ty)/s;fly(cx,cy,minS)}
// ---- moving / settle (will-change only while moving so text re-rasterises crisp at rest)
var st=0;
function moving(){clearTimeout(st);st=setTimeout(function(){if(!ptr.size&&!anim&&!inert)settle()},220)}
function settle(){clearTimeout(st);lazy();repaint()}
function repaint(){var o=W.style.transform;W.style.transform=o+' translate(0.01px,0)';void W.offsetWidth;requestAnimationFrame(function(){W.style.transform=o;W.classList.toggle('rp')})}
// ---- pointers
var ptr=new Map(),g=null,moved=0,sup=false,vel={x:0,y:0,t:0},inert=0,caps=[];
function mid(){var a=[...ptr.values()];return{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1}}
function startG(){if(ptr.size>=2){var m=mid();g={k:2,m:m,s:s,tx:tx,ty:ty}}else if(ptr.size===1){var p=[...ptr.values()][0];g={k:1,x:p.x,y:p.y,tx:tx,ty:ty}}else g=null}
VP.addEventListener('pointerdown',function(e){if(e.button>0)return;hintOff();stopAnim();ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptr.size===1){moved=0;sup=false}startG();vel={x:0,y:0,t:performance.now()}});
VP.addEventListener('pointermove',function(e){if(!ptr.has(e.pointerId))return;var p=ptr.get(e.pointerId),ox=p.x,oy=p.y;p.x=e.clientX;p.y=e.clientY;
  if(!g)return;
  if(g.k===2&&ptr.size>=2){var m=mid(),ns=clampS(g.s*m.d/g.m.d);var wx=(g.m.x-g.tx)/g.s,wy=(g.m.y-g.ty)/g.s;s=ns;tx=m.x-wx*ns;ty=m.y-wy*ns;moved=99}
  else if(g.k===1){var dx=p.x-g.x,dy=p.y-g.y;moved=Math.max(moved,Math.hypot(dx,dy));tx=g.tx+dx;ty=g.ty+dy;
    var now=performance.now(),dt=Math.max(1,now-vel.t);vel={x:.8*(p.x-ox)/dt+.2*vel.x,y:.8*(p.y-oy)/dt+.2*vel.y,t:now}}
  if(moved>6){sup=true;if(!VP.hasPointerCapture(e.pointerId)){try{VP.setPointerCapture(e.pointerId)}catch(_){}}VP.classList.add('drag');moving();apply()}});
function up(e){if(!ptr.has(e.pointerId))return;var wasPan=g&&g.k===1;ptr.delete(e.pointerId);VP.classList.remove('drag');
  if(ptr.size){startG();return}
  g=null;
  if(wasPan&&sup&&performance.now()-vel.t<60&&!RM){var vx=vel.x*16,vy=vel.y*16;
    var step=function(){vx*=.92;vy*=.92;tx+=vx;ty+=vy;apply();if(Math.abs(vx)+Math.abs(vy)>.4)inert=requestAnimationFrame(step);else{inert=0;settle()}};inert=requestAnimationFrame(step)}
  else moving()}
VP.addEventListener('pointerup',up);VP.addEventListener('pointercancel',up);
// Safari's own pinch-zoom of the page
var gs0=1;['gesturestart','gesturechange','gestureend'].forEach(function(n){document.addEventListener(n,function(e){e.preventDefault();
  if(ptr.size)return; // iOS: touches already handled by pointer events
  if(n==='gesturestart'){gs0=s;stopAnim()}else if(n==='gesturechange'){zoomAt(e.clientX||vw/2,e.clientY||vh/2,gs0*e.scale);moving();apply()}},{passive:false})});
// ---- wheel / trackpad
VP.addEventListener('wheel',function(e){e.preventDefault();hintOff();stopAnim();var dy=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?vh:1),dx=e.deltaX*(e.deltaMode===1?33:1);
  var mouse=e.deltaMode!==0||(dx===0&&Math.abs(dy)>=40&&Number.isInteger(dy));
  if(e.ctrlKey){zoomAt(e.clientX,e.clientY,s*Math.exp(-dy*0.012))}
  else if(mouse){zoomAt(e.clientX,e.clientY,s*Math.exp(-Math.sign(dy)*Math.min(Math.abs(dy),240)*0.0022))}
  else{tx-=dx;ty-=dy}
  moving();apply()},{passive:false});
// ---- taps: single tap on a [data-z] zooms to fit it; double tap zooms in 2.6x at the point
var lastTap={t:0,x:0,y:0},pend=0;
VP.addEventListener('click',function(e){
  if(sup){e.preventDefault();e.stopPropagation();sup=false;return}
  var now=performance.now(),x=e.clientX,y=e.clientY;
  if(e.target.closest('a,button')){lastTap.t=0;return}
  if(now-lastTap.t<320&&Math.hypot(x-lastTap.x,y-lastTap.y)<40){clearTimeout(pend);lastTap.t=0;var ns=clampS(s*(e.shiftKey?1/2.6:2.6));
    var cx=(x-tx)/s,cy=(y-ty)/s;var tcx=cx+(vw/2-x)/ns,tcy=cy+((vh+TOP-BOT)/2-y)/ns;fly(tcx,tcy,ns,420);return}
  lastTap={t:now,x:x,y:y};
  var z=e.target.closest('[data-z]');if(!z)return;
  clearTimeout(pend);pend=setTimeout(function(){var r=wrect(z),zs=parseFloat(z.getAttribute('data-zs'))||0;
    var minScale=zs||(z.classList.contains('rh')?T1*1.02:0);
    if(z.classList.contains('rh')){r=wrect(z.parentNode);minScale=Math.max(minScale,T1*1.02)}
    var target=Math.max(fitScale(r),minScale);if(s>=target*0.93&&s<=target*1.6)return;flyRect(r,minScale,true)},300)},true);
// links that fly inside the canvas (e.g. "See the map")
W.addEventListener('click',function(e){var a=e.target.closest('a[data-fly]');if(!a||sup)return;var el=document.getElementById(a.getAttribute('data-fly'));if(!el)return;e.preventDefault();flyRect(wrect(el),T1*1.2,true)});
// ---- keyboard & focus
document.addEventListener('keydown',function(e){if(e.target.closest&&e.target.closest('input,textarea'))return;var k=e.key,c=[vw/2,(vh+TOP-BOT)/2];
  if(k==='+'||k==='='){fly((c[0]-tx)/s,(c[1]-ty)/s,s*1.8,300)}else if(k==='-'||k==='_'){fly((c[0]-tx)/s,(c[1]-ty)/s,s/1.8,300)}else if(k==='0'){home()}
  else if(k.indexOf('Arrow')===0&&!(e.target.closest&&e.target.closest('a,button'))){var d=120;tx+=k==='ArrowLeft'?d:k==='ArrowRight'?-d:0;ty+=k==='ArrowUp'?d:k==='ArrowDown'?-d:0;moving();apply()}else return;e.preventDefault()});
W.addEventListener('focusin',function(e){var b=e.target.getBoundingClientRect();if(b.top>TOP&&b.bottom<vh-BOT&&b.left>0&&b.right<vw&&lod>=1)return;var z=e.target.closest('[data-z]')||e.target;flyRect(wrect(z),T2*1.1,true)});
// ---- buttons
document.querySelector('.ctl').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var a=b.getAttribute('data-a'),c=[vw/2,(vh+TOP-BOT)/2];
  if(a==='in')fly((c[0]-tx)/s,(c[1]-ty)/s,s*2,360);else if(a==='out')fly((c[0]-tx)/s,(c[1]-ty)/s,s/2,360);else if(a==='home')home();else all()});
// ---- level indicator
var LV=document.getElementById('lvl'),NAMES=['Overview','Themes & items','Full detail'];
function setLvl(){var i=LV.querySelectorAll('i');for(var n=0;n<3;n++)i[n].className=n<=lod?'on':'';LV.querySelector('span').textContent=NAMES[lod]}
// ---- lazy images by zoom level
var IM=[],mapDone=false;
function cacheImgs(){IM=[].slice.call(W.querySelectorAll('img[data-l]')).map(function(im){return{el:im,r:wrect(im)}})}
function view(){return{x:-tx/s,y:-ty/s,w:vw/s,h:vh/s}}
function hit(a,b,m){return a.x<b.x+b.w+m&&a.x+a.w>b.x-m&&a.y<b.y+b.h+m&&a.y+a.h>b.y-m}
// small (-s) images are in the HTML from the start; the large (-l) file swaps in once an image
// is shown wider than its small file has pixels, and only if it is on or near the screen
var DPR=Math.min(3,window.devicePixelRatio||1);
function lazy(){var v=view(),m=Math.max(v.w,v.h)*.25;
  IM.forEach(function(o){if(!hit(o.r,v,m))return;var im=o.el;
    if(!im._hi&&o.r.w*s*DPR>560){im._hi=1;var hi=new Image();hi.decoding='async';hi.onload=function(){im.src=hi.src};hi.src=im.getAttribute('data-l')}});
  if(!mapDone&&hit(R.map._r,v,m)){mapDone=true;fetch('assets/cmap.svg').then(function(r){return r.text()}).then(function(t){var sl=W.querySelectorAll('.svgslot');
    sl.forEach(function(el,i){el.innerHTML=i?t.replace(/id="cmh"/g,'id="cmh2"').replace(/url\(#cmh\)/g,'url(#cmh2)'):t})}).catch(function(){mapDone=false})}}
// ---- minimap
var MM=document.getElementById('mm'),MMI=MM.querySelector('.mmi'),MV=MM.querySelector('.vw'),mk=1;
function buildMinimap(){var mw=vw<500?92:128,mh=vw<500?120:120;mk=Math.min(mw/box.w,mh/box.h);MM.style.width=(box.w*mk+4)+'px';MM.style.height=(box.h*mk+4)+'px';
  MMI.innerHTML='';Object.keys(R).forEach(function(k){var r=R[k]._r,i=document.createElement('i');i.className=k==='hero'?'h':/^t\d/.test(k)?'t':'';
    i.style.cssText='left:'+(2+r.x*mk)+'px;top:'+(2+r.y*mk)+'px;width:'+Math.max(2,r.w*mk)+'px;height:'+Math.max(2,r.h*mk)+'px';i.title=R[k].getAttribute('data-name')||k;MMI.appendChild(i)})}
function drawMM(){var v=view();var x=Math.max(0,v.x),y=Math.max(0,v.y),x1=Math.min(box.w,v.x+v.w),y1=Math.min(box.h,v.y+v.h);
  MV.style.cssText='left:'+(2+x*mk)+'px;top:'+(2+y*mk)+'px;width:'+Math.max(3,(x1-x)*mk)+'px;height:'+Math.max(3,(y1-y)*mk)+'px'}
MM.addEventListener('pointerdown',function(e){e.stopPropagation();var b=MM.getBoundingClientRect();var wx=(e.clientX-b.left-2)/mk,wy=(e.clientY-b.top-2)/mk;fly(wx,wy,Math.max(s,T1*1.1),500)});
// ---- hint
var H=document.getElementById('hint'),hinted=false;function hintOff(){if(hinted)return;hinted=true;setTimeout(function(){H.classList.add('off')},1800)}
setTimeout(function(){H.classList.add('off')},9000);
// ---- boot
function boot(keep){var c=null;if(keep&&homeR){c={x:(vw/2-tx)/s,y:((vh+TOP-BOT)/2-ty)/s,s:s}}
  layout();
  if(c){s=clampS(c.s);tx=vw/2-c.x*s;ty=(vh+TOP-BOT)/2-c.y*s;apply();return}
  var hash=location.hash.slice(1),el=hash&&document.getElementById(hash);
  s=minS;tx=(vw-box.w*s)/2;ty=TOP;apply();settle();
  if(el&&el!==VP)setTimeout(function(){flyRect(wrect(el),T1*1.2,true)},300)}
var rz=0;function onRz(){clearTimeout(rz);rz=setTimeout(function(){var old=mode;var z=vsize();boot((z.w/z.h<1.05?'port':'land')===old)},150)}
addEventListener('resize',onRz);if(VV)VV.addEventListener('resize',onRz);
boot(false);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){boot(hinted)});
window.__zoom={get:function(){return{s:s,tx:tx,ty:ty,lod:lod,mode:mode,box:box,home:homeR}},fly:fly,flyRect:flyRect,wrect:wrect,el:function(id){return wrect(document.getElementById(id))},T1:T1,T2:T2};
})();
