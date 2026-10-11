import { describe, expect, it } from 'vitest';
import { apply, availableActions, buildEngineBook, newGame, newSave, replay, startAt, type Action } from '../../src/engine';
import { assertInvariants, chooser, distancesTo, progressAction, runCampaign, runGame, traceSave } from '../../src/validation/playthrough';
import { book, character, imported, rules } from '../engine/fixture';

describe('complete-game validation', () => {
  it('starts at character creation, finishes and records a reproducible native save and trace', () => {
    const result=runCampaign(book,{games:200,directedAttempts:4,recoveryAttempts:0});
    expect(result.random.wins+result.random.deaths).toBe(200);
    const run=result.winning;
    expect(run.save.actions[0]).toEqual({type:'rollStats'});
    expect(run.sections[0]).toBe(1);
    expect(replay(book,JSON.parse(JSON.stringify(run.save)))).toEqual(run.state);
    expect(traceSave(book,run.save).state).toEqual(run.state);
    expect(traceSave(book,run.save).steps).toHaveLength(run.save.actions.length);
    expect(runGame(book,run.seed,{policySeed:run.policySeed})).toEqual(run);
    // Unreachable/gated sections are reported honestly, not filled by startAt.
    expect(result.unvisited).toContain(11);
    expect(result.sections).not.toContain(11);
    for(const witness of result.directed.witnesses) {
      expect(runGame(book,witness.seed,{target:witness.routingTarget,policySeed:witness.policySeed}).sections).toContain(witness.section);
    }
  });

  it('refuses incomplete rules, unfinished games, invalid configurations and broken invariants', () => {
    expect(()=>runGame({...book,unreviewed:[1]},1)).toThrow(/complete rules/);
    expect(()=>runGame(book,1,{maxSteps:1})).toThrow(/step limit/);
    expect(()=>runCampaign(book,{games:0})).toThrow(/positive integer/);
    expect(()=>runCampaign(book,{games:1,directedAttempts:-1})).toThrow(/nonnegative integer/);
    expect(()=>assertInvariants(book,{...newGame(1),character:character({backpack:Array(9).fill('meal')})})).toThrow(/carrying limit/);
  });

  it('keeps a timeout route available to the directed policy instead of immediately evading', () => {
    const original=structuredClone(rules);
    const r={...original,sections:{...original.sections,
      '2':{effects:[{op:'combat',combat:0,evade:{afterRounds:0,choice:2},maxRounds:1,timeout:{choice:1}}]}}};
    const b=buildEngineBook(imported,r),s=startAt(b,1,character(),2);
    expect(progressAction(b,s,availableActions(b,s),chooser(1),distancesTo(b,5))).toEqual({type:'fight'});
    expect(progressAction(b,s,availableActions(b,s),chooser(1),distancesTo(b,6))).toEqual({type:'evade'});
  });

  it('serializes limited pickup, atomic exchange and combat bonuses through the real Save parser', () => {
    const r=structuredClone(rules) as any, source=structuredClone(imported);
    r.items.alether={slot:'backpack',use:{combatSkill:2}};
    r.sections['1']={effects:[{op:'pickup',items:['sword','dagger'],gold:6,maxItems:1},
      {op:'tradeWeapon',item:'dagger'},{op:'pickup',items:['alether','alether']},{op:'combat',combat:0},{op:'combat',combat:1}]};
    source.sections[0]!.combats=[{combatSkill:1,endurance:1},{combatSkill:12,endurance:100}];
    r.setup.randomItem=Object.fromEntries(Array.from({length:10},(_,i)=>[String(i),{gold:2}]));
    const b=buildEngineBook(source,r),save=newSave(b,17);let state=newGame(17);
    const act=(a:Action)=>{state=apply(b,state,a).state;save.actions.push(a);expect(replay(b,JSON.parse(JSON.stringify(save)))).toEqual(state);};
    act({type:'rollStats'});
    for(const discipline of ['camouflage','healing','hunting','mindshield','tracking'] as const)act({type:'learn',discipline});
    act({type:'rollEquipment'});act({type:'take',item:'sword'});act({type:'drop',item:'sword'});
    expect(availableActions(b,state).some(a=>a.type==='take')).toBe(false);
    act({type:'takeGold'});act({type:'continue'});act({type:'tradeWeapon',item:'axe'});
    expect(state.character.weapons).toEqual(['dagger']);
    act({type:'take',item:'alether'});act({type:'take',item:'alether'});act({type:'continue'});
    act({type:'use',item:'alether'});
    expect(availableActions(b,state)).not.toContainEqual({type:'use',item:'alether'});
    act({type:'fight'}); // wins the first fight, resetting its bonus for the second
    expect(state.section!.pending).toMatchObject({kind:'combat',rounds:0,bonus:0});
    act({type:'use',item:'alether'});act({type:'fight'});
    expect(state.character.backpack).not.toContain('alether');
    expect(traceSave(b,save).state).toEqual(state);
    expect(()=>replay(b,{...save,engine:5})).toThrow(/engine version 5/);
  });
});
