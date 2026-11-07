const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "../src/static/app.js"),
  "utf8",
);
const storageKey = "one-card-bingo-v1";

class Element {
  constructor() {
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.classes = new Set();
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.classList = {
      add: (value) => this.classes.add(value),
      toggle: (value, enabled) => {
        if (enabled) this.classes.add(value);
        else this.classes.delete(value);
      },
    };
  }

  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren() { this.children = []; }
  appendChild(child) { this.children.push(child); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  click() {
    if (!this.disabled && this.listeners.click) this.listeners.click();
  }
}

function openGame(storage = new Map(), options = {}) {
  const ids = [
    "bingo-grid", "progress", "game-status", "storage-notice",
    "celebration", "celebration-close", "game-number", "called-number",
    "called-history", "caller-count", "draw-button", "next-game", "game-limit",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  elements.celebration.hidden = true;
  const document = {
    addEventListener: (event, callback) => { document.ready = callback; },
    getElementById: (id) => elements[id],
    createElement: () => new Element(),
  };
  const localStorage = {
    getItem: (key) => {
      if (options.storageError) throw new Error("storage unavailable");
      return storage.get(key) ?? null;
    },
    setItem: (key, value) => storage.set(key, value),
  };
  const window = { confirm: () => options.confirm !== false };
  vm.runInNewContext(script, {
    document, localStorage, window, console: { error() {} },
  });
  document.ready();
  return { elements, storage, state: () => JSON.parse(storage.get(storageKey)) };
}

test("generates valid card and migrates an existing card with marks", () => {
  const initial = openGame();
  const legacy = initial.state();
  delete legacy.game;
  delete legacy.called;
  legacy.marked[0] = true;
  const storage = new Map([[storageKey, JSON.stringify(legacy)]]);
  const game = openGame(storage);
  const saved = game.state();
  assert.deepEqual(saved.numbers, legacy.numbers);
  assert.equal(saved.marked[0], true);
  assert.equal(saved.game, 1);
  assert.deepEqual(saved.called, []);
  for (let column = 0; column < 5; column += 1) {
    const numbers = saved.numbers.filter(
      (_, index) => index % 5 === column && index !== 12,
    );
    assert.equal(new Set(numbers).size, column === 2 ? 4 : 5);
    assert.ok(numbers.every((n) => n >= column * 15 + 1 && n <= column * 15 + 15));
  }
  assert.equal(saved.numbers[12], "FREE");
  assert.equal(saved.marked[12], true);
});

test("caller draws all 75 unique numbers and restores calls after reload", () => {
  const game = openGame();
  for (let i = 0; i < 75; i += 1) game.elements["draw-button"].click();
  const calls = game.state().called;
  assert.equal(calls.length, 75);
  assert.equal(new Set(calls).size, 75);
  assert.ok(calls.every((n) => n >= 1 && n <= 75));
  assert.equal(game.elements["draw-button"].disabled, true);
  assert.equal(game.elements["caller-count"].textContent, "75 / 75 called");
  const reloaded = openGame(game.storage);
  assert.deepEqual(reloaded.state().called, calls);
  assert.equal(reloaded.elements["called-number"].textContent,
    `${"BINGO"[Math.floor((calls[74] - 1) / 15)]} ${calls[74]}`);
  assert.equal(reloaded.elements["draw-button"].disabled, true);
  assert.equal(reloaded.elements["called-history"].textContent.split(", ").length, 75);
});

test("confirmed next game resets calls and marks, preserving card through six games", () => {
  const game = openGame();
  const originalNumbers = game.state().numbers;
  for (let round = 1; round <= 5; round += 1) {
    game.elements["draw-button"].click();
    game.elements["bingo-grid"].children[0].click();
    game.elements["next-game"].click();
    const saved = game.state();
    assert.equal(saved.game, round + 1);
    assert.deepEqual(saved.numbers, originalNumbers);
    assert.deepEqual(saved.called, []);
    assert.equal(saved.marked.filter(Boolean).length, 1);
    assert.equal(saved.marked[12], true);
    assert.equal(game.elements["celebration"].hidden, true);
  }
  assert.equal(game.elements["next-game"].disabled, true);
  assert.equal(game.elements["game-number"].textContent, "GAME 6 OF 6");
  game.elements["draw-button"].click();
  game.elements["bingo-grid"].children[0].click();
  game.elements["next-game"].click();
  const reloaded = openGame(game.storage);
  assert.equal(reloaded.state().game, 6);
  assert.equal(reloaded.state().called.length, 1);
  assert.equal(reloaded.state().marked[0], true);
  assert.equal(reloaded.elements["next-game"].disabled, true);
});

test("cancelling next game preserves current play", () => {
  const game = openGame(new Map(), { confirm: false });
  game.elements["draw-button"].click();
  game.elements["bingo-grid"].children[0].click();
  const before = game.state();
  game.elements["next-game"].click();
  assert.deepEqual(game.state(), before);
});

test("each row, column and diagonal still celebrates a new win", () => {
  const lines = [
    ...Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r * 5 + c)),
    ...Array.from({ length: 5 }, (_, c) => Array.from({ length: 5 }, (_, r) => r * 5 + c)),
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];
  for (const line of lines) {
    const game = openGame();
    for (const index of line.filter((i) => i !== 12)) {
      game.elements["bingo-grid"].children[index].click();
    }
    assert.equal(game.elements.celebration.hidden, false);
    assert.match(game.elements["game-status"].textContent, /BINGO!/);
    game.elements["celebration-close"].click();
    assert.equal(game.elements.celebration.hidden, true);
  }
});

test("storage errors permit unsaved play, while invalid game state is not overwritten", () => {
  const unavailable = openGame(new Map(), { storageError: true });
  assert.equal(unavailable.elements["bingo-grid"].children.length, 25);
  assert.match(unavailable.elements["storage-notice"].textContent, /cannot access/);
  const invalid = openGame().state();
  invalid.game = 7;
  const data = JSON.stringify(invalid);
  const storage = new Map([[storageKey, data]]);
  const game = openGame(storage);
  assert.equal(storage.get(storageKey), data);
  assert.equal(game.elements["draw-button"].disabled, true);
  assert.match(game.elements["storage-notice"].textContent, /invalid/);
});
