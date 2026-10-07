// =====================================================
// TIC TAC TOE — LOBBY MULTIJOUEUR
// =====================================================

// Le bouton Paramètres reste un vrai lien HTML : même si Socket.IO
// ne charge pas, la navigation vers les paramètres continue de fonctionner.
const settingsButton = document.getElementById("settings-button");
settingsButton?.addEventListener("click", () => {
    sessionStorage.setItem("tttSettingsReturn", "../Multiplayer/multi.html");
});

const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const coinTossPanel = document.getElementById("coin-toss");

const createRoomButton = document.getElementById("create-room");
const joinRoomButton = document.getElementById("join-room");
const roomCodeInput = document.getElementById("room-code-input");
const playerNameInput = document.getElementById("player-name-input");

const roomInfo = document.getElementById("room-info");
const roomCodeDisplay = document.getElementById("room-code");
const waitingMessage = document.getElementById("waiting-message");
const lobbyMessage = document.getElementById("lobby-message");
const lobbyActions = document.getElementById("lobby-actions");
const copyRoomCodeButton = document.getElementById("copy-room-code");

const playerSymbolDisplay = document.getElementById("player-symbol");
const onlinePlayersDisplay = document.getElementById("online-players");
const gameStatus = document.getElementById("game-status");
const gameMessage = document.getElementById("game-message");
const cells = document.querySelectorAll(".cell");

const connectionStatus = document.getElementById("connection-status");
const connectionDot = document.getElementById("connection-dot");

const coin = document.getElementById("coin");
const coinTossSubtitle = document.getElementById("coin-toss-subtitle");
const coinTossResult = document.getElementById("coin-toss-result");

const ONLINE_NAME_KEY = "tttOnlinePlayerName";

let currentRoom = null;
let mySymbol = null;
let myName = "Joueur";
let roomPlayers = { X: "Joueur 1", O: "Joueur 2" };

function normalizeName(value) {
    return String(value || "")
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 18);
}

function getPlayerName() {
    const value = normalizeName(playerNameInput?.value);
    return value || "Joueur";
}

function savePlayerName() {
    const name = getPlayerName();
    sessionStorage.setItem(ONLINE_NAME_KEY, name);
    return name;
}

const savedOnlineName = sessionStorage.getItem(ONLINE_NAME_KEY);
if (playerNameInput && savedOnlineName) {
    playerNameInput.value = normalizeName(savedOnlineName);
}

playerNameInput?.addEventListener("input", () => {
    const caret = playerNameInput.selectionStart;
    playerNameInput.value = playerNameInput.value
        .replace(/[<>]/g, "")
        .slice(0, 18);
    try {
        playerNameInput.setSelectionRange(caret, caret);
    } catch (_) {}
});

playerNameInput?.addEventListener("change", savePlayerName);

roomCodeInput?.addEventListener("input", () => {
    roomCodeInput.value = roomCodeInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
});

roomCodeInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") joinRoomButton?.click();
});

copyRoomCodeButton?.addEventListener("click", async () => {
    if (!currentRoom) return;

    try {
        await navigator.clipboard.writeText(currentRoom);
        copyRoomCodeButton.textContent = "Code copié !";
    } catch (_) {
        copyRoomCodeButton.textContent = currentRoom;
    }

    setTimeout(() => {
        copyRoomCodeButton.textContent = "Copier le code";
    }, 1400);
});

// =====================================================
// SOCKET.IO
// =====================================================

const socket = typeof globalThis.io === "function" ? globalThis.io() : null;

function setConnectionState(text, state) {
    if (connectionStatus) connectionStatus.textContent = text;
    if (!connectionDot) return;

    connectionDot.classList.remove("online", "offline");
    if (state) connectionDot.classList.add(state);
}

function showServerUnavailable() {
    setConnectionState("Serveur indisponible", "offline");
    if (lobbyMessage) {
        lobbyMessage.textContent =
            "Le serveur multijoueur n'est pas connecté. Vérifie que cette page est bien ouverte depuis le Web Service Render.";
    }
}

if (!socket) {
    showServerUnavailable();
} else {
    socket.on("connect", () => {
        setConnectionState("Serveur en ligne", "online");
        if (lobbyMessage?.textContent.includes("serveur multijoueur")) {
            lobbyMessage.textContent = "";
        }
    });

    socket.on("connect_error", () => {
        showServerUnavailable();
    });

    socket.on("disconnect", () => {
        setConnectionState("Connexion interrompue", "offline");
    });
}

function requireSocket() {
    if (socket?.connected) return true;
    showServerUnavailable();
    return false;
}

// =====================================================
// CRÉER / REJOINDRE
// =====================================================

createRoomButton?.addEventListener("click", () => {
    if (!requireSocket()) return;

    lobbyMessage.textContent = "";
    myName = savePlayerName();

    socket.emit("createRoom", {
        name: myName
    });
});

