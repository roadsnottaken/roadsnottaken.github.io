/* Planned-vs-built comparison map. Usage: <div class="cmap" data-src="../assets/cmap.svg" data-mode="planned"></div> */
(function(){
var LEG='<div class="cm-legend">'+
'<span class="lg-plan"><i class="l-plan"></i>Planned route, approx.</span>'+
'<span class="lg-plan"><i class="l-tun"></i>Planned tunnel, approx.</span>'+
'<span class="lg-plan"><i class="box l-hit"></i>Cut through or displaced</span>'+
'<span class="lg-plan"><i class="l-ix"></i>Junction (design not sourced)</span>'+
'<span><i class="l-via"></i>Georgia &amp; Dunsmuir viaducts (built)</span>'+
'<span class="lg-built"><i class="box l-keep"></i>Neighbourhood kept</span>'+
'<span class="lg-built"><i class="l-expo"></i>Expo Line</span>'+
'<span class="lg-built"><i class="l-canada"></i>Canada Line</span>'+
'<span class="lg-built"><i class="l-mill"></i>Millennium Line</span>'+
'<span class="lg-built"><i class="l-bway"></i>Broadway Subway (building)</span>'+
'<span class="lg-built"><i class="l-seabus"></i>SeaBus</span>'+
'<span class="lg-built"><i class="l-seawall"></i>Seawall</span>'+
'<span class="lg-built"><i class="box l-park"></i>Parks</span></div>';
var HINT={planned:'<b>1967 plan.</b> Tap a label for a one-line note. Dashed lines are approximate.',built:'<b>What we got.</b> Tap a label for a one-line note. Faint red shows the old plan.'};
function init(el){
  if(el.dataset.ready)return;el.dataset.ready=1;
  var mode=el.dataset.mode||'planned';
  el.innerHTML='<div class="cm-bar" role="group" aria-label="Map layer"><button type="button" data-m="planned">1967 plan</button><button type="button" data-m="built">What we got</button><button type="button" class="cm-z" data-z="1" aria-label="Zoom in">+</button><button type="button" class="cm-z" data-z="-1" aria-label="Zoom out">−</button><button type="button" class="cm-z" data-z="0" aria-label="Reset zoom">⟲</button></div>'+
   '<div class="cm-view"><div class="cm-inner"></div></div>'+
   '<div class="cm-note" aria-live="polite"></div><ol class="cm-key"></ol>'+LEG;
  var inner=el.querySelector('.cm-inner'),view=el.querySelector('.cm-view'),note=el.querySelector('.cm-note');
  function set(m){mode=m;el.dataset.mode=m;el.querySelectorAll('.cm-bar button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.m===m)});note.innerHTML=HINT[m];
    var on=el.querySelector('.cm-lbl.on');if(on)on.classList.remove('on');el.dispatchEvent(new CustomEvent('cmap:mode',{detail:m,bubbles:true}))}
  el.cmapSet=set;
  el.querySelector('.cm-bar').addEventListener('click',function(e){var b=e.target.closest('button');if(b&&b.dataset.m)set(b.dataset.m)});
  set(mode);
  fetch(el.dataset.src).then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){inner.innerHTML=t;wire()}).catch(function(){inner.innerHTML='<img src="'+el.dataset.src+'" alt="Comparison map" style="width:100%">'});
  function fit(){if(el.classList.contains('narrow'))return;inner.querySelectorAll('.cm-lbl').forEach(function(g){var t=g.querySelector('text'),r=g.querySelector('rect'),l=g.querySelector('line');var w=t.getComputedTextLength()+22,x=Math.min(+r.getAttribute('x'),996-w);r.setAttribute('width',w);r.setAttribute('x',x);t.setAttribute('x',x+11);var cx=+l.getAttribute('x1');l.setAttribute('x2',Math.max(x,Math.min(x+w,cx)))})}
  function badges(){var key=el.querySelector('.cm-key'),n={plan:0,built:0},html='';
    inner.querySelectorAll('.cm-lbl').forEach(function(g,i){var grp=g.classList.contains('cm-only-built')?'built':'plan';var k=++n[grp];g.dataset.k=i;
      var r=g.querySelector('rect'),x=+r.getAttribute('x')+24,y=+r.getAttribute('y')+19;
      var b=document.createElementNS('http://www.w3.org/2000/svg','g');b.setAttribute('class','cm-badge');
      b.innerHTML='<circle cx="'+x+'" cy="'+y+'" r="24"/><text x="'+x+'" y="'+(y+10)+'" text-anchor="middle">'+k+'</text>';g.appendChild(b);
      var cls=g.classList.contains('cm-lp')?'k-p':g.classList.contains('cm-lh')?'k-h':'k-b';
      html+='<li class="'+cls+' cm-only-'+grp+'" data-k="'+i+'"><button type="button"><span>'+k+'</span>'+g.querySelector('title').textContent.replace(/</g,'&lt;')+'</button></li>'});
    key.innerHTML=html;key.addEventListener('click',function(e){var li=e.target.closest('li');if(li)show(inner.querySelector('.cm-lbl[data-k="'+li.dataset.k+'"]'))})}
  function narrow(){el.classList.toggle('narrow',el.clientWidth<520)}
  function wire(){badges();narrow();window.addEventListener('resize',narrow);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);fit();
    inner.addEventListener('click',function(e){var g=e.target.closest('.cm-lbl');if(!g||moved)return;show(g)});
    inner.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('cm-lbl')){e.preventDefault();show(e.target)}});
  }
  function show(g){var o=el.querySelector('.cm-lbl.on');if(o)o.classList.remove('on');g.classList.add('on');el.querySelectorAll('.cm-key li').forEach(function(li){li.classList.toggle('on',li.dataset.k===g.dataset.k)});
    var t=g.querySelector('title').textContent;note.innerHTML='<b>'+t+(/\.$/.test(t)?'':'.')+'</b> '+g.dataset.note.replace(/&/g,'&amp;').replace(/</g,'&lt;')}
  // pan & zoom
  var s=1,tx=0,ty=0,pts={},start=null,moved=false;
  var noPinch=document.documentElement.classList.contains('poster');
  function apply(){var w=view.clientWidth,h=view.clientHeight;tx=Math.min(0,Math.max(w-w*s,tx));ty=Math.min(0,Math.max(h-h*s,ty));
    inner.style.transform=s===1?'':'translate('+tx+'px,'+ty+'px) scale('+s+')';view.classList.toggle('zoomed',s>1)}
  function zoomAt(ns,cx,cy){ns=Math.max(1,Math.min(4,ns));tx=cx-(cx-tx)*ns/s;ty=cy-(cy-ty)*ns/s;s=ns;apply()}
  el.querySelector('.cm-bar').addEventListener('click',function(e){var b=e.target.closest('.cm-z');if(!b)return;var z=+b.dataset.z,w=view.clientWidth/2,h=view.clientHeight/2;
    if(z===0){s=1;tx=ty=0;apply()}else zoomAt(s*(z>0?1.6:1/1.6),w,h)});
  view.addEventListener('wheel',function(e){if(!e.ctrlKey)return;e.preventDefault();var r=view.getBoundingClientRect();zoomAt(s*Math.exp(-e.deltaY*0.01),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  view.addEventListener('pointerdown',function(e){pts[e.pointerId]={x:e.clientX,y:e.clientY};moved=false;
    var k=Object.keys(pts);if(k.length===2&&!noPinch){var a=pts[k[0]],b=pts[k[1]];start={d:Math.hypot(a.x-b.x,a.y-b.y),s:s}}
    else if(k.length===1)start={x:e.clientX,y:e.clientY,tx:tx,ty:ty}});
  view.addEventListener('pointermove',function(e){if(!pts[e.pointerId]||!start)return;pts[e.pointerId]={x:e.clientX,y:e.clientY};var k=Object.keys(pts),r=view.getBoundingClientRect();
    if(k.length===2&&start.d){var a=pts[k[0]],b=pts[k[1]],d=Math.hypot(a.x-b.x,a.y-b.y);moved=true;zoomAt(start.s*d/start.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top)}
    else if(k.length===1&&s>1&&start.x!=null){var dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>6)moved=true;tx=start.tx+dx;ty=start.ty+dy;apply()}});
  function up(e){delete pts[e.pointerId];var k=Object.keys(pts);start=k.length===1?{x:pts[k[0]].x,y:pts[k[0]].y,tx:tx,ty:ty}:null;setTimeout(function(){moved=false},50)}
  view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);
  window.addEventListener('resize',apply);
}
function all(){document.querySelectorAll('.cmap').forEach(init)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',all);else all();
window.RNTcmap=all;
})();
