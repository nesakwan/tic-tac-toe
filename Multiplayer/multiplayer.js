// =====================================================
// TIC TAC TOE — MULTIJOUEUR EN LIGNE
// Le serveur est l'autorité sur les règles, manches, score et tirage.
// =====================================================

const PREPARATION_STORAGE_KEY = "tttPreparationState";
const ONLINE_NAME_KEY = "tttOnlinePlayerName";
const ONLINE_SESSION_KEY = "tttOnlineSession";
const SETTINGS_RETURN_KEY = "tttSettingsReturn";


function readJSON(storage, key, fallback = null) {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw) || fallback; }
    catch (_) { return fallback; }
}

function normalizeBoardSize(value) { return Number(value) === 4 ? 4 : 3; }
function normalizeBestOf(value) {
    const n = Number(value);
    return n === 5 ? 5 : n === 3 ? 3 : 1;
}
function normalizeTurnTime(value) {
    const n = Number(value);
    return [0, 10, 20, 30].includes(n) ? n : 0;
}
function normalizeName(value) {
    return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}

const preparation = readJSON(sessionStorage, PREPARATION_STORAGE_KEY, {}) || {};
// En multijoueur, les règles sont choisies dans le lobby de la salle.
// On évite donc de reprendre silencieusement les anciennes règles de la préparation.
let boardSize = 3;
let bestOf = 1;
let winsRequired = Math.ceil(bestOf / 2);
let turnTime = 0;
let turnDeadline = null;
let boardCellCount = boardSize * boardSize;
const localProfile = globalThis.TTTPlayerData?.getProfile?.() || null;

// =====================================================
// HTML
// =====================================================
const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const coinTossPanel = document.getElementById("coin-toss");
const settingsButton = document.getElementById("settings-button");
const multiBackButton = document.getElementById("multi-back-button");

const createRoomButton = document.getElementById("create-room");
const joinRoomButton = document.getElementById("join-room");
const roomCodeInput = document.getElementById("room-code-input");
const playerNameInput = document.getElementById("player-name-input");

const resumeBanner = document.getElementById("resume-banner");
const resumeSummary = document.getElementById("resume-summary");
const resumeSessionButton = document.getElementById("resume-session");
const forgetSessionButton = document.getElementById("forget-session");

const roomInfo = document.getElementById("room-info");
const roomCodeDisplay = document.getElementById("room-code");
const waitingMessage = document.getElementById("waiting-message");
const lobbyMessage = document.getElementById("lobby-message");
const lobbyActions = document.getElementById("lobby-actions");
const copyRoomCodeButton = document.getElementById("copy-room-code");
const copyRoomLinkButton = document.getElementById("copy-room-link");
const lobbyPlayerX = document.getElementById("lobby-player-x");
const lobbyPlayerO = document.getElementById("lobby-player-o");
const lobbyReadyX = document.getElementById("lobby-ready-x");
const lobbyReadyO = document.getElementById("lobby-ready-o");
const hostBadge = document.getElementById("host-badge");
const roomBoardSize = document.getElementById("room-board-size");
const roomBestOf = document.getElementById("room-best-of");
const roomTurnTime = document.getElementById("room-turn-time");
const roomRulesSummary = document.getElementById("room-rules-summary");
const roomRulesNote = document.getElementById("room-rules-note");
const roomRulesChange = document.getElementById("room-rules-change");
const readyButton = document.getElementById("ready-button");

const connectionStatus = document.getElementById("connection-status");
const connectionDot = document.getElementById("connection-dot");
const networkQuality = document.getElementById("network-quality");
const networkQualityLabel = document.getElementById("network-quality-label");
const networkPingValue = document.getElementById("network-ping-value");
const coin = document.getElementById("coin");
const coinTossSubtitle = document.getElementById("coin-toss-subtitle");
const coinTossResult = document.getElementById("coin-toss-result");

const gameBoardElement = document.getElementById("game-board");
const gameStatus = document.getElementById("game-status");
const gameMessage = document.getElementById("game-message");
const matchRoundLabel = document.getElementById("match-round-label");
const matchFormatLabel = document.getElementById("match-format-label");
const turnTimerElement = document.getElementById("turn-timer");
const turnTimerBar = document.getElementById("turn-timer-bar");
const turnTimerValue = document.getElementById("turn-timer-value");
let cells = [];

const playerOneName = document.getElementById("player-one-name");
const playerTwoName = document.getElementById("player-two-name");
const playerOneSymbol = document.getElementById("player-one-symbol");
const playerTwoSymbol = document.getElementById("player-two-symbol");
const scorePlayerOneName = document.getElementById("score-player-one-name");
const scorePlayerTwoName = document.getElementById("score-player-two-name");
const scorePlayerOne = document.getElementById("score-player-one");
const scorePlayerTwo = document.getElementById("score-player-two");
const scoreDraw = document.getElementById("score-draw");

const restartButton = document.getElementById("restart-button");
const abandonButton = document.getElementById("abandon-button");
const endActions = document.getElementById("end-actions");
const endReplayButton = document.getElementById("end-replay-button");
const endChangeModeButton = document.getElementById("end-change-mode-button");

const resultPopup = document.getElementById("result-popup");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const resultIcon = document.getElementById("result-icon");
const resultKicker = document.getElementById("result-kicker");
const closeResultButton = document.getElementById("close-result-button");
const popupRestartButton = document.getElementById("popup-restart-button");
const popupReplayButton = document.getElementById("popup-replay-button");
const changeModeButton = document.getElementById("change-mode-button");
const homeButton = document.getElementById("home-button");
const matchSummary = document.getElementById("match-summary");
const matchSummaryGrid = document.getElementById("match-summary-grid");

const replayPanel = document.getElementById("replay-panel");
const replayModeAction = document.getElementById("replay-mode-action");
const replayModeTurn = document.getElementById("replay-mode-turn");
const replayStartButton = document.getElementById("replay-start-button");
const replayPrevButton = document.getElementById("replay-prev-button");
const replayProgress = document.getElementById("replay-progress");
const replayNextButton = document.getElementById("replay-next-button");
const replayEndButton = document.getElementById("replay-end-button");
const replayExitButton = document.getElementById("replay-exit-button");
const replayExitButtonBottom = document.getElementById("replay-exit-button-bottom");
const replayActionLabel = document.getElementById("replay-action-label");

// =====================================================
// ÉTAT CLIENT
// =====================================================
let currentRoom = null;
let mySymbol = null;
let myName = "Joueur";
let myToken = null;
let hostSymbol = "X";
let roomPlayers = { X: "Joueur 1", O: "Joueur 2" };
let roomCosmetics = {
    X: { style: "classic", theme: "blue" },
    O: { style: "classic", theme: "pink" }
};
let readyState = { X: false, O: false };
let scores = { X: 0, O: 0, draw: 0 };
let currentRound = 1;
let currentStatus = "lobby";
let currentTurn = null;
let currentBoard = Array(boardCellCount).fill("");
let finalBoard = Array(boardCellCount).fill("");
let moveHistory = [];
let roundHistory = [];
let winningLine = [];
let gameFinished = false;
let matchFinished = false;
let isReplayMode = false;
let replayPosition = 0;
let replayMode = "action";
let replayFrames = [];
let tossSequence = 0;
let disconnectCountdownTimer = null;
let turnTimerInterval = null;
let serverClockOffsetMs = 0; // Décalage entre l'horloge du serveur et celle du client, en millisecondes.
let currentMatchId = null;
let currentMatchStartedAt = null;
let firstStarterSymbol = null;
let historyRecordedMatchId = null;
let networkPingTimer = null;
let lastPingMs = null;
let hasDisconnected = false;

