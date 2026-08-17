# Fonts

Every face here is licensed under the SIL Open Font License 1.1, which permits
bundling and self-hosting. The licence text travels with the files it covers, in
`OFL.txt` beside this one. Copies are kept in the repo rather than loaded from a
CDN on purpose — see the note at the top of `src/styles/fonts.css`.

## The site

| File                         | Family     | Designer                                  | Source                                       |
| ---------------------------- | ---------- | ----------------------------------------- | -------------------------------------------- |
| `lilita-one-latin-400.woff2` | Lilita One | Juan Pablo del Peral (Huerta Tipográfica) | https://fonts.google.com/specimen/Lilita+One |
| `nunito-latin-var.woff2`     | Nunito     | Vernon Adams, Cyreal, Jacques Le Bailly   | https://fonts.google.com/specimen/Nunito     |
| `space-mono-latin-400.woff2` | Space Mono | Colophon Foundry                          | https://fonts.google.com/specimen/Space+Mono |
| `space-mono-latin-700.woff2` | Space Mono | Colophon Foundry                          | https://fonts.google.com/specimen/Space+Mono |

Latin subsets only. The `latin-ext` blocks would roughly double the bytes to
cover accented characters nothing on this site renders.

## The Print Shop

Three more, for worksheets. A `@font-face` is lazy, so a page that never draws a
glyph in one of these never fetches it — only a `.sheet` names them.

| File                           | Family            | Designer                                       | Source                                              |
| ------------------------------ | ----------------- | ---------------------------------------------- | --------------------------------------------------- |
| `andika-latin-400.woff2`       | Andika            | SIL International                              | https://fonts.google.com/specimen/Andika            |
| `playwrite-us-trad-400.woff2`  | Playwrite US Trad | TypeTogether (Veronika Burian, José Scaglione) | https://fonts.google.com/specimen/Playwrite+US+Trad |
| `opendyslexic-latin-400.woff2` | OpenDyslexic      | Abbie Gonzalez                                 | https://github.com/antijingoist/opendyslexic        |

Andika is the print face, Playwrite US Trad the cursive one and OpenDyslexic the
accessibility option; `src/styles/fonts.css` says why each was chosen and
`src/engine/sheets/faces.ts` holds the proportions measured out of these exact
files.

**Nothing in this repo modifies a font.** Every file is a distributor's own web
build, copied in byte for byte:

- Andika and Playwrite US Trad are what `fonts.googleapis.com/css2` resolves to
  for those families — Andika's `latin` block, and Playwrite's single block
  (Google ships it unsplit). Google's `latin` build of Andika is a cut of the
  family, 232 codepoints of several thousand, and its Lilita One above is the
  same. That subsetting is Google's, published upstream of this repo; the
  reserved names those two families carry are a question for whoever re-cuts
  one, and re-cutting is the thing we don't do.
- OpenDyslexic is `@fontsource/opendyslexic@5.3.0`. Fontsource builds from the
  author's repository above, and the woff2 conversion is theirs, not ours. Its
  `latin` is fontsource's package label for the only subset it ships for this
  family, which for OpenDyslexic is the whole font — 1586 codepoints, U+0020 to
  U+FB06, 113KB, the heaviest file on the site. It stays whole because cutting
  it down to the characters a worksheet uses would make this repo the one that
  built the font.

To check a file against its source, download the distributor's build and compare
digests. As of writing:

```
8d6cd0f298738a92ca9bf6e13f54a9191afd06ce04ea00ebbf24499c017191b7  lilita-one-latin-400.woff2
20fc9b6fc618e7c3c68d3ac750a2a5dfbceb8521675458d2cea580b5693e4798  nunito-latin-var.woff2
e0c8e616bda27642f4c3cebaecff6525d901e73afc8a227cbbb0f2af4810f300  space-mono-latin-400.woff2
af7cf6d2b897ec453acdcdacde4e9bcc8410718af5914de865b453e09f10eebc  space-mono-latin-700.woff2
50841fc9db96758f504a1776c700a585a774d172ac172e97b77fff5b75deff7b  andika-latin-400.woff2
382386162d3fd5d5f4b9968d3a291c7e89a4d3b818bf0fd94c29cbcd2a93ead1  playwrite-us-trad-400.woff2
f007004af3cda5d8076e57c943f8cc8d00a0da25988b1ae1048683d60e7cac1a  opendyslexic-latin-400.woff2
```

`faces.test.ts` checks every file in this directory against the list above, so a
font swapped for a different cut of the same family fails the suite rather than
quietly invalidating this page.

## Notices

The OFL asks that the copyright notice travel with the files. `OFL.txt` carries
the licence; these are the notices, quoted from the binaries themselves — the
`name` table's ID 0 of each file, as it reads there:

- `Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Names "Lilita One"`
- `Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)`
- `Copyright 2016 The Space Mono Project Authors (https://github.com/googlefonts/spacemono)`
  (both weights)
- `Copyright (c) 2004-2022 SIL International`
- `Copyright 2023 The Playwrite Project Authors (https://github.com/TypeTogether/Playwrite)`
- `Copyright © 2019 by Abbie Gonzalez. All rights reserved.`

Andika's is shorter than what its project publishes, because Google's web build
trims the `name` table; upstream's own `OFL.txt` reads:

```
Copyright (c) 2004-2026 SIL Global  (https://www.sil.org/)
with Reserved Font Names "Andika" and "SIL".
```

Only OpenDyslexic carries the licence inside the file, in `name` ID 13, under
this header:

```
Copyright (c) 2019-07-29, Abbie Gonzalez (https://abbiecod.es|support@abbiecod.es),
with Reserved Font Name OpenDyslexic.
Copyright (c) 12/2012 - 2019
```

The other six carry only `name` ID 14, a URL pointing at the OFL — which is
exactly why the text itself has to sit in `OFL.txt` here.

Full licence text: [`./OFL.txt`](./OFL.txt)
