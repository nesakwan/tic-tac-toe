// ============================================================
// TIC TAC TOE — GAMEPAGE.JS
// ============================================================

// ------------------------------------------------------------
// RÉCUPÉRATION DES ÉLÉMENTS HTML
// ------------------------------------------------------------

const gamepage = document.getElementById("gamepage");

const turnPlayer = document.getElementById("turn-player");

const resultPopup = document.getElementById("result-popup");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const resultIcon = document.getElementById("result-icon");


// ------------------------------------------------------------
// RÉCUPÉRATION DE LA PRÉPARATION DE PARTIE
// ------------------------------------------------------------

// On récupère exactement les choix faits dans rencontre.html.
// IMPORTANT : on ne réécrit PAS tttPreparationState ici.

const storedPreparation = sessionStorage.getItem(
    "tttPreparationState"
);

if (!storedPreparation) {
    console.warn(
        "Aucune préparation de partie trouvée dans sessionStorage. " +
        "Les valeurs par défaut seront utilisées."
    );
}

let preparationState = {};

try {
    preparationState = storedPreparation
        ? JSON.parse(storedPreparation)
        : {};
} catch (error) {
    console.error(
        "Impossible de lire tttPreparationState :",
        error
    );

    preparationState = {};
}


// ------------------------------------------------------------
// CONFIGURATION DE LA PARTIE
// ------------------------------------------------------------

const gameMode = preparationState.gameMode || "2players";

const difficulty = preparationState.difficulty || "normal";

const player1Name =
    preparationState.player1Name ||
    preparationState.localPlayer1Name ||
    "Joueur 1";

const player2Name =
    preparationState.player2Name ||
    preparationState.localPlayer2Name ||
    "Joueur 2";


// ------------------------------------------------------------
// SYMBOLES DES JOUEURS
// ------------------------------------------------------------

let currentPlayer1 =
    preparationState.player1Symbol || "X";

let currentPlayer2 =
    preparationState.player2Symbol ||
    (
        currentPlayer1 === "X"
            ? "O"
            : "X"
    );


// ------------------------------------------------------------
// VARIABLES DE JEU
// ------------------------------------------------------------

let gameBoard = [
    "", "", "",
    "", "", "",
    "", "", ""
];

let currentPlayer = currentPlayer1;

let gameOver = false;

let player1HasPlayed = false;

// Empêche le joueur de cliquer pendant que l'IA réfléchit.
let aiThinking = false;


// ------------------------------------------------------------
// INFORMATIONS DE DEBUG
// ------------------------------------------------------------

console.log("=================================");
console.log(" TIC TAC TOE");
console.log("=================================");
console.log("Mode :", gameMode);
console.log("Difficulté :", difficulty);
console.log("Joueur 1 :", player1Name);
console.log("Joueur 2 :", player2Name);
console.log("Symbole joueur 1 :", currentPlayer1);
console.log("Symbole joueur 2 :", currentPlayer2);
console.log("=================================");


// ------------------------------------------------------------
// INITIALISATION
// ------------------------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiserPlateau();

        mettreAJourTour();

    }
);


// ------------------------------------------------------------
// CRÉATION DU PLATEAU
// ------------------------------------------------------------

function initialiserPlateau() {

    const cells = document.querySelectorAll(
        ".cell"
    );

    cells.forEach(
        (cell, index) => {

            cell.dataset.index = index;

            cell.textContent = "";

            cell.classList.remove(
                "x",
                "o",
                "winner"
            );

            cell.addEventListener(
                "click",
                () => {

                    jouerCase(index);

                }
            );

        }
    );
}


// ------------------------------------------------------------
// CLIC SUR UNE CASE
// ------------------------------------------------------------

function jouerCase(index) {

    if (gameOver) {
        return;
    }

    if (gameBoard[index] !== "") {
        return;
    }

    // --------------------------------------------------------
    // MODE IA
    // --------------------------------------------------------

    if (gameMode === "ai") {

        if (aiThinking) {
            return;
        }

        jouerContreIA(index);

        return;
    }

    // --------------------------------------------------------
    // MODE 2 JOUEURS
    // --------------------------------------------------------

    jouerDeuxJoueurs(index);
}


// ------------------------------------------------------------
// MODE 2 JOUEURS
// ------------------------------------------------------------

function jouerDeuxJoueurs(index) {

    gameBoard[index] = currentPlayer;

    afficherCase(
        index,
        currentPlayer
    );

    const victoire = checkWinner(
        gameBoard,
        currentPlayer
    );

    if (victoire) {

        terminerPartie(
            currentPlayer
        );

        return;
    }

    if (checkDraw()) {

        terminerPartie(
            "draw"
        );

        return;
    }

    changerJoueur();

}


// ------------------------------------------------------------
// MODE CONTRE IA
// ------------------------------------------------------------

