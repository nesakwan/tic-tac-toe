// ==========================================================
// TIC TAC TOE — MOTEUR DE PARTIE
// ==========================================================

// ----------------------------------------------------------
// ÉLÉMENTS HTML
// ----------------------------------------------------------

const turnPlayer = document.getElementById("turn-player");
const resultPopup = document.getElementById("result-popup");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const resultIcon = document.getElementById("result-icon");
const resultKicker = document.getElementById("result-kicker");
const gameBoardElement = document.getElementById("game-board");
let cells = Array.from(document.querySelectorAll(".cell"));

const restartButton = document.getElementById("restart-button");
const homeButton = document.getElementById("home-button");
const backButton = document.getElementById("back-button");
const settingsButton = document.getElementById("settings-button");

const closeResultButton = document.getElementById("close-result-button");
const popupRestartButton = document.getElementById("popup-restart-button");
const popupReplayButton = document.getElementById("popup-replay-button");
const changeModeButton = document.getElementById("change-mode-button");

const endActions = document.getElementById("end-actions");
const endReplayButton = document.getElementById("end-replay-button");
const endRestartButton = document.getElementById("end-restart-button");
const endChangeModeButton = document.getElementById("end-change-mode-button");

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

const playerOneNameElement = document.getElementById("player-one-name");
const playerOneSymbolElement = document.getElementById("player-one-symbol");
const playerTwoNameElement = document.getElementById("player-two-name");
const playerTwoSymbolElement = document.getElementById("player-two-symbol");
const playerTwoMetaElement = document.getElementById("player-two-meta");

const scorePlayerOneName = document.getElementById("score-player-one-name");
const scorePlayerTwoName = document.getElementById("score-player-two-name");
const scorePlayerOne = document.getElementById("score-player-one");
const scorePlayerTwo = document.getElementById("score-player-two");
const scoreDraw = document.getElementById("score-draw");

const startTossOverlay = document.getElementById("start-toss");
const startCoin = document.getElementById("start-coin");
const startTossSubtitle = document.getElementById("start-toss-subtitle");
const startTossResult = document.getElementById("start-toss-result");
const matchRoundLabel = document.getElementById("match-round-label");
const matchFormatLabel = document.getElementById("match-format-label");
const turnTimerElement = document.getElementById("turn-timer");
const turnTimerBar = document.getElementById("turn-timer-bar");
const turnTimerValue = document.getElementById("turn-timer-value");
const abandonButton = document.getElementById("abandon-button");


// ----------------------------------------------------------
// STOCKAGE
// ----------------------------------------------------------

const PREPARATION_STORAGE_KEY = "tttPreparationState";
const MATCH_STORAGE_KEY = "tttMatchState";
const RESUME_MATCH_KEY = "tttResumeMatch";
const SETTINGS_RETURN_KEY = "tttSettingsReturn";

function lireJSON(storage, key, fallback = {}) {
    const raw = storage.getItem(key);
    if (!raw) return fallback;

    try {
        return JSON.parse(raw) || fallback;
    } catch (error) {
        console.warn(`Donnée invalide pour ${key}.`, error);
        return fallback;
    }
}

function chargerPreparation() {
    return lireJSON(sessionStorage, PREPARATION_STORAGE_KEY, {});
}

const preparationData = chargerPreparation();
const gameMode = preparationData.gameMode === "ai" ? "ai" : "local";
const difficulty = preparationData.difficulty || "normal";
const boardSize = Number(preparationData.boardSize) === 4 ? 4 : 3;
const boardCellCount = boardSize * boardSize;
const bestOf = [1, 3, 5].includes(Number(preparationData.bestOf)) ? Number(preparationData.bestOf) : 1;
const winsRequired = Math.ceil(bestOf / 2);
const turnTime = [0, 10, 20, 30].includes(Number(preparationData.turnTime)) ? Number(preparationData.turnTime) : 0;
const localProfile = globalThis.TTTPlayerData?.getProfile?.() || null;
const profileDefaultName = localProfile?.name || "Joueur 1";

function construirePlateau() {
    if (!gameBoardElement) return;

    if (globalThis.TTTBoardUI?.buildBoard) {
        cells = globalThis.TTTBoardUI.buildBoard(gameBoardElement, boardSize);
        return;
    }

    if (gameBoardElement.style?.setProperty) {
        gameBoardElement.style.setProperty("--board-size", String(boardSize));
    }

    gameBoardElement.classList?.toggle("board-4x4", boardSize === 4);

    // Fallback utilisé notamment par les tests sans DOM complet.
    if (boardSize === 4 && typeof document.createElement === "function") {
        gameBoardElement.innerHTML = "";
        for (let index = 0; index < boardCellCount; index++) {
            const cell = document.createElement("button");
            cell.id = `cell${index}`;
            cell.className = "cell";
            cell.type = "button";
            cell.dataset.index = String(index);
            cell.setAttribute("aria-label", `Case ${index + 1}`);
            gameBoardElement.appendChild(cell);
        }
        cells = Array.from(gameBoardElement.querySelectorAll(".cell"));
    } else {
        cells = Array.from(document.querySelectorAll(".cell")).slice(0, boardCellCount);
    }
}

construirePlateau();


// ----------------------------------------------------------
// IDENTITÉ DES PARTICIPANTS
// ----------------------------------------------------------

function normaliserSymbole(valeur, symboleParDefaut = "X") {
    const symbole = String(valeur || "").trim().toUpperCase();
    return symbole === "X" || symbole === "O"
        ? symbole
        : symboleParDefaut;
}

function normaliserNom(valeur, nomParDefaut) {
    const nom = String(valeur || "").trim();
    return nom || nomParDefaut;
}

function libelleDifficulte(value = difficulty) {
    const labels = {
        easy: "FACILE",
        normal: "NORMAL",
        hard: "DIFFICILE",
        god: "GOD"
    };
    return labels[value] || "NORMAL";
}

function resoudreNomIA() {
    if (gameMode !== "ai") return null;

    const savedName = String(preparationData.aiOpponentName || "").trim();
    const aiNames = globalThis.TTTAiNames;

    if (aiNames?.nomValide?.(savedName, difficulty)) {
        return savedName;
    }

    const generatedName = aiNames?.genererNom
        ? aiNames.genererNom(difficulty, savedName)
        : (difficulty === "god"
            ? (Math.random() < 0.5 ? "Gojo" : "Sukuna")
            : ["Thome", "Olivier", "Lucas", "Hugo", "Noah", "Adam"][
                Math.floor(Math.random() * 6)
            ]);

    preparationData.aiOpponentName = generatedName;
    sessionStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify(preparationData));
    return generatedName;
}

const humanSymbol = normaliserSymbole(preparationData.aiPlayerSymbol, "X");
const aiSymbol = humanSymbol === "X" ? "O" : "X";

const localPlayer1Symbol = normaliserSymbole(preparationData.player1Symbol, "X");
let localPlayer2Symbol = normaliserSymbole(
    preparationData.player2Symbol,
    localPlayer1Symbol === "X" ? "O" : "X"
);

// Sécurité : deux adversaires ne peuvent jamais posséder le même symbole.
if (localPlayer2Symbol === localPlayer1Symbol) {
    localPlayer2Symbol = localPlayer1Symbol === "X" ? "O" : "X";
}

const playerOne = gameMode === "ai"
    ? {
        actor: "human",
        name: normaliserNom(preparationData.aiPlayerName, profileDefaultName),
        symbol: humanSymbol,
        meta: "JOUEUR"
    }
    : {
        actor: "player1",
        name: normaliserNom(preparationData.localPlayer1Name, profileDefaultName),
        symbol: localPlayer1Symbol,
        meta: "JOUEUR 1"
    };

