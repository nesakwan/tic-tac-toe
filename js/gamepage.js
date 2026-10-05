const gamePage = document.getElementById('gamepage');
const turnPlayer = document.getElementById('turn-player');
const cell0 = document.getElementById(`cell${gamePage}`);
const cell1 = document.getElementById('cell1');

const resultPopup = document.getElementById("result-popup");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const resultIcon = document.getElementById("result-icon");


let currentPlayer1 = "X";
let currentPlayer2 = "O";
let player1HasPlayed = false;
let player1Won = false;
let player2Won = false;

let gameBoard = [
    "", "", "",
    "", "", "",
    "", "", "",
];

const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],

    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],

    [0, 4, 8],
    [2, 4, 6],
];


turnPlayer.innerHTML = `<p> Tour de : ${currentPlayer1} </p>`;

// Gameplay logic
const cells = document.querySelectorAll(".cell");

cells.forEach(cell => {

    cell.addEventListener("click", function (event) {

        // 1. récupérer l'id
        // 2. récupérer le dernier caractère
        // 3. le convertir en nombre
        // 4. faire un console.log()
        const cellBack = event.target.id;
        const cellId = parseInt(cellBack.charAt(cellBack.length - 1));
        if (player1HasPlayed) {
            playO(cellId);
        } else {
            playX(cellId);
        }

        console.log(`Cell clicked: ${cellId}`);

        checkWinner();
        if (player1Won || player2Won) {
            console.log("Player has won!", player1Won || player2Won);
            // alert(`Le joueur ${currentPlayer1} a gagné !`);
            showResult();
        }

    });

});




// Functions
function playX(c) {
    if (gameBoard[c] === "") {
        gameBoard[c] = currentPlayer1;
        const cell = document.getElementById(`cell${c}`);
        cell.textContent = currentPlayer1;
        turnPlayer.innerHTML = `<p> Tour de : ${currentPlayer2} </p>`;
        player1HasPlayed = true;
    }
}

function playO(c) {
    if (gameBoard[c] === "") {
        gameBoard[c] = currentPlayer2;
        console.log(`Placing ${currentPlayer2} in cell ${c}`);
        const cell = document.getElementById(`cell${c}`);
        cell.textContent = currentPlayer2;
        turnPlayer.innerHTML = `<p> Tour de : ${currentPlayer1} </p>`;
        player1HasPlayed = false;
    }
}

function checkWinner() {
    for (let combination of winningCombinations) {
        for (let player of [currentPlayer1, currentPlayer2]) {
            if (combination.every(index => gameBoard[index] === player)) {
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

function showResult() {

    if (player1Won) {
        resultTitle.textContent = "Victoire !";
        resultMessage.textContent = `Le joueur ${currentPlayer1} a gagné !`;
        resultIcon.textContent = "🏆";
    } else if (player2Won) {
        resultTitle.textContent = "Victoire !";
        resultMessage.textContent = `Le joueur ${currentPlayer2} a gagné !`;
        resultIcon.textContent = "🏆";
    } else {
        resultTitle.textContent = "Match nul !";
        resultMessage.textContent = "Aucun joueur n'a gagné.";
        resultIcon.textContent = "🤝";
    }

    resultPopup.style.display = "flex";
}