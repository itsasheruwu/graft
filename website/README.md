# Graft website

The standalone, dependency-free marketing site published at https://itsasheruwu.github.io/graft/.

Preview from the repository root:

```sh
python3 -m http.server 4178 --directory website
```

Open http://localhost:4178. No extension APIs or build step are needed. The browser illustration is an interactive demonstration, not a live extension instance. It never changes the visitor's browser settings or plays audio.

`pages.yml` publishes only this directory when website changes reach `main`. Extension builds remain independent. Use relative asset URLs to support the `/graft/` project path. Keep the toolkit and installation copy aligned with what is actually available in the public repository; uncommitted companion features must not be advertised as downloads.

The Geist font is self-hosted; its license is in `assets/FONT-LICENSE.txt`. The Graft mark and social image reuse the repository's brand assets. The landscape and feature illustrations are original inline SVG/CSS. The site makes no third-party font, analytics, or API requests.

Before publishing, check desktop and mobile layouts, keyboard operation, the three preview switches, reset, expandable toolkit/FAQ rows, copy commands (including clipboard-denied fallback), internal anchors, local assets, and reduced-motion behavior.
