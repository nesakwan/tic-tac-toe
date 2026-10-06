// ==========================================================
// ELEMENTS HTML
// ==========================================================

const gamePage = document.getElementById("gamepage");
const turnPlayer = document.getElementById("turn-player");

const resultPopup = document.getElementById("result-popup");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const resultIcon = document.getElementById("result-icon");


// ==========================================================
// MODE DE JEU
// ==========================================================

const gameMode = localStorage.getItem("gameMode");
const difficulty = localStorage.getItem("difficulty");

console.log("Mode de jeu :", gameMode);
console.log("Difficulté :", difficulty);


// ==========================================================
// JOUEURS
// ==========================================================

let currentPlayer1 = "X";
let currentPlayer2 = "O";

let player1HasPlayed = false;

let player1Won = false;
let player2Won = false;


// ==========================================================
// GRILLE
// ==========================================================

let gameBoard = [
    "", "", "",
    "", "", "",
    "", "", ""
];


// ==========================================================
// COMBINAISONS GAGNANTES
// ==========================================================

const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],

    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],

    [0, 4, 8],
    [2, 4, 6]
];


// ==========================================================
// AFFICHAGE DU TOUR
// ==========================================================

turnPlayer.innerHTML = `<p>Tour de : ${currentPlayer1}</p>`;


// ==========================================================
// CASES DU PLATEAU
// ==========================================================

const cells = document.querySelectorAll(".cell");

cells.forEach(cell => {

    cell.addEventListener("click", function (event) {

        const cellBack = event.target.id;

        // Exemple :
        // cellBack = "cell4"

        const cellId = parseInt(
            cellBack.charAt(cellBack.length - 1)
        );

        console.log(`Cell clicked: ${cellId}`);


        // ==================================================
        // MODE CONTRE IA
        // ==================================================

        if (gameMode === "ai") {

            jouerContreIA(cellId);

            return;
        }


        // ==================================================
        // MODE 2 JOUEURS
        // ==================================================

        if (player1HasPlayed) {

            const coupJoue = playO(cellId);

            if (!coupJoue) {
                return;
            }

        } else {

            const coupJoue = playX(cellId);

            if (!coupJoue) {
                return;
            }
        }


        // Vérifier victoire
        checkWinner();


        if (player1Won || player2Won) {

            showResult();

            return;
        }


        // Vérifier match nul
        if (checkDraw()) {

            showResult();

            return;
        }

    });

});


// ==========================================================
// JEU CONTRE L'IA
// ==========================================================

function jouerContreIA(cellId) {

    // ------------------------------------------------------
    // Le joueur joue X
    // ------------------------------------------------------

    const coupJoueur = playX(cellId);


    // La case est déjà occupée
    if (!coupJoueur) {
        return;
    }


    // Vérifier si le joueur a gagné
    checkWinner();

    if (player1Won) {

        showResult();

        return;
    }


    // Vérifier match nul
    if (checkDraw()) {

        showResult();

        return;
    }


    // ------------------------------------------------------
    // L'IA joue après un petit délai
    // ------------------------------------------------------

    setTimeout(() => {

        const coupIA = choisirCoupIA();


        // Plus aucune case disponible
        if (coupIA === null) {

            return;
        }


        // L'IA joue O
        playO(coupIA);


        // Vérifier victoire de l'IA
        checkWinner();

        if (player2Won) {

            showResult();

            return;
        }


        // Vérifier match nul
        if (checkDraw()) {

            showResult();

            return;
        }

    }, 500);

}


// ==========================================================
// CHOIX DE L'ALGORITHME IA
// ==========================================================

function choisirCoupIA() {

    console.log("Difficulté sélectionnée :", difficulty);


    // FACILE
    if (difficulty === "easy") {

        return iaFacile(gameBoard);
    }


    // NORMAL
    if (difficulty === "normal") {

        return iaNormale(
            gameBoard,
            currentPlayer2,
            currentPlayer1
        );
    }


    // DIFFICILE
    if (difficulty === "hard") {

        return iaDifficile(
            gameBoard,
            currentPlayer2,
            currentPlayer1
        );
    }


    // GOD
    if (difficulty === "god") {

        return iaGod(
            gameBoard,
            currentPlayer2,
            currentPlayer1
        );
    }


    // Si aucune difficulté n'a été trouvée
    console.warn("Difficulté IA inconnue :", difficulty);

    return iaFacile(gameBoard);
}


// ==========================================================
// JOUER X
// ==========================================================

