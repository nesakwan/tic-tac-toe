const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const DISCONNECT_GRACE_MS = 300_000;
const TOSS_DURATION_MS = 3600;
const BETWEEN_ROUNDS_MS = 3400;
const VALID_TURN_TIMES = new Set([0, 10, 20, 30]);

app.use(express.static(__dirname));
app.get("/health", (_req, res) => res.json({ ok: true }));

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
        code = "";
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    } while (rooms.has(code));
    return code;
}

function generatePlayerToken() {
    return crypto.randomBytes(24).toString("hex");
}

function sanitizePlayerName(value, fallback = "Joueur") {
    const name = String(value || "")
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 18);
    return name || fallback;
}

function normalizeBoardSize(value) {
    return Number(value) === 4 ? 4 : 3;
}

function normalizeBestOf(value) {
    const n = Number(value);
    return n === 5 ? 5 : n === 3 ? 3 : 1;
}

function normalizeTurnTime(value) {
    const n = Number(value);
    return VALID_TURN_TIMES.has(n) ? n : 0;
}

function normalizeCosmetic(value, symbol) {
    const validStyles = new Set([
        "classic", "neon", "electric", "minimal", "holographic", "glitch",
        "plasma", "crystal", "energy", "cyber", "glow", "shadow"
    ]);
    const xThemes = new Set([
        "blue", "lightblue", "cyan", "purple", "green", "turquoise",
        "white", "gold", "orange", "red"
    ]);
    const oThemes = new Set([
        "pink", "magenta", "purple", "red", "orange", "gold",
        "cyan", "turquoise", "white", "green"
    ]);
    const style = validStyles.has(value?.style) ? value.style : "classic";
    const allowedThemes = symbol === "O" ? oThemes : xThemes;
    const fallbackTheme = symbol === "O" ? "pink" : "blue";
    const theme = allowedThemes.has(value?.theme) ? value.theme : fallbackTheme;
    return { style, theme };
}

function winningCombinations(boardSize) {
    const combos = [];
    for (let row = 0; row < boardSize; row++) {
        combos.push(Array.from({ length: boardSize }, (_, col) => row * boardSize + col));
    }
    for (let col = 0; col < boardSize; col++) {
        combos.push(Array.from({ length: boardSize }, (_, row) => row * boardSize + col));
    }
    combos.push(Array.from({ length: boardSize }, (_, i) => i * boardSize + i));
    combos.push(Array.from({ length: boardSize }, (_, i) => i * boardSize + (boardSize - 1 - i)));
    return combos;
}

function getWinningLine(board, boardSize) {
    for (const combo of winningCombinations(boardSize)) {
        const first = board[combo[0]];
        if (first && combo.every(index => board[index] === first)) {
            return { winner: first, line: combo };
        }
    }
    return { winner: null, line: [] };
}

function publicPlayers(room) {
    return { X: room.names.X, O: room.names.O };
}

function publicScores(room) {
    return { X: room.scores.X, O: room.scores.O, draw: room.scores.draw };
}

function publicReady(room) {
    return { X: Boolean(room.ready.X), O: Boolean(room.ready.O) };
}

function createPublicState(room) {
    return {
        code: room.code,
        hostSymbol: room.hostSymbol,
        boardSize: room.boardSize,
        bestOf: room.bestOf,
        winsRequired: room.winsRequired,
        turnTime: room.turnTime,
        turnDeadline: room.turnDeadline || null,
        matchId: room.matchId || null,
        matchStartedAt: room.matchStartedAt || null,
        firstStarterSymbol: room.firstStarterSymbol || null,
        round: room.round,
        board: [...room.board],
        turn: room.turn,
        status: room.status,
        paused: Boolean(room.paused),
        disconnectDeadline: room.disconnectDeadline || null,
        players: publicPlayers(room),
        cosmetics: {
            X: room.cosmetics.X ? { ...room.cosmetics.X } : normalizeCosmetic(null, "X"),
            O: room.cosmetics.O ? { ...room.cosmetics.O } : normalizeCosmetic(null, "O")
        },
        connected: { X: Boolean(room.players.X), O: Boolean(room.players.O) },
        ready: publicReady(room),
        scores: publicScores(room),
        history: room.history.map(move => ({ ...move })),
        roundHistory: room.roundHistory.map(item => ({ ...item, history: item.history.map(move => ({ ...move })) })),
        winner: room.winner,
        winningLine: [...room.winningLine],
        matchFinished: Boolean(room.matchFinished),
        matchWinner: room.matchWinner,
        endReason: room.endReason || null,
        rematchReady: { X: Boolean(room.rematchReady.X), O: Boolean(room.rematchReady.O) }
    };
}