const playerTwo = gameMode === "ai"
    ? {
        actor: "ai",
        name: resoudreNomIA(),
        symbol: aiSymbol,
        meta: `IA • ${libelleDifficulte()}`
    }
    : {
        actor: "player2",
        name: normaliserNom(preparationData.localPlayer2Name, "Joueur 2"),
        symbol: localPlayer2Symbol,
        meta: "JOUEUR 2"
    };

function participantParSymbole(symbole) {
    if (playerOne.symbol === symbole) return playerOne;
    if (playerTwo.symbol === symbole) return playerTwo;
    return null;
}

function participantParActeur(actor) {
    if (actor === playerOne.actor || (actor === "human" && gameMode === "ai")) {
        return playerOne;
    }
    if (actor === playerTwo.actor || (actor === "ai" && gameMode === "ai")) {
        return playerTwo;
    }
    if (actor === "player1") return playerOne;
    if (actor === "player2") return playerTwo;
    return null;
}

function cosmetiquePourSymbole(symbole) {
    return globalThis.TTTPlayerData?.cosmeticForSymbol?.(localProfile, symbole)
        || { style: "classic", theme: symbole === "O" ? "pink" : "blue" };
}

function appliquerClasseSymbole(element, symbole) {
    if (!element?.classList) return;
    element.classList.remove("symbol-x", "symbol-o", "mark-x", "mark-o");
    if (symbole === "X") element.classList.add("symbol-x");
    if (symbole === "O") element.classList.add("symbol-o");
    globalThis.TTTPlayerData?.applyElementCosmetic?.(element, symbole, cosmetiquePourSymbole(symbole));
}

function afficherIdentiteParticipants() {
    if (playerOneNameElement) playerOneNameElement.textContent = playerOne.name;
    if (playerOneSymbolElement) {
        playerOneSymbolElement.textContent = playerOne.symbol;
        appliquerClasseSymbole(playerOneSymbolElement, playerOne.symbol);
    }
    if (playerTwoNameElement) playerTwoNameElement.textContent = playerTwo.name;
    if (playerTwoSymbolElement) {
        playerTwoSymbolElement.textContent = playerTwo.symbol;
        appliquerClasseSymbole(playerTwoSymbolElement, playerTwo.symbol);
    }
    if (playerTwoMetaElement) playerTwoMetaElement.textContent = playerTwo.meta;

    if (scorePlayerOneName) {
        scorePlayerOneName.textContent = `${playerOne.name} · ${playerOne.symbol}`;
    }
    if (scorePlayerTwoName) {
        scorePlayerTwoName.textContent = `${playerTwo.name} · ${playerTwo.symbol}`;
    }
}


// ----------------------------------------------------------
// ÉTAT DE PARTIE
// ----------------------------------------------------------

let gameBoard = Array(boardCellCount).fill("");
let currentLocalPlayer = 1;
let isAiThinking = false;
let isStartingToss = false;
let startTossSequence = 0;
let gameFinished = false;
let resultScored = false;
let matchFinished = false;
let roundNumber = 1;
let nextRoundStarterSymbol = null;
let roundsHistory = [];
let matchHistoryRecorded = false;
let matchSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let turnTimerInterval = null;
let turnTimerDeadline = null;
let turnTimerRemainingMs = turnTime > 0 ? turnTime * 1000 : 0;
let turnTimerSymbol = null;

// Historique des coups réellement joués. Les simulations Minimax n'y touchent pas.
let moveHistory = [];
let finalBoard = Array(boardCellCount).fill("");
let isReplayMode = false;
let replayPosition = 0;
let replayMode = "action";
let replayFrames = [];

let scores = {
    player1: 0,
    player2: 0,
    draw: 0
};

function genererCombinaisonsGagnantes(size) {
    const combinations = [];

    for (let row = 0; row < size; row++) {
        combinations.push(
            Array.from({ length: size }, (_, col) => row * size + col)
        );
    }

    for (let col = 0; col < size; col++) {
        combinations.push(
            Array.from({ length: size }, (_, row) => row * size + col)
        );
    }

    combinations.push(
        Array.from({ length: size }, (_, index) => index * size + index)
    );

    combinations.push(
        Array.from(
            { length: size },
            (_, index) => index * size + (size - 1 - index)
        )
    );

    return combinations;
}

const winningCombinations = genererCombinaisonsGagnantes(boardSize);

function mettreAJourScores() {
    if (scorePlayerOne) scorePlayerOne.textContent = String(scores.player1);
    if (scorePlayerTwo) scorePlayerTwo.textContent = String(scores.player2);
    if (scoreDraw) scoreDraw.textContent = String(scores.draw);
}

function mettreAJourProgressionMatch() {
    if (matchRoundLabel) matchRoundLabel.textContent = `MANCHE ${roundNumber}`;
    if (matchFormatLabel) matchFormatLabel.textContent = `BO${bestOf} • Premier à ${winsRequired}`;
}

function scoreDuParticipant(participant) {
    if (participant === playerOne) return scores.player1;
    if (participant === playerTwo) return scores.player2;
    return 0;
}

function sauvegarderEtatMatch() {
    const state = {
        boardSize,
        gameBoard: [...gameBoard],
        currentLocalPlayer,
        isAiThinking,
        gameFinished,
        resultScored,
        moveHistory: moveHistory.map(move => ({ ...move })),
        finalBoard: [...finalBoard],
        scores: { ...scores },
        bestOf,
        winsRequired,
        roundNumber,
        matchFinished,
        nextRoundStarterSymbol,
        roundsHistory: roundsHistory.map(round => ({ ...round, board: [...round.board], moves: round.moves.map(move => ({ ...move })) })),
        isReplayMode,
        replayPosition,
        replayMode,
        resultPopupVisible: resultPopup?.style.display === "flex",
        endActionsVisible: endActions?.style.display === "flex",
        resultTitleText: resultTitle?.textContent || "",
        resultMessageText: resultMessage?.textContent || "",
        resultIconText: resultIcon?.textContent || "",
        resultKickerText: resultKicker?.textContent || "",
        turnTimerRemainingMs: turnTime > 0 ? obtenirTempsRestantTour() : 0,
        turnTimerSymbol,
        matchSessionId
    };

    sessionStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(state));
    return state;
}

function etatMatchValide(state) {
    return state &&
        Array.isArray(state.gameBoard) &&
        state.gameBoard.length === boardCellCount &&
        Array.isArray(state.moveHistory);
}

