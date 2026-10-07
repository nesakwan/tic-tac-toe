const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Rend tout le dossier du projet accessible
app.use(express.static(__dirname));

// Parties en cours
const rooms = new Map();


// =====================================================
// CODE DE ROOM
// =====================================================

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 4; i++) {
        code += chars[
            Math.floor(Math.random() * chars.length)
        ];
    }

    return code;
}


// =====================================================
// VICTOIRE
// =====================================================

function getWinner(board) {

    const combinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]
    ];


    for (const [a, b, c] of combinations) {

        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    return null;
}


// =====================================================
// SOCKET.IO
// =====================================================

io.on("connection", socket => {

    console.log("Joueur connecté :", socket.id);


    // -------------------------------------------------
    // CRÉER ROOM
    // -------------------------------------------------

    socket.on("createRoom", () => {

        let code;

        do {
            code = generateRoomCode();
        }
        while (rooms.has(code));


        const room = {
            players: {
                X: socket.id,
                O: null
            },

            board: [
                "", "", "",
                "", "", "",
                "", "", ""
            ],

            turn: "X",

            status: "waiting"
        };


        rooms.set(code, room);

        socket.join(code);


        socket.emit("roomCreated", {
            code,
            symbol: "X"
        });


        console.log("Room créée :", code);

    });


    // -------------------------------------------------
    // REJOINDRE ROOM
    // -------------------------------------------------

    socket.on("joinRoom", rawCode => {

        const code = String(rawCode)
            .trim()
            .toUpperCase();


        const room = rooms.get(code);


        if (!room) {

            socket.emit(
                "roomError",
                "Cette partie n'existe pas."
            );

            return;
        }


        if (room.players.O) {

            socket.emit(
                "roomError",
                "Cette partie est déjà complète."
            );

            return;
        }


        room.players.O = socket.id;
        room.status = "playing";

        socket.join(code);


        socket.emit("roomJoined", {
            code,
            symbol: "O"
        });


        io.to(code).emit("gameStart", {
            board: room.board,
            turn: room.turn
        });


        console.log(
            "Deuxième joueur arrivé dans :",
            code
        );

    });


    // -------------------------------------------------
    // JOUER
    // -------------------------------------------------

    socket.on("playMove", ({ code, index }) => {

        const room = rooms.get(code);


        if (!room) {
            return;
        }


        if (room.status !== "playing") {
            return;
        }


        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index > 8
        ) {
            return;
        }


        let symbol = null;


        if (room.players.X === socket.id) {
            symbol = "X";
        }


        if (room.players.O === socket.id) {
            symbol = "O";
        }


        if (!symbol) {
            return;
        }


        // Mauvais tour
        if (room.turn !== symbol) {

            socket.emit(
                "gameError",
                "Ce n'est pas ton tour."
            );

            return;
        }


        // Case occupée
        if (room.board[index]) {

            socket.emit(
                "gameError",
                "Cette case est déjà occupée."
            );

            return;
        }


        // Jouer
        room.board[index] = symbol;


        // Victoire
        const winner = getWinner(room.board);


        if (winner) {

            room.status = "finished";


            io.to(code).emit("gameOver", {
                board: room.board,
                winner
            });


            return;
        }


        // Match nul
        const isDraw =
            room.board.every(cell => cell !== "");


        if (isDraw) {

            room.status = "finished";


            io.to(code).emit("gameOver", {
                board: room.board,
                winner: null
            });


            return;
        }


        // Changer le tour
        room.turn =
            room.turn === "X"
                ? "O"
                : "X";


        io.to(code).emit("gameState", {
            board: room.board,
            turn: room.turn
        });

    });


    // -------------------------------------------------
    // DÉCONNEXION
    // -------------------------------------------------

    socket.on("disconnect", () => {

        console.log(
            "Joueur déconnecté :",
            socket.id
        );


        for (const [code, room] of rooms) {

            if (
                room.players.X === socket.id ||
                room.players.O === socket.id
            ) {

                socket
                    .to(code)
                    .emit("opponentLeft");


                rooms.delete(code);

            }

        }

    });

});


// =====================================================
// DÉMARRER SERVEUR
// =====================================================

server.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("==============================");
    console.log(" SERVEUR TIC TAC TOE DÉMARRÉ");
    console.log("==============================");
    console.log("");
    console.log(
        `http://localhost:${PORT}/Multiplayer/multi.html`
    );
    console.log("");

});