function playX(c) {

    // Vérifier que la case est libre
    if (gameBoard[c] !== "") {

        return false;
    }


    gameBoard[c] = currentPlayer1;


    const cell = document.getElementById(`cell${c}`);

    cell.textContent = currentPlayer1;


    turnPlayer.innerHTML =
        `<p>Tour de : ${currentPlayer2}</p>`;


    player1HasPlayed = true;


    return true;
}


// ==========================================================
// JOUER O
// ==========================================================

function playO(c) {

    // Vérifier que la case est libre
    if (gameBoard[c] !== "") {

        return false;
    }


    gameBoard[c] = currentPlayer2;


    const cell = document.getElementById(`cell${c}`);

    cell.textContent = currentPlayer2;


    turnPlayer.innerHTML =
        `<p>Tour de : ${currentPlayer1}</p>`;


    player1HasPlayed = false;


    return true;
}


// ==========================================================
// VERIFIER LE GAGNANT
// ==========================================================

function checkWinner() {

    // On remet les résultats à false
    player1Won = false;
    player2Won = false;


    for (let combination of winningCombinations) {

        for (let player of [
            currentPlayer1,
            currentPlayer2
        ]) {

            if (
                combination.every(
                    index => gameBoard[index] === player
                )
            ) {

                if (player === currentPlayer1) {

                    player1Won = true;

                } else {

                    player2Won = true;
                }

                return;
            }
        }
    }
}


// ==========================================================
// MATCH NUL
// ==========================================================

function checkDraw() {

    return gameBoard.every(
        cell => cell !== ""
    );
}


// ==========================================================
// AFFICHER LE RESULTAT
// ==========================================================

function showResult() {

    if (player1Won) {

        resultTitle.textContent = "Victoire !";

        resultMessage.textContent =
            `Le joueur ${currentPlayer1} a gagné !`;

        resultIcon.textContent = "🏆";

    } else if (player2Won) {

        resultTitle.textContent = "Victoire !";

        resultMessage.textContent =
            `Le joueur ${currentPlayer2} a gagné !`;

        resultIcon.textContent = "🏆";

    } else {

        resultTitle.textContent = "Match nul !";

        resultMessage.textContent =
            "Aucun joueur n'a gagné.";

        resultIcon.textContent = "🤝";
    }


    resultPopup.style.display = "flex";
}


// ==========================================================
// ==========================================================
//                    IA - FACILE
// ==========================================================
// ==========================================================

function trouverCasesLibres(grille) {

    return grille
        .map(
            (caseActuelle, index) =>
                caseActuelle === "" ? index : null
        )
        .filter(
            index => index !== null
        );
}


function iaFacile(grille) {

    const casesLibres =
        trouverCasesLibres(grille);


    if (casesLibres.length === 0) {

        return null;
    }


    const choixAleatoire =
        Math.floor(
            Math.random() * casesLibres.length
        );


    return casesLibres[choixAleatoire];
}


// ==========================================================
// ==========================================================
//                    IA - NORMAL
// ==========================================================
// ==========================================================

function trouverCoupGagnant(grille, symbole) {

    for (let i = 0; i < grille.length; i++) {

        // Case déjà occupée
        if (grille[i] !== "") {

            continue;
        }


        // On simule le coup
        grille[i] = symbole;


        const gagne =
            winningCombinations.some(
                ([a, b, c]) =>
                    grille[a] === symbole &&
                    grille[b] === symbole &&
                    grille[c] === symbole
            );


        // On remet la case vide
        grille[i] = "";


        if (gagne) {

            return i;
        }
    }


    return null;
}


function iaNormale(
    grille,
    symboleIA,
    symboleJoueur
) {

    // ------------------------------------------------------
    // 1. L'IA peut-elle gagner ?
    // ------------------------------------------------------

    let coup =
        trouverCoupGagnant(
            grille,
            symboleIA
        );


    if (coup !== null) {

        return coup;
    }


    // ------------------------------------------------------
    // 2. Le joueur peut-il gagner ?
    // ------------------------------------------------------

    coup =
        trouverCoupGagnant(
            grille,
            symboleJoueur
        );


    if (coup !== null) {

        return coup;
    }


    // ------------------------------------------------------
    // 3. Prendre le centre
    // ------------------------------------------------------

    if (grille[4] === "") {

        return 4;
    }


    // ------------------------------------------------------
    // 4. Sinon choix aléatoire
    // ------------------------------------------------------

    return iaFacile(grille);
}


// ==========================================================
// ==========================================================
//                   IA - DIFFICILE
// ==========================================================
// ==========================================================

function verifierGagnant(
    grille,
    symbole
) {

    return winningCombinations.some(
        ([a, b, c]) =>
            grille[a] === symbole &&
            grille[b] === symbole &&
            grille[c] === symbole
    );
}


