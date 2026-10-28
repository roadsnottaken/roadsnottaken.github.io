'use strict';
/* Looper: multitrack loop / demo recorder. Web Audio + AudioWorklet. */
const NT = 4, XF = 256, VER = 1;
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dbToGain = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
const volGain = (v) => v * v * 1.5625; // 0.8 on the fader = unity

// ---------- persisted state ----------
const S = { bpm: 80, bars: 4, countIn: true, click: true, swing: 56, humanize: 8, latencyMs: null, master: 0.9,
  lofi: true, reverb: 0.15, crackle: -32, hiss: -32, eq: [0, 0, 0], loops: 2, masterDrive: 0.25 };
const newTrack = (i) => ({ name: 'Track ' + (i + 1), layers: [], vol: 0.8, pan: 0, mute: false, solo: false, lowcut: 20, highcut: 20000, drive: 0.25, stopped: false });
let tracks = [...Array(NT)].map((_, i) => newTrack(i));
let sess = { sr: 0, L: 0 }; // L = loop length in frames at sess.sr

// ---------- runtime ----------
let ctx = null, master = null, recNode = null, micStream = null, micSrc = null, clickBus = null;
let playing = false, loopStart = 0, nextBeat = 0, schedTimer = null, jobSeq = 1;
const rt = [...Array(NT)].map(() => ({ chain: null, buf: null, src: null, job: null, capT: 0, capLen: 0, free: false, first: false }));
const jobs = new Map();
let micPeak = 0;

// ---------- IndexedDB ----------
const idb = { db: null,
  open() { return new Promise((res, rej) => { const r = indexedDB.open('looper', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { this.db = r.result; res(); }; r.onerror = () => rej(r.error); }); },
  get(k) { return new Promise((res) => { const t = this.db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); },
  set(k, v) { return new Promise((res, rej) => { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } };
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 500); }
async function doSave() {
  if (!idb.db) return;
  try { await idb.set('session', { v: VER, S, sess, tracks }); }
  catch (e) { toast('Could not save session: ' + e.message); }
}
async function load() {
  try {
    await idb.open();
    const d = await idb.get('session');
    if (d && d.v === VER) {
      Object.assign(S, d.S); sess = d.sess || sess;
      d.tracks.forEach((t, i) => { if (i < NT) tracks[i] = Object.assign(newTrack(i), t); });
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) { console.warn('IndexedDB unavailable', e); }
}

// ---------- DSP building blocks (shared by live + offline export) ----------
function satCurve(k) {
  const n = 2048, c = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
  return c;
}
function makeSat(ac, amount) { // parallel tanh saturation, small-signal unity
  const inp = ac.createGain(), out = ac.createGain(), dry = ac.createGain(), wet = ac.createGain(), sh = ac.createWaveShaper(), comp = ac.createGain();
  sh.oversample = '4x';
  inp.connect(dry).connect(out); inp.connect(sh).connect(comp).connect(wet).connect(out);
  let lastK = 0;
  const set = (a, kk) => { const k = kk || 1 + 3 * a; if (k !== lastK) { sh.curve = satCurve(k); lastK = k; } comp.gain.value = Math.tanh(k) / k; wet.gain.value = a; dry.gain.value = 1 - a; };
  set(amount);
  return { inp, out, set };
}
function biq(ac, type, f, q = 0.707, g = 0) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g; return b; }
function reverbIR(ac) {
  const sr = ac.sampleRate, len = Math.floor(sr * 1.6), b = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * Math.exp(-6.9 * t / 1.2) * (t < 0.004 ? t / 0.004 : 1); } }
  return b;
}
function noiseBufs(ac) {
  const sr = ac.sampleRate, len = Math.floor(sr * 6);
  const hiss = ac.createBuffer(2, len, sr), crackle = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const h = hiss.getChannelData(c), k = crackle.getChannelData(c);
    for (let i = 0; i < len; i++) h[i] = Math.random() * 2 - 1;
    const pops = 90 + Math.floor(Math.random() * 40);
    for (let p = 0; p < pops; p++) {
      const at = Math.floor(Math.random() * (len - 400)), amp = (Math.random() < 0.1 ? 1 : 0.35) * (Math.random() * 0.8 + 0.2), dec = 20 + Math.random() * 120, sgn = Math.random() < 0.5 ? -1 : 1;
      for (let j = 0; j < 300; j++) k[at + j] += sgn * amp * Math.exp(-j / dec) * (Math.random() * 0.6 + 0.4);
    }
  }
  return { hiss, crackle };
}
function buildMaster(ac, hasCrush) {
  const m = {};
  m.input = ac.createGain();
  const hpf = biq(ac, 'highpass', 30);
  m.sat = makeSat(ac, 0.25); m.sat.set(0.25, 2); // spec: tanh k=2, 25% mix
  m.wow = ac.createDelay(0.05); m.wow.delayTime.value = 0.006;
  const wowL = ac.createOscillator(), fl = ac.createOscillator(); wowL.frequency.value = 0.5; fl.frequency.value = 6;
  m.wowG = ac.createGain(); m.flG = ac.createGain();
  wowL.connect(m.wowG).connect(m.wow.delayTime); fl.connect(m.flG).connect(m.wow.delayTime); wowL.start(0); fl.start(0);
  m.lpf = biq(ac, 'lowpass', 9000, 0.7);
  if (hasCrush) { m.crush = new AudioWorkletNode(ac, 'looper-crush', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] }); }
  else m.crush = ac.createGain();
  m.eq = [biq(ac, 'lowshelf', 200), biq(ac, 'peaking', 1000, 0.8), biq(ac, 'highshelf', 4000)];
  m.comp = ac.createDynamicsCompressor(); m.comp.threshold.value = -18; m.comp.ratio.value = 3; m.comp.attack.value = 0.01; m.comp.release.value = 0.2; m.comp.knee.value = 10;
  const sum = ac.createGain();
  m.lim = ac.createDynamicsCompressor(); m.lim.threshold.value = -1; m.lim.ratio.value = 20; m.lim.attack.value = 0.001; m.lim.release.value = 0.1; m.lim.knee.value = 0;
  m.out = ac.createGain();
  m.input.connect(hpf); hpf.connect(m.sat.inp); m.sat.out.connect(m.wow); m.wow.connect(m.lpf); m.lpf.connect(m.crush);
  m.crush.connect(m.eq[0]).connect(m.eq[1]).connect(m.eq[2]).connect(m.comp).connect(sum);
  // reverb: send from master bus, plate-ish 1.2 s, 20 ms predelay, HPF 300 / LPF 6k on return
  const pre = ac.createDelay(0.1); pre.delayTime.value = 0.02; const conv = ac.createConvolver(); conv.buffer = reverbIR(ac);
  m.revRet = ac.createGain();
  m.input.connect(pre).connect(conv).connect(biq(ac, 'highpass', 300)).connect(biq(ac, 'lowpass', 6000)).connect(m.revRet).connect(sum);
  // noise bed after comp
  const nb = noiseBufs(ac); m.nb = nb; m.hissG = ac.createGain(); m.crackG = ac.createGain();
  m.hissF = biq(ac, 'bandpass', 1500, 0.5); m.crackF = biq(ac, 'highpass', 900);
  m.hissF.connect(m.hissG).connect(sum); m.crackF.connect(m.crackG).connect(sum);
  m.noiseSrcs = [];
  m.startNoise = (t) => { m.stopNoise(t); for (const [b, f] of [[nb.hiss, m.hissF], [nb.crackle, m.crackF]]) { const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.connect(f); s.start(t, Math.random() * 5); m.noiseSrcs.push(s); } };
  m.stopNoise = (t) => { for (const s of m.noiseSrcs) { try { s.stop(t); } catch (e) {} } m.noiseSrcs = []; };
  sum.connect(m.lim).connect(m.out);
  m.apply = (S, t = 0) => {
    const on = S.lofi;
    m.sat.set(on ? 0.25 : 0, 2);
    m.wowG.gain.value = on ? 0.00075 : 0; m.flG.gain.value = on ? 0.000075 : 0; m.wow.delayTime.value = on ? 0.006 : 0;
    m.lpf.frequency.value = on ? 9000 : 20000;
    if (hasCrush) { m.crush.parameters.get('mix').value = on ? 0.35 : 0; m.crush.parameters.get('bits').value = 12; m.crush.parameters.get('rate').value = 22050; }
    m.eq.forEach((b, i) => (b.gain.value = S.eq[i]));
    m.revRet.gain.value = S.reverb;
    m.hissG.gain.value = on ? dbToGain(S.hiss) : 0; m.crackG.gain.value = on ? dbToGain(S.crackle) * 2 : 0;
    m.out.gain.value = S.master;
  };
  return m;
}
function buildTrack(ac, dest) {
  const c = {};
  c.input = ac.createGain();
  c.hp = biq(ac, 'highpass', 20); c.lp = biq(ac, 'lowpass', 20000);
  c.sat = makeSat(ac, 0.25);
  c.vol = ac.createGain(); c.pan = ac.createStereoPanner(); c.mute = ac.createGain();
  c.input.connect(c.hp).connect(c.lp).connect(c.sat.inp); c.sat.out.connect(c.vol).connect(c.pan).connect(c.mute).connect(dest);
  c.apply = (t, audible) => { c.hp.frequency.value = t.lowcut; c.lp.frequency.value = t.highcut; c.sat.set(t.drive); c.vol.gain.value = volGain(t.vol); c.pan.pan.value = t.pan; c.mute.gain.value = audible ? 1 : 0; };
  return c;
}
const anySolo = () => tracks.some((t) => t.solo);
const audible = (t) => !t.mute && (!anySolo() || t.solo);

