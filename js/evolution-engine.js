/* TTT 3.5 — moteur de règles pur, utilisable par navigateur et serveur. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TTTEvolution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STYLES = Object.freeze(['aggressive','defensive','balanced','patient','time','bomb','risk','gambling']);
  const key = (x,y) => `${x},${y}`;
  const xy = k => k.split(',').map(Number);
  const opponent = p => p === 'X' ? 'O' : 'X';
  const clone = s => JSON.parse(JSON.stringify(s));
  function initial(size=3, styles={X:'balanced',O:'patient'}, first='X') {
    if (![3,4].includes(size)) throw Error('Plateau invalide');
    if (!['X','O'].includes(first)) throw Error('Premier joueur invalide');
    const players = {};
    for (const p of ['X','O']) {
      const style = styles[p] || 'balanced';
      if (!STYLES.includes(style)) throw Error('Style invalide');
      players[p] = {style, slots:Array(style==='patient'?4:3).fill('available'), styleUsed:false};
      if (style==='balanced') players[p].slots[0]='charged';
    }
    return {size, turn:first, turnNumber:0, symbols:{}, effects:[], pending:[], players, winner:null, draw:false, history:[], nextId:1, ghostHistory:[], ghostEvents:[], ghostFinal:false, permanentCells:[], permanentErased:[]};
  }
  const slots = (s,p,status) => s.players[p].slots.filter(v=>v===status).length;
  function charge(s,p) {const i=s.players[p].slots.indexOf('available'); if(i<0)return false;s.players[p].slots[i]='charged';return true;}
  function spend(s,p,n) {if(!Number.isInteger(n)||n<1||slots(s,p,'charged')<n)throw Error('Points insuffisants');for(let i=0;i<n;i++)s.players[p].slots[s.players[p].slots.indexOf('charged')]='spent';}
  // La taille 'size' reste la longueur de victoire (3 ou 4), même si le terrain final s'étend.
  const base = (s,x,y) => x>=0&&x<s.size&&y>=0&&y<s.size;
  function permanent(s,k) {
    const [x,y]=xy(k);
    return (base(s,x,y)||Boolean(s.permanentCells?.includes(k))) && !s.permanentErased?.includes(k);
  }
  function bounds(s) {
    const all=[key(0,0),key(s.size-1,s.size-1),...(s.permanentCells||[])].map(xy);
    return {minX:Math.min(...all.map(c=>c[0])),maxX:Math.max(...all.map(c=>c[0])),minY:Math.min(...all.map(c=>c[1])),maxY:Math.max(...all.map(c=>c[1]))};
  }
  function exterior(s,x,y) {
    const b=bounds(s);
    return ((x===b.minX-1||x===b.maxX+1)&&y>=b.minY&&y<=b.maxY)
      || ((y===b.minY-1||y===b.maxY+1)&&x>=b.minX&&x<=b.maxX);
  }
  function active(s,type) {return s.effects.filter(e=>e.type===type).flatMap(e=>e.cells);}
  function activeSet(s,type) {return new Set(active(s,type));}
  function exists(s,k) {return permanent(s,k)||activeSet(s,'add').has(k);}
  function erased(s,k) {return Boolean(s.permanentErased?.includes(k))||activeSet(s,'erase').has(k);}
  function playable(s,k) {return exists(s,k)&&!erased(s,k);}
  function legalCells(s) {
    const additions=activeSet(s,'add'), erasures=activeSet(s,'erase'),out=[];
    const b=bounds(s);
    for(let y=b.minY-1;y<=b.maxY+1;y++)for(let x=b.minX-1;x<=b.maxX+1;x++){
      const k=key(x,y);
      if((permanent(s,k)||additions.has(k))&&!erasures.has(k))out.push(k);
    }
    return out;
  }
  function winningLine(s, onlyPlayer=null) {
    const n=s.size, playableSet=new Set(legalCells(s));
    for(const [k,p] of Object.entries(s.symbols)){
      if(onlyPlayer && p!==onlyPlayer)continue;
      if(!playableSet.has(k))continue;
      const [x,y]=xy(k);
      for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
        const cells=[k];
        let ok=true;
        for(let j=1;j<n;j++){
          const t=key(x+j*dx,y+j*dy);
          if(!playableSet.has(t)||s.symbols[t]!==p){ok=false;break;}
          cells.push(t);
        }
        if(ok)return {player:p,cells};
      }
    }
    return null;
  }
  function winning(s) {
    return winningLine(s)?.player || null;
  }
  function effectLimit(s,p) {return s.players[p]?.style==='patient'?4:3;}
  function targets(s,p,type,cells) {
    const limit=effectLimit(s,p);
    if(!['add','erase'].includes(type)||!Array.isArray(cells)||cells.length<1||cells.length>limit||new Set(cells).size!==cells.length)throw Error('Cibles invalides');
    if(active(s,type).length+cells.length>limit)throw Error('Plafond global atteint');
    if(type==='add') {
      for(const k of cells){const [x,y]=xy(k);if(!exterior(s,x,y)||exists(s,k)||erased(s,k))throw Error('Extension illégale');}
      const pts=cells.map(xy), sameX=pts.every(p=>p[0]===pts[0][0]),sameY=pts.every(p=>p[1]===pts[0][1]);
      if(!(sameX||sameY))throw Error('Bord commun requis');
      const vals=pts.map(p=>sameX?p[1]:p[0]).sort((a,b)=>a-b);
      if(vals.some((v,i)=>i>0&&v!==vals[i-1]+1))throw Error('Extensions non contiguës');
      if(!cells.some(k=>{const [x,y]=xy(k);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>permanent(s,key(a,b)));}))throw Error('Aucun ancrage au terrain principal');
    } else {
      for(const k of cells)if(!playable(s,k)||s.symbols[k])throw Error('Effacement illégal');
      if(legalCells(s).filter(k=>!cells.includes(k)&&!s.symbols[k]).length===0)throw Error('Blocage interdit');
    }
  }
  function applyEffect(s,p,type,cells,extra=0) {targets(s,p,type,cells);spend(s,p,cells.length);s.effects.push({id:s.nextId++,type,owner:p,cells:[...cells],expiresAtOwnerTurn:ownerTurns(s,p)+2+extra});recordGhostEffect(s,type,cells);}
  function ownerTurns(s,p) {return s.history.filter(e=>e.actor===p&&e.type==='turn').length;}
  function expire(s,p) {const count=ownerTurns(s,p);const expired=s.effects.filter(e=>e.owner===p&&e.expiresAtOwnerTurn<=count);s.effects=s.effects.filter(e=>!expired.includes(e));for(const e of expired)if(e.type==='add')for(const k of e.cells)if(!exists(s,k))delete s.symbols[k];}
  function exteriorAvailable(s) {
    const out=[],b=bounds(s);
    for(let y=b.minY;y<=b.maxY;y++)for(const x of [b.minX-1,b.maxX+1]){
      const k=key(x,y);if(!exists(s,k)&&!erased(s,k))out.push(k);
    }
    for(let x=b.minX;x<=b.maxX;x++)for(const y of [b.minY-1,b.maxY+1]){
      const k=key(x,y);if(!exists(s,k)&&!erased(s,k))out.push(k);
    }
    return [...new Set(out)].filter(k=>{
      const [x,y]=xy(k);
      return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>permanent(s,key(a,b)));
    });
  }
  function recordGhostEffect(s,type,cells) {
    // Seules les modifications réellement appliquées comptent, jamais les symboles.
    if(!s.ghostFinal)s.ghostEvents.push({type,cells:[...cells]});
  }
  function canAddExtension(s,p=s.turn) {
    const pl=s.players[p];
    if(!pl)return false;
    const points=slots(s,p,'charged');
    const addRoom=Math.max(0,effectLimit(s,p)-active(s,'add').length);
    return points>0&&addRoom>0&&exteriorAvailable(s).length>0;
  }
  function hasLegalAction(s,p=s.turn) {
    if(!s.players[p])return false;
    // Tant qu'une case jouable est vide, la manche continue normalement.
    if(legalCells(s).some(k=>!s.symbols[k]))return true;
    // Règle de plateau plein : seule la création immédiate d'une nouvelle case
    // évite le match nul. Time/Risque/Gambling ne maintiennent pas artificiellement
    // une manche sans emplacement libre.
    return canAddExtension(s,p);
  }
  function finish(s,p,placed=null) {
    s.winner=winning(s);
    if(s.winner)return;
    s.history.push({type:'turn',actor:p});
    expire(s,p);
    if(placed&&playable(s,placed)&&s.symbols[placed]===p)charge(s,p);
    const due=s.pending.filter(e=>e.triggerAfter===p);s.pending=s.pending.filter(e=>e.triggerAfter!==p);
    for(const e of due){try {targets(s,e.owner,e.type,e.cells);s.effects.push({id:s.nextId++,type:e.type,owner:e.owner,cells:e.cells,expiresAtOwnerTurn:ownerTurns(s,e.owner)+1});recordGhostEffect(s,e.type,e.cells);}catch (_) {/* Une cible devenue illégale n'est pas appliquée. */}}
    s.winner=winning(s);
    if(s.winner)return;
    s.turn=opponent(p);s.turnNumber++;
    if(!hasLegalAction(s,s.turn))s.draw=true;
  }
  function play(state, action, random=Math.random) {
    if(state.winner||state.draw)throw Error('Manche terminée');
    const s=clone(state),p=s.turn,pl=s.players[p];let placed=null;
    if(action.type==='place'){if(!playable(s,action.cell)||s.symbols[action.cell])throw Error('Case injouable');s.symbols[action.cell]=p;placed=action.cell;}
    else if(action.type==='effect'){applyEffect(s,p,action.effect,action.cells);}
    else if(action.type==='style') {
      if(pl.styleUsed||['balanced','patient'].includes(pl.style))throw Error('Pouvoir indisponible');
      if(action.style&&action.style!==pl.style)throw Error('Mauvais style');
      if(pl.style==='aggressive'||pl.style==='defensive'){
        applyEffect(s,p,pl.style==='aggressive'?'add':'erase',[action.target]);
        if(!playable(s,action.cell)||s.symbols[action.cell])throw Error('Placement illégal');
        s.symbols[action.cell]=p;placed=action.cell;
      } else if(pl.style==='time'){
        const effect=s.effects.find(e=>e.id===action.effectId&&e.owner===p);
        if(!effect)throw Error('Effet introuvable');effect.expiresAtOwnerTurn++;
      } else if(pl.style==='bomb'){
        targets(s,p,action.effect,action.cells);spend(s,p,action.cells.length);
        s.pending.push({owner:p,type:action.effect,cells:[...action.cells],triggerAfter:opponent(p)});
      } else if(pl.style==='risk') {if(!charge(s,p))throw Error('Aucun emplacement disponible');}
      else if(pl.style==='gambling'){
        const options=legalCells(s);if(!options.length)throw Error('Aucune case');
        const value=Number(random());if(!Number.isFinite(value)||value<0||value>=1)throw Error('Tirage invalide');
        const k=options[Math.floor(value*options.length)];
        if(s.symbols[k]===p)delete s.symbols[k];else{s.symbols[k]=p;placed=k;}
        s.history.push({type:'gambling',actor:p,cell:k});
      }
      pl.styleUsed=true;
    } else if(action.type!=='pass')throw Error('Action inconnue');
    s.history.push({type:'action',actor:p,action:clone(action)});
    finish(s,p,placed);
    return s;
  }
  function buildGhostFinal(history,size) {
    // Le terrain Fantôme cumule chaque case ajoutée, sans fusionner les
    // activations d'une même manche et sans créer de rangées artificiellement
    // vides. Chaque position du bord possède sa propre profondeur :
    // - deux ajouts en (-1,1) donnent (-1,1) et (-2,1) ;
    // - un ajout en (-1,0) et un en (-1,1) remplissent la même colonne -1.
    // La reconstruction suit l'ordre réel des effets, toutes manches confondues.
    const permanentCells=new Set(),permanentErased=new Set();
    const lanes={
      left:new Map(),right:new Map(),top:new Map(),bottom:new Map()
    };
    for(const events of history||[]){
      // Les coordonnées des cases temporaires se réutilisent entre activations.
      // On retient la dernière incarnation pour une Neutralisation ultérieure
      // *de la même manche*, sans toucher à une autre incarnation plus ancienne.
      const latestInRound=new Map();
      for(const event of events||[]){
        if(!event||!['add','erase'].includes(event.type)||!Array.isArray(event.cells))continue;
        for(const rawCell of new Set(event.cells)){
          const [x,y]=xy(rawCell);
          if(event.type==='erase'){
            if(base({size},x,y))permanentErased.add(rawCell);
            else if(latestInRound.has(rawCell))permanentErased.add(latestInRound.get(rawCell));
            continue;
          }
          let side,pos;
          if(x===-1&&y>=0&&y<size){side='left';pos=y;}
          else if(x===size&&y>=0&&y<size){side='right';pos=y;}
          else if(y===-1&&x>=0&&x<size){side='top';pos=x;}
          else if(y===size&&x>=0&&x<size){side='bottom';pos=x;}
          else continue;
          const lane=lanes[side];
          const depth=(lane.get(pos)||0)+1;
          lane.set(pos,depth);
          const mapped=side==='left'?key(-depth,pos)
            :side==='right'?key(size-1+depth,pos)
            :side==='top'?key(pos,-depth)
            :key(pos,size-1+depth);
          permanentCells.add(mapped);
          latestInRound.set(rawCell,mapped);
        }
      }
    }
    return {permanentCells:[...permanentCells],permanentErased:[...permanentErased]};
  }
  function newRound(state,first='X',ghostMode=false,nextRound=2,bestOf=3) {
    const next=initial(state.size,{X:state.players.X.style,O:state.players.O.style},first);
    if(ghostMode&&[3,5].includes(bestOf)&&nextRound>=2&&nextRound<=bestOf){
      next.ghostHistory=[...(state.ghostHistory||[]).map(round=>clone(round)),clone(state.ghostEvents||[])];
      next.ghostFinal=nextRound===bestOf;
      if(next.ghostFinal){
        Object.assign(next,buildGhostFinal(next.ghostHistory,next.size));
        // On repart sans les symboles X/O ni les effets temporaires des autres manches.
        if(!legalCells(next).length)next.draw=true;
      }
    }
    return next;
  }
  return Object.freeze({STYLES,initial,play,newRound,key,xy,legalCells,winning,winningLine,slots,exists,erased,playable,effectLimit,hasLegalAction,canAddExtension,exteriorAvailable,bounds,buildGhostFinal});
});