function getPlayerName() {
    return normalizeName(playerNameInput?.value) || "Joueur";
}

function savePlayerName() {
    const name = getPlayerName();
    localStorage.setItem(ONLINE_NAME_KEY, name);
    return name;
}

function saveOnlineSession() {
    if (!currentRoom || !myToken || !mySymbol) return;
    localStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify({
        code: currentRoom,
        token: myToken,
        symbol: mySymbol,
        name: myName,
        boardSize,
        bestOf,
        turnTime
    }));
}

function clearOnlineSession() {
    localStorage.removeItem(ONLINE_SESSION_KEY);
}

function applyBoardSize(size) {
    boardSize = normalizeBoardSize(size);
    boardCellCount = boardSize * boardSize;
    currentBoard = Array(boardCellCount).fill("");
    finalBoard = Array(boardCellCount).fill("");
    if (roomBoardSize) roomBoardSize.value = String(boardSize);
    buildBoard();
}

function applyBestOf(value) {
    bestOf = normalizeBestOf(value);
    winsRequired = Math.ceil(bestOf / 2);
    if (roomBestOf) roomBestOf.value = String(bestOf);
    updateMatchProgress();
}

function applyTurnTime(value) {
    turnTime = normalizeTurnTime(value);
    if (roomTurnTime) roomTurnTime.value = String(turnTime);
    if (turnTime <= 0) {
        turnDeadline = null;
        stopTurnTimerDisplay();
    }
    updateMatchProgress();
}

let roomRulesMessageTimer = null;
function updateRoomRulesSummary() {
    if (roomRulesSummary) {
        roomRulesSummary.textContent = `${boardSize} × ${boardSize} • BO${bestOf} • ${turnTime ? `${turnTime}s / tour` : "Sans chrono"} • Premier à ${winsRequired}`;
    }

    if (roomRulesNote) {
        const amHost = Boolean(mySymbol) && mySymbol === hostSymbol;
        const hostName = roomPlayers?.[hostSymbol] || "L'hôte";
        roomRulesNote.textContent = amHost
            ? "Vous êtes l'hôte : vous pouvez modifier le plateau et le format avant le lancement."
            : `${hostName} est l'hôte et contrôle les règles de la salle.`;
    }
}

function announceRoomRulesChange() {
    if (!roomRulesChange) return;
    roomRulesChange.textContent = `Règles mises à jour : ${boardSize} × ${boardSize} • BO${bestOf} • ${turnTime ? `${turnTime}s / tour` : "sans chrono"}.`;
    roomRulesChange.classList.add("is-visible");
    clearTimeout(roomRulesMessageTimer);
    roomRulesMessageTimer = setTimeout(() => {
        roomRulesChange.classList.remove("is-visible");
    }, 2600);
}

function buildBoard() {
    if (!gameBoardElement) return;
    if (globalThis.TTTBoardUI?.buildBoard) {
        cells = globalThis.TTTBoardUI.buildBoard(gameBoardElement, boardSize, index => playMove(index));
        return;
    }
    gameBoardElement.innerHTML = "";
    gameBoardElement.style.setProperty("--board-size", String(boardSize));
    gameBoardElement.classList.toggle("board-4x4", boardSize === 4);
    for (let index = 0; index < boardCellCount; index++) {
        const cell = document.createElement("button");
        cell.className = "cell";
        cell.type = "button";
        cell.dataset.index = String(index);
        cell.setAttribute("aria-label", `Case ${index + 1}`);
        cell.addEventListener("click", () => playMove(index));
        gameBoardElement.appendChild(cell);
    }
    cells = Array.from(gameBoardElement.querySelectorAll(".cell"));
}

applyBoardSize(boardSize);
applyBestOf(bestOf);
applyTurnTime(turnTime);

const savedOnlineName = localStorage.getItem(ONLINE_NAME_KEY);
const profileName = normalizeName(localProfile?.name);
if (playerNameInput) {
    if (profileName) playerNameInput.value = profileName;
    else if (savedOnlineName) playerNameInput.value = normalizeName(savedOnlineName);
}

playerNameInput?.addEventListener("input", () => {
    const caret = playerNameInput.selectionStart;
    playerNameInput.value = playerNameInput.value.replace(/[<>]/g, "").slice(0, 18);
    try { playerNameInput.setSelectionRange(caret, caret); } catch (_) { }
});
playerNameInput?.addEventListener("change", savePlayerName);
roomCodeInput?.addEventListener("input", () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
});
roomCodeInput?.addEventListener("keydown", event => { if (event.key === "Enter") joinRoomButton?.click(); });
copyRoomCodeButton?.addEventListener("click", async () => {
    if (!currentRoom) return;
    try { await navigator.clipboard.writeText(currentRoom); copyRoomCodeButton.textContent = "Code copié !"; }
    catch (_) { copyRoomCodeButton.textContent = currentRoom; }
    setTimeout(() => { copyRoomCodeButton.textContent = "Copier le code"; }, 1400);
});

copyRoomLinkButton?.addEventListener("click", async () => {
    if (!currentRoom) return;
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("room", currentRoom);
    try {
        await navigator.clipboard.writeText(url.toString());
        copyRoomLinkButton.textContent = "Lien copié !";
    } catch (_) {
        copyRoomLinkButton.textContent = "Copie impossible";
    }
    setTimeout(() => { copyRoomLinkButton.textContent = "Copier le lien"; }, 1400);
});

const roomFromUrl = new URLSearchParams(location.search).get("room");
if (roomFromUrl && roomCodeInput) {
    const detectedCode = roomFromUrl.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (detectedCode.length === 4) {
        roomCodeInput.value = detectedCode;
        if (lobbyMessage) {
            lobbyMessage.classList.remove("error");
            lobbyMessage.textContent = `Code détecté : ${detectedCode}. Entre ton nom puis clique sur REJOINDRE.`;
        }
    }
}

function myCosmeticForSymbol(symbol) {
    return globalThis.TTTPlayerData?.cosmeticForSymbol?.(localProfile, symbol)
        || { style: "classic", theme: symbol === "O" ? "pink" : "blue" };
}

function cosmeticForSymbol(symbol) {
    return roomCosmetics?.[symbol] || myCosmeticForSymbol(symbol);
}

// =====================================================
// SOCKET.IO
// =====================================================
const socket = typeof globalThis.io === "function" ? globalThis.io() : null;

function setConnectionState(text, state) {
    if (connectionStatus) connectionStatus.textContent = text;
    if (!connectionDot) return;
    connectionDot.classList.remove("online", "offline");
    if (state) connectionDot.classList.add(state);
}
function showServerUnavailable() {
    setConnectionState("Serveur indisponible", "offline");
    setNetworkQuality("RECONNEXION...", "reconnecting");
    if (lobbyMessage) lobbyMessage.textContent = "Le serveur multijoueur n'est pas connecté.";
}
function requireSocket() {
    if (socket?.connected) return true;
    showServerUnavailable();
    return false;
}