// ---------- audio init / iOS unlock ----------
async function unlock() {
  if (ctx) { if (ctx.state !== 'running') await ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) {}
  // iOS: a silent buffer started inside the gesture unlocks output
  const sb = ctx.createBufferSource(); sb.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); sb.connect(ctx.destination); sb.start(0);
  const resumeP = ctx.resume();
  let hasWorklet = true;
  try { await ctx.audioWorklet.addModule('worklets.js'); } catch (e) { hasWorklet = false; toast('This browser lacks AudioWorklet; recording needs iOS 14.5+ / a recent browser.'); }
  await resumeP.catch(() => {});
  master = buildMaster(ctx, hasWorklet); master.out.connect(ctx.destination); master.apply(S);
  clickBus = ctx.createGain(); clickBus.gain.value = 0.5; clickBus.connect(ctx.destination);
  rt.forEach((r, i) => { r.chain = buildTrack(ctx, master.input); });
  if (hasWorklet) {
    recNode = new AudioWorkletNode(ctx, 'looper-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const z = ctx.createGain(); z.gain.value = 0; recNode.connect(z).connect(ctx.destination);
    recNode.port.onmessage = (e) => { if (e.data.meter !== undefined) micPeak = Math.max(micPeak * 0.8, e.data.meter); else onCapture(e.data.id, e.data.data); };
  }
  if (sess.L && sess.sr && sess.sr !== ctx.sampleRate) resampleSession(ctx.sampleRate);
  if (!sess.sr) sess.sr = ctx.sampleRate;
  if (S.latencyMs == null) S.latencyMs = Math.round(((ctx.baseLatency || 0.005) + (ctx.outputLatency || 0.01)) * 1000 + 12);
  tracks.forEach((t, i) => rebuildBuffer(i));
  applyMix();
  ctx.onstatechange = () => { render(); if (ctx.state !== 'running') showResume(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx.state !== 'running') ctx.resume().catch(showResume); });
  window.addEventListener('pageshow', () => ctx.state !== 'running' && ctx.resume().catch(() => {}));
}
function showResume() { if (document.hidden || !ctx || ctx.state === 'running') return; toast('Audio paused by the system. Tap anywhere to resume.', 4000); }
document.addEventListener('pointerdown', () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, true);

