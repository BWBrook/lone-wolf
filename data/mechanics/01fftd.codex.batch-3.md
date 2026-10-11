# Codex Book 1 batch 3

This completes Codex's allocation with its final 56 outstanding sections, starting
at 289. The turn began on clean `main` at `88a2998`, also verified against freshly
fetched `origin/main`. Claude's `ca4aaae` and `88a2998` are signed off in board #73,
message 1424; the two new shared-interface proposals are in message 1425.

Source: the local simpler-XHTML import, SHA-256
`bbcd7d2a6a52000acb37fede0e11cf4e499e495d91b94630f8b4e10667950615`.
All selected sections were read with their choices and combat records: 76 choice
ordinals and three combat records. No source prose, enemy names or illustrations
are copied into the rules. Kai Chronicles was not consulted. The original
independent encodings retain their hashes.

Sections:
`289,290,291,292,293,295,296,297,298,299,300,301,302,303,304,305,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,337,338,339,340,341,342,343,344,345,346,348`.

Fifty-four entries are supported. Two explicit hooks remain for Claude's engine
module, rather than granting unrestricted or free equipment:

- 291: `s291_chooseWeaponPickup`. Optional six-Gold pickup, and at most one
  weapon chosen from Spear and Dagger. The proposed `pickup.maxItems: 1` counts
  item copies taken from that offer, independently of Gold; dropping an item
  cannot reset the quota. The present hook prevents execution of the incomplete
  section, including its otherwise supported Gold effect.
- 307: `s307_exchangeWeapon`. One Meal is an independent pickup. An optional
  Warhammer requires exactly one currently carried weapon in exchange. The
  proposed `tradeWeapon` effect/action performs that exchange atomically, once,
  including with two weapons carried. Without a weapon it only permits decline.
  The hook also prevents execution of this incomplete section's Meal offer.

Both proposals require schema, engine, action availability, save/replay and UI
coverage before the hooks can be replaced. The whole hooked entries are omitted
from the local development book; their effects are never silently emptied.

Encoding details for review:

- 290, 305 and 346 offer Quarterstaff, Spear and Spear respectively. 315 offers
  six Gold plus `perfumedSoap`, a default Backpack item with no invented use.
  319 independently offers a Dagger and twenty Gold. `warhammer` uses the
  existing weapon-kind enum and is declared for the pending 307 exchange.
- 300 requires a Meal, with normal Hunting and hunger rules. 304 applies a
  two-point wound before the optional Gem pickup, matching 76.
- 308 and 313 apply one-point wounds; 320 and 343 apply two-point wounds.
  None is tagged as fatigue. 308 also gates ordinal 1 with Animal Kinship.
- 302 splits 0-2 / 3-9; 314 splits 0-6 / 7-9; 337 splits 0-4 / 5-9.
- 303 has reciprocal Camouflage/absence gates. 311 gates only ordinal 1 with
  Camouflage. 334 gates ordinals 1 and 2 with Sixth Sense and Camouflage;
  ordinal 3 remains open. 341 gates only ordinal 1 with Tracking.
- 339 uses combat 0, victory through ordinal 1, four-round timeout through
  ordinal 2 and immediate-or-later evasion through ordinal 3. Victory in round
  four precedes timeout. A later escape still requires its escape round.
- 340 uses a single combined enemy. 342 is Mindblast-immune and applies -2
  COMBAT SKILL only during that combat, unless Mindshield is possessed.
- 292, 309 and 327 rely on imported dead-end flags. 316 and 326 give no
  numeric loss; 326 does not consume the Key. 338 retains existing equipment
  and container state, without inventing replacement equipment or damage.

Review of Claude's preceding turn:

- `ca4aaae` correctly implements replacement Backpack, mandatory chosen single
  loss, carried-copy slot conditions, both new saved actions and engine version
  4. An additional synthetic actual JSON Save/replay probe passes at all twelve
  checkpoints, including `takeBackpack` and `loseItem`, rejects repeated
  replacement and loss bypass, and refuses an engine-3 save.
- All 61-110 entries and resolved 20/247/277 agree with the local source.
  62's found containers can replace a lost Backpack, inert otherwise; this is
  an accepted joint reading, not a new Barry ruling. It offers one Sword,
  three Meals and twenty-eight Gold. 94 combines its two Gold finds as sixteen.
  76 applies its wound first; 88/105 retain the open decline route. No numeric
  damage is invented in 61/80/84/87.

Verification: 149 permanent synthetic tests, both typechecks, build and diff
check pass. All prior entries, item definitions and setup are unchanged.

Local section-start smoke tests cover Claude's fifty new entries and three
resolved hooks (6,360 trials: 6,223 canonical first exits, 137 deaths), and these
54 supported entries (6,480 trials: 6,054 canonical first exits, 426 deaths).
Each section used 120 starts. No deadlocks or unfinished starts occurred, and
serialized JSON action logs replayed to identical states from the same
`startAt` character and seed. Inventory, ENDURANCE, fatigue and Gold limits held.
Targeted probes cover replacement and chosen-loss behavior in the real sections,
all ten values for each new random gate, discipline gates, mandatory Meal,
lethal wound boundaries, optional items/Gold, 339 immediate/later evasion and
victory-versus-timeout, and 342 with/without Mindblast and Mindshield. Of 150
339 fight traces, 43 won exactly in round four, five timed out, and 102 won
sooner, confirming both fourth-round outcomes.

Scripts and receipts remain in ignored `content/review/`. These are section-level
checks, not the final full-book playthrough harness or winning trace. The strict
loader deliberately rejects the two hooks and 56 missing entries; character
export remains unavailable for partial development books.

Totals: 294 encoded entries, 292 supported and two hooks. The remaining 56
unencoded sections belong to Claude's 111-175 allocation. Codex has no remaining
unencoded sections. After Claude's review, extensions and final batch, the
complete-book harness and reproducible winning trace remain to be done.
