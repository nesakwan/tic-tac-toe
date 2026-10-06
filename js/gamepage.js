// ==========================================================
// ÉLÉMENTS HTML
// ==========================================================

const turnPlayer = document.getElementById("turn-player");
const resultPopup = document.getElementById("result-popup");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const resultIcon = document.getElementById("result-icon");
const cells = document.querySelectorAll(".cell");

const restartButton = document.getElementById("restart-button");
const replayButton = document.getElementById("replay-button");
const homeButton = document.getElementById("home-button");
const backButton = document.getElementById("back-button");
const settingsButton = document.getElementById("settings-button");


// ==========================================================
// CONFIGURATION VENANT DE LA PAGE DE PRÉPARATION
// ==========================================================

const PREPARATION_STORAGE_KEY = "tttPreparationState";

function chargerPreparation() {

    const raw =
        sessionStorage.getItem(
            PREPARATION_STORAGE_KEY
        );

    if (!raw) {
        return {};
    }

    try {

        return JSON.parse(raw) || {};

    } catch (error) {

        console.warn(
            "Préparation de partie invalide.",
            error
        );

        return {};
    }
}


const preparationData =
    chargerPreparation();


const gameMode =
    preparationData.gameMode || "local";


const difficulty =
    preparationData.difficulty || "normal";


// ==========================================================
// NORMALISATION DES SYMBOLES
// ==========================================================

function normaliserSymbole(
    valeur,
    symboleParDefaut = "X"
) {

    const symbole =
        String(valeur || "")
            .trim()
            .toUpperCase();

    if (
        symbole === "X" ||
        symbole === "O"
    ) {

        return symbole;
    }

    return symboleParDefaut;
}


// ==========================================================
// MODE IA
// ==========================================================

// Symbole choisi par le joueur

const humanSymbol =
    normaliserSymbole(
        preparationData.aiPlayerSymbol,
        "X"
    );


// L'IA prend TOUJOURS
// le symbole opposé

const aiSymbol =
    humanSymbol === "X"
        ? "O"
        : "X";


// ==========================================================
// MODE 2 JOUEURS
// ==========================================================

// Joueur 1

const localPlayer1Symbol =
    normaliserSymbole(
        preparationData.player1Symbol,
        "X"
    );


// Joueur 2

let localPlayer2Symbol =
    normaliserSymbole(
        preparationData.player2Symbol,
        localPlayer1Symbol === "X"
            ? "O"
            : "X"
    );


// ==========================================================
// SÉCURITÉ IMPORTANTE
// LES DEUX JOUEURS NE PEUVENT JAMAIS
// AVOIR LE MÊME SYMBOLE
// ==========================================================

if (
    localPlayer2Symbol ===
    localPlayer1Symbol
) {

    localPlayer2Symbol =
        localPlayer1Symbol === "X"
            ? "O"
            : "X";
}


console.log(
    "Mode de jeu :",
    gameMode
);

console.log(
    "Difficulté IA :",
    difficulty
);

console.log(
    "Symbole joueur :",
    gameMode === "ai"
        ? humanSymbol
        : localPlayer1Symbol
);

console.log(
    "Symbole adversaire :",
    gameMode === "ai"
        ? aiSymbol
        : localPlayer2Symbol
);


// ==========================================================
// ÉTAT DE LA PARTIE
// ==========================================================

let gameBoard = [

    "", "", "",

    "", "", "",

    "", "", ""

];


let currentLocalPlayer = 1;

let isAiThinking = false;

let gameFinished = false;


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
// OUTILS GÉNÉRAUX
// ==========================================================

function symboleActuelLocal() {

    return currentLocalPlayer === 1

        ? localPlayer1Symbol

        : localPlayer2Symbol;
}


// ==========================================================
// AFFICHAGE DU TOUR
// ==========================================================

function afficherTour(
    symbole,
    texte = "Tour de"
) {

    if (!turnPlayer) {
        return;
    }

    turnPlayer.innerHTML =
        `<p>${texte} : ${symbole}</p>`;
}


