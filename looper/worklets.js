// Looper AudioWorklet processors: sample-accurate mic capture + bitcrusher.
class LooperRec extends AudioWorkletProcessor {
  constructor() {
    super();
    this.jobs = [];
    this.meterN = 0; this.peak = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.cmd === 'cap') this.jobs.push({ id: d.id, start: d.start, end: d.end, chunks: [], len: 0 });
      else if (d.cmd === 'end') { const j = this.jobs.find((j) => j.id === d.id); if (j) j.end = d.end; }
      else if (d.cmd === 'cancel') this.jobs = this.jobs.filter((j) => j.id !== d.id);
    };
  }
  process(inputs) {
    const inp = inputs[0] && inputs[0][0];
    const n = inp ? inp.length : 128;
    const f0 = currentFrame;
    if (inp) { for (let k = 0; k < n; k++) { const a = Math.abs(inp[k]); if (a > this.peak) this.peak = a; } }
    if (++this.meterN >= 8) { this.port.postMessage({ meter: this.peak }); this.meterN = 0; this.peak = 0; }
    for (let q = this.jobs.length - 1; q >= 0; q--) {
      const j = this.jobs[q];
      if (f0 + n <= j.start) continue;
      const a = Math.max(0, j.start - f0), b = Math.min(n, j.end - f0);
      if (b > a) { const c = new Float32Array(b - a); if (inp) c.set(inp.subarray(a, b)); j.chunks.push(c); j.len += b - a; }
      if (f0 + n >= j.end) {
        const out = new Float32Array(j.len); let o = 0;
        for (const c of j.chunks) { out.set(c, o); o += c.length; }
        this.port.postMessage({ id: j.id, data: out }, [out.buffer]);
        this.jobs.splice(q, 1);
      }
    }
    return true;
  }
}
registerProcessor('looper-rec', LooperRec);

class LooperCrush extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 12, minValue: 2, maxValue: 16 },
      { name: 'rate', defaultValue: 22050, minValue: 1000, maxValue: 96000 },
      { name: 'mix', defaultValue: 0.35, minValue: 0, maxValue: 1 },
    ];
  }
  constructor() { super(); this.ph = [0, 0]; this.h = [0, 0]; }
  process(ins, outs, p) {
    const i = ins[0], o = outs[0];
    const step = Math.pow(0.5, p.bits[0] - 1), inc = Math.min(1, p.rate[0] / sampleRate), mix = p.mix[0];
    for (let c = 0; c < o.length; c++) {
      const y = o[c], x = i[c] || i[0];
      if (!x) { y.fill(0); continue; }
      let ph = this.ph[c] || 0, h = this.h[c] || 0;
      for (let k = 0; k < y.length; k++) {
        ph += inc; if (ph >= 1) { ph -= 1; h = Math.round(x[k] / step) * step; }
        y[k] = x[k] * (1 - mix) + h * mix;
      }
      this.ph[c] = ph; this.h[c] = h;
    }
    return true;
  }
}
registerProcessor('looper-crush', LooperCrush);
