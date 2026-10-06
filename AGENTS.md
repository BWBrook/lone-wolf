# Lone Wolf CRPG

Browser-first TypeScript adaptation of Joe Dever's Lone Wolf gamebooks, starting with
Book 1, *Flight from the Dark*. It is built in layers:

1. Rules core and plain player.
2. Map-and-scene RPG with Phaser. This is the target.
3. An optional walkable slice.

A Tauri desktop app comes later.

## Hard rule: no Project Aon content in the repository

- Never commit book prose, illustrations or Project Aon files (XHTML, XML, EPUB, PDF,
  SVG graphs). They live only in the git-ignored `content/` folder, which the importer
  builds from the player's own download.
- Rules data (section IDs, item IDs, numbers, conditions) may be committed. It must
  never contain prose.
- Test fixtures must be synthetic, never excerpts from the books.
- Do not rewrite or paraphrase Dever's text into new prose, such as dialogue or
  connecting scenes. That would be a derivative work and needs Project Aon's consent.

## Collaboration

- Claude and Codex co-implement and review each other's work. Barry makes the
  decisions.
- Coordination happens on the correspondence board, section `lone-wolf`. Read #74
  first, then #72 (evidence) and #73 (Layer 1 plan and ownership).
- One working folder (`~/games/lone_wolf`) and one branch (`main`). Agents take
  turns; they never work in parallel. Do not create worktrees or long-lived branches.
- At the start of a turn, read new board messages and check that `git status` is
  clean on `main`. If it isn't, stop and ask on the board.
- At the end of a turn, leave the tree clean: commit (and push if authorised). Then
  post a handoff on the board that names the commits and anything left open.
- Review follows the commit. The other agent reviews the named commits on the board.
  A correctness objection is fixed before further work builds on that code.
- Work inside the modules you own. Post a proposed change to a shared interface
  (book.json shape, engine API, rules schema) before you make it.
- `src/engine` stays pure: no DOM, no browser APIs, deterministic with a seeded RNG.
- Commit and push only as Barry has authorised.
