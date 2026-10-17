# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tanish Parida's personal site (https://tanishparida.github.io), built on the **al-folio** Jekyll theme. `README.md`, `INSTALL.md`, `CUSTOMIZE.md`, and `FAQ.md` are upstream al-folio docs — useful for theme mechanics, but they don't describe this site's customizations.

## Commands

```bash
# Local dev server (preferred; uses prebuilt al-folio image), serves on http://localhost:8080 with livereload
docker compose up

# Without Docker
bundle install
bundle exec jekyll serve

# Production build (what CI runs)
JEKYLL_ENV=production bundle exec jekyll build

# Format (CI enforces prettier on PRs; config: printWidth 150, liquid plugin)
npx prettier . --write
```

There are no tests. Deployment is automatic: `.github/workflows/deploy.yml` builds on push to `main` (only when relevant paths change), runs purgecss, and publishes to the `gh-pages` branch. `_site/` is build output — never edit it.

## Site structure

Only four pages exist in `_pages/`: `about.md` (home, `permalink: /`), `research.md`, `scioly.md`, `404.md`. Navbar order comes from `nav: true` + `nav_order` front matter. The upstream blog/publications/projects/CV pages were removed, so many `enable_*` flags and collections in `_config.yml` are effectively unused.

## Customizations on top of al-folio

- **Styling**: nearly all custom CSS is appended to `assets/css/main.scss` (after the al-folio imports), not in `_sass/`. Theme colors are overridden in `_sass/_themes.scss`. Custom fonts (Seagram, Old London) live in `assets/fonts/` and are declared via `@font-face` in `main.scss` with absolute `/assets/fonts/...` URLs (works because `baseurl` is blank).
- **Home page starfield**: `_layouts/about.liquid` adds a `#domain-expansion-background` div and loads three.js r128 from cdnjs plus `assets/js/gojo-domain.js`, which renders the animated star/particle background with custom shaders. It no-ops if the container or `THREE` is missing.
- **Research page**: hand-written HTML inside markdown, not jekyll-scholar. Entries use a `<details class="selected-research">` wrapper with `.aq-entry` / `.aq-title` / `.aq-authors` / `.aq-link` classes. `_includes/pub-item.liquid` and `pub-links.liquid` are reusable include components for publication-style rows (`.pub-item`). `_bibliography/papers.bib` is upstream scaffolding.
- **SciOly page**: links to written tests (Google Drive folders) using `.test-list` / `.test-item` cards; `.test-item-soon` marks unreleased tests.
- **Standalone assets**: `assets/html/` holds self-contained HTML pages (e.g. `arcsinh-hdbscan-viewer.html`) linked from research entries via `relative_url`.
- Profile image is `assets/img/pfp.webp`, referenced from `about.md` front matter.

When linking internal assets in Liquid/markdown, use `{{ '/path' | relative_url }}`; for local JS/CSS also append `| bust_file_cache` (custom plugin in `_plugins/cache-bust.rb`).
