const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Gameplay', 'evolution.html'), 'utf8');

test('le Mode Évolution charge la musique partagée du jeu', () => {
  assert.match(html, /\.\.\/js\/music\.js/);
  assert.match(html, /Super Smash Bros Brawl Music - Final Destination\.mp3/);
});

test('la sélection de styles utilise des carrousels compacts pour X et O', () => {
  assert.match(html, /class="style-carousel" data-player="X"/);
  assert.match(html, /class="style-carousel" data-player="O"/);
  assert.match(html, /id="styles-x" class="styles style-track"/);
  assert.match(html, /id="styles-o" class="styles style-track"/);
});


test('la préparation IA est disponible et contrôlable', () => {
  assert.match(html, /id="ai-preparation-toggle"/);
  assert.match(html, /id="ai-preparation"/);
});