// ==========================================================
// PLACER UN SYMBOLE
// ==========================================================

function placerSymbole(
    index,
    symbole
) {

    if (
        gameFinished ||
        gameBoard[index] !== ""
    ) {

        return false;
    }


    gameBoard[index] =
        symbole;


    const cell =
        document.getElementById(
            `cell${index}`
        );


    if (cell) {

        cell.textContent =
            symbole;
    }


    return true;
}


// ==========================================================
// VÉRIFIER UN GAGNANT
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


// ==========================================================
// TROUVER LE GAGNANT
// ==========================================================

function trouverGagnant() {

    for (
        const symbole
        of ["X", "O"]
    ) {

        if (
            verifierGagnant(
                gameBoard,
                symbole
            )
        ) {

            return symbole;
        }
    }


    return null;
}


// ==========================================================
// MATCH NUL
// ==========================================================

function checkDraw() {

    return gameBoard.every(
        caseActuelle =>
            caseActuelle !== ""
    );
}


// ==========================================================
// TERMINER LA PARTIE
// ==========================================================

function terminerSiNecessaire() {

    const gagnant =
        trouverGagnant();


    if (gagnant) {

        gameFinished =
            true;

        showResult(
            gagnant
        );

        return true;
    }


    if (
        checkDraw()
    ) {

        gameFinished =
            true;

        showResult(
            null
        );

        return true;
    }


    return false;
}


// ==========================================================
// CASES LIBRES
// ==========================================================

function trouverCasesLibres(
    grille
) {

    return grille

        .map(
            (
                caseActuelle,
                index
            ) =>

                caseActuelle === ""

                    ? index

                    : null
        )

        .filter(
            index =>
                index !== null
        );
}


// ==========================================================
// MODE 2 JOUEURS
// ==========================================================

function jouerLocal(
    index
) {

    const symbole =
        symboleActuelLocal();


    if (
        !placerSymbole(
            index,
            symbole
        )
    ) {

        return;
    }


    if (
        terminerSiNecessaire()
    ) {

        return;
    }


    currentLocalPlayer =
        currentLocalPlayer === 1
            ? 2
            : 1;


    afficherTour(
        symboleActuelLocal()
    );
}


// ==========================================================
// MODE CONTRE IA
// ==========================================================

function jouerContreIA(
    index
) {

    // Empêcher le joueur de jouer
    // pendant le tour de l'IA

    if (
        isAiThinking ||
        gameFinished
    ) {

        return;
    }


    // Joueur humain

    if (
        !placerSymbole(
            index,
            humanSymbol
        )
    ) {

        return;
    }


    // Victoire ou nul

    if (
        terminerSiNecessaire()
    ) {

        return;
    }


    // Lancer l'IA

    lancerTourIA();
}


// ==========================================================
// TOUR DE L'IA
// ==========================================================

function lancerTourIA() {

    if (
        gameFinished ||
        gameMode !== "ai"
    ) {

        return;
    }


    isAiThinking =
        true;


    afficherTour(
        aiSymbol,
        "L'IA joue"
    );


    setTimeout(
        () => {

            const coupIA =
                choisirCoupIA();


            if (
                coupIA !== null &&
                coupIA !== undefined
            ) {

                placerSymbole(
                    coupIA,
                    aiSymbol
                );
            }


            isAiThinking =
                false;


            if (
                terminerSiNecessaire()
            ) {

                return;
            }


            afficherTour(
                humanSymbol
            );

        },

        500
    );
}


// ==========================================================
// SÉLECTION DE LA DIFFICULTÉ
// ==========================================================

