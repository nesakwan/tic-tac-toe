const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(__dirname));

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;

    do {
        code = "";
        for (let i = 0; i < 4; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (rooms.has(code));

    return code;
}

function sanitizePlayerName(value, fallback = "Joueur") {
    const name = String(value || "")
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 18);

    return name || fallback;
}

function getWinner(board) {
    const combinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of combinations) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return null;
}

function publicPlayers(room) {
    return {
        X: room.names.X,
        O: room.names.O
    };
}

function removeSocketFromPreviousRoom(socket) {
    const previousCode = socket.data.roomCode;
    if (!previousCode) return;

    const previousRoom = rooms.get(previousCode);
    if (previousRoom?.startTimer) clearTimeout(previousRoom.startTimer);
    rooms.delete(previousCode);
    socket.leave(previousCode);
    socket.data.roomCode = null;
    socket.data.symbol = null;
}

io.on("connection", socket => {
    console.log("Joueur connecté :", socket.id);

    socket.on("createRoom", payload => {
        removeSocketFromPreviousRoom(socket);

        const code = generateRoomCode();
        const playerName = sanitizePlayerName(payload?.name, "Joueur 1");

        const room = {
            players: {
                X: socket.id,
                O: null
            },
            names: {
                X: playerName,
                O: null
            },
            board: Array(9).fill(""),
            turn: null,
            status: "waiting",
            startTimer: null
        };

        rooms.set(code, room);
        socket.join(code);
        socket.data.roomCode = code;
        socket.data.symbol = "X";

        socket.emit("roomCreated", {
            code,
            symbol: "X",
            name: playerName
        });

        console.log("Room créée :", code);
    });

    socket.on("joinRoom", payload => {
        const rawCode = typeof payload === "string" ? payload : payload?.code;
        const code = String(rawCode || "").trim().toUpperCase();
        const room = rooms.get(code);

        if (!room) {
            socket.emit("roomError", "Cette partie n'existe pas.");
            return;
        }

        if (room.players.O) {
            socket.emit("roomError", "Cette partie est déjà complète.");
            return;
        }

        removeSocketFromPreviousRoom(socket);

        const playerName = sanitizePlayerName(
            typeof payload === "string" ? null : payload?.name,
            "Joueur 2"
        );

        room.players.O = socket.id;
        room.names.O = playerName;
        room.turn = Math.random() < 0.5 ? "X" : "O";
        room.status = "tossing";

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.symbol = "O";

        socket.emit("roomJoined", {
            code,
            symbol: "O",
            name: playerName
        });

        const tossData = {
            starterSymbol: room.turn,
            starterName: room.names[room.turn],
            players: publicPlayers(room)
        };

        io.to(code).emit("coinToss", tossData);

        room.startTimer = setTimeout(() => {
            const activeRoom = rooms.get(code);

            if (
                !activeRoom ||
                activeRoom !== room ||
                !room.players.X ||
                !room.players.O
            ) {
                return;
            }

            room.status = "playing";
            room.startTimer = null;

            io.to(code).emit("gameStart", {
                board: room.board,
                turn: room.turn,
                players: publicPlayers(room)
            });
        }, 2600);

        console.log("Deuxième joueur arrivé dans :", code);
    });

    socket.on("playMove", payload => {
        const code = socket.data.roomCode || payload?.code;
        const room = rooms.get(code);
        const index = Number(payload?.index);

        if (!room || room.status !== "playing") return;

        if (!Number.isInteger(index) || index < 0 || index > 8) return;

        let symbol = null;
        if (room.players.X === socket.id) symbol = "X";
        if (room.players.O === socket.id) symbol = "O";
        if (!symbol) return;

        if (room.turn !== symbol) {
            socket.emit("gameError", "Ce n'est pas ton tour.");
            return;
        }

        if (room.board[index]) {
            socket.emit("gameError", "Cette case est déjà occupée.");
            return;
        }

        room.board[index] = symbol;

        const winner = getWinner(room.board);
        if (winner) {
            room.status = "finished";
            io.to(code).emit("gameOver", {
                board: room.board,
                winner,
                players: publicPlayers(room)
            });
            return;
        }

        if (room.board.every(cell => cell !== "")) {
            room.status = "finished";
            io.to(code).emit("gameOver", {
                board: room.board,
                winner: null,
                players: publicPlayers(room)
            });
            return;
        }

        room.turn = room.turn === "X" ? "O" : "X";

        io.to(code).emit("gameState", {
            board: room.board,
            turn: room.turn,
            players: publicPlayers(room)
        });
    });

    socket.on("disconnect", () => {
        console.log("Joueur déconnecté :", socket.id);

        const code = socket.data.roomCode;
        if (!code) return;

        const room = rooms.get(code);
        if (!room) return;

        if (room.startTimer) clearTimeout(room.startTimer);

        socket.to(code).emit("opponentLeft");
        rooms.delete(code);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("==============================");
    console.log(" SERVEUR TIC TAC TOE DÉMARRÉ");
    console.log("==============================");
    console.log("");
    console.log(`http://localhost:${PORT}/Multiplayer/multi.html`);
    console.log("");
});
