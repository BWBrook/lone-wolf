# Lone Wolf CRPG

An open-source, browser-first computer RPG presentation of Joe Dever's *Lone Wolf*
gamebooks, starting with Book 1, *Flight from the Dark*.

Layer 1 is in development. The plain browser player runs a synthetic demo. Book 1
can be imported locally and checked against its section graph; the real-book
player adapter and complete rules encoding are still to come.

## Local development

Use Node.js 26 and npm:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Import your own Book 1 **simpler XHTML** download from Project Aon (a local ZIP,
an HTTP(S) download URL, or its extracted `01fftd.htm`):

```sh
npm run import -- /path/to/01fftd.zip
npm run import -- /path/to/01fftd.zip --svg /path/to/01fftd.svgz
npm run check:graph -- content/01fftd/book.json --svg /path/to/01fftd.svgz
```

The optional SVG comparison counts repeated edges separately. Without `--svg`,
its result is `not-run`. Both commands also accept `--rules /path/to/rules.json`
to validate a complete rules encoding through the engine's strict loader; partial
sample encodings and unresolved hooks intentionally fail that check.

The importer writes `source.htm`, `book.json` and `import-receipt.json` under
ignored `content/01fftd/`. It retains the original source bytes, derives the save
edition hash from those bytes, and records archive/output hashes and structural
checks in the receipt. Re-importing identical input with the same check options is
a no-op. Invalid input or failed checks preserve the existing import. Publication
uses a staged directory and restores the previous directory if replacement fails.
Other files already held in the book folder are retained.

Only Book 1's simpler-XHTML format is supported. Downloads are limited to 32 MiB
and 15 seconds; extracted HTML and decoded SVG are limited to 8 MiB. ZIP members
are read in memory, and no artwork is downloaded. The generated JSON contains
plain text, never executable source markup. Original appendices and notices remain
in `source.htm`; the plain player does not reproduce their complex layout.

Permanent tests use synthetic content exclusively. Keep all personally downloaded
book content and generated files in `content/`; they must never be committed.

## Book content is not included

This repository contains no text or illustrations from the books. The game builds
its content locally from editions you download yourself from
[Project Aon](https://www.projectaon.org/), under the
[Project Aon License](https://www.projectaon.org/en/Main/License).

This is an unofficial fan project. It is not affiliated with or endorsed by Project Aon,
Holmgard Press or the rights holders. *Lone Wolf* and related names belong to their
respective owners.

## Licence

Copyright (C) 2026 Barry W. Brook.

The code is licensed under the [GNU General Public License v3.0](LICENSE). That licence
covers this repository's code and data only. It grants no rights to *Lone Wolf* or
Magnamund content, which remains under its own terms.