function restaurerEtatMatchSiDemande() {
    if (sessionStorage.getItem(RESUME_MATCH_KEY) !== "1") return false;

    sessionStorage.removeItem(RESUME_MATCH_KEY);
    const state = lireJSON(sessionStorage, MATCH_STORAGE_KEY, null);
    if (!etatMatchValide(state)) return false;

    gameBoard = state.gameBoard.map(value => normaliserSymbole(value, ""));
    currentLocalPlayer = state.currentLocalPlayer === 2 ? 2 : 1;
    isAiThinking = Boolean(state.isAiThinking);
    gameFinished = Boolean(state.gameFinished);
    resultScored = Boolean(state.resultScored);
    moveHistory = state.moveHistory.map(move => ({ ...move }));
    finalBoard = Array.isArray(state.finalBoard) && state.finalBoard.length === boardCellCount
        ? [...state.finalBoard]
        : [...gameBoard];
    scores = {
        player1: Number(state.scores?.player1) || 0,
        player2: Number(state.scores?.player2) || 0,
        draw: Number(state.scores?.draw) || 0
    };
    roundNumber = Math.max(1, Number(state.roundNumber) || 1);
    matchFinished = Boolean(state.matchFinished);
    nextRoundStarterSymbol = state.nextRoundStarterSymbol === "X" || state.nextRoundStarterSymbol === "O"
        ? state.nextRoundStarterSymbol
        : null;
    roundsHistory = Array.isArray(state.roundsHistory) ? state.roundsHistory.map(round => ({
        ...round,
        board: Array.isArray(round.board) ? [...round.board] : [],
        moves: Array.isArray(round.moves) ? round.moves.map(move => ({ ...move })) : []
    })) : [];
    isReplayMode = Boolean(state.isReplayMode);
    replayPosition = Number.isInteger(state.replayPosition) ? state.replayPosition : 0;
    replayMode = state.replayMode === "turn" ? "turn" : "action";
    turnTimerRemainingMs = Math.max(0, Number(state.turnTimerRemainingMs) || turnTime * 1000);
    turnTimerSymbol = state.turnTimerSymbol === "X" || state.turnTimerSymbol === "O" ? state.turnTimerSymbol : null;
    matchSessionId = String(state.matchSessionId || matchSessionId);

    mettreAJourScores();
    mettreAJourProgressionMatch();

    if (resultTitle && state.resultTitleText) resultTitle.textContent = state.resultTitleText;
    if (resultMessage && state.resultMessageText) resultMessage.textContent = state.resultMessageText;
    if (resultIcon && state.resultIconText) resultIcon.textContent = state.resultIconText;
    if (resultKicker && state.resultKickerText) resultKicker.textContent = state.resultKickerText;

    if (isReplayMode && gameFinished) {
        if (replayPanel) replayPanel.style.display = "block";
        afficherActionsFin(false);
        afficherPositionReplay(replayPosition);
        return true;
    }

    afficherGrille(gameBoard);

    if (gameFinished) {
        afficherActionsFin(true);
        if (resultPopup) {
            const restoredWinner = trouverGagnant();
            if (!restoredWinner) appliquerStyleResultat("draw");
            else if (gameMode === "ai" && restoredWinner === playerTwo.symbol) appliquerStyleResultat("defeat");
            else appliquerStyleResultat("victory");
            resultPopup.style.display = state.resultPopupVisible ? "flex" : "none";
        }
        afficherTour("", "Partie terminée");
        return true;
    }

    if (gameMode === "ai" && isAiThinking) {
        // Le timer de l'ancienne page n'existe plus : on relance la réponse IA.
        isAiThinking = false;
        lancerTourIA();
        return true;
    }

    if (gameMode === "ai") {
        afficherTour(humanSymbol);
        demarrerTimerTour(humanSymbol, turnTimerRemainingMs);
    } else {
        const activeSymbol = symboleActuelLocal();
        afficherTour(activeSymbol);
        demarrerTimerTour(activeSymbol, turnTimerRemainingMs);
    }

    return true;
}


// ----------------------------------------------------------
// AFFICHAGE DU TOUR
// ----------------------------------------------------------

function symboleActuelLocal() {
    return currentLocalPlayer === 1 ? localPlayer1Symbol : localPlayer2Symbol;
}

function afficherTour(symbole, texte = null) {
    if (!turnPlayer) return;

    if (!symbole) {
        turnPlayer.innerHTML = `<p>${texte || "Partie terminée"}</p>`;
        return;
    }

    const participant = participantParSymbole(symbole);
    const nom = participant?.name || symbole;

    if (texte) {
        turnPlayer.innerHTML = `<p>${texte} — <strong>${symbole}</strong></p>`;
    } else {
        turnPlayer.innerHTML = `<p>Tour de <strong>${nom}</strong> — ${symbole}</p>`;
    }
}


// ----------------------------------------------------------
// TIMER PAR TOUR
// ----------------------------------------------------------

function obtenirTempsRestantTour() {
    if (turnTime <= 0) return 0;
    if (turnTimerDeadline) return Math.max(0, turnTimerDeadline - Date.now());
    return Math.max(0, turnTimerRemainingMs || turnTime * 1000);
}

function afficherTimerTour() {
    if (!turnTimerElement) return;

    if (turnTime <= 0 || !turnTimerSymbol || gameFinished || isStartingToss || isReplayMode) {
        turnTimerElement.hidden = true;
        return;
    }

    const remaining = obtenirTempsRestantTour();
    const total = turnTime * 1000;
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    turnTimerElement.hidden = false;
    turnTimerElement.classList.toggle("is-low", remaining <= Math.min(5000, total * 0.25));
    if (turnTimerBar) turnTimerBar.style.transform = `scaleX(${ratio})`;
    if (turnTimerValue) turnTimerValue.textContent = `${Math.max(0, Math.ceil(remaining / 1000))} s`;
}

function stopperTimerTour({ preserve = false } = {}) {
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }

    if (preserve && turnTimerDeadline) {
        turnTimerRemainingMs = Math.max(0, turnTimerDeadline - Date.now());
    }

    turnTimerDeadline = null;

    if (!preserve) {
        turnTimerRemainingMs = turnTime > 0 ? turnTime * 1000 : 0;
        turnTimerSymbol = null;
    }

    afficherTimerTour();
}

function demarrerTimerTour(symbole, remainingMs = null) {
    stopperTimerTour();
    if (turnTime <= 0 || gameFinished || isStartingToss || isReplayMode) return;
    if (symbole !== "X" && symbole !== "O") return;

    turnTimerSymbol = symbole;
    turnTimerRemainingMs = Math.max(0, Number(remainingMs) || turnTime * 1000);
    turnTimerDeadline = Date.now() + turnTimerRemainingMs;

    const tick = () => {
        afficherTimerTour();
        if (obtenirTempsRestantTour() <= 0) {
            stopperTimerTour();
            gererExpirationTimerTour(symbole);
        }
    };

    tick();
    turnTimerInterval = setInterval(tick, 100);
}

function gererExpirationTimerTour(symboleExpire) {
    if (gameFinished || isReplayMode || isStartingToss) return;

    const participant = participantParSymbole(symboleExpire);
    if (turnPlayer) {
        turnPlayer.innerHTML = `<p><strong>${participant?.name || symboleExpire}</strong> a dépassé le temps — tour perdu.</p>`;
    }

    definirInteractiviteGrille(false);

    setTimeout(() => {
        if (gameFinished || isReplayMode || isStartingToss) return;

        if (gameMode === "ai") {
            if (symboleExpire === humanSymbol) {
                lancerTourIA();
            } else {
                isAiThinking = false;
                definirInteractiviteGrille(true);
                afficherTour(humanSymbol);
                demarrerTimerTour(humanSymbol);
                sauvegarderEtatMatch();
            }
            return;
        }

        currentLocalPlayer = currentLocalPlayer === 1 ? 2 : 1;
        definirInteractiviteGrille(true);
        const nextSymbol = symboleActuelLocal();
        afficherTour(nextSymbol);
        demarrerTimerTour(nextSymbol);
        sauvegarderEtatMatch();
    }, 420);
}


// ----------------------------------------------------------
// GRILLE ET COUPS
// ----------------------------------------------------------

function enregistrerCoup(index, symbole, actor) {
    moveHistory.push({ index, symbol: symbole, actor });
}

function placerSymbole(index, symbole, actor = null, recordMove = true) {
    if (
        gameFinished ||
        isReplayMode ||
        isStartingToss ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= boardCellCount ||
        gameBoard[index] !== ""
    ) {
        return false;
    }

    stopperTimerTour();
    gameBoard[index] = symbole;
    const cell = document.getElementById(`cell${index}`);
    if (cell) {
        if (globalThis.TTTBoardUI?.paintCell) {
            globalThis.TTTBoardUI.paintCell(cell, symbole, { animate: true, cosmetic: cosmetiquePourSymbole(symbole) });
        } else {
            cell.textContent = symbole;
            cell.classList?.remove("mark-x", "mark-o");
            cell.classList?.add(symbole === "X" ? "mark-x" : "mark-o");
        }
    }

    if (recordMove && actor) enregistrerCoup(index, symbole, actor);
    sauvegarderEtatMatch();
    return true;
}

