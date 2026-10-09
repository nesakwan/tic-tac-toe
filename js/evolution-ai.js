/* TTT 3.5 — IA dédiée au Mode Évolution.
   Les niveaux ne changent pas les règles : ils changent la qualité de décision,
   l'anticipation et l'usage des points/pouvoirs. */
(function (root, factory) {
  const api = factory(root.TTTEvolution || (typeof require === 'function' ? require('./evolution-engine.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TTTEvolutionAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  if (!E) return null;

  const other = p => p === 'X' ? 'O' : 'X';
  const xy = k => k.split(',').map(Number);
  const key = (x,y) => `${x},${y}`;
  const clone = x => JSON.parse(JSON.stringify(x));
  const charged = (s,p) => E.slots(s,p,'charged');
  const spent = (s,p) => E.slots(s,p,'spent');

  function availableExterior(s) {
    return E.exteriorAvailable(s);
  }

  function lineWindows(s) {
    const cells = E.legalCells(s);
    const exists = new Set(cells);
    const windows=[];
    for(const c of cells){
      const [x,y]=xy(c);
      for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
        const line=[];
        for(let i=0;i<s.size;i++) line.push(key(x+i*dx,y+i*dy));
        if(line.every(k=>exists.has(k))) windows.push(line);
      }
    }
    const seen=new Set();
    return windows.filter(line=>{const id=line.join('|');if(seen.has(id))return false;seen.add(id);return true;});
  }

  function immediateWinningCells(s,p) {
    if(s.turn!==p) return [];
    const wins=[];
    for(const c of E.legalCells(s)){
      if(s.symbols[c]) continue;
      try { const n=E.play(s,{type:'place',cell:c}); if(n.winner===p) wins.push(c); } catch {}
    }
    return wins;
  }

  function opponentWinningCells(s,p) {
    const o=other(p), probe=clone(s); probe.turn=o; probe.winner=null; probe.draw=false;
    return immediateWinningCells(probe,o);
  }

  function positionalValue(s,c) {
    const [x,y]=xy(c), mid=(s.size-1)/2;
    const exterior = x<0||y<0||x>=s.size||y>=s.size;
    const dist=Math.abs(x-mid)+Math.abs(y-mid);
    return (exterior ? -0.7 : 2.2-dist*0.45);
  }

  function evaluate(s,p) {
    const o=other(p);
    if(s.winner===p) return 100000;
    if(s.winner===o) return -100000;
    let score=0;
    for(const [c,v] of Object.entries(s.symbols)){
      score += (v===p?1:-1)*positionalValue(s,c);
    }
    for(const line of lineWindows(s)){
      let mine=0,theirs=0,empty=0;
      for(const c of line){ const v=s.symbols[c]; if(v===p)mine++; else if(v===o)theirs++; else empty++; }
      if(!theirs && mine) score += Math.pow(4,mine) + empty*0.15;
      if(!mine && theirs) score -= Math.pow(4.25,theirs) + empty*0.15;
    }
    score += charged(s,p)*2.2 - charged(s,o)*2.0;
    score -= spent(s,p)*0.35; score += spent(s,o)*0.25;
    if(!s.players[p].styleUsed && !['balanced','patient'].includes(s.players[p].style)) score += 1.6;
    if(!s.players[o].styleUsed && !['balanced','patient'].includes(s.players[o].style)) score -= 1.3;
    score += s.effects.filter(e=>e.owner===p).length*0.7;
    score -= s.effects.filter(e=>e.owner===o).length*0.6;
    return score;
  }

  function contiguousGroups(cells,maxLen=3) {
    const set=new Set(cells), groups=[];
    for(const c of cells){
      const [x,y]=xy(c);
      for(const [dx,dy] of [[1,0],[0,1]]){
        for(let len=1;len<=maxLen;len++){
          const g=[]; for(let i=0;i<len;i++)g.push(key(x+i*dx,y+i*dy));
          if(g.every(k=>set.has(k))) groups.push(g);
        }
      }
    }
    const seen=new Set(); return groups.filter(g=>{const id=[...g].sort().join('|');if(seen.has(id))return false;seen.add(id);return true;});
  }

  function promisingCells(s,p,limit=8) {
    const legal=E.legalCells(s).filter(c=>!s.symbols[c]);
    const wins=new Set(immediateWinningCells(s,p));
    const blocks=new Set(opponentWinningCells(s,p));
    return legal.map(c=>{
      let v=positionalValue(s,c);
      if(wins.has(c))v+=1000;
      if(blocks.has(c))v+=500;
      for(const line of lineWindows(s)) if(line.includes(c)){
        const mine=line.filter(k=>s.symbols[k]===p).length;
        const opp=line.filter(k=>s.symbols[k]===other(p)).length;
        if(!opp)v+=mine*3;
        if(!mine)v+=opp*2.5;
      }
      return [c,v];
    }).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>x[0]);
  }

  function validPush(out,s,a) {
    try { const n=E.play(s,a,()=>0.37); out.push({action:a,state:n}); } catch {}
  }

  function actions(s,level='normal') {
    const p=s.turn, out=[];
    const limit=level==='god'?12:level==='hard'?9:7;
    const placements=promisingCells(s,p,limit);
    for(const c of placements) validPush(out,s,{type:'place',cell:c});

    const points=charged(s,p);
    if(points>0){
      const ext=availableExterior(s);
      const effectCap=E.effectLimit?E.effectLimit(s,p):(s.players[p].style==='patient'?4:3);
      const difficultyCap=level==='easy'?1:level==='normal'?2:effectCap;
      const maxCost=Math.min(points,difficultyCap,effectCap);
      const groups=contiguousGroups(ext,maxCost).slice(0,level==='god'?30:level==='hard'?22:8);
      for(const g of groups) validPush(out,s,{type:'effect',effect:'add',cells:g});

      const empty=promisingCells(s,p,level==='god'?10:7);
      for(const c of empty) validPush(out,s,{type:'effect',effect:'erase',cells:[c]});
      if(level==='hard'||level==='god'){
        const source=empty.slice(0,7);
        const cap=Math.min(maxCost, source.length);
        const emitCombos=(start,left,picked)=>{
          if(left===0){validPush(out,s,{type:'effect',effect:'erase',cells:[...picked]});return;}
          for(let i=start;i<=source.length-left;i++){
            picked.push(source[i]);
            emitCombos(i+1,left-1,picked);
            picked.pop();
          }
        };
        for(let amount=2;amount<=cap;amount++) emitCombos(0,amount,[]);
      }
    }

    const pl=s.players[p];
    if(!pl.styleUsed && !['balanced','patient'].includes(pl.style)){
      if(pl.style==='risk') validPush(out,s,{type:'style',style:'risk'});
      else if(pl.style==='time'){
        const owned=s.effects.filter(e=>e.owner===p);
        for(const e of owned.slice(-3)) validPush(out,s,{type:'style',style:'time',effectId:e.id});
      } else if(pl.style==='gambling') validPush(out,s,{type:'style',style:'gambling'});
      else if(pl.style==='aggressive' && points>=1){
        const ext=availableExterior(s);
        for(const target of ext.slice(0,12)){
          // L'extension existe pendant le placement, donc on teste aussi la cible elle-même.
          for(const cell of [...placements,target].slice(0,9)) validPush(out,s,{type:'style',style:'aggressive',target,cell});
        }
      } else if(pl.style==='defensive' && points>=1){
        const targets=promisingCells(s,p,7);
        for(const target of targets){
          for(const cell of placements.slice(0,7)) if(cell!==target) validPush(out,s,{type:'style',style:'defensive',target,cell});
        }
      } else if(pl.style==='bomb' && points>=1){
        const empty=promisingCells(s,p,7);
        for(const c of empty) validPush(out,s,{type:'style',style:'bomb',effect:'erase',cells:[c]});
        const ext=availableExterior(s);
        for(const c of ext.slice(0,10)) validPush(out,s,{type:'style',style:'bomb',effect:'add',cells:[c]});
      }
    }
    return out;
  }

  function tacticalScore(entry,p) {
    const a=entry.action,n=entry.state;
    let v=evaluate(n,p);
    if(n.winner===p)v+=200000;
    if(a.type==='place') v+=2;
    if(a.type==='style') v+=1.2;
    return v;
  }

  function replyValue(s,p,level) {
    if(s.winner||s.draw) return evaluate(s,p);
    const replies=actions(s,level).sort((a,b)=>evaluate(a.state,s.turn)-evaluate(b.state,s.turn));
    if(!replies.length)return evaluate(s,p);
    // L'adversaire choisit sa meilleure réponse, donc la pire pour p.
    let worst=Infinity;
    for(const r of replies.slice(0,level==='god'?7:5)) worst=Math.min(worst,evaluate(r.state,p));
    return worst;
  }

  function chooseAction(s,level='normal',random=Math.random) {
    level=['easy','normal','hard','god'].includes(level)?level:'normal';
    const p=s.turn;
    const list=actions(s,level);
    if(!list.length) return {type:'pass'};

    const wins=list.filter(x=>x.state.winner===p);
    if(wins.length) return wins.sort((a,b)=>tacticalScore(b,p)-tacticalScore(a,p))[0].action;

    if(level==='easy'){
      // Facile comprend parfois une menace, mais reste volontairement imprévisible.
      const blocks=new Set(opponentWinningCells(s,p));
      const blocking=list.filter(x=>x.action.type==='place'&&blocks.has(x.action.cell));
      if(blocking.length && random()<0.35) return blocking[Math.floor(random()*blocking.length)].action;
      const pool=list.filter(x=>x.action.type==='place'||x.action.type==='style');
      const source=pool.length?pool:list;
      return source[Math.floor(random()*source.length)].action;
    }

    const threats=new Set(opponentWinningCells(s,p));
    if(threats.size){
      const safe=list.filter(x=>{
        if(x.state.winner===p)return true;
        const probe=clone(x.state); probe.turn=other(p); probe.winner=null; probe.draw=false;
        return immediateWinningCells(probe,other(p)).length===0;
      });
      if(safe.length){
        safe.sort((a,b)=>tacticalScore(b,p)-tacticalScore(a,p));
        if(level==='normal') return safe[0].action;
      }
    }

    if(level==='normal'){
      // Une petite part d'imperfection évite un Normal trop proche de Difficile.
      const ranked=list.sort((a,b)=>tacticalScore(b,p)-tacticalScore(a,p));
      const pick=random()<0.82?0:Math.min(ranked.length-1,1+Math.floor(random()*Math.min(3,ranked.length-1)));
      return ranked[pick].action;
    }

    const beam=list.map(entry=>({entry,score:tacticalScore(entry,p)})).sort((a,b)=>b.score-a.score).slice(0,level==='god'?(s.size===4?10:14):10);
    for(const item of beam){
      item.score = replyValue(item.entry.state,p,level);
      if(level==='god' && !item.entry.state.winner && !item.entry.state.draw){
        // GOD regarde encore son meilleur contre-coup après la meilleure réponse adverse.
        const oppActions=actions(item.entry.state,'hard').slice(0,s.size===4?4:6);
        let worst=Infinity;
        for(const oppEntry of oppActions){
          if(oppEntry.state.winner===other(p)){ worst=-100000; break; }
          const myNext=actions(oppEntry.state,'hard').slice(0,s.size===4?4:6);
          const bestNext=myNext.length?Math.max(...myNext.map(x=>evaluate(x.state,p))):evaluate(oppEntry.state,p);
          worst=Math.min(worst,bestNext);
        }
        if(worst!==Infinity)item.score=worst;
      }
    }
    beam.sort((a,b)=>b.score-a.score);
    return beam[0].entry.action;
  }

  function chooseStyle(level='normal',random=Math.random) {
    const pools={
      easy:['balanced','patient','risk','gambling','aggressive','defensive','time','bomb'],
      normal:['balanced','patient','aggressive','defensive','risk','gambling','bomb'],
      hard:['aggressive','defensive','balanced','patient','bomb','time'],
      god:['aggressive','defensive','balanced','patient','bomb']
    };
    const pool=pools[level]||pools.normal;
    return pool[Math.floor(random()*pool.length)];
  }

  return Object.freeze({chooseAction,chooseStyle,evaluate,actions});
});
