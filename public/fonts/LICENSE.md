# Fonts

Every face here is licensed under the SIL Open Font License 1.1, which permits
bundling and self-hosting. Copies are kept in the repo rather than loaded from a
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

**Nothing in this repo modifies a font.** Each file is the distributor's own web
build, byte for byte:

- Andika and Playwrite US Trad are what `fonts.googleapis.com/css2` resolves to
  for those families — Andika's `latin` block, and Playwrite's single block
  (Google ships it unsplit).
- OpenDyslexic is `@fontsource/opendyslexic@5.3.0`, which builds from the
  author's repository above. It is the whole font at 113KB rather than a Latin
  subset, and that is deliberate: its licence reserves the name OpenDyslexic,
  and under the OFL a subset is a Modified Version that may not keep a reserved
  name (OFL-FAQ 2.6). Andika's and Lilita One's names are reserved too, which is
  the other half of the same rule — we redistribute, we don't re-cut.

To check a file against its source, compare SHA-256 with the URL in the table's
specimen page. As of writing:

```
50841fc9db96758f504a1776c700a585a774d172ac172e97b77fff5b75deff7b  andika-latin-400.woff2
382386162d3fd5d5f4b9968d3a291c7e89a4d3b818bf0fd94c29cbcd2a93ead1  playwrite-us-trad-400.woff2
f007004af3cda5d8076e57c943f8cc8d00a0da25988b1ae1048683d60e7cac1a  opendyslexic-latin-400.woff2
```

## Notices

The OFL asks that the copyright notice travel with the files. Verbatim from each
project's own `OFL.txt`:

- Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font
  Name Lilita
- Copyright 2014 The Nunito Project Authors
  (https://github.com/googlefonts/nunito)
- Copyright 2016 The Space Mono Project Authors
  (https://github.com/googlefonts/spacemono)
- Copyright (c) 2004-2022 SIL International (http://www.sil.org/) with Reserved
  Font Names "Andika" and "SIL".
- Copyright 2023 The Playwrite Project Authors
  (https://github.com/TypeTogether/Playwrite)
- Copyright (c) 2019-07-29, Abbie Gonzalez
  (https://abbiecod.es|support@abbiecod.es), with Reserved Font Name
  OpenDyslexic

Full licence text: https://openfontlicense.org/open-font-license-official-text/