function choisirCoupIA() {

    console.log(
        "Difficulté utilisée par l'IA :",
        difficulty
    );


    // FACILE

    if (
        difficulty === "easy"
    ) {

        return iaFacile(
            gameBoard
        );
    }


    // NORMAL

    if (
        difficulty === "normal"
    ) {

        return iaNormale(
            gameBoard,
            aiSymbol,
            humanSymbol
        );
    }


    // DIFFICILE

    if (
        difficulty === "hard"
    ) {

        return iaDifficile(
            gameBoard,
            aiSymbol,
            humanSymbol
        );
    }


    // GOD

    if (
        difficulty === "god"
    ) {

        return iaGod(
            gameBoard,
            aiSymbol,
            humanSymbol
        );
    }


    // Sécurité

    console.warn(
        "Difficulté inconnue, utilisation de NORMAL :",
        difficulty
    );


    return iaNormale(
        gameBoard,
        aiSymbol,
        humanSymbol
    );
}


// ==========================================================
// IA FACILE
// ==========================================================

function iaFacile(
    grille
) {

    const casesLibres =
        trouverCasesLibres(
            grille
        );


    if (
        casesLibres.length === 0
    ) {

        return null;
    }


    const randomIndex =
        Math.floor(
            Math.random() *
            casesLibres.length
        );


    return casesLibres[
        randomIndex
    ];
}


// ==========================================================
// IA NORMALE
// ==========================================================

function trouverCoupGagnant(
    grille,
    symbole
) {

    const casesLibres =
        trouverCasesLibres(
            grille
        );


    for (
        const index
        of casesLibres
    ) {

        grille[index] =
            symbole;


        const gagne =
            verifierGagnant(
                grille,
                symbole
            );


        grille[index] =
            "";


        if (gagne) {

            return index;
        }
    }


    return null;
}


// ==========================================================
// IA NORMALE
// ==========================================================

function iaNormale(
    grille,
    symboleIA,
    symboleJoueur
) {

    // 1. L'IA peut gagner

    let coup =
        trouverCoupGagnant(
            grille,
            symboleIA
        );


    if (
        coup !== null
    ) {

        return coup;
    }


    // 2. Bloquer le joueur

    coup =
        trouverCoupGagnant(
            grille,
            symboleJoueur
        );


    if (
        coup !== null
    ) {

        return coup;
    }


    // 3. Prendre le centre

    if (
        grille[4] === ""
    ) {

        return 4;
    }


    // 4. Sinon hasard

    return iaFacile(
        grille
    );
}


// ==========================================================
// IA DIFFICILE
// ÉVALUATION
// ==========================================================

function evaluerPosition(
    grille,
    symboleIA,
    symboleJoueur
) {

    let score =
        0;


    // Centre

    if (
        grille[4] === symboleIA
    ) {

        score += 3;
    }


    if (
        grille[4] === symboleJoueur
    ) {

        score -= 3;
    }


    // Coins

    for (
        const index
        of [0, 2, 6, 8]
    ) {

        if (
            grille[index] === symboleIA
        ) {

            score += 1;
        }


        if (
            grille[index] === symboleJoueur
        ) {

            score -= 1;
        }
    }


    // Lignes

    for (
        const [a, b, c]
        of winningCombinations
    ) {

        const ligne = [

            grille[a],

            grille[b],

            grille[c]

        ];


        const iaCount =
            ligne.filter(
                valeur =>
                    valeur === symboleIA
            ).length;


        const joueurCount =
            ligne.filter(
                valeur =>
                    valeur === symboleJoueur
            ).length;


        if (
            joueurCount === 0
        ) {

            score += iaCount;
        }


        if (
            iaCount === 0
        ) {

            score -= joueurCount;
        }
    }


    return score;
}