async function ensureMic() {
  if (micStream && micStream.getAudioTracks().some((t) => t.readyState === 'live')) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
  } catch (e) { toast('Microphone blocked. Allow it in Settings › Safari › Microphone (or the site settings), then try again.', 5000); return false; }
  micSrc = ctx.createMediaStreamSource(micStream); micSrc.connect(recNode);
  micStream.getAudioTracks().forEach((t) => (t.onended = () => { micStream = null; }));
  if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  return true;
}
function resampleSession(sr) {
  const ratio = sr / sess.sr, L = Math.round(sess.L * ratio);
  const rs = (a) => { const o = new Float32Array(L); for (let i = 0; i < L; i++) { const x = i / ratio, j = Math.floor(x), f = x - j; o[i] = (a[j] || 0) * (1 - f) + (a[(j + 1) % a.length] || 0) * f; } return o; };
  tracks.forEach((t) => (t.layers = t.layers.map(rs))); sess.L = L; sess.sr = sr; save();
}

// ---------- transport & clock ----------
const beatDur = () => 60 / S.bpm;
const loopSec = () => sess.L / sess.sr;
const posAt = (t) => { const L = loopSec(); return (((t - loopStart) % L) + L) % L; };
function startTransport(t0, ls) {
  playing = true; loopStart = ls;
  nextBeat = Math.ceil((t0 - loopStart) / beatDur() - 1e-6);
  master.startNoise(Math.max(t0, ls));
  tracks.forEach((_, i) => applySrc(i));
  clearInterval(schedTimer); schedTimer = setInterval(schedule, 25); schedule();
  render();
}
function stopTransport() {
  playing = false; clearInterval(schedTimer);
  rt.forEach((r, i) => { if (r.job) cancelRec(i); stopSrc(i); });
  if (master) master.stopNoise(ctx.currentTime);
  render();
}
async function togglePlay() {
  await unlock();
  if (playing) return stopTransport();
  const t0 = ctx.currentTime + 0.08;
  startTransport(t0, t0); // with no loop yet this just runs the click
}
function schedule() {
  if (!playing) return;
  const bd = beatDur(), ahead = ctx.currentTime + 0.15;
  for (;;) {
    const t = loopStart + nextBeat * bd;
    if (t > ahead) break;
    const counting = nextBeat < 0, inBar = ((nextBeat % 4) + 4) % 4;
    if ((S.click || counting) && t >= ctx.currentTime - 0.005) {
      clickAt(t, inBar === 0 ? 1 : 0.6, inBar === 0 ? 1600 : 1100, counting);
      if (S.click && !counting) { const hum = ((Math.random() * 2 - 1) * S.humanize) / 1000; clickAt(t + bd * (S.swing / 100) + hum, 0.18, 800); }
    }
    nextBeat++;
  }
}
function clickAt(t, amp, f, accent) {
  if (t < ctx.currentTime) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = accent ? f * 1.25 : f; o.type = 'sine';
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
  o.connect(g).connect(clickBus); o.start(t); o.stop(t + 0.06);
}

// ---------- per-track playback ----------
function rebuildBuffer(i) {
  const t = tracks[i], r = rt[i];
  if (!t.layers.length || !sess.L) { r.buf = null; return; }
  const b = ctx.createBuffer(1, sess.L, sess.sr), d = b.getChannelData(0);
  for (const l of t.layers) for (let k = 0; k < sess.L; k++) d[k] += l[k] || 0;
  r.buf = b;
}
function stopSrc(i) { const r = rt[i]; if (r.src) { try { r.src.stop(); } catch (e) {} r.src.disconnect(); r.src = null; } }
function applySrc(i) {
  const r = rt[i], t = tracks[i];
  stopSrc(i);
  if (!ctx || !playing || !r.buf || t.stopped) return;
  const s = ctx.createBufferSource(); s.buffer = r.buf; s.loop = true; s.connect(r.chain.input);
  const at = ctx.currentTime + 0.02;
  if (at < loopStart) s.start(loopStart, 0); else s.start(at, posAt(at));
  r.src = s;
}
function applyMix() { if (!ctx) return; tracks.forEach((t, i) => rt[i].chain.apply(t, audible(t))); master.apply(S); }

