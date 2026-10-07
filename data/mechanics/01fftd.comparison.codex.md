# Book 1 sample comparison: Codex review

Both encodings were committed and reported complete on the board before this
comparison began: Claude `dab6744`, Codex `cc854b5` (completion post 1114).
Neither original encoding is changed by this report. Claude must review these
findings before they become agreed corrections or a schema plan.

| Evidence | SHA-256 |
| --- | --- |
| Local book source | `bbcd7d2a6a52000acb37fede0e11cf4e499e495d91b94630f8b4e10667950615` |
| Claude encoding | `378d912a71353d7d6b8e7601fd9f2076c98533d80151e06fafb34dc6d0fde344` |
| Codex encoding | `49647ab93cee095f71bd0326ee14aafc6e1a536789fb63c36f76d4af6b6e1850` |

Setup matches after aliasing `mapOfSommerlund` to `map`. It is a fidelity re-check,
not a blind agreement result. `laumspur` and `laumspurMeal` are also identifier
aliases with the same item definition.

Thirty of 37 numbered units have matching normalized encoded contracts. This
normalization removes technical notes and empty unconditional choice records,
renames item aliases and hook names, preserves effect order and nonempty choice
conditions, and includes the definitions of items referenced by each section.
Hook semantics were then read separately. This count is not a book-accuracy
estimate, a claim that hooks are implemented, or a strict independent-agreement
score: Barry's forwarded handoff disclosed five item-slot proposals, and some
matching hooks still have a policy question (notably 144).

Matching normalized units:
`1,9,12,15,17,21,23,29,36,37,112,136,138,144,162,180,184,188,203,205,212,253,255,260,263,294,306,336,347,350`.

| Unit | Difference | Codex assessment for Claude's review |
| --- | --- | --- |
| 113 | Codex has a runtime-gap hook; Claude records gaps only in the note. | Both item definitions are correct. Meal consumption must restore 3, and the player must be able to select the meal. Claude also caught a gap my hook note did not cover: herb use must be permitted before a pending combat, while the current `canUse()` applies the potion restriction to every usable item. Preserve the original snapshot; include all these requirements in the extension. |
| 147 | Codex has a first-arrival destination hook; Claude says targets remain unchanged. | The local footnote expressly swaps ordinal destinations on first arrival from 42: ordinal 1 goes to 28 and ordinal 2 to 42. Normal imported targets are 42 and 28. This needs a correction, not a new fidelity ruling. Prior section and first-visit state are both required. |
| 166 | Codex allows Healing to restore the unconditional -4; Claude tags it fatigue. | Genuine classification disagreement under Barry's adopted wounds-only policy. Neither grants a Mindshield exemption. Put both readings to Barry; do not decide by majority vote. |
| 227 | Codex installs the damage monitor before combat and proposes an immediate branch; Claude checks loss after victory. | Both correctly require actual combat damage history. Timing remains to reconcile. Target 271 is terminal, so any positive damage ends this route either way; timing still changes the combat trace. Prior wounds and current/max ENDURANCE comparison must never substitute for combat loss. |
| 231 | Claude additionally writes a rounds<=4 gate for ordinal 1. | The notes agree on victory within four rounds, timeout with the enemy alive, and evasion after two rounds. The gate is redundant with a correctly implemented outcome hook, but is a strict payload difference. Test victory on round 4 versus a surviving enemy on round 4. |
| 236 | Codex orders -6, permanent CS loss, then one-Gem removal; Claude removes the Gem first. | Prefer Claude's order for the reconciled rule: one-Gem removal must occur before a potentially lethal ENDURANCE loss. Both specify permanent CS -1 and removal of only one copy. This is a correction to my proposed effect ordering; the sealed sample stays unchanged. |
| 349 | Codex uses backpack; Claude uses special. Both offer an optional pickup. | Broader primary evidence now supports special: the Handbook's Grand Master starting inventory explicitly includes crystalStarPendant among carryable Special Items. Recommend Claude's slot, citing that evidence rather than only the worn location or a third-party implementation. |

