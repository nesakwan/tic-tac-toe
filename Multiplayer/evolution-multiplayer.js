(() => {
  'use strict';

  const E = globalThis.TTTEvolution;
  const socket = typeof io === 'function' ? io() : null;
  if (!E || !socket) return;

  const PREPARATION_STORAGE_KEY = 'tttPreparationState';
  const ONLINE_NAME_KEY = 'tttOnlinePlayerName';
  const SESSION_KEY = 'tttEvolutionOnlineSession';
  const $ = (id) => document.getElementById(id);

  const styleCatalog = {
    aggressive: ['AGRESSIF', 'Ajout + placement', '#ff647c'],
    defensive: ['DÉFENSIF', 'Neutralisation + placement', '#4fa8ff'],
    balanced: ['ÉQUILIBRÉ', '1 point au départ', '#9b75ff'],
    patient: ['PATIENT', '4 emplacements / 4 cases', '#42d3a7'],
    time: ['TIME', 'Prolonge le dernier effet', '#42c8ff'],
    bomb: ['BOMB', 'Effet différé secret', '#ff8a4d'],
    risk: ['RISQUE', 'Tour contre ressource', '#f2c94c'],
    gambling: ['GAMBLING', 'Case aléatoire', '#f56bd6']
  };

  let preparation = {};
  try { preparation = JSON.parse(sessionStorage.getItem(PREPARATION_STORAGE_KEY) || '{}') || {}; } catch {}

  let currentRoom = null;
  let mySymbol = null;
  let myToken = null;
  let myName = 'Joueur';
  let hostSymbol = 'X';
  let roomPlayers = { X: 'Joueur X', O: 'Joueur O' };
  let roomStyles = { X: 'balanced', O: 'balanced' };
  let roomCosmetics = { X: { style:'classic', theme:'blue' }, O: { style:'classic', theme:'pink' } };
  let roomReady = { X: false, O: false };
  let boardSize = 3;
  let bestOf = 1;
  let ghostMode = false;
  let turnTime = 0;
  let turnDeadline = null;
  let timerRemainingOnSync = null;
  let timerSyncedAt = 0;
  let feedbackTimeout = null;
  let scores = { X: 0, O: 0, draw: 0 };
  let round = 1;
  let status = 'lobby';
  let evo = null;
  let winningLine = [];
  let matchFinished = false;
  let mode = 'place';
  let chosen = [];
  let pendingStylePlacement = false;
  let selectedEffect = 'add';
  let awaitingGambling = false;
  let gamblingAnimationToken = 0;
  let lastGambleSignature = '';
  let actionPending = false;
  let ghostRevealRound = null;
  let ghostRevealTimer = null;
  let ghostRevealing = false;
  let replayFrames = [];
  let replayIndex = 0;
  let replayMode = 'action';
  let replayActive = false;
  let timerInterval = null;
  let pingInterval = null;

  const els = {
    lobby: $('lobby'), game: $('game'), coin: $('coin-toss'),
    create: $('create-room'), join: $('join-room'), codeInput: $('room-code-input'), nameInput: $('player-name-input'),
    roomInfo: $('room-info'), lobbyActions: $('lobby-actions'), lobbyMessage: $('lobby-message'), roomCode: $('room-code'),
    playerX: $('lobby-player-x'), playerO: $('lobby-player-o'), readyX: $('lobby-ready-x'), readyO: $('lobby-ready-o'),
    hostBadge: $('host-badge'), size: $('room-board-size'), bo: $('room-best-of'), time: $('room-turn-time'), ghostToggle: $('room-ghost-mode'), ghostWrap: $('room-ghost-wrap'),
    rulesSummary: $('room-rules-summary'), rulesChange: $('room-rules-change'), waiting: $('waiting-message'), ready: $('ready-button'),
    resumeBanner: $('resume-banner'), resumeSummary: $('resume-summary'), resume: $('resume-session'), forget: $('forget-session'),
    copyCode: $('copy-room-code'), copyLink: $('copy-room-link'),
    connectionStatus: $('connection-status'), connectionDot: $('connection-dot'), quality: $('network-quality'), qualityLabel: $('network-quality-label'), pingValue: $('network-ping-value'),
    coinVisual: $('coin'), tossSubtitle: $('coin-toss-subtitle'), tossResult: $('coin-toss-result'),
    board: $('board'), xInfo: $('x-info'), oInfo: $('o-info'), message: $('message'), round: $('round'), score: $('score'),
    place: $('place'), add: $('add'), erase: $('erase'), style: $('style'), cancel: $('cancel'), amountWrap: $('amount-wrap'), amount: $('amount'), bombWrap: $('bomb-wrap'), bombEffect: $('bomb-effect'), confirm: $('confirm'), hint: $('hint'), effects: $('effects-list'),
    replay: $('replay'), changeMode: $('change-mode'), abandon: $('abandon'), gameMessage: $('game-message'),
    result: $('evo-result-popup'), resultIcon: $('evo-result-icon'), resultKicker: $('evo-result-kicker'), resultTitle: $('evo-result-title'), resultMessage: $('evo-result-message'), resultClose: $('evo-result-close'), resultNext: $('evo-result-next'), resultReplay: $('evo-result-replay'), resultChange: $('evo-result-change'), resultHome: $('evo-result-home'),
    replayPanel: $('evo-replay'), replayLabel: $('evo-replay-label'), replayProgress: $('evo-replay-progress'), replayStart: $('evo-replay-start'), replayPrev: $('evo-replay-prev'), replayNext: $('evo-replay-next'), replayEnd: $('evo-replay-end'), replayClose: $('evo-replay-close'), replayCloseBottom: $('evo-replay-close-bottom'), replayModeAction: $('evo-replay-mode-action'), replayModeTurn: $('evo-replay-mode-turn'),
    timer: $('turn-timer'), timerBar: $('turn-timer-bar'), timerValue: $('turn-timer-value'),
    dice: $('dice-overlay'), diceCube: $('dice-cube'), diceResult: $('dice-result'), diceSub: $('dice-subtext')
  };

  const key = (x, y) => `${x},${y}`;
  const xy = (cell) => String(cell).split(',').map(Number);
  const opponent = (p) => p === 'X' ? 'O' : 'X';
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function normalizeName(value) {
    return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
  }

  function initialName() {
    const profile = globalThis.TTTPlayerData?.getProfile?.();
    return normalizeName(localStorage.getItem(ONLINE_NAME_KEY))
      || normalizeName(profile?.name)
      || normalizeName(preparation.localPlayer1Name)
      || 'Joueur';
  }

  function myCosmetic(symbol) {
    const profile = globalThis.TTTPlayerData?.getProfile?.();
    return globalThis.TTTPlayerData?.cosmeticForSymbol?.(profile, symbol)
      || { style: 'classic', theme: symbol === 'O' ? 'pink' : 'blue' };
  }

  function saveSession() {
    if (!currentRoom || !myToken || !mySymbol) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ code: currentRoom, token: myToken, symbol: mySymbol, name: myName }));
  }

  function clearSession() { localStorage.removeItem(SESSION_KEY); }
  function savedSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }

  function setFeedback(message = '', { neutral = false, lifetime = 5500 } = {}) {
    clearTimeout(feedbackTimeout);
    for (const el of [els.gameMessage, els.lobbyMessage]) {
      if (!el) continue;
      el.textContent = message;
      el.classList.toggle('feedback-notice', neutral);
    }
    if (message && lifetime > 0) {
      feedbackTimeout = setTimeout(() => setFeedback(), lifetime);
    }
  }

  function setReadyVisual(el, ready) {
    if (!el) return;
    el.textContent = ready ? '● PRÊT' : '○ PAS PRÊT';
    el.classList.toggle('is-ready', Boolean(ready));
  }

  const lobbyStyleIcons = {
    aggressive:'⚔', defensive:'◆', balanced:'◈', patient:'⌛',
    time:'⏱', bomb:'✹', risk:'▲', gambling:'⚄'
  };

  function updateStyleNav(symbol) {
    const track = $(`lobby-styles-${symbol.toLowerCase()}`);
    const prev = document.querySelector(`[data-style-prev="${symbol}"]`);
    const next = document.querySelector(`[data-style-next="${symbol}"]`);
    if (!track || !prev || !next) return;
    prev.disabled = track.scrollLeft < 6;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 6;
  }

  function renderLobbyStyleCards(symbol) {
    const host = $(`lobby-styles-${symbol.toLowerCase()}`);
    if (!host) return;
    const previousScroll = host.scrollLeft;
    host.replaceChildren();
    const mine = symbol === mySymbol;
    host.closest('.evo-lobby-style-player')?.classList.toggle('is-mine', mine);

    for (const [id, [title, subtitle, accent]] of Object.entries(styleCatalog)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `evo-mini-style${roomStyles[symbol] === id ? ' active' : ''}`;
      button.style.setProperty('--style-accent', accent);
      button.disabled = !mine || status !== 'lobby';
      button.setAttribute('aria-pressed', String(roomStyles[symbol] === id));
      button.innerHTML = `<span class="evo-style-icon" aria-hidden="true">${lobbyStyleIcons[id]}</span><strong>${title}</strong><small>${subtitle}</small>`;
      if (mine) {
        button.addEventListener('click', () => {
          if (status !== 'lobby' || roomStyles[symbol] === id) return;
          socket.emit('setEvolutionStyle', { style: id });
        });
      }
      host.append(button);
    }

    const activeStyle = roomStyles[symbol];
    if (host.dataset.centeredStyle !== activeStyle) {
      host.dataset.centeredStyle = activeStyle;
      const selectedCard = host.querySelector('.evo-mini-style.active');
      if (selectedCard) host.scrollLeft = Math.max(0, selectedCard.offsetLeft - host.offsetLeft - (host.clientWidth - selectedCard.offsetWidth) / 2);
    } else host.scrollLeft = previousScroll;
    updateStyleNav(symbol);
    const current = $(`style-current-${symbol.toLowerCase()}`);
    const owner = $(`style-owner-${symbol.toLowerCase()}`);
    const selection = $(`evo-style-selected-${symbol.toLowerCase()}`);
    const [name, desc, color] = styleCatalog[roomStyles[symbol]] || styleCatalog.balanced;
    if (current) current.textContent = name;
    if (owner) owner.textContent = roomPlayers[symbol] || `Joueur ${symbol}`;
    if (selection) {
      selection.replaceChildren();
      const label = document.createElement('strong');
      label.textContent = name;
      selection.style.setProperty('--selected-accent', color);
      const description = document.createElement('span');
      description.textContent = desc;
      selection.append(label, description);
    }
  }

  for (const symbol of ['X','O']) {
    const track = $(`lobby-styles-${symbol.toLowerCase()}`);
    track?.addEventListener('scroll', () => updateStyleNav(symbol), { passive: true });
    for (const direction of ['prev','next']) {
      const arrow = document.querySelector(`[data-style-${direction}="${symbol}"]`);
      arrow?.addEventListener('click', () => {
        track?.scrollBy({ left: (direction === 'prev' ? -1 : 1) * Math.max(180, track.clientWidth * .72), behavior:'smooth' });
      });
    }
  }

  function updateRoomSummary() {
    const timeText = turnTime ? `${turnTime} s / tour` : 'Sans chrono';
    els.rulesSummary.textContent = `${boardSize} × ${boardSize} • BO${bestOf} • ${timeText} • Évolution${ghostMode ? " · FANTÔME ✧" : ""}`;
  }

  function updateLobby(data) {
    if (data.gameVariant && data.gameVariant !== 'evolution') {
      setFeedback('Cette salle appartient au mode Classique. Utilise le lobby Classique pour la rejoindre.');
      return;
    }
    setFeedback();
    currentRoom = data.code || currentRoom;
    hostSymbol = data.hostSymbol || hostSymbol;
    boardSize = Number(data.boardSize) === 4 ? 4 : 3;
    bestOf = [1,3,5].includes(Number(data.bestOf)) ? Number(data.bestOf) : 1;
    ghostMode = data.ghostMode === true && bestOf > 1;
    turnTime = [0,10,20,30].includes(Number(data.turnTime)) ? Number(data.turnTime) : 0;
    roomPlayers = data.players || roomPlayers;
    roomStyles = data.evolutionStyles || roomStyles;
    roomCosmetics = data.cosmetics || roomCosmetics;
    roomReady = data.ready || roomReady;
    status = data.status || 'lobby';
    scores = data.scores || scores;
    round = Number(data.round) || round;

    els.lobby.hidden = false;
    els.game.hidden = true;
    els.coin.hidden = true;
    els.lobbyActions.hidden = true;
    els.roomInfo.hidden = false;
    els.roomCode.textContent = currentRoom || '----';
    els.playerX.textContent = roomPlayers.X || 'En attente...';
    els.playerO.textContent = roomPlayers.O || 'En attente...';
    setReadyVisual(els.readyX, roomReady.X);
    setReadyVisual(els.readyO, roomReady.O);

    els.size.value = String(boardSize);
    els.bo.value = String(bestOf);
    els.time.value = String(turnTime);
    els.ghostWrap.hidden = bestOf === 1;
    els.ghostToggle.checked = ghostMode;
    els.ghostToggle.disabled = mySymbol !== hostSymbol;
    const amHost = mySymbol === hostSymbol;
    els.size.disabled = !amHost;
    els.bo.disabled = !amHost;
    els.time.disabled = !amHost;
    els.hostBadge.hidden = hostSymbol !== 'X';
    updateRoomSummary();
    renderLobbyStyleCards('X');
    renderLobbyStyleCards('O');

    const myReady = Boolean(roomReady[mySymbol]);
    els.ready.disabled = !roomPlayers.X || !roomPlayers.O;
    els.ready.textContent = myReady ? 'ANNULER PRÊT' : 'JE SUIS PRÊT';
    els.ready.classList.toggle('is-ready', myReady);
    els.waiting.textContent = !roomPlayers.O
      ? 'En attente d’un adversaire...'
      : roomReady.X && roomReady.O
        ? 'Les deux joueurs sont prêts. Lancement du tirage...'
        : 'Choisissez vos Styles puis passez tous les deux en prêt.';
    saveSession();
  }

  function showLobbyHome() {
    setFeedback();
    turnDeadline = null;
    timerRemainingOnSync = null;
    els.resumeBanner.hidden = true;
    els.lobby.hidden = false;
    els.game.hidden = true;
    els.coin.hidden = true;
    els.roomInfo.hidden = true;
    els.lobbyActions.hidden = false;
    status = 'lobby';
    stopTimer();
  }

  function currentState(data) {
    if (data?.evolution) evo = clone(data.evolution);
    if (data?.ghostMode != null) ghostMode = Boolean(data.ghostMode);
    if (data?.players) roomPlayers = data.players;
    if (data?.evolutionStyles) roomStyles = data.evolutionStyles;
    if (data?.cosmetics) roomCosmetics = data.cosmetics;
    if (data?.scores) scores = data.scores;
    if (data?.round) round = Number(data.round) || round;
    if (data?.turnTime != null) turnTime = Number(data.turnTime) || 0;
    if ('turnDeadline' in (data || {})) {
      const incomingDeadline = data.turnDeadline;
      turnDeadline = incomingDeadline;
      if (incomingDeadline && Number.isFinite(Number(data.serverTime))) {
        // Horloge commune transmise par le serveur : l'heure locale peut être décalée.
        timerRemainingOnSync = Math.max(0, Number(incomingDeadline) - Number(data.serverTime));
      } else if (incomingDeadline) {
        timerRemainingOnSync = Math.max(0, Number(incomingDeadline) - Date.now());
      } else {
        timerRemainingOnSync = null;
      }
      timerSyncedAt = performance.now();
    }
    if (data?.status) status = data.status;
    if (Array.isArray(data?.winningLine)) winningLine = [...data.winningLine];
    matchFinished = Boolean(data?.matchFinished);
  }

  function hasCell(state, x, y) { return state ? E.exists(state, key(x,y)) : false; }
  function emptyPlayable(state) { return E.legalCells(state).filter(cell => !state.symbols[cell]); }

  function contiguousAddTargets(state, amount, current = []) {
    const all = E.exteriorAvailable(state);
    if (!current.length) return all;
    return all.filter(candidate => {
      const list = [...current, candidate];
      if (new Set(list).size !== list.length || list.length > amount) return false;
      const points = list.map(xy);
      const sameX = points.every(([x]) => x === points[0][0]);
      const sameY = points.every(([,y]) => y === points[0][1]);
      if (!(sameX || sameY)) return false;
      const values = points.map(p => sameX ? p[1] : p[0]).sort((a,b) => a-b);
      return values.every((value, index) => index === 0 || value === values[index-1] + 1);
    });
  }

  function maxEffectAmount(state = evo) {
    if (!state || !mySymbol) return 0;
    const type = mode === 'bomb' ? (els.bombEffect.value || selectedEffect) : mode;
    if (!['add','erase'].includes(type)) return 0;
    const pl = state.players[mySymbol];
    if (!pl) return 0;
    const limit = E.effectLimit(state, mySymbol);
    const charged = pl.slots.filter(v => v === 'charged').length;
    const active = state.effects.filter(effect => effect.type === type)
      .reduce((total, effect) => total + effect.cells.length, 0);
    const available = type === 'add' ? E.exteriorAvailable(state).length
      : Math.max(0, emptyPlayable(state).length - 1);
    return Math.max(0, Math.min(limit, charged, limit - active, available));
  }

  function amountNeeded() {
    const max = maxEffectAmount();
    return max === 0 ? 0 : Math.min(Number(els.amount.value) || 1, max);
  }

  function rebuildAmountOptions(state) {
    if (!state || !mySymbol) return;
    const max = maxEffectAmount(state);
    const previous = Number(els.amount.value) || 1;
    const values = Array.from({length: max}, (_,index) => String(index + 1));
    if (Array.from(els.amount.options).map(o => o.value).join(',') !== values.join(',')) {
      els.amount.replaceChildren();
      for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${value} point${Number(value)>1?'s':''}`;
        els.amount.append(option);
      }
    }
    if (max) els.amount.value = String(Math.min(previous,max));
    els.amount.disabled = max === 0 || actionPending || ghostRevealing || state.turn !== mySymbol;
  }

  function candidates(state = evo) {
    if (!state || replayActive || state.turn !== mySymbol || status !== 'playing') return [];
    if (mode === 'place') return emptyPlayable(state);
    if (mode === 'add') return contiguousAddTargets(state, amountNeeded(), chosen);
    if (mode === 'erase') return emptyPlayable(state);
    if (mode === 'bomb') return selectedEffect === 'add' ? contiguousAddTargets(state, amountNeeded(), chosen) : emptyPlayable(state);
    if (mode === 'aggressive') {
      if (!pendingStylePlacement) return contiguousAddTargets(state, 1, chosen);
      const options = new Set(emptyPlayable(state));
      if (chosen[0]) options.add(chosen[0]);
      return [...options];
    }
    if (mode === 'defensive') {
      if (!pendingStylePlacement) return emptyPlayable(state);
      return emptyPlayable(state).filter(cell => cell !== chosen[0]);
    }
    return [];
  }

  function renderPlayer(symbol, state = evo) {
    const el = symbol === 'X' ? els.xInfo : els.oInfo;
    const pl = state?.players?.[symbol];
    const style = pl?.style || roomStyles[symbol] || 'balanced';
    const slots = (pl?.slots || []).map(v => `<span class="slot ${v}">${v === 'charged' ? '●' : v === 'spent' ? '×' : '○'}</span>`).join('');
    el.classList.toggle('active', status === 'playing' && state?.turn === symbol);
    el.classList.toggle('is-me', symbol === mySymbol);
    el.classList.toggle('opponent', symbol !== mySymbol);
    const passive = ['balanced','patient'].includes(style);
    const statusClass = passive ? 'passive' : pl?.styleUsed ? 'used' : 'ready';
    const statusLabel = passive ? 'Passif actif' : pl?.styleUsed ? 'Pouvoir utilisé' : 'Pouvoir disponible';
    el.classList.toggle('style-is-passive', passive);
    el.innerHTML = `<div class="meta">${symbol === mySymbol ? 'VOUS' : 'ADVERSAIRE'} · ${symbol}</div><h3 style="color:${symbol==='X'?'var(--blue)':'var(--pink)'}">${roomPlayers[symbol] || `Joueur ${symbol}`}</h3><p class="player-style-info"><span>${styleCatalog[style]?.[0] || style.toUpperCase()}</span> · <strong class="style-indicator ${statusClass}">${statusLabel}</strong></p><div class="slots">${slots}</div>`;
  }

  function renderEffects(state = evo) {
    if (!state) return;
    const visible = [...(state.effects || [])];
    const pending = state.pending || [];
    if (!visible.length && !pending.length) { els.effects.textContent = 'Aucun effet actif.'; return; }
    els.effects.innerHTML = '';
    for (const effect of visible) {
      const item = document.createElement('article'); item.className = 'effect-item';
      item.innerHTML = `<span class="effect-id">#${effect.id} · ${effect.type === 'add' ? 'Ajout' : 'Neutralisation'}</span><div>${effect.owner} · ${effect.cells.join(' • ')}</div>`;
      els.effects.append(item);
    }
    for (const effect of pending) {
      const item = document.createElement('article'); item.className = 'effect-item';
      item.innerHTML = `<span class="effect-id">BOMB · effet programmé</span><div>${effect.owner === mySymbol ? 'Votre bombe est armée.' : 'Une bombe adverse est armée.'}</div>`;
      els.effects.append(item);
    }
  }

  function syncBoardMetrics(board, cols, rows) {
    const span = Math.max(cols, rows);
    board.style.setProperty('--cols', String(cols));
    board.style.setProperty('--rows', String(rows));
    board.style.setProperty('--span', String(span));
    board.style.setProperty('--grid', String(span));
  }

  function maybeTriggerGhostReveal(board, currentState) {
    if (!board || !currentState?.ghostFinal || replayActive || status !== 'playing') {
      board?.classList.remove('ghost-reveal-active');
      return;
    }
    const total = (currentState.permanentCells?.length || 0)
      + (currentState.permanentErased?.length || 0);
    if (!total || ghostRevealRound === round) return;
    ghostRevealRound = round;
    ghostRevealing = true;
    clearTimeout(ghostRevealTimer);
    const step = total > 18 ? 65 : 95;
    board.style.setProperty('--ghost-reveal-step', `${step}ms`);
    board.style.setProperty('--ghost-reveal-duration', '840ms');
    board.classList.add('ghost-reveal-active');
    for (const button of board.children) button.disabled = true;
    ghostRevealTimer = setTimeout(() => {
      ghostRevealing = false;
      board.classList.remove('ghost-reveal-active');
      renderGame();
    }, 990 + Math.max(0,total-1)*step);
  }

  function showPowerEffect(style, owner, cells = [], delayed = false) {
    if (replayActive || !['aggressive','defensive','time','bomb','risk','gambling'].includes(style)) return;
    const zone = els.board.closest('.board-zone');
    if (!zone) return;
    const icons = {aggressive:'⚔',defensive:'◆',time:'⏳',bomb:'✹',risk:'▲',gambling:'⚄'};
    const flash = document.createElement('div');
    flash.className = `evo-style-flash fx-${style}`;
    flash.style.setProperty('--skill-color', styleCatalog[style]?.[2] || '#a985ff');
    flash.setAttribute('role','status');
    const label = document.createElement('strong');
    label.textContent = `${icons[style]} ${style.toUpperCase()}${delayed ? ' · DÉCLENCHEMENT' : ''}`;
    const who = document.createElement('small');
    who.textContent = `${roomPlayers[owner] || owner} utilise son pouvoir`;
    flash.append(label,who);
    for (let i=0; i<7; i++) {
      const particle=document.createElement('i');
      particle.className='evo-skill-particle';
      particle.style.setProperty('--p',String(i));
      particle.setAttribute('aria-hidden','true');
      flash.append(particle);
    }
    zone.append(flash);
    for (const cell of cells) {
      const button = Array.from(els.board.children).find(el => el.dataset.cell === cell);
      if (button) {button.classList.add('evo-power-hit');setTimeout(()=>button.classList.remove('evo-power-hit'),900);}
    }
    setTimeout(()=>flash.remove(),1450);
  }

  // La liste pending du serveur reste privée. On repère donc une bombe seulement
  // lorsqu'un nouvel effet s'applique PENDANT le tour de son adversaire.
  function animateStatePower(previous, next) {
    if (!previous || !next || replayActive) return;
    if (!next.history?.length) return;
    const previousActionCount = (previous.history || []).filter(entry => entry.type === 'action').length;
    const currentActionCount = next.history.filter(entry => entry.type === 'action').length;
    if (currentActionCount <= previousActionCount) return;
    const last = [...next.history].reverse().find(entry => entry.type === 'action');
    const actor = last?.actor;
    if (!actor) return;
    const known = new Set(previous.effects.map(effect => effect.id));
    const spawned = next.effects.filter(effect => !known.has(effect.id));
    for (const effect of spawned) {
      if (effect.owner !== actor && next.players[effect.owner]?.style === 'bomb') {
        showPowerEffect('bomb',effect.owner,effect.cells,true);
      }
    }
    if (last.action?.type !== 'style' || last.action.style === 'bomb') return;
    const style = last.action.style;
    let cells = [];
    if (style === 'time') cells = previous.effects.find(effect=>effect.id===last.action.effectId)?.cells || [];
    else if (style === 'aggressive' || style === 'defensive') cells = [last.action.target].filter(Boolean);
    else if (style === 'gambling') cells = [([...next.history].reverse().find(e=>e.type==='gambling'))?.cell].filter(Boolean);
    showPowerEffect(style,actor,cells);
  }

  function renderBoard(state = evo) {
    if (!state) return;
    // Stopper proprement une révélation si le serveur a déjà enregistré un coup.
    if (ghostRevealing && state.ghostFinal && state.turnNumber === 0
        && ghostRevealRound === round && els.board.childElementCount) return;
    if (ghostRevealing && state.turnNumber > 0) {
      ghostRevealing = false;
      clearTimeout(ghostRevealTimer);
      els.board.classList.remove('ghost-reveal-active');
    }
    els.board.replaceChildren();
    const ext=state.effects?.filter(e=>e.type==='add').flatMap(e=>e.cells)||[];
    const available = new Set(candidates(state));
    // La grille englobe seulement le plateau réel et les cases qu'on peut ajouter,
    // et non une bordure fictive entière de chaque côté.
    const original=[...(state.permanentCells||[]),...(state.permanentErased||[]),...ext,...available];
    const b=E.bounds(state),coords=original.map(xy);
    const minX=Math.min(b.minX,...coords.map(([x])=>x));
    const maxX=Math.max(b.maxX,...coords.map(([x])=>x));
    const minY=Math.min(b.minY,...coords.map(([,y])=>y));
    const maxY=Math.max(b.maxY,...coords.map(([,y])=>y));
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    syncBoardMetrics(els.board, cols, rows);
    els.board.classList.toggle('ghost-final-board',Boolean(state.ghostFinal));
    const permanent=new Set(state.permanentCells||[]);
    const erasedPermanent=new Set(state.permanentErased||[]);
    const possible = available;
    const line = new Set(replayActive ? (E.winningLine(state)?.cells || []) : (winningLine || []));

    let ghostOrder = 0;
    for (let y=minY; y<=maxY; y++) for (let x=minX; x<=maxX; x++) {
      const cell = key(x,y);
      const outer = (x<0 || y<0 || x>=state.size || y>=state.size) && !permanent.has(cell);
      const exists = hasCell(state,x,y);
      const playable = exists && E.playable(state,cell);
      const symbol = state.symbols[cell] || '';
      const isPermanent=permanent.has(cell);
      const isVoid=erasedPermanent.has(cell);
      const selected = chosen.includes(cell);
      const selectable = possible.has(cell) || selected;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.cell = cell;
      btn.className = ['cell', outer?'extension':'', !exists&&!isVoid?'ghost':'', exists&&!playable?'disabled':'', symbol==='X'?'x':'', symbol==='O'?'o':'', selected?'target':'', selectable?'selectable':'', line.has(cell)?'winning-cell':'', isPermanent?'ghost-permanent':'', isVoid?'ghost-permanent-void':''].filter(Boolean).join(' ');
      if (selected && mode === 'add') btn.classList.add('add-preview');
      if (selected && mode === 'erase') btn.classList.add('erase-preview');
      if (selected && mode === 'bomb') btn.classList.add('bomb-preview');
      if (selected && mode === 'aggressive') btn.classList.add('aggressive-preview');
      if (selected && mode === 'defensive') btn.classList.add('defensive-preview');
      if (selected) btn.dataset.previewOrder = String(chosen.indexOf(cell)+1);
      if (state.ghostFinal && (isPermanent || isVoid)) btn.style.setProperty('--ghost-order', String(ghostOrder++));
      btn.textContent = symbol || (isVoid?'⊘':'') || (exists&&!playable?'⊘':'');
      if (symbol) globalThis.TTTPlayerData?.applyElementCosmetic?.(btn, symbol, roomCosmetics[symbol] || myCosmetic(symbol));
      // L'ancien rendu montrait une couronne de cases fictives, même impossibles à ajouter.
      // Les seules cases d'aperçu sont maintenant celles que le moteur autorise.
      const hideGhost = isVoid || (!exists && !selectable);
      if (hideGhost) btn.classList.add('hidden-cell');
      btn.disabled = replayActive || ghostRevealing || status !== 'playing' || state.turn !== mySymbol || !selectable || hideGhost;
      btn.addEventListener('click', () => selectCell(cell));
      els.board.append(btn);
    }
    maybeTriggerGhostReveal(els.board, state);
  }

  function renderActions(state = evo) {
    if (!state || !mySymbol) return;
    rebuildAmountOptions(state);
    const mine = state.players[mySymbol];
    const myTurn = status === 'playing' && state.turn === mySymbol && !replayActive;
    const passive = ['balanced','patient'].includes(mine.style);
    const charged = mine.slots?.filter(v => v === 'charged').length || 0;
    const styleNeedsPoint = ['aggressive','defensive','bomb'].includes(mine.style);
    const styleUnavailable = mine.styleUsed || passive || (styleNeedsPoint && charged < 1);
    els.style.hidden = passive;
    els.style.disabled = !myTurn || ghostRevealing || styleUnavailable || actionPending;
    els.style.classList.toggle('style-spent', Boolean(mine.styleUsed));
    els.style.textContent = mine.styleUsed ? 'Pouvoir utilisé' : 'Pouvoir de style';
    els.place.disabled = !myTurn || ghostRevealing || actionPending;
    els.add.disabled = !myTurn || ghostRevealing || actionPending || charged < 1;
    els.erase.disabled = !myTurn || ghostRevealing || actionPending || charged < 1;
    els.cancel.disabled = !myTurn || ghostRevealing || actionPending;
    els.amountWrap.hidden = !['add','erase','bomb'].includes(mode);
    els.bombWrap.hidden = mode !== 'bomb';
    els.confirm.hidden = !['add','erase','bomb'].includes(mode) || amountNeeded() === 0 || chosen.length !== amountNeeded();
    els.confirm.disabled = !myTurn || ghostRevealing || actionPending;
    const actionBox = els.place.closest('.side-panel');
    actionBox?.classList.toggle('online-turn-lock', !myTurn && !replayActive);

    if (!myTurn) {
      els.hint.textContent = state.turn ? `Au tour de ${roomPlayers[state.turn]} (${state.turn}).` : 'La manche est terminée.';
    } else {
      const hints = {
        place:'Posez votre symbole sur une case libre.',
        add:'Sélectionnez des cases extérieures contiguës puis confirmez.',
        erase:'Sélectionnez les cases vides à neutraliser puis confirmez.',
        bomb:'Votre sélection est privée : l’adversaire ne verra que le résultat au déclenchement.',
        aggressive: pendingStylePlacement ? 'Choisissez maintenant la case où poser votre symbole.' : 'Choisissez la case extérieure à ajouter.',
        defensive: pendingStylePlacement ? 'Choisissez maintenant la case où poser votre symbole.' : 'Choisissez la case vide à neutraliser.'
      };
      els.hint.textContent = hints[mode] || 'Choisissez une action.';
    }
  }

  function renderGame(state = evo) {
    if (!state) return;
    // Le coût doit être synchronisé AVANT le calcul des cibles de la grille.
    rebuildAmountOptions(state);
    renderPlayer('X',state); renderPlayer('O',state); renderBoard(state); renderActions(state); renderEffects(state);
    els.message.textContent = matchFinished
      ? (scores.X === scores.O ? 'Match nul' : `${roomPlayers[scores.X > scores.O ? 'X' : 'O']} remporte le match`)
      : status === 'playing'
        ? `Au tour de ${roomPlayers[state.turn]} (${state.turn})`
        : 'Manche terminée';
    els.round.textContent = `MANCHE ${round} · BO${bestOf}${state.ghostFinal ? ' · ✧ FINALE FANTÔME' : ''}`;
    els.score.textContent = `${roomPlayers.X} ${scores.X} — ${scores.O} ${roomPlayers.O} · Nuls ${scores.draw}`;
  }

  function setMode(next) {
    mode = next;
    chosen = [];
    pendingStylePlacement = false;
    selectedEffect = els.bombEffect.value || selectedEffect;
    [els.place,els.add,els.erase,els.style,els.cancel].forEach(b => b?.classList.toggle('selected', b?.id === next));
    renderGame();
  }

  function sendAction(action) {
    if (!currentRoom || !evo || evo.turn !== mySymbol || status !== 'playing' || ghostRevealing || actionPending) return;
    actionPending = true;
    renderActions();
    socket.emit('playEvolutionAction', { code: currentRoom, action });
  }

  function selectCell(cell) {
    if (!evo || evo.turn !== mySymbol || status !== 'playing') return;
    if (mode === 'place') { sendAction({ type:'place', cell }); return; }
    if (mode === 'aggressive' || mode === 'defensive') {
      if (!pendingStylePlacement) { chosen = [cell]; pendingStylePlacement = true; renderGame(); return; }
      sendAction({ type:'style', style:mode, target:chosen[0], cell });
      return;
    }
    const needed = amountNeeded();
    if (chosen.includes(cell)) chosen = chosen.filter(x => x !== cell);
    else if (chosen.length < needed) chosen.push(cell);
    renderGame();
  }

  function styleAction() {
    if (!evo || evo.turn !== mySymbol) return;
    const pl = evo.players[mySymbol];
    if (pl.styleUsed || ['balanced','patient'].includes(pl.style)) return;
    if (pl.style === 'aggressive' || pl.style === 'defensive') { setMode(pl.style); return; }
    if (pl.style === 'bomb') { setMode('bomb'); return; }
    if (pl.style === 'time') {
      const owned = (evo.effects || []).filter(e => e.owner === mySymbol).sort((a,b) => b.id-a.id);
      if (!owned.length) { setFeedback('Aucun effet actif à prolonger.'); return; }
      sendAction({ type:'style', style:'time', effectId:owned[0].id });
      return;
    }
    if (pl.style === 'risk') { sendAction({ type:'style', style:'risk' }); return; }
    if (pl.style === 'gambling') { awaitingGambling = true; sendAction({ type:'style', style:'gambling' }); }
  }

  function confirmAction() {
    if (!chosen.length || chosen.length !== amountNeeded()) return;
    if (mode === 'add' || mode === 'erase') sendAction({ type:'effect', effect:mode, cells:[...chosen] });
    else if (mode === 'bomb') sendAction({ type:'style', style:'bomb', effect:selectedEffect, cells:[...chosen] });
  }

  async function animateGambling(cell) {
    if (!cell || replayActive) return;
    const token = ++gamblingAnimationToken;
    const [x,y] = xy(cell);
    els.dice.hidden = false;
    els.diceCube.classList.add('rolling');
    els.diceResult.textContent = 'La case a été tirée au sort !';
    els.diceSub.textContent = 'La sélection a été effectuée par le serveur.';
    const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    let index = 0;
    const interval = setInterval(() => { els.diceCube.textContent = faces[index++ % faces.length]; }, 100);
    await new Promise(resolve => setTimeout(resolve, 650));
    clearInterval(interval);
    if (token !== gamblingAnimationToken) return;
    els.diceCube.classList.remove('rolling');
    els.diceCube.textContent = '⚄';
    // Aucun faux numéro de dé : ce sont les vraies coordonnées choisies par le moteur.
    els.diceResult.textContent = `Ligne ${y+1} · Colonne ${x+1}`;
    els.diceSub.textContent = `Case (${x}, ${y}) sélectionnée par le serveur.`;
    await new Promise(resolve => setTimeout(resolve, 750));
    if (token === gamblingAnimationToken) els.dice.hidden = true;
  }

  function displayResolvedGamble(previous, next) {
    if (!next?.history || !previous || replayActive) return false;
    const oldCount = previous.history?.filter(event => event.type === 'gambling').length || 0;
    const drawn = next.history.filter(event => event.type === 'gambling');
    if (drawn.length <= oldCount) return false;
    const latest = drawn.at(-1);
    const signature = `${round}:${drawn.length}:${latest.actor}:${latest.cell}`;
    if (signature === lastGambleSignature) return false;
    lastGambleSignature = signature;
    awaitingGambling = false;
    animateGambling(latest.cell);
    return true;
  }

  function stopTimer({ hide = true } = {}) {
    if (timerInterval !== null) clearInterval(timerInterval);
    timerInterval = null;
    if (hide && els.timer) els.timer.hidden = true;
  }
  function syncTimer() {
    // Ne pas masquer/remontrer le chrono à chaque état réseau : évite le flash visuel.
    stopTimer({ hide: false });
    if (!turnDeadline || !turnTime || status !== 'playing' || timerRemainingOnSync === null) {
      if (els.timer) els.timer.hidden = true;
      return;
    }
    const tick = () => {
      // performance.now() n'est pas modifié par l'heure du PC ni les réglages OS.
      const elapsed = Math.max(0, performance.now() - timerSyncedAt);
      const remaining = Math.max(0, timerRemainingOnSync - elapsed);
      const ratio = Math.max(0, Math.min(1, remaining / (turnTime * 1000)));
      els.timer.hidden = false;
      els.timerBar.style.transform = `scaleX(${ratio})`;
      els.timerValue.textContent = `${Math.ceil(remaining / 1000)} s`;
      if (remaining <= 0 && timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
        // Laisser 0 s visible jusqu'à ce que le serveur annonce le tour suivant.
      }
    };
    tick();
    if (timerRemainingOnSync > 0) timerInterval = setInterval(tick, 100);
  }

  function showCoinToss(data) {
    currentState(data);
    els.lobby.hidden = true; els.game.hidden = true; els.coin.hidden = false;
    const starter = data.starterSymbol || data.turn;
    const name = data.starterName || roomPlayers[starter] || starter;
    els.tossSubtitle.textContent = 'La pièce s’envole...';
    els.tossResult.textContent = 'TIRAGE...';
    els.coinVisual.classList.remove('is-tossing','lands-x','lands-o');
    void els.coinVisual.offsetWidth;
    els.coinVisual.classList.add('is-tossing');
    setTimeout(() => {
      els.coinVisual.classList.remove('is-tossing');
      els.coinVisual.classList.add(starter === 'X' ? 'lands-x' : 'lands-o');
      els.tossSubtitle.textContent = 'Le tirage est terminé';
      els.tossResult.textContent = `${name} commence — ${starter}`;
    }, Math.max(1200, Number(data.duration || 3600)-300));
  }

  function showGame(data) {
    if (Number(data?.round) === 1) {
      ghostRevealRound = null;
      ghostRevealing = false;
      lastGambleSignature = '';
      gamblingAnimationToken += 1;
      els.dice.hidden = true;
      clearTimeout(ghostRevealTimer);
    }
    currentState(data);
    els.lobby.hidden = true; els.coin.hidden = true; els.game.hidden = false;
    els.result.hidden = true;
    els.game.classList.remove('evo-scene-arrive');
    void els.game.offsetWidth;
    els.game.classList.add('evo-scene-arrive');
    actionPending=false; chosen=[]; pendingStylePlacement=false; mode='place'; replayActive=false; els.replayPanel.classList.remove('is-open');
    renderGame(); syncTimer();
  }

  function isMeWinner(winner) { return winner && winner === mySymbol; }
  function showResult(data, matchEnd=false) {
    const previous = evo;
    currentState(data);
    els.lobby.hidden = true; els.coin.hidden = true; els.game.hidden = false;
    renderGame();
    animateStatePower(previous, evo); stopTimer();
    const resolvedGamble = displayResolvedGamble(previous, evo);
    // Laisser apparaître la vraie case tirée avant le résultat si Gambling a terminé la manche.
    const outcomeRound = round;
    els.result.hidden = true;
    if (resolvedGamble) setTimeout(() => {
      if (round !== outcomeRound || !['round_end','match_end'].includes(status)) return;
      void els.result.offsetWidth;
      els.result.hidden = false;
    }, 1450);
    else { void els.result.offsetWidth; els.result.hidden = false; }
    els.result.classList.remove('result-victory','result-defeat','result-draw');
    const winner = matchEnd ? (data.matchWinner || null) : (data.winner || evo?.winner || null);
    const draw = !winner;
    els.resultKicker.textContent = matchEnd ? 'RÉSULTAT DU MATCH' : 'RÉSULTAT DE LA MANCHE';
    if (draw) {
      els.result.classList.add('result-draw'); els.resultIcon.textContent='🤝'; els.resultTitle.textContent = matchEnd ? 'MATCH NUL !' : 'MANCHE NULLE';
      els.resultMessage.textContent = 'Aucun joueur ne prend l’avantage sur cette manche.';
    } else if (isMeWinner(winner)) {
      els.result.classList.add('result-victory'); els.resultIcon.textContent='🏆'; els.resultTitle.textContent = matchEnd ? `${roomPlayers[winner]} A GAGNÉ !` : 'VICTOIRE !';
      els.resultMessage.textContent = matchEnd ? `Vous remportez le BO${bestOf}.` : `${roomPlayers[winner]} (${winner}) remporte la manche.`;
    } else {
      els.result.classList.add('result-defeat'); els.resultIcon.textContent='💥'; els.resultTitle.textContent = matchEnd ? 'DÉFAITE' : 'MANCHE PERDUE';
      els.resultMessage.textContent = matchEnd ? `${roomPlayers[winner]} remporte le BO${bestOf}.` : `${roomPlayers[winner]} (${winner}) remporte la manche.`;
    }
    els.resultNext.disabled = !matchEnd;
    els.resultNext.textContent = matchEnd ? '↻ REVANCHE' : 'MANCHE SUIVANTE AUTOMATIQUE…';
    replayFrames = clone(data.evolutionFrames || data.evolutionRoundHistory?.at?.(-1)?.frames || replayFrames || []);
  }

  function replayIndices() {
    if (replayMode === 'action') return replayFrames.map((_,i)=>i);
    const out=[0];
    let lastActor=null;
    for (let i=1;i<replayFrames.length;i++) {
      const actor = replayFrames[i].actor;
      if (actor && actor !== lastActor) out.push(i);
      lastActor = actor || lastActor;
    }
    if (out.at(-1) !== replayFrames.length-1) out.push(replayFrames.length-1);
    return [...new Set(out)];
  }

  function renderReplay() {
    if (!replayFrames.length) return;
    const indices = replayIndices();
    replayIndex = Math.max(0,Math.min(replayIndex,indices.length-1));
    const actual = indices[replayIndex];
    const frame = replayFrames[actual];
    renderBoard(frame.state); renderPlayer('X',frame.state); renderPlayer('O',frame.state); renderEffects(frame.state);
    els.replayLabel.textContent = frame.label || 'Action';
    els.replayProgress.textContent = `${replayMode === 'action' ? 'Action' : 'Tour'} ${replayIndex} / ${Math.max(0,indices.length-1)}`;
    els.replayStart.disabled = replayIndex===0; els.replayPrev.disabled=replayIndex===0; els.replayNext.disabled=replayIndex===indices.length-1; els.replayEnd.disabled=replayIndex===indices.length-1;
  }

  function openReplay() {
    if (!replayFrames.length) { setFeedback('Aucun replay disponible pour cette manche.'); return; }
    replayActive=true; replayIndex=0; replayMode='action'; els.replayModeAction.checked=true; els.replayPanel.classList.add('is-open'); els.result.hidden=true; renderReplay();
  }
  function closeReplay() { replayActive=false; els.replayPanel.classList.remove('is-open'); renderGame(); }

  function applyServerState(data) {
    const previous = evo;
    currentState(data);
    if (data.gameVariant && data.gameVariant !== 'evolution') return;
    els.lobby.hidden=true; els.coin.hidden=true; els.game.hidden=false;
    actionPending=false; chosen=[]; pendingStylePlacement=false; mode='place';
    renderGame(); syncTimer();
    animateStatePower(previous, evo);
    displayResolvedGamble(previous, evo);
  }

  function leaveAndGo(url) { if (currentRoom) socket.emit('leaveRoom'); clearSession(); location.href=url; }

  // Paramètres intégrés : aucun changement de page => le socket, le timer et la salle restent actifs.
  const settingsModal = $('evo-settings-modal');
  const settingsToggle = $('evo-settings-sound');
  const settingsVolume = $('evo-settings-volume');
  const settingsVolumeLabel = $('evo-settings-volume-text');
  const settingsLanguage = $('evo-settings-language');
  let lastSettingsFocus = null;
  function openSettings(event) {
    event?.preventDefault();
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tttSettings') || '{}') || {}; } catch (_) {}
    settingsToggle.checked = saved.soundEnabled !== false;
    settingsVolume.value = Number.isFinite(Number(saved.volume)) ? String(Math.max(0, Math.min(100, Number(saved.volume)))) : '70';
    settingsVolumeLabel.textContent = `${settingsVolume.value} %`;
    settingsLanguage.value = ['fr','en','es','de'].includes(saved.language) ? saved.language : 'fr';
    lastSettingsFocus = document.activeElement;
    settingsModal.hidden = false;
    $('evo-settings-close').focus();
  }
  function closeSettings() {
    settingsModal.hidden = true;
    lastSettingsFocus?.focus?.();
  }
  function saveInlineSettings() {
    const settings = {soundEnabled: settingsToggle.checked, volume:Number(settingsVolume.value), language:settingsLanguage.value};
    settingsVolumeLabel.textContent = `${settings.volume} %`;
    localStorage.setItem('tttSettings', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('ttt-settings-changed',{detail:settings}));
  }
  $('settings-button')?.addEventListener('click',openSettings);
  $('evo-settings-close')?.addEventListener('click',closeSettings);
  $('evo-settings-done')?.addEventListener('click',closeSettings);
  settingsModal?.addEventListener('click',event=>{if(event.target===settingsModal)closeSettings();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && !settingsModal.hidden)closeSettings();});
  for(const setting of [settingsToggle,settingsVolume,settingsLanguage]) setting?.addEventListener('input',saveInlineSettings);

  // Lobby controls
  els.nameInput.value = initialName();
  els.create.addEventListener('click', () => {
    setFeedback();
    myName = normalizeName(els.nameInput.value) || 'Joueur'; localStorage.setItem(ONLINE_NAME_KEY,myName);
    socket.emit('createRoom', { gameVariant:'evolution', name:myName, boardSize:Number(preparation.boardSize)||3, bestOf:Number(preparation.bestOf)||1, turnTime:Number(preparation.turnTime)||0, ghostMode:preparation.ghostMode===true, evolutionStyle:'balanced', cosmetic:myCosmetic('X') });
  });
  els.join.addEventListener('click', () => {
    setFeedback();
    const code=String(els.codeInput.value||'').trim().toUpperCase(); if(code.length!==4){setFeedback('Entre un code de salle à 4 caractères.');return;}
    myName=normalizeName(els.nameInput.value)||'Joueur'; localStorage.setItem(ONLINE_NAME_KEY,myName);
    socket.emit('joinRoom',{gameVariant:'evolution',code,name:myName,evolutionStyle:'balanced',cosmetic:myCosmetic('O')});
  });
  els.codeInput.addEventListener('keydown',e=>{if(e.key==='Enter')els.join.click();});
  function sendLobbySettings() {
    socket.emit('updateRoomSettings', {
      boardSize:Number(els.size.value), bestOf:Number(els.bo.value),
      turnTime:Number(els.time.value), ghostMode:els.ghostToggle.checked && Number(els.bo.value)>1
    });
  }
  els.ghostToggle.addEventListener('change', sendLobbySettings);
  for (const control of [els.size,els.bo,els.time]) control.addEventListener('change', sendLobbySettings);
  els.ready.addEventListener('click',()=>socket.emit('setReady',{ready:!Boolean(roomReady[mySymbol])}));
  els.copyCode.addEventListener('click',async()=>{if(currentRoom)await navigator.clipboard?.writeText?.(currentRoom);});
  els.copyLink.addEventListener('click',async()=>{if(currentRoom)await navigator.clipboard?.writeText?.(`${location.origin}${location.pathname}?room=${currentRoom}`);});

  // Game controls
  els.place.addEventListener('click',()=>setMode('place'));
  els.add.addEventListener('click',()=>setMode('add'));
  els.erase.addEventListener('click',()=>setMode('erase'));
  els.cancel.addEventListener('click',()=>setMode('place'));
  els.style.addEventListener('click',styleAction);
  els.confirm.addEventListener('click',confirmAction);
  els.amount.addEventListener('change',()=>{chosen=[];renderGame();});
  els.bombEffect.addEventListener('change',()=>{selectedEffect=els.bombEffect.value;chosen=[];renderGame();});
  els.replay.addEventListener('click',openReplay);
  els.changeMode.addEventListener('click',()=>leaveAndGo('../Rencontre/rencontre.html'));
  els.abandon.addEventListener('click',()=>{if(confirm('Abandonner le match ?'))socket.emit('forfeitMatch');});

  // Result / replay
  els.resultClose.addEventListener('click',()=>{els.result.hidden=true;});
  els.resultReplay.addEventListener('click',openReplay);
  els.resultChange.addEventListener('click',()=>leaveAndGo('../Rencontre/rencontre.html'));
  els.resultHome.addEventListener('click',()=>leaveAndGo('../index.html'));
  els.resultNext.addEventListener('click',()=>{if(matchFinished)socket.emit('requestRematch');});
  els.replayClose.addEventListener('click',closeReplay); els.replayCloseBottom.addEventListener('click',closeReplay);
  els.replayStart.addEventListener('click',()=>{replayIndex=0;renderReplay();}); els.replayPrev.addEventListener('click',()=>{replayIndex--;renderReplay();}); els.replayNext.addEventListener('click',()=>{replayIndex++;renderReplay();}); els.replayEnd.addEventListener('click',()=>{replayIndex=replayIndices().length-1;renderReplay();});
  els.replayModeAction.addEventListener('change',()=>{replayMode='action';replayIndex=0;renderReplay();}); els.replayModeTurn.addEventListener('change',()=>{replayMode='turn';replayIndex=0;renderReplay();});

  // Reprise
  const session=savedSession();
  if(session?.code&&session?.token){els.resumeBanner.hidden=false;els.resumeSummary.textContent=`Salle ${session.code} • ${session.symbol}`;}
  els.resume.addEventListener('click',()=>{const s=savedSession();if(s){myName=s.name||initialName();socket.emit('resumeRoom',{code:s.code,token:s.token});}});
  els.forget.addEventListener('click',()=>{const s=savedSession();if(s)socket.emit('forfeitSession',{code:s.code,token:s.token});clearSession();els.resumeBanner.hidden=true;});

  // Socket events
  socket.on('connect',()=>{els.connectionStatus.textContent='Connecté au serveur';els.connectionDot.classList.add('online');});
  socket.on('disconnect',()=>{els.connectionStatus.textContent='Connexion interrompue…';els.connectionDot.classList.remove('online');stopTimer();});
  socket.on('roomCreated',data=>{currentRoom=data.code;mySymbol=data.symbol;myToken=data.token;myName=data.name||myName;saveSession();updateLobby(data);});
  socket.on('roomJoined',data=>{if(data.gameVariant!=='evolution'){setFeedback('Cette salle n’est pas une salle Évolution.');return;}currentRoom=data.code;mySymbol=data.symbol;myToken=data.token;myName=data.name||myName;saveSession();updateLobby(data);});
  socket.on('lobbyState',updateLobby);
  socket.on('coinToss',showCoinToss);
  socket.on('gameStart',showGame);
  socket.on('gameState',applyServerState);
  socket.on('roundStart',data=>{currentState(data);els.result.hidden=true;showGame(data);});
  socket.on('roundOver',data=>{replayFrames=clone(data.evolutionFrames||[]);showResult(data,false);});
  socket.on('matchOver',data=>{replayFrames=clone(data.evolutionFrames||data.evolutionRoundHistory?.at?.(-1)?.frames||[]);showResult(data,true);});
  socket.on('turnTimedOut',data=>{actionPending=false;applyServerState(data);setFeedback(`${data.timedOutName||data.timedOutSymbol} a perdu son tour.`);});
  socket.on('gameError',msg=>{actionPending=false;awaitingGambling=false;renderGame();setFeedback(msg);});
  socket.on('roomError',msg=>setFeedback(msg));
  socket.on('resumeFailed',msg=>{clearSession();showLobbyHome();setFeedback(msg);});
  socket.on('roomResumed',data=>{if(data.gameVariant!=='evolution'){clearSession();showLobbyHome();setFeedback('Cette session appartient au mode Classique.');return;}currentRoom=data.code;mySymbol=data.symbol;myToken=data.token||myToken;myName=data.name||myName;saveSession();if(data.status==='lobby')updateLobby(data);else if(data.status==='tossing')showCoinToss({...data,starterSymbol:data.turn,starterName:data.players?.[data.turn]});else if(data.status==='round_end')showResult(data,false);else if(data.status==='match_end')showResult(data,true);else showGame(data);});
  socket.on('opponentTemporaryLeft',data=>setFeedback(data?.message||'Adversaire déconnecté temporairement.'));
  socket.on('opponentReconnected',data=>{applyServerState(data);setFeedback('Adversaire reconnecté.', {neutral:true, lifetime:3200});});
  socket.on('opponentLeft',msg=>{clearSession();currentRoom=null;showLobbyHome();setFeedback(msg||'Votre adversaire a quitté la salle.', {neutral:true, lifetime:4500});});
  socket.on('roomClosed',msg=>{clearSession();currentRoom=null;showLobbyHome();setFeedback(msg||'La salle a été fermée.', {neutral:true, lifetime:4500});});
  socket.on('rematchRequested',data=>{if(confirm(`${data.from||'Votre adversaire'} propose une revanche. Accepter ?`))socket.emit('respondRematch',{accepted:true});else socket.emit('respondRematch',{accepted:false});});
  socket.on('rematchState',state=>{if(state.X&&state.O){els.result.hidden=true;}else els.resultNext.textContent='REVANCHE DEMANDÉE…';});
  socket.on('rematchDeclined',()=>{els.resultNext.textContent='↻ REVANCHE';setFeedback('La revanche a été refusée.');});

  // Ping réseau
  function ping(){const start=performance.now();socket.emit('networkPing',{},()=>{const ms=Math.max(0,Math.round(performance.now()-start));els.pingValue.textContent=`${ms} ms`;els.qualityLabel.textContent=ms<90?'EXCELLENT':ms<180?'BON':'INSTABLE';els.quality.dataset.quality=ms<90?'good':ms<180?'medium':'bad';});}
  socket.on('connect',()=>{ping();if(pingInterval)clearInterval(pingInterval);pingInterval=setInterval(ping,5000);});

  // Lien direct ?room=ABCD
  const linkedCode=new URLSearchParams(location.search).get('room');
  if(linkedCode){els.codeInput.value=String(linkedCode).toUpperCase().slice(0,4);}
  showLobbyHome();
})();