function jouerContreIA(index) {

    if (gameOver || aiThinking) {
        return;
    }

    aiThinking = true;

    // --------------------------------------------------------
    // COUP DU JOUEUR
    // --------------------------------------------------------

    gameBoard[index] = currentPlayer1;

    player1HasPlayed = true;

    afficherCase(
        index,
        currentPlayer1
    );

    const victoireJoueur = checkWinner(
        gameBoard,
        currentPlayer1
    );

    if (victoireJoueur) {

        aiThinking = false;

        terminerPartie(
            currentPlayer1
        );

        return;
    }

    if (checkDraw()) {

        aiThinking = false;

        terminerPartie(
            "draw"
        );

        return;
    }

    mettreAJourTourIA();

    // --------------------------------------------------------
    // TEMPS DE RÉFLEXION DE L'IA
    // --------------------------------------------------------

    setTimeout(
        () => {

            if (gameOver) {
                aiThinking = false;
                return;
            }

            const coupIA = choisirCoupIA();

            if (
                coupIA === null ||
                coupIA === undefined
            ) {

                aiThinking = false;

                return;
            }

            gameBoard[coupIA] = currentPlayer2;

            afficherCase(
                coupIA,
                currentPlayer2
            );

            const victoireIA = checkWinner(
                gameBoard,
                currentPlayer2
            );

            if (victoireIA) {

                aiThinking = false;

                terminerPartie(
                    currentPlayer2
                );

                return;
            }

            if (checkDraw()) {

                aiThinking = false;

                terminerPartie(
                    "draw"
                );

                return;
            }

            aiThinking = false;

            mettreAJourTour();

        },
        500
    );
}


// ------------------------------------------------------------
// AFFICHAGE D'UNE CASE
// ------------------------------------------------------------

function afficherCase(
    index,
    symbol
) {

    const cell = document.querySelector(
        `.cell[data-index="${index}"]`
    );

    if (!cell) {
        return;
    }

    cell.textContent = symbol;

    cell.classList.remove(
        "x",
        "o"
    );

    if (symbol === "X") {

        cell.classList.add("x");

    } else if (symbol === "O") {

        cell.classList.add("o");

    }
}


// ------------------------------------------------------------
// CHANGEMENT DE JOUEUR
// ------------------------------------------------------------

function changerJoueur() {

    if (
        currentPlayer === currentPlayer1
    ) {

        currentPlayer = currentPlayer2;

    } else {

        currentPlayer = currentPlayer1;

    }

    mettreAJourTour();

}


// ------------------------------------------------------------
// AFFICHAGE DU TOUR
// ------------------------------------------------------------

function mettreAJourTour() {

    if (!turnPlayer) {
        return;
    }

    if (gameMode === "ai") {

        if (
            currentPlayer === currentPlayer1
        ) {

            turnPlayer.textContent =
                `${player1Name} (${currentPlayer1})`;

        } else {

            turnPlayer.textContent =
                "IA réfléchit...";

        }

        return;
    }

    if (
        currentPlayer === currentPlayer1
    ) {

        turnPlayer.textContent =
            `${player1Name} (${currentPlayer1})`;

    } else {

        turnPlayer.textContent =
            `${player2Name} (${currentPlayer2})`;

    }
}


// ------------------------------------------------------------
// AFFICHAGE TOUR IA
// ------------------------------------------------------------

function mettreAJourTourIA() {

    if (!turnPlayer) {
        return;
    }

    turnPlayer.textContent =
        "IA réfléchit...";
}


// ------------------------------------------------------------
// CHOISIR LE COUP DE L'IA
// ------------------------------------------------------------

function choisirCoupIA() {

    if (gameMode !== "ai") {

        console.warn(
            "choisirCoupIA() appelée alors que le mode n'est pas IA."
        );

        return null;
    }

    console.log(
        "IA — difficulté :",
        difficulty
    );

    if (difficulty === "easy") {

        return iaFacile(
            gameBoard
        );

    }

    if (difficulty === "normal") {

        return iaNormale(
            gameBoard,
            currentPlayer2,
            currentPlayer1
        );

    }

    if (difficulty === "hard") {

        return iaDifficile(
            gameBoard,
            currentPlayer2,
            currentPlayer1
        );

    }

    if (difficulty === "god") {

        return iaGod(
            gameBoard,
            currentPlayer2,
            currentPlayer1
        );

    }

    console.warn(
        "Difficulté inconnue :",
        difficulty,
        "→ difficulté normal utilisée."
    );

    return iaNormale(
        gameBoard,
        currentPlayer2,
        currentPlayer1
    );
}


// ============================================================
// IA FACILE
// ============================================================

function trouverCasesLibres(
    board
) {

    const libres = [];

    for (
        let i = 0;
        i < board.length;
        i++
    ) {

        if (board[i] === "") {

            libres.push(i);

        }

    }

    return libres;
}


