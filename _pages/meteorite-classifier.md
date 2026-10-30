---
layout: page
title: meteorite classifier
permalink: /meteorite-classifier/
description: Classify a reflectance spectrum into one of 16 meteorite groups, in your browser.
---

<div class="selected-research meteorite-classifier" data-model-url="{{ '/assets/meteorite-classifier' | relative_url }}">
  <h2 class="research-heading">meteorite classifier</h2>

  <p class="aq-desc">
    Paste or upload a visible–near-infrared reflectance spectrum and this ROCKET model will place it in one of 16 meteorite groups. It's the model from
    my <a href="{{ '/research/' | relative_url }}">meteorite spectra project</a>, trained on 1,310 RELAB lab spectra. Everything runs in your browser;
    your spectrum is never uploaded anywhere.
  </p>

  <h3>Spectrum</h3>
  <p class="mc-hint">
    Two columns, wavelength and reflectance, separated by spaces, tabs, or commas. Wavelengths can be in µm or nm and must cover
    <strong>0.535–2.325 µm</strong>. Extra columns and lines starting with <code>#</code> are ignored.
  </p>

  <div class="mc-examples">
    <span>Try a RELAB example:</span>
    <button type="button" class="mc-chip" data-example="relab-cm-c1mp07.txt">CM chondrite</button>
    <button type="button" class="mc-chip" data-example="relab-h-c1tb69.txt">H chondrite</button>
    <button type="button" class="mc-chip" data-example="relab-hed-c1mp136a.txt">HED</button>
    <button type="button" class="mc-chip" data-example="relab-iron-c1sc63.txt">Iron</button>
  </div>

  <label class="mc-sr-only" for="mc-input">Spectrum data</label>
  <textarea id="mc-input" class="mc-input" rows="9" spellcheck="false" placeholder="0.535  0.912&#10;0.540  0.918&#10;0.545  0.925&#10;..."></textarea>

  <div class="mc-actions">
    <button type="button" id="mc-classify" class="mc-button" disabled>Loading model…</button>
    <label class="mc-file">
      <input type="file" id="mc-file" accept=".txt,.csv,.tab,.dat,text/plain,text/csv" />
      Upload file
    </label>
  </div>

  <p id="mc-error" class="mc-error" role="alert" hidden></p>

  <div id="mc-result" class="mc-result" aria-live="polite" hidden>
    <h3>Result</h3>
    <div class="mc-prediction">
      <span class="mc-label">Most likely group</span>
      <span id="mc-top" class="mc-top"></span>
      <span id="mc-top-desc" class="mc-top-desc"></span>
    </div>

    <div id="mc-plot" class="mc-plot"></div>

    <h3>All groups</h3>
    <p class="mc-hint">Bars show a softmax of the Ridge classifier scores: a relative ranking, not a calibrated probability.</p>
    <ol id="mc-bars" class="mc-bars"></ol>
  </div>

  <h3>How it works</h3>
  <p class="aq-desc">
    The spectrum is interpolated onto a 0.005 µm grid from 0.535 to 2.325 µm and divided by its reflectance at 0.80 µm. ROCKET applies 10,000 random
    convolutional kernels and keeps two summary numbers from each, then a Ridge classifier scores the resulting 20,000 features. The training set was
    augmented to 200 spectra per group with PCA jitter.
  </p>
  <p class="aq-note">
    The model learned from RELAB lab spectra of meteorite samples, and the examples above are from that training set. Spectra measured with a different
    instrument, grain size, or viewing geometry may be classified less reliably.
  </p>
</div>

<script defer src="{{ '/assets/js/meteorite-classifier-model.js' | relative_url | bust_file_cache }}"></script>
<script defer src="{{ '/assets/js/meteorite-classifier.js' | relative_url | bust_file_cache }}"></script>
