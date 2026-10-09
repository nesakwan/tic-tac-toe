const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/evolution-engine');

function charge(state,player,n){
  state.players[player].slots=Array(n).fill('charged').concat(state.players[player].slots.slice(n));
  return state;
}

test('BO3 : les extensions de gauche de deux manches forment deux colonnes permanentes (et rien avant la finale)',()=>{
  let s=E.initial(3,{X:'balanced',O:'patient'},'X');
  s.players.X.slots=['charged','charged','charged'];
  s=E.play(s,{type:'effect',effect:'add',cells:['-1,0','-1,1','-1,2']});
  s.players.O.slots=['charged','charged','available','available'];
  s=E.play(s,{type:'effect',effect:'erase',cells:['1,1','2,1']});
  assert.deepEqual(s.ghostEvents.map(e=>e.type),['add','erase']);
  s=E.newRound(s,'X',true,2,3);
  assert.equal(s.ghostFinal,false);
  assert.equal(E.exists(s,'-1,1'),false);
  assert.equal(E.playable(s,'1,1'),true);
  s.players.X.slots=['charged','charged','charged'];
  s=E.play(s,{type:'effect',effect:'add',cells:['-1,0','-1,1','-1,2']});
  s=E.newRound(s,'X',true,3,3);
  assert.equal(s.ghostFinal,true);
  for(const x of [-1,-2])for(let y=0;y<3;y++)assert.equal(E.playable(s,`${x},${y}`),true);
  for(const cell of ['1,1','2,1']) {
    assert.equal(E.exists(s,cell),false);
    assert.equal(E.playable(s,cell),false);
  }
  assert.equal(E.legalCells(s).length,13);
  assert.deepEqual(s.symbols,{});
  assert.equal(s.effects.length,0);
  assert.deepEqual(s.ghostHistory.map(round=>round.length),[2,1]);
  assert.ok(E.exteriorAvailable(s).includes('-3,1'));
  s=E.play(s,{type:'place',cell:'-2,1'});
  assert.equal(s.symbols['-2,1'],'X');
  assert.throws(()=>E.play({...s,turn:'O'},{type:'place',cell:'1,1'}),/injouable/i);
});

test('BO5 : seules les modifications des quatre premières manches deviennent permanentes à la cinquième',()=>{
  let s=E.initial(4,{X:'patient',O:'patient'},'X');
  const additions=['0,-1','1,-1','2,-1','3,-1'];
  for(let round=1;round<=4;round++){
    s.players.X.slots=['charged','charged','charged','charged'];
    s=E.play(s,{type:'effect',effect:'add',cells:additions});
    s=E.newRound(s,'X',true,round+1,5);
    assert.equal(s.ghostFinal,round===4);
    if(round<4)assert.equal(E.exists(s,'0,-1'),false);
  }
  for(let depth=1;depth<=4;depth++)for(let x=0;x<4;x++)assert.equal(E.playable(s,`${x},${-depth}`),true);
  assert.equal(E.legalCells(s).length,32);
  assert.ok(E.exteriorAvailable(s).includes('0,-5'));
});

test('Une neutralisation définitive coupe les alignements, même si un symbole aurait complété la ligne',()=>{
  let s=E.initial(3,{X:'balanced',O:'balanced'},'X');
  s.players.X.slots=['charged','available','available'];
  s=E.play(s,{type:'effect',effect:'erase',cells:['1,0']});
  s=E.newRound(s,'O',true,2,3);
  s=E.newRound(s,'X',true,3,3);
  Object.assign(s.symbols,{'0,0':'X','1,0':'X','2,0':'X'});
  assert.equal(E.winning(s),null);
});

test('Bomb ne compte qu’après déclenchement ; Time ne duplique pas l’héritage',()=>{
  let s=E.initial(3,{X:'bomb',O:'balanced'},'X');
  s.players.X.slots=['charged','available','available'];
  s=E.play(s,{type:'style',style:'bomb',effect:'add',cells:['-1,1']});
  assert.equal(s.ghostEvents.length,0);
  s=E.play(s,{type:'place',cell:'0,0'});
  assert.equal(s.ghostEvents.length,1);
  const n=E.newRound(s,'X',true,2,3);
  const final=E.newRound(n,'X',true,3,3);
  assert.equal(E.playable(final,'-1,1'),true);
  assert.equal(final.permanentCells.length,1);
});

test('BO1, parties normales et anciennes traces de symboles ne transmettent aucun terrain',()=>{
  let s=E.initial(3,{X:'balanced',O:'balanced'},'X');
  s.players.X.slots=['charged','available','available'];
  s=E.play(s,{type:'effect',effect:'add',cells:['-1,1']});
  s.symbols['0,0']='X';
  for(const [enabled,round,bestOf] of [[false,3,3],[true,2,1]]){
    const next=E.newRound(s,'O',enabled,round,bestOf);
    assert.equal(next.ghostFinal,false);
    assert.equal(E.exists(next,'-1,1'),false);
    assert.deepEqual(next.symbols,{});
  }
});