// ---------- recording ----------
function capture(i, startT, lenSec, kind) {
  const id = jobSeq++, sr = ctx.sampleRate, off = S.latencyMs / 1000;
  const start = Math.round((startT + off) * sr);
  const len = lenSec == null ? null : Math.round(lenSec * sr);
  recNode.port.postMessage({ cmd: 'cap', id, start, end: len == null ? Number.MAX_SAFE_INTEGER : start + len + XF });
  jobs.set(id, { i, kind, start, len });
  Object.assign(rt[i], { job: id, capT: startT, capLen: lenSec || 0 });
  return id;
}
function cancelRec(i) {
  const r = rt[i]; if (!r.job) return;
  recNode.port.postMessage({ cmd: 'cancel', id: r.job }); jobs.delete(r.job); r.job = null; r.free = false;
  if (r.first && !sess.L) { r.first = false; if (playing) stopTransport(); }
  r.first = false; render();
}
async function startRec(i) {
  if (!recNode) return toast('Recording is not supported in this browser.');
  if (!(await ensureMic())) return;
  const r = rt[i], now = ctx.currentTime, bar = 4 * beatDur();
  if (!sess.L) {
    sess.sr = ctx.sampleRate; r.first = true;
    if (S.bars > 0) {
      const t0 = now + 0.1, R = S.countIn ? t0 + bar : t0;
      if (playing) stopTransport();
      startTransport(t0, R);
      capture(i, R, S.bars * bar, 'first');
    } else {
      const R = now + 0.02; r.free = true;
      if (playing) stopTransport();
      if (S.click) startTransport(R, R); else loopStart = R;
      capture(i, R, null, 'free');
    }
  } else {
    let B;
    if (!playing) { const t0 = now + 0.1; B = S.countIn ? t0 + bar : t0; startTransport(t0, B); }
    else { B = loopStart + Math.ceil((now + 0.05 - loopStart) / loopSec()) * loopSec(); }
    capture(i, B, loopSec(), 'layer');
  }
  render();
}
function finishFree(i) {
  const r = rt[i], j = jobs.get(r.job); if (!j) return;
  const now = ctx.currentTime, Lsec = now - r.capT;
  if (Lsec < 0.25) { cancelRec(i); return; }
  const len = Math.round(Lsec * ctx.sampleRate);
  j.len = len; recNode.port.postMessage({ cmd: 'end', id: r.job, end: j.start + len + XF });
  r.free = false; r.capLen = Lsec;
  // snap the tempo so the loop is a whole number of beats
  const beats = Math.max(1, Math.round(Lsec / beatDur())); S.bpm = Math.round((60 * beats / Lsec) * 10) / 10;
  sess.L = len; sess.sr = ctx.sampleRate;
  const ls = r.capT; // loop position 0 = when you tapped record
  if (playing) { loopStart = ls; nextBeat = Math.ceil((now - ls) / beatDur()); } else startTransport(now + 0.01, ls);
  render();
}
function onCapture(id, data) {
  const j = jobs.get(id); if (!j) return; jobs.delete(id);
  const i = j.i, r = rt[i], t = tracks[i];
  if (r.job !== id) return;
  r.job = null; r.first = false; r.free = false;
  if (!sess.L) { sess.L = j.len; sess.sr = ctx.sampleRate; }
  const L = sess.L, layer = new Float32Array(L);
  layer.set(data.subarray(0, Math.min(L, data.length)));
  // seamless loop: crossfade the overshoot (after the loop end) into the loop start
  const n = Math.min(XF, Math.max(0, data.length - L));
  for (let k = 0; k < n; k++) { const a = k / n; layer[k] = layer[k] * Math.sin(a * Math.PI / 2) + data[L + k] * Math.cos(a * Math.PI / 2); }
  t.layers.push(layer); t.stopped = false;
  rebuildBuffer(i); applySrc(i); save(); render();
}
function undoTake(i) { const t = tracks[i]; if (!t.layers.length) return; t.layers.pop(); afterEdit(i); }
function clearTrack(i) { tracks[i].layers = []; afterEdit(i); }
function afterEdit(i) {
  if (tracks.every((t) => !t.layers.length)) { sess.L = 0; if (playing && !rt.some((r) => r.job)) stopTransport(); }
  if (ctx) { rebuildBuffer(i); applySrc(i); }
  save(); render();
}

// ---------- latency calibration ----------
async function calibrate() {
  await unlock(); if (!(await ensureMic())) return;
  if (playing) stopTransport();
  toast('Calibrating: keep quiet, speaker volume up, phone face up…', 3500);
  const sr = ctx.sampleRate, T0 = ctx.currentTime + 0.3, N = 6, gap = 0.45, clicks = [];
  for (let k = 0; k < N; k++) { const t = T0 + 0.2 + k * gap; clicks.push(t); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 2200; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.001); g.gain.exponentialRampToValueAtTime(0.001, t + 0.02); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.03); }
  const start = Math.round(T0 * sr), len = Math.round((0.2 + N * gap + 0.4) * sr), id = jobSeq++;
  const data = await new Promise((res) => { const h = (e) => { if (e.data.id === id) { recNode.port.removeEventListener('message', h); res(e.data.data); } }; recNode.port.addEventListener('message', h); recNode.port.postMessage({ cmd: 'cap', id, start, end: start + len }); });
  const ds = [];
  for (const c of clicks) {
    const a = Math.round((c - T0) * sr), b = Math.min(data.length, a + Math.round(0.35 * sr));
    let mx = 0; for (let k = a; k < b; k++) mx = Math.max(mx, Math.abs(data[k]));
    if (mx < 0.01) continue;
    for (let k = a; k < b; k++) if (Math.abs(data[k]) > mx * 0.5) { ds.push((k - a) / sr); break; }
  }
  if (ds.length < 3) { toast('Could not hear the clicks. Turn the volume up (headphones off) and try again.', 4500); return; }
  ds.sort((x, y) => x - y); S.latencyMs = Math.round(ds[Math.floor(ds.length / 2)] * 1000);
  save(); toast('Round-trip latency: ' + S.latencyMs + ' ms. Recordings will be shifted by this much.', 4000); openSheet('setup');
}

