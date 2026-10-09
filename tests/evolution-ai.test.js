const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/evolution-engine.js');
const AI = require('../js/evolution-ai.js');

function stateWith(style='balanced', level='normal') {
  return E.initial(3,{X:style,O:'balanced'},'X');
}

test('IA Évolution expose les quatre niveaux et produit une action légale', () => {
  for (const level of ['easy','normal','hard','god']) {
    const s=stateWith('balanced',level);
    const action=AI.chooseAction(s,level,()=>0.2);
    assert.doesNotThrow(()=>E.play(s,action,()=>0.2));
  }
});

test('Normal bloque une victoire immédiate', () => {
  let s=E.initial(3,{X:'balanced',O:'balanced'},'X');
  s.symbols={'0,0':'O','1,0':'O','1,1':'X'};
  const a=AI.chooseAction(s,'normal',()=>0.1);
  const n=E.play(s,a,()=>0.1);
  const probe=JSON.parse(JSON.stringify(n));
  probe.turn='O'; probe.winner=null; probe.draw=false;
  const canWin=E.legalCells(probe).some(cell=>{
    if(probe.symbols[cell])return false;
    try{return E.play(probe,{type:'place',cell}).winner==='O';}catch{return false;}
  });
  assert.equal(canWin,false);
});

test('Difficile/GOD savent gagner grâce au pouvoir Agressif', () => {
  for (const level of ['hard','god']) {
    const s=E.initial(3,{X:'aggressive',O:'balanced'},'X');
    s.players.X.slots[0]='charged';
    s.symbols={'0,0':'X','1,0':'X','2,0':'O'};
    const a=AI.chooseAction(s,level,()=>0.2);
    const n=E.play(s,a,()=>0.2);
    assert.equal(n.winner,'X');
    assert.equal(a.type,'style');
    assert.equal(a.style,'aggressive');
  }
});

test('les styles IA choisis sont toujours valides', () => {
  for (const level of ['easy','normal','hard','god']) {
    for (const r of [0,0.25,0.5,0.75,0.99]) {
      assert.ok(E.STYLES.includes(AI.chooseStyle(level,()=>r)));
    }
  }
});
