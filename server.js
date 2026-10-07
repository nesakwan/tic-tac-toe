const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --------------------------------------------------
// SERVIR LES FICHIERS DU JEU
// --------------------------------------------------

app.use(express.static(path.join(__dirname)));

// Page de test serveur
app.get("/health", (req, res) => {
    res.send("Serveur TIC TAC BOOM actif");
});

// --------------------------------------------------
// SALLES MULTIJOUEUR
// --------------------------------------------------

const rooms = new Map();

function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    do {
        code = "";

        for (let i = 0; i < 4; i++) {
            code += characters[
                Math.floor(Math.random() * characters.length)
            ];
        }
    } while (rooms.has(code));

    return code;
}

// --------------------------------------------------
// SOCKET.IO
// --------------------------------------------------

io.on("connection", (socket) => {
    console.log("Joueur connecté :", socket.id);

    // -------------------------------
    // CRÉER UNE SALLE
    // -------------------------------

    socket.on("createRoom", () => {
        const code = generateRoomCode();

        const room = {
            players: {
                X: socket.id,
                O: null
            },

            board: Array(9).fill(null),

            turn: "X",

            status: "waiting"
        };

        rooms.set(code, room);

        socket.join(code);

        socket.data.roomCode = code;
        socket.data.symbol = "X";

        socket.emit("roomCreated", {
            code,
            symbol: "X"
        });

        console.log("Salle créée :", code);
    });

    // -------------------------------
    // REJOINDRE UNE SALLE
    // -------------------------------

    socket.on("joinRoom", (code) => {
        code = String(code).trim().toUpperCase();

        const room = rooms.get(code);

        if (!room) {
            socket.emit("roomError", "Salle introuvable.");
            return;
        }

        if (room.players.O) {
            socket.emit("roomError", "La salle est déjà complète.");
            return;
        }

        room.players.O = socket.id;
        room.status = "playing";

        socket.join(code);

        socket.data.roomCode = code;
        socket.data.symbol = "O";

        socket.emit("roomJoined", {
            code,
            symbol: "O"
        });

        
        io.to(code).emit("gameStart", {
            board: room.board,
            turn: room.turn
        });

        console.log("Salle rejointe :", code);
    });

    // -------------------------------
    // JOUER UN COUP
    // -------------------------------

    socket.on("playMove", ({ index }) => {
        const code = socket.data.roomCode;
        const symbol = socket.data.symbol;

        if (!code || !symbol) {
            return;
        }

        const room = rooms.get(code);

        if (!room) {
            return;
        }

        if (room.status !== "playing") {
            return;
        }

        if (room.turn !== symbol) {
            socket.emit("gameError", "Ce n'est pas votre tour.");
            return;
        }

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index > 8
        ) {
            return;
        }

        if (room.board[index] !== null) {
            socket.emit("gameError", "Cette case est déjà utilisée.");
            return;
        }

        room.board[index] = symbol;

        const winner = checkWinner(room.board);

        if (winner) {
            room.status = "finished";

            io.to(code).emit("gameOver", {
                winner,
                board: room.board
            });

            return;
        }

        if (room.board.every(cell => cell !== null)) {
            room.status = "finished";

            io.to(code).emit("gameOver", {
                winner: null,
                draw: true,
                board: room.board
            });

            return;
        }

        room.turn = symbol === "X" ? "O" : "X";

        io.to(code).emit("gameState", {
            board: room.board,
            turn: room.turn
        });
    });

    // -------------------------------
    // DÉCONNEXION
    // -------------------------------

    socket.on("disconnect", () => {
        const code = socket.data.roomCode;

        if (!code) {
            return;
        }

        const room = rooms.get(code);

        if (!room) {
            return;
        }

        socket.to(code).emit("opponentLeft");

        rooms.delete(code);

        console.log("Salle supprimée :", code);
    });
});

// --------------------------------------------------
// VÉRIFICATION VICTOIRE
// --------------------------------------------------

function checkWinner(board) {
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

// --------------------------------------------------
// PORT RENDER
// --------------------------------------------------

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
});