function storedSession() { return readJSON(localStorage, ONLINE_SESSION_KEY, null); }
function showResumeOffer() {
    const session = storedSession();
    if (!session?.code || !session?.token || !resumeBanner) return false;
    resumeBanner.hidden = false;
    if (resumeSummary) resumeSummary.textContent = `${session.name || "Joueur"} • salle ${session.code} • BO${normalizeBestOf(session.bestOf || 1)}`;
    return true;
}
function tryResumeRoom() {
    const session = storedSession();
    if (!session?.code || !session?.token || !socket?.connected) return false;
    currentRoom = String(session.code).toUpperCase();
    myToken = session.token;
    mySymbol = session.symbol || null;
    myName = normalizeName(session.name) || "Joueur";
    applyBoardSize(session.boardSize || boardSize);
    applyBestOf(session.bestOf || bestOf);
    applyTurnTime(session.turnTime ?? turnTime);
    if (resumeBanner) resumeBanner.hidden = true;
    socket.emit("resumeRoom", { code: currentRoom, token: myToken });
    setConnectionState("Reconnexion à la partie...", "online");
    return true;
}

resumeSessionButton?.addEventListener("click", tryResumeRoom);
forgetSessionButton?.addEventListener("click", () => {
    const session = storedSession();
    if (session?.code && session?.token && socket?.connected) {
        socket.emit("forfeitSession", { code: session.code, token: session.token });
    }
    clearOnlineSession();
    currentRoom = null; myToken = null; mySymbol = null;
    if (resumeBanner) resumeBanner.hidden = true;
});

if (!socket) showServerUnavailable();
else {
    socket.on("connect", () => {
        setConnectionState("Serveur en ligne", "online");
        setNetworkQuality("CONNEXION...", "connecting");
        startNetworkMonitoring();
        if (hasDisconnected) {
            const target = game && !game.hidden ? gameMessage : lobbyMessage;
            if (target) {
                target.textContent = "Connexion rétablie ✓";
                setTimeout(() => { if (target.textContent === "Connexion rétablie ✓") target.textContent = ""; }, 1800);
            }
        }
        hasDisconnected = false;
        const params = new URLSearchParams(location.search);
        const forceResume = params.get("resume") === "1";
        const forceAbandon = params.get("abandon") === "1";
        if (forceAbandon) {
            const session = storedSession();
            if (session?.code && session?.token) socket.emit("forfeitSession", { code: session.code, token: session.token });
            clearOnlineSession();
            history.replaceState(null, "", location.pathname);
            showLobbyHome();
        } else if (forceResume) tryResumeRoom();
        else showResumeOffer();
    });
    socket.on("connect_error", showServerUnavailable);
    socket.on("disconnect", () => {
        hasDisconnected = true;
        setConnectionState("Connexion interrompue", "offline");
        setNetworkQuality("RECONNEXION...", "reconnecting");
    });
}

// =====================================================
// CRÉATION / LOBBY
// =====================================================
createRoomButton?.addEventListener("click", () => {
    if (!requireSocket()) return;
    if (lobbyMessage) lobbyMessage.textContent = "";
    myName = savePlayerName();
    socket.emit("createRoom", { gameVariant: "classic", name: myName, boardSize, bestOf, turnTime, cosmetic: myCosmeticForSymbol("X") });
});

joinRoomButton?.addEventListener("click", () => {
    if (!requireSocket()) return;
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        if (lobbyMessage) lobbyMessage.textContent = "Entre un code valide à 4 caractères.";
        return;
    }
    if (lobbyMessage) lobbyMessage.textContent = "";
    myName = savePlayerName();
    socket.emit("joinRoom", { gameVariant: "classic", code, name: myName, cosmetic: myCosmeticForSymbol("O") });
});

function setReadyVisual(element, ready) {
    if (!element) return;
    element.textContent = ready ? "● PRÊT" : "○ PAS PRÊT";
    element.classList.toggle("is-ready", ready);
}

function updateLobbyState(data) {
    const previousBoardSize = boardSize;
    const previousBestOf = bestOf;
    const previousTurnTime = turnTime;

    currentStatus = data.status || currentStatus;
    hostSymbol = data.hostSymbol || "X";
    roomPlayers = data.players || roomPlayers;
    roomCosmetics = data.cosmetics || roomCosmetics;
    readyState = data.ready || readyState;
    applyBoardSize(data.boardSize || boardSize);
    applyBestOf(data.bestOf || bestOf);
    applyTurnTime(data.turnTime ?? turnTime);
    currentMatchId = data.matchId || currentMatchId;
    currentRound = Number(data.round) || 1;
    scores = data.scores || scores;

    const rulesChanged = Boolean(currentRoom) &&
        (previousBoardSize !== boardSize || previousBestOf !== bestOf || previousTurnTime !== turnTime);

    lobby.hidden = false;
    game.hidden = true;
    coinTossPanel.hidden = true;
    roomInfo.hidden = false;
    if (lobbyActions) lobbyActions.hidden = true;
    if (resumeBanner) resumeBanner.hidden = true;
    if (roomCodeDisplay) roomCodeDisplay.textContent = data.code || currentRoom || "----";
    if (lobbyPlayerX) lobbyPlayerX.textContent = roomPlayers.X || "En attente...";
    if (lobbyPlayerO) lobbyPlayerO.textContent = roomPlayers.O || "En attente...";
    setReadyVisual(lobbyReadyX, readyState.X);
    setReadyVisual(lobbyReadyO, readyState.O);

    const amHost = mySymbol === hostSymbol;
    if (roomBoardSize) roomBoardSize.disabled = !amHost;
    if (roomBestOf) roomBestOf.disabled = !amHost;
    if (roomTurnTime) roomTurnTime.disabled = !amHost;
    if (hostBadge) hostBadge.hidden = hostSymbol !== "X";
    updateRoomRulesSummary();
    if (rulesChanged) announceRoomRulesChange();

    const myReady = Boolean(readyState[mySymbol]);
    if (readyButton) {
        readyButton.disabled = !roomPlayers.O;
        readyButton.textContent = myReady ? "ANNULER PRÊT" : "JE SUIS PRÊT";
        readyButton.classList.toggle("is-ready", myReady);
    }
    if (waitingMessage) {
        if (!roomPlayers.O) waitingMessage.textContent = "En attente d'un adversaire...";
        else if (readyState.X && readyState.O) waitingMessage.textContent = "Les deux joueurs sont prêts. Lancement du tirage...";
        else waitingMessage.textContent = "Les deux joueurs doivent confirmer qu'ils sont prêts.";
    }
    updateParticipants();
    updateScores(scores);
    updateMatchProgress();
}

roomBoardSize?.addEventListener("change", () => {
    if (mySymbol !== hostSymbol || !requireSocket()) return;
    socket.emit("updateRoomSettings", { boardSize: Number(roomBoardSize.value), bestOf: Number(roomBestOf?.value), turnTime: Number(roomTurnTime?.value) });
});
roomBestOf?.addEventListener("change", () => {
    if (mySymbol !== hostSymbol || !requireSocket()) return;
    socket.emit("updateRoomSettings", { boardSize: Number(roomBoardSize?.value), bestOf: Number(roomBestOf.value), turnTime: Number(roomTurnTime?.value) });
});
roomTurnTime?.addEventListener("change", () => {
    if (mySymbol !== hostSymbol || !requireSocket()) return;
    socket.emit("updateRoomSettings", { boardSize: Number(roomBoardSize?.value), bestOf: Number(roomBestOf?.value), turnTime: Number(roomTurnTime.value) });
});
readyButton?.addEventListener("click", () => {
    if (!requireSocket() || !currentRoom || !mySymbol) return;
    socket.emit("setReady", { ready: !Boolean(readyState[mySymbol]) });
});

