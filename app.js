(function(){
var m=document.getElementById('menu'),nl=document.getElementById('navlist');
m.onclick=function(){var o=nl.classList.toggle('open');m.setAttribute('aria-expanded',o);m.setAttribute('aria-label',o?'Close menu':'Open menu')};
nl.onclick=function(e){if(e.target.tagName==='A'){nl.classList.remove('open');m.setAttribute('aria-expanded',false)}};
document.addEventListener('keydown',function(e){if(e.key==='Escape'){nl.classList.remove('open');m.setAttribute('aria-expanded',false)}});
var MAP={timeline:'timeline',kept:'kept',gained:'kept',lesson:'kept','explore-map':'explore-map',terrain:'explore-map',future:'future',models:'models',park:'park',bio:'park',act:'act',articles:'sources',sources:'sources'};
var links={};[].forEach.call(nl.querySelectorAll('a'),function(a){links[a.dataset.nav]=a});
var secs=[].slice.call(document.querySelectorAll('main > section[id]'));
var tt=document.getElementById('totop');
function spy(){var y=window.scrollY+90,cur=null;secs.forEach(function(s){if(s.getBoundingClientRect().top+window.scrollY<=y)cur=s.id});
 if(window.innerHeight+window.scrollY>=document.body.scrollHeight-4)cur='sources';
 var ov=document.getElementById('overview'),zo=document.getElementById('zoomout');if(ov&&zo)zo.classList.toggle('show',ov.offsetParent!==null&&window.scrollY>ov.getBoundingClientRect().top+window.scrollY+ov.offsetHeight-60);
 var k=MAP[cur];for(var n in links){links[n].classList.toggle('active',n===k);if(n===k)links[n].setAttribute('aria-current','true');else links[n].removeAttribute('aria-current')}
 tt.classList.toggle('show',window.scrollY>700)}
var tk=false;window.addEventListener('scroll',function(){if(!tk){tk=true;setTimeout(function(){spy();tk=false},60)}},{passive:true});window.addEventListener('resize',spy);window.addEventListener('load',spy);spy();

var T=[
['1928–29','plan','First comprehensive plan','The St. Louis firm Harland Bartholomew and Associates prepared Vancouver\'s first comprehensive plan. It was revised after Point Grey and South Vancouver amalgamated with the city. It proposed wider arterials and "pleasure drives", not high-speed parkways. Follow-up reports came in 1944–48.'],
['1931','renewal','East End zoned industrial','A bylaw zoned much of the East End industrial. This laid groundwork for later "urban renewal".'],
['1950','renewal','Slum-clearance study','A study led by Leonard Marsh called for slum clearance.'],
['1957','renewal','Strathcona targeted','The City\'s redevelopment study listed Strathcona among the areas most in need of redevelopment. Through the 1950s and 1960s the City stopped granting building permits there and let infrastructure decline.'],
['1959','plan','A master freeway plan','A technical committee chaired by Gerald Sutton-Brown, the city\'s first director of planning, issued a report that became, in effect, a master freeway plan.'],
['c.1960','renewal','Clearance begins','Clearance began with funding shared by all three levels of government, over the protests of Chinese property owners. Whole blocks came down for the MacLean Park towers and the Raymur project, now Stamps Place. Thousands of people were moved across the phases.'],
['1964','plan','Plan updated; critics speak up','The Stanford Research Institute and Wilbur Smith and Associates updated the plan. UBC geographer Walter Hardwick began challenging the freeway studies in the press.'],
['1965','plan','Viaduct money approved','Voters approved money to replace the 1915 Georgia Viaduct, with little public discussion of what it might connect to.'],
['1967','plan','Freeway through Chinatown','The Vancouver Transportation Study proposed an elevated waterfront freeway through Maple Tree Square and Chinatown at Carrall Street, then east along Prior Street. It was tied to Project 200 and a third Burrard Inlet crossing. From 1967 the City began levelling the western half of Hogan\'s Alley.'],
['Jun 1, 1967','revolt','Council moves ahead','Council moved to accept a first freeway segment through Chinatown. Chinese merchants, architects and Alderman Harry Rankin forced public hearings, which revealed that the consultants were never asked to consider alternatives.'],
['Nov 23, 1967','revolt','The Great Freeway Debate','More than 500 people crowded into city hall for the "wildest, most stormy meeting ever seen at city hall" (The Province). Peter Oberlander resigned as chair of the Town Planning Commission: "Planning is too serious a matter to leave solely to professional civic officials."'],
['1968','revolt','Chinatown route dropped; SPOTA forms','The Chinatown route was dropped. Residents formed the Strathcona Property Owners and Tenants Association (SPOTA) at the Chans\' kitchen table, 658 Keefer St. After Mary Chan met federal minister Paul Hellyer, federal urban-renewal funding was frozen. TEAM was founded in March out of the 1967 hearings.'],
['1969','plan','Tunnel near Stanley Park','The favoured third-crossing design was a tunnel reached by a causeway near Brockton Point, at the edge of Stanley Park.'],
['Jun 28, 1971','later','Georgia Viaduct opens','The new Georgia Viaduct opened. It is part of the only piece of the freeway system ever built.'],
['1971','revolt','Militant Mothers of Raymur','Mothers blockaded the rail line their children crossed to school and won a Keefer Street overpass. In December, council voted 6–5 to fund the crossing\'s approach routes.'],
['Jan 9, 1972','later','Dunsmuir Viaduct opens','The Dunsmuir side opened, with protesters trying to block the mayor\'s car.'],
['1972','revolt','The crossing dies','By February a Citizens\' Committee for Public Transit had more than 21,000 petition signatures. By year\'s end the crossing and its feeder freeways were dead. In the December 13 election the civic majority changed hands for the first time in decades.'],
['1974–75','later','False Creek South','The City planned False Creek South in 1974 and built it from 1975 with co-ops and mixed-income housing. The Strathcona rehabilitation won the Vincent Massey Award (1975).'],
['1985–86','later','SkyTrain','The Expo Line opened in December 1985, with regular service from January 1986.'],
['1997','later','Transportation Plan','Priorities were set as walking, cycling, transit, goods movement, then private cars.'],
['Oct 27, 2015','later','Vote to remove viaducts','Council voted to remove the viaducts. The 2018 Northeast False Creek Plan would replace them with streets, parks and housing.'],
['2026','later','Still standing','The viaducts remain. Demolition was first targeted for 2019 and has slipped since. Repairs to Georgia Viaduct expansion joints began in October and are expected to run into spring 2027. The City says the removal timeline "is still uncertain."']];
window.RNT_T=T;var tl=document.getElementById('tl'),det=document.getElementById('tl-detail'),cat={plan:'Plans',renewal:'Urban renewal',revolt:'Resistance',later:'Viaducts & later'};
function show(i,b){[].forEach.call(tl.querySelectorAll('button'),function(x){x.classList.remove('sel')});b.classList.add('sel');var t=T[i];det.innerHTML='<p class="tag">'+cat[t[1]]+'</p><h3>'+t[0]+': '+t[2]+'</h3><p>'+t[3]+'</p>'}
T.forEach(function(t,i){var li=document.createElement('li');li.dataset.c=t[1];var b=document.createElement('button');b.innerHTML='<b>'+t[0]+'</b><small>'+t[2]+'</small>';b.onclick=function(){show(i,b)};li.appendChild(b);tl.appendChild(li);if(i===0)show(0,b)});
document.querySelector('.tl-filter').onclick=function(e){var f=e.target.dataset.f;if(!f)return;[].forEach.call(this.children,function(x){x.classList.toggle('on',x===e.target)});[].forEach.call(tl.children,function(li){li.style.display=(f==='all'||li.dataset.c===f)?'':'none'})};

var H=[
[30,28.6,'real','Waterfront','Downtown hub. The Expo Line starts here. The SeaBus has crossed Burrard Inlet since 1977. Its newest vessel, the Burrard Chinook (2021), is Canada\'s first fully hybrid-electric SeaBus, and TransLink is designing a battery-electric next-generation vessel.'],
[24.4,33.3,'real','Broadway Subway to Arbutus','A 5.7 km Millennium Line extension from VCC–Clark with six underground stations. Trackwork was finished in September 2026, and it is scheduled to open in fall 2027. It will have three times the capacity of the 99 B-Line.'],
[11.2,33.1,'real','UBC extension (proposed)','About 7 km from Arbutus to UBC, including a planned Jericho Lands station. It is in planning and design, and there is no full construction funding commitment as of autumn 2026.'],
[45.2,41.1,'real','Expo Line','Runs from Waterfront through Burnaby and New Westminster to Surrey. It opened in December 1985.'],
[20.7,47.8,'real','Canada Line','Connects downtown to Richmond and YVR.'],
[72.4,28.4,'real','Millennium Line','Serves Burnaby and the Tri-Cities as far as Lafarge Lake–Douglas in Coquitlam.'],
[91.4,66.7,'real','Surrey–Langley (Dave Barrett Extension)','16 km and eight stations along Fraser Highway. It is under construction, with opening expected in late 2029. The map labels it "planned".'],
[34.4,21.9,'spec','North Shore rapid transit','TransLink is studying rapid transit to the North Shore through its Burrard Inlet Rapid Transit program, which could include a dedicated transit crossing. A completed downtown grid by mid-century is speculation.'],
[8.5,10.5,'spec','Electric ferries (speculative)','An imagined ring of electric passenger ferries linking Horseshoe Bay, the North Shore, Port Moody and Deep Cove up the inlet, and New Westminster, Ladner and Steveston on the Fraser.'],
[65.6,61.3,'spec','Tunnel mesh (speculative)','Nobody has proposed this. It imagines many small-bore tunnels for robotaxis and autonomous shuttles, surfacing point to point near destinations such as a school in Newton. SkyTrain would stay the backbone.'],
[34.3,69.7,'spec','Engineering reality check','Delta soils have a water table "close to grade" and about 30 m of sand that can liquefy in an earthquake. Water crossings are the hardest kind of tunnelling. The Vegas Loop, the only comparable system, runs about 3.5 miles of tunnels in dry ground. Treat the mesh as something to study, not something to count on.']];
var map=document.getElementById('map'),info=document.getElementById('map-info');
H.forEach(function(h){var b=document.createElement('button');b.className='hot '+h[2];b.style.left=h[0]+'%';b.style.top=h[1]+'%';b.setAttribute('aria-label',h[3]);b.title=h[3];
var f=function(){[].forEach.call(map.querySelectorAll('.hot'),function(x){x.classList.remove('sel')});b.classList.add('sel');info.innerHTML='<strong>'+h[3]+'</strong> '+(h[2]==='spec'?'<span class="tag spec">Speculative</span>':'<span class="tag">On the record</span>')+'<p>'+h[4]+'</p>'};
b.onclick=f;b.onmouseenter=f;b.onfocus=f;map.appendChild(b)});
document.querySelector('.map-legend').onclick=function(e){var k=e.target.dataset.k;if(!k)return;[].forEach.call(this.children,function(x){x.classList.toggle('on',x===e.target)});[].forEach.call(map.querySelectorAll('.hot'),function(x){x.classList.toggle('hide',k!=='all'&&!x.classList.contains(k))});map.classList.toggle('dim-spec',k==='real');map.classList.toggle('dim-real',k==='spec')};


var ts=document.getElementById('terrain-slot');
function loadTerrain(){ts.innerHTML='<iframe src="'+ts.dataset.src+'" title="3D terrain model, North Shore to False Creek"></iframe>'}
ts.innerHTML='<button class="btn load3d" type="button">Load the 3D terrain model</button>';ts.querySelector('button').onclick=loadTerrain;
[].forEach.call(document.querySelectorAll('[data-placeholder]'),function(a){a.onclick=function(e){if(a.getAttribute('href')==='#'){e.preventDefault();alert('Article link coming soon.')}}});

/* ---- Mobile overview: zoom into a section, zoom back out ---- */
var ov=document.getElementById('overview'),zo=document.getElementById('zoomout');
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
var lastTile=null;
function jump(el){document.documentElement.style.scrollBehavior='auto';el.scrollIntoView({block:'start'});document.documentElement.style.scrollBehavior='';}
function focusIn(el){var h=el.querySelector('h2');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
function zoomTo(tile,target){
 lastTile=tile;var r=tile.getBoundingClientRect();
 var ox=(r.left+r.width/2)/window.innerWidth*100,oy=(r.top+r.height/2)/window.innerHeight*100;
 document.documentElement.style.setProperty('--zx',ox+'%');document.documentElement.style.setProperty('--zy',oy+'%');
 if(reduce.matches){jump(target);focusIn(target);return}
 if(document.startViewTransition){document.documentElement.classList.add('vt-in');
  var t=document.startViewTransition(function(){jump(target)});
  t.finished.finally(function(){document.documentElement.classList.remove('vt-in');focusIn(target)});return}
 // fallback: scale the overview up around the tile, then jump
 ov.style.transformOrigin=ox+'% '+(r.top+r.height/2-ov.getBoundingClientRect().top)+'px';
 ov.classList.add('zooming');
 setTimeout(function(){jump(target);ov.classList.remove('zooming');target.classList.add('arrive');focusIn(target);setTimeout(function(){target.classList.remove('arrive')},400)},280);
}
function zoomOut(){
 if(!ov||ov.offsetParent===null)return;
 var back=function(){jump(ov);if(lastTile)lastTile.focus({preventScroll:true})};
 if(reduce.matches){back();return}
 if(document.startViewTransition){document.documentElement.classList.add('vt-out');
  document.startViewTransition(back).finished.finally(function(){document.documentElement.classList.remove('vt-out')});return}
 back();ov.classList.add('arrive-out');setTimeout(function(){ov.classList.remove('arrive-out')},400);
}
if(ov){[].forEach.call(ov.querySelectorAll('.tile'),function(t){t.addEventListener('click',function(){var el=document.getElementById(t.dataset.target);if(el)zoomTo(t,el)})})}
if(zo)zo.addEventListener('click',zoomOut);
// pinch-out (two fingers moving together) while not natively zoomed in => back to overview.
// Listeners are passive and never preventDefault, so native pinch-zoom keeps working.
function natScale(){return window.visualViewport?window.visualViewport.scale:1}
var g0=null;
window.addEventListener('gesturestart',function(e){g0=natScale()},{passive:true}); // iOS Safari
window.addEventListener('gestureend',function(e){if(g0!==null&&g0<=1.01&&e.scale<0.8&&window.scrollY>(ov?ov.offsetHeight:0))zoomOut();g0=null},{passive:true});
var d0=0,s0=1;function dist(t){var a=t[0],b=t[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}
window.addEventListener('touchstart',function(e){if(e.touches.length===2&&!('ongesturestart' in window)){d0=dist(e.touches);s0=natScale()}},{passive:true});
window.addEventListener('touchmove',function(e){if(d0&&e.touches.length===2&&s0<=1.01&&dist(e.touches)/d0<0.7&&!e.target.closest('.leaflet-box.active,.m3d.active')){d0=0;zoomOut()}},{passive:true});
window.addEventListener('touchend',function(){d0=0},{passive:true});
})();
