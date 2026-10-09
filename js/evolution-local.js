(() => {
  'use strict';

  const E = globalThis.TTTEvolution;
  const AI = globalThis.TTTEvolutionAI;
  if (!E) return;

  const PREPARATION_STORAGE_KEY = 'tttPreparationState';
  const $ = (id) => document.getElementById(id);

  const styleCatalog = {
    aggressive: ['AGRESSIF', 'Ajoute 1 case extérieure puis place immédiatement ton symbole.'],
    defensive: ['DÉFENSIF', 'Neutralise 1 case vide puis place immédiatement ton symbole.'],
    balanced: ['ÉQUILIBRÉ', 'Passif : 1 point est chargé au départ de chaque manche.'],
    patient: ['PATIENT', 'Passif : 4 emplacements et jusqu’à 4 cases ajoutées ou neutralisées par effet.'],
    time: ['TIME', 'Prolonge d’un tour un de tes effets actifs.'],
    bomb: ['BOMB', 'Programme un ajout ou une neutralisation pour la fin du tour adverse.'],
    risk: ['RISQUE', 'Passe ton tour une fois pour récupérer 1 point supplémentaire.'],
    gambling: ['GAMBLING', 'Lance un dé : une case aléatoire est modifiée.']
  };

  const styleVisuals = {
    aggressive: { icon: '⚔', type: 'OFFENSIF', accent: '#ff647c', accent2: '#ff9b54' },
    defensive: { icon: '◆', type: 'DÉFENSE', accent: '#4fa8ff', accent2: '#6f7dff' },
    balanced: { icon: '◈', type: 'ÉQUILIBRE', accent: '#9b75ff', accent2: '#d26bff' },
    patient: { icon: '⌛', type: 'RÉSERVE', accent: '#42d3a7', accent2: '#78e59a' },
    time: { icon: '⏱', type: 'TEMPS', accent: '#42c8ff', accent2: '#7d7bff' },
    bomb: { icon: '✹', type: 'RETARDÉ', accent: '#ff8a4d', accent2: '#ff4f70' },
    risk: { icon: '▲', type: 'RISQUE', accent: '#f2c94c', accent2: '#ff7b54' },
    gambling: { icon: '⚄', type: 'HASARD', accent: '#f56bd6', accent2: '#7f75ff' }
  };

  let prep = {};
  let selected = { X: 'balanced', O: 'patient' };
  let state = null;
  let mode = 'place';
  let chosen = [];
  let scores = { X: 0, O: 0, draw: 0 };
  let bestOf = 3;
  let ghostMode = false;
  let round = 1;
  let first = 'X';
  let ended = false;
  let selectedEffect = 'add';
  let pendingStylePlacement = false;
  let previewPlacement = null;
  let highlightedGamble = null;
  let gamblingBusy = false;
  let aiMode = false;
  let aiSymbol = 'O';
  let humanSymbol = 'X';
  let aiDifficulty = 'normal';
  let aiThinking = false;
  let aiPreparationEnabled = false;
  let aiTimer = null;
  let replayHistory = [];
  let replayIndex = 0;
  let replayMode = 'action';
  let replayActive = false;
  let resultShown = false;
  let ghostRevealRound = null;
  let tossSequence = 0;
  let tossing = false;
  let ghostRevealing = false;
  let ghostRevealTimer = null;

  const key = (x, y) => `${x},${y}`;
  const parseKey = (cell) => cell.split(',').map(Number);
  const playerNames = { X: 'Joueur 1', O: 'Joueur 2' };
  const localProfile = globalThis.TTTPlayerData?.getProfile?.() || null;

  function cloneState(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function cosmeticForSymbol(symbol) {
    return globalThis.TTTPlayerData?.cosmeticForSymbol?.(localProfile, symbol)
      || { style: 'classic', theme: symbol === 'O' ? 'pink' : 'blue' };
  }

  function applySymbolCosmetic(element, symbol) {
    if (!element || !symbol) return;
    globalThis.TTTPlayerData?.applyElementCosmetic?.(element, symbol, cosmeticForSymbol(symbol));
  }

  function recordReplay(label, actor = null) {
    replayHistory.push({
      state: cloneState(state),
      label: String(label || 'Action'),
      actor,
      round
    });
  }


  function loadPreparation() {
    try {
      prep = JSON.parse(sessionStorage.getItem(PREPARATION_STORAGE_KEY) || '{}') || {};
    } catch {
      prep = {};
    }

    aiMode = prep.gameMode === 'ai';
    aiDifficulty = ['easy', 'normal', 'hard', 'god'].includes(prep.difficulty) ? prep.difficulty : 'normal';
    humanSymbol = String(prep.aiPlayerSymbol || 'x').toUpperCase() === 'O' ? 'O' : 'X';
    aiSymbol = humanSymbol === 'X' ? 'O' : 'X';

    if (aiMode) {
      playerNames[humanSymbol] = String(prep.aiPlayerName || 'Joueur 1').trim() || 'Joueur 1';
      playerNames[aiSymbol] = String(prep.aiOpponentName || 'IA').trim() || 'IA';
    } else {
      playerNames.X = String(prep.localPlayer1Name || 'Joueur 1').trim() || 'Joueur 1';
      playerNames.O = String(prep.localPlayer2Name || 'Joueur 2').trim() || 'Joueur 2';
    }

    const requestedSize = Number(prep.boardSize) === 4 ? 4 : 3;
    const requestedBestOf = [1, 3, 5].includes(Number(prep.bestOf)) ? Number(prep.bestOf) : 3;

    bestOf = requestedBestOf;
    ghostMode = prep.ghostMode === true && bestOf > 1;
    aiPreparationEnabled = aiMode && prep.evolutionAiPreparation === true;
    if (aiMode && AI) {
      const savedAiStyle = E.STYLES.includes(prep.evolutionAiStyle) ? prep.evolutionAiStyle : null;
      selected[aiSymbol] = aiPreparationEnabled && savedAiStyle
        ? savedAiStyle
        : AI.chooseStyle(aiDifficulty);
    }

    const aiPreparationToggle = $('ai-preparation-toggle');
    const aiPreparationInput = $('ai-preparation');
    if (aiPreparationToggle) aiPreparationToggle.hidden = !aiMode;
    if (aiPreparationInput) aiPreparationInput.checked = aiPreparationEnabled;

    $('summary-format').textContent = `BO${bestOf}${ghostMode ? ' · FANTÔME ✧' : ''}`;
    $('summary-size').textContent = `Plateau ${requestedSize} × ${requestedSize}`;
    $('summary-player-x').textContent = playerNames.X;
    $('summary-player-o').textContent = playerNames.O;
    $('style-name-x').textContent = playerNames.X;
    $('style-name-o').textContent = playerNames.O;
  }

  function updateStyleSummary(player) {
    const host = $(`style-selected-${player.toLowerCase()}`);
    if (!host) return;
    const aiOwned = aiMode && player === aiSymbol;
    if (aiOwned && !aiPreparationEnabled) {
      host.classList.add('mystery-summary');
      host.innerHTML = '<strong>Style IA : ???</strong><em>Le choix reste secret jusqu’au début de la partie.</em>';
      return;
    }
    host.classList.remove('mystery-summary');
    const [title, info] = styleCatalog[selected[player]];
    const visual = styleVisuals[selected[player]];
    host.innerHTML = `<strong style="--summary-accent:${visual.accent}">${title}</strong><em>${info}</em>`;
  }

  function updateStyleCarouselNav(player) {
    const track = $(`styles-${player.toLowerCase()}`);
    const prev = document.querySelector(`[data-style-prev="${player}"]`);
    const next = document.querySelector(`[data-style-next="${player}"]`);
    if (!track || !prev || !next) return;
    const secretAi = aiMode && player === aiSymbol && !aiPreparationEnabled;
    prev.hidden = secretAi;
    next.hidden = secretAi;
    if (secretAi) {
      prev.disabled = true;
      next.disabled = true;
      return;
    }
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= maxScroll - 4;
  }

  function centerSelectedStyle(player, behavior = 'smooth') {
    const track = $(`styles-${player.toLowerCase()}`);
    const active = track?.querySelector('.style-card.active');
    if (!track || !active) return;
    const left = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior });
    window.setTimeout(() => updateStyleCarouselNav(player), behavior === 'smooth' ? 280 : 0);
  }

  function styles({ center = true } = {}) {
    for (const player of ['X', 'O']) {
      const host = $(`styles-${player.toLowerCase()}`);
      if (!host) continue;
      const oldScroll = host.scrollLeft;
      const controlledByAI = aiMode && player === aiSymbol && !aiPreparationEnabled;
      const column = host.closest('.style-column');
      column?.classList.toggle('ai-secret', controlledByAI);
      host.replaceChildren();

      const styleEntries = controlledByAI
        ? Object.entries(styleCatalog).slice(0, 3)
        : Object.entries(styleCatalog);

      for (const [id, [title]] of styleEntries) {
        const visual = styleVisuals[id];
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.styleId = id;
        button.style.setProperty('--card-accent', visual.accent);
        button.style.setProperty('--card-accent-2', visual.accent2);

        if (controlledByAI) {
          button.disabled = true;
          button.className = 'style-card ai-style-card mystery-card';
          button.setAttribute('aria-label', 'Carte de style secrète de l’IA');
          button.innerHTML = `
            <span class="style-card-shine" aria-hidden="true"></span>
            <span class="mystery-symbol" aria-hidden="true">?</span>
            <small>STYLE SECRET</small>
          `;
        } else {
          const active = selected[player] === id;
          button.className = `style-card${active ? ' active' : ''}`;
          button.setAttribute('aria-pressed', String(active));
          button.setAttribute('aria-label', `${title} — ${visual.type}`);
          button.innerHTML = `
            <span class="style-card-shine" aria-hidden="true"></span>
            <span class="style-card-icon" aria-hidden="true">${visual.icon}</span>
            <strong>${title}</strong>
            <small>${visual.type}</small>
          `;
          button.addEventListener('click', () => {
            selected[player] = id;
            if (aiMode && player === aiSymbol && aiPreparationEnabled) {
              prep.evolutionAiStyle = id;
              sessionStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify(prep));
            }
            styles({ center: true });
          });
        }
        host.append(button);
      }

      updateStyleSummary(player);
      if (center && !controlledByAI) {
        requestAnimationFrame(() => centerSelectedStyle(player));
      } else {
        host.scrollLeft = oldScroll;
        updateStyleCarouselNav(player);
      }
    }
  }

  function bindStyleCarousels() {
    for (const player of ['X', 'O']) {
      const track = $(`styles-${player.toLowerCase()}`);
      const prev = document.querySelector(`[data-style-prev="${player}"]`);
      const next = document.querySelector(`[data-style-next="${player}"]`);
      if (!track || !prev || !next) continue;

      const secretLocked = () => aiMode && player === aiSymbol && !aiPreparationEnabled;
      const step = () => Math.max(160, track.clientWidth * 0.72);
      prev.addEventListener('click', () => { if (!secretLocked()) track.scrollBy({ left: -step(), behavior: 'smooth' }); });
      next.addEventListener('click', () => { if (!secretLocked()) track.scrollBy({ left: step(), behavior: 'smooth' }); });
      track.addEventListener('scroll', () => updateStyleCarouselNav(player), { passive: true });
      track.addEventListener('wheel', (event) => {
        if (secretLocked()) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        if (track.scrollWidth <= track.clientWidth) return;
        event.preventDefault();
        track.scrollBy({ left: event.deltaY, behavior: 'smooth' });
      }, { passive: false });
      track.addEventListener('keydown', (event) => {
        if (secretLocked()) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
        if (event.key === 'ArrowRight') { event.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
      });
    }
  }

  function setAiPreparation(enabled) {
    if (!aiMode) return;
    aiPreparationEnabled = Boolean(enabled);
    prep.evolutionAiPreparation = aiPreparationEnabled;

    if (aiPreparationEnabled) {
      if (!E.STYLES.includes(prep.evolutionAiStyle)) {
        prep.evolutionAiStyle = selected[aiSymbol] || AI?.chooseStyle?.(aiDifficulty) || 'balanced';
      }
      selected[aiSymbol] = prep.evolutionAiStyle;
    } else {
      selected[aiSymbol] = AI?.chooseStyle?.(aiDifficulty) || selected[aiSymbol] || 'balanced';
      delete prep.evolutionAiStyle;
    }

    sessionStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify(prep));
    styles({ center: true });
  }

  function tell(text) {
    $('hint').textContent = text;
  }

  function currentPlayer() {
    return state.players[state.turn];
  }

  function hasCell(x, y) {
    if (!state) return false;
    const cell = key(x, y);
    return E.exists ? E.exists(state, cell) : E.legalCells(state).includes(cell);
  }

  function setMode(nextMode) {
    mode = nextMode;
    chosen = [];
    pendingStylePlacement = false;
    previewPlacement = null;
    selectedEffect = $('bomb-effect')?.value || selectedEffect;

    document.querySelectorAll('.actions button').forEach((button) => {
      button.classList.toggle('selected', button.id === nextMode);
    });

    $('amount-wrap').hidden = !['add', 'erase', 'bomb'].includes(nextMode);
    $('bomb-wrap').hidden = nextMode !== 'bomb';
    $('confirm').hidden = true;
    syncAmountOptions();

    render();
  }

  // Coût proposé = points réellement chargés, places libres au plafond des
  // effets actifs et cibles disponibles. Aucun choix irréalisable n'est affiché.
  function maxEffectAmount() {
    if (!state) return 0;
    const type = mode === 'bomb' ? ($('bomb-effect')?.value || selectedEffect) : mode;
    if (!['add', 'erase'].includes(type)) return 0;
    const limit = E.effectLimit(state, state.turn);
    const charged = state.players[state.turn].slots.filter(slot => slot === 'charged').length;
    const active = state.effects.filter(effect => effect.type === type)
      .reduce((total, effect) => total + effect.cells.length, 0);
    const targets = type === 'add' ? E.exteriorAvailable(state).length
      : E.legalCells(state).filter(cell => !state.symbols[cell]).length;
    // Une neutralisation ne peut pas supprimer la dernière case jouable libre.
    const free = type === 'erase' ? Math.max(0, targets - 1) : targets;
    return Math.max(0, Math.min(limit, charged, limit - active, free));
  }

  function syncAmountOptions() {
    const select = $('amount');
    if (!select || !state) return;
    const max = maxEffectAmount();
    const desired = Array.from({length:max}, (_, index) => String(index + 1));
    const oldOptions = Array.from(select.options).map(option => option.value);
    const previous = Number(select.value) || 1;
    // Ne pas détruire le <select> à chaque rendu : évite le saut visuel du menu.
    if (oldOptions.join(',') !== desired.join(',')) {
      select.replaceChildren();
      for (const value of desired) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${value} point${Number(value) > 1 ? 's' : ''}`;
        select.append(option);
      }
    }
    select.disabled = max === 0 || tossing || ghostRevealing || (aiMode && state.turn === aiSymbol);
    if (max > 0) select.value = String(Math.min(previous, max));
  }

  function countNeeded() {
    const max = maxEffectAmount();
    return max === 0 ? 0 : Math.min(Number($('amount').value) || 1, max);
  }

  function randomPlayer() {
    return Math.random() < 0.5 ? 'X' : 'O';
  }

  // La pièce est purement visuelle : le hasard décide le premier joueur, puis
  // l'interface révèle le résultat avant d'autoriser le premier coup.
  function showEvolutionToss(starter, next) {
    const overlay = $('evo-toss-overlay');
    const coin = $('evo-toss-coin');
    const message = $('evo-toss-result');
    const subtitle = $('evo-toss-subtitle');
    if (!overlay || !coin) { next(); return; }
    const token = ++tossSequence;
    tossing = true;
    overlay.hidden = false;
    message.textContent = 'TIRAGE EN COURS…';
    subtitle.textContent = `Manche ${round} · Qui commence ?`;
    coin.classList.remove('spinning', 'heads-x', 'heads-o');
    coin.style.setProperty('--coin-end', starter === 'O' ? '1980deg' : '1800deg');
    void coin.offsetWidth;
    coin.classList.add('spinning');
    setTimeout(() => {
      if (token !== tossSequence) return;
      coin.classList.remove('spinning');
      coin.classList.add(starter === 'X' ? 'heads-x' : 'heads-o');
      message.textContent = `${playerNames[starter]} (${starter}) commence !`;
      subtitle.textContent = 'Le sort a désigné le premier joueur';
    }, 2000);
    setTimeout(() => {
      if (token !== tossSequence) return;
      overlay.hidden = true;
      tossing = false;
      next();
    }, 2900);
  }

  function startMatch() {
    const size = Number(prep.boardSize) === 4 ? 4 : 3;
    bestOf = [1, 3, 5].includes(Number(prep.bestOf)) ? Number(prep.bestOf) : 3;
    ghostMode = prep.ghostMode === true && bestOf > 1;
    scores = { X: 0, O: 0, draw: 0 };
    round = 1;
    first = randomPlayer();
    state = E.initial(size, selected, first);
    ended = false;
    resultShown = false;
    ghostRevealRound = null;
    ghostRevealing = false;
    clearTimeout(ghostRevealTimer);
    replayHistory = [];
    recordReplay('Début de la manche');
    $('setup').hidden = true;
    $('arena').hidden = false;
    showEvolutionToss(first, () => {
      setMode('place');
      tell(`Pile ou face : ${playerNames[first]} (${first}) commence la manche.`);
      scheduleAiTurn();
    });
  }

  function contiguousAddTargets(amount, current = []) {
    // Coordonnées dynamiques : en finale Fantôme le plateau peut dépasser le 3×3 / 4×4 initial.
    const all=E.exteriorAvailable(state);
    if(!current.length)return all;
    return all.filter(candidate=>{
      const points=[...current,candidate].map(parseKey);
      if(new Set([...current,candidate]).size!==points.length||points.length>amount)return false;
      const sameX=points.every(([x])=>x===points[0][0]);
      const sameY=points.every(([,y])=>y===points[0][1]);
      if(!sameX&&!sameY)return false;
      const values=points.map(p=>sameX?p[1]:p[0]).sort((a,b)=>a-b);
      return values.every((v,i)=>i===0||v===values[i-1]+1);
    });
  }

  function emptyPlayableCells() {
    return E.legalCells(state).filter((cell) => !state.symbols[cell]);
  }

  function candidates() {
    if (!state || (aiMode && state.turn === aiSymbol)) return [];

    if (mode === 'place') {
      return emptyPlayableCells();
    }

    if (mode === 'add') return contiguousAddTargets(countNeeded(), chosen);
    if (mode === 'erase') return emptyPlayableCells();
    if (mode === 'bomb') {
      // Cette sélection est un état d'interface local uniquement. En multijoueur,
      // ne jamais synchroniser `chosen` : seul l'effet résolu devra être envoyé
      // à l'adversaire lorsque la bombe se déclenche.
      const effect = $('bomb-effect')?.value || selectedEffect;
      return effect === 'add' ? contiguousAddTargets(countNeeded(), chosen) : emptyPlayableCells();
    }

    if (mode === 'aggressive') {
      if (!pendingStylePlacement) return contiguousAddTargets(1, chosen);
      const options = new Set(emptyPlayableCells());
      if (chosen[0]) options.add(chosen[0]);
      return [...options];
    }

    if (mode === 'time') {
      const effects = state.effects.filter(e => e.owner === state.turn);
      return effects.length ? [...effects[effects.length - 1].cells] : [];
    }

    if (mode === 'defensive') {
      if (!pendingStylePlacement) return emptyPlayableCells();
      return emptyPlayableCells().filter((cell) => cell !== chosen[0]);
    }

    return [];
  }

  function effectLabel(effect) {
    return effect === 'add' ? 'Ajout' : 'Neutralisation';
  }

  function renderEffects() {
    const host = $('effects-list');
    if (!host) return;

    const items = [
      ...state.effects.map((effect) => ({ ...effect, pending: false })),
      ...state.pending.map((effect) => ({ ...effect, pending: true }))
    ];

    if (!items.length) {
      host.textContent = 'Aucun effet actif.';
      return;
    }

    host.innerHTML = '';
    items.forEach((effect) => {
      const article = document.createElement('article');
      article.className = 'effect-item';
      article.innerHTML = `
        <span class="effect-id">#${effect.id || '…'} · ${effectLabel(effect.type)}${effect.pending ? ' (différé)' : ''}</span>
        <div>${effect.owner} · ${Array.isArray(effect.cells) ? effect.cells.join(' • ') : ''}</div>
      `;
      host.append(article);
    });
  }

  function renderPlayers() {
    for (const player of ['X', 'O']) {
      const holder = $(player.toLowerCase() + '-info');
      const config = state.players[player];
      holder.classList.toggle('active', !ended && state.turn === player);
      const passive = ['balanced', 'patient'].includes(config.style);
      const statusClass = passive ? 'passive' : config.styleUsed ? 'used' : 'ready';
      const statusLabel = passive ? 'Passif actif' : config.styleUsed ? 'Pouvoir utilisé' : 'Pouvoir disponible';
      holder.classList.toggle('style-is-passive', passive);
      const slots = config.slots.map((slot) => `<span class="slot ${slot}">${slot === 'charged' ? '●' : slot === 'spent' ? '×' : '○'}</span>`).join('');
      holder.innerHTML = `
        <div class="meta">${player === 'X' ? 'JOUEUR 1' : 'JOUEUR 2'} · ${player}</div>
        <h3 style="color:${player === 'X' ? 'var(--blue)' : 'var(--pink)'}">${playerNames[player]}</h3>
        <p class="player-style-info"><span>${styleCatalog[config.style][0]}</span> · <strong class="style-indicator ${statusClass}">${statusLabel}</strong></p>
        <div class="slots">${slots}</div>
      `;
    }
  }

  function statusText() {
    if (!ended) {
      if (aiMode && state.turn === aiSymbol) return aiThinking ? `${playerNames[aiSymbol]} réfléchit…` : `Au tour de ${playerNames[aiSymbol]} (${aiSymbol})`;
      return `Au tour de ${playerNames[state.turn]} (${state.turn})`;
    }

    const winsRequired = Math.ceil(bestOf / 2);
    const matchFinished = scores.X >= winsRequired || scores.O >= winsRequired || round >= bestOf;
    if (!matchFinished) {
      return state.winner
        ? `${playerNames[state.winner]} remporte la manche !`
        : 'Manche nulle';
    }

    if (scores.X === scores.O) return 'Le match se termine sur une égalité.';
    return `${scores.X > scores.O ? playerNames.X : playerNames.O} remporte le BO !`;
  }

  function syncBoardMetrics(board, cols, rows) {
    const span = Math.max(cols, rows);
    board.style.setProperty('--cols', String(cols));
    board.style.setProperty('--rows', String(rows));
    board.style.setProperty('--span', String(span));
    board.style.setProperty('--grid', String(span));
  }

  function maybeTriggerGhostReveal(board, currentState, currentRound, enabled = true) {
    if (!board || !enabled || !currentState?.ghostFinal) {
      board?.classList.remove('ghost-reveal-active');
      return;
    }
    const total = (currentState.permanentCells?.length || 0)
      + (currentState.permanentErased?.length || 0);
    if (!total || ghostRevealRound === currentRound) return;
    ghostRevealRound = currentRound;
    ghostRevealing = true;
    clearTimeout(ghostRevealTimer);
    const step = total > 18 ? 65 : 95;
    const duration = 840 + (Math.max(0, total - 1) * step);
    board.style.setProperty('--ghost-reveal-step', `${step}ms`);
    board.style.setProperty('--ghost-reveal-duration', '840ms');
    board.classList.add('ghost-reveal-active');
    for (const button of board.children) button.disabled = true;
    // Une seule révélation par manche : les actions sont temporairement gelées
    // pour ne pas reconstruire le DOM pendant la cascade d'animations.
    ghostRevealTimer = setTimeout(() => {
      ghostRevealing = false;
      board.classList.remove('ghost-reveal-active');
      render();
      scheduleAiTurn();
    }, duration + 150);
  }

  function renderBoard() {
    const board = $('board');
    // Tant que la révélation est en cours, garder les mêmes éléments DOM.
    if (ghostRevealing && state.ghostFinal && ghostRevealRound === round && board.childElementCount) return;
    board.replaceChildren();
    const possible = new Set(candidates());
    const playableCells = new Set(E.legalCells(state));
    const timeEffects = state.effects.filter(e => e.owner === state.turn);
    const timeEffect = timeEffects[timeEffects.length - 1];
    const timeCells = new Set(mode === 'time' && timeEffect ? timeEffect.cells : []);
    const winningCells = new Set(
      state.winner && E.winningLine
        ? (E.winningLine(state, state.winner)?.cells || [])
        : []
    );
    const activeExtensions = new Set(
      state.effects.filter(effect => effect.type === 'add').flatMap(effect => effect.cells)
    );
    const isSelectingAddition = mode === 'add'
      || (mode === 'bomb' && $('bomb-effect').value === 'add')
      || mode === 'aggressive'
      || (mode === 'time' && timeEffect?.type === 'add');

    const permanent=state.permanentCells||[];
    const erasedPermanent=new Set(state.permanentErased||[]);
    const visibleOuter=[...activeExtensions,...permanent,...erasedPermanent,...(isSelectingAddition?[...possible,...chosen]:[])];
    const coords=visibleOuter.map(parseKey);
    const minX=Math.min(0,...coords.map(([x])=>x));
    const maxX=Math.max(state.size-1,...coords.map(([x])=>x));
    const minY=Math.min(0,...coords.map(([,y])=>y));
    const maxY=Math.max(state.size-1,...coords.map(([,y])=>y));
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    syncBoardMetrics(board, cols, rows);
    board.classList.toggle('ghost-final-board',Boolean(state.ghostFinal));
    let ghostOrder = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = key(x, y);
        const outer = (x < 0 || y < 0 || x >= state.size || y >= state.size) && !permanent.includes(cell);
        const exists = E.exists ? E.exists(state, cell) : playableCells.has(cell);
        const playable = playableCells.has(cell);
        const isTarget = chosen.includes(cell);
        const selectable = possible.has(cell) || isTarget;
        const symbol = state.symbols[cell] || '';
        const isPermanent=permanent.includes(cell);
        const isVoid=erasedPermanent.has(cell);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = [
          'cell', outer ? 'extension' : '',
          !exists && !isVoid ? 'ghost' : '',
          exists && !playable ? 'disabled' : '',
          isTarget ? 'target' : '',
          mode === 'add' && isTarget ? 'add-preview' : '',
          mode === 'erase' && isTarget ? 'erase-preview' : '',
          mode === 'bomb' && isTarget ? 'bomb-preview' : '',
          mode === 'aggressive' && isTarget ? 'aggressive-preview' : '',
          mode === 'defensive' && isTarget ? 'defensive-preview' : '',
          timeCells.has(cell) ? 'time-preview' : '',
          highlightedGamble === cell ? 'gambling-result' : '',
          winningCells.has(cell) ? 'winning-cell' : '',
          selectable ? 'selectable' : '',
          symbol === 'X' ? 'x' : '', symbol === 'O' ? 'o' : '', isPermanent ? 'ghost-permanent' : '', isVoid ? 'ghost-permanent-void' : ''
        ].filter(Boolean).join(' ');
        const previewSymbol = previewPlacement === cell && (mode === 'aggressive' || mode === 'defensive');
        button.textContent = previewSymbol ? state.turn : symbol || (isVoid ? '⊘' : '') || (mode === 'defensive' && isTarget ? '⊘' : mode === 'bomb' && isTarget ? '⏱' : mode === 'aggressive' && isTarget ? '+' : exists && !playable ? '⊘' : '');
        if (previewSymbol) button.classList.add('placement-preview', state.turn.toLowerCase());
        if (state.ghostFinal && (isPermanent || isVoid)) button.style.setProperty('--ghost-order', String(ghostOrder++));
        button.dataset.cell = cell;
        button.setAttribute('aria-label', `Case ${x}, ${y}`);
        if (isTarget && ['add', 'erase', 'bomb'].includes(mode)) {
          button.dataset.previewOrder = String(chosen.indexOf(cell) + 1);
          button.title = `${mode === 'add' ? 'Ajout' : mode === 'erase' ? 'Neutralisation' : 'Bombe'} — sélection ${chosen.indexOf(cell) + 1}`;
        }
        if (outer && !exists && !selectable) button.classList.add('hidden-cell');
        button.disabled = ended || tossing || ghostRevealing || !selectable;
        button.addEventListener('click', () => selectCell(cell));
        board.append(button);
      }
    }

    maybeTriggerGhostReveal(board, state, round, !replayActive);
  }

  function renderStyleButton() {
    const button = $('style');
    if (!button || !state) return;

    const player = currentPlayer();
    const passive = player.style === 'balanced' || player.style === 'patient';
    const aiTurn = aiMode && state.turn === aiSymbol;

    // Les styles passifs n'ont aucune action manuelle : le bouton disparaît.
    button.hidden = passive || aiTurn;
    button.disabled = aiTurn || (!passive && player.styleUsed);
    button.classList.toggle('style-used', !passive && player.styleUsed);
    button.setAttribute('aria-disabled', String(!passive && player.styleUsed));
    button.textContent = player.styleUsed ? 'Pouvoir utilisé' : 'Pouvoir de style';
  }

  function render() {
    if (!state) return;
    syncAmountOptions();
    renderPlayers();
    renderBoard();
    renderEffects();
    renderStyleButton();

    $('round').textContent = `MANCHE ${round} · BO${bestOf}${state.ghostFinal ? ' · ✧ FINALE FANTÔME' : ''}`;
    $('score').textContent = `${playerNames.X} ${scores.X} — ${scores.O} ${playerNames.O} · Nuls ${scores.draw}`;
    $('message').textContent = statusText();

    const winsRequired = Math.ceil(bestOf / 2);
    const matchFinished = scores.X >= winsRequired || scores.O >= winsRequired || round >= bestOf;
    $('next').hidden = !ended || matchFinished;
    $('confirm').hidden = !(['add', 'erase', 'bomb'].includes(mode) && countNeeded() > 0 && chosen.length === countNeeded());
    $('confirm').textContent = mode === 'bomb' ? 'Programmer la bombe' : 'Confirmer l’effet';

    const lockedForAi = aiMode && state.turn === aiSymbol && !ended;
    document.querySelectorAll('.actions button, #amount, #bomb-effect, #confirm').forEach(control => {
      if (control.id === 'style' && control.hidden) return;
      control.disabled = lockedForAi || tossing || ghostRevealing
        || (control.id === 'style' && currentPlayer().styleUsed)
        || (['add', 'erase'].includes(control.id) && currentPlayer().slots.every(slot => slot !== 'charged'))
        || (control.id === 'amount' && countNeeded() === 0);
    });
    $('board').classList.toggle('ai-thinking', lockedForAi);

    if (!ended) {
      const messages = {
        place: 'Placez un symbole dans une case libre du plateau principal ou d’une extension active.',
        add: 'Choisissez 1 à 3 cases extérieures contiguës sur un même bord.',
        erase: 'Choisissez 1 à 3 cases vides à neutraliser.',
        bomb: `Bombe : ${chosen.length}/${countNeeded()} case(s) choisie(s). Les cases marquées ⏱ seront affectées après le tour adverse.`,
        aggressive: pendingStylePlacement
          ? 'L’extension violette est prévisualisée. Cliquez sur la case où poser votre symbole : l’action sera jouée immédiatement.'
          : 'Choisissez la case extérieure à ajouter.',
        defensive: pendingStylePlacement
          ? 'La case neutralisée est prévisualisée. Cliquez sur la case où poser votre symbole : l’action sera jouée immédiatement.'
          : 'Choisissez la case vide à neutraliser.',
        time: 'Sélectionnez un de vos effets actifs à prolonger.',
        risk: 'Le joueur passe son tour et gagne un point supplémentaire.',
        gambling: 'Le hasard choisira la case à modifier.'
      };
      tell(messages[mode] || 'Sélectionnez une action.');
    }
  }

  const styleFx = {
    aggressive:['⚔','AGRESSIF'], defensive:['◆','DÉFENSIF'],
    time:['⏳','TIME'], bomb:['✹','BOMB'], risk:['▲','RISQUE'], gambling:['⚄','GAMBLING']
  };
  function showStyleEffect(style, owner, cells = [], delayed = false) {
    if (!styleFx[style] || replayActive) return;
    const zone = document.querySelector('#arena .board-zone');
    if (!zone) return;
    const [glyph, title] = styleFx[style];
    const flash = document.createElement('div');
    flash.className = `evo-style-flash fx-${style}`;
    flash.setAttribute('role', 'status');
    const name = document.createElement('strong');
    name.textContent = `${glyph} ${title}${delayed ? ' · DÉCLENCHEMENT' : ''}`;
    const by = document.createElement('small');
    by.textContent = `${playerNames[owner] || owner} utilise son pouvoir`;
    flash.append(name, by);
    zone.append(flash);
    for (const cell of cells) {
      const button = Array.from($('board').children).find(el => el.dataset.cell === cell);
      if (!button) continue;
      button.classList.add('evo-power-hit');
      setTimeout(() => button.classList.remove('evo-power-hit'), 900);
    }
    setTimeout(() => flash.remove(), 1450);
  }

  function resolvedPowerEffects(previous, current, action, actor) {
    const oldIds = new Set(previous.effects.map(effect => effect.id));
    const newEffects = current.effects.filter(effect => !oldIds.has(effect.id));
    // Bomb ne s'anime que lorsqu'elle est effectivement appliquée, pas armée.
    const bomb = newEffects.filter(effect => effect.owner !== actor && effect.owner === previous.pending.find(p => p.owner === effect.owner)?.owner);
    for (const effect of bomb) showStyleEffect('bomb', effect.owner, effect.cells, true);
    if (action.type !== 'style' || action.style === 'bomb') return;
    const targets = action.style === 'time' ? previous.effects.find(e => e.id === action.effectId)?.cells || []
      : action.style === 'gambling' ? [current.history.findLast?.(e => e.type === 'gambling')?.cell].filter(Boolean)
      : [action.target].filter(Boolean);
    showStyleEffect(action.style, actor, targets);
  }

  function tryAction(action, randomFn) {
    try {
      if (tossing || ghostRevealing) return false;
      const actor = state.turn;
      const previous = state;
      state = E.play(state, action, randomFn);
      const actionLabel = action.type === 'place' ? `${playerNames[actor]} pose ${actor}` : action.type === 'effect' ? `${playerNames[actor]} utilise ${action.effect === 'add' ? 'Ajout' : 'Neutralisation'}` : action.type === 'style' ? `${playerNames[actor]} utilise ${String(action.style || 'son style').toUpperCase()}` : `${playerNames[actor]} agit`;
      recordReplay(actionLabel, actor);
      chosen = [];
      pendingStylePlacement = false;
      if (state.winner || state.draw) {
        ended = true;
        if (state.winner) scores[state.winner] += 1;
        else scores.draw += 1;
        const powerFinale = (action.type === 'style' && action.style !== 'bomb')
          || state.effects.some(effect => !previous.effects.some(old => old.id === effect.id) && effect.owner !== actor);
        window.setTimeout(showResultPopup, powerFinale ? 1400 : 360);
      }
      if (mode !== 'bomb') selectedEffect = $('bomb-effect')?.value || selectedEffect;
      if (!ended) setMode('place');
      else render();
      resolvedPowerEffects(previous, state, action, actor);
      scheduleAiTurn();
      return true;
    } catch (error) {
      tell(error.message);
      render();
      return false;
    }
  }

  function selectCell(cell) {
    if (ended || !state || gamblingBusy || tossing || ghostRevealing || (aiMode && state.turn === aiSymbol)) return;

    if (mode === 'time') {
      const effects = state.effects.filter(e => e.owner === state.turn);
      const effect = effects[effects.length - 1];
      if (effect && effect.cells.includes(cell)) tryAction({ type: 'style', style: 'time', effectId: effect.id });
      return;
    }

    if (mode === 'place') {
      tryAction({ type: 'place', cell });
      return;
    }

    if (mode === 'aggressive' || mode === 'defensive') {
      if (!pendingStylePlacement) {
        chosen = [cell];
        pendingStylePlacement = true;
        render();
        return;
      }

      // Offensif / Défensif : le deuxième clic assume l'action.
      // Pas de bouton de confirmation supplémentaire.
      previewPlacement = cell;
      render();
      tryAction({ type: 'style', style: mode, target: chosen[0], cell: previewPlacement });
      return;
    }

    const required = countNeeded();
    if (chosen.includes(cell)) {
      chosen = chosen.filter((item) => item !== cell);
    } else if (chosen.length < required) {
      chosen.push(cell);
    }

    render();
  }

  function doTimeStyle() {
    const effects = state.effects.filter(effect => effect.owner === state.turn);
    const latest = effects[effects.length - 1];
    if (!latest) {
      tell('Aucun de vos effets actifs à prolonger.');
      return;
    }
    setMode('time');
    tell('Les cases de votre dernier effet sont surlignées en bleu. Cliquez sur une de ces cases pour prolonger cet effet d’un tour.');
  }

  function showDiceResult(finalFace, finalText, subText) {
    const overlay = $('dice-overlay');
    const cube = $('dice-cube');
    const result = $('dice-result');
    const sub = $('dice-subtext');
    overlay.hidden = false;
    cube.classList.add('rolling');
    result.textContent = 'Lancement en cours…';
    sub.textContent = 'Le hasard choisit une case sur le plateau.';

    const faces = ['1', '2', '3', '4', '5', '6'];
    let tick = 0;
    const interval = setInterval(() => {
      cube.textContent = faces[tick % faces.length];
      tick += 1;
    }, 125);

    return new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(interval);
        cube.classList.remove('rolling');
        cube.textContent = finalFace;
        result.textContent = finalText;
        sub.textContent = subText;
        setTimeout(() => {
          overlay.hidden = true;
          resolve();
        }, 3200);
      }, 2500);
    });
  }

  async function doGamblingStyle() {
    if (gamblingBusy) return;
    gamblingBusy = true;
    const options = E.legalCells(state);
    if (!options.length) {
      tell('Aucune case disponible pour Gambling.');
      gamblingBusy = false;
      return;
    }

    const randomValue = Math.min(0.999999, Math.random());
    const targetIndex = Math.floor(randomValue * options.length);
    const targetCell = options[targetIndex];
    const alreadyOwned = state.symbols[targetCell] === state.turn;
    const [x, y] = parseKey(targetCell);
    const face = String((targetIndex % 6) + 1);

    await showDiceResult(
      face,
      `Ligne ${y + 1} (depuis le haut) · Colonne ${x + 1} (depuis la gauche)`,
      alreadyOwned
        ? 'Votre propre case est annulée et effacée.'
        : 'La case tirée reçoit votre symbole.'
    );

    highlightedGamble = targetCell;
    tryAction({ type: 'style', style: 'gambling' }, () => randomValue);
    gamblingBusy = false;
    render();
    setTimeout(() => { highlightedGamble = null; render(); }, 4500);
  }

  function styleAction() {
    if (ended || !state || gamblingBusy) return;

    const player = currentPlayer();
    if (player.styleUsed) {
      tell('Le pouvoir de style a déjà été utilisé durant cette manche.');
      return;
    }

    const style = player.style;
    if (style === 'balanced' || style === 'patient') {
      tell('Ce style est passif : il est déjà appliqué automatiquement.');
      return;
    }

    if (style === 'risk') {
      tryAction({ type: 'style', style: 'risk' });
      return;
    }

    if (style === 'gambling') {
      doGamblingStyle();
      return;
    }

    if (style === 'time') {
      doTimeStyle();
      return;
    }

    if (style === 'bomb') {
      setMode('bomb');
      return;
    }

    setMode(style);
  }

  function confirmAction() {
    if (!chosen.length) return;
    if (mode === 'add' || mode === 'erase') {
      tryAction({ type: 'effect', effect: mode, cells: [...chosen] });
      return;
    }
    if (mode === 'bomb') {
      const effect = $('bomb-effect').value;
      tryAction({ type: 'style', style: 'bomb', effect, cells: [...chosen] });
    }
  }

  function scheduleAiTurn() {
    if (!aiMode || !AI || !state || ended || tossing || ghostRevealing || state.turn !== aiSymbol || aiThinking) return;
    clearTimeout(aiTimer);
    aiThinking = true;
    render();
    const delay = aiDifficulty === 'easy' ? 650 : aiDifficulty === 'normal' ? 800 : 950;
    aiTimer = setTimeout(() => {
      if (!state || ended || state.turn !== aiSymbol) { aiThinking = false; return; }
      let action;
      try {
        action = AI.chooseAction(state, aiDifficulty);
      } catch (error) {
        console.error('Evolution AI:', error);
        action = { type: 'pass' };
      }
      aiThinking = false;
      mode = 'place';
      const ok = tryAction(action);
      if (!ok && !ended && state.turn === aiSymbol) {
        // Filet de sécurité : si une action calculée est devenue illégale, jouer une case libre.
        const fallback = E.legalCells(state).find(cell => !state.symbols[cell]);
        if (fallback) tryAction({ type: 'place', cell: fallback });
        else tryAction({ type: 'pass' });
      }
    }, delay);
  }


  function isMatchFinished() {
    const winsRequired = Math.ceil(bestOf / 2);
    return scores.X >= winsRequired || scores.O >= winsRequired || round >= bestOf;
  }

  function showResultPopup() {
    if (!ended || resultShown) return;
    resultShown = true;
    const overlay = $('evo-result-popup');
    const icon = $('evo-result-icon');
    const kicker = $('evo-result-kicker');
    const title = $('evo-result-title');
    const message = $('evo-result-message');
    const nextButton = $('evo-result-next');
    overlay.classList.remove('result-victory', 'result-defeat', 'result-draw');

    const finished = isMatchFinished();
    kicker.textContent = finished ? 'RÉSULTAT DU MATCH' : 'RÉSULTAT DE LA MANCHE';

    if (state.draw) {
      overlay.classList.add('result-draw');
      icon.textContent = '🤝';
      if (bestOf === 1) {
        title.textContent = 'MATCH NUL !';
        message.textContent = `${playerNames.X} (X) et ${playerNames.O} (O) se neutralisent.`;
      } else {
        title.textContent = 'MANCHE NULLE';
        message.textContent = finished ? 'La finale se termine sans vainqueur de manche.' : `Aucun point de match attribué. Nouveau tirage pour la manche ${round + 1}.`;
      }
    } else {
      const humanWon = !aiMode || state.winner === humanSymbol;
      overlay.classList.add(humanWon ? 'result-victory' : 'result-defeat');

      if (bestOf === 1) {
        if (!humanWon) {
          icon.textContent = '🤖';
          title.textContent = 'DÉFAITE';
          message.textContent = `${playerNames[state.winner]} remporte la partie${aiMode ? ` — ${String(aiDifficulty || '').toUpperCase()}.` : '.'}`;
        } else {
          icon.textContent = '🏆';
          title.textContent = `${playerNames[state.winner].toUpperCase()} (${state.winner}) A GAGNÉ !`;
          message.textContent = aiMode
            ? `Victoire contre ${playerNames[aiSymbol]} — ${String(aiDifficulty || '').toUpperCase()}.`
            : `${playerNames[state.winner]} remporte la partie.`;
        }
      } else if (finished) {
        icon.textContent = humanWon ? '🏆' : '🤖';
        title.textContent = humanWon ? 'MATCH REMPORTÉ !' : 'MATCH PERDU';
        message.textContent = `${playerNames[state.winner]} remporte le BO${bestOf} ${scores.X} — ${scores.O}.`;
      } else {
        icon.textContent = humanWon ? '🏆' : '◆';
        title.textContent = 'MANCHE REMPORTÉE';
        message.textContent = `${playerNames[state.winner]} prend la manche ${round} — score ${scores.X} à ${scores.O}.`;
      }
    }

    nextButton.hidden = false;
    nextButton.textContent = finished ? '↻ REVANCHE' : '→ MANCHE SUIVANTE';
    nextButton.dataset.action = finished ? 'rematch' : 'next';

    // Même relance d'animation que le mode Classique.
    overlay.hidden = false;
    overlay.style.display = 'none';
    void overlay.offsetWidth;
    overlay.style.display = 'flex';
  }

  function hideResultPopup() {
    const popup = $('evo-result-popup');
    popup.hidden = true;
    popup.style.display = 'none';
  }

  function replayTurnLimits() {
    if (!replayHistory.length) return [0];
    const last = replayHistory.length - 1;
    const limits = [0];

    // Même principe que le Classique : les limites sont recalculées par manche.
    const byRound = new Map();
    for (let index = 1; index <= last; index += 1) {
      const frameRound = replayHistory[index].round || 1;
      if (!byRound.has(frameRound)) byRound.set(frameRound, []);
      byRound.get(frameRound).push(index);
    }

    for (const indexes of byRound.values()) {
      if (!indexes.length) continue;
      if (aiMode) {
        let offset = 0;
        const firstIndex = indexes[0];
        if (replayHistory[firstIndex].actor === aiSymbol) {
          limits.push(firstIndex);
          offset = 1;
        }
        for (let position = offset; position < indexes.length; position += 1) {
          const frameIndex = indexes[position];
          const frame = replayHistory[frameIndex];
          if (frame.actor === aiSymbol || position === indexes.length - 1) limits.push(frameIndex);
        }
      } else {
        for (let position = 0; position < indexes.length; position += 1) {
          const frameIndex = indexes[position];
          const localCount = position + 1;
          if (localCount % 2 === 0 || position === indexes.length - 1) limits.push(frameIndex);
        }
      }
    }

    return [...new Set(limits)].sort((a, b) => a - b);
  }

  function replayNextTurn(position) {
    return replayTurnLimits().find(limit => limit > position)
      ?? Math.max(0, replayHistory.length - 1);
  }

  function replayPreviousTurn(position) {
    const limits = replayTurnLimits();
    for (let index = limits.length - 1; index >= 0; index -= 1) {
      if (limits[index] < position) return limits[index];
    }
    return 0;
  }

  function renderReplayBoard(replayState) {
    const board = $('board');
    if (!board || !replayState) return;
    board.replaceChildren();

    const activeExtensions = new Set(
      replayState.effects.filter(effect => effect.type === 'add').flatMap(effect => effect.cells)
    );
    const replayWinningCells = new Set(
      replayState.winner && E.winningLine
        ? (E.winningLine(replayState, replayState.winner)?.cells || [])
        : []
    );
    const permanent=replayState.permanentCells||[];
    const erasedPermanent=new Set(replayState.permanentErased||[]);
    const coords=[...activeExtensions,...permanent,...erasedPermanent].map(parseKey);
    const minX=Math.min(0,...coords.map(([x])=>x));
    const maxX=Math.max(replayState.size-1,...coords.map(([x])=>x));
    const minY=Math.min(0,...coords.map(([,y])=>y));
    const maxY=Math.max(replayState.size-1,...coords.map(([,y])=>y));
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    syncBoardMetrics(board, cols, rows);
    board.classList.toggle('ghost-final-board',Boolean(replayState.ghostFinal));
    let ghostOrder = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const cell = key(x, y);
        const outer = (x < 0 || y < 0 || x >= replayState.size || y >= replayState.size) && !permanent.includes(cell);
        const exists = E.exists
          ? E.exists(replayState, cell)
          : (x >= 0 && y >= 0 && x < replayState.size && y < replayState.size) || activeExtensions.has(cell);
        const playable = E.playable ? E.playable(replayState, cell) : E.legalCells(replayState).includes(cell);
        const symbol = replayState.symbols[cell] || '';
        const isPermanent=permanent.includes(cell);
        const isVoid=erasedPermanent.has(cell);
        const button = document.createElement('button');
        button.type = 'button';
        button.disabled = true;
        button.className = [
          'cell',
          outer ? 'extension' : '',
          !exists && !isVoid ? 'hidden-cell' : '',
          exists && !playable ? 'disabled' : '',
          replayWinningCells.has(cell) ? 'winning-cell' : '',
          symbol === 'X' ? 'x' : '',
          symbol === 'O' ? 'o' : '',
          isPermanent ? 'ghost-permanent' : '',
          isVoid ? 'ghost-permanent-void' : ''
        ].filter(Boolean).join(' ');
        button.textContent = symbol || (isVoid ? '⊘' : (exists && !playable ? '⊘' : ''));
        if (replayState.ghostFinal && (isPermanent || isVoid)) button.style.setProperty('--ghost-order', String(ghostOrder++));
        if (symbol) applySymbolCosmetic(button, symbol);
        board.append(button);
      }
    }

    maybeTriggerGhostReveal(board, state, round, !replayActive);
  }

  function updateReplayDescription() {
    const frame = replayHistory[replayIndex];
    if (!frame || replayIndex === 0) {
      $('evo-replay-label').textContent = 'Début du match — manche 1';
      return;
    }
    $('evo-replay-label').textContent = `Manche ${frame.round || 1} • ${frame.label}`;
  }

  function updateReplayControls() {
    const last = Math.max(0, replayHistory.length - 1);
    if (replayMode === 'turn') {
      const limits = replayTurnLimits();
      const exact = limits.findIndex(limit => limit === replayIndex);
      const turnIndex = exact >= 0 ? exact : 0;
      $('evo-replay-progress').textContent = `Tour ${turnIndex} / ${Math.max(0, limits.length - 1)}`;
    } else {
      $('evo-replay-progress').textContent = `Action ${replayIndex} / ${last}`;
    }

    $('evo-replay-start').disabled = replayIndex === 0;
    $('evo-replay-prev').disabled = replayIndex === 0;
    $('evo-replay-next').disabled = replayIndex >= last;
    $('evo-replay-end').disabled = replayIndex >= last;
    updateReplayDescription();
  }

  function renderReplayPosition(position) {
    if (!replayHistory.length) return;
    const last = Math.max(0, replayHistory.length - 1);
    replayIndex = Math.max(0, Math.min(last, position));
    renderReplayBoard(replayHistory[replayIndex].state);
    updateReplayControls();
  }

  function setReplayMode(nextMode) {
    replayMode = nextMode === 'turn' ? 'turn' : 'action';
    if (replayMode === 'turn') {
      const limits = replayTurnLimits();
      replayIndex = limits.find(limit => limit >= replayIndex) ?? Math.max(0, replayHistory.length - 1);
    }
    renderReplayPosition(replayIndex);
  }

  function openReplay() {
    if (replayHistory.length <= 1) return;
    hideResultPopup();
    replayActive = true;
    replayIndex = 0;
    replayMode = $('evo-replay-mode-turn')?.checked ? 'turn' : 'action';
    document.body.classList.add('evo-replay-active');
    $('evo-replay').style.display = 'block';
    renderReplayPosition(0);
  }

  function closeReplay() {
    if (!replayActive) return;
    replayActive = false;
    replayIndex = 0;
    document.body.classList.remove('evo-replay-active');
    $('evo-replay').style.display = 'none';
    render();
  }

  function changeMode() { window.location.href = '../Rencontre/rencontre.html'; }
  function abandonMatch() {
    if (!window.confirm('Abandonner le match Évolution et revenir à la préparation ?')) return;
    changeMode();
  }

  $('start').addEventListener('click', startMatch);
  $('ai-preparation')?.addEventListener('change', (event) => {
    setAiPreparation(event.currentTarget.checked);
  });
  $('next').addEventListener('click', () => {
    round += 1;
    first = randomPlayer();
    state = E.newRound(state, first, ghostMode, round, bestOf);
    ended = false;
    resultShown = false;
    // Comme le Classique, le replay conserve toutes les manches du BO.
    // Le premier coup de la nouvelle manche montrera automatiquement le plateau réinitialisé.
    hideResultPopup();
    showEvolutionToss(first, () => {
      setMode('place');
      tell(state.ghostFinal ? `✧ FINALE FANTÔME : les Ajouts et Neutralisations des ${bestOf-1} manches précédentes sont définitifs !` : `${playerNames[first]} (${first}) commence la manche ${round}.`);
    if(state.draw) {
      ended=true; scores.draw++;
      recordReplay('Finale Fantôme : aucun emplacement jouable');
      render();
      window.setTimeout(showResultPopup,350);
    } else scheduleAiTurn();
    });
  });
  $('place').addEventListener('click', () => setMode('place'));
  $('add').addEventListener('click', () => setMode('add'));
  $('erase').addEventListener('click', () => setMode('erase'));
  $('style').addEventListener('click', styleAction);
  $('cancel').addEventListener('click', () => setMode('place'));
  $('confirm').addEventListener('click', confirmAction);
  $('amount').addEventListener('change', () => {
    chosen = [];
    pendingStylePlacement = false;
    render();
  });
  $('bomb-effect').addEventListener('change', () => {
    selectedEffect = $('bomb-effect').value;
    chosen = [];
    render();
  });

  $('replay').addEventListener('click', openReplay);
  $('change-mode').addEventListener('click', changeMode);
  $('abandon').addEventListener('click', abandonMatch);
  $('evo-result-close').addEventListener('click', hideResultPopup);
  $('evo-result-next').addEventListener('click', () => {
    const action = $('evo-result-next').dataset.action;
    hideResultPopup();
    if (action === 'rematch') startMatch();
    else $('next').click();
  });
  $('evo-result-replay').addEventListener('click', openReplay);
  $('evo-result-change').addEventListener('click', changeMode);
  $('evo-result-home').addEventListener('click', () => { window.location.href = '../index.html'; });
  $('evo-replay-mode-action')?.addEventListener('change', () => {
    if ($('evo-replay-mode-action').checked) setReplayMode('action');
  });
  $('evo-replay-mode-turn')?.addEventListener('change', () => {
    if ($('evo-replay-mode-turn').checked) setReplayMode('turn');
  });
  $('evo-replay-close').addEventListener('click', closeReplay);
  $('evo-replay-close-bottom').addEventListener('click', closeReplay);
  $('evo-replay-start').addEventListener('click', () => renderReplayPosition(0));
  $('evo-replay-end').addEventListener('click', () => renderReplayPosition(replayHistory.length - 1));
  $('evo-replay-prev').addEventListener('click', () => renderReplayPosition(replayMode === 'turn' ? replayPreviousTurn(replayIndex) : replayIndex - 1));
  $('evo-replay-next').addEventListener('click', () => renderReplayPosition(replayMode === 'turn' ? replayNextTurn(replayIndex) : replayIndex + 1));

  loadPreparation();
  bindStyleCarousels();
  styles();
})();