socket?.on("roomCreated", data => {
    currentRoom = data.code; mySymbol = data.symbol; myToken = data.token; myName = data.name || myName;
    saveOnlineSession();
    updateLobbyState(data);
});
socket?.on("roomJoined", data => {
    currentRoom = data.code; mySymbol = data.symbol; myToken = data.token; myName = data.name || myName;
    saveOnlineSession();
    updateLobbyState(data);
});
socket?.on("lobbyState", data => updateLobbyState(data));
socket?.on("roomError", message => {
    if (!lobbyMessage) return;
    lobbyMessage.classList.add("error");
    lobbyMessage.textContent = String(message || "").includes("n'existe")
        ? "Cette salle n'est plus disponible."
        : message;
});
socket?.on("resumeFailed", message => {
    clearOnlineSession(); currentRoom = null; myToken = null; mySymbol = null;
    showLobbyHome(); if (lobbyMessage) lobbyMessage.textContent = message;
});
socket?.on("roomClosed", message => {
    clearOnlineSession(); currentRoom = null; showLobbyHome();
    if (lobbyMessage) lobbyMessage.textContent = message || "La salle a été fermée.";
});

socket?.on("roomResumed", data => {
    currentRoom = data.code; mySymbol = data.symbol; myToken = data.token || myToken; myName = data.name || myName;
    roomPlayers = data.players || roomPlayers; roomCosmetics = data.cosmetics || roomCosmetics; scores = data.scores || scores; readyState = data.ready || readyState;
    applyBoardSize(data.boardSize); applyBestOf(data.bestOf); applyTurnTime(data.turnTime); currentRound = Number(data.round) || 1;
    currentMatchId = data.matchId || currentMatchId;
    currentMatchStartedAt = Number(data.matchStartedAt) || currentMatchStartedAt;
    firstStarterSymbol = data.firstStarterSymbol || firstStarterSymbol;
    turnDeadline = data.turnDeadline || null;
    currentStatus = data.status; currentBoard = Array.isArray(data.board) ? [...data.board] : Array(boardCellCount).fill("");
    currentTurn = data.turn || null; winningLine = Array.isArray(data.winningLine) ? [...data.winningLine] : [];
    moveHistory = Array.isArray(data.history) ? data.history.map(m => ({ ...m })) : [];
    roundHistory = Array.isArray(data.roundHistory) ? data.roundHistory.map(r => ({ ...r, history: Array.isArray(r.history) ? r.history.map(m => ({ ...m })) : [] })) : [];
    matchFinished = Boolean(data.matchFinished); saveOnlineSession();

    if (data.status === "lobby") updateLobbyState(data);
    else if (data.status === "tossing") showCoinToss({ ...data, starterSymbol: data.turn, starterName: roomPlayers[data.turn], duration: 3600 });
    else if (data.status === "match_end") showMatchOver(data);
    else if (data.status === "round_end") showRoundOver(data);
    else showGame(data);

    if (data.paused && data.disconnectDeadline?.deadline) startDisconnectCountdown(data.disconnectDeadline.deadline);
});

// =====================================================
// TIRAGE AU SORT
// =====================================================
function showCoinToss(data) {
    stopTurnTimerDisplay();
    globalThis.TTTPhaseTransition?.show?.({
        kicker: "MULTIJOUEUR",
        title: "LES DEUX JOUEURS SONT PRÊTS",
        subtitle: "Préparation du tirage au sort...",
        duration: 450
    });
    currentStatus = "tossing";
    roomPlayers = data.players || roomPlayers;
    roomCosmetics = data.cosmetics || roomCosmetics;
    applyBoardSize(data.boardSize || boardSize);
    applyBestOf(data.bestOf || bestOf);
    applyTurnTime(data.turnTime ?? turnTime);
    currentRound = Number(data.round) || currentRound;
    updateMatchProgress();

    const sequence = ++tossSequence;
    const duration = Math.max(2500, Number(data.duration) || 3600);
    const starterSymbol = data.starterSymbol;
    const starterName = data.starterName || roomPlayers[starterSymbol] || starterSymbol;

    lobby.hidden = true; game.hidden = true; coinTossPanel.hidden = false;
    if (resultPopup) resultPopup.style.display = "none";
    coinTossSubtitle.textContent = "Préparation du lancer...";
    coinTossResult.textContent = "TIRAGE...";
    coinTossResult.classList.remove("result-x", "result-o", "revealed");
    coin?.classList.remove("is-tossing", "lands-x", "lands-o", "is-ready");
    coin?.style?.setProperty?.("--coin-final-rotation", starterSymbol === "O" ? "3420deg" : "3240deg");
    void coin?.offsetWidth; coin?.classList.add("is-ready");

    setTimeout(() => { if (sequence === tossSequence) { coinTossSubtitle.textContent = "La pièce s'envole..."; coin?.classList.remove("is-ready"); void coin?.offsetWidth; coin?.classList.add("is-tossing"); } }, 350);
    setTimeout(() => { if (sequence === tossSequence) coinTossSubtitle.textContent = "Elle ralentit..."; }, Math.min(2100, duration * .58));
    setTimeout(() => { if (sequence === tossSequence) coinTossSubtitle.textContent = "La pièce retombe..."; }, Math.min(2900, duration * .80));
    setTimeout(() => {
        if (sequence !== tossSequence) return;
        coin?.classList.remove("is-tossing", "is-ready");
        coin?.classList.add(starterSymbol === "X" ? "lands-x" : "lands-o");
        coinTossSubtitle.textContent = "Le tirage est terminé";
        coinTossResult.textContent = `${starterName} commence — ${starterSymbol}`;
        coinTossResult.classList.add(starterSymbol === "X" ? "result-x" : "result-o", "revealed");
    }, Math.max(2200, duration - 250));
}
socket?.on("coinToss", showCoinToss);

// =====================================================
// TIMER PAR TOUR (affichage client, autorité serveur)
// =====================================================
function stopTurnTimerDisplay() {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    turnTimerInterval = null;
    if (turnTimerElement) turnTimerElement.hidden = true;
}

function syncTurnTimer(deadline = turnDeadline) {

    turnDeadline = deadline || null;

    stopTurnTimerDisplay();

    if (
        !turnDeadline ||
        turnTime <= 0 ||
        currentStatus !== "playing" ||
        gameFinished ||
        matchFinished
    ) {
        return;
    }

    const tick = () => {

        const synchronizedNow =
            Date.now() + serverClockOffsetMs;

        const remaining =
            Math.max(
                0,
                Number(turnDeadline) - synchronizedNow
            );

        const total =
            turnTime * 1000;

        const ratio =
            total > 0
                ? Math.min(1, remaining / total)
                : 0;

        if (turnTimerElement) {
            turnTimerElement.hidden = false;

            turnTimerElement.classList.toggle(
                "is-low",
                remaining <= Math.min(
                    5000,
                    total * 0.25
                )
            );
        }

        if (turnTimerBar) {
            turnTimerBar.style.transform =
                `scaleX(${ratio})`;
        }

        if (turnTimerValue) {
            turnTimerValue.textContent =
                `${Math.max(
                    0,
                    Math.ceil(remaining / 1000)
                )} s`;
        }

        if (remaining <= 0) {
            stopTurnTimerDisplay();
        }
    };

    tick();

    turnTimerInterval =
        setInterval(tick, 100);
}

