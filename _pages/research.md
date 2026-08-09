---
layout: page
title: research
permalink: /research/
nav: true
nav_order: 2
_styles: |
  .site-page .post-header {
    display: none;
  }
  .site-page {
    width: 100vw;
    max-width: 100vw;
    margin-left: calc(50% - 50vw);
  }
  .site-page article {
    width: min(80vw, 1500px);
    max-width: 80vw;
    margin: 0 auto;
  }
  .arcsinh-viewer {
    width: 100%;
    height: calc(100vh - 8rem);
    min-height: 850px;
  }
  .viewer-description {
    max-width: 900px;
    margin: 0 auto 1rem;
    padding: 0 1.5rem;
  }
  .arcsinh-viewer iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
  @media (max-width: 768px) {
    .site-page article {
      width: 95vw;
      max-width: 95vw;
    }
  }
---

<div class="viewer-description">
  <h2>Arcsinh EW spectral viewer</h2>
  <p>Hover over a point to see its nearest spectra in the same group and emission-line equivalent widths.</p>
</div>

<div class="arcsinh-viewer">
  <iframe
    src="{{ '/assets/html/arcsinh-hdbscan-viewer.html' | relative_url }}"
    title="Arcsinh EW HDBSCAN spectral viewer"
  ></iframe>
</div>