function afficherGrille(grille) {
    cells.forEach((cell, index) => {
        const symbole = grille[index] || "";

        if (globalThis.TTTBoardUI?.paintCell) {
            globalThis.TTTBoardUI.paintCell(cell, symbole, {
                animate: false,
                winning: false,
                cosmetic: symbole ? cosmetiquePourSymbole(symbole) : null
            });
        } else {
            cell.textContent = symbole;
            cell.classList?.remove("mark-x", "mark-o", "winning-cell");
            if (symbole === "X") cell.classList?.add("mark-x");
            if (symbole === "O") cell.classList?.add("mark-o");
        }
    });
}

function verifierGagnant(grille, symbole) {
    return winningCombinations.some(combination =>
        combination.every(index => grille[index] === symbole)
    );
}

function trouverCombinaisonGagnante(grille = gameBoard) {
    for (const combination of winningCombinations) {
        const symbole = grille[combination[0]];
        if (symbole && combination.every(index => grille[index] === symbole)) {
            return [...combination];
        }
    }
    return [];
}

function surlignerCombinaisonGagnante(grille = gameBoard) {
    const line = trouverCombinaisonGagnante(grille);
    cells.forEach(cell => cell.classList?.remove("winning-cell"));
    line.forEach(index => {
        const cell = document.getElementById(`cell${index}`);
        cell?.classList?.add("winning-cell");
    });
    return line;
}

function trouverGagnant() {
    for (const symbole of ["X", "O"]) {
        if (verifierGagnant(gameBoard, symbole)) return symbole;
    }
    return null;
}

function checkDraw() {
    return gameBoard.every(cell => cell !== "");
}

function terminerSiNecessaire() {
    const gagnant = trouverGagnant();

    if (gagnant) {
        stopperTimerTour();
        gameFinished = true;
        surlignerCombinaisonGagnante(gameBoard);
        showResult(gagnant);
        sauvegarderEtatMatch();
        return true;
    }

    if (checkDraw()) {
        stopperTimerTour();
        gameFinished = true;
        showResult(null);
        sauvegarderEtatMatch();
        return true;
    }

    return false;
}

function trouverCasesLibres(grille) {
    return grille
        .map((cell, index) => cell === "" ? index : null)
        .filter(index => index !== null);
}


// ----------------------------------------------------------
// TIRAGE AU SORT DU PREMIER JOUEUR
// ----------------------------------------------------------

function definirInteractiviteGrille(active) {
    cells.forEach((cell, index) => {
        cell.disabled = !active || gameBoard[index] !== "";
    });
}

function participantDepartAleatoire() {
    return Math.random() < 0.5 ? playerOne : playerTwo;
}

function terminerTirageAuSort(participant, sequence) {
    if (sequence !== startTossSequence) return;

    const symbole = participant.symbol;

    if (startCoin) {
        startCoin.classList.remove("is-tossing", "lands-x", "lands-o");
        startCoin.classList.add(symbole === "X" ? "lands-x" : "lands-o");
    }

    if (startTossSubtitle) startTossSubtitle.textContent = "Le tirage est terminé";
    if (startTossResult) {
        startTossResult.textContent = `${participant.name} commence — ${symbole}`;
        startTossResult.classList.remove("result-x", "result-o");
        startTossResult.classList.add(symbole === "X" ? "result-x" : "result-o", "revealed");
    }

    setTimeout(() => {
        if (sequence !== startTossSequence) return;

        isStartingToss = false;
        if (startTossOverlay) startTossOverlay.hidden = true;

        if (gameMode === "ai") {
            if (participant.actor === "ai") {
                definirInteractiviteGrille(false);
                lancerTourIA();
            } else {
                definirInteractiviteGrille(true);
                afficherTour(humanSymbol);
                demarrerTimerTour(humanSymbol);
                sauvegarderEtatMatch();
            }
            return;
        }

        currentLocalPlayer = participant.actor === "player2" ? 2 : 1;
        definirInteractiviteGrille(true);
        const nextSymbol = symboleActuelLocal();
        afficherTour(nextSymbol);
        demarrerTimerTour(nextSymbol);
        sauvegarderEtatMatch();
    }, 900);
}

function lancerTirageAuSort() {
    // Fallback pour les anciens tests / environnements sans l'overlay HTML.
    if (!startTossOverlay) return false;

    const participant = participantDepartAleatoire();
    const sequence = ++startTossSequence;

    isStartingToss = true;
    stopperTimerTour();
    definirInteractiviteGrille(false);
    startTossOverlay.hidden = false;

    if (startTossSubtitle) startTossSubtitle.textContent = "Préparation du lancer...";
    if (startTossResult) {
        startTossResult.textContent = "TIRAGE...";
        startTossResult.classList.remove("result-x", "result-o", "revealed");
    }

    if (startCoin) {
        startCoin.classList.remove("is-tossing", "lands-x", "lands-o", "is-ready");
        startCoin.style?.setProperty?.(
            "--coin-final-rotation",
            participant.symbol === "O" ? "3420deg" : "3240deg"
        );
        void startCoin.offsetWidth;
        startCoin.classList.add("is-ready");
    }

    afficherTour("", "Tirage au sort...");

    setTimeout(() => {
        if (sequence !== startTossSequence) return;
        if (startTossSubtitle) startTossSubtitle.textContent = "La pièce s'envole...";
        if (startCoin) {
            startCoin.classList.remove("is-ready");
            void startCoin.offsetWidth;
            startCoin.classList.add("is-tossing");
        }
    }, 350);

    setTimeout(() => {
        if (sequence !== startTossSequence) return;
        if (startTossSubtitle) startTossSubtitle.textContent = "Elle ralentit...";
    }, 2050);

    setTimeout(() => {
        if (sequence !== startTossSequence) return;
        if (startTossSubtitle) startTossSubtitle.textContent = "La pièce retombe...";
    }, 2800);

    setTimeout(() => {
        terminerTirageAuSort(participant, sequence);
    }, 3350);

    return true;
}

// ----------------------------------------------------------
// MODE 2 JOUEURS
// ----------------------------------------------------------

function jouerLocal(index) {
    const symbole = symboleActuelLocal();
    const actor = currentLocalPlayer === 1 ? "player1" : "player2";

    if (!placerSymbole(index, symbole, actor)) return;
    if (terminerSiNecessaire()) return;

    currentLocalPlayer = currentLocalPlayer === 1 ? 2 : 1;
    const nextSymbol = symboleActuelLocal();
    afficherTour(nextSymbol);
    demarrerTimerTour(nextSymbol);
    sauvegarderEtatMatch();
}


// ----------------------------------------------------------
// MODE CONTRE IA
// ----------------------------------------------------------

function jouerContreIA(index) {
    if (isAiThinking || isStartingToss || gameFinished) return;
    if (!placerSymbole(index, humanSymbol, "human")) return;
    if (terminerSiNecessaire()) return;
    definirInteractiviteGrille(false);
    lancerTourIA();
}

function lancerTourIA() {
    if (gameFinished || gameMode !== "ai") return;

    isAiThinking = true;
    afficherTour(aiSymbol, `${playerTwo.name} joue`);
    demarrerTimerTour(aiSymbol);
    sauvegarderEtatMatch();

    setTimeout(() => {
        if (gameFinished || isReplayMode) return;

        const coupIA = choisirCoupIA();
        if (coupIA !== null && coupIA !== undefined) {
            placerSymbole(coupIA, aiSymbol, "ai");
        }

        isAiThinking = false;

        if (terminerSiNecessaire()) return;
        definirInteractiviteGrille(true);
        afficherTour(humanSymbol);
        demarrerTimerTour(humanSymbol);
        sauvegarderEtatMatch();
    }, 500);
}


// ----------------------------------------------------------
// IA — SÉLECTION DE DIFFICULTÉ
// ----------------------------------------------------------

