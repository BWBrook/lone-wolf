import {
  availableActions,
  heroCombatSkill,
  maxEndurance,
  type Action,
  type CombatEffect,
  type GameEvent,
  type GameState,
} from '../engine';
import { humanize, type PlayableBook } from './content';

export interface View {
  book: PlayableBook;
  state: GameState;
  events: GameEvent[];
  act(action: Action): void;
  newGame(): void;
  downloadSave(): void;
  uploadSave(file: File): void;
  exportCharacter(): void;
}

type Child = Node | string | null | false | undefined | Child[];

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener);
    else if (typeof v === 'boolean') (el as unknown as Record<string, boolean>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, child: Child): void {
  if (Array.isArray(child)) child.forEach((c) => append(el, c));
  else if (child) el.append(child);
}

const key = (a: Action) => JSON.stringify(Object.entries(a).sort(([p], [q]) => p.localeCompare(q)));

export function render(root: HTMLElement, v: View): void {
  const actions = new Set(availableActions(v.book.engine, v.state).map(key));
  const can = (a: Action) => actions.has(key(a));
  const button = (label: string, a: Action, cls = '') =>
    h('button', { class: cls, disabled: !can(a), onclick: () => v.act(a) }, label);
  root.replaceChildren(header(v));
  if (v.book.notice) root.append(h('p', { class: 'notice' }, v.book.notice));
  root.append(h('main', {}, story(v, can, button), chart(v, can)));
}

export function renderNotice(root: HTMLElement, title: string, heading: string, message: string): void {
  root.replaceChildren(
    h('header', {}, h('h1', {}, title)),
    h('main', {}, h('section', { class: 'story' }, h('h2', {}, heading), h('p', {}, message))),
  );
}

// Shown when the stored save cannot be restored. Nothing is overwritten until
// the player explicitly starts a new game.
export function renderRecovery(
  root: HTMLElement,
  r: { title: string; reason: string; download(): void; newGame(): void },
): void {
  root.replaceChildren(
    h('header', {}, h('h1', {}, r.title)),
    h(
      'main',
      {},
      h(
        'section',
        { class: 'story' },
        h('h2', {}, 'Your saved game could not be loaded'),
        h('p', {}, `${r.reason}.`),
        h('p', {}, 'It has been kept unchanged in this browser. Download it first if you want to keep a copy.'),
        h(
          'div',
          { class: 'choices' },
          h('button', { onclick: r.download }, 'Download the saved game'),
          h(
            'button',
            {
              class: 'primary',
              onclick: () => confirm('Start a new game? This replaces the saved game in this browser.') && r.newGame(),
            },
            'Start a new game',
          ),
        ),
      ),
    ),
  );
}

function header(v: View) {
  const file = h('input', {
    type: 'file',
    accept: 'application/json',
    hidden: true,
    onchange: (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) v.uploadSave(f);
    },
  });
  return h(
    'header',
    {},
    h('h1', {}, v.book.title),
    h(
      'nav',
      {},
      h('button', { onclick: () => confirm('Abandon this adventure and start again?') && v.newGame() }, 'New game'),
      h('button', { onclick: v.downloadSave }, 'Download save'),
      h('button', { onclick: () => file.click() }, 'Load save'),
      file,
    ),
  );
}

type Button = (label: string, a: Action, cls?: string) => HTMLButtonElement;

function story(v: View, can: (a: Action) => boolean, button: Button) {
  const { state, book } = v;
  const c = state.character;
  const log = eventLog(v);
  switch (state.phase) {
    case 'stats':
      return h('section', { class: 'story' }, h('h2', {}, 'Your training'), h('p', {}, 'Roll for your COMBAT SKILL (10 + a random number) and ENDURANCE (20 + a random number).'), button('Roll', { type: 'rollStats' }, 'primary'));
    case 'disciplines': {
      const left = book.engine.setup.disciplines - c.disciplines.length;
      return h(
        'section',
        { class: 'story' },
        log,
        h('h2', {}, 'Kai Disciplines'),
        h('p', {}, `Choose ${left} more.`),
        h('div', { class: 'choices' }, availableActions(book.engine, state).map((a) => a.type === 'learn' && button(humanize(a.discipline), a))),
      );
    }
    case 'weaponskill':
      return h('section', { class: 'story' }, log, h('h2', {}, 'Weaponskill'), h('p', {}, 'Roll to find the weapon you have mastered.'), button('Roll', { type: 'rollWeaponskill' }, 'primary'));
    case 'equipment':
      return h('section', { class: 'story' }, log, h('h2', {}, 'Equipment'), h('p', {}, 'Roll for your Gold Crowns and for the item you find in the ruins.'), button('Roll', { type: 'rollEquipment' }, 'primary'));
  }

  const n = state.section!.number;
  const text = book.text[n];
  const body: Child[] = [
    h('h2', {}, `Section ${n}`),
    text?.paragraphs.map((p) => h('p', {}, p)) ?? h('p', { class: 'missing' }, 'No text for this section.'),
    text?.notes?.map((n) => h('p', { class: 'note' }, n)),
    log,
  ];
  if (state.phase === 'dead') {
    return h('section', { class: 'story' }, body, h('p', { class: 'ending' }, 'Your adventure is over.'), h('button', { class: 'primary', onclick: v.newGame }, 'Start again'));
  }
  if (state.phase === 'won') {
    return h('section', { class: 'story' }, body, h('p', { class: 'ending' }, 'You have completed this adventure.'), h('button', { class: 'primary', onclick: v.exportCharacter }, 'Export character'));
  }

  const pending = state.section!.pending!;
  const def = book.engine.sections[n]!;
  if (pending.kind === 'pickup') {
    body.push(
      h('h3', {}, 'You may take'),
      h('div', { class: 'choices' }, [...new Set(pending.offered)].map((item) => button(`Take ${humanize(item)}`, { type: 'take', item }))),
      button('Continue', { type: 'continue' }, 'primary'),
    );
  } else if (pending.kind === 'random') {
    body.push(button('Pick a number', { type: 'roll' }, 'primary'));
  } else if (pending.kind === 'combat') {
    const e = def.rules.effects![state.section!.effect] as CombatEffect;
    const enemy = def.combats[e.combat]!;
    const cs = heroCombatSkill(book.engine, state, e);
    body.push(
      h(
        'div',
        { class: 'combat' },
        h('h3', {}, text?.enemies[e.combat] ?? `Enemy ${e.combat + 1}`),
        h('p', {}, `COMBAT SKILL ${enemy.combatSkill}, ENDURANCE ${pending.enemyEndurance} of ${enemy.endurance}`),
        h('p', {}, `Your COMBAT SKILL ${cs}; combat ratio ${signed(cs - enemy.combatSkill)}`),
        h('div', { class: 'choices' }, button('Fight a round', { type: 'fight' }, 'primary'), can({ type: 'evade' }) && button('Evade', { type: 'evade' })),
      ),
    );
  } else {
    const evadeOnly = new Set((def.rules.effects ?? []).flatMap((e) => (e.op === 'combat' && e.evade ? [e.evade.choice] : [])));
    body.push(
      h(
        'div',
        { class: 'choices' },
        def.choices
          .filter((ch) => !evadeOnly.has(ch.ordinal))
          .map((ch) => button(text?.choices[ch.ordinal] ?? `Turn to ${ch.target}`, { type: 'choose', ordinal: ch.ordinal })),
      ),
    );
  }
  return h('section', { class: 'story' }, body);
}

