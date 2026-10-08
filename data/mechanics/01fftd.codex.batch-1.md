# Codex Book 1 batch 1

This adds the first 50 outstanding sections in Codex's 176–349 allocation,
following review of Claude's `9af5dd9` and `c4a325e`. The split and review are
recorded in board #73, message 1172. The original independent samples and all
existing reconciled entries are unchanged.

Source: the local simpler-XHTML import, SHA-256
`bbcd7d2a6a52000acb37fede0e11cf4e499e495d91b94630f8b4e10667950615`.
Every selected section was read with its choices and combat records. This batch
contains 79 source choice ordinals and four combat records; their text and enemy
statistics remain in the ignored import rather than being copied into rules.
Kai Chronicles was not consulted for this batch.

Sections:
`176,177,178,179,181,182,183,185,186,187,189,190,191,192,193,194,195,196,197,198,199,200,201,202,204,206,207,208,209,210,211,213,214,215,216,217,218,219,220,221,222,223,224,225,226,228,229,230,232,233`.

Forty-nine entries are supported. Section 214 has the explicit unsupported hook
`returnTo125South`: its return to 125 requires ordinal 2 there (target 27).
Message 1173 proposes an immediate-arrival condition, with synthetic acceptance
traces. This preserves both source transitions and avoids a permanent restriction
based merely on having visited 214. Claude owns the engine extension and 125.
The hook must stay until that behavior is implemented and reviewed.

Encoding details for review:

- 191 and 220 allow evasion through ordinal 2 without a minimum round count,
  using the existing front-matter evasion contract. After combat has begun, the
  existing engine applies an escape round.
- 193 offers an optional `scroll`, using the default Backpack slot because no
  Special Item designation is given. This is the only new item identifier.
- 197 offers the Short Sword and six gold optionally; 199 offers one Meal.
- 200, 211 and 222 gate ordinal 1 with Camouflage, Sixth Sense and Tracking,
  respectively; their ordinary alternatives remain available.
- 208 has one combined-enemy combat; 229 has a temporary -1 combat modifier,
  rather than a permanent base-stat change. 226 uses the 0–4 / 5–9 split.
- 185 and 219 rely on the imported dead-end flags. 181 specifies no numeric
  damage; 216 specifies no numeric player cost for healing another character.
  Neither receives an invented ENDURANCE effect. 228 narrates weapon use without
  an explicit possession test; its routes are not item-gated.

Local verification passed 5,880 section-start trials (120 per supported entry):
5,564 canonical first exits and 316 deaths, with no deadlocks or unfinished
starts. JSON-serialized action sequences replayed to identical states from the
same `startAt` character and seed. Separate checks covered the discipline gates,
immediate evasion, temporary combat modifier, unchanged baseline entries and
items, and intentional strict-loader rejection.

The local smoke script and receipt are in ignored `content/review/`. Its development
book excludes the entire unsupported 214 entry; it never replaces the hook with
an empty rule, executes 214 or treats unreviewed sections as qualified. These
checks are section-level verification, not a full-book winning trace or the final
seeded playthrough harness.

The rules file now has 87 entries: 86 supported, one unresolved hook, and 263
sections without entries. Strict loading and normal Book 1 play remain blocked
until the hook and all unreviewed sections are resolved. Reader mode remains
available. No Barry questionnaire is needed for this batch's mechanical proposal.
