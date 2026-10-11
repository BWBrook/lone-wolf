# Book 1 validation artifacts

These files contain no book prose or artwork:

- `01fftd.winning-save.json`: native engine-6 action log, seed 36, 77 actions,
  ending at section 350. Load it through the player's **Load save** control.
- `01fftd.winning-trace.json`: each action's engine events, character numbers and
  state hash, plus the final format-2 character export.
- `01fftd.playthrough-receipt.json`: source/rules/code hashes, graph checks,
  campaign configuration, coverage and the directed first-visit witnesses.

The source edition SHA-256 is
`bbcd7d2a6a52000acb37fede0e11cf4e499e495d91b94630f8b4e10667950615`.
Its local source and import receipt remain in ignored `content/01fftd/`.
The live SVG comparison used compressed-file SHA-256
`25c191ccb29e4204ecdc263702e6edfa779e947ea60206f2beae3cf28dbf1c7d`.
SVG file bytes can change while its section edges stay the same; exact artifact
verification requires the recorded bytes, held locally at
`content/review/01fftd.svgz` for this run.

Reproduce and compare all three committed artifacts without rewriting them:

```sh
npm run validate:book -- --svg content/review/01fftd.svgz --out data/validation --verify
```

To generate a new qualification with a different source, graph or code revision,
use the default ignored output directory first. `--verify` compares exact bytes,
including the code hashes; changes invalidate the old qualification.

The default campaign runs engine seeds 0–4999 with an independent seeded action
policy. The policy takes offered items, gold, replacements, trades and usable
potions, avoids incidental drops and otherwise selects a legal progress action.
It produced 351 wins and 4,649 deaths, reaching 329 sections. This 7.02% win rate
describes that policy, not human play.

Directed attempts use structural shortest distances only as routing hints;
conditions, combat and the engine RNG still determine the outcome. A second
legal setup selects Healing, Mindshield, Hunting, Tracking and Camouflage for
rare surviving timeout routes. The 4,516 directed games produced 1,661 wins and
2,855 deaths. Their 21 first-visit witnesses bring total coverage to all 350
sections. All 9,516 games terminated, passed per-action invariants and matched
their serialized save replay. No character, RNG or section state was injected.

The receipt lists 544 distinct explicit `choose` actions. Automatic section
transitions are also checked but do not count as `choose` actions. Reaching every
section is not proof of every condition, random outcome or mechanic combination.
The synthetic regression suite separately exercises limited pickups, atomic
weapon trades, combat bonuses and save-version refusal.

Independent harness review and Barry's human playtest remain Layer 1 gates.
