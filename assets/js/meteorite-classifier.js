// UI for the meteorite classifier page (_pages/meteorite-classifier.md).
(function () {
  const container = document.querySelector(".meteorite-classifier");
  if (!container || !window.MeteoriteClassifierModel) return;

  const { MeteoriteClassifier, parseSpectrum } = window.MeteoriteClassifierModel;
  const baseUrl = container.dataset.modelUrl;
  const input = document.getElementById("mc-input");
  const button = document.getElementById("mc-classify");
  const fileInput = document.getElementById("mc-file");
  const errorBox = document.getElementById("mc-error");
  const result = document.getElementById("mc-result");

  const GROUPS = {
    C1_2_CM: ["CM / C1–2 ungrouped", "Hydrated carbonaceous chondrites"],
    CK: ["CK", "Carbonaceous chondrites (Karoonda group)"],
    CO: ["CO", "Carbonaceous chondrites (Ornans group)"],
    CR: ["CR", "Carbonaceous chondrites (Renazzo group)"],
    CV: ["CV", "Carbonaceous chondrites (Vigarano group)"],
    EH: ["EH", "High-iron enstatite chondrites"],
    EL: ["EL", "Low-iron enstatite chondrites"],
    H: ["H", "High-iron ordinary chondrites"],
    HED: ["HED", "Howardites, eucrites, and diogenites"],
    L_LL: ["L / LL", "Low-iron ordinary chondrites"],
    R: ["R", "Rumuruti chondrites"],
    acapulcoite_lodranite: ["Acapulcoite / lodranite", "Primitive achondrites"],
    aubrite: ["Aubrite", "Enstatite achondrites"],
    brachinite: ["Brachinite", "Olivine-rich achondrites"],
    iron: ["Iron", "Iron meteorites"],
    ureilite: ["Ureilite", "Carbon-rich ultramafic achondrites"],
  };

  let model = null;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
    if (message) result.hidden = true;
  }

  function plotSpectrum(grid, values, normWavelength) {
    const width = 640;
    const height = 260;
    const pad = { left: 46, right: 14, top: 14, bottom: 38 };
    const xMin = 0.5;
    const xMax = 2.4;
    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    const span = yMax - yMin || 1;
    yMin -= span * 0.08;
    yMax += span * 0.08;
    const sx = (x) => pad.left + ((x - xMin) / (xMax - xMin)) * (width - pad.left - pad.right);
    const sy = (y) => height - pad.bottom - ((y - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
    const path = grid.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(values[i]).toFixed(1)}`).join("");

    let ticks = "";
    for (let x = 0.5; x <= 2.41; x += 0.5) {
      ticks += `<line class="mc-grid" x1="${sx(x)}" x2="${sx(x)}" y1="${pad.top}" y2="${height - pad.bottom}"/>`;
      ticks += `<text class="mc-tick" x="${sx(x)}" y="${height - pad.bottom + 16}" text-anchor="middle">${x.toFixed(1)}</text>`;
    }
    const yStep = span > 1.5 ? 0.5 : span > 0.6 ? 0.2 : 0.1;
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      ticks += `<line class="mc-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${sy(y)}" y2="${sy(y)}"/>`;
      ticks += `<text class="mc-tick" x="${pad.left - 6}" y="${sy(y) + 4}" text-anchor="end">${y.toFixed(1)}</text>`;
    }

    document.getElementById("mc-plot").innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Normalized reflectance spectrum used by the model">
        ${ticks}
        <line class="mc-norm" x1="${sx(normWavelength)}" x2="${sx(normWavelength)}" y1="${pad.top}" y2="${height - pad.bottom}"/>
        <path class="mc-line" d="${path}"/>
        <text class="mc-axis" x="${(pad.left + width - pad.right) / 2}" y="${height - 4}" text-anchor="middle">Wavelength (µm)</text>
        <text class="mc-axis" transform="translate(12 ${(pad.top + height - pad.bottom) / 2}) rotate(-90)" text-anchor="middle">Reflectance / R(0.80 µm)</text>
      </svg>`;
  }

  function render(output) {
    const top = output.ranked[0];
    const [name, description] = GROUPS[top.name] || [top.name, ""];
    document.getElementById("mc-top").textContent = name;
    document.getElementById("mc-top-desc").textContent = description;

    const bars = document.getElementById("mc-bars");
    bars.innerHTML = "";
    const maxProbability = output.ranked[0].probability;
    for (const entry of output.ranked) {
      const li = document.createElement("li");
      li.className = entry === top ? "mc-bar mc-bar-top" : "mc-bar";
      const label = document.createElement("span");
      label.className = "mc-bar-label";
      label.textContent = (GROUPS[entry.name] || [entry.name])[0];
      const track = document.createElement("span");
      track.className = "mc-bar-track";
      const fill = document.createElement("span");
      fill.className = "mc-bar-fill";
      fill.style.width = `${Math.max(1, (entry.probability / maxProbability) * 100)}%`;
      track.appendChild(fill);
      const value = document.createElement("span");
      value.className = "mc-bar-value";
      value.textContent = `${(entry.probability * 100).toFixed(1)}%`;
      li.append(label, track, value);
      bars.appendChild(li);
    }

    plotSpectrum(model.grid, output.normalized, model.normWavelength);
    result.hidden = false;
  }

  function classify() {
    if (!model) return;
    showError("");
    if (!input.value.trim()) {
      showError("Paste a spectrum or choose an example first.");
      return;
    }
    button.disabled = true;
    button.textContent = "Classifying…";
    // Let the button repaint before the ~0.1 s of feature extraction blocks the main thread.
    setTimeout(() => {
      try {
        render(model.classify(parseSpectrum(input.value)));
      } catch (error) {
        showError(error.message);
      } finally {
        button.disabled = false;
        button.textContent = "Classify";
      }
    }, 20);
  }

  async function loadExample(file) {
    showError("");
    try {
      const response = await fetch(`${baseUrl}/examples/${file}`);
      if (!response.ok) throw new Error(`Could not load example (${response.status}).`);
      input.value = await response.text();
      classify();
    } catch (error) {
      showError(error.message);
    }
  }

  button.addEventListener("click", classify);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) classify();
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    input.value = await file.text();
    fileInput.value = "";
    classify();
  });
  for (const chip of container.querySelectorAll("[data-example]")) {
    chip.addEventListener("click", () => loadExample(chip.dataset.example));
  }

  MeteoriteClassifier.load(baseUrl)
    .then((loaded) => {
      model = loaded;
      button.disabled = false;
      button.textContent = "Classify";
    })
    .catch(() => {
      button.textContent = "Model unavailable";
      showError("The model files could not be loaded. Try reloading the page.");
    });
})();