function iaFacile(
    board
) {

    const casesLibres =
        trouverCasesLibres(board);

    if (
        casesLibres.length === 0
    ) {

        return null;

    }

    const indexAleatoire =
        Math.floor(
            Math.random() *
            casesLibres.length
        );

    return casesLibres[
        indexAleatoire
    ];
}


// ============================================================
// IA NORMALE
// ============================================================

function trouverCoupGagnant(
    board,
    symbol
) {

    const casesLibres =
        trouverCasesLibres(board);

    for (
        const index of casesLibres
    ) {

        board[index] = symbol;

        const gagne =
            verifierGagnant(
                board,
                symbol
            );

        board[index] = "";

        if (gagne) {

            return index;

        }

    }

    return null;
}


function iaNormale(
    board,
    aiSymbol,
    playerSymbol
) {

    // --------------------------------------------------------
    // 1. L'IA peut gagner
    // --------------------------------------------------------

    const coupGagnant =
        trouverCoupGagnant(
            board,
            aiSymbol
        );

    if (
        coupGagnant !== null
    ) {

        return coupGagnant;

    }

    // --------------------------------------------------------
    // 2. Bloquer le joueur
    // --------------------------------------------------------

    const coupBlocage =
        trouverCoupGagnant(
            board,
            playerSymbol
        );

    if (
        coupBlocage !== null
    ) {

        return coupBlocage;

    }

    // --------------------------------------------------------
    // 3. Prendre le centre
    // --------------------------------------------------------

    if (
        board[4] === ""
    ) {

        return 4;

    }

    // --------------------------------------------------------
    // 4. Prendre un coin
    // --------------------------------------------------------

    const coins = [
        0,
        2,
        6,
        8
    ];

    const coinsLibres =
        coins.filter(
            index =>
                board[index] === ""
        );

    if (
        coinsLibres.length > 0
    ) {

        return coinsLibres[
            Math.floor(
                Math.random() *
                coinsLibres.length
            )
        ];

    }

    // --------------------------------------------------------
    // 5. Sinon n'importe quelle case
    // --------------------------------------------------------

    return iaFacile(
        board
    );
}


// ============================================================
// IA DIFFICILE
// ============================================================

function verifierGagnant(
    board,
    symbol
) {

    const combinaisons = [

        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]

    ];

    return combinaisons.some(
        combinaison =>

            combinaison.every(
                index =>
                    board[index] === symbol
            )

    );
}


function minimaxLimite(
    board,
    depth,
    maximizing,
    aiSymbol,
    playerSymbol
) {

    if (
        verifierGagnant(
            board,
            aiSymbol
        )
    ) {

        return 10 - depth;

    }

    if (
        verifierGagnant(
            board,
            playerSymbol
        )
    ) {

        return depth - 10;

    }

    const libres =
        trouverCasesLibres(board);

    if (
        libres.length === 0
    ) {

        return 0;

    }

    if (
        depth >= 4
    ) {

        return 0;

    }

    if (maximizing) {

        let meilleurScore = -Infinity;

        for (
            const index of libres
        ) {

            board[index] = aiSymbol;

            const score =
                minimaxLimite(
                    board,
                    depth + 1,
                    false,
                    aiSymbol,
                    playerSymbol
                );

            board[index] = "";

            meilleurScore =
                Math.max(
                    meilleurScore,
                    score
                );

        }

        return meilleurScore;

    }

    let meilleurScore = Infinity;

    for (
        const index of libres
    ) {

        board[index] = playerSymbol;

        const score =
            minimaxLimite(
                board,
                depth + 1,
                true,
                aiSymbol,
                playerSymbol
            );

        board[index] = "";

        meilleurScore =
            Math.min(
                meilleurScore,
                score
            );

    }

    return meilleurScore;
}


function iaDifficile(
    board,
    aiSymbol,
    playerSymbol
) {

    const casesLibres =
        trouverCasesLibres(board);

    if (
        casesLibres.length === 0
    ) {

        return null;

    }

    let meilleurScore = -Infinity;

    let meilleursCoups = [];

    for (
        const index of casesLibres
    ) {

        board[index] = aiSymbol;

        const score =
            minimaxLimite(
                board,
                0,
                false,
                aiSymbol,
                playerSymbol
            );

        board[index] = "";

        if (
            score > meilleurScore
        ) {

            meilleurScore = score;

            meilleursCoups = [
                index
            ];

        } else if (
            score === meilleurScore
        ) {

            meilleursCoups.push(
                index
            );

        }

    }

    // Petite part d'aléatoire
    // pour rendre l'IA moins prévisible.

    if (
        Math.random() < 0.10
    ) {

        return iaNormale(
            board,
            aiSymbol,
            playerSymbol
        );

    }

    return meilleursCoups[
        Math.floor(
            Math.random() *
            meilleursCoups.length
        )
    ];
}