function clearStartTimer(room) {
    if (room.startTimer) {
        clearTimeout(room.startTimer);
        room.startTimer = null;
    }
}

function clearTurnTimer(room, { preserve = false } = {}) {
    if (!room) return;
    if (preserve && room.turnDeadline) {
        room.turnRemainingMs = Math.max(0, room.turnDeadline - Date.now());
    }
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }
    room.turnDeadline = null;
    if (!preserve) room.turnRemainingMs = null;
}

function armTurnTimer(room, remainingMs = null) {
    clearTurnTimer(room);
    if (!room || room.turnTime <= 0 || room.status !== "playing" || room.paused || room.matchFinished || !room.turn) return;

    const duration = Math.max(250, Number(remainingMs) || Number(room.turnRemainingMs) || room.turnTime * 1000);
    room.turnRemainingMs = null;
    room.turnDeadline = Date.now() + duration;
    room.turnTimer = setTimeout(() => {
        room.turnTimer = null;
        room.turnDeadline = null;
        const activeRoom = rooms.get(room.code);
        if (!activeRoom || activeRoom !== room || room.status !== "playing" || room.paused || room.matchFinished || !room.turn) return;

        const timedOutSymbol = room.turn;
        room.turn = timedOutSymbol === "X" ? "O" : "X";
        armTurnTimer(room);
        io.to(room.code).emit("turnTimedOut", {
            timedOutSymbol,
            timedOutName: room.names[timedOutSymbol],
            ...createPublicState(room)
        });
        io.to(room.code).emit("gameState", createPublicState(room));
    }, duration);
}

function pauseTurnTimer(room) {
    clearTurnTimer(room, { preserve: true });
}

function clearRoomTimers(room) {
    clearStartTimer(room);
    clearTurnTimer(room);
    for (const symbol of ["X", "O"]) {
        if (room.disconnectTimers[symbol]) {
            clearTimeout(room.disconnectTimers[symbol]);
            room.disconnectTimers[symbol] = null;
        }
    }
}

function destroyRoom(code, message = null) {
    const room = rooms.get(code);
    if (!room) return;
    clearRoomTimers(room);
    if (message) io.to(code).emit("roomClosed", message);
    rooms.delete(code);
}

function socketSymbolInRoom(socket, room) {
    if (!room) return null;
    if (room.players.X === socket.id) return "X";
    if (room.players.O === socket.id) return "O";
    return null;
}

function detachSocketFromRoom(socket, { destroyIfLobby = false } = {}) {
    const code = socket.data.roomCode;
    const symbol = socket.data.symbol;
    if (!code || !symbol) return;

    const room = rooms.get(code);
    socket.leave(code);
    socket.data.roomCode = null;
    socket.data.symbol = null;

    if (!room) return;
    if (room.players[symbol] === socket.id) room.players[symbol] = null;

    if (destroyIfLobby && (room.status === "lobby" || room.status === "waiting")) {
        destroyRoom(code);
    }
}

function emitLobbyState(room) {
    io.to(room.code).emit("lobbyState", createPublicState(room));
}

function resetBoardForRound(room) {
    room.board = Array(room.boardSize * room.boardSize).fill("");
    room.history = [];
    room.winner = null;
    room.winningLine = [];
}

function startCoinToss(room, forcedStarter = null) {
    if (!room.players.X || !room.players.O || room.paused || room.matchFinished) return;

    clearStartTimer(room);
    clearTurnTimer(room);
    resetBoardForRound(room);

    room.turn = forcedStarter === "X" || forcedStarter === "O"
        ? forcedStarter
        : (Math.random() < 0.5 ? "X" : "O");
    if (room.round === 1 && !room.firstStarterSymbol) room.firstStarterSymbol = room.turn;
    room.status = "tossing";

    io.to(room.code).emit("coinToss", {
        starterSymbol: room.turn,
        starterName: room.names[room.turn],
        players: publicPlayers(room),
        boardSize: room.boardSize,
        bestOf: room.bestOf,
        winsRequired: room.winsRequired,
        round: room.round,
        duration: TOSS_DURATION_MS
    });

    room.startTimer = setTimeout(() => {
        room.startTimer = null;
        const activeRoom = rooms.get(room.code);
        if (!activeRoom || activeRoom !== room || room.paused || !room.players.X || !room.players.O) return;
        room.status = "playing";
        armTurnTimer(room);
        io.to(room.code).emit("gameStart", createPublicState(room));
    }, TOSS_DURATION_MS + 450);
}