function choisirCoupIA() {
    if (difficulty === "easy") return iaFacile(gameBoard);
    if (difficulty === "normal") return iaNormale(gameBoard, aiSymbol, humanSymbol);
    if (difficulty === "hard") return iaDifficile(gameBoard, aiSymbol, humanSymbol);
    if (difficulty === "god") return iaGod(gameBoard, aiSymbol, humanSymbol);

    console.warn("Difficulté IA inconnue :", difficulty);
    return iaNormale(gameBoard, aiSymbol, humanSymbol);
}

function iaFacile(grille) {
    const casesLibres = trouverCasesLibres(grille);
    if (casesLibres.length === 0) return null;
    return casesLibres[Math.floor(Math.random() * casesLibres.length)];
}

function trouverCoupGagnant(grille, symbole) {
    for (const index of trouverCasesLibres(grille)) {
        grille[index] = symbole;
        const gagne = verifierGagnant(grille, symbole);
        grille[index] = "";
        if (gagne) return index;
    }
    return null;
}

function indicesCentraux() {
    if (boardSize === 3) return [4];
    return [5, 6, 9, 10];
}

function indicesCoins() {
    return [
        0,
        boardSize - 1,
        boardCellCount - boardSize,
        boardCellCount - 1
    ];
}

function choisirParmiDisponibles(grille, indices) {
    const disponibles = indices.filter(index => grille[index] === "");
    if (disponibles.length === 0) return null;
    return disponibles[Math.floor(Math.random() * disponibles.length)];
}

function iaNormale(grille, symboleIA, symboleJoueur) {
    let coup = trouverCoupGagnant(grille, symboleIA);
    if (coup !== null) return coup;

    coup = trouverCoupGagnant(grille, symboleJoueur);
    if (coup !== null) return coup;

    coup = choisirParmiDisponibles(grille, indicesCentraux());
    if (coup !== null) return coup;

    coup = choisirParmiDisponibles(grille, indicesCoins());
    if (coup !== null) return coup;

    return iaFacile(grille);
}

function evaluerPosition(grille, symboleIA, symboleJoueur) {
    let score = 0;

    for (const index of indicesCentraux()) {
        if (grille[index] === symboleIA) score += 3;
        if (grille[index] === symboleJoueur) score -= 3;
    }

    for (const index of indicesCoins()) {
        if (grille[index] === symboleIA) score += 1;
        if (grille[index] === symboleJoueur) score -= 1;
    }

    for (const combination of winningCombinations) {
        const ligne = combination.map(index => grille[index]);
        const iaCount = ligne.filter(v => v === symboleIA).length;
        const joueurCount = ligne.filter(v => v === symboleJoueur).length;

        if (joueurCount === 0 && iaCount > 0) {
            score += Math.pow(3, iaCount - 1);
        }

        if (iaCount === 0 && joueurCount > 0) {
            score -= Math.pow(3, joueurCount - 1);
        }
    }

    return score;
}

function minimaxLimite(
    grille,
    profondeur,
    estMaximisation,
    symboleIA,
    symboleJoueur,
    profondeurMax
) {
    if (verifierGagnant(grille, symboleIA)) return 10 - profondeur;
    if (verifierGagnant(grille, symboleJoueur)) return profondeur - 10;

    const casesLibres = trouverCasesLibres(grille);
    if (casesLibres.length === 0) return 0;
    if (profondeur >= profondeurMax) {
        return evaluerPosition(grille, symboleIA, symboleJoueur);
    }

    if (estMaximisation) {
        let meilleurScore = -Infinity;
        for (const index of casesLibres) {
            grille[index] = symboleIA;
            const score = minimaxLimite(
                grille,
                profondeur + 1,
                false,
                symboleIA,
                symboleJoueur,
                profondeurMax
            );
            grille[index] = "";
            meilleurScore = Math.max(meilleurScore, score);
        }
        return meilleurScore;
    }

    let meilleurScore = Infinity;
    for (const index of casesLibres) {
        grille[index] = symboleJoueur;
        const score = minimaxLimite(
            grille,
            profondeur + 1,
            true,
            symboleIA,
            symboleJoueur,
            profondeurMax
        );
        grille[index] = "";
        meilleurScore = Math.min(meilleurScore, score);
    }
    return meilleurScore;
}

function iaDifficile(grille, symboleIA, symboleJoueur) {
    const casesLibres = trouverCasesLibres(grille);
    if (casesLibres.length === 0) return null;

    const coupsScores = [];
    for (const index of casesLibres) {
        grille[index] = symboleIA;
        const score = minimaxLimite(
            grille,
            0,
            false,
            symboleIA,
            symboleJoueur,
            boardSize === 4 ? 3 : 4
        );
        grille[index] = "";
        coupsScores.push({ index, score });
    }

    coupsScores.sort((a, b) => b.score - a.score);

    // 10 % de chance de jouer le deuxième meilleur coup : fort mais battable.
    if (coupsScores.length > 1 && Math.random() < 0.10) {
        return coupsScores[1].index;
    }

    return coupsScores[0].index;
}

function minimaxGod(grille, profondeur, estMaximisation, symboleIA, symboleJoueur) {
    if (verifierGagnant(grille, symboleIA)) return 10 - profondeur;
    if (verifierGagnant(grille, symboleJoueur)) return profondeur - 10;

    const casesLibres = trouverCasesLibres(grille);
    if (casesLibres.length === 0) return 0;

    if (estMaximisation) {
        let meilleurScore = -Infinity;
        for (const index of casesLibres) {
            grille[index] = symboleIA;
            const score = minimaxGod(
                grille,
                profondeur + 1,
                false,
                symboleIA,
                symboleJoueur
            );
            grille[index] = "";
            meilleurScore = Math.max(meilleurScore, score);
        }
        return meilleurScore;
    }

    let meilleurScore = Infinity;
    for (const index of casesLibres) {
        grille[index] = symboleJoueur;
        const score = minimaxGod(
            grille,
            profondeur + 1,
            true,
            symboleIA,
            symboleJoueur
        );
        grille[index] = "";
        meilleurScore = Math.min(meilleurScore, score);
    }
    return meilleurScore;
}

function ordonnerCoupsIA(grille, symboleIA, symboleJoueur) {
    const libres = trouverCasesLibres(grille);
    const gagnant = trouverCoupGagnant(grille, symboleIA);
    const blocage = trouverCoupGagnant(grille, symboleJoueur);
    const prioritaires = [
        gagnant,
        blocage,
        ...indicesCentraux(),
        ...indicesCoins()
    ].filter(index => Number.isInteger(index) && libres.includes(index));

    return [...new Set([...prioritaires, ...libres])];
}

function minimaxAlphaBeta(
    grille,
    profondeur,
    profondeurMax,
    estMaximisation,
    symboleIA,
    symboleJoueur,
    alpha,
    beta
) {
    if (verifierGagnant(grille, symboleIA)) return 1000 - profondeur * 10;
    if (verifierGagnant(grille, symboleJoueur)) return -1000 + profondeur * 10;

    const casesLibres = trouverCasesLibres(grille);
    if (casesLibres.length === 0) return 0;
    if (profondeur >= profondeurMax) {
        return evaluerPosition(grille, symboleIA, symboleJoueur);
    }

    const coups = ordonnerCoupsIA(grille, symboleIA, symboleJoueur);

    if (estMaximisation) {
        let meilleurScore = -Infinity;
        for (const index of coups) {
            grille[index] = symboleIA;
            const score = minimaxAlphaBeta(
                grille,
                profondeur + 1,
                profondeurMax,
                false,
                symboleIA,
                symboleJoueur,
                alpha,
                beta
            );
            grille[index] = "";
            meilleurScore = Math.max(meilleurScore, score);
            alpha = Math.max(alpha, meilleurScore);
            if (beta <= alpha) break;
        }
        return meilleurScore;
    }

    let meilleurScore = Infinity;
    for (const index of coups) {
        grille[index] = symboleJoueur;
        const score = minimaxAlphaBeta(
            grille,
            profondeur + 1,
            profondeurMax,
            true,
            symboleIA,
            symboleJoueur,
            alpha,
            beta
        );
        grille[index] = "";
        meilleurScore = Math.min(meilleurScore, score);
        beta = Math.min(beta, meilleurScore);
        if (beta <= alpha) break;
    }
    return meilleurScore;
}