// ---------- WAV export ----------
function wav24(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, bps = 3, data = len * ch * bps;
  const ab = new ArrayBuffer(44 + data), v = new DataView(ab); let p = 0;
  const str = (s) => { for (const c of s) v.setUint8(p++, c.charCodeAt(0)); }, u32 = (x) => { v.setUint32(p, x, true); p += 4; }, u16 = (x) => { v.setUint16(p, x, true); p += 2; };
  str('RIFF'); u32(36 + data); str('WAVE'); str('fmt '); u32(16); u16(1); u16(ch); u32(sr); u32(sr * ch * bps); u16(ch * bps); u16(24); str('data'); u32(data);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { let s = Math.round(clamp(chans[c][i], -1, 1) * 8388607); v.setUint8(p, s & 255); v.setUint8(p + 1, (s >> 8) & 255); v.setUint8(p + 2, (s >> 16) & 255); p += 3; }
  return new Blob([ab], { type: 'audio/wav' });
}
async function renderMix(mode, only = -1) { // mode: 'wet' | 'dry' | 'stem'
  const sr = sess.sr, L = sess.L, tail = mode === 'wet' ? Math.round(sr * 1.5) : 0, total = L * S.loops + tail;
  const off = new OfflineAudioContext(2, total, sr);
  let dest = off.destination, m = null;
  if (mode === 'wet') {
    let hasCrush = true; try { await off.audioWorklet.addModule('worklets.js'); } catch (e) { hasCrush = false; }
    m = buildMaster(off, hasCrush); m.apply(S); m.out.connect(off.destination); dest = m.input; m.startNoise(0); m.stopNoise(L * S.loops / sr + 1.5);
  }
  tracks.forEach((t, i) => {
    if (!t.layers.length || (only >= 0 && i !== only)) return;
    if (only < 0 && (t.stopped || !audible(t))) return;
    const c = buildTrack(off, dest); c.apply(t, true);
    const b = off.createBuffer(1, L, sr), d = b.getChannelData(0);
    for (const l of t.layers) for (let k = 0; k < L; k++) d[k] += l[k];
    const s = off.createBufferSource(); s.buffer = b; s.loop = true; s.connect(c.input); s.start(0); s.stop((L * S.loops) / sr);
  });
  return wav24(await off.startRendering());
}
async function doExport(kind) {
  if (!sess.L) return toast('Record something first.');
  const box = $('#files'); box.innerHTML = '<p>Rendering…</p>';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const out = [];
  try {
    if (kind === 'mix') { out.push(['looper-' + stamp + '-mix.wav', await renderMix('wet')]); out.push(['looper-' + stamp + '-dry.wav', await renderMix('dry')]); }
    else { for (let i = 0; i < NT; i++) if (tracks[i].layers.length) out.push(['looper-' + stamp + '-track' + (i + 1) + '.wav', await renderMix('stem', i)]); }
  } catch (e) { box.innerHTML = '<p>Export failed: ' + e.message + '</p>'; return; }
  box.innerHTML = '';
  for (const [name, blob] of out) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    a.innerHTML = `<span>${name.replace('looper-' + stamp + '-', '').replace('.wav', '')} WAV</span><small>${(blob.size / 1048576).toFixed(1)} MB</small>`;
    box.appendChild(a);
  }
  if (navigator.canShare && navigator.canShare({ files: [new File([out[0][1]], out[0][0], { type: 'audio/wav' })] })) {
    const b = document.createElement('button'); b.className = 'pill acc wide'; b.textContent = 'Share / Save to Files';
    b.onclick = () => navigator.share({ files: out.map(([n, bl]) => new File([bl], n, { type: 'audio/wav' })) }).catch(() => {});
    box.appendChild(b);
  }
}

