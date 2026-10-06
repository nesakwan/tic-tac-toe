// ==========================================================
// TIC TAC TOE — MUSIQUE DE FOND PARTAGÉE ENTRE LES PAGES
// ==========================================================

(() => {
    const SETTINGS_STORAGE_KEY = "tttSettings";
    const MUSIC_STATE_KEY = "tttMusicState";
    const MUSIC_OWNER_KEY = "tttMusicOwner";

    const DEFAULT_SETTINGS = {
        soundEnabled: true,
        volume: 70,
        language: "fr"
    };

    const scriptElement = document.currentScript;
    const musicSrc = scriptElement?.dataset?.musicSrc;

    if (!musicSrc) {
        console.warn("Source de musique manquante (data-music-src).");
        return;
    }

    function readJSON(storage, key, fallback) {
        const raw = storage.getItem(key);
        if (!raw) return fallback;

        try {
            return JSON.parse(raw) || fallback;
        } catch (error) {
            console.warn(`Impossible de lire ${key}.`, error);
            return fallback;
        }
    }

    function normalizeSettings(value = {}) {
        const volume = Number(value.volume);

        return {
            soundEnabled:
                typeof value.soundEnabled === "boolean"
                    ? value.soundEnabled
                    : DEFAULT_SETTINGS.soundEnabled,
            volume:
                Number.isFinite(volume)
                    ? Math.min(100, Math.max(0, volume))
                    : DEFAULT_SETTINGS.volume,
            language: value.language || DEFAULT_SETTINGS.language
        };
    }

    function createInstanceId() {
        if (globalThis.crypto?.randomUUID) {
            return globalThis.crypto.randomUUID();
        }

        return `ttt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const instanceId = createInstanceId();
    let settings = normalizeSettings(
        readJSON(localStorage, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS)
    );

    const savedMusicState = readJSON(
        sessionStorage,
        MUSIC_STATE_KEY,
        null
    );

    const audio = new Audio(musicSrc);
    audio.loop = true;
    audio.preload = "auto";

    let pendingResumeTime = 0;
    let gestureFallbackArmed = false;
    let destroyed = false;

    function calculateResumeTime() {
        if (!savedMusicState) return 0;

        let position = Number(savedMusicState.currentTime) || 0;
        const savedAt = Number(savedMusicState.savedAt) || Date.now();

        if (savedMusicState.wasPlaying && settings.soundEnabled) {
            position += Math.max(0, (Date.now() - savedAt) / 1000);
        }

        return Math.max(0, position);
    }

    function applyResumeTime() {
        let position = pendingResumeTime;

        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            position %= audio.duration;
        }

        try {
            audio.currentTime = position;
        } catch (error) {
            console.warn("Impossible de restaurer la position de la musique.", error);
        }
    }

    function saveMusicState() {
        try {
            sessionStorage.setItem(
                MUSIC_STATE_KEY,
                JSON.stringify({
                    currentTime: Number(audio.currentTime) || 0,
                    savedAt: Date.now(),
                    wasPlaying: settings.soundEnabled && !audio.paused
                })
            );
        } catch (error) {
            console.warn("Impossible d'enregistrer l'état de la musique.", error);
        }
    }

    function readOwnerId() {
        try {
            const owner = readJSON(localStorage, MUSIC_OWNER_KEY, null);
            return owner?.id || null;
        } catch {
            return null;
        }
    }

    function isOwner() {
        return readOwnerId() === instanceId;
    }

    function claimOwnership() {
        if (destroyed || !settings.soundEnabled) return false;

        try {
            localStorage.setItem(
                MUSIC_OWNER_KEY,
                JSON.stringify({
                    id: instanceId,
                    claimedAt: Date.now()
                })
            );
            return true;
        } catch (error) {
            // Si le stockage est indisponible, on retombe sur le comportement local.
            console.warn("Impossible de synchroniser la musique entre les onglets.", error);
            return true;
        }
    }

    function releaseOwnership() {
        if (!isOwner()) return;

        try {
            localStorage.removeItem(MUSIC_OWNER_KEY);
        } catch (error) {
            console.warn("Impossible de libérer le contrôle de la musique.", error);
        }
    }

    function removeGestureFallback() {
        if (!gestureFallbackArmed) return;

        document.removeEventListener?.("pointerdown", resumeAfterGesture);
        document.removeEventListener?.("keydown", resumeAfterGesture);
        document.removeEventListener?.("touchstart", resumeAfterGesture);
        gestureFallbackArmed = false;
    }

    function resumeAfterGesture() {
        removeGestureFallback();
        activateThisPage();
    }

    function armGestureFallback() {
        if (gestureFallbackArmed || !settings.soundEnabled || !isOwner()) return;

        gestureFallbackArmed = true;
        document.addEventListener("pointerdown", resumeAfterGesture, { once: true });
        document.addEventListener("keydown", resumeAfterGesture, { once: true });
        document.addEventListener("touchstart", resumeAfterGesture, { once: true });
    }

    function pauseAudio({ save = true } = {}) {
        audio.pause();
        removeGestureFallback();
        if (save) saveMusicState();
    }

    function attemptPlay() {
        if (destroyed || !settings.soundEnabled || !isOwner()) {
            pauseAudio({ save: false });
            return;
        }

        // play() sur une piste déjà en cours n'apporte rien et pouvait être
        // rappelé à chaque mouvement du slider de volume.
        if (!audio.paused) return;

        const playResult = audio.play();

        if (playResult && typeof playResult.catch === "function") {
            playResult.catch(() => {
                armGestureFallback();
            });
        }
    }

    function activateThisPage() {
        if (!settings.soundEnabled) return;
        claimOwnership();
        attemptPlay();
    }

    function syncOwnership() {
        if (!settings.soundEnabled) {
            pauseAudio();
            return;
        }

        if (isOwner()) {
            attemptPlay();
        } else {
            pauseAudio();
        }
    }

    function applySettings(nextSettings, { claimIfActive = false } = {}) {
        settings = normalizeSettings(nextSettings);
        audio.volume = settings.volume / 100;

        if (!settings.soundEnabled) {
            pauseAudio();
            releaseOwnership();
            return;
        }

        if (claimIfActive) {
            activateThisPage();
            return;
        }

        // Important : une modification provenant d'un autre onglet ne doit
        // jamais relancer la musique dans cet onglet si celui-ci n'est pas propriétaire.
        syncOwnership();
    }

    function pageIsVisible() {
        return typeof document.visibilityState !== "string"
            || document.visibilityState === "visible";
    }

    function pageHasFocus() {
        return typeof document.hasFocus !== "function" || document.hasFocus();
    }

    function handleUserActivity() {
        if (!settings.soundEnabled) return;

        if (!isOwner()) {
            claimOwnership();
        }

        // Si l'autoplay a été bloqué, le listener one-shot dédié s'occupe
        // du prochain play(). Cela évite deux play() sur le même clic.
        if (!gestureFallbackArmed) {
            attemptPlay();
        }
    }

    function handleVisibilityChange() {
        if (document.visibilityState === "hidden") {
            pauseAudio();
            releaseOwnership();
            return;
        }

        if (settings.soundEnabled) activateThisPage();
    }

    function handlePageHide() {
        saveMusicState();
        pauseAudio({ save: false });
        releaseOwnership();
        destroyed = true;
    }

    pendingResumeTime = calculateResumeTime();
    audio.volume = settings.volume / 100;

    if (audio.readyState >= 1) {
        applyResumeTime();
    } else {
        audio.addEventListener("loadedmetadata", applyResumeTime, { once: true });
    }

    audio.addEventListener("timeupdate", saveMusicState);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", () => {
        destroyed = false;
        if (settings.soundEnabled && pageIsVisible() && pageHasFocus()) {
            activateThisPage();
        }
    });
    window.addEventListener("beforeunload", saveMusicState);
    window.addEventListener("focus", activateThisPage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("pointerdown", handleUserActivity, { passive: true });
    document.addEventListener("keydown", handleUserActivity);

    window.addEventListener("ttt-settings-changed", (event) => {
        // Cet événement vient de la page actuelle : elle peut devenir propriétaire.
        applySettings(event.detail || {}, { claimIfActive: true });
    });

    window.addEventListener("storage", (event) => {
        if (event.key === MUSIC_OWNER_KEY) {
            syncOwnership();
            return;
        }

        if (event.key !== SETTINGS_STORAGE_KEY || !event.newValue) return;

        try {
            // Changement d'un autre onglet : mise à jour du volume/son sans prendre la main.
            applySettings(JSON.parse(event.newValue), { claimIfActive: false });
        } catch (error) {
            console.warn("Paramètres audio invalides.", error);
        }
    });

    // Petit accès pratique pour le débogage dans la console du navigateur.
    window.tttMusic = {
        audio,
        instanceId,
        applySettings,
        saveMusicState,
        activateThisPage,
        isOwner,
        releaseOwnership
    };

    if (settings.soundEnabled) {
        const ownerId = readOwnerId();

        // Une page visible et active peut prendre la main. Une page de fond ne
        // démarre pas toute seule, ce qui évite plusieurs musiques superposées.
        if (!ownerId || (pageIsVisible() && pageHasFocus())) {
            activateThisPage();
        } else {
            syncOwnership();
        }
    }
})();
