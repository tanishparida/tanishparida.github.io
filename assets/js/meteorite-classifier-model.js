// In-browser port of the 16-group ROCKET meteorite classifier (0.80 µm normalization).
// Mirrors the Python pipeline: interpolate onto the training grid, divide by reflectance at
// 0.80 µm, z-normalize, apply 10,000 ROCKET kernels (ppv + max per kernel), scale, Ridge scores.
// Arithmetic is rounded to float32 where the Python/numba code works in float32.
(function (root) {
  const f32 = Math.fround;

  function parseSpectrum(text) {
    const rows = [];
    for (const line of text.split(/\r\n|\r|\n/)) {
      if (line.trimStart().startsWith("#")) continue;
      const parts = line.trim().replace(/,/g, " ").split(/\s+/);
      if (parts.length < 2) continue;
      const w = Number(parts[0]);
      const r = Number(parts[1]);
      if (Number.isFinite(w) && Number.isFinite(r)) rows.push([w, r]);
    }
    if (!rows.length) throw new Error("No wavelength/reflectance rows found. Expected two columns: wavelength and reflectance.");
    rows.sort((a, b) => a[0] - b[0]);
    const wavelengths = [];
    const reflectance = [];
    for (const [w, r] of rows) {
      if (wavelengths.length && wavelengths[wavelengths.length - 1] === w) continue;
      wavelengths.push(w);
      reflectance.push(r);
    }
    // Spectra given in nanometres are converted to microns.
    let unit = "µm";
    if (wavelengths[wavelengths.length - 1] > 100) {
      for (let i = 0; i < wavelengths.length; i++) wavelengths[i] /= 1000;
      unit = "nm";
    }
    return { wavelengths, reflectance, unit };
  }

  function interp(x, xp, fp) {
    let j = 0;
    return x.map((xi) => {
      while (j < xp.length - 2 && xp[j + 1] < xi) j++;
      const t = (xi - xp[j]) / (xp[j + 1] - xp[j]);
      return fp[j] + t * (fp[j + 1] - fp[j]);
    });
  }

  class MeteoriteClassifier {
    constructor(meta, buffer) {
      this.meta = meta;
      this.classes = meta.classes;
      this.grid = meta.target_grid_microns;
      this.normWavelength = meta.normalization_wavelength_microns;
      const view = (name) => {
        const a = meta.arrays[name];
        const Type = a.dtype === "float32" ? Float32Array : Int32Array;
        return new Type(buffer, a.offset, a.length);
      };
      for (const name of Object.keys(meta.arrays)) this[name] = view(name);
    }

    static async load(baseUrl) {
      const [meta, buffer] = await Promise.all([
        fetch(`${baseUrl}/model.json`).then((r) => r.json()),
        fetch(`${baseUrl}/model.bin`).then((r) => r.arrayBuffer()),
      ]);
      return new MeteoriteClassifier(meta, buffer);
    }

    preprocess(spectrum) {
      const { wavelengths, reflectance } = spectrum;
      const lo = this.grid[0];
      const hi = this.grid[this.grid.length - 1];
      if (wavelengths.length < 2 || lo < wavelengths[0] || hi > wavelengths[wavelengths.length - 1]) {
        throw new Error(
          `The spectrum must cover ${lo}–${hi} µm; this one covers ${wavelengths[0].toFixed(3)}–${wavelengths[wavelengths.length - 1].toFixed(3)} µm.`
        );
      }
      const values = interp(this.grid, wavelengths, reflectance);
      let idx = 0;
      for (let i = 1; i < this.grid.length; i++) {
        if (Math.abs(this.grid[i] - this.normWavelength) < Math.abs(this.grid[idx] - this.normWavelength)) idx = i;
      }
      const ref = values[idx];
      if (!Number.isFinite(ref) || Math.abs(ref) <= 1e-8) throw new Error(`Reflectance at ${this.normWavelength} µm is zero or invalid.`);
      return Float32Array.from(values, (v) => v / ref);
    }

    features(x) {
      const n = x.length;
      let mean = 0;
      for (let i = 0; i < n; i++) mean += x[i];
      mean = f32(mean / n);
      let variance = 0;
      for (let i = 0; i < n; i++) variance += (x[i] - mean) ** 2;
      const sd = f32(f32(Math.sqrt(variance / n)) + 1e-8);
      const xn = Float32Array.from(x, (v) => f32(v - mean) / sd);

      const out = new Float32Array(this.lengths.length * 2);
      let a = 0;
      for (let k = 0; k < this.lengths.length; k++) {
        const length = this.lengths[k];
        const bias = this.biases[k];
        const dilation = this.dilations[k];
        const padding = this.paddings[k];
        const outputLength = n + 2 * padding - (length - 1) * dilation;
        const end = n + padding - (length - 1) * dilation;
        let ppv = 0;
        let max = -Infinity;
        for (let i = -padding; i < end; i++) {
          let sum = bias;
          let index = i;
          for (let j = 0; j < length; j++) {
            if (index > -1 && index < n) sum = f32(sum + f32(this.weights[a + j] * xn[index]));
            index += dilation;
          }
          if (sum > max) max = sum;
          if (sum > 0) ppv++;
        }
        out[2 * k] = ppv / outputLength;
        out[2 * k + 1] = max;
        a += length;
      }
      return out;
    }

    scores(features) {
      const nFeatures = features.length;
      const scaled = Float32Array.from(features, (v, i) => v / this.scale[i]);
      return this.classes.map((_, c) => {
        let s = this.intercept[c];
        const offset = c * nFeatures;
        for (let i = 0; i < nFeatures; i++) s += scaled[i] * this.coef[offset + i];
        return s;
      });
    }

    classify(spectrum) {
      const normalized = this.preprocess(spectrum);
      const scores = this.scores(this.features(normalized));
      const top = Math.max(...scores);
      const exp = scores.map((s) => Math.exp(s - top));
      const total = exp.reduce((t, v) => t + v, 0);
      const ranked = this.classes.map((name, i) => ({ name, score: scores[i], probability: exp[i] / total })).sort((p, q) => q.score - p.score);
      return { normalized, scores, ranked };
    }
  }

  const api = { MeteoriteClassifier, parseSpectrum };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MeteoriteClassifierModel = api;
})(typeof window !== "undefined" ? window : globalThis);