// ==========================================================
// MINIMAX LIMITÉ
// ==========================================================

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

        return 10 -
            profondeur;
    }


    // Joueur gagne

    if (
        verifierGagnant(
            grille,
            symboleJoueur
        )
    ) {

        return profondeur -
            10;
    }


    const casesLibres =
        trouverCasesLibres(
            grille
        );


    // Match nul

    if (
        casesLibres.length === 0
    ) {

        return 0;
    }


    // Profondeur maximale

    if (
        profondeur >=
        profondeurMax
    ) {

        return evaluerPosition(
            grille,
            symboleIA,
            symboleJoueur
        );
    }


    // ==================================================
    // MAX = IA
    // ==================================================

    if (
        estMaximisation
    ) {

        let meilleurScore =
            -Infinity;


        for (
            const index
            of casesLibres
        ) {

            grille[index] =
                symboleIA;


            const score =
                minimaxLimite(

                    grille,

                    profondeur + 1,

                    false,

                    symboleIA,

                    symboleJoueur,

                    profondeurMax
                );


            grille[index] =
                "";


            meilleurScore =
                Math.max(
                    meilleurScore,
                    score
                );
        }


        return meilleurScore;
    }


    // ==================================================
    // MIN = JOUEUR
    // ==================================================

    let meilleurScore =
        Infinity;


    for (
        const index
        of casesLibres
    ) {

        grille[index] =
            symboleJoueur;


        const score =
            minimaxLimite(

                grille,

                profondeur + 1,

                true,

                symboleIA,

                symboleJoueur,

                profondeurMax
            );


        grille[index] =
            "";


        meilleurScore =
            Math.min(
                meilleurScore,
                score
            );
    }


    return meilleurScore;
}


// ==========================================================
// IA DIFFICILE
// ==========================================================

function iaDifficile(
    grille,
    symboleIA,
    symboleJoueur
) {

    const casesLibres =
        trouverCasesLibres(
            grille
        );


    if (
        casesLibres.length === 0
    ) {

        return null;
    }


    const coupsScores =
        [];


    for (
        const index
        of casesLibres
    ) {

        grille[index] =
            symboleIA;


        const score =
            minimaxLimite(

                grille,

                0,

                false,

                symboleIA,

                symboleJoueur,

                4
            );


        grille[index] =
            "";


        coupsScores.push({

            index: index,

            score: score

        });
    }


    coupsScores.sort(
        (a, b) =>
            b.score -
            a.score
    );


    // 10% d'erreur volontaire

    if (

        coupsScores.length > 1 &&

        Math.random() < 0.10

    ) {

        return coupsScores[1].index;
    }


    return coupsScores[0].index;
}


// ==========================================================
// IA GOD
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

        return 10 -
            profondeur;
    }


    // Joueur gagne

    if (
        verifierGagnant(
            grille,
            symboleJoueur
        )
    ) {

        return profondeur -
            10;
    }


    const casesLibres =
        trouverCasesLibres(
            grille
        );


    // Match nul

    if (
        casesLibres.length === 0
    ) {

        return 0;
    }


    // ==================================================
    // MAX = IA
    // ==================================================

    if (
        estMaximisation
    ) {

        let meilleurScore =
            -Infinity;


        for (
            const index
            of casesLibres
        ) {

            grille[index] =
                symboleIA;


            const score =
                minimaxGod(

                    grille,

                    profondeur + 1,

                    false,

                    symboleIA,

                    symboleJoueur
                );


            grille[index] =
                "";


            meilleurScore =
                Math.max(
                    meilleurScore,
                    score
                );
        }


        return meilleurScore;
    }


    // ==================================================
    // MIN = JOUEUR
    // ==================================================

    let meilleurScore =
        Infinity;


    for (
        const index
        of casesLibres
    ) {

        grille[index] =
            symboleJoueur;


        const score =
            minimaxGod(

                grille,

                profondeur + 1,

                true,

                symboleIA,

                symboleJoueur
            );


        grille[index] =
            "";


        meilleurScore =
            Math.min(
                meilleurScore,
                score
            );
    }


    return meilleurScore;
}


// ==========================================================
// IA GOD
// CHOIX DU MEILLEUR COUP
// ==========================================================

function iaGod(
    grille,
    symboleIA,
    symboleJoueur
) {

    const casesLibres =
        trouverCasesLibres(
            grille
        );


    if (
        casesLibres.length === 0
    ) {

        return null;
    }


    let meilleurScore =
        -Infinity;


    let meilleurCoup =
        null;


    for (
        const index
        of casesLibres
    ) {

        grille[index] =
            symboleIA;


        const score =
            minimaxGod(

                grille,

                0,

                false,

                symboleIA,

                symboleJoueur
            );


        grille[index] =
            "";


        if (
            score >
            meilleurScore
        ) {

            meilleurScore =
                score;


            meilleurCoup =
                index;
        }
    }


    return meilleurCoup;
}


