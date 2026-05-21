# Graft branding

Visual identity for the Graft Chrome extension and GitHub repository.

## Name and voice

| | |
|---|---|
| **Product name** | Graft |
| **Tagline** | Small fixes, grafted onto the web. |
| **Description** | A focused kit for grafting small fixes onto the web. |
| **Tone** | Calm, precise, no bloat — one tweak at a time. |

Use **Graft** (capital G) for the product. Avoid “Browser Tweaks” in user-facing copy.

## Logo

The mark is a split browser window with a green sprout — grafting small improvements onto existing pages.

| Asset | Path | Use |
|-------|------|-----|
| Master artwork | `src/assets/icons/graft-source.png` | Reference / social |
| Extension icons | `src/assets/icons/graft-{16,32,48,128,256}.png` | Chrome toolbar, manifest |
| Repo logo | `.github/brand/logo.png` | README |
| Social preview | `.github/brand/social-preview.png` | GitHub repo social card |

**GitHub social preview:** use `.github/brand/social-preview.png` (1280×640 recommended; current asset is the master logo on navy).

1. **Settings UI:** Repo → **Settings** → **General** → **Social preview** → upload the file.
2. **CLI (if supported on your account):**
   ```bash
   gh api --method POST -H "Accept: application/vnd.github+json" \
     repos/itsasheruwu/graft/social-preview \
     -F "image=@.github/brand/social-preview.png"
   ```
   If the API returns 404, use the Settings UI — not all accounts expose this endpoint.

## Color

Derived from the logo:

| Token | Role | Approx. |
|-------|------|---------|
| `--graft-navy` | Deep background / theme color | `#0f1729` |
| `--graft-green` | Accent, active states (dark UI) | Lime sprout |
| `--graft-glow` | Icon ring, subtle highlights | Pale blue-white |

CSS variables live in `src/index.css`. Tailwind utilities: `text-graft-green`, `ring-graft-glow/35`, etc.

## Typography

Extension UI uses **Geist Variable** (`@fontsource-variable/geist`) via `src/index.css`.

## In-app usage

Shared header: `src/components/brand/graft-brand.tsx`

- **Popup** — compact logo + wordmark + optional actions
- **Options** — full header + tagline
- **Hidden elements** — `Graft / Hidden elements` with page description

Extension HTML pages include favicons and `theme-color: #0f1729`.

## Icons in new surfaces

When adding a page or doc:

1. Import `GraftBrand` or reuse manifest icons from `src/assets/icons/`.
2. Keep the green accent sparingly — status, primary actions in dark mode, logo ring.
3. Do not recolor or distort the sprout mark.
