# Lone Wolf CRPG

> **Status:** developed in the open as a working record. This is work in progress: contents may change, and nothing here is peer-reviewed unless stated.

An open-source, browser-first computer RPG presentation of Joe Dever's *Lone Wolf*
gamebooks, starting with Book 1, *Flight from the Dark*.

The rules core, importer and plain browser player support all 350 sections of
Book 1. Automated complete-game checks and browser save/export checks pass.
Layer 1 still awaits independent review of the playthrough harness and Barry's
human playtest before work moves to the Phaser presentation.

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
npm run import -- /path/to/01fftd.zip --svg /path/to/01fftd.svgz --rules data/mechanics/01fftd.json
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

Open the development server with `?book=01fftd` to play the imported book, or
`?book=01fftd&reader` to read it without applying rules. The default address opens
the synthetic demo. The player saves locally after each action; **Download save**
and **Load save** let you move that action log between sessions. A completed game
offers **Export character** for a later book. Saves use engine version 6 and
character exports use format version 2. Loading refuses a different engine,
source edition or rules fingerprint.

Permanent tests use synthetic content exclusively. Keep personally downloaded
book content, importer output and screenshots in `content/`; they must never be
committed. Content-free rules, native saves and structural validation traces may
be committed.

## Complete-game validation

After importing Book 1, run:

```sh
npm run validate:book -- --svg /path/to/01fftd.svgz
```

The harness checks the original source hash, freshly rebuilds `book.json`, loads
the complete rules and compares all 556 graph edges with Project Aon's SVG. If
the matching import receipt already contains a successful SVG comparison,
`--svg` may be omitted. Output defaults to ignored `content/validation/01fftd/`.

Every game starts at character creation and uses legal actions with separate
seeded engine and policy RNGs. It checks character invariants after every action
and replays each serialized save to the exact final state. Directed games cover
sections missed by random play, and each recorded coverage witness is rerun.

The committed [validation artifacts](data/validation/README.md) record 5,000
random games (351 wins), plus 4,516 directed games: all 350 sections were reached
from a new game. The seed-36 winning save has 77 actions and can be loaded into
the player. Section coverage does not establish exhaustive branch coverage, and
the 7.02% random-policy win rate is not a human difficulty estimate. The artifacts
contain IDs, numbers and engine events only, with hashes tying them to the tested
source, rules, engine and harness.

## Book content is not included

This repository contains no text or illustrations from the books. The game builds
its content locally from editions you download yourself from
[Project Aon](https://www.projectaon.org/), under the
[Project Aon License](https://www.projectaon.org/en/Main/License). Keep what
you import local: do not redistribute the generated `book.json`, builds that
contain it, or screenshots showing book text or illustrations.

This is an unofficial fan project. It is not affiliated with or endorsed by Project Aon,
Holmgard Press or the rights holders. *Lone Wolf* and related names belong to their
respective owners.

## Licence

Copyright (C) 2026 Barry W. Brook.

The code is licensed under the [GNU General Public License v3.0](LICENSE). That licence
covers this repository's code and data only. It grants no rights to *Lone Wolf* or
Magnamund content, which remains under its own terms.