// ============================================================
// IA GOD — MINIMAX COMPLET
// ============================================================

function minimaxGod(
    board,
    maximizing,
    aiSymbol,
    playerSymbol
) {

    if (
        verifierGagnant(
            board,
            aiSymbol
        )
    ) {

        return 1;

    }

    if (
        verifierGagnant(
            board,
            playerSymbol
        )
    ) {

        return -1;

    }

    const libres =
        trouverCasesLibres(board);

    if (
        libres.length === 0
    ) {

        return 0;

    }

    if (maximizing) {

        let meilleurScore = -Infinity;

        for (
            const index of libres
        ) {

            board[index] = aiSymbol;

            const score =
                minimaxGod(
                    board,
                    false,
                    aiSymbol,
                    playerSymbol
                );

            board[index] = "";

            meilleurScore =
                Math.max(
                    meilleurScore,
                    score
                );

        }

        return meilleurScore;

    }

    let meilleurScore = Infinity;

    for (
        const index of libres
    ) {

        board[index] = playerSymbol;

        const score =
            minimaxGod(
                board,
                true,
                aiSymbol,
                playerSymbol
            );

        board[index] = "";

        meilleurScore =
            Math.min(
                meilleurScore,
                score
            );

    }

    return meilleurScore;
}


function iaGod(
    board,
    aiSymbol,
    playerSymbol
) {

    const casesLibres =
        trouverCasesLibres(board);

    if (
        casesLibres.length === 0
    ) {

        return null;

    }

    let meilleurScore = -Infinity;

    let meilleurCoup = null;

    for (
        const index of casesLibres
    ) {

        board[index] = aiSymbol;

        const score =
            minimaxGod(
                board,
                false,
                aiSymbol,
                playerSymbol
            );

        board[index] = "";

        if (
            score > meilleurScore
        ) {

            meilleurScore = score;

            meilleurCoup = index;

        }

    }

    return meilleurCoup;
}


// ============================================================
// VÉRIFICATION DU GAGNANT
// ============================================================

function checkWinner(
    board,
    symbol
) {

    const combinaisons = [

        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]

    ];

    for (
        const combinaison of combinaisons
    ) {

        if (
            combinaison.every(
                index =>
                    board[index] === symbol
            )
        ) {

            afficherLigneGagnante(
                combinaison
            );

            return true;

        }

    }

    return false;
}


// ============================================================
// AFFICHER LA LIGNE GAGNANTE
// ============================================================

function afficherLigneGagnante(
    combinaison
) {

    combinaison.forEach(
        index => {

            const cell =
                document.querySelector(
                    `.cell[data-index="${index}"]`
                );

            if (cell) {

                cell.classList.add(
                    "winner"
                );

            }

        }
    );
}


// ============================================================
// MATCH NUL
// ============================================================

function checkDraw() {

    return gameBoard.every(
        cell =>
            cell !== ""
    );
}


// ============================================================
// FIN DE PARTIE
// ============================================================

function terminerPartie(
    result
) {

    gameOver = true;

    setTimeout(
        () => {

            showResult(
                result
            );

        },
        300
    );
}


// ============================================================
// POPUP DE RÉSULTAT
// ============================================================

function showResult(
    result
) {

    if (!resultPopup) {
        return;
    }

    resultPopup.classList.add(
        "show"
    );

    if (
        result === "draw"
    ) {

        if (resultTitle) {

            resultTitle.textContent =
                "MATCH NUL";

        }

        if (resultMessage) {

            resultMessage.textContent =
                "Personne ne gagne cette fois.";

        }

        if (resultIcon) {

            resultIcon.textContent =
                "🤝";

        }

        return;
    }

    // --------------------------------------------------------
    // VICTOIRE
    // --------------------------------------------------------

    const joueurGagnant =
        result === currentPlayer1
            ? player1Name
            : (
                gameMode === "ai"
                    ? "IA"
                    : player2Name
            );

    if (resultTitle) {

        resultTitle.textContent =
            "VICTOIRE !";

    }

    if (resultMessage) {

        resultMessage.textContent =
            `${joueurGagnant} gagne la partie !`;

    }

    if (resultIcon) {

        resultIcon.textContent =
            result;

    }
}


// ============================================================
// BOUTON REJOUER
// ============================================================

const replayButton =
    document.getElementById(
        "replay-button"
    );

if (replayButton) {

    replayButton.addEventListener(
        "click",
        () => {

            window.location.reload();

        }
    );

}


// ============================================================
// BOUTON RETOUR
// ============================================================

const backButton =
    document.getElementById(
        "back-button"
    );

if (backButton) {

    backButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "rencontre.html";

        }
    );

}