function iaGod(grille, symboleIA, symboleJoueur) {
    const casesLibres = trouverCasesLibres(grille);
    if (casesLibres.length === 0) return null;

    // Le 3×3 reste parfaitement résolu avec le Minimax complet historique.
    if (boardSize === 3) {
        let meilleurScore = -Infinity;
        let meilleurCoup = null;

        for (const index of casesLibres) {
            grille[index] = symboleIA;
            const score = minimaxGod(
                grille,
                0,
                false,
                symboleIA,
                symboleJoueur
            );
            grille[index] = "";

            if (score > meilleurScore) {
                meilleurScore = score;
                meilleurCoup = index;
            }
        }

        return meilleurCoup;
    }

    // Sur 4×4, un Minimax complet explose combinatoirement.
    // On conserve une IA très forte grâce à l'alpha-bêta + heuristique,
    // avec une profondeur qui augmente naturellement en fin de partie.
    let coup = trouverCoupGagnant(grille, symboleIA);
    if (coup !== null) return coup;

    coup = trouverCoupGagnant(grille, symboleJoueur);
    if (coup !== null) return coup;

    const profondeurMax =
        casesLibres.length <= 7 ? 7 :
        casesLibres.length <= 10 ? 5 :
        3;

    let meilleurScore = -Infinity;
    let meilleurCoup = null;

    for (const index of ordonnerCoupsIA(grille, symboleIA, symboleJoueur)) {
        grille[index] = symboleIA;
        const score = minimaxAlphaBeta(
            grille,
            0,
            profondeurMax,
            false,
            symboleIA,
            symboleJoueur,
            -Infinity,
            Infinity
        );
        grille[index] = "";

        if (score > meilleurScore) {
            meilleurScore = score;
            meilleurCoup = index;
        }
    }

    return meilleurCoup ?? iaNormale(grille, symboleIA, symboleJoueur);
}


// ----------------------------------------------------------
// RÉSULTAT ET SCORES
// ----------------------------------------------------------

function afficherActionsFin(visible = true) {
    if (!endActions) return;
    endActions.style.display = visible ? "flex" : "none";
}

function incrementerScoreResultat(gagnant) {
    if (resultScored) return;

    if (!gagnant) {
        scores.draw += 1;
    } else if (playerOne.symbol === gagnant) {
        scores.player1 += 1;
    } else {
        scores.player2 += 1;
    }

    resultScored = true;
    mettreAJourScores();
}

function appliquerStyleResultat(type) {
    if (!resultPopup?.classList) return;
    resultPopup.classList.remove("result-victory", "result-defeat", "result-draw");
    resultPopup.classList.add(`result-${type}`);
}

function enregistrerMatchDansHistorique(winner = null, endReason = "victory") {
    if (matchHistoryRecorded || !matchFinished) return;
    const store = globalThis.TTTPlayerData;
    if (!store?.recordMatch) return;

    const profileName = String(localProfile?.name || "").trim().toLowerCase();
    const trackedParticipant = gameMode === "ai"
        ? playerOne
        : (profileName && playerTwo.name.trim().toLowerCase() === profileName && playerOne.name.trim().toLowerCase() !== profileName
            ? playerTwo
            : playerOne);

    const result = winner === trackedParticipant
        ? "win"
        : winner
            ? "loss"
            : "draw";

    store.recordMatch({
        externalId: `local-${matchSessionId}`,
        mode: gameMode === "ai" ? "ai" : "local",
        result,
        playerOneName: playerOne.name,
        playerTwoName: playerTwo.name,
        playerOneSymbol: playerOne.symbol,
        playerTwoSymbol: playerTwo.symbol,
        scoreOne: scores.player1,
        scoreTwo: scores.player2,
        draws: scores.draw,
        boardSize,
        bestOf,
        roundsPlayed: roundsHistory.length,
        endReason,
        difficulty: gameMode === "ai" ? difficulty : "",
        rounds: roundsHistory.map(round => ({
            round: round.round,
            winner: round.winner,
            board: [...round.board],
            moves: round.moves.map(move => ({ ...move }))
        }))
    });

    matchHistoryRecorded = true;
}

function showResult(gagnant) {
    finalBoard = [...gameBoard];
    incrementerScoreResultat(gagnant);

    const winner = gagnant ? participantParSymbole(gagnant) : null;
    const loser = winner === playerOne ? playerTwo : winner === playerTwo ? playerOne : null;
    nextRoundStarterSymbol = loser?.symbol || null;

    roundsHistory.push({
        round: roundNumber,
        winner: gagnant || null,
        board: [...finalBoard],
        moves: moveHistory.map(move => ({ ...move }))
    });

    matchFinished = Boolean(winner && scoreDuParticipant(winner) >= winsRequired);
    if (matchFinished) enregistrerMatchDansHistorique(winner, "victory");
    afficherActionsFin(true);
    mettreAJourProgressionMatch();

    if (restartButton) restartButton.textContent = matchFinished ? "↻ Nouvelle revanche" : "→ Manche suivante";
    if (popupRestartButton) popupRestartButton.textContent = matchFinished ? "↻ REVANCHE" : "→ MANCHE SUIVANTE";
    if (endRestartButton) endRestartButton.textContent = matchFinished ? "↻ Revanche" : "→ Manche suivante";

    if (!resultPopup) return;

    if (resultKicker) resultKicker.textContent = matchFinished ? "RÉSULTAT DU MATCH" : "RÉSULTAT DE LA MANCHE";

    if (bestOf === 1 && winner) {
        const playerWonAgainstAi = gameMode === "ai" && winner === playerOne;
        const playerLostAgainstAi = gameMode === "ai" && winner === playerTwo;
        appliquerStyleResultat(playerLostAgainstAi ? "defeat" : "victory");
        if (playerLostAgainstAi) {
            resultTitle.textContent = "DÉFAITE";
            resultMessage.textContent = `${playerTwo.name} remporte la partie — ${libelleDifficulte()}.`;
            resultIcon.textContent = "🤖";
        } else {
            resultTitle.textContent = `${winner.name.toUpperCase()} (${gagnant}) A GAGNÉ !`;
            resultMessage.textContent = playerWonAgainstAi
                ? `Victoire contre ${playerTwo.name} — ${libelleDifficulte()}.`
                : `${winner.name} remporte la partie face à ${loser.name}.`;
            resultIcon.textContent = "🏆";
        }
    } else if (matchFinished && winner) {
        const playerLostAgainstAi = gameMode === "ai" && winner === playerTwo;
        appliquerStyleResultat(playerLostAgainstAi ? "defeat" : "victory");
        resultTitle.textContent = playerLostAgainstAi ? "MATCH PERDU" : "MATCH REMPORTÉ !";
        resultMessage.textContent = `${winner.name} remporte le BO${bestOf} ${scoreDuParticipant(playerOne)} — ${scoreDuParticipant(playerTwo)}.`;
        resultIcon.textContent = playerLostAgainstAi ? "🤖" : "🏆";
    } else if (!gagnant) {
        appliquerStyleResultat("draw");
        if (bestOf === 1) {
            resultTitle.textContent = "MATCH NUL !";
            resultMessage.textContent = `${playerOne.name} (${playerOne.symbol}) et ${playerTwo.name} (${playerTwo.symbol}) se neutralisent.`;
        } else {
            resultTitle.textContent = "MANCHE NULLE";
            resultMessage.textContent = `Aucun point de match attribué. Nouveau tirage pour la manche ${roundNumber + 1}.`;
        }
        resultIcon.textContent = "🤝";
    } else {
        const playerLostAgainstAi = gameMode === "ai" && winner === playerTwo;
        appliquerStyleResultat(playerLostAgainstAi ? "defeat" : "victory");
        resultTitle.textContent = "MANCHE REMPORTÉE";
        resultMessage.textContent = `${winner.name} prend la manche ${roundNumber} — score ${scores.player1} à ${scores.player2}.`;
        resultIcon.textContent = playerLostAgainstAi ? "◆" : "🏆";
    }

    resultPopup.style.display = "none";
    void resultPopup.offsetWidth;
    resultPopup.style.display = "flex";
    sauvegarderEtatMatch();
}

