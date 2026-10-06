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
const cells = document.querySelectorAll(".cell");

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
const gameMode = preparationData.gameMode || "local";
const difficulty = preparationData.difficulty || "normal";


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
        name: normaliserNom(preparationData.aiPlayerName, "Joueur 1"),
        symbol: humanSymbol,
        meta: "JOUEUR"
    }
    : {
        actor: "player1",
        name: normaliserNom(preparationData.localPlayer1Name, "Joueur 1"),
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

function appliquerClasseSymbole(element, symbole) {
    if (!element?.classList) return;
    element.classList.remove("symbol-x", "symbol-o", "mark-x", "mark-o");
    if (symbole === "X") element.classList.add("symbol-x");
    if (symbole === "O") element.classList.add("symbol-o");
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

let gameBoard = Array(9).fill("");
let currentLocalPlayer = 1;
let isAiThinking = false;
let gameFinished = false;
let resultScored = false;

// Historique des coups réellement joués. Les simulations Minimax n'y touchent pas.
let moveHistory = [];
let finalBoard = Array(9).fill("");
let isReplayMode = false;
let replayPosition = 0;
let replayMode = "action";

let scores = {
    player1: 0,
    player2: 0,
    draw: 0
};

const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function mettreAJourScores() {
    if (scorePlayerOne) scorePlayerOne.textContent = String(scores.player1);
    if (scorePlayerTwo) scorePlayerTwo.textContent = String(scores.player2);
    if (scoreDraw) scoreDraw.textContent = String(scores.draw);
}

function sauvegarderEtatMatch() {
    const state = {
        gameBoard: [...gameBoard],
        currentLocalPlayer,
        isAiThinking,
        gameFinished,
        resultScored,
        moveHistory: moveHistory.map(move => ({ ...move })),
        finalBoard: [...finalBoard],
        scores: { ...scores },
        isReplayMode,
        replayPosition,
        replayMode,
        resultPopupVisible: resultPopup?.style.display === "flex",
        endActionsVisible: endActions?.style.display === "flex"
    };

    sessionStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(state));
    return state;
}

function etatMatchValide(state) {
    return state &&
        Array.isArray(state.gameBoard) &&
        state.gameBoard.length === 9 &&
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
    finalBoard = Array.isArray(state.finalBoard) && state.finalBoard.length === 9
        ? [...state.finalBoard]
        : [...gameBoard];
    scores = {
        player1: Number(state.scores?.player1) || 0,
        player2: Number(state.scores?.player2) || 0,
        draw: Number(state.scores?.draw) || 0
    };
    isReplayMode = Boolean(state.isReplayMode);
    replayPosition = Number.isInteger(state.replayPosition) ? state.replayPosition : 0;
    replayMode = state.replayMode === "turn" ? "turn" : "action";

    mettreAJourScores();

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
    } else {
        afficherTour(symboleActuelLocal());
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
// GRILLE ET COUPS
// ----------------------------------------------------------

function enregistrerCoup(index, symbole, actor) {
    moveHistory.push({ index, symbol: symbole, actor });
}

function placerSymbole(index, symbole, actor = null, recordMove = true) {
    if (
        gameFinished ||
        isReplayMode ||
        !Number.isInteger(index) ||
        index < 0 ||
        index > 8 ||
        gameBoard[index] !== ""
    ) {
        return false;
    }

    gameBoard[index] = symbole;
    const cell = document.getElementById(`cell${index}`);
    if (cell) {
        cell.textContent = symbole;
        cell.classList?.remove("mark-x", "mark-o");
        cell.classList?.add(symbole === "X" ? "mark-x" : "mark-o");
    }

    if (recordMove && actor) enregistrerCoup(index, symbole, actor);
    sauvegarderEtatMatch();
    return true;
}

function afficherGrille(grille) {
    cells.forEach((cell, index) => {
        const symbole = grille[index] || "";
        cell.textContent = symbole;
        cell.classList?.remove("mark-x", "mark-o");
        if (symbole === "X") cell.classList?.add("mark-x");
        if (symbole === "O") cell.classList?.add("mark-o");
    });
}

function verifierGagnant(grille, symbole) {
    return winningCombinations.some(([a, b, c]) =>
        grille[a] === symbole &&
        grille[b] === symbole &&
        grille[c] === symbole
    );
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
        gameFinished = true;
        showResult(gagnant);
        sauvegarderEtatMatch();
        return true;
    }

    if (checkDraw()) {
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
// MODE 2 JOUEURS
// ----------------------------------------------------------

function jouerLocal(index) {
    const symbole = symboleActuelLocal();
    const actor = currentLocalPlayer === 1 ? "player1" : "player2";

    if (!placerSymbole(index, symbole, actor)) return;
    if (terminerSiNecessaire()) return;

    currentLocalPlayer = currentLocalPlayer === 1 ? 2 : 1;
    afficherTour(symboleActuelLocal());
    sauvegarderEtatMatch();
}


// ----------------------------------------------------------
// MODE CONTRE IA
// ----------------------------------------------------------

function jouerContreIA(index) {
    if (isAiThinking || gameFinished) return;
    if (!placerSymbole(index, humanSymbol, "human")) return;
    if (terminerSiNecessaire()) return;
    lancerTourIA();
}

function lancerTourIA() {
    if (gameFinished || gameMode !== "ai") return;

    isAiThinking = true;
    afficherTour(aiSymbol, `${playerTwo.name} joue`);
    sauvegarderEtatMatch();

    setTimeout(() => {
        if (gameFinished || isReplayMode) return;

        const coupIA = choisirCoupIA();
        if (coupIA !== null && coupIA !== undefined) {
            placerSymbole(coupIA, aiSymbol, "ai");
        }

        isAiThinking = false;

        if (terminerSiNecessaire()) return;
        afficherTour(humanSymbol);
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

function iaNormale(grille, symboleIA, symboleJoueur) {
    let coup = trouverCoupGagnant(grille, symboleIA);
    if (coup !== null) return coup;

    coup = trouverCoupGagnant(grille, symboleJoueur);
    if (coup !== null) return coup;

    if (grille[4] === "") return 4;
    return iaFacile(grille);
}

function evaluerPosition(grille, symboleIA, symboleJoueur) {
    let score = 0;

    if (grille[4] === symboleIA) score += 3;
    if (grille[4] === symboleJoueur) score -= 3;

    for (const index of [0, 2, 6, 8]) {
        if (grille[index] === symboleIA) score += 1;
        if (grille[index] === symboleJoueur) score -= 1;
    }

    for (const [a, b, c] of winningCombinations) {
        const ligne = [grille[a], grille[b], grille[c]];
        const iaCount = ligne.filter(v => v === symboleIA).length;
        const joueurCount = ligne.filter(v => v === symboleJoueur).length;
        if (joueurCount === 0) score += iaCount;
        if (iaCount === 0) score -= joueurCount;
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
            grille, 0, false, symboleIA, symboleJoueur, 4
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

function iaGod(grille, symboleIA, symboleJoueur) {
    const casesLibres = trouverCasesLibres(grille);
    if (casesLibres.length === 0) return null;

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

function showResult(gagnant) {
    finalBoard = [...gameBoard];
    incrementerScoreResultat(gagnant);
    afficherActionsFin(true);

    if (!resultPopup) return;

    if (!gagnant) {
        appliquerStyleResultat("draw");
        resultTitle.textContent = "MATCH NUL !";
        resultMessage.textContent =
            `${playerOne.name} (${playerOne.symbol}) et ${playerTwo.name} (${playerTwo.symbol}) se neutralisent.`;
        resultIcon.textContent = "🤝";
    } else {
        const winner = participantParSymbole(gagnant);
        const loser = winner === playerOne ? playerTwo : playerOne;
        const winnerName = winner?.name || gagnant;
        const playerWonAgainstAi = gameMode === "ai" && winner === playerOne;
        const playerLostAgainstAi = gameMode === "ai" && winner === playerTwo;

        appliquerStyleResultat(playerLostAgainstAi ? "defeat" : "victory");

        if (playerLostAgainstAi) {
            resultTitle.textContent = "DÉFAITE";
            resultMessage.textContent =
                `${playerTwo.name} remporte la partie — ${libelleDifficulte()}.`;
            resultIcon.textContent = "🤖";
        } else {
            resultTitle.textContent =
                `${winnerName.toUpperCase()} (${gagnant}) A GAGNÉ !`;

            if (playerWonAgainstAi) {
                resultMessage.textContent =
                    `Victoire contre ${playerTwo.name} — ${libelleDifficulte()}.`;
            } else {
                resultMessage.textContent =
                    `${winnerName} remporte la partie face à ${loser.name}.`;
            }

            resultIcon.textContent = "🏆";
        }
    }

    // Relance proprement les animations CSS à chaque nouvelle fin de manche.
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

function grilleReplayJusqua(position) {
    const grille = Array(9).fill("");
    moveHistory.slice(0, position).forEach(move => {
        grille[move.index] = move.symbol;
    });
    return grille;
}

function obtenirLimitesToursReplay() {
    const limites = [0];
    const total = moveHistory.length;
    if (total === 0) return limites;

    let position = 0;

    // Lorsque l'IA joue X, son premier coup constitue l'ouverture.
    if (gameMode === "ai" && moveHistory[0]?.actor === "ai") {
        limites.push(1);
        position = 1;
    }

    while (position < total) {
        if (gameMode === "ai") {
            let prochainePosition = position + 1;
            if (
                moveHistory[position]?.actor === "human" &&
                prochainePosition < total &&
                moveHistory[prochainePosition]?.actor === "ai"
            ) {
                prochainePosition += 1;
            }
            position = Math.min(total, prochainePosition);
        } else {
            position = Math.min(total, position + 2);
        }

        if (limites[limites.length - 1] !== position) limites.push(position);
    }

    return limites;
}

function positionTourSuivante(position) {
    return obtenirLimitesToursReplay().find(limite => limite > position)
        ?? moveHistory.length;
}

function positionTourPrecedente(position) {
    const limites = obtenirLimitesToursReplay();
    for (let index = limites.length - 1; index >= 0; index--) {
        if (limites[index] < position) return limites[index];
    }
    return 0;
}

function decrireCoup(move) {
    if (!move) return "Début de la partie";
    const participant = participantParActeur(move.actor);
    const nom = participant?.name || move.symbol;
    return `${nom} joue ${move.symbol} en case ${move.index}`;
}

function mettreAJourDescriptionReplay() {
    if (!replayActionLabel) return;

    if (replayPosition === 0) {
        replayActionLabel.textContent = "Début de la partie";
        return;
    }

    if (replayMode === "action") {
        replayActionLabel.textContent = decrireCoup(moveHistory[replayPosition - 1]);
        return;
    }

    const limites = obtenirLimitesToursReplay();
    const positionIndex = limites.findIndex(limite => limite === replayPosition);
    const debut = positionIndex > 0 ? limites[positionIndex - 1] : 0;
    const coups = moveHistory.slice(debut, replayPosition).map(decrireCoup);
    replayActionLabel.textContent = coups.join(" • ") || "Début de la partie";
}

function mettreAJourProgressionReplay() {
    if (replayProgress) {
        if (replayMode === "turn") {
            const limites = obtenirLimitesToursReplay();
            const totalTours = Math.max(0, limites.length - 1);
            const indexExact = limites.findIndex(limite => limite === replayPosition);
            const tourActuel = indexExact >= 0 ? indexExact : 0;
            replayProgress.textContent = `Tour ${tourActuel} / ${totalTours}`;
        } else {
            replayProgress.textContent = `Action ${replayPosition} / ${moveHistory.length}`;
        }
    }

    if (replayStartButton) replayStartButton.disabled = replayPosition === 0;
    if (replayPrevButton) replayPrevButton.disabled = replayPosition === 0;
    if (replayNextButton) replayNextButton.disabled = replayPosition >= moveHistory.length;
    if (replayEndButton) replayEndButton.disabled = replayPosition >= moveHistory.length;

    mettreAJourDescriptionReplay();
}

function afficherPositionReplay(position) {
    replayPosition = Math.max(0, Math.min(moveHistory.length, position));
    afficherGrille(grilleReplayJusqua(replayPosition));
    mettreAJourProgressionReplay();
    sauvegarderEtatMatch();
}

function changerModeReplay(mode) {
    replayMode = mode === "turn" ? "turn" : "action";

    if (replayMode === "turn") {
        const limites = obtenirLimitesToursReplay();
        replayPosition = limites.find(limite => limite >= replayPosition)
            ?? moveHistory.length;
    }

    afficherPositionReplay(replayPosition);
}

function demarrerReplay() {
    if (!gameFinished || moveHistory.length === 0) return;

    isReplayMode = true;
    replayPosition = 0;
    replayMode = replayModeTurn?.checked ? "turn" : "action";

    if (resultPopup) resultPopup.style.display = "none";
    afficherActionsFin(false);
    if (replayPanel) replayPanel.style.display = "block";

    afficherPositionReplay(0);
}

function replayDebut() {
    if (isReplayMode) afficherPositionReplay(0);
}

function replayPrecedent() {
    if (!isReplayMode) return;
    const position = replayMode === "turn"
        ? positionTourPrecedente(replayPosition)
        : replayPosition - 1;
    afficherPositionReplay(position);
}

function replaySuivant() {
    if (!isReplayMode) return;
    const position = replayMode === "turn"
        ? positionTourSuivante(replayPosition)
        : replayPosition + 1;
    afficherPositionReplay(position);
}

function replayFin() {
    if (isReplayMode) afficherPositionReplay(moveHistory.length);
}

function quitterReplay() {
    if (!isReplayMode) return;

    isReplayMode = false;
    replayPosition = 0;
    if (replayPanel) replayPanel.style.display = "none";

    afficherGrille(finalBoard);
    afficherActionsFin(true);
    if (resultPopup) resultPopup.style.display = "none";
    afficherTour("", "Partie terminée");
    sauvegarderEtatMatch();
}


// ----------------------------------------------------------
// NAVIGATION ET PARAMÈTRES
// ----------------------------------------------------------

function ouvrirParametres() {
    sauvegarderEtatMatch();
    sessionStorage.setItem(RESUME_MATCH_KEY, "1");
    sessionStorage.setItem(SETTINGS_RETURN_KEY, "../game.html");
    location.href = "../Parametres/parametre.html?from=game";
}

function changerMode() {
    sessionStorage.removeItem(PREPARATION_STORAGE_KEY);
    sessionStorage.removeItem(MATCH_STORAGE_KEY);
    sessionStorage.removeItem(RESUME_MATCH_KEY);
    sessionStorage.removeItem(SETTINGS_RETURN_KEY);
    location.href = "../Rencontre/rencontre.html";
}

function quitterVersAccueil() {
    sessionStorage.removeItem(MATCH_STORAGE_KEY);
    sessionStorage.removeItem(RESUME_MATCH_KEY);
    location.href = "../Titre/titre.html";
}


// ----------------------------------------------------------
// REJOUER
// ----------------------------------------------------------

function resetGame() {
    gameBoard = Array(9).fill("");
    finalBoard = Array(9).fill("");
    moveHistory = [];
    currentLocalPlayer = 1;
    isAiThinking = false;
    gameFinished = false;
    resultScored = false;
    isReplayMode = false;
    replayPosition = 0;

    cells.forEach(cell => {
        cell.textContent = "";
        cell.classList?.remove("mark-x", "mark-o");
        cell.disabled = false;
    });

    if (resultPopup) {
        resultPopup.style.display = "none";
        resultPopup.classList?.remove("result-victory", "result-defeat", "result-draw");
    }
    if (replayPanel) replayPanel.style.display = "none";
    afficherActionsFin(false);

    sauvegarderEtatMatch();
    demarrerPartie(false);
}


// ----------------------------------------------------------
// ÉVÉNEMENTS
// ----------------------------------------------------------

restartButton?.addEventListener("click", resetGame);
popupRestartButton?.addEventListener("click", resetGame);
endRestartButton?.addEventListener("click", resetGame);
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

    if (tenterRestauration && restaurerEtatMatchSiDemande()) return;

    afficherActionsFin(false);

    if (gameMode === "ai") {
        // X commence toujours. Si l'humain choisit O, l'IA possède X et ouvre.
        if (humanSymbol === "O") lancerTourIA();
        else afficherTour(humanSymbol);
        return;
    }

    afficherTour(symboleActuelLocal());
}

demarrerPartie();
