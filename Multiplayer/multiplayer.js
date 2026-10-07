const socket = io();


// =====================================================
// HTML
// =====================================================

const lobby =
    document.getElementById("lobby");

const game =
    document.getElementById("game");


const createRoomButton =
    document.getElementById("create-room");

const joinRoomButton =
    document.getElementById("join-room");


const roomCodeInput =
    document.getElementById("room-code-input");


const roomInfo =
    document.getElementById("room-info");

const roomCodeDisplay =
    document.getElementById("room-code");


const waitingMessage =
    document.getElementById("waiting-message");


const lobbyMessage =
    document.getElementById("lobby-message");


const playerSymbolDisplay =
    document.getElementById("player-symbol");


const gameStatus =
    document.getElementById("game-status");


const gameMessage =
    document.getElementById("game-message");


const cells =
    document.querySelectorAll(".cell");


// =====================================================
// ÉTAT DU JOUEUR
// =====================================================

let currentRoom = null;

let mySymbol = null;


// =====================================================
// CRÉER PARTIE
// =====================================================

createRoomButton.addEventListener(
    "click",
    () => {

        lobbyMessage.textContent = "";

        socket.emit("createRoom");

    }
);


// =====================================================
// REJOINDRE
// =====================================================

joinRoomButton.addEventListener(
    "click",
    () => {

        const code =
            roomCodeInput
                .value
                .trim()
                .toUpperCase();


        if (!code) {

            lobbyMessage.textContent =
                "Entre un code.";

            return;
        }


        socket.emit(
            "joinRoom",
            code
        );

    }
);


// =====================================================
// ROOM CRÉÉE
// =====================================================

socket.on(
    "roomCreated",
    data => {

        currentRoom =
            data.code;

        mySymbol =
            data.symbol;


        roomInfo.hidden =
            false;


        roomCodeDisplay.textContent =
            currentRoom;


        waitingMessage.textContent =
            "En attente d'un adversaire...";

    }
);


// =====================================================
// ROOM REJOINTE
// =====================================================

socket.on(
    "roomJoined",
    data => {

        currentRoom =
            data.code;

        mySymbol =
            data.symbol;

    }
);


// =====================================================
// ERREUR ROOM
// =====================================================

socket.on(
    "roomError",
    message => {

        lobbyMessage.textContent =
            message;

    }
);


// =====================================================
// DÉBUT PARTIE
// =====================================================

socket.on(
    "gameStart",
    data => {

        lobby.hidden = true;

        game.hidden = false;


        playerSymbolDisplay.textContent =
            `Vous êtes ${mySymbol}`;


        renderBoard(
            data.board,
            data.turn
        );

    }
);


// =====================================================
// MISE À JOUR
// =====================================================

socket.on(
    "gameState",
    data => {

        renderBoard(
            data.board,
            data.turn
        );

    }
);


// =====================================================
// FIN
// =====================================================

socket.on(
    "gameOver",
    data => {

        renderBoard(
            data.board,
            null
        );


        cells.forEach(
            cell => {

                cell.disabled = true;

            }
        );


        if (!data.winner) {

            gameStatus.textContent =
                "MATCH NUL !";

        }

        else if (
            data.winner === mySymbol
        ) {

            gameStatus.textContent =
                "VICTOIRE !";

        }

        else {

            gameStatus.textContent =
                "DÉFAITE !";

        }

    }
);


// =====================================================
// ADVERSAIRE PARTI
// =====================================================

socket.on(
    "opponentLeft",
    () => {

        gameStatus.textContent =
            "Ton adversaire a quitté la partie.";


        cells.forEach(
            cell => {

                cell.disabled = true;

            }
        );

    }
);


// =====================================================
// ERREUR JEU
// =====================================================

socket.on(
    "gameError",
    message => {

        gameMessage.textContent =
            message;

    }
);


// =====================================================
// CLIQUER CASE
// =====================================================

cells.forEach(
    (cell, index) => {

        cell.addEventListener(
            "click",
            () => {

                socket.emit(
                    "playMove",
                    {
                        code:
                            currentRoom,

                        index:
                            index
                    }
                );

            }
        );

    }
);


// =====================================================
// AFFICHER LE PLATEAU
// =====================================================

function renderBoard(
    board,
    turn
) {

    cells.forEach(
        (cell, index) => {

            const symbol =
                board[index];


            cell.textContent =
                symbol;


            cell.disabled =
                Boolean(symbol) ||
                turn !== mySymbol;


            if (symbol === "X") {

                cell.style.color =
                    "#4D8EFF";

            }


            if (symbol === "O") {

                cell.style.color =
                    "#E66AB5";

            }

        }
    );


    gameMessage.textContent = "";


    if (!turn) {
        return;
    }


    if (turn === mySymbol) {

        gameStatus.textContent =
            "À TOI DE JOUER";

    }

    else {

        gameStatus.textContent =
            "TOUR DE TON ADVERSAIRE";

    }

}