function fermerResultat() {
    if (resultPopup) resultPopup.style.display = "none";
    afficherActionsFin(true);
    sauvegarderEtatMatch();
}


// ----------------------------------------------------------
// REPLAY
// ----------------------------------------------------------

function construireFramesReplay() {
    const rounds = roundsHistory.length > 0
        ? roundsHistory
        : [{ round: roundNumber, moves: moveHistory.map(move => ({ ...move })) }];

    const frames = [{
        round: rounds[0]?.round || 1,
        board: Array(boardCellCount).fill(""),
        move: null,
        turnEnd: true
    }];

    for (const round of rounds) {
        const board = Array(boardCellCount).fill("");
        const moves = Array.isArray(round.moves) ? round.moves : [];
        let offset = 0;

        // Si l'IA ouvre la manche, son premier coup constitue à lui seul un tour de replay.
        if (gameMode === "ai" && moves[0]?.actor === "ai") {
            const move = moves[0];
            board[move.index] = move.symbol;
            frames.push({ round: round.round, board: [...board], move, turnEnd: true });
            offset = 1;
        }

        for (let i = offset; i < moves.length; i++) {
            const move = moves[i];
            board[move.index] = move.symbol;
            const localCount = i - offset + 1;
            const turnEnd = gameMode === "ai"
                ? (move.actor === "ai" || i === moves.length - 1)
                : (localCount % 2 === 0 || i === moves.length - 1);
            frames.push({ round: round.round, board: [...board], move, turnEnd });
        }
    }

    replayFrames = frames;
    return replayFrames;
}

function grilleReplayJusqua(position) {
    if (!replayFrames.length) construireFramesReplay();
    const frame = replayFrames[Math.max(0, Math.min(replayFrames.length - 1, position))];
    return frame ? [...frame.board] : Array(boardCellCount).fill("");
}

function obtenirLimitesToursReplay() {
    if (!replayFrames.length) construireFramesReplay();
    const limites = [0];
    replayFrames.forEach((frame, index) => {
        if (index > 0 && frame.turnEnd) limites.push(index);
    });
    return [...new Set(limites)];
}

function positionTourSuivante(position) {
    return obtenirLimitesToursReplay().find(limite => limite > position)
        ?? Math.max(0, replayFrames.length - 1);
}

function positionTourPrecedente(position) {
    const limites = obtenirLimitesToursReplay();
    for (let index = limites.length - 1; index >= 0; index--) {
        if (limites[index] < position) return limites[index];
    }
    return 0;
}

function decrireCoup(move, round = roundNumber) {
    if (!move) return `Début du match — manche ${round}`;
    const participant = participantParActeur(move.actor);
    const nom = participant?.name || move.symbol;
    return `Manche ${round} • ${nom} joue ${move.symbol} en case ${move.index + 1}`;
}

function mettreAJourDescriptionReplay() {
    if (!replayActionLabel) return;
    if (!replayFrames.length) construireFramesReplay();
    const frame = replayFrames[replayPosition];
    replayActionLabel.textContent = frame?.move
        ? decrireCoup(frame.move, frame.round)
        : `Début du match — manche ${frame?.round || 1}`;
}

function mettreAJourProgressionReplay() {
    if (!replayFrames.length) construireFramesReplay();
    const last = Math.max(0, replayFrames.length - 1);

    if (replayProgress) {
        if (replayMode === "turn") {
            const limites = obtenirLimitesToursReplay();
            const indexExact = limites.findIndex(limite => limite === replayPosition);
            const tourActuel = indexExact >= 0 ? indexExact : 0;
            replayProgress.textContent = `Tour ${tourActuel} / ${Math.max(0, limites.length - 1)}`;
        } else {
            replayProgress.textContent = `Action ${replayPosition} / ${last}`;
        }
    }

    if (replayStartButton) replayStartButton.disabled = replayPosition === 0;
    if (replayPrevButton) replayPrevButton.disabled = replayPosition === 0;
    if (replayNextButton) replayNextButton.disabled = replayPosition >= last;
    if (replayEndButton) replayEndButton.disabled = replayPosition >= last;
    mettreAJourDescriptionReplay();
}

function afficherPositionReplay(position) {
    if (!replayFrames.length) construireFramesReplay();
    const last = Math.max(0, replayFrames.length - 1);
    replayPosition = Math.max(0, Math.min(last, position));
    afficherGrille(grilleReplayJusqua(replayPosition));
    mettreAJourProgressionReplay();
    sauvegarderEtatMatch();
}

function changerModeReplay(mode) {
    replayMode = mode === "turn" ? "turn" : "action";
    if (replayMode === "turn") {
        const limites = obtenirLimitesToursReplay();
        replayPosition = limites.find(limite => limite >= replayPosition) ?? Math.max(0, replayFrames.length - 1);
    }
    afficherPositionReplay(replayPosition);
}

function demarrerReplay() {
    if (!gameFinished) return;
    stopperTimerTour();
    construireFramesReplay();
    if (replayFrames.length <= 1) return;

    isReplayMode = true;
    replayPosition = 0;
    replayMode = replayModeTurn?.checked ? "turn" : "action";

    if (resultPopup) resultPopup.style.display = "none";
    afficherActionsFin(false);
    if (replayPanel) replayPanel.style.display = "block";
    afficherPositionReplay(0);
}

function replayDebut() { if (isReplayMode) afficherPositionReplay(0); }
function replayPrecedent() {
    if (!isReplayMode) return;
    afficherPositionReplay(replayMode === "turn" ? positionTourPrecedente(replayPosition) : replayPosition - 1);
}
function replaySuivant() {
    if (!isReplayMode) return;
    afficherPositionReplay(replayMode === "turn" ? positionTourSuivante(replayPosition) : replayPosition + 1);
}
function replayFin() {
    if (!isReplayMode) return;
    if (!replayFrames.length) construireFramesReplay();
    afficherPositionReplay(Math.max(0, replayFrames.length - 1));
}
function quitterReplay() {
    if (!isReplayMode) return;
    isReplayMode = false;
    replayPosition = 0;
    replayFrames = [];
    if (replayPanel) replayPanel.style.display = "none";
    afficherGrille(finalBoard);
    afficherActionsFin(true);
    if (resultPopup) resultPopup.style.display = "none";
    afficherTour("", matchFinished ? "Match terminé" : "Manche terminée");
    sauvegarderEtatMatch();
}


// ----------------------------------------------------------
// NAVIGATION ET PARAMÈTRES
// ----------------------------------------------------------

function ouvrirParametres() {
    stopperTimerTour({ preserve: true });
    sauvegarderEtatMatch();
    sessionStorage.setItem(RESUME_MATCH_KEY, "1");
    sessionStorage.setItem(SETTINGS_RETURN_KEY, "../Gameplay/game.html");
    location.href = "../Parametre/parametre.html?from=game";
}

