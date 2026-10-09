'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../js/evolution-engine.js');
const get = name => fs.readFileSync(path.join(__dirname, '..', name),'utf8');

test('Gambling : une case adverse est retournée exactement au symbole du joueur', () => {
  const start=E.initial(3,{X:'gambling',O:'balanced'},'X');
  start.symbols['0,0']='O';
  const next=E.play(start,{type:'style',style:'gambling'},()=>0);
  assert.equal(next.symbols['0,0'],'X');
  assert.equal(next.players.X.styleUsed,true);
  assert.equal(next.history.find(x=>x.type==='gambling').cell,'0,0');
});

test('Gambling : si elle lui appartient déjà, la case tirée redevient vide', () => {
  const start=E.initial(3,{X:'gambling',O:'balanced'},'X');
  start.symbols['0,0']='X';
  const next=E.play(start,{type:'style',style:'gambling'},()=>0);
  assert.equal(next.symbols['0,0'],undefined);
});

test('Gambling : une case neutralisée ne fait jamais partie du tirage', () => {
  const start=E.initial(3,{X:'gambling',O:'balanced'},'X');
  start.effects.push({id:10,owner:'O',type:'erase',cells:['0,0'],expiresAtOwnerTurn:999});
  const next=E.play(start,{type:'style',style:'gambling'},()=>0);
  assert.equal(next.history.find(x=>x.type==='gambling').cell,'1,0');
  assert.equal(next.symbols['0,0'],undefined);
});

test('interface multi : le résultat est visible et les paramètres ne quittent plus la salle', () => {
  const css=get('Multiplayer/evolution-multi.css');
  const html=get('Multiplayer/evolution-multi.html');
  const js=get('Multiplayer/evolution-multiplayer.js');
  assert.match(css,/#evo-result-popup:not\(\[hidden\]\)\s*\{\s*display:flex/);
  assert.match(html,/id="evo-settings-modal"/);
  assert.match(js,/settingsModal\.hidden\s*=\s*false/);
  assert.match(js,/\.addEventListener\('click',openSettings\)/);
  assert.match(js,/const hideGhost = isVoid \|\| \(!exists && !selectable\)/);
});
