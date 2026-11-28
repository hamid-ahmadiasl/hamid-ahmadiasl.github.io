# Hamid Ahmadi Asl — personal academic site

A static multi-page site (HTML + CSS + JS, no build step) for GitHub Pages. The homepage has a short hero and highlight cards; each section has its own page. Hero uses Three.js; scroll effects use GSAP — both load from a CDN. A chat assistant (`js/chat.js`) is included on every page.

```
index.html         Home — 3D hero, a short profile, and highlight cards
education.html     Academic background
research.html      Research and publications (papers and book)
patents.html       Patents
experience.html    Professional experience
skills.html        Technical skills
insights.html      Training & Insights: all posts + topic tabs; deep links like insights.html?topic=neural-networks
honors.html        Honors, awards, and language proficiency
contact.html       Email and social links
404.html           Friendly not-found page (used by GitHub Pages)
css/style.css
js/main.js         shared by every page: nav, GSAP scroll effects; loads posts and (homepage only) the hero and wallpaper motion
js/posts.js        shared post cards, topic filters, ?topic= deep links
js/hero.js         Three.js hero (procedural 3-bladed wind turbine, streamline ribbons, 3D neural network)
js/wallpaper.js    canvas overlay: light pulses flowing along the streamlines (homepage)
js/chat.js         site assistant widget (on every page)
data/posts.json    Training & Insights posts (loaded by js/posts.js)
files/             downloadable files for posts (PDF/PPTX…); keep files/.gitkeep
assets/wallpaper.svg  one continuous neural-network + CFD wallpaper fixed behind the page
assets/wallpaper-flow.json  streamline paths + vortex data used to animate the wallpaper
assets/            (optional: put photo.jpg here)
README.md
```

Old single-page addresses such as `https://hamid-ahmadiasl.github.io/#research` automatically redirect to the new pages (for example `research.html`).

## Publish on GitHub Pages
1. Create a **public** repository named exactly `hamid-ahmadiasl.github.io` (github.com → New), or open the existing one.
2. Open the repo → **Add file → Upload files**. Unzip `hamid-site-v2.zip` and drag **the contents** (`index.html`, the other `.html` pages, `css/`, `js/`, `assets/`, `data/`, `files/`, `README.md`) into the page so `index.html` sits at the repo root. Commit to `main`.
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, Save.
4. Wait 1–2 minutes, then open <https://hamid-ahmadiasl.github.io>. Hard-refresh with Ctrl+Shift+R if an older version is cached.

## Editing later
- **Hero tuning:** `js/hero.js` (particle counts, colours, bloom strength). Add `?noadapt` to the URL to disable the automatic quality scaling when testing.
- **Photo:** save it as `assets/photo.jpg` and follow the comment in `index.html` (hero section) to replace the monogram.
- **Text/links:** edit the relevant `.html` page directly in GitHub (pencil icon) and commit; the site updates in a minute or two.
- **Preview locally:** run `python3 -m http.server` in this folder and open http://localhost:8000 (opening the file directly won't work because of ES modules).
- **Custom domain:** Settings → Pages → Custom domain (e.g. a Student Pack domain).

## How to add a post (Training & Insights)
Posts live in `data/posts.json`. Add an object to the `"posts"` list (newest dates are shown first, and a new `topic` automatically gets its own tab and `insights.html?topic=<topic-slug>` link):

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
- Optional `watch: true` adds a **Watch on LinkedIn** button (CSS-only play badge) next to **View on LinkedIn**. Videos and thumbnails are not hosted on the site; visitors watch the clip on LinkedIn.
- For a download, upload the PDF/PPTX into the `files/` folder (GitHub → open `files` → Add file → Upload files) and set `"file": "files/<name>"`.
- Keep the JSON valid (commas between entries, double quotes). If the file is empty or missing, the section shows a friendly “coming soon” message.
- `fetch()` doesn't work from `file://`; preview locally with `python3 -m http.server`.

## Search engines
The site ships `robots.txt` and `sitemap.xml` (nine public pages; the 404 page is excluded and marked `noindex`). After uploading a new version:

1. Open [Google Search Console](https://search.google.com/search-console), add `https://hamid-ahmadiasl.github.io`, and verify the property. If Google gives you an HTML `<meta name="google-site-verification" …>` tag, it can be added to every page’s `<head>` — it is not in this zip yet, because the token has to come from your own Search Console account.
2. In Search Console, submit `https://hamid-ahmadiasl.github.io/sitemap.xml`.
3. Do the same in [Bing Webmaster Tools](https://www.bing.com/webmasters) (you can import the Google verification).
4. Add `https://hamid-ahmadiasl.github.io` as the website on your LinkedIn, Google Scholar and GitHub profiles.

Language variants (`?lang=it`, `?lang=fi`, `?lang=fa`) are applied in the browser only; the HTML source stays English. Alternate `hreflang` URLs are therefore not advertised; each page’s canonical URL is the English address without a `lang` query.
