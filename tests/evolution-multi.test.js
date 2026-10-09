const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'Multiplayer', 'evolution-multi.html'), 'utf8');
const client = fs.readFileSync(path.join(root, 'Multiplayer', 'evolution-multiplayer.js'), 'utf8');
const rencontre = fs.readFileSync(path.join(root, 'Rencontre', 'rencontre.html'), 'utf8');

test('la préparation autorise Évolution + Multijoueur et route vers le lobby dédié', () => {
  assert.match(rencontre, /variant === "evolution"[\s\S]*evolution-multi\.html/);
  assert.match(rencontre, /const multiLocked = variant === "battle"/);
});

test('le serveur possède une branche autoritaire dédiée au Mode Évolution', () => {
  assert.match(server, /require\("\.\/js\/evolution-engine\.js"\)/);
  assert.match(server, /socket\.on\("playEvolutionAction"/);
  assert.match(server, /Evolution\.play\(room\.evolutionState, action, Math\.random\)/);
  assert.match(server, /socket\.on\("setEvolutionStyle"/);
});

test('les Bombs ne publient pas leurs cibles avant leur déclenchement', () => {
  assert.match(server, /state\.pending = \[\]/);
  assert.match(server, /entry\?\.action\?\.style === "bomb"/);
});

test('le lobby Évolution reprend les règles, styles, ready et reconnexion', () => {
  for (const id of ['room-board-size','room-best-of','room-turn-time','ready-button','lobby-styles-x','lobby-styles-o','resume-session']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(client, /gameVariant:'evolution'/);
  assert.match(client, /resumeRoom/);
  assert.match(client, /setEvolutionStyle/);
});

test('le gameplay multijoueur expose toutes les actions Évolution', () => {
  for (const id of ['place','add','erase','style','bomb-effect','effects-list','dice-overlay']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(client, /playEvolutionAction/);
  assert.match(client, /style === 'time'/);
  assert.match(client, /style === 'gambling'/);
  assert.match(client, /style === 'bomb'/);
});
