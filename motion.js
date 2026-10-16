/* Light motion layer. Content is fully visible without JS; classes are added only when motion is allowed. */
(function(){
var root=document.documentElement,reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var poster=root.classList.contains('poster');
if(reduce||!('IntersectionObserver' in window))return;
root.classList.add('motion');
var pending=[];
function io(els,cb,opts){var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){o.unobserve(e.target);cb(e.target)}})},opts||{threshold:.25});
 [].forEach.call(els,function(el){o.observe(el);pending.push(el)});return o}
function reveal(el){el.classList.add('in')}
// timeline items rise in, staggered
function prepTimeline(){var items=document.querySelectorAll('#tl li');[].forEach.call(items,function(li,i){li.classList.add('pre-rise');li.style.transitionDelay=Math.min(i,12)*45+'ms'});
 io([document.getElementById('tl')].filter(Boolean),function(){[].forEach.call(items,reveal)},{threshold:.1})}
setTimeout(prepTimeline,0); // after app.js has built the list
// freeway route draws in, then gets stamped when the opposition section arrives
var rf=document.getElementById('route-fig');
if(rf){io([rf],function(){reveal(rf);if(poster)setTimeout(function(){rf.classList.add('crossed')},2600)},{threshold:.3});
 if(!poster){var kept=document.getElementById('kept');var o2=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&rf.classList.contains('in')&&e.boundingClientRect.top<window.innerHeight*.95)rf.classList.add('crossed')})},{rootMargin:'0px 0px -12% 0px'});if(kept)o2.observe(kept);
  var drawnAt=0;new MutationObserver(function(){if(rf.classList.contains('in')&&!drawnAt)drawnAt=performance.now()}).observe(rf,{attributes:true});
  function chk(){if(drawnAt&&performance.now()-drawnAt>2000&&(rf.getBoundingClientRect().bottom<window.innerHeight*.8||(kept&&kept.getBoundingClientRect().top<window.innerHeight*.95)))rf.classList.add('crossed')}
  window.addEventListener('scroll',chk,{passive:true});setInterval(function(){if(!rf.classList.contains('crossed'))chk()},700)}}
// transit schematic draws in
var map=document.getElementById('map');
if(map){[].forEach.call(map.querySelectorAll('svg polyline'),function(p,i){if(p.getAttribute('stroke-dasharray')){p.classList.add('fadein');p.style.transitionDelay=(0.6+i*0.04)+'s'}else{p.setAttribute('pathLength','1');p.classList.add('draw');p.style.transitionDelay=(i%8)*0.12+'s'}});
 io([map],reveal,{threshold:.2})}
// count-up numbers
function parse(t){var m=t.match(/^([^\d]*)(\d[\d,]*)(.*)$/);if(!m)return null;var n=parseInt(m[2].replace(/,/g,''),10);if(isNaN(n))return null;return{pre:m[1],n:n,post:m[3],comma:m[2].indexOf(',')>=0}}
function fmt(v,c){return c?v.toLocaleString('en-US'):String(v)}
function count(el){if(el.dataset.counted)return;el.dataset.counted=1;var p=parse(el.textContent.trim());if(!p)return;
 var final=el.textContent,isYear=!p.comma&&p.n>=1800&&p.n<=2100,from=isYear?p.n-60:0,t0=performance.now(),d=1100;
 (function step(t){var k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);el.textContent=p.pre+fmt(Math.round(from+(p.n-from)*e),p.comma)+p.post;if(k<1)requestAnimationFrame(step);else el.textContent=final})(t0)}
var nums=document.querySelectorAll('.stats b');
if(!poster)io(nums,count,{threshold:.6});
// mobile canvas: count when a number is on screen and big enough to read
window.RNTmotionCheck=function(){var vh=window.innerHeight,vw=window.innerWidth;
 [].forEach.call(document.querySelectorAll('.stats b,.plabel em'),function(el){if(el.dataset.counted)return;var r=el.getBoundingClientRect();
  if(r.height>14&&r.bottom>0&&r.top<vh&&r.right>0&&r.left<vw&&getComputedStyle(el).opacity!=='0'&&(el.closest('.plabel')?getComputedStyle(el.closest('.plabel')).opacity>.5:true))count(el)})};
// ridge hero parallax (desktop only; transform-only, rAF-throttled)
var hero=document.querySelector('header.hero'),img=hero&&hero.querySelector('img.ridges');
if(img&&!poster){fetch(img.getAttribute('src')).then(function(r){return r.text()}).then(function(txt){
 var d=document.createElement('div');d.className='ridges-inline';d.setAttribute('role','img');d.setAttribute('aria-label',img.alt);d.innerHTML=txt;
 var svg=d.querySelector('svg');if(!svg)return;svg.removeAttribute('role');svg.setAttribute('aria-hidden','true');img.replaceWith(d);
 var layers=[].slice.call(svg.querySelectorAll('polygon')).concat([].slice.call(svg.querySelectorAll('path,circle')));
 var n=layers.length,tick=false;
 function upd(){tick=false;var y=Math.min(window.scrollY,hero.offsetHeight);layers.forEach(function(l,i){var k=l.tagName==='circle'?0.5:(l.tagName==='path'?0:0.42*(1-i/(n-1)));l.style.transform='translateY('+(y*k).toFixed(1)+'px)'})}
 window.addEventListener('scroll',function(){if(!tick&&window.scrollY<hero.offsetHeight+50){tick=true;requestAnimationFrame(upd)}},{passive:true});upd()}).catch(function(){})}
// safety net: reveal everything after 3s even if an observer never fired
setTimeout(function(){pending.forEach(function(el){el.classList.add('in')});[].forEach.call(document.querySelectorAll('.pre-rise'),reveal)},3000);
})();
