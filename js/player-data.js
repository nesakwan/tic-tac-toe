(function initTTTPlayerData(root) {
    const PROFILE_KEY = "tttLocalProfileV1";
    const HISTORY_KEY = "tttMatchHistoryV1";
    const MAX_HISTORY = 50;

    const DEFAULT_PROFILE = {
        name: "",
        symbolStyle: "classic",
        xTheme: "blue",
        oTheme: "pink",
        stats: {
            overall: emptyStats(),
            local: emptyStats(),
            ai: emptyStats(),
            multi: emptyStats()
        }
    };

    const VALID_STYLES = new Set([
        "classic", "neon", "electric", "minimal", "holographic", "glitch",
        "plasma", "crystal", "energy", "cyber", "glow", "shadow"
    ]);
    const VALID_X_THEMES = new Set([
        "blue", "lightblue", "cyan", "purple", "green", "turquoise",
        "white", "gold", "orange", "red"
    ]);
    const VALID_O_THEMES = new Set([
        "pink", "magenta", "purple", "red", "orange", "gold",
        "cyan", "turquoise", "white", "green"
    ]);

    function emptyStats() {
        return {
            played: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            currentStreak: 0,
            bestStreak: 0
        };
    }

    function safeJSON(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); }
        catch (_) { return fallback; }
    }

    function sanitizeName(value) {
        return String(value || "")
            .replace(/[<>]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 18);
    }

    function normalizeStats(source) {
        const base = emptyStats();
        if (!source || typeof source !== "object") return base;
        for (const key of Object.keys(base)) {
            base[key] = Math.max(0, Number(source[key]) || 0);
        }
        return base;
    }

    function normalizeProfile(profile) {
        const source = profile && typeof profile === "object" ? profile : {};
        const stats = source.stats && typeof source.stats === "object" ? source.stats : {};
        return {
            name: sanitizeName(source.name),
            symbolStyle: VALID_STYLES.has(source.symbolStyle) ? source.symbolStyle : "classic",
            xTheme: VALID_X_THEMES.has(source.xTheme) ? source.xTheme : "blue",
            oTheme: VALID_O_THEMES.has(source.oTheme) ? source.oTheme : "pink",
            stats: {
                overall: normalizeStats(stats.overall),
                local: normalizeStats(stats.local),
                ai: normalizeStats(stats.ai),
                multi: normalizeStats(stats.multi)
            }
        };
    }

    function getProfile() {
        return normalizeProfile(safeJSON(localStorage.getItem(PROFILE_KEY), DEFAULT_PROFILE));
    }

    function saveProfile(next) {
        const current = getProfile();
        const merged = normalizeProfile({
            ...current,
            ...(next || {}),
            stats: current.stats
        });
        localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
        return merged;
    }

    function getHistory() {
        const history = safeJSON(localStorage.getItem(HISTORY_KEY), []);
        return Array.isArray(history) ? history.slice(0, MAX_HISTORY) : [];
    }

    function updateStats(profile, mode, result) {
        const keys = ["overall", ["local", "ai", "multi"].includes(mode) ? mode : "local"];
        for (const key of keys) {
            const stats = profile.stats[key] || emptyStats();
            stats.played += 1;
            if (result === "win") {
                stats.wins += 1;
                stats.currentStreak += 1;
                stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
            } else if (result === "loss") {
                stats.losses += 1;
                stats.currentStreak = 0;
            } else {
                stats.draws += 1;
                stats.currentStreak = 0;
            }
            profile.stats[key] = stats;
        }
    }

    function recordMatch(entry) {
        if (!entry || typeof entry !== "object") return null;
        const history = getHistory();
        const externalId = String(entry.externalId || "");
        if (externalId && history.some(item => String(item.externalId || "") === externalId)) {
            return history.find(item => String(item.externalId || "") === externalId) || null;
        }

        const normalized = {
            id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            externalId,
            date: entry.date || new Date().toISOString(),
            mode: ["local", "ai", "multi"].includes(entry.mode) ? entry.mode : "local",
            result: ["win", "loss", "draw"].includes(entry.result) ? entry.result : "draw",
            playerOneName: sanitizeName(entry.playerOneName) || "Joueur 1",
            playerTwoName: sanitizeName(entry.playerTwoName) || "Joueur 2",
            playerOneSymbol: entry.playerOneSymbol === "O" ? "O" : "X",
            playerTwoSymbol: entry.playerTwoSymbol === "X" ? "X" : "O",
            scoreOne: Math.max(0, Number(entry.scoreOne) || 0),
            scoreTwo: Math.max(0, Number(entry.scoreTwo) || 0),
            draws: Math.max(0, Number(entry.draws) || 0),
            boardSize: Number(entry.boardSize) === 4 ? 4 : 3,
            bestOf: [1, 3, 5].includes(Number(entry.bestOf)) ? Number(entry.bestOf) : 1,
            roundsPlayed: Math.max(1, Number(entry.roundsPlayed) || 1),
            endReason: String(entry.endReason || "victory"),
            difficulty: String(entry.difficulty || ""),
            rounds: Array.isArray(entry.rounds)
                ? entry.rounds.map(round => ({
                    round: Math.max(1, Number(round.round) || 1),
                    winner: round.winner === "X" || round.winner === "O" ? round.winner : null,
                    board: Array.isArray(round.board) ? [...round.board] : [],
                    moves: Array.isArray(round.moves)
                        ? round.moves.map(move => ({
                            index: Number(move.index),
                            symbol: move.symbol === "O" ? "O" : "X",
                            actor: move.actor || null
                        })).filter(move => Number.isInteger(move.index))
                        : []
                }))
                : []
        };

        history.unshift(normalized);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));

        const profile = getProfile();
        updateStats(profile, normalized.mode, normalized.result);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        return normalized;
    }

    function clearHistory() {
        localStorage.removeItem(HISTORY_KEY);
    }

    function cosmeticForSymbol(profileOrNull, symbol) {
        const profile = normalizeProfile(profileOrNull || getProfile());
        const normalizedSymbol = symbol === "O" ? "O" : "X";
        return {
            style: profile.symbolStyle,
            theme: normalizedSymbol === "X" ? profile.xTheme : profile.oTheme
        };
    }

    function normalizeCosmetic(cosmetic, symbol = "X") {
        const style = VALID_STYLES.has(cosmetic?.style) ? cosmetic.style : "classic";
        const allowedThemes = symbol === "O" ? VALID_O_THEMES : VALID_X_THEMES;
        const fallbackTheme = symbol === "O" ? "pink" : "blue";
        const theme = allowedThemes.has(cosmetic?.theme) ? cosmetic.theme : fallbackTheme;
        return { style, theme };
    }

    function applyElementCosmetic(element, symbol, cosmetic) {
        if (!element?.dataset) return;
        const normalized = normalizeCosmetic(cosmetic || cosmeticForSymbol(getProfile(), symbol), symbol);
        element.dataset.symbolStyle = normalized.style;
        element.dataset.symbolTheme = normalized.theme;
    }

    root.TTTPlayerData = Object.freeze({
        PROFILE_KEY,
        HISTORY_KEY,
        MAX_HISTORY,
        sanitizeName,
        getProfile,
        saveProfile,
        getHistory,
        recordMatch,
        clearHistory,
        cosmeticForSymbol,
        normalizeCosmetic,
        applyElementCosmetic
    });
})(globalThis);