test('La finale permet de nouveaux ajouts temporaires sur le bord étendu, sans altérer le terrain permanent',()=>{
  let s=E.initial(3,{X:'balanced',O:'balanced'},'X');
  s.players.X.slots=['charged','available','available'];
  s=E.play(s,{type:'effect',effect:'add',cells:['-1,1']});
  s=E.newRound(s,'X',true,2,3);
  s=E.newRound(s,'X',true,3,3);
  assert.equal(E.playable(s,'-1,1'),true);
  s.players.X.slots=['charged','available','available'];
  s=E.play(s,{type:'effect',effect:'add',cells:['-2,1']});
  assert.equal(E.playable(s,'-2,1'),true);
  assert.equal(E.playable(s,'-1,1'),true);
  assert.equal(s.permanentCells.includes('-2,1'),false);
});

test('Time prolonge un ajout sans fabriquer une deuxième couche Fantôme',()=>{
  let s=E.initial(3,{X:'time',O:'balanced'},'X');
  s.players.X.slots=['charged','available','available'];
  s=E.play(s,{type:'effect',effect:'add',cells:['0,-1']});
  const id=s.effects[0].id;
  s=E.play(s,{type:'place',cell:'1,1'});
  s=E.play(s,{type:'style',style:'time',effectId:id});
  assert.equal(s.ghostEvents.length,1);
  s=E.newRound(s,'X',true,2,3);
  s=E.newRound(s,'X',true,3,3);
  assert.deepEqual(s.permanentCells,['0,-1']);
});

test('Fantôme : deux ajouts identiques pendant une même manche créent bien deux couches, pas une seule',()=>{
  const history=[[
    {type:'add',cells:['-1,0','-1,1','-1,2']},
    {type:'add',cells:['-1,0','-1,1','-1,2']}
  ],[]];
  const final=E.buildGhostFinal(history,3);
  assert.equal(final.permanentCells.length,6);
  for(const x of [-1,-2])for(const y of [0,1,2]){
    assert.ok(final.permanentCells.includes(`${x},${y}`),`case manquante ${x},${y}`);
  }
});

test('Fantôme : ajouts sur le même bord à des positions différentes se rejoignent sans ligne vide',()=>{
  const final=E.buildGhostFinal([
    [{type:'add',cells:['0,-1','1,-1']}],
    [{type:'add',cells:['2,-1','3,-1']}]
  ],4);
  assert.deepEqual(new Set(final.permanentCells),new Set(['0,-1','1,-1','2,-1','3,-1']));
  assert.equal(final.permanentCells.some(c=>c.endsWith(',-2')),false);
});

test('Fantôme : ajouts successifs au même endroit dans plusieurs manches se cumulent case par case',()=>{
  const final=E.buildGhostFinal([
    [{type:'add',cells:['0,-1','1,-1']}],
    [{type:'add',cells:['1,-1','2,-1']}],
    [{type:'add',cells:['1,-1']}],
    [{type:'add',cells:['3,-1']}]
  ],4);
  assert.deepEqual(new Set(final.permanentCells),new Set([
    '0,-1','1,-1','1,-2','1,-3','2,-1','3,-1'
  ]));
});

test('Fantôme : une Neutralisation extérieure vise seulement la bonne incarnation de la case',()=>{
  const final=E.buildGhostFinal([
    [
      {type:'add',cells:['-1,1']},
      {type:'add',cells:['-1,1']},
      {type:'erase',cells:['-1,1']}
    ],
    [{type:'add',cells:['-1,1']}]
  ],3);
  assert.deepEqual(new Set(final.permanentCells),new Set(['-1,1','-2,1','-3,1']));
  assert.deepEqual(new Set(final.permanentErased),new Set(['-2,1']));
});

test('Fantôme : en BO3, les deux activations d’une même manche traversent newRound sans fusion',()=>{
  let s=E.initial(3,{X:'balanced',O:'patient'},'X');
  s.ghostEvents=[
    {type:'add',cells:['-1,0','-1,1']},
    {type:'add',cells:['-1,0','-1,1']}
  ];
  s=E.newRound(s,'O',true,2,3);
  assert.equal(s.ghostFinal,false);
  s.ghostEvents=[{type:'erase',cells:['1,1']}];
  s=E.newRound(s,'X',true,3,3);
  assert.equal(s.ghostFinal,true);
  for(const x of [-1,-2])for(const y of [0,1])assert.equal(E.playable(s,`${x},${y}`),true);
  assert.equal(E.playable(s,'1,1'),false);
  assert.equal(s.permanentCells.length,4);
});
