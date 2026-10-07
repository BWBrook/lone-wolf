# Codex sample encoding

This records the frozen 40-unit exercise, not an agreed or playable Book 1 rules
file. The player does not load `01fftd.codex.json`.

- Source: the player's local XHTML-simple download, SHA-256
  `bbcd7d2a6a52000acb37fede0e11cf4e499e495d91b94630f8b4e10667950615`.
- Sample: `01fftd.sample.json`, frozen at `3ff447d`; three setup units and all
  37 selected numbered sections. Every selected choice ordinal (63) and combat
  index (22) is accounted for, including all seven selected multi-combat sections.
- Baseline: the rules schema and engine semantics at `9034149`, with the
  structural-only loader copy from `da32eba`.
- Encoding SHA-256:
  `49647ab93cee095f71bd0326ee14aafc6e1a536789fb63c36f76d4af6b6e1850`.
- Claude's encoding and its commit diff remained unopened through completion of
  this file. Kai Chronicles mechanics remained unopened. Setup is not a blind
  comparison because it overlaps prior engine/demo review. Barry's forwarded
  handoff also disclosed Claude's proposed slots for vordakGem, goldenKey,
  tinderbox, torch and crystalStarPendant; do not count agreement on those slots
  as independent evidence.

Validation passes the strict `BookRules` schema. Against the local imported book,
`buildEngineBook(..., { allowUnreviewed: true })` rejects exactly the 14 named
hooks and no broken references. Removing hooks in a temporary in-memory copy
passes structural validation; that check does not approve the omitted mechanics.
The other 313 sections remain unreviewed.

| Section | Required capability recorded by the hook |
| --- | --- |
| 21 | Conditional successive draws, stage-specific choices and death |
| 113 | Apply the item's +3 restoration when consumed by a meal prompt |
| 144 | Select one loss by inventory category, with weapon fallback |
| 147 | First-arrival and prior-section-dependent choice destinations |
| 162 | Whole-category losses and backpack-container absence |
| 184 | Optional +40 gold before the meal prompt |
| 188 | Conditional whole-backpack loss and container absence |
| 205 | Whole-category losses before the random draw |
| 212 | Absolute full ENDURANCE restoration |
| 227 | Track combat damage and resolve the corresponding branch |
| 231 | Stop unresolved combat after four rounds |
| 236 | Permanent -1 to character COMBAT SKILL |
| 263 | Optional +3 gold |
| 294 | Whole-category losses and backpack-container absence |

The hooks and their section notes describe requirements and proposals; they are
not implemented extensions. In particular, the 113 hook marks a gap in `eat()`:
`meal: true` plus `use.endurance: 3` already expresses the item's properties,
but the current meal path does not apply that restoration. Acquisition itself
must not restore ENDURANCE.

For 347, eight offered torch copies cover the engine's eight-slot backpack
capacity. Each is optional and uses one slot; this supports the footnote's
multiple pickups without introducing an unlimited-supply interface. No torch
consumption or item transfer action currently exists.

Questions to reconcile after the two encodings are released:

- 166: whether the -4 loss is Healing-restorable or fatigue. This encoding leaves
  it untagged and unconditional; the source does not explicitly grant a
  mindshield exemption here.
- 349: crystalStarPendant is provisionally backpack under the default item rule;
  its worn position suggests special. The pickup remains optional.
- 227: whether positive combat damage transfers immediately or only after
  victory. The note proposes the first surviving damaged round but marks the
  timing unresolved. Pre-existing wounds must not determine this branch.
- 212: whether full restoration targets the armor-adjusted maximum or the base
  starting score. The note provisionally uses the current maximum.
- 144: who chooses the stolen item, and how container absence affects the
  backpack-first rule. No deterministic selection policy is silently adopted.

Source text, art and downloaded files stay in ignored `content/`; this commit
contains only rule identifiers, numeric mechanics and our technical annotations.