function syncRuntimeState(data) {
    if (!data) return;
    roomCosmetics = data.cosmetics || roomCosmetics;
    applyTurnTime(data.turnTime ?? turnTime);
    currentMatchId = data.matchId || currentMatchId;
    turnDeadline = data.turnDeadline || null;
}

// =====================================================
// QUALITÉ RÉSEAU
// =====================================================
function setNetworkQuality(label, quality, ping = null) {
    if (networkQuality) networkQuality.dataset.quality = quality;
    if (networkQualityLabel) networkQualityLabel.textContent = label;
    if (networkPingValue) networkPingValue.textContent = Number.isFinite(ping) ? `${Math.round(ping)} ms` : "— ms";
}

function classifyPing(ms) {
    if (ms <= 70) return ["EXCELLENTE", "excellent"];
    if (ms <= 140) return ["BONNE", "good"];
    if (ms <= 250) return ["MOYENNE", "medium"];
    return ["INSTABLE", "unstable"];
}

function measureNetworkQuality() {

    if (!socket?.connected) {
        setNetworkQuality(
            "RECONNEXION...",
            "reconnecting"
        );
        return;
    }

    const sentAt = Date.now();

    socket.timeout(2500).emit(
        "networkPing",
        { sentAt },
        (error, response) => {

            if (error || !response?.serverTime) {

                setNetworkQuality(
                    "INSTABLE",
                    "unstable"
                );

                return;
            }

            const receivedAt = Date.now();

            const roundTripTime =
                receivedAt - sentAt;

            const estimatedServerTimeAtReceive =
                Number(response.serverTime) +
                roundTripTime / 2;

            serverClockOffsetMs =
                estimatedServerTimeAtReceive -
                receivedAt;

            setNetworkQualityFromPing(
                roundTripTime
            );
        }
    );
}

function startNetworkMonitoring() {
    if (networkPingTimer) clearInterval(networkPingTimer);
    measureNetworkQuality();
    networkPingTimer = setInterval(measureNetworkQuality, 4000);
}

function synchronizeServerClock() {

    if (!socket?.connected) {
        return;
    }

    const clientSentAt = Date.now();

    socket.timeout(2500).emit(
        "networkPing",
        { sentAt: clientSentAt },
        (error, response) => {

            if (error || !response?.serverTime) {
                setNetworkQuality("INSTABLE", "unstable");
                return;
            }

            const clientReceivedAt = Date.now();

            const roundTripTime =
                clientReceivedAt - clientSentAt;

            const estimatedClientTimeAtServerResponse =
                clientSentAt + roundTripTime / 2;

            serverClockOffsetMs =
                Number(response.serverTime) -
                estimatedClientTimeAtServerResponse;
        }
    );
}

// =====================================================
// GAMEPLAY
// =====================================================
function applySymbolClass(element, symbol) {
    if (!element) return;
    element.classList.remove("symbol-x", "symbol-o");
    element.classList.add(symbol === "X" ? "symbol-x" : "symbol-o");
    globalThis.TTTPlayerData?.applyElementCosmetic?.(element, symbol, cosmeticForSymbol(symbol));
}
function updateParticipants() {
    if (playerOneName) playerOneName.textContent = roomPlayers.X || "Joueur X";
    if (playerTwoName) playerTwoName.textContent = roomPlayers.O || "Joueur O";
    if (playerOneSymbol) { playerOneSymbol.textContent = "X"; applySymbolClass(playerOneSymbol, "X"); }
    if (playerTwoSymbol) { playerTwoSymbol.textContent = "O"; applySymbolClass(playerTwoSymbol, "O"); }
    if (scorePlayerOneName) scorePlayerOneName.textContent = `${roomPlayers.X || "Joueur X"} · X`;
    if (scorePlayerTwoName) scorePlayerTwoName.textContent = `${roomPlayers.O || "Joueur O"} · O`;
}
function updateScores(serverScores = scores) {
    scores = serverScores || scores;
    if (scorePlayerOne) scorePlayerOne.textContent = String(scores.X || 0);
    if (scorePlayerTwo) scorePlayerTwo.textContent = String(scores.O || 0);
    if (scoreDraw) scoreDraw.textContent = String(scores.draw || 0);
}
function updateMatchProgress() {
    if (matchRoundLabel) matchRoundLabel.textContent = `MANCHE ${currentRound}`;
    if (matchFormatLabel) matchFormatLabel.textContent = `BO${bestOf} • Premier à ${winsRequired}`;
}
function renderBoard(board, turn = currentTurn, line = []) {
    const nextBoard = Array.isArray(board) ? board : Array(boardCellCount).fill("");
    currentTurn = turn ?? null;
    cells.forEach((cell, index) => {
        const symbol = nextBoard[index] || "";
        if (globalThis.TTTBoardUI?.paintCell) {
            globalThis.TTTBoardUI.paintCell(cell, symbol, {
                animate: cell.textContent !== symbol,
                winning: line.includes(index),
                cosmetic: symbol ? cosmeticForSymbol(symbol) : null
            });
        } else {
            cell.textContent = symbol;
            cell.classList.remove("mark-x", "mark-o");
            if (symbol === "X") cell.classList.add("mark-x");
            if (symbol === "O") cell.classList.add("mark-o");
            cell.classList.toggle("winning-cell", line.includes(index));
        }
        cell.disabled = gameFinished || isReplayMode || Boolean(symbol) || currentTurn !== mySymbol;
    });
    currentBoard = [...nextBoard];
    if (gameMessage) gameMessage.textContent = "";
    updateTurnStatus();
}
function updateTurnStatus() {
    if (!gameStatus) return;
    if (matchFinished) { gameStatus.textContent = "Match terminé"; return; }
    if (gameFinished) { gameStatus.textContent = "Manche terminée"; return; }
    if (!currentTurn) { gameStatus.textContent = "Synchronisation..."; return; }
    const name = roomPlayers[currentTurn] || currentTurn;
    gameStatus.innerHTML = currentTurn === mySymbol
        ? `<p>À toi de jouer — <strong>${mySymbol}</strong></p>`
        : `<p>Tour de <strong>${name}</strong> — ${currentTurn}</p>`;
}
function showLobbyHome() {
    stopTurnTimerDisplay();
    if (matchSummary) matchSummary.hidden = true;
    tossSequence += 1; lobby.hidden = false; game.hidden = true; coinTossPanel.hidden = true;
    if (resultPopup) resultPopup.style.display = "none";
    if (replayPanel) replayPanel.style.display = "none";
    if (roomInfo) roomInfo.hidden = true;
    if (lobbyActions) lobbyActions.hidden = false;
    if (roomRulesChange) roomRulesChange.textContent = "";
}
function showGame(data) {
    const cameFromToss = currentStatus === "tossing";
    syncRuntimeState(data);
    tossSequence += 1; coinTossPanel.hidden = true; lobby.hidden = true; game.hidden = false;
    if (resultPopup) resultPopup.style.display = "none";
    currentStatus = data.status || "playing";
    gameFinished = false; matchFinished = Boolean(data.matchFinished); isReplayMode = false;
    currentTurn = data.turn || null; roomPlayers = data.players || roomPlayers;
    currentRound = Number(data.round) || currentRound;
    applyBestOf(data.bestOf || bestOf); applyBoardSize(data.boardSize || boardSize);
    moveHistory = Array.isArray(data.history) ? data.history.map(m => ({ ...m })) : [];
    roundHistory = Array.isArray(data.roundHistory) ? data.roundHistory.map(r => ({ ...r, history: Array.isArray(r.history) ? r.history.map(m => ({ ...m })) : [] })) : roundHistory;
    winningLine = Array.isArray(data.winningLine) ? [...data.winningLine] : [];
    updateParticipants(); updateScores(data.scores || scores); updateMatchProgress();
    renderBoard(data.board, data.turn, winningLine);
    syncTurnTimer(data.turnDeadline);
    if (endActions) endActions.style.display = "none";
    if (restartButton) restartButton.style.display = "none";
    if (abandonButton) abandonButton.style.display = "inline-flex";
    if (cameFromToss) {
        globalThis.TTTPhaseTransition?.show?.({
            kicker: `BO${data.bestOf || bestOf}`,
            title: `MANCHE ${Number(data.round) || currentRound}`,
            subtitle: `${roomPlayers[data.turn] || data.turn || "Un joueur"} commence`,
            duration: 650
        });
    }
}