function minimaxLimite(
    grille,
    profondeur,
    estMaximisation,
    symboleIA,
    symboleJoueur,
    profondeurMax
) {

    // IA gagne
    if (
        verifierGagnant(
            grille,
            symboleIA
        )
    ) {

        return 10 - profondeur;
    }


    // Joueur gagne
    if (
        verifierGagnant(
            grille,
            symboleJoueur
        )
    ) {

        return profondeur - 10;
    }


    // Cases disponibles
    const casesLibres =
        trouverCasesLibres(grille);


    // Match nul
    if (casesLibres.length === 0) {

        return 0;
    }


    // Limite de profondeur
    if (profondeur >= profondeurMax) {

        return 0;
    }


    // ------------------------------------------------------
    // MAXIMISATION = IA
    // ------------------------------------------------------

    if (estMaximisation) {

        let meilleurScore = -Infinity;


        for (const index of casesLibres) {

            grille[index] = symboleIA;


            const score =
                minimaxLimite(
                    grille,
                    profondeur + 1,
                    false,
                    symboleIA,
                    symboleJoueur,
                    profondeurMax
                );


            grille[index] = "";


            meilleurScore =
                Math.max(
                    meilleurScore,
                    score
                );
        }


        return meilleurScore;
    }


    // ------------------------------------------------------
    // MINIMISATION = JOUEUR
    // ------------------------------------------------------

    let meilleurScore = Infinity;


    for (const index of casesLibres) {

        grille[index] = symboleJoueur;


        const score =
            minimaxLimite(
                grille,
                profondeur + 1,
                true,
                symboleIA,
                symboleJoueur,
                profondeurMax
            );


        grille[index] = "";


        meilleurScore =
            Math.min(
                meilleurScore,
                score
            );
    }


    return meilleurScore;
}


function iaDifficile(
    grille,
    symboleIA,
    symboleJoueur
) {

    const casesLibres =
        trouverCasesLibres(grille);


    if (casesLibres.length === 0) {

        return null;
    }


    const coupsScores = [];


    for (const index of casesLibres) {

        grille[index] = symboleIA;


        const score =
            minimaxLimite(
                grille,
                0,
                false,
                symboleIA,
                symboleJoueur,
                4
            );


        grille[index] = "";


        coupsScores.push({
            index: index,
            score: score
        });
    }


    // Meilleur score en premier
    coupsScores.sort(
        (a, b) => b.score - a.score
    );


    // 10% de chance de prendre
    // le deuxième meilleur coup
    if (
        coupsScores.length > 1 &&
        Math.random() < 0.10
    ) {

        return coupsScores[1].index;
    }


    return coupsScores[0].index;
}


// ==========================================================
// ==========================================================
//                       IA - GOD
// ==========================================================
// ==========================================================

function minimaxGod(
    grille,
    profondeur,
    estMaximisation,
    symboleIA,
    symboleJoueur
) {

    // IA gagne
    if (
        verifierGagnant(
            grille,
            symboleIA
        )
    ) {

        return 10 - profondeur;
    }


    // Joueur gagne
    if (
        verifierGagnant(
            grille,
            symboleJoueur
        )
    ) {

        return profondeur - 10;
    }


    const casesLibres =
        trouverCasesLibres(grille);


    // Match nul
    if (casesLibres.length === 0) {

        return 0;
    }


    // ------------------------------------------------------
    // MAXIMISATION = IA
    // ------------------------------------------------------

    if (estMaximisation) {

        let meilleurScore = -Infinity;


        for (const index of casesLibres) {

            grille[index] = symboleIA;


            const score =
                minimaxGod(
                    grille,
                    profondeur + 1,
                    false,
                    symboleIA,
                    symboleJoueur
                );


            grille[index] = "";


            meilleurScore =
                Math.max(
                    meilleurScore,
                    score
                );
        }


        return meilleurScore;
    }


    // ------------------------------------------------------
    // MINIMISATION = JOUEUR
    // ------------------------------------------------------

    let meilleurScore = Infinity;


    for (const index of casesLibres) {

        grille[index] = symboleJoueur;


        const score =
            minimaxGod(
                grille,
                profondeur + 1,
                true,
                symboleIA,
                symboleJoueur
            );


        grille[index] = "";


        meilleurScore =
            Math.min(
                meilleurScore,
                score
            );
    }


    return meilleurScore;
}


function iaGod(
    grille,
    symboleIA,
    symboleJoueur
) {

    const casesLibres =
        trouverCasesLibres(grille);


    if (casesLibres.length === 0) {

        return null;
    }


    let meilleurScore = -Infinity;

    let meilleurCoup = null;


    for (const index of casesLibres) {

        grille[index] = symboleIA;


        const score =
            minimaxGod(
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