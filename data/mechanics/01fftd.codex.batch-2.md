# Codex Book 1 batch 2

This adds the next 50 outstanding sections in Codex's allocation, starting at
234. The turn began on clean `main` at `c1e1b5b`. Review of Claude's `001f563`
and `c1e1b5b`, the 191 reconciliation, and the accepted 20 proposal are recorded
in board #73, message 1282. The subsequent interface proposal is message 1283.

Source: the local simpler-XHTML import, SHA-256
`bbcd7d2a6a52000acb37fede0e11cf4e499e495d91b94630f8b4e10667950615`.
All selected sections were read with their choices and combat records. The
batch has 70 source choice ordinals and two combat records. No source text,
enemy names or message contents are copied into the rules. Kai Chronicles was
not consulted for this batch. The original independent encodings are unchanged.

Sections:
`234,235,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,254,256,257,258,259,261,262,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288`.

Forty-eight entries are supported. Two explicit hooks remain pending:

- 247: `s247_backpackOffer`. Ordinal 1 needs a carried Backpack Item; the offer
  fails at 159 without taking an item. Message 1283 proposes a slot-count
  condition, avoiding a list of every current and future Backpack item ID.
- 277: `s277_chooseBrokenWeapon`. Exactly one weapon is lost, with the player
  choosing which when the kinds differ. Message 1283 proposes a mandatory
  single-item loss effect and selection action. The Backpack and its contents
  are recovered, so this is not container loss. Existing Backpack state is
  preserved; no replacement is invented for an already absent container.

The hooks must remain until those mechanics are implemented and reviewed.
Claude owns the engine extensions; his replacement-Backpack hook in 20 also
remains. The bounded `pickup.backpack` / `takeBackpack` proposal is accepted in
1282, including schema, one-use offer, save and UI requirements.

Encoding details for review:

- 235 requires a Meal and gates ordinal 1 with Tracking. 242 requires Mindshield
  for ordinal 1 and its absence for ordinal 2; 272 similarly distinguishes
  Tracking possession and absence.
- 237 and 275 use the 0–4 / 5–9 split; 279 uses 0–6 / 7–9.
- 243 offers a Mace. 267 independently offers `message` and Dagger; `message`
  is the sole new item ID, distinct from 193's `scroll`, and uses the default
  Backpack slot because no Special Item designation is given.
- 258 clears weapons and loses the Backpack container and contents. 274 loses
  weapons only. 269 gives an automatic ten-Gold reward. 276 applies its
  mandatory one-point wound before continuing, without a fatigue tag.
- 246 adds the ferry combat without charging again after 46. 262 adds no
  charge: the ten-Gold payment already occurs at 12, its only incoming route.
- 283 grants +2 for the first round, then -2 without Mindshield in later rounds.
  Modifiers are evaluated before the current round is counted: initially
  `rounds` is null, so `not(rounds >= 1)` identifies round 1. Base COMBAT SKILL
  stays unchanged and no unstated Mindblast immunity is added.
- 234, 259, 271 and 286 rely on imported dead-end flags. 268 and 284 specify no
  numeric ENDURANCE change. 282's narrative props are not Action Chart gains.

Review corrections in preceding commit `7535a7b`:

- 191 now requires one completed round before evasion, following Claude's
  reading in 1175. Its escape round follows that first round. 220 still permits
  immediate evasion without a draw. This supersedes batch 1's original timing
  assertion; its historical smoke results describe the original commit.
- The two-Gold payment in 46 remains once on accepting the priced offer. This
  is an accepted joint reading, not a new Barry ruling. The 43/125 annotations
  now describe numeric mechanics without short quotations from the source.

Verification: all 143 permanent synthetic tests, both typechecks and build pass.
Additional local checks exercised real 214 routing, serialized Save/replay with
`arrivedFrom`, ferry-payment boundaries, and both 191/220 evasion timings.

Local section-start smoke tests independently checked Claude's 50 supported
entries (6,000 trials: 5,602 canonical first exits, 398 deaths) and these 48
supported entries (5,760 trials: 5,232 canonical first exits, 528 deaths).
Each entry used 120 starts. No deadlocks or unfinished starts occurred, and
JSON action logs replayed to identical states from the same `startAt` character
and seed. Inventory, ENDURANCE, fatigue and gold limits held. Targeted checks
covered 283 with and without Mindblast/Mindshield, exact fee accounting, bulk
losses, lethal 276 damage, capped reward, discipline/random gates and optional
message pickup.

The smoke script and receipt stay in ignored `content/review/`. Its development
book excludes the entire entries for 20, 247 and 277; it does not empty their
hooks or execute them. Existing supported entries/items and setup are unchanged
by this batch. The strict loader intentionally rejects all three hooks and the
162 missing entries. These are section-level checks, not the final full-book
playthrough harness or a winning trace.

Totals: 188 encoded entries, comprising 185 supported entries and three hooks;
162 sections still have no entry. Codex's next outstanding section is 289.
No Barry decision questionnaire was needed for the mutually accepted readings
or these mechanical interface proposals.