The [Readers' Handbook](https://www.projectaon.org/en/ReadersHandbook/AllSinglePage)
provides the broader Special Item evidence for 349 and explains the wounds versus
hunger/fatigue distinction for Healing. It does not explicitly classify the loss
in 166. The current [Book 1 errata](https://www.projectaon.org/en/Errata/FlightFromTheDark)
was checked as well. Neither check settles 227's transition timing. These are
attributed sources, not automatic authority to overrule Barry's policy.

## Third opinion, consulted after the two snapshots

Kai Chronicles was inspected at pinned commit
[`b0e8cac6cfb963672d52951bae94a0bc62469763`](https://github.com/tonib/kaichronicles/commit/b0e8cac6cfb963672d52951bae94a0bc62469763).
Only observations from its data and relevant interpreter functions are claimed;
its application was not built or run.

- [Book 1 mechanics](https://github.com/tonib/kaichronicles/blob/b0e8cac6cfb963672d52951bae94a0bc62469763/www/data/mechanics-1.xml): supports staged draws in 21, post-combat damage testing in 227, four-round timeout in 231, and Gem removal before damage in 236.
- The same file has no first-arrival target override in 147, automatically adds gold in 184/263, offers one torch in 347, and automatically picks the Pendant in 349. These differ from the current source/footnotes or our optional-acquisition requirement.
- It removes the backpack container in 205; both independent notes instead distinguish loss of contents from explicit container loss. Reconcile this against the source, not the implementation.
- Its 9 entry disables target 236 without a Gem but contains no reciprocal target-292 gate. Its 37 entry has no meal instruction. Both our encodings guard both 9 branches and explicitly require the 37 meal.
- [Object definitions](https://github.com/tonib/kaichronicles/blob/b0e8cac6cfb963672d52951bae94a0bc62469763/www/data/objects.xml) classify the Pendant as special and the Laumspur item as a healing meal.
- [Meal handling](https://github.com/tonib/kaichronicles/blob/b0e8cac6cfb963672d52951bae94a0bc62469763/src/ts/controller/mechanics/mealMechanics.ts) lets the player select a meal object and applies its healing use. Its generic Healing path does not implement our wounds/fatigue separation.

Downloaded reference files stay in ignored `content/reference/`; they are not
committed. The inspected XML hashes are:

| File | SHA-256 |
| --- | --- |
| mechanics-1.xml | `d9a148b059451babd25cacafe3943b4f76de88317dd4173ec9819eedaa5c168b` |
| objects.xml | `eb4334af7bfab391e21138b79a1438e49caaca8fc1a4f8ece3d8eca27fc7872b` |

## Required traces before these mechanics qualify

These are acceptance cases for the eventual engine changes, not tests claimed as
already run. Fixtures must remain synthetic.

| Mechanic | Required cases |
| --- | --- |
| 21 staged draws | First draw 5 succeeds with one draw; 4 then 8 succeeds with two; 4,7,9 succeeds with three; 4,7,8 is death. Offer exactly the correct ordinal even when two stages share a destination. |
| 113 healing meals/use | Select ordinary versus healing meal; healing meal satisfies hunger and restores 3; use outside a meal does not prepay hunger; herb use before combat is available; potion restriction remains enforced; preserve capacity and ENDURANCE bounds. |
| 144 theft | Nonempty backpack removes one selected copy; empty or absent backpack falls back to weapon; neither available removes nothing. Selection policy needs agreement before its test oracle is fixed. |
| 147 contextual choices | First arrival from 42 swaps destinations; first arrival from 28 keeps them; later arrival from 42 keeps normal targets; merely visiting 42 earlier does not trigger the swap. Keep displayed source/footnote and actual destination consistent. |
| Bulk losses | Duplicated backpack items and multiple weapons all clear; retained gold/special items remain; conditional 188 loss applies only for 0..6; container loss prevents further backpack pickups until replacement; distinguish 205's container policy. |
| Optional gold | Accept and decline both +3 and +40; cap at 50; in 184 acquired meals are available before resolving hunger. |
| 212 full restoration | Restore from wounds, fatigue and a mixture; clear fatigue; retain armor's maximum bonus under the proposed current-maximum reading. Both notes support that reading; seek a ruling only if contrary evidence survives review. |
| 227 damage branch | Pre-existing wounds with zero new loss use the no-damage branch; any new loss uses 271; loss and enemy defeat on the same round follow the agreed ordering; zero ENDURANCE remains death. |
| 231 limited combat | Victory in rounds 1 and 4; enemy alive after round 4; evasion unavailable before round 2 and available afterward; hero death at the limit; never offer both win and timeout branches. |
| 236 persistent loss | Two Gems become one; absent Gem does not remove another item; CS decreases once on entry and persists in character export; lethal -6 preserves the agreed item-loss ordering. |
| 347/349 inventory | Up to eight torch copies, one slot each, with partial/full packs and optional decline; optional Pendant pickup with the agreed slot and its later-book identity retained. |

The proposed readiness work therefore includes pending meal selection and
per-item use timing, contextual choice destinations, loss-by-category/container
state, optional gold, full restoration, combat outcome/history/limits, and
permanent CS changes. Post the concrete schema/API proposal on the board before
implementing it. Keep the remaining 313 sections unsplit until corrections and
fidelity rulings are recorded, as agreed in board post 1096.

The separate player review in board post 1113 requires suppressing reader-mode
character export and honoring an explicit reader flag when rules exist. Those
repairs belong to Claude's player/engine turn.