function chart(v: View, can: (a: Action) => boolean) {
  const c = v.state.character;
  if (v.state.phase === 'stats') return h('aside', { class: 'chart' }, h('h2', {}, 'Action Chart'));
  const item = (id: string) =>
    h(
      'li',
      {},
      humanize(id),
      can({ type: 'use', item: id }) && h('button', { class: 'small', onclick: () => v.act({ type: 'use', item: id }) }, 'Use'),
      can({ type: 'drop', item: id }) && h('button', { class: 'small', onclick: () => v.act({ type: 'drop', item: id }) }, 'Drop'),
    );
  const list = (title: string, ids: string[], limit?: number) => [
    h('h3', {}, limit ? `${title} (${ids.length}/${limit})` : title),
    ids.length ? h('ul', {}, ids.map(item)) : h('p', { class: 'empty' }, 'None'),
  ];
  return h(
    'aside',
    { class: 'chart' },
    h('h2', {}, 'Action Chart'),
    h(
      'dl',
      {},
      h('dt', {}, 'COMBAT SKILL'),
      h('dd', {}, String(c.combatSkill)),
      h('dt', {}, 'ENDURANCE'),
      h('dd', {}, `${c.endurance} / ${maxEndurance(v.book.engine, c)}`, v.state.fatigue > 0 && h('small', {}, ` (${v.state.fatigue} from hunger or fatigue)`)),
      h('dt', {}, 'Gold Crowns'),
      h('dd', {}, `${c.gold} / 50`),
    ),
    h('h3', {}, 'Kai Disciplines'),
    h('ul', {}, c.disciplines.map((d) => h('li', {}, d === 'weaponskill' && c.weaponskill ? `Weaponskill (${humanize(c.weaponskill)})` : humanize(d)))),
    list('Weapons', c.weapons, 2),
    list('Backpack', c.backpack, 8),
    list('Special Items', c.specialItems),
  );
}

function eventLog(v: View) {
  const lines = v.events.map((e) => describe(v, e)).filter((x): x is string => !!x);
  return lines.length ? h('ul', { class: 'log' }, lines.map((l) => h('li', {}, l))) : null;
}

function describe(v: View, e: GameEvent): string | null {
  switch (e.type) {
    case 'rolled':
      if (e.purpose === 'combat') return null;
      return `Random number (${humanize(e.purpose)}): ${e.value}${e.total !== undefined && e.total !== e.value ? `, adjusted to ${e.total}` : ''}`;
    case 'combatRound':
      return `Round ${e.round}: ratio ${signed(e.ratio)}. ${e.evading ? 'Evading: ' : ''}enemy loses ${e.enemyLoss === 'k' ? 'all' : e.enemyLoss}, you lose ${e.heroLoss === 'k' ? 'all' : e.heroLoss}. Enemy ENDURANCE ${e.enemyEndurance}.`;
    case 'enemyDefeated':
      return `Enemy defeated after ${e.rounds} round${e.rounds === 1 ? '' : 's'}.`;
    case 'evaded':
      return 'You evade the fight.';
    case 'endurance':
      return `${signed(e.delta)} ENDURANCE (${humanize(e.cause)}), now ${e.endurance}.`;
    case 'gold':
      return `${signed(e.delta)} Gold Crowns, now ${e.gold}.`;
    case 'itemGained':
      return `Gained: ${humanize(e.item)}.`;
    case 'itemLost':
      return `Lost: ${humanize(e.item)}.`;
    case 'meal':
      return { hunted: 'You hunt for your food.', ate: 'You eat a Meal.', starved: 'You have no food.' }[e.outcome];
    case 'section':
    case 'died':
    case 'won':
      return null;
  }
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