socket?.on("gameStart", data => showGame(data));
socket?.on("gameState", data => {
    syncRuntimeState(data);
    currentStatus = data.status || currentStatus;
    roomPlayers = data.players || roomPlayers;
    currentRound = Number(data.round) || currentRound;
    moveHistory = Array.isArray(data.history) ? data.history.map(m => ({ ...m })) : moveHistory;
    roundHistory = Array.isArray(data.roundHistory) ? data.roundHistory.map(r => ({ ...r, history: Array.isArray(r.history) ? r.history.map(m => ({ ...m })) : [] })) : roundHistory;
    updateParticipants(); updateScores(data.scores || scores); updateMatchProgress();
    renderBoard(data.board, data.turn, []);
    syncTurnTimer(data.turnDeadline);
});
socket?.on("roundStart", data => {
    stopTurnTimerDisplay();
    syncRuntimeState(data);
    currentStatus = "round_start";
    lobby.hidden = true; coinTossPanel.hidden = true; game.hidden = false;
    globalThis.TTTPhaseTransition?.show?.({
        kicker: `BO${data.bestOf || bestOf}`,
        title: `MANCHE ${Number(data.round) || currentRound}`,
        subtitle: `${data.starterName || roomPlayers[data.starterSymbol] || "Un joueur"} commence`,
        duration: Math.min(1050, Number(data.duration) || 1050)
    });
    currentRound = Number(data.round) || currentRound; roomPlayers = data.players || roomPlayers;
    applyBoardSize(data.boardSize || boardSize); applyBestOf(data.bestOf || bestOf); updateMatchProgress();
    currentBoard = Array(boardCellCount).fill(""); currentTurn = null; gameFinished = false;
    renderBoard(currentBoard, null, []);
    if (gameStatus) gameStatus.textContent = `${data.starterName || roomPlayers[data.starterSymbol]} commence la manche ${currentRound}.`;
});

function applyResultStyle(type) {
    if (!resultPopup) return;
    resultPopup.classList.remove("result-victory", "result-defeat", "result-draw");
    resultPopup.classList.add(`result-${type}`);
}
function revealResultPopup() {
    if (!resultPopup) return;
    resultPopup.style.display = "none"; void resultPopup.offsetWidth; resultPopup.style.display = "flex";
}
function showRoundOver(data) {
    stopTurnTimerDisplay();
    if (matchSummary) matchSummary.hidden = true;
    syncRuntimeState(data);
    currentStatus = "round_end";
    gameFinished = true; matchFinished = false; currentTurn = null;
    roomPlayers = data.players || roomPlayers; currentRound = Number(data.round) || currentRound;
    scores = data.scores || scores; moveHistory = Array.isArray(data.history) ? data.history.map(m => ({ ...m })) : moveHistory;
    roundHistory = Array.isArray(data.roundHistory) ? data.roundHistory.map(r => ({ ...r, history: Array.isArray(r.history) ? r.history.map(m => ({ ...m })) : [] })) : roundHistory;
    finalBoard = Array.isArray(data.board) ? [...data.board] : [...currentBoard];
    winningLine = Array.isArray(data.winningLine) ? [...data.winningLine] : [];
    updateParticipants(); updateScores(scores); updateMatchProgress(); renderBoard(finalBoard, null, winningLine);
    cells.forEach(c => { c.disabled = true; });
    if (endActions) endActions.style.display = "flex";
    if (endReplayButton) endReplayButton.disabled = true;
    if (popupReplayButton) popupReplayButton.disabled = true;
    if (restartButton) { restartButton.style.display = "inline-flex"; restartButton.disabled = true; restartButton.textContent = "Prochaine manche..."; }
    if (popupRestartButton) { popupRestartButton.disabled = true; popupRestartButton.textContent = "Prochaine manche..."; }

    if (resultKicker) resultKicker.textContent = "RÉSULTAT DE LA MANCHE";
    if (!data.winner) {
        applyResultStyle("draw"); resultTitle.textContent = "MANCHE NULLE";
        resultMessage.textContent = `Aucun point attribué. Nouveau tirage avant la manche ${currentRound + 1}.`; resultIcon.textContent = "🤝";
    } else {
        const mine = data.winner === mySymbol;
        applyResultStyle(mine ? "victory" : "defeat");
        resultTitle.textContent = mine ? "MANCHE REMPORTÉE" : "MANCHE PERDUE";
        resultMessage.textContent = `${roomPlayers[data.winner]} remporte la manche ${currentRound} — ${scores.X} à ${scores.O}.`;
        resultIcon.textContent = mine ? "🏆" : "◆";
    }
    revealResultPopup();
}
socket?.on("roundOver", showRoundOver);

function recordOnlineMatch(data) {
    const store = globalThis.TTTPlayerData;
    if (!store?.recordMatch || !mySymbol) return;

    const matchId = data?.matchId || currentMatchId || `${currentRoom}-${data?.round || currentRound}`;
    if (historyRecordedMatchId === matchId) return;

    const winner = data?.matchWinner || data?.winner || null;
    const result = winner
        ? (winner === mySymbol ? "win" : "loss")
        : "draw";

    const rounds = Array.isArray(data?.roundHistory)
        ? data.roundHistory.map(round => ({
            round: round.round,
            winner: round.winner,
            board: Array.isArray(round.board) ? [...round.board] : [],
            moves: Array.isArray(round.history) ? round.history.map(move => ({ ...move })) : []
        }))
        : [];

    store.recordMatch({
        externalId: `multi-${currentRoom || data?.code || "room"}-${matchId}-${mySymbol}`,
        mode: "multi",
        result,
        playerOneName: roomPlayers.X || "Joueur X",
        playerTwoName: roomPlayers.O || "Joueur O",
        playerOneSymbol: "X",
        playerTwoSymbol: "O",
        scoreOne: Number(data?.scores?.X ?? scores.X) || 0,
        scoreTwo: Number(data?.scores?.O ?? scores.O) || 0,
        draws: Number(data?.scores?.draw ?? scores.draw) || 0,
        boardSize: data?.boardSize || boardSize,
        bestOf: data?.bestOf || bestOf,
        roundsPlayed: rounds.length || Number(data?.round) || currentRound,
        endReason: data?.endReason || "victory",
        rounds
    });

    historyRecordedMatchId = matchId;
}

