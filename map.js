(function(){
var box=document.getElementById('leaflet');if(!box)return;
var FM='https://vancouver.ca/parks-recreation-culture/stanley-park-forest-management.aspx',WL='https://vancouver.ca/parks-recreation-culture/wildlife-.aspx',FMP='https://vancouver.ca/files/cov/Stanley-Park-Forest-Management-Plan.pdf',BL='https://vancouver.ca/files/cov/beaver-lake-walking-tour-guide.pdf',BLE='https://vancouver.ca/files/cov/Beaver-Lake-enhancement-proposal.pdf';
function src(a){return '<br><small>Source: '+a+'</small>'}
function L2(u,t){return '<a href="'+u+'" target="_blank" rel="noopener">'+t+'</a>'}
var ESSAY='<a href="#sources">history essay</a>',FUT='<a href="#sources">future essay</a>';
function load(){
 var c=document.createElement('link');c.rel='stylesheet';c.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(c);
 var s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=init;
 s.onerror=function(){box.innerHTML='<div class="ph">The map could not load. It needs an internet connection.</div>'};document.head.appendChild(s);
}
function init(){
 box.innerHTML='';
 var map=L.map(box,{scrollWheelZoom:false,dragging:false,touchZoom:false,doubleClickZoom:false,tap:false}).setView([49.27,-123.08],11);
 var act=document.createElement('button');act.type='button';act.className='activate';act.textContent='Tap to explore the map';box.appendChild(act);
 var done=document.createElement('button');done.type='button';done.className='done';done.textContent='Done';box.appendChild(done);
 function on(){box.classList.add('active');map.dragging.enable();map.touchZoom.enable();map.doubleClickZoom.enable();map.scrollWheelZoom.enable()}
 function off(){box.classList.remove('active');map.dragging.disable();map.touchZoom.disable();map.doubleClickZoom.disable();map.scrollWheelZoom.disable();map.closePopup()}
 L.DomEvent.disableClickPropagation(act);L.DomEvent.disableClickPropagation(done);
 act.addEventListener('click',on);done.addEventListener('click',off);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 function line(pts,o,html,g){return L.polyline(pts,o).bindPopup(html).addTo(g)}
 function pt(ll,col,html,g,r){return L.circleMarker(ll,{radius:r||8,color:'#fff',weight:2,fillColor:col,fillOpacity:.95}).bindPopup(html).addTo(g)}
 // 1 Unbuilt freeways
 var fw=L.layerGroup();var R={color:'#c0392b',weight:5,dashArray:'8 6'};
 line([[49.2890,-123.1230],[49.2862,-123.1110],[49.2840,-123.1045],[49.2800,-123.1040],[49.2770,-123.1000],[49.2768,-123.0870],[49.2768,-123.0770],[49.2780,-123.0450],[49.2790,-123.0250]],R,'<b>1967 waterfront freeway (approximate, unbuilt)</b><br>An elevated route along Burrard Inlet, swinging through Maple Tree Square and Chinatown at Carrall Street, then east along the Prior Street corridor toward Highway 1. The Chinatown route was dropped in 1968.'+src(ESSAY),fw);
 line([[49.2770,-123.1030],[49.2600,-123.1030],[49.2450,-123.1030]],R,'<b>Columbia/Quebec corridors (approximate, unbuilt)</b><br>The 1967 study proposed more routes running south.'+src(ESSAY),fw);
 line([[49.2900,-123.1250],[49.2985,-123.1180],[49.3060,-123.1150],[49.3150,-123.1100]],R,'<b>Third crossing of Burrard Inlet (approximate, unbuilt)</b><br>By 1969 the favoured design was a tunnel reached by a causeway near Brockton Point. It was dead by the end of 1972.'+src(ESSAY),fw);
 line([[49.2800,-123.1100],[49.2780,-123.1000]],{color:'#555',weight:7},'<b>Georgia &amp; Dunsmuir viaducts (built)</b><br>Opened in 1971 and 1972, they are the only part of the freeway system ever built. Council voted to remove them in 2015, but as of October 2026 they still stand and the removal timeline "is still uncertain."'+src(ESSAY),fw);
 // 2 Neighbourhoods
 var nb=L.layerGroup();
 pt([49.2797,-123.1003],'#8e44ad','<b>Chinatown</b><br>The 1967 freeway would have cut through the heart of Chinatown at Carrall Street. Public hearings forced by merchants, architects and residents led to the route being dropped in 1968. Chinatown survived.'+src(ESSAY),nb,10);
 pt([49.2775,-123.0890],'#8e44ad','<b>Strathcona</b><br>The city\'s oldest residential neighbourhood, targeted for "urban renewal." SPOTA was founded in 1968 at 658 Keefer Street, and the neighbourhood was rehabilitated instead of cleared (Vincent Massey Award, 1975).'+src(ESSAY),nb,10);
 pt([49.2766,-123.0980],'#8e44ad','<b>Hogan\'s Alley (approx.)</b><br>Park Lane and the blocks around it were the heart of Vancouver\'s Black community. The western half was levelled from 1967 for the viaduct project. The City has an MOU with the Hogan\'s Alley Society for the 898 Main Street block.'+src(ESSAY),nb,10);
 // 3 SkyTrain
 var st=L.layerGroup();
 var WF=[49.2856,-123.1115];
 line([WF,[49.2793,-123.1095],[49.2732,-123.1004],[49.2626,-123.0690],[49.2384,-123.0318],[49.2258,-123.0039],[49.2123,-122.9592],[49.2015,-122.9127],[49.2044,-122.8742],[49.1897,-122.8479],[49.1828,-122.8448]],{color:'#1f5fbf',weight:5},'<b>Expo Line (existing)</b><br>Waterfront to Surrey. It opened in December 1985.'+src(FUT),st);
 line([[49.2658,-123.0790],[49.2626,-123.0690],[49.2589,-123.0453],[49.2665,-123.0016],[49.2485,-122.8970],[49.2611,-122.8899],[49.2779,-122.8455],[49.2856,-122.7913]],{color:'#e8a900',weight:5},'<b>Millennium Line (existing)</b><br>Serves Burnaby and the Tri-Cities as far as Lafarge Lake–Douglas.'+src(FUT),st);
 line([[49.2638,-123.1530],[49.2630,-123.1150],[49.2630,-123.1000],[49.2658,-123.0790]],{color:'#e8a900',weight:5,dashArray:'4 6'},'<b>Broadway Subway (under construction)</b><br>5.7 km from VCC–Clark to Arbutus with six underground stations. It is scheduled to open in fall 2027.'+src(FUT),st);
 line([[49.2638,-123.1530],[49.2650,-123.2000],[49.2660,-123.2470]],{color:'#e8a900',weight:3,dashArray:'2 8'},'<b>UBC extension (proposed)</b><br>About 7 km, still in planning, with no full construction funding.'+src(FUT),st);
 line([WF,[49.2825,-123.1185],[49.2630,-123.1150],[49.2330,-123.1166],[49.2097,-123.1170],[49.1953,-123.1261],[49.1680,-123.1364]],{color:'#0f9aa6',weight:5},'<b>Canada Line (existing)</b><br>Downtown to Richmond and YVR.'+src(FUT),st);
 line([[49.1953,-123.1261],[49.1941,-123.1780]],{color:'#0f9aa6',weight:5},'<b>Canada Line, YVR branch (existing)</b>'+src(FUT),st);
 line([[49.1828,-122.8448],[49.1700,-122.8000],[49.1530,-122.7750],[49.1300,-122.7100],[49.1040,-122.6600]],{color:'#1f5fbf',weight:5,dashArray:'10 8'},'<b>Surrey–Langley (Dave Barrett Extension), under construction</b><br>16 km and eight stations along Fraser Highway. Opening is expected in late 2029.'+src(FUT),st);
 line([WF,[49.2980,-123.0960],[49.3100,-123.0830]],{color:'#2e8b57',weight:4},'<b>SeaBus (existing)</b><br>It has crossed Burrard Inlet since 1977. The Burrard Chinook (2021) is Canada\'s first fully hybrid-electric SeaBus.'+src(FUT),st);
 // 4 Speculative
 var sp=L.layerGroup();var T={color:'#8a4b2a',weight:4,dashArray:'2 7'};
 var tn='<span style="color:#a3511c;font-weight:700">SPECULATIVE.</span> Nobody has proposed this. ';
 line([[49.2346,-123.1550],[49.2335,-123.1166],[49.2300,-123.0600],[49.2258,-123.0039]],T,'<b>Tunnel spine (speculative)</b><br>'+tn+'Small-bore tunnels for robotaxis and autonomous shuttles, running point to point beneath busy arterials.'+src(FUT),sp);
 line([[49.1680,-123.1364],[49.1300,-123.1000],[49.0890,-123.0850]],T,'<b>Tunnel spine to Ladner (speculative)</b><br>'+tn+'Delta soils are a major constraint: a high water table and sands that can liquefy in an earthquake.'+src(FUT),sp);
 line([[49.2015,-122.9127],[49.1500,-122.8500],[49.1200,-122.8460]],T,'<b>Tunnel spine to Newton (speculative)</b><br>'+tn+src(FUT),sp);
 [[49.2346,-123.1550,'Kerrisdale'],[49.0890,-123.0850,'Ladner'],[49.1200,-122.8460,'Newton']].forEach(function(p){L.marker([p[0],p[1]],{icon:L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#8a4b2a;border:2px solid #fff"></div>'})}).bindPopup('<b>Tunnel portal, '+p[2]+' (speculative)</b><br>'+tn+'Vehicles would surface close to where people want to go.'+src(FUT)).addTo(sp)});
 var F={color:'#2e8b57',weight:3,dashArray:'10 7'};
 line([[49.3757,-123.2731],[49.3300,-123.2300],[49.3050,-123.1500],[49.2900,-123.1200],WF],F,'<b>Electric ferry: Horseshoe Bay–downtown (speculative)</b><br>'+tn+'Part of an imagined ring of electric passenger ferries.'+src(FUT),sp);
 line([[49.2900,-123.0800],[49.2950,-122.9900],[49.3290,-122.9480],[49.3000,-122.8900],[49.2930,-122.8600]],F,'<b>Electric ferry: up Burrard Inlet to Deep Cove &amp; Port Moody (speculative)</b><br>'+tn+src(FUT),sp);
 line([[49.1240,-123.1840],[49.1050,-123.1000],[49.0890,-123.0850]],F,'<b>Electric ferry: Steveston–Ladner (speculative)</b><br>'+tn+src(FUT),sp);
 line([[49.0890,-123.0850],[49.1300,-123.0000],[49.1700,-122.9500],[49.2015,-122.9127]],F,'<b>Electric ferry: Ladner–New Westminster on the Fraser (speculative)</b><br>'+tn+src(FUT),sp);
 // 5 Stanley Park
 var pk=L.layerGroup();
 pt([49.2905,-123.1385],'#2b6e5a','<b>Great blue heron colony (approx.)</b><br>At 2099 Beach Ave, near the Park Board office, since 2001. Herons have nested in the park since at least 1921. It is one of the largest urban colonies in North America.'+src(L2(WL,'City wildlife page')),pk);
 pt([49.3043,-123.1389],'#2b6e5a','<b>Beaver Lake (approx.)</b><br>Infilling rapidly. Beavers returned in 2008. The final stage of hazard-tree work around it started Oct 13, 2026 and runs to spring 2027.'+src(L2(BLE,'Beaver Lake enhancement')+', '+L2(WL,'wildlife')+', '+L2(FM,'forest management')),pk);
 pt([49.3135,-123.1512],'#2b6e5a','<b>Siwash Rock (approx.)</b><br>The rocky cliffs near the shore support nesting pelagic cormorants, eagles and raptors. That the cormorants nest specifically at Siwash Rock is commonly reported but not verified in our sources.'+src(L2(FMP,'Forest Management Plan')),pk);
 pt([49.3005,-123.1440],'#2b6e5a','<b>Remnant old-growth stand (approx.)</b><br>A small stand next to Tunnel Trail and Pipeline Road. The exact location is approximate.'+src(L2(FMP,'Forest Management Plan')),pk);
 [fw,nb,st,sp,pk].forEach(function(g){g.addTo(map)});
 L.control.layers(null,{'Unbuilt freeways (approx.)':fw,'Chinatown / Strathcona / Hogan\'s Alley':nb,'SkyTrain & SeaBus':st,'Tunnels & ferries (speculative)':sp,'Stanley Park':pk},{collapsed:window.innerWidth<700}).addTo(map);
}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();load()}},{rootMargin:'400px'});io.observe(box)}else load();
})();
