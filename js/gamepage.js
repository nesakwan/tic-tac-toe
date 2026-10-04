const gamePage = document.getElementById('gamepage');
const turnPlayer = document.getElementById('turn-player');
const cell0 = document.getElementById(`cell${gamePage}`);
const cell1 = document.getElementById('cell1');

let currentPlayer1 = "X";
let currentPlayer2 = "O";



let gameBoard = [
    "", "", "",
    "", "", "",
    "", "", ""
];


// gamePage.innerHTML = `<p> Teeeeeeesst </p>`;
turnPlayer.innerHTML = `<p> Tour de : ${currentPlayer1} </p>`;


playX();
playO();



// Functions


function playX() {
    for (let i = 0; i < gameBoard.length; i++) {
        if (gameBoard[i] === "") {
            gameBoard[i] = currentPlayer1;
            const cell = document.getElementById(`cell${i}`);
            cell.textContent = currentPlayer1;
            turnPlayer.innerHTML = `<p> Tour de : ${currentPlayer2} </p>`;
            break; // Exit the loop after placing the mark
        }
}
}

function playO() {
    for (let i = 0; i < gameBoard.length; i++) {
        if (gameBoard[i] === "") {
            gameBoard[i] = currentPlayer2;
            console.log(`Placing ${currentPlayer2} in cell ${i}`);
            const cell = document.getElementById(`cell${i}`);
            cell.textContent = currentPlayer2;
            turnPlayer.innerHTML = `<p> Tour de : ${currentPlayer1} </p>`;
            break; // Exit the loop after placing the mark
        }
}
}