joinRoomButton?.addEventListener("click", () => {
    if (!requireSocket()) return;

    const code = roomCodeInput.value.trim().toUpperCase();

    if (code.length !== 4) {
        lobbyMessage.textContent = "Entre un code valide à 4 caractères.";
        return;
    }

    lobbyMessage.textContent = "";
    myName = savePlayerName();

    socket.emit("joinRoom", {
        code,
        name: myName
    });
});

socket?.on("roomCreated", data => {
    currentRoom = data.code;
    mySymbol = data.symbol;
    myName = data.name || myName;

    roomInfo.hidden = false;
    if (lobbyActions) lobbyActions.hidden = true;

    roomCodeDisplay.textContent = currentRoom;
    waitingMessage.textContent = "En attente d'un adversaire...";
});

socket?.on("roomJoined", data => {
    currentRoom = data.code;
    mySymbol = data.symbol;
    myName = data.name || myName;
});

socket?.on("roomError", message => {
    lobbyMessage.textContent = message;
    if (!currentRoom && lobbyActions) lobbyActions.hidden = false;
});

// =====================================================
// TIRAGE AU SORT
// =====================================================

socket?.on("coinToss", data => {
    roomPlayers = data.players || roomPlayers;

    lobby.hidden = true;
    game.hidden = true;
    coinTossPanel.hidden = false;

    coinTossSubtitle.textContent = "Le serveur lance la pièce...";
    coinTossResult.textContent = "TIRAGE...";
    coinTossResult.classList.remove("result-x", "result-o", "revealed");

    coin?.classList.remove("is-tossing", "lands-x", "lands-o");
    void coin?.offsetWidth;
    coin?.classList.add("is-tossing");

    setTimeout(() => {
        const starterSymbol = data.starterSymbol;
        const starterName = data.starterName || roomPlayers[starterSymbol] || starterSymbol;

        coin?.classList.remove("is-tossing");
        coin?.classList.add(starterSymbol === "X" ? "lands-x" : "lands-o");

        coinTossSubtitle.textContent = "Le tirage est terminé";
        coinTossResult.textContent = `${starterName} commence — ${starterSymbol}`;
        coinTossResult.classList.add(
            starterSymbol === "X" ? "result-x" : "result-o",
            "revealed"
        );
    }, 1650);
});

// =====================================================
// PARTIE
// =====================================================

socket?.on("gameStart", data => {
    roomPlayers = data.players || roomPlayers;

    coinTossPanel.hidden = true;
    lobby.hidden = true;
    game.hidden = false;

    const opponentSymbol = mySymbol === "X" ? "O" : "X";
    const opponentName = roomPlayers[opponentSymbol] || "Adversaire";

    playerSymbolDisplay.textContent = `${myName} — ${mySymbol}`;
    if (onlinePlayersDisplay) {
        onlinePlayersDisplay.textContent = `${roomPlayers.X || "Joueur X"}  VS  ${roomPlayers.O || "Joueur O"}`;
    }

    renderBoard(data.board, data.turn);

    if (data.turn === mySymbol) {
        gameStatus.textContent = "À TOI DE JOUER";
    } else {
        gameStatus.textContent = `TOUR DE ${opponentName.toUpperCase()}`;
    }
});

socket?.on("gameState", data => {
    roomPlayers = data.players || roomPlayers;
    renderBoard(data.board, data.turn);
});

socket?.on("gameOver", data => {
    roomPlayers = data.players || roomPlayers;
    renderBoard(data.board, null);

    cells.forEach(cell => {
        cell.disabled = true;
    });

    if (!data.winner) {
        gameStatus.textContent = "MATCH NUL !";
    } else if (data.winner === mySymbol) {
        gameStatus.textContent = "VICTOIRE !";
    } else {
        gameStatus.textContent = "DÉFAITE !";
    }
});

socket?.on("opponentLeft", () => {
    gameStatus.textContent = "Ton adversaire a quitté la partie.";
    cells.forEach(cell => {
        cell.disabled = true;
    });
});

socket?.on("gameError", message => {
    gameMessage.textContent = message;
});

cells.forEach((cell, index) => {
    cell.addEventListener("click", () => {
        if (!socket?.connected || !currentRoom) return;

        socket.emit("playMove", {
            code: currentRoom,
            index
        });
    });
});

function renderBoard(board, turn) {
    cells.forEach((cell, index) => {
        const symbol = board[index];
        cell.textContent = symbol;
        cell.disabled = Boolean(symbol) || turn !== mySymbol;
        cell.classList.remove("mark-x", "mark-o");

        if (symbol === "X") cell.classList.add("mark-x");
        if (symbol === "O") cell.classList.add("mark-o");
    });

    gameMessage.textContent = "";
    if (!turn) return;

    if (turn === mySymbol) {
        gameStatus.textContent = "À TOI DE JOUER";
    } else {
        const opponentSymbol = mySymbol === "X" ? "O" : "X";
        const opponentName = roomPlayers[opponentSymbol] || "ton adversaire";
        gameStatus.textContent = `TOUR DE ${opponentName.toUpperCase()}`;
    }
}
