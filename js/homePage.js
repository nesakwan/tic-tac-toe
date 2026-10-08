(() => {
    const appWindow = document.querySelector(".app-window");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (appWindow && !reducedMotion && window.matchMedia?.("(pointer: fine)")?.matches) {
        const updateParallax = (event) => {
            const x = ((event.clientX / window.innerWidth) - 0.5) * 8;
            const y = ((event.clientY / window.innerHeight) - 0.5) * 6;
            appWindow.style.setProperty("--home-parallax-x", `${x.toFixed(2)}px`);
            appWindow.style.setProperty("--home-parallax-y", `${y.toFixed(2)}px`);
        };

        window.addEventListener("pointermove", updateParallax, { passive: true });
        document.addEventListener("mouseleave", () => {
            appWindow.style.setProperty("--home-parallax-x", "0px");
            appWindow.style.setProperty("--home-parallax-y", "0px");
        });
    }

    const data = globalThis.TTTPlayerData;
    if (!data) return;

    const profileButton = document.getElementById("profile-button");
    const historyButton = document.getElementById("history-button");

    const overlay = document.createElement("div");
    overlay.className = "home-modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
        <section class="home-modal" role="dialog" aria-modal="true" aria-labelledby="home-modal-title">
            <button class="home-modal-close" type="button" aria-label="Fermer">×</button>
            <div id="home-modal-content"></div>
        </section>
    `;
    document.body.appendChild(overlay);

    const content = overlay.querySelector("#home-modal-content");
    const closeButton = overlay.querySelector(".home-modal-close");

    function closeModal() {
        overlay.hidden = true;
    }

    closeButton.addEventListener("click", closeModal);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !overlay.hidden) closeModal();
    });

    function statCard(label, stat) {
        return `
            <article class="profile-stat-card">
                <span>${label}</span>
                <strong>${stat.wins}V · ${stat.losses}D · ${stat.draws}N</strong>
                <small>${stat.played} parties • série ${stat.currentStreak} • record ${stat.bestStreak}</small>
            </article>
        `;
    }

    function openProfile() {
        const profile = data.getProfile();
        content.innerHTML = `
            <span class="home-modal-kicker">PROFIL LOCAL</span>
            <h2 id="home-modal-title">Votre profil</h2>
            <p class="home-modal-lead">Votre pseudo et votre style sont réutilisés automatiquement, mais restent modifiables avant chaque partie.</p>

            <label class="profile-field">
                <span>PSEUDO</span>
                <input id="profile-name" maxlength="18" autocomplete="nickname" value="${profile.name.replace(/&/g, "&amp;").replace(/\"/g, "&quot;")}" placeholder="Joueur 1">
            </label>

            <div class="profile-grid">
                <label class="profile-field">
                    <span>STYLE DU SYMBOLE</span>
                    <select id="profile-style">
                        <option value="classic">Classique</option>
                        <option value="neon">Néon</option>
                        <option value="electric">Électrique</option>
                        <option value="minimal">Minimal</option>
                        <option value="holographic">Holographique</option>
                        <option value="glitch">Glitch</option>
                        <option value="plasma">Plasma</option>
                        <option value="crystal">Cristal</option>
                        <option value="energy">Énergie</option>
                        <option value="cyber">Cyber</option>
                        <option value="glow">Glow</option>
                        <option value="shadow">Ombre</option>
                    </select>
                </label>
                <label class="profile-field">
                    <span>COULEUR X</span>
                    <select id="profile-x-theme">
                        <option value="blue">Bleu</option>
                        <option value="lightblue">Bleu clair</option>
                        <option value="cyan">Cyan</option>
                        <option value="purple">Violet</option>
                        <option value="green">Vert</option>
                        <option value="turquoise">Turquoise</option>
                        <option value="white">Blanc</option>
                        <option value="gold">Or</option>
                        <option value="orange">Orange</option>
                        <option value="red">Rouge</option>
                    </select>
                </label>
                <label class="profile-field">
                    <span>COULEUR O</span>
                    <select id="profile-o-theme">
                        <option value="pink">Rose</option>
                        <option value="magenta">Magenta</option>
                        <option value="purple">Violet</option>
                        <option value="red">Rouge</option>
                        <option value="orange">Orange</option>
                        <option value="gold">Or</option>
                        <option value="cyan">Cyan</option>
                        <option value="turquoise">Turquoise</option>
                        <option value="white">Blanc</option>
                        <option value="green">Vert</option>
                    </select>
                </label>
            </div>

            <div class="symbol-preview-row" aria-label="Aperçu des symboles">
                <span id="preview-x" class="symbol-preview mark-x">X</span>
                <span id="preview-o" class="symbol-preview mark-o">O</span>
            </div>

            <div class="profile-stats">
                ${statCard("GLOBAL", profile.stats.overall)}
                ${statCard("LOCAL", profile.stats.local)}
                ${statCard("IA", profile.stats.ai)}
                ${statCard("MULTI", profile.stats.multi)}
            </div>

            <button id="save-profile" class="home-modal-primary" type="button">ENREGISTRER</button>
        `;

        const style = content.querySelector("#profile-style");
        const xTheme = content.querySelector("#profile-x-theme");
        const oTheme = content.querySelector("#profile-o-theme");
        style.value = profile.symbolStyle;
        xTheme.value = profile.xTheme;
        oTheme.value = profile.oTheme;

        const refreshPreview = () => {
            const x = content.querySelector("#preview-x");
            const o = content.querySelector("#preview-o");
            data.applyElementCosmetic(x, "X", { style: style.value, theme: xTheme.value });
            data.applyElementCosmetic(o, "O", { style: style.value, theme: oTheme.value });
        };
        style.addEventListener("change", refreshPreview);
        xTheme.addEventListener("change", refreshPreview);
        oTheme.addEventListener("change", refreshPreview);
        refreshPreview();

        content.querySelector("#save-profile").addEventListener("click", () => {
            data.saveProfile({
                name: content.querySelector("#profile-name").value,
                symbolStyle: style.value,
                xTheme: xTheme.value,
                oTheme: oTheme.value
            });
            content.querySelector("#save-profile").textContent = "ENREGISTRÉ ✓";
            setTimeout(closeModal, 550);
        });

        overlay.hidden = false;
    }

    function modeLabel(mode) {
        return mode === "ai" ? "VS IA" : mode === "multi" ? "MULTIJOUEUR" : "LOCAL";
    }

    function resultLabel(result) {
        return result === "win" ? "Victoire" : result === "loss" ? "Défaite" : "Match nul";
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Date inconnue";
        return new Intl.DateTimeFormat("fr-BE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        }).format(date);
    }

    function openStoredReplay(entry) {
        if (!Array.isArray(entry.rounds) || entry.rounds.length === 0) return;
        const lastRound = entry.rounds[entry.rounds.length - 1];
        const playerOneSymbol = entry.playerOneSymbol === "O" ? "O" : "X";
        const playerTwoSymbol = playerOneSymbol === "X" ? "O" : "X";
        const mode = entry.mode === "ai" ? "ai" : "local";

        sessionStorage.setItem("tttPreparationState", JSON.stringify({
            step: "rules",
            gameMode: mode,
            boardSize: entry.boardSize,
            bestOf: entry.bestOf,
            turnTime: 0,
            difficulty: entry.difficulty || "normal",
            localPlayer1Name: entry.playerOneName,
            localPlayer2Name: entry.playerTwoName,
            aiPlayerName: entry.playerOneName,
            aiOpponentName: entry.playerTwoName,
            player1Symbol: playerOneSymbol,
            player2Symbol: playerTwoSymbol,
            aiPlayerSymbol: playerOneSymbol
        }));

        sessionStorage.setItem("tttMatchState", JSON.stringify({
            boardSize: entry.boardSize,
            gameBoard: Array.isArray(lastRound.board) ? lastRound.board : [],
            currentLocalPlayer: 1,
            isAiThinking: false,
            gameFinished: true,
            resultScored: true,
            moveHistory: Array.isArray(lastRound.moves) ? lastRound.moves : [],
            finalBoard: Array.isArray(lastRound.board) ? lastRound.board : [],
            scores: { player1: entry.scoreOne, player2: entry.scoreTwo, draw: entry.draws || 0 },
            bestOf: entry.bestOf,
            winsRequired: Math.ceil(entry.bestOf / 2),
            roundNumber: entry.roundsPlayed,
            matchFinished: true,
            nextRoundStarterSymbol: null,
            roundsHistory: entry.rounds,
            isReplayMode: false,
            replayPosition: 0,
            replayMode: "action",
            resultPopupVisible: false,
            endActionsVisible: true,
            resultTitleText: "REPLAY DU MATCH",
            resultMessageText: `${entry.playerOneName} VS ${entry.playerTwoName}`,
            resultIconText: "▶",
            resultKickerText: "HISTORIQUE"
        }));
        sessionStorage.setItem("tttResumeMatch", "1");
        sessionStorage.setItem("tttOpenReplay", "1");
        location.href = "../game.html";
    }

    function openHistory() {
        const history = data.getHistory();
        const entries = history.length
            ? history.map((entry, index) => `
                <article class="history-entry">
                    <div class="history-main">
                        <span class="history-mode">${modeLabel(entry.mode)} • ${entry.boardSize}×${entry.boardSize} • BO${entry.bestOf}</span>
                        <strong>${entry.playerOneName} <b>${entry.scoreOne}</b> — <b>${entry.scoreTwo}</b> ${entry.playerTwoName}</strong>
                        <small>${resultLabel(entry.result)} • ${formatDate(entry.date)}</small>
                    </div>
                    ${entry.rounds?.length ? `<button class="history-replay" type="button" data-history-index="${index}">▶ REPLAY</button>` : ""}
                </article>
            `).join("")
            : `<div class="history-empty">Aucune partie enregistrée pour le moment.</div>`;

        content.innerHTML = `
            <span class="home-modal-kicker">50 DERNIERS MATCHS</span>
            <h2 id="home-modal-title">Historique</h2>
            <p class="home-modal-lead">Les résultats sont conservés uniquement sur cet appareil.</p>
            <div class="history-list">${entries}</div>
            ${history.length ? `<button id="clear-history" class="home-modal-danger" type="button">EFFACER L'HISTORIQUE</button>` : ""}
        `;

        content.querySelectorAll("[data-history-index]").forEach(button => {
            button.addEventListener("click", () => openStoredReplay(history[Number(button.dataset.historyIndex)]));
        });
        content.querySelector("#clear-history")?.addEventListener("click", () => {
            if (confirm("Effacer tout l'historique local ?")) {
                data.clearHistory();
                openHistory();
            }
        });
        overlay.hidden = false;
    }

    profileButton?.addEventListener("click", openProfile);
    historyButton?.addEventListener("click", openHistory);
})();