function startRoundWithStarter(room, starterSymbol) {
    if (!room.players.X || !room.players.O || room.paused || room.matchFinished) return;

    clearStartTimer(room);
    clearTurnTimer(room);
    resetBoardForRound(room);
    room.turn = starterSymbol;
    room.status = "round_start";

    io.to(room.code).emit("roundStart", {
        ...createPublicState(room),
        starterSymbol,
        starterName: room.names[starterSymbol],
        duration: 1500
    });

    room.startTimer = setTimeout(() => {
        room.startTimer = null;
        if (room.paused || !room.players.X || !room.players.O || room.matchFinished) return;
        room.status = "playing";
        armTurnTimer(room);
        io.to(room.code).emit("gameStart", createPublicState(room));
    }, 1500);
}

function scheduleNextRound(room, { starterSymbol = null, toss = false } = {}) {
    clearStartTimer(room);
    room.pendingNextStarter = starterSymbol;
    room.pendingNextToss = toss;

    room.startTimer = setTimeout(() => {
        room.startTimer = null;
        if (room.paused || !room.players.X || !room.players.O || room.matchFinished) return;
        room.round += 1;
        if (toss) startCoinToss(room);
        else startRoundWithStarter(room, starterSymbol || (Math.random() < 0.5 ? "X" : "O"));
    }, BETWEEN_ROUNDS_MS);
}

function startNewMatch(room) {
    clearStartTimer(room);
    room.scores = { X: 0, O: 0, draw: 0 };
    room.round = 1;
    room.roundHistory = [];
    room.matchFinished = false;
    room.matchWinner = null;
    room.endReason = null;
    room.rematchReady = { X: false, O: false };
    room.ready = { X: false, O: false };
    room.matchId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    room.matchStartedAt = Date.now();
    room.firstStarterSymbol = null;
    clearTurnTimer(room);
    room.pendingNextStarter = null;
    room.pendingNextToss = false;
    startCoinToss(room);
}

function finishMatchByForfeit(room, loserSymbol, reason = "forfeit") {
    const winnerSymbol = loserSymbol === "X" ? "O" : "X";
    room.matchFinished = true;
    room.matchWinner = winnerSymbol;
    room.endReason = reason;
    room.status = "match_end";
    room.turn = null;
    room.winner = winnerSymbol;
    room.winningLine = [];
    clearStartTimer(room);
    clearTurnTimer(room);
    io.to(room.code).emit("matchOver", createPublicState(room));
}

function handleRoundEnd(room, winner, line) {
    clearTurnTimer(room);
    room.winner = winner;
    room.winningLine = line;

    if (winner) room.scores[winner] += 1;
    else room.scores.draw += 1;

    room.roundHistory.push({
        round: room.round,
        winner,
        board: [...room.board],
        history: room.history.map(move => ({ ...move }))
    });

    if (winner && room.scores[winner] >= room.winsRequired) {
        room.matchFinished = true;
        room.matchWinner = winner;
        room.endReason = "victory";
        room.status = "match_end";
        room.turn = null;
        io.to(room.code).emit("matchOver", createPublicState(room));
        return;
    }

    room.status = "round_end";
    room.turn = null;
    const nextStarter = winner ? (winner === "X" ? "O" : "X") : null;
    const nextToss = !winner;

    io.to(room.code).emit("roundOver", {
        ...createPublicState(room),
        nextStarterSymbol: nextStarter,
        nextRoundIn: BETWEEN_ROUNDS_MS,
        nextRoundUsesToss: nextToss
    });

    scheduleNextRound(room, { starterSymbol: nextStarter, toss: nextToss });
}

function resumePendingFlow(room) {
    if (room.paused || !room.players.X || !room.players.O) return;

    if (room.status === "tossing") {
        startCoinToss(room, room.turn);
        return;
    }
    if (room.status === "round_start") {
        startRoundWithStarter(room, room.turn || room.pendingNextStarter || "X");
        return;
    }
    if (room.status === "round_end") {
        scheduleNextRound(room, {
            starterSymbol: room.pendingNextStarter,
            toss: room.pendingNextToss
        });
        return;
    }

    if (room.status === "lobby" || room.status === "waiting") emitLobbyState(room);
    else {
        if (room.status === "playing") armTurnTimer(room, room.turnRemainingMs);
        io.to(room.code).emit("gameState", createPublicState(room));
    }
}

