const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../js/evolution-engine');
test('réserve finie et réinitialisation',()=>{let s=E.initial(3,{X:'balanced',O:'patient'});assert.equal(E.slots(s,'X','charged'),1);s=E.play(s,{type:'effect',effect:'add',cells:['0,-1']});assert.equal(E.slots(s,'X','spent'),1);assert.equal(E.slots(s,'X','charged'),0);const n=E.newRound(s);assert.equal(E.slots(n,'X','charged'),1);assert.equal(E.slots(n,'X','spent'),0);assert.equal(n.players.O.slots.length,4);});
test('extension, limite et géométrie',()=>{let s=E.initial();assert.throws(()=>E.play(s,{type:'effect',effect:'add',cells:['-1,-1']}));assert.throws(()=>E.play(s,{type:'effect',effect:'add',cells:['0,-1','2,-1']}));s=E.play(s,{type:'effect',effect:'add',cells:['0,-1']});assert.ok(E.legalCells(s).includes('0,-1'));});
test('Gambling déterministe et usage unique',()=>{let s=E.initial(3,{X:'gambling',O:'patient'});s=E.play(s,{type:'style',style:'gambling'},()=>0);assert.equal(s.symbols['0,0'],'X');assert.equal(s.players.X.styleUsed,true);});
test('victoire 4x4',()=>{const s=E.initial(4);for(let x=0;x<4;x++)s.symbols[`${x},0`]='X';assert.equal(E.winning(s),'X');});

test('Patient peut ajouter jusqu’à 4 cases en une seule activation',()=>{
  const s=E.initial(4,{X:'patient',O:'balanced'},'X');
  s.players.X.slots=['charged','charged','charged','charged'];
  const n=E.play(s,{type:'effect',effect:'add',cells:['0,-1','1,-1','2,-1','3,-1']});
  assert.equal(n.effects[0].cells.length,4);
  assert.equal(E.slots(n,'X','spent'),4);
});

test('Patient peut neutraliser jusqu’à 4 cases en une seule activation',()=>{
  const s=E.initial(4,{X:'patient',O:'balanced'},'X');
  s.players.X.slots=['charged','charged','charged','charged'];
  const n=E.play(s,{type:'effect',effect:'erase',cells:['0,0','1,0','2,0','3,0']});
  assert.equal(n.effects[0].cells.length,4);
  assert.equal(E.slots(n,'X','spent'),4);
});

test('plateau plein devient nul quand aucune continuation Évolution n’est possible',()=>{
  const s=E.initial(3,{X:'patient',O:'patient'},'X');
  s.players.X.slots=['spent','spent','spent','spent'];
  s.players.O.slots=['spent','spent','spent','spent'];
  Object.assign(s.symbols,{
    '0,0':'X','1,0':'O','2,0':'X',
    '0,1':'X','1,1':'O','2,1':'O',
    '0,2':'O','1,2':'X'
  });
  const n=E.play(s,{type:'place',cell:'2,2'});
  assert.equal(n.winner,null);
  assert.equal(n.draw,true);
});

test('plateau plein ne devient pas nul si le joueur suivant peut encore ajouter une case',()=>{
  const s=E.initial(3,{X:'patient',O:'patient'},'X');
  s.players.X.slots=['spent','spent','spent','spent'];
  s.players.O.slots=['charged','spent','spent','spent'];
  Object.assign(s.symbols,{
    '0,0':'X','1,0':'O','2,0':'X',
    '0,1':'X','1,1':'O','2,1':'O',
    '0,2':'O','1,2':'X'
  });
  const n=E.play(s,{type:'place',cell:'2,2'});
  assert.equal(n.winner,null);
  assert.equal(n.draw,false);
  assert.equal(E.hasLegalAction(n,'O'),true);
});

test('plateau plein : Gambling ne retarde pas artificiellement le match nul',()=>{
  const s=E.initial(3,{X:'patient',O:'gambling'},'X');
  s.players.X.slots=['spent','spent','spent','spent'];
  s.players.O.slots=['spent','spent','spent'];
  Object.assign(s.symbols,{
    '0,0':'X','1,0':'O','2,0':'X',
    '0,1':'X','1,1':'O','2,1':'O',
    '0,2':'O','1,2':'X'
  });
  const n=E.play(s,{type:'place',cell:'2,2'});
  assert.equal(n.draw,true);
});

test('une case neutralisée existe encore logiquement mais n’est plus jouable',()=>{
  const s=E.initial(3,{X:'balanced',O:'balanced'},'X');
  s.players.X.slots=['charged','available','available'];
  const n=E.play(s,{type:'effect',effect:'erase',cells:['1,1']});
  assert.equal(E.exists(n,'1,1'),true);
  assert.equal(E.playable(n,'1,1'),false);
});


test('winningLine renvoie les cases exactes de la ligne gagnante',()=>{
  const s=E.initial(3,{X:'balanced',O:'balanced'},'X');
  s.symbols['0,1']='X';
  s.symbols['1,1']='X';
  s.symbols['2,1']='X';
  assert.deepEqual(E.winningLine(s,'X'),{player:'X',cells:['0,1','1,1','2,1']});
});