// ---------- UI ----------
const ICON = {
  loop: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c47f62" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
  rec: '<svg width="17" height="17"><circle cx="8.5" cy="8.5" r="6.8" fill="#a5564c"/></svg>',
  stop: '<svg width="17" height="17" viewBox="0 0 20 20"><path d="M6 4l11 6-11 6z" fill="#958b7f"/></svg>',
  empty: '<svg width="17" height="17" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#7a7066" stroke-width="2"/></svg>',
};
const CIRC = 2 * Math.PI * 32.5;
function stripHTML(i) {
  return `<div class="strip panel" data-i="${i}">
  <button class="lab" data-act="sheet">${tracks[i].name}<span class="st">EMPTY</span></button>
  <div class="loop empty" data-act="loop" role="button" aria-label="Record or play track ${i + 1}" tabindex="0"><svg width="72" height="72"><circle class="bg" cx="36" cy="36" r="32.5" fill="none" stroke="#3d362f" stroke-width="2.5" stroke-dasharray="5 6"/><circle class="fg" cx="36" cy="36" r="32.5" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" transform="rotate(-90 36 36)"/></svg><div class="core">${ICON.empty}</div></div>
  <div class="fader" aria-label="Volume"><div class="frail"><div class="ticks">${'<i></i>'.repeat(9)}</div><div class="ffill"></div><div class="cap2"></div><div class="meter"></div></div></div>
  <div class="vv">Vol 80</div>
  <div class="pan" aria-label="Pan"><svg width="44" height="44"><circle cx="22" cy="22" r="19" fill="#2f2a25" stroke="#3a332c" stroke-width="2"/><line class="ptr" x1="22" y1="22" x2="22" y2="10" stroke="#cfc5b8" stroke-width="2.5" stroke-linecap="round"/></svg><span>Pan</span></div>
  <button class="btn ms" data-act="mute">M</button><button class="btn ms" data-act="solo">S</button></div>`;
}
function dragValue(el, get, set, { range = 150, reset = null, onTap = null } = {}) {
  let y0, x0, v0, moved, lastTap = 0;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); y0 = e.clientY; x0 = e.clientX; v0 = get(); moved = false; });
  el.addEventListener('pointermove', (e) => { if (y0 == null) return; const d = (y0 - e.clientY + (e.clientX - x0) * 0.5) / range; if (Math.abs(y0 - e.clientY) > 3) moved = true; set(clamp(v0 + d, 0, 1)); });
  el.addEventListener('pointerup', () => { if (y0 == null) return; y0 = null; if (!moved) { const now = Date.now(); if (reset != null && now - lastTap < 350) set(reset); else if (onTap) onTap(); lastTap = now; } save(); });
  el.addEventListener('pointercancel', () => (y0 = null));
}
function buildUI() {
  const T = $('#tracks'); T.innerHTML = tracks.map((_, i) => stripHTML(i)).join('');
  T.querySelectorAll('.strip').forEach((el) => {
    const i = +el.dataset.i, t = () => tracks[i];
    const fader = $('.fader', el); dragValue(fader, () => t().vol, (v) => { t().vol = v; applyMix(); renderStrip(i); }, { range: fader.clientHeight || 220, reset: 0.8 });
    dragValue($('.pan', el), () => (t().pan + 1) / 2, (v) => { t().pan = Math.round((v * 2 - 1) * 50) / 50; applyMix(); renderStrip(i); }, { range: 160, reset: 0.5 });
    const loop = $('.loop', el); let lp = null, held = false;
    loop.addEventListener('pointerdown', (e) => { e.preventDefault(); held = false; lp = setTimeout(() => { held = true; if (tracks[i].layers.length && !rt[i].job) { unlock().then(() => startRec(i)); navigator.vibrate && navigator.vibrate(20); } }, 550); });
    loop.addEventListener('pointerup', () => { clearTimeout(lp); if (!held) tapLoop(i); });
    loop.addEventListener('pointerleave', () => clearTimeout(lp));
    el.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
      if (act === 'mute') { t().mute = !t().mute; applyMix(); save(); render(); }
      if (act === 'solo') { t().solo = !t().solo; applyMix(); save(); render(); }
      if (act === 'sheet') openSheet('track', i); });
  });
  $('#eq').innerHTML = ['LOW', 'MID', 'HIGH'].map((l, k) => `<div class="vs" data-k="${k}"><div class="vrail"><div class="mid"></div><div class="thumb"></div></div><span>${l}</span></div>`).join('');
  document.querySelectorAll('.vs').forEach((el) => { const k = +el.dataset.k; dragValue(el, () => (S.eq[k] + 12) / 24, (v) => { S.eq[k] = Math.round(v * 24 - 12); applyMix(); renderFx(); }, { range: 110, reset: 0.5 }); });
  dragValue($('#revKnob'), () => S.reverb / 0.6, (v) => { S.reverb = Math.round(v * 60) / 100; applyMix(); renderFx(); }, { range: 180, reset: 0.25 });
  $('#lofi').onclick = () => { S.lofi = !S.lofi; applyMix(); save(); renderFx(); };
  $('#play').onclick = togglePlay;
  $('#click').onclick = () => { S.click = !S.click; save(); render(); };
  $('#bpmDown').onclick = () => setBpm(Math.round(S.bpm) - 1);
  $('#bpmUp').onclick = () => setBpm(Math.round(S.bpm) + 1);
  let taps = [];
  $('#tap').onclick = () => { if (sess.L) return toast('Tempo is locked to the loop. Clear all tracks to change it.'); const n = performance.now(); taps = taps.filter((x) => n - x < 2500); taps.push(n); if (taps.length >= 2) { const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); setBpm(Math.round(60000 / iv)); } };
  $('#openExport').onclick = () => openSheet('export');
  $('#openSetup').onclick = () => openSheet('setup');
  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
}
function setBpm(v) { if (sess.L) return toast('Tempo is locked to the loop. Clear all tracks to change it.'); S.bpm = clamp(v, 40, 200); if (playing && !rt.some((r) => r.job)) { const now = ctx.currentTime; loopStart = now; nextBeat = 1; } save(); render(); }
async function tapLoop(i) {
  await unlock();
  const r = rt[i], t = tracks[i];
  if (r.job) { if (r.free) finishFree(i); else cancelRec(i); return; }
  if (t.layers.length) {
    if (!playing) { const t0 = ctx.currentTime + 0.05; t.stopped = false; startTransport(t0, t0); }
    else { t.stopped = !t.stopped; applySrc(i); }
    save(); render(); return;
  }
  startRec(i);
}