function scheduleDisconnectCleanup(room, symbol) {
    if (room.disconnectTimers[symbol]) clearTimeout(room.disconnectTimers[symbol]);

    const deadline = Date.now() + DISCONNECT_GRACE_MS;
    room.disconnectDeadline = { symbol, deadline };

    room.disconnectTimers[symbol] = setTimeout(() => {
        room.disconnectTimers[symbol] = null;
        const current = rooms.get(room.code);
        if (!current || current !== room || room.players[symbol]) return;

        const otherSymbol = symbol === "X" ? "O" : "X";
        if (room.players[otherSymbol] && !room.matchFinished && !["lobby", "waiting"].includes(room.status)) {
            room.paused = false;
            finishMatchByForfeit(room, symbol, "disconnect");
            return;
        }

        destroyRoom(room.code, "La salle a expiré après une déconnexion trop longue.");
    }, DISCONNECT_GRACE_MS);
}

io.on("connection", socket => {
    console.log("Joueur connecté :", socket.id);

    // Mesure légère de latence. Le serveur ne fait que répondre à l'ACK.
    socket.on("networkPing", (_payload, ack) => {
        if (typeof ack === "function") ack({ serverTime: Date.now() });
    });

    socket.on("createRoom", payload => {
        detachSocketFromRoom(socket, { destroyIfLobby: true });

        const code = generateRoomCode();
        const boardSize = normalizeBoardSize(payload?.boardSize);
        const bestOf = normalizeBestOf(payload?.bestOf);
        const turnTime = normalizeTurnTime(payload?.turnTime);
        const playerName = sanitizePlayerName(payload?.name, "Joueur 1");
        const token = generatePlayerToken();

        const room = {
            code,
            hostSymbol: "X",
            boardSize,
            bestOf,
            winsRequired: Math.ceil(bestOf / 2),
            turnTime,
            turnDeadline: null,
            turnRemainingMs: null,
            turnTimer: null,
            players: { X: socket.id, O: null },
            tokens: { X: token, O: null },
            names: { X: playerName, O: null },
            cosmetics: { X: normalizeCosmetic(payload?.cosmetic, "X"), O: null },
            ready: { X: false, O: false },
            board: Array(boardSize * boardSize).fill(""),
            history: [],
            roundHistory: [],
            scores: { X: 0, O: 0, draw: 0 },
            round: 1,
            turn: null,
            status: "lobby",
            winner: null,
            winningLine: [],
            matchFinished: false,
            matchWinner: null,
            endReason: null,
            rematchReady: { X: false, O: false },
            matchId: null,
            matchStartedAt: null,
            firstStarterSymbol: null,
            startTimer: null,
            pendingNextStarter: null,
            pendingNextToss: false,
            paused: false,
            disconnectDeadline: null,
            disconnectTimers: { X: null, O: null }
        };

        rooms.set(code, room);
        socket.join(code);

        socket.data.roomCode = code;
        socket.data.symbol = "X";

        socket.emit("roomCreated", {
            code,
            symbol: "X",
            token,
            name: playerName,
            ...createPublicState(room)
        });
        emitLobbyState(room);
        console.log("Room créée :", code, `${boardSize}x${boardSize}`, `BO${bestOf}`);
    });

    // --------------------------------------------------
    // REJOINDRE UNE SALLE
    // --------------------------------------------------
    socket.on("joinRoom", payload => {
        const rawCode = typeof payload === "string" ? payload : payload?.code;
        const code = String(rawCode || "").trim().toUpperCase();
        const room = rooms.get(code);

        if (!room) return socket.emit("roomError", "Cette partie n'existe pas.");
        if (room.tokens.O) return socket.emit("roomError", "Cette partie est déjà complète.");
        if (room.status !== "lobby") return socket.emit("roomError", "Cette partie a déjà commencé.");

        detachSocketFromRoom(socket, { destroyIfLobby: true });

        const playerName = sanitizePlayerName(
            typeof payload === "string" ? null : payload?.name,
            "Joueur 2"
        );
        const token = generatePlayerToken();

        room.players.O = socket.id;
        room.tokens.O = token;
        room.names.O = playerName;
        room.cosmetics.O = normalizeCosmetic(
            typeof payload === "string" ? null : payload?.cosmetic,
            "O"
        );
        room.ready.O = false;
        if (room.players.X) {
            room.paused = false;
            room.disconnectDeadline = null;
        }

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.symbol = "O";

        socket.emit("roomJoined", {
            code,
            symbol: "O",
            token,
            name: playerName,
            ...createPublicState(room)
        });
        emitLobbyState(room);
        console.log("Deuxième joueur arrivé dans :", code);
    });

    socket.on("updateRoomSettings", payload => {
        const room = rooms.get(socket.data.roomCode);
        if (!room || room.status !== "lobby" || socket.data.symbol !== room.hostSymbol) return;

        room.boardSize = normalizeBoardSize(payload?.boardSize ?? room.boardSize);
        room.bestOf = normalizeBestOf(payload?.bestOf ?? room.bestOf);
        room.turnTime = normalizeTurnTime(payload?.turnTime ?? room.turnTime);
        room.winsRequired = Math.ceil(room.bestOf / 2);
        room.board = Array(room.boardSize * room.boardSize).fill("");
        room.ready = { X: false, O: false };
        emitLobbyState(room);
    });

    socket.on("setReady", payload => {
        const room = rooms.get(socket.data.roomCode);
        const symbol = socketSymbolInRoom(socket, room);
        if (!room || !symbol || room.status !== "lobby") return;
        if (!room.names.O || !room.tokens.O) {
            socket.emit("roomError", "Attends qu'un adversaire rejoigne la salle.");
            return;
        }

        room.ready[symbol] = Boolean(payload?.ready);
        emitLobbyState(room);

        if (room.ready.X && room.ready.O && room.players.X && room.players.O) {
            startNewMatch(room);
        }
    });

    socket.on("resumeRoom", payload => {
        const code = String(payload?.code || "").trim().toUpperCase();
        const token = String(payload?.token || "");
        const room = rooms.get(code);
        if (!room) return socket.emit("resumeFailed", "La partie n'existe plus.");

        // Le symbole est toujours déduit depuis le socket serveur.
        // On ne fait jamais confiance au symbole envoyé par le navigateur.
        let symbol = null;
        if (room.tokens.X && room.tokens.X === token) symbol = "X";
        if (room.tokens.O && room.tokens.O === token) symbol = "O";
        if (!symbol) return socket.emit("resumeFailed", "Session multijoueur invalide.");

        const oldSocketId = room.players[symbol];
        if (oldSocketId && oldSocketId !== socket.id) io.sockets.sockets.get(oldSocketId)?.leave(code);

        room.players[symbol] = socket.id;
        if (room.disconnectTimers[symbol]) {
            clearTimeout(room.disconnectTimers[symbol]);
            room.disconnectTimers[symbol] = null;
        }

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.symbol = symbol;

        const otherSymbol = symbol === "X" ? "O" : "X";
        if (room.players[otherSymbol] || room.status === "lobby" || room.status === "waiting") {
            room.paused = false;
            room.disconnectDeadline = null;
        }

        socket.emit("roomResumed", {
            symbol,
            token,
            name: room.names[symbol],
            ...createPublicState(room)
        });

        if (room.players[otherSymbol]) {
            io.to(room.players[otherSymbol]).emit("opponentReconnected", createPublicState(room));
            resumePendingFlow(room);
        }
    });

    socket.on("playMove", payload => {
        const room = rooms.get(socket.data.roomCode || payload?.code);
        const index = Number(payload?.index);
        if (!room || room.status !== "playing" || room.paused || room.matchFinished) return;

        const symbol = socketSymbolInRoom(socket, room);
        if (!symbol) return;
        if (room.turn !== symbol) return socket.emit("gameError", "Ce n'est pas ton tour.");
        if (!Number.isInteger(index) || index < 0 || index >= room.board.length) return;
        if (room.board[index]) return socket.emit("gameError", "Cette case est déjà occupée.");

        clearTurnTimer(room);
        room.board[index] = symbol;
        room.history.push({ index, symbol });

        const { winner, line } = getWinningLine(room.board, room.boardSize);
        if (winner) {
            handleRoundEnd(room, winner, line);
            return;
        }
        if (room.board.every(cell => cell !== "")) {
            handleRoundEnd(room, null, []);
            return;
        }

        room.turn = room.turn === "X" ? "O" : "X";
        armTurnTimer(room);
        io.to(room.code).emit("gameState", createPublicState(room));
    });

    socket.on("requestRematch", () => {
        const room = rooms.get(socket.data.roomCode);
        const symbol = socketSymbolInRoom(socket, room);
        if (!room || !symbol || !room.matchFinished) return;
        room.rematchReady[symbol] = true;
        const otherSymbol = symbol === "X" ? "O" : "X";
        const otherSocketId = room.players[otherSymbol];
        if (otherSocketId && !room.rematchReady[otherSymbol]) {
            io.to(otherSocketId).emit("rematchRequested", { from: room.names[symbol] });
        }
        io.to(room.code).emit("rematchState", { ...room.rematchReady });
        if (room.rematchReady.X && room.rematchReady.O) startNewMatch(room);
    });

    socket.on("respondRematch", payload => {
        const room = rooms.get(socket.data.roomCode);
        const symbol = socketSymbolInRoom(socket, room);
        if (!room || !symbol || !room.matchFinished) return;
        if (payload?.accepted) {
            room.rematchReady[symbol] = true;
            io.to(room.code).emit("rematchState", { ...room.rematchReady });
            if (room.rematchReady.X && room.rematchReady.O) startNewMatch(room);
        } else {
            room.rematchReady = { X: false, O: false };
            io.to(room.code).emit("rematchDeclined", { by: room.names[symbol] });
        }
    });

    socket.on("forfeitSession", payload => {
        const code = String(payload?.code || "").trim().toUpperCase();
        const token = String(payload?.token || "");
        const room = rooms.get(code);
        if (!room) return;

        let symbol = null;
        if (room.tokens.X === token) symbol = "X";
        if (room.tokens.O === token) symbol = "O";
        if (!symbol) return;

        if (["lobby", "waiting"].includes(room.status)) {
            const other = symbol === "X" ? "O" : "X";
            if (room.players[other]) io.to(room.players[other]).emit("opponentLeft", "Ton adversaire a quitté la salle.");
            destroyRoom(code);
            return;
        }

        if (!room.matchFinished) finishMatchByForfeit(room, symbol, "forfeit");
    });

    socket.on("forfeitMatch", () => {
        const room = rooms.get(socket.data.roomCode);
        const symbol = socketSymbolInRoom(socket, room);
        if (!room || !symbol) return;

        if (["lobby", "waiting"].includes(room.status)) {
            const otherSymbol = symbol === "X" ? "O" : "X";
            const otherSocketId = room.players[otherSymbol];
            if (otherSocketId) io.to(otherSocketId).emit("opponentLeft", "Ton adversaire a quitté la salle.");
            destroyRoom(room.code);
            return;
        }

        if (!room.matchFinished) finishMatchByForfeit(room, symbol, "forfeit");
    });

    socket.on("leaveRoom", () => {
        const room = rooms.get(socket.data.roomCode);
        const symbol = socketSymbolInRoom(socket, room);
        if (!room || !symbol) return detachSocketFromRoom(socket);

        if (!["lobby", "waiting", "match_end"].includes(room.status) && !room.matchFinished) {
            finishMatchByForfeit(room, symbol, "forfeit");
        } else if (["lobby", "waiting", "match_end"].includes(room.status)) {
            const otherSymbol = symbol === "X" ? "O" : "X";
            if (room.players[otherSymbol]) io.to(room.players[otherSymbol]).emit("opponentLeft", "Ton adversaire a quitté la salle.");
            destroyRoom(room.code);
        }

        detachSocketFromRoom(socket);
    });

    socket.on("disconnect", () => {
        console.log("Joueur déconnecté :", socket.id);
        const code = socket.data.roomCode;
        const symbol = socket.data.symbol;
        if (!code || !symbol) return;

        const room = rooms.get(code);
        if (!room || room.players[symbol] !== socket.id) return;

        room.players[symbol] = null;
        room.paused = true;
        clearStartTimer(room);
        pauseTurnTimer(room);
        scheduleDisconnectCleanup(room, symbol);

        const otherSymbol = symbol === "X" ? "O" : "X";
        const otherSocketId = room.players[otherSymbol];
        if (otherSocketId) {
            io.to(otherSocketId).emit("opponentTemporaryLeft", {
                message: "Connexion de l'adversaire interrompue… attente de reconnexion.",
                deadline: room.disconnectDeadline?.deadline || null
            });
        }
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
