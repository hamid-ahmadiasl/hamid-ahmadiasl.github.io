# Hamid Ahmadi Asl — personal academic site

A static site (HTML + CSS + JS, no build step): the homepage plus a Training & Insights page. Hero uses Three.js; scroll effects use GSAP — both load from a CDN.

```
index.html         homepage (3D hero, sections, preview of the 3 latest posts)
insights.html      Training & Insights page: all posts + topic tabs; deep links like insights.html?topic=neural-networks
css/style.css
js/main.js         shared by both pages: nav, GSAP scroll effects, wallpaper motion; loads posts + (homepage only) the hero
js/posts.js        shared post cards, topic filters, ?topic= deep links, homepage preview
js/hero.js         Three.js hero (procedural 3-bladed wind turbine, streamline ribbons through the rotor into a helical wake with tip vortices, breathing 3D neural network, half-res bloom)
data/posts.json    Training & Insights posts (loaded by js/posts.js)
files/             downloadable files for posts (PDF/PPTX…); keep files/.gitkeep
assets/wallpaper.svg  one continuous neural-network + CFD wallpaper fixed behind the page
assets/wallpaper-flow.json  streamline paths + vortex data used to animate the wallpaper
js/wallpaper.js    canvas overlay: light pulses flowing along the streamlines, slowly rotating vortices
assets/            (optional: put photo.jpg here)
README.md
```

## Publish on GitHub Pages
1. Create a **public** repository named exactly `hamid-ahmadiasl.github.io` (github.com → New).
2. Open the repo → **Add file → Upload files**. Unzip `hamid-site.zip` and drag **the contents** (`index.html`, `insights.html`, `css/`, `js/`, `assets/`, `data/`, `files/`, `README.md`) into the page so `index.html` sits at the repo root. Commit to `main`.
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, Save.
4. Wait 1–2 minutes, then open <https://hamid-ahmadiasl.github.io>.

## Editing later
- **Hero tuning:** `js/hero.js` (particle counts, colours, bloom strength). Add `?noadapt` to the URL to disable the automatic quality scaling when testing.
- **Photo:** save it as `assets/photo.jpg` and follow the comment in `index.html` (hero section) to replace the “HA” monogram.
- **Text/links:** edit `index.html` directly in GitHub (pencil icon) and commit; the site updates in a minute or two.
- **Preview locally:** run `python3 -m http.server` in this folder and open http://localhost:8000 (opening the file directly won't work because of ES modules).
- **Custom domain:** Settings → Pages → Custom domain (e.g. a Student Pack domain).

## How to add a post (Training & Insights)
Posts live in `data/posts.json`. Add an object to the `"posts"` list (newest dates are shown first; the 3 newest also appear on the homepage, and a new `topic` automatically gets its own tab and `insights.html?topic=<topic-slug>` link):

```json
{
  "title": "Physics-Informed Neural Networks (PINNs)",
  "topic": "Neural Networks",
  "description": "One or two sentences about the post.",
  "date": "2026-11-30",
  "url": "https://lnkd.in/p/xxxxxxx",
  "file": "files/pinns-guide.pdf"
}
```

- `title` is required. `topic` creates/joins a filter tab automatically (tabs are generated from the topics in the file).
- `url` shows a **View on LinkedIn** button; `file` shows a **Download** button. Use either or both.
- For a download, upload the PDF/PPTX into the `files/` folder (GitHub → open `files` → Add file → Upload files) and set `"file": "files/<name>"`.
- Keep the JSON valid (commas between entries, double quotes). If the file is empty or missing, the section shows a friendly “coming soon” message.
- `fetch()` doesn't work from `file://`; preview locally with `python3 -m http.server`.