function formatMatchDuration(ms) {
    const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function showMatchSummary(data) {
    if (!matchSummary || !matchSummaryGrid) return;
    const rounds = Array.isArray(data?.roundHistory) ? data.roundHistory : roundHistory;
    const moves = rounds.reduce((sum, round) => sum + (Array.isArray(round.history) ? round.history.length : 0), 0);
    const started = Number(data?.matchStartedAt) || currentMatchStartedAt || Date.now();
    const durationMs = Math.max(0, Date.now() - started);
    const avg = moves > 0 ? (durationMs / 1000 / moves).toFixed(1).replace(".", ",") : "—";
    const starter = data?.firstStarterSymbol || firstStarterSymbol;
    const reason = data?.endReason === "forfeit" ? "Abandon" : data?.endReason === "disconnect" ? "Déconnexion" : "Fin normale";
    const items = [
        ["Format", `BO${data?.bestOf || bestOf} • ${data?.boardSize || boardSize}×${data?.boardSize || boardSize}`],
        ["Manches jouées", String(rounds.length || data?.round || currentRound)],
        ["Coups joués", String(moves)],
        ["Durée", formatMatchDuration(durationMs)],
        ["Premier joueur", starter ? (roomPlayers[starter] || starter) : "—"],
        ["Temps moyen / coup", avg === "—" ? "—" : `${avg} s`],
        ["Manches nulles", String(data?.scores?.draw ?? scores.draw ?? 0)],
        ["Fin du match", reason]
    ];
    matchSummaryGrid.innerHTML = items.map(([label, value]) => `<div class="match-summary-item"><small>${label}</small><strong>${value}</strong></div>`).join("");
    matchSummary.hidden = false;
}

function showMatchOver(data) {
    stopTurnTimerDisplay();
    syncRuntimeState(data);
    currentStatus = "match_end";
    gameFinished = true; matchFinished = true; currentTurn = null;
    roomPlayers = data.players || roomPlayers; currentRound = Number(data.round) || currentRound;
    scores = data.scores || scores; finalBoard = Array.isArray(data.board) ? [...data.board] : [...currentBoard];
    moveHistory = Array.isArray(data.history) ? data.history.map(m => ({ ...m })) : moveHistory;
    roundHistory = Array.isArray(data.roundHistory) ? data.roundHistory.map(r => ({ ...r, history: Array.isArray(r.history) ? r.history.map(m => ({ ...m })) : [] })) : roundHistory;
    winningLine = Array.isArray(data.winningLine) ? [...data.winningLine] : [];
    recordOnlineMatch(data);
    updateParticipants(); updateScores(scores); updateMatchProgress(); renderBoard(finalBoard, null, winningLine);
    if (endActions) endActions.style.display = "flex";
    if (endReplayButton) endReplayButton.disabled = false;
    if (popupReplayButton) popupReplayButton.disabled = false;
    if (restartButton) { restartButton.style.display = "inline-flex"; restartButton.disabled = false; restartButton.textContent = "↻ Demander une revanche"; }
    if (popupRestartButton) { popupRestartButton.disabled = false; popupRestartButton.textContent = "↻ DEMANDER UNE REVANCHE"; }
    if (abandonButton) abandonButton.style.display = "none";

    if (resultKicker) resultKicker.textContent = "RÉSULTAT DU MATCH";
    const winner = data.matchWinner || data.winner;
    const mine = winner === mySymbol;
    applyResultStyle(mine ? "victory" : "defeat");
    resultTitle.textContent = mine ? "MATCH REMPORTÉ !" : "MATCH PERDU";
    if (data.endReason === "forfeit") resultMessage.textContent = mine ? "Victoire par abandon de l'adversaire." : "Tu as abandonné le match.";
    else if (data.endReason === "disconnect") resultMessage.textContent = mine ? "Victoire : l'adversaire ne s'est pas reconnecté à temps." : "Défaite après expiration du délai de reconnexion.";
    else resultMessage.textContent = `${roomPlayers[winner] || winner} remporte le BO${bestOf} ${scores.X} — ${scores.O}.`;
    resultIcon.textContent = mine ? "🏆" : "◆";
    showMatchSummary(data);
    revealResultPopup();
}
socket?.on("matchOver", showMatchOver);

socket?.on("gameError", message => {
    if (!gameMessage) return; gameMessage.textContent = message;
    setTimeout(() => { if (gameMessage.textContent === message) gameMessage.textContent = ""; }, 1800);
});
socket?.on("turnTimedOut", data => {
    syncRuntimeState(data);
    const name = data?.timedOutName || roomPlayers[data?.timedOutSymbol] || "Un joueur";
    if (gameMessage) {
        gameMessage.textContent = `${name} a dépassé le temps : tour perdu.`;
        setTimeout(() => {
            if (gameMessage.textContent.includes("tour perdu")) gameMessage.textContent = "";
        }, 1800);
    }
});

function stopDisconnectCountdown() {
    if (disconnectCountdownTimer) clearInterval(disconnectCountdownTimer);
    disconnectCountdownTimer = null;
}
function startDisconnectCountdown(deadline) {
    stopTurnTimerDisplay();
    stopDisconnectCountdown();
    const tick = () => {
        const remaining = Math.max(0, Number(deadline) - Date.now());
        const total = Math.ceil(remaining / 1000);
        const mm = String(Math.floor(total / 60)).padStart(2, "0");
        const ss = String(total % 60).padStart(2, "0");
        if (gameStatus) gameStatus.textContent = `Adversaire déconnecté — reconnexion ${mm}:${ss}`;
        cells.forEach(c => { c.disabled = true; });
        if (remaining <= 0) stopDisconnectCountdown();
    };
    tick(); disconnectCountdownTimer = setInterval(tick, 1000);
}
socket?.on("opponentTemporaryLeft", data => startDisconnectCountdown(data?.deadline));
socket?.on("opponentReconnected", data => {
    stopDisconnectCountdown();
    syncRuntimeState(data);
    if (data?.status === "lobby") updateLobbyState(data);
    else {
        currentStatus = data?.status || currentStatus;
        currentTurn = data?.turn ?? currentTurn;
        renderBoard(data?.board || currentBoard, currentTurn, data?.winningLine || winningLine);
        syncTurnTimer(data?.turnDeadline);
    }
});
socket?.on("opponentLeft", message => {
    clearOnlineSession(); gameFinished = true;
    if (gameStatus) gameStatus.textContent = message || "Ton adversaire a quitté la partie.";
    cells.forEach(c => { c.disabled = true; });
});

function playMove(index) {
    if (!socket?.connected || !currentRoom || gameFinished || isReplayMode || currentStatus !== "playing") return;
    if (currentTurn !== mySymbol || currentBoard[index]) return;
    socket.emit("playMove", { code: currentRoom, index });
}

// =====================================================
// REPLAY DU MATCH
// =====================================================
function buildReplayFrames() {
    const rounds = roundHistory.length > 0
        ? roundHistory
        : [{ round: currentRound, history: moveHistory.map(move => ({ ...move })) }];
    const frames = [{ round: rounds[0]?.round || 1, board: Array(boardCellCount).fill(""), move: null, turnEnd: true }];

    for (const round of rounds) {
        const board = Array(boardCellCount).fill("");
        const moves = Array.isArray(round.history) ? round.history : [];
        moves.forEach((move, index) => {
            if (Number.isInteger(move.index) && move.index < board.length) board[move.index] = move.symbol;
            frames.push({
                round: round.round,
                board: [...board],
                move,
                turnEnd: ((index + 1) % 2 === 0) || index === moves.length - 1
            });
        });
    }
    replayFrames = frames;
    return replayFrames;
}

function replayTurnLimits() {
    if (!replayFrames.length) buildReplayFrames();
    const limits = [0];
    replayFrames.forEach((frame, index) => { if (index > 0 && frame.turnEnd) limits.push(index); });
    return [...new Set(limits)];
}
function describeReplayFrame(frame) {
    if (!frame?.move) return `Début du match — manche ${frame?.round || 1}`;
    return `Manche ${frame.round} • ${roomPlayers[frame.move.symbol] || frame.move.symbol} joue ${frame.move.symbol} en case ${frame.move.index + 1}`;
}
function updateReplayUI() {
    if (!replayFrames.length) buildReplayFrames();
    const last = Math.max(0, replayFrames.length - 1);
    if (replayProgress) {
        if (replayMode === "turn") {
            const limits = replayTurnLimits();
            const exact = limits.findIndex(v => v === replayPosition);
            replayProgress.textContent = `Tour ${Math.max(0, exact)} / ${Math.max(0, limits.length - 1)}`;
        } else replayProgress.textContent = `Action ${replayPosition} / ${last}`;
    }
    if (replayActionLabel) replayActionLabel.textContent = describeReplayFrame(replayFrames[replayPosition]);
    if (replayStartButton) replayStartButton.disabled = replayPosition === 0;
    if (replayPrevButton) replayPrevButton.disabled = replayPosition === 0;
    if (replayNextButton) replayNextButton.disabled = replayPosition >= last;
    if (replayEndButton) replayEndButton.disabled = replayPosition >= last;
}
function showReplayPosition(position) {
    if (!replayFrames.length) buildReplayFrames();
    const last = Math.max(0, replayFrames.length - 1);
    replayPosition = Math.max(0, Math.min(last, position));
    const frame = replayFrames[replayPosition];
    const savedFinished = gameFinished;
    gameFinished = true;
    renderBoard(frame?.board || Array(boardCellCount).fill(""), null, []);
    gameFinished = savedFinished;
    cells.forEach(c => { c.disabled = true; });
    updateReplayUI();
}
function startReplay() {
    if (!gameFinished) return;
    buildReplayFrames();
    if (replayFrames.length <= 1) return;
    resultPopup.style.display = "none";
    endActions.style.display = "none";
    replayPanel.style.display = "block";
    isReplayMode = true;
    replayMode = replayModeTurn?.checked ? "turn" : "action";
    showReplayPosition(0);
}
function exitReplay() {
    if (!isReplayMode) return;
    isReplayMode = false;
    replayFrames = [];
    replayPanel.style.display = "none";
    endActions.style.display = "flex";
    renderBoard(finalBoard, null, winningLine);
    cells.forEach(c => { c.disabled = true; });
}
replayStartButton?.addEventListener("click", () => showReplayPosition(0));
replayEndButton?.addEventListener("click", () => {
    if (!replayFrames.length) buildReplayFrames();
    showReplayPosition(Math.max(0, replayFrames.length - 1));
});
replayPrevButton?.addEventListener("click", () => {
    if (replayMode === "turn") {
        const previous = [...replayTurnLimits()].reverse().find(v => v < replayPosition) ?? 0;
        showReplayPosition(previous);
    } else showReplayPosition(replayPosition - 1);
});
replayNextButton?.addEventListener("click", () => {
    if (replayMode === "turn") {
        const next = replayTurnLimits().find(v => v > replayPosition) ?? Math.max(0, replayFrames.length - 1);
        showReplayPosition(next);
    } else showReplayPosition(replayPosition + 1);
});
replayModeAction?.addEventListener("change", () => { if (replayModeAction.checked) { replayMode = "action"; updateReplayUI(); } });
replayModeTurn?.addEventListener("change", () => {
    if (!replayModeTurn.checked) return;
    replayMode = "turn";
    const limits = replayTurnLimits();
    replayPosition = limits.find(v => v >= replayPosition) ?? Math.max(0, replayFrames.length - 1);
    showReplayPosition(replayPosition);
});
replayExitButton?.addEventListener("click", exitReplay);
replayExitButtonBottom?.addEventListener("click", exitReplay);
endReplayButton?.addEventListener("click", startReplay);
popupReplayButton?.addEventListener("click", startReplay);

// =====================================================
// REVANCHE / ABANDON / NAVIGATION
// =====================================================
function requestRematch() {
    if (!requireSocket() || !currentRoom || !matchFinished) return;
    socket.emit("requestRematch");
    if (restartButton) { restartButton.disabled = true; restartButton.textContent = "Revanche demandée..."; }
    if (popupRestartButton) { popupRestartButton.disabled = true; popupRestartButton.textContent = "EN ATTENTE..."; }
}
restartButton?.addEventListener("click", requestRematch);
popupRestartButton?.addEventListener("click", requestRematch);
closeResultButton?.addEventListener("click", () => { resultPopup.style.display = "none"; if (endActions) endActions.style.display = "flex"; });

socket?.on("rematchRequested", data => {
    const accepted = typeof confirm === "function" ? confirm(`${data?.from || "Ton adversaire"} demande une revanche. Accepter ?`) : true;
    socket.emit("respondRematch", { accepted });
});
socket?.on("rematchState", state => {
    if (state?.X && state?.O) {
        if (resultPopup) resultPopup.style.display = "none";
        if (restartButton) restartButton.disabled = true;
    }
});
socket?.on("rematchDeclined", data => {
    if (gameMessage) gameMessage.textContent = `${data?.by || "L'adversaire"} a refusé la revanche.`;
    if (restartButton) { restartButton.disabled = false; restartButton.textContent = "↻ Demander une revanche"; }
    if (popupRestartButton) { popupRestartButton.disabled = false; popupRestartButton.textContent = "↻ DEMANDER UNE REVANCHE"; }
});

abandonButton?.addEventListener("click", () => {
    if (!currentRoom || matchFinished) return;
    const ok = typeof confirm === "function" ? confirm("Abandonner la partie ? Ton adversaire gagnera le match.") : true;
    if (ok) socket?.emit("forfeitMatch");
});

function leaveOnlineRoom(destination, { forfeit = true } = {}) {
    if (currentRoom && socket?.connected) {
        socket.emit("leaveRoom");
    }
    clearOnlineSession();
    location.href = destination;
}
function goPreparation() {
    const ok = !currentRoom || matchFinished || currentStatus === "lobby" || typeof confirm !== "function" || confirm("Quitter maintenant abandonnera le match. Continuer ?");
    if (ok) leaveOnlineRoom("../Rencontre/rencontre.html", { forfeit: true });
}
function goHome() {
    const ok = !currentRoom || matchFinished || currentStatus === "lobby" || typeof confirm !== "function" || confirm("Quitter maintenant abandonnera le match. Continuer ?");
    if (ok) leaveOnlineRoom("../index.html", { forfeit: true });
}
changeModeButton?.addEventListener("click", goPreparation);
endChangeModeButton?.addEventListener("click", goPreparation);
homeButton?.addEventListener("click", goHome);
multiBackButton?.addEventListener("click", event => { if (!currentRoom) return; event.preventDefault(); goPreparation(); });
settingsButton?.addEventListener("click", () => {
    saveOnlineSession();
    sessionStorage.setItem(SETTINGS_RETURN_KEY, "../Multiplayer/multi.html?resume=1");
});