function changerMode() {
    sessionStorage.removeItem(PREPARATION_STORAGE_KEY);
    sessionStorage.removeItem(MATCH_STORAGE_KEY);
    sessionStorage.removeItem(RESUME_MATCH_KEY);
    sessionStorage.removeItem(SETTINGS_RETURN_KEY);
    location.href = "../Rencontre/rencontre.html";
}

function quitterVersAccueil() {
    if (!matchFinished && !gameFinished) {
        const accepter = typeof confirm === "function"
            ? confirm("Quitter maintenant abandonnera le match en cours. Continuer ?")
            : true;
        if (!accepter) return;
    }
    sessionStorage.removeItem(MATCH_STORAGE_KEY);
    sessionStorage.removeItem(RESUME_MATCH_KEY);
    location.href = "../index.html";
}


// ----------------------------------------------------------
// REJOUER
// ----------------------------------------------------------

function preparerNouvelleGrille() {
    stopperTimerTour();
    gameBoard = Array(boardCellCount).fill("");
    finalBoard = Array(boardCellCount).fill("");
    moveHistory = [];
    currentLocalPlayer = 1;
    isAiThinking = false;
    isStartingToss = false;
    startTossSequence += 1;
    gameFinished = false;
    resultScored = false;
    isReplayMode = false;
    replayPosition = 0;
    replayFrames = [];

    cells.forEach(cell => {
        cell.textContent = "";
        cell.classList?.remove("mark-x", "mark-o", "winning-cell");
        cell.disabled = false;
    });

    if (resultPopup) {
        resultPopup.style.display = "none";
        resultPopup.classList?.remove("result-victory", "result-defeat", "result-draw");
    }
    if (replayPanel) replayPanel.style.display = "none";
    afficherActionsFin(false);
}

function commencerAvecSymbole(symbole) {
    const participant = participantParSymbole(symbole);
    if (!participant) { demarrerPartie(false); return; }

    if (gameMode === "ai") {
        if (participant.actor === "ai") {
            definirInteractiviteGrille(false);
            lancerTourIA();
        } else {
            definirInteractiviteGrille(true);
            afficherTour(humanSymbol);
            demarrerTimerTour(humanSymbol);
            sauvegarderEtatMatch();
        }
        return;
    }

    currentLocalPlayer = participant === playerTwo ? 2 : 1;
    definirInteractiviteGrille(true);
    const nextSymbol = symboleActuelLocal();
    afficherTour(nextSymbol);
    demarrerTimerTour(nextSymbol);
    sauvegarderEtatMatch();
}

function mancheSuivante() {
    if (!gameFinished || matchFinished) return;
    roundNumber += 1;
    const starter = nextRoundStarterSymbol;
    nextRoundStarterSymbol = null;
    preparerNouvelleGrille();
    mettreAJourProgressionMatch();

    if (starter) commencerAvecSymbole(starter);
    else demarrerPartie(false);
}

function resetGame() {
    scores = { player1: 0, player2: 0, draw: 0 };
    matchHistoryRecorded = false;
    matchSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    roundNumber = 1;
    matchFinished = false;
    nextRoundStarterSymbol = null;
    roundsHistory = [];
    mettreAJourScores();
    mettreAJourProgressionMatch();
    preparerNouvelleGrille();
    sauvegarderEtatMatch();
    demarrerPartie(false);
}

function actionApresResultat() {
    if (matchFinished) resetGame();
    else mancheSuivante();
}

function abandonnerMatch() {
    if (gameFinished && matchFinished) return;
    const accepter = typeof confirm === "function"
        ? confirm("Abandonner le match ? La victoire sera attribuée à l'adversaire.")
        : true;
    if (!accepter) return;
    stopperTimerTour();

    const loser = gameMode === "ai" ? playerOne : participantParSymbole(symboleActuelLocal());
    const winner = loser === playerOne ? playerTwo : playerOne;
    if (winner === playerOne) scores.player1 = Math.max(scores.player1, winsRequired);
    else scores.player2 = Math.max(scores.player2, winsRequired);
    matchFinished = true;
    gameFinished = true;
    finalBoard = [...gameBoard];
    roundsHistory.push({
        round: roundNumber,
        winner: winner.symbol,
        board: [...finalBoard],
        moves: moveHistory.map(move => ({ ...move }))
    });
    enregistrerMatchDansHistorique(winner, "forfeit");
    mettreAJourScores();
    appliquerStyleResultat(gameMode === "ai" && winner === playerTwo ? "defeat" : "victory");
    if (resultTitle) resultTitle.textContent = gameMode === "ai" && winner === playerTwo ? "ABANDON" : "MATCH TERMINÉ";
    if (resultMessage) resultMessage.textContent = `${winner.name} remporte le match par abandon.`;
    if (resultIcon) resultIcon.textContent = "⚑";
    if (resultPopup) resultPopup.style.display = "flex";
    afficherActionsFin(true);
    sauvegarderEtatMatch();
}


// ----------------------------------------------------------
// ÉVÉNEMENTS
// ----------------------------------------------------------

restartButton?.addEventListener("click", () => {
    if (gameFinished) actionApresResultat();
    else {
        const accepter = typeof confirm === "function" ? confirm("Recommencer entièrement le match ?") : true;
        if (accepter) resetGame();
    }
});
popupRestartButton?.addEventListener("click", actionApresResultat);
endRestartButton?.addEventListener("click", actionApresResultat);
abandonButton?.addEventListener("click", abandonnerMatch);
closeResultButton?.addEventListener("click", fermerResultat);
popupReplayButton?.addEventListener("click", demarrerReplay);
endReplayButton?.addEventListener("click", demarrerReplay);
changeModeButton?.addEventListener("click", changerMode);
endChangeModeButton?.addEventListener("click", changerMode);
settingsButton?.addEventListener("click", ouvrirParametres);

replayModeAction?.addEventListener("change", () => {
    if (replayModeAction.checked) changerModeReplay("action");
});

replayModeTurn?.addEventListener("change", () => {
    if (replayModeTurn.checked) changerModeReplay("turn");
});

replayStartButton?.addEventListener("click", replayDebut);
replayPrevButton?.addEventListener("click", replayPrecedent);
replayNextButton?.addEventListener("click", replaySuivant);
replayEndButton?.addEventListener("click", replayFin);
replayExitButton?.addEventListener("click", quitterReplay);
replayExitButtonBottom?.addEventListener("click", quitterReplay);

homeButton?.addEventListener("click", quitterVersAccueil);
backButton?.addEventListener("click", quitterVersAccueil);

cells.forEach(cell => {
    cell.addEventListener("click", () => {
        const index = Number(cell.dataset?.index ?? cell.id.replace("cell", ""));
        if (!Number.isInteger(index)) return;

        if (gameMode === "ai") jouerContreIA(index);
        else jouerLocal(index);
    });
});


// ----------------------------------------------------------
// DÉMARRAGE
// ----------------------------------------------------------

function demarrerPartie(tenterRestauration = true) {
    afficherIdentiteParticipants();
    mettreAJourScores();
    mettreAJourProgressionMatch();

    if (tenterRestauration && restaurerEtatMatchSiDemande()) {
        if (sessionStorage.getItem("tttOpenReplay") === "1") {
            sessionStorage.removeItem("tttOpenReplay");
            setTimeout(() => demarrerReplay(), 0);
        }
        return;
    }

    afficherActionsFin(false);

    // Dans l'interface réelle, chaque manche commence par un tirage animé.
    // Si l'overlay n'existe pas (anciens tests), on conserve le fallback historique.
    if (lancerTirageAuSort()) return;

    if (gameMode === "ai") {
        if (humanSymbol === "O") lancerTourIA();
        else {
            afficherTour(humanSymbol);
            demarrerTimerTour(humanSymbol);
        }
        return;
    }

    const initialSymbol = symboleActuelLocal();
    afficherTour(initialSymbol);
    demarrerTimerTour(initialSymbol);
}

demarrerPartie();