function stateOf(i) {
  const r = rt[i], t = tracks[i];
  if (r.job) { const now = ctx.currentTime; if (r.free || now >= r.capT) return 'rec'; return 'armed'; }
  if (!t.layers.length) return 'empty';
  return playing && !t.stopped ? 'play' : 'stop';
}
const LABEL = { empty: 'EMPTY', armed: 'WAIT', rec: 'REC', play: 'LOOP', stop: 'STOP' };
function renderStrip(i) {
  const el = document.querySelector(`.strip[data-i="${i}"]`); if (!el) return;
  const t = tracks[i], st = stateOf(i), loop = $('.loop', el), bg = $('.bg', loop), fg = $('.fg', loop);
  if (loop.dataset.s !== st) {
    loop.className = 'loop ' + st; loop.dataset.s = st;
    $('.core', loop).innerHTML = ICON[st === 'armed' ? 'rec' : st === 'play' ? 'loop' : st];
    if (st === 'empty') { bg.setAttribute('stroke', '#3d362f'); bg.setAttribute('stroke-width', '2.5'); bg.setAttribute('stroke-dasharray', '5 6'); }
    else { bg.setAttribute('stroke', st === 'rec' || st === 'armed' ? '#553630' : st === 'stop' ? '#4a423a' : '#3a332c'); bg.setAttribute('stroke-width', '5'); bg.removeAttribute('stroke-dasharray'); }
    fg.setAttribute('stroke', st === 'play' ? '#c47f62' : '#a5564c');
  }
  const lab = $('.st', el);
  let txt = LABEL[st]; if (st === 'play' && t.layers.length > 1) txt += ' ×' + t.layers.length;
  if (st === 'armed' && !sess.L && rt[i].first) txt = 'COUNT';
  lab.textContent = txt; lab.className = 'st ' + (st === 'play' ? 'p' : st === 'rec' || st === 'armed' ? 'r' : '');
  $('.ffill', el).style.height = t.vol * 100 + '%'; $('.cap2', el).style.top = (1 - t.vol) * 100 + '%';
  $('.vv', el).textContent = 'Vol ' + Math.round(t.vol * 100);
  const a = (t.pan * 135 * Math.PI) / 180; const p = $('.ptr', el); p.setAttribute('x2', 22 + 12 * Math.sin(a)); p.setAttribute('y2', 22 - 12 * Math.cos(a));
  el.querySelector('[data-act=mute]').classList.toggle('on', t.mute);
  el.querySelector('[data-act=solo]').classList.toggle('on', t.solo);
}
function renderFx() {
  const v = S.reverb / 0.6; $('#revArc').setAttribute('stroke-dasharray', `${Math.max(0.1, v * 117.8)} 157`);
  const a = (-135 + v * 270) * Math.PI / 180; $('#revPtr').setAttribute('x2', 29 + 14 * Math.sin(a)); $('#revPtr').setAttribute('y2', 29 - 14 * Math.cos(a));
  $('#revLab').textContent = 'Reverb ' + Math.round(S.reverb * 100) + '%';
  $('#lofi').classList.toggle('on', S.lofi); $('#lofi').setAttribute('aria-pressed', S.lofi);
  document.querySelectorAll('.vs').forEach((el) => { $('.thumb', el).style.top = (1 - (S.eq[+el.dataset.k] + 12) / 24) * 100 + '%'; });
}
function render() {
  $('#bpmNum').textContent = Number.isInteger(S.bpm) ? S.bpm : S.bpm.toFixed(1);
  $('#bpmDown').disabled = $('#bpmUp').disabled = !!sess.L;
  $('#bpmLab').textContent = sess.L ? 'LOCKED' : 'BPM · TAP';
  $('#click').classList.toggle('on', S.click);
  $('#playIcon').setAttribute('d', playing ? 'M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 13.5z' : 'M6 4l11 6-11 6z');
  tracks.forEach((_, i) => renderStrip(i)); renderFx();
}
function frame() {
  if (ctx) {
    const now = ctx.currentTime, bd = beatDur();
    let bb = '1.1', dots = [0, 0, 0, 0], cnt = false;
    if (playing) {
      const tb = now - loopStart; let beat = Math.floor(tb / bd + 1e-6);
      if (tb < 0) { cnt = true; bb = '–' + (-beat); dots = dots.map((_, k) => (k <= 4 + beat ? 1 : 0)); }
      else { if (sess.L) beat = beat % Math.max(1, Math.round(loopSec() / bd)); bb = (Math.floor(beat / 4) + 1) + '.' + ((beat % 4) + 1); dots = dots.map((_, k) => (k <= beat % 4 ? 1 : 0)); }
    }
    $('#bb').textContent = bb;
    document.querySelectorAll('#beats i').forEach((d, k) => { d.className = dots[k] ? (cnt ? 'cnt' : 'on') : ''; });
    tracks.forEach((t, i) => {
      const el = document.querySelector(`.strip[data-i="${i}"]`), st = stateOf(i), fg = $('.fg', el), r = rt[i];
      if (el.querySelector('.loop').dataset.s !== st) renderStrip(i);
      let p = 0;
      if (st === 'play' && sess.L) p = posAt(now) / loopSec();
      else if (st === 'rec') p = r.free ? ((now - r.capT) % 2) / 2 : clamp((now - r.capT) / r.capLen, 0, 1);
      fg.setAttribute('stroke-dashoffset', CIRC * (1 - p));
      $('.meter', el).style.height = st === 'rec' || st === 'armed' ? clamp(micPeak, 0, 1) * 100 + '%' : '0';
    });
  }
  requestAnimationFrame(frame);
}

