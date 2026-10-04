const gamePage = document.getElementById('gamepage');
const turnPlayer = document.getElementById('turn-player');
const cell0 = document.getElementById(`cell${gamePage}`);
const cell1 = document.getElementById('cell1');

let currentPlayer1 = "X";
let currentPlayer2 = "O";
let player1HasPlayed = false;



let gameBoard = [
    "", "", "",
    "", "", "",
    "", "", ""
];

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
                alert(`Le joueur ${player} a gagné !`);
                return;
            }
        }

    }

}