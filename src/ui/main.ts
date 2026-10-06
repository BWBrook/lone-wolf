import './style.css';
import { apply, exportCharacter, newGame, replay, type Action, type GameEvent, type GameState, type SaveGame } from '../engine';
import { demoBook } from './demo';
import { render } from './render';

const book = demoBook;
const root = document.getElementById('app')!;
const storageKey = `lone-wolf:save:${book.engine.id}`;

let save: SaveGame;
let state: GameState;
let events: GameEvent[] = [];
let shownSection: number | null = null;

function start(seed = crypto.getRandomValues(new Uint32Array(1))[0]!) {
  save = { version: 1, book: book.engine.id, sourceSha256: book.engine.sourceSha256, seed, actions: [] };
  state = newGame(seed);
  events = [];
  persist();
  draw();
}

function restore(saved: SaveGame) {
  state = replay(book.engine, saved);
  save = saved;
  events = [];
  persist();
  draw();
}

function act(action: Action) {
  const result = apply(book.engine, state, action);
  state = result.state;
  events = result.events;
  save.actions.push(action);
  persist();
  draw();
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(save));
  } catch {
    // Storage may be unavailable; the game still plays, and saves can be downloaded.
  }
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function draw() {
  render(root, {
    book,
    state,
    events,
    act,
    newGame: () => start(),
    downloadSave: () => download(`${book.engine.id}-save.json`, save),
    uploadSave: async (file) => {
      try {
        restore(JSON.parse(await file.text()));
      } catch (err) {
        alert(`That save could not be loaded: ${(err as Error).message}`);
      }
    },
    exportCharacter: () => download(`${book.engine.id}-character.json`, exportCharacter(book.engine, state)),
  });
  const section = state.section?.number ?? null;
  if (section !== shownSection) window.scrollTo({ top: 0 });
  shownSection = section;
}

function load(): SaveGame | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const saved = load();
try {
  if (saved) restore(saved);
  else start();
} catch {
  start();
}