// ---------- sheets ----------
let sheetKind = null, sheetIdx = -1;
function slider(id, label, min, max, step, val, fmt) { return `<div class="sl"><label style="width:74px">${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}o">${fmt(val)}</output></div>`; }
const logToHz = (v) => Math.round(20 * Math.pow(1000, v)), hzToLog = (h) => Math.log(h / 20) / Math.log(1000);
const fmtHz = (h) => (h >= 1000 ? (h / 1000).toFixed(h >= 10000 ? 0 : 1) + ' kHz' : h + ' Hz');
function bindRange(id, fmt, fn) { const el = $('#' + id); const upd = () => { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%'); $('#' + id + 'o').textContent = fmt(+el.value); }; upd(); el.oninput = () => { fn(+el.value); upd(); }; el.onchange = save; }
function seg(id, opts, cur) { return `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`; }
function bindSeg(id, fn) { $('#' + id).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; fn(+b.dataset.v); $('#' + id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); save(); }; }
function openSheet(kind, i = -1) {
  sheetKind = kind; sheetIdx = i; const C = $('#sheetContent');
  if (kind === 'track') {
    const t = tracks[i];
    C.innerHTML = `<h2>${t.name}</h2><p>${t.layers.length ? t.layers.length + ' take' + (t.layers.length > 1 ? 's' : '') + ' layered' : 'Empty. Tap its circle to record.'}</p>
    <h3>Tone</h3>${slider('lc', 'Low cut', 0, 0.55, 0.005, hzToLog(t.lowcut), (v) => fmtHz(logToHz(v)))}${slider('hc', 'High cut', 0.55, 1, 0.005, hzToLog(t.highcut), (v) => fmtHz(logToHz(v)))}${slider('dr', 'Tape drive', 0, 1, 0.01, t.drive, (v) => Math.round(v * 100) + '%')}
    <h3>Takes</h3><div class="row"><button class="pill acc" id="tOver">${t.layers.length ? 'Overdub' : 'Record'}</button><button class="pill" id="tUndo" ${t.layers.length ? '' : 'disabled'}>Undo take</button><button class="pill danger" id="tClear" ${t.layers.length ? '' : 'disabled'}>Clear</button></div>
    <p>Overdub records one more pass over the loop, starting at the next loop start. You can also hold the circle to overdub.</p>`;
    bindRange('lc', (v) => fmtHz(logToHz(v)), (v) => { t.lowcut = logToHz(v); applyMix(); });
    bindRange('hc', (v) => fmtHz(logToHz(v)), (v) => { t.highcut = logToHz(v); applyMix(); });
    bindRange('dr', (v) => Math.round(v * 100) + '%', (v) => { t.drive = v; applyMix(); });
    $('#tOver').onclick = async () => { closeSheet(); await unlock(); if (!rt[i].job) startRec(i); };
    $('#tUndo').onclick = () => { undoTake(i); openSheet('track', i); };
    $('#tClear').onclick = () => { if (confirm('Clear ' + t.name + '?')) { clearTrack(i); openSheet('track', i); } };
  } else if (kind === 'setup') {
    C.innerHTML = `<h2>Setup</h2>
    <h3>First loop length</h3>${seg('bars', [[0, 'Free'], [1, '1 bar'], [2, '2'], [4, '4'], [8, '8']], S.bars)}
    <p>${sess.L ? 'The loop is set (' + loopSec().toFixed(2) + ' s). New takes record one loop pass.' : 'Free: tap to start, tap again to close the loop. Bars: records exactly that many bars at the current tempo.'}</p>
    <div class="row" style="margin-top:10px">${seg('cin', [[1, 'Count-in on'], [0, 'Count-in off']], S.countIn ? 1 : 0)}</div>
    <h3>Groove</h3>${slider('sw', 'Swing', 50, 66, 1, S.swing, (v) => v + '%')}${slider('hu', 'Humanize', 0, 15, 1, S.humanize, (v) => '±' + v + ' ms')}
    <p>Swing and humanize shape the click's off-beat 8ths.</p>
    <h3>Latency</h3>${slider('lat', 'Offset', 0, 400, 1, S.latencyMs ?? 40, (v) => v + ' ms')}
    <div class="row"><button class="pill acc" id="cal">Measure with the click</button></div>
    <p>Shifts new recordings earlier to line up with what you heard. Measure once per output (speaker, wired, Bluetooth). Wired headphones are best; Bluetooth adds 150–250 ms.</p>
    <h3>Master</h3>${slider('mv', 'Volume', 0, 1.2, 0.01, S.master, (v) => Math.round(v * 100) + '%')}${slider('cr', 'Crackle', -60, -20, 1, S.crackle, (v) => (v <= -60 ? 'off' : v + ' dB'))}${slider('hi', 'Hiss', -60, -20, 1, S.hiss, (v) => (v <= -60 ? 'off' : v + ' dB'))}
    <p>Lofi on: 30 Hz HPF → tape saturation → wow & flutter → 9 kHz low-pass → 12-bit crush (35%) → glue comp → reverb → crackle & hiss → limiter. Crackle and hiss run only while playing.</p>
    <h3>iPhone notes</h3><p>Turn the silent switch off. Keep Looper on screen: iOS pauses web audio in the background or when locked. Add to Home Screen (Share › Add to Home Screen) so the session storage is kept.</p>
    <div class="row" style="margin-top:12px"><button class="pill danger" id="newS">New session (clear everything)</button></div>`;
    bindSeg('bars', (v) => (S.bars = v)); bindSeg('cin', (v) => (S.countIn = !!v));
    bindRange('sw', (v) => v + '%', (v) => (S.swing = v)); bindRange('hu', (v) => '±' + v + ' ms', (v) => (S.humanize = v));
    bindRange('lat', (v) => v + ' ms', (v) => (S.latencyMs = v));
    bindRange('mv', (v) => Math.round(v * 100) + '%', (v) => { S.master = v; applyMix(); });
    bindRange('cr', (v) => (v <= -60 ? 'off' : v + ' dB'), (v) => { S.crackle = v; applyMix(); });
    bindRange('hi', (v) => (v <= -60 ? 'off' : v + ' dB'), (v) => { S.hiss = v; applyMix(); });
    $('#cal').onclick = () => { closeSheet(); calibrate(); };
    $('#newS').onclick = () => { if (!confirm('Delete all tracks and start over?')) return; if (playing) stopTransport(); tracks = tracks.map((_, i) => newTrack(i)); sess = { sr: ctx ? ctx.sampleRate : 0, L: 0 }; if (ctx) { tracks.forEach((_, i) => rebuildBuffer(i)); applyMix(); } save(); closeSheet(); render(); };
  } else if (kind === 'export') {
    C.innerHTML = `<h2>Export</h2><p>24-bit WAV at ${sess.sr || 48000} Hz. The mix includes the lofi chain, reverb and noise bed (wet); the dry mix skips the master effects. Muted and stopped tracks are left out of mixes.</p>
    <h3>Length</h3>${seg('lps', [[1, '1 loop'], [2, '2 loops'], [4, '4 loops'], [8, '8 loops']], S.loops)}
    <div class="row" style="margin-top:12px"><button class="pill acc" id="exMix">Mix (wet + dry)</button><button class="pill" id="exStems">Stems</button></div>
    <div class="files" id="files"></div>`;
    bindSeg('lps', (v) => (S.loops = v));
    $('#exMix').onclick = () => doExport('mix'); $('#exStems').onclick = () => doExport('stems');
  }
  $('#sheet').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; sheetKind = null; render(); }
let toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }

// ---------- boot ----------
(async function boot() {
  await load();
  buildUI(); render(); requestAnimationFrame(frame);
  $('#startBtn').onclick = async () => { $('#start').hidden = true; try { await unlock(); render(); } catch (e) { toast('Audio failed to start: ' + e.message, 5000); } };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  window.__looper = { S, tracks, get sess() { return sess; }, rt, get ctx() { return ctx; } };
})();
