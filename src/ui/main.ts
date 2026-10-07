import './style.css';
import {
  apply,
  exportCharacter,
  newGame,
  newSave,
  parseSave,
  replay,
  type Action,
  type GameEvent,
  type GameState,
  type SaveGame,
} from '../engine';
import type { Book } from '../importer/book';
import { selectBook } from './adapter';
import type { PlayableBook } from './content';
import { demoBook } from './demo';
import { render, renderNotice, renderRecovery } from './render';

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const reader = params.has('reader');
// Only the agreed rules file; sample encodings are never loaded by the player.
const rulesFiles = import.meta.glob<unknown>('../../data/mechanics/01fftd.json', { import: 'default' });

let book: PlayableBook;
let storageKey: string;
let save: SaveGame;
let state: GameState;
let events: GameEvent[] = [];
let shownSection: number | null = null;

async function loadBook(): Promise<PlayableBook> {
  if (params.get('book') !== '01fftd') return demoBook;
  const response = await fetch('/content/01fftd/book.json');
  if (!response.ok) {
    throw new Error('Import your Project Aon download first: npm run import -- /path/to/01fftd.zip');
  }
  const imported = (await response.json()) as Book;
  const loadRules = rulesFiles['../../data/mechanics/01fftd.json'];
  return selectBook(imported, !reader && loadRules ? await loadRules() : null, reader);
}

function start(seed = crypto.getRandomValues(new Uint32Array(1))[0]!) {
  save = newSave(book.engine, seed);
  state = newGame(seed);
  events = [];
  persist();
  draw();
}

// Validates and replays before touching the current game, so a bad save throws
// and leaves everything as it was.
function restore(data: unknown) {
  const parsed = parseSave(data);
  const restored = replay(book.engine, parsed);
  save = parsed;
  state = restored;
  events = [];
  persist();
  draw();
}

function act(action: Action) {
  const result = apply(book.engine, state, action);
  save = { ...save, actions: [...save.actions, action] };
  state = result.state;
  events = result.events;
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

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

function draw() {
  render(root, {
    book,
    state,
    events,
    act,
    newGame: () => start(),
    downloadSave: () => download(`${book.engine.id}-save.json`, JSON.stringify(save, null, 2)),
    uploadSave: async (file) => {
      try {
        restore(JSON.parse(await file.text()));
      } catch (err) {
        alert(`That save could not be loaded: ${(err as Error).message}`);
      }
    },
    exportCharacter: () => {
      try {
        download(`${book.engine.id}-character.json`, JSON.stringify(exportCharacter(book.engine, state), null, 2));
      } catch (err) {
        alert((err as Error).message);
      }
    },
  });
  const section = state.section?.number ?? null;
  if (section !== shownSection) window.scrollTo({ top: 0 });
  shownSection = section;
}

function stored(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

async function main() {
  try {
    book = await loadBook();
  } catch (err) {
    renderNotice(root, 'Lone Wolf', 'This book cannot be opened yet', (err as Error).message);
    return;
  }
  storageKey = `lone-wolf:save:${book.engine.id}${book.notice ? ':reader' : ''}`;
  const raw = stored();
  if (raw === null) {
    start();
    return;
  }
  try {
    restore(JSON.parse(raw));
  } catch (err) {
    renderRecovery(root, {
      title: book.title,
      reason: (err as Error).message,
      download: () => download(`${book.engine.id}-unreadable-save.json`, raw),
      newGame: () => start(),
    });
  }
}

void main();
