# Hamid Ahmadi Asl — personal academic site

A static single-page site (HTML + CSS + JS, no build step). Hero uses Three.js; scroll effects use GSAP — both load from a CDN.

```
index.html
css/style.css
js/main.js
assets/            (optional: put photo.jpg here)
README.md
```

## Publish on GitHub Pages
1. Create a **public** repository named exactly `hamid-ahmadiasl.github.io` (github.com → New).
2. Open the repo → **Add file → Upload files**. Unzip `hamid-site.zip` and drag **the contents** (`index.html`, `css/`, `js/`, `assets/`, `README.md`) into the page so `index.html` sits at the repo root. Commit to `main`.
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, Save.
4. Wait 1–2 minutes, then open <https://hamid-ahmadiasl.github.io>.

## Editing later
- **Photo:** save it as `assets/photo.jpg` and follow the comment in `index.html` (hero section) to replace the “HA” monogram.
- **Text/links:** edit `index.html` directly in GitHub (pencil icon) and commit; the site updates in a minute or two.
- **Preview locally:** run `python3 -m http.server` in this folder and open http://localhost:8000 (opening the file directly won't work because of ES modules).
- **Custom domain:** Settings → Pages → Custom domain (e.g. a Student Pack domain).