// ==========================================================
// AFFICHAGE DU RÉSULTAT
// ==========================================================

function showResult(
    gagnant
) {

    if (
        !resultPopup
    ) {

        return;
    }


    if (gagnant) {

        const joueurGagne =
            gameMode === "ai" &&
            gagnant === humanSymbol;


        const iaGagne =
            gameMode === "ai" &&
            gagnant === aiSymbol;


        // JOUEUR HUMAIN

        if (
            joueurGagne
        ) {

            resultTitle.textContent =
                "Victoire !";


            resultMessage.textContent =
                `Vous avez gagné avec ${gagnant} !`;


            resultIcon.textContent =
                "🏆";
        }


        // IA

        else if (
            iaGagne
        ) {

            resultTitle.textContent =
                "Défaite !";


            resultMessage.textContent =
                `L'IA a gagné avec ${gagnant}.`;


            resultIcon.textContent =
                "🤖";
        }


        // MODE LOCAL

        else {

            resultTitle.textContent =
                "Victoire !";


            resultMessage.textContent =
                `Le joueur ${gagnant} a gagné !`;


            resultIcon.textContent =
                "🏆";
        }

    }

    // MATCH NUL

    else {

        resultTitle.textContent =
            "Match nul !";


        resultMessage.textContent =
            "Aucun joueur n'a gagné.";


        resultIcon.textContent =
            "🤝";
    }


    resultPopup.style.display =
        "flex";
}


// ==========================================================
// REJOUER
// ==========================================================

function resetGame() {

    gameBoard = [

        "", "", "",

        "", "", "",

        "", "", ""

    ];


    currentLocalPlayer =
        1;


    isAiThinking =
        false;


    gameFinished =
        false;


    cells.forEach(
        cell => {

            cell.textContent =
                "";

            cell.disabled =
                false;
        }
    );


    if (
        resultPopup
    ) {

        resultPopup.style.display =
            "none";
    }


    demarrerPartie();
}


// ==========================================================
// BOUTONS
// ==========================================================

restartButton?.addEventListener(
    "click",
    resetGame
);


replayButton?.addEventListener(
    "click",
    resetGame
);


homeButton?.addEventListener(
    "click",
    () => {

        location.href =
            "Akatsuki/titre.html";
    }
);


backButton?.addEventListener(
    "click",
    () => {

        location.href =
            "Akatsuki/rencontre.html";
    }
);


// ==========================================================
// CLICS SUR LE PLATEAU
// ==========================================================

cells.forEach(
    cell => {

        cell.addEventListener(
            "click",
            () => {

                const index =
                    Number(

                        cell.dataset?.index ??

                        cell.id.replace(
                            "cell",
                            ""
                        )
                    );


                if (
                    !Number.isInteger(
                        index
                    )
                ) {

                    return;
                }


                // MODE IA

                if (
                    gameMode === "ai"
                ) {

                    jouerContreIA(
                        index
                    );

                }

                // MODE LOCAL

                else {

                    jouerLocal(
                        index
                    );
                }

            }
        );
    }
);


// ==========================================================
// DÉMARRAGE DE LA PARTIE
// ==========================================================

function demarrerPartie() {

    // ==================================================
    // CONTRE IA
    // ==================================================

    if (
        gameMode === "ai"
    ) {

        // X commence toujours.
        //
        // Si le joueur choisit O :
        //
        // Joueur = O
        // IA = X
        //
        // donc l'IA commence.

        if (
            humanSymbol === "O"
        ) {

            lancerTourIA();

        }

        else {

            afficherTour(
                humanSymbol
            );
        }


        return;
    }


    // ==================================================
    // 2 JOUEURS
    // ==================================================

    afficherTour(
        symboleActuelLocal()
    );
}


// ==========================================================
// LANCEMENT
// ==========================================================

demarrerPartie();