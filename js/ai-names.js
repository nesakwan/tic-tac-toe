// ==========================================================
// TIC TAC TOE — NOMS DES ADVERSAIRES IA
// ==========================================================

(() => {
    const STANDARD_NAMES = [
        "Thome",
        "Olivier",
        "Lucas",
        "Hugo",
        "Noah",
        "Adam",
        "Nolan",
        "Elias",
        "Victor",
        "Axel",
        "Liam",
        "Nathan"
    ];

    const GOD_NAMES = ["Gojo", "Sukuna"];

    function normaliserDifficulte(difficulty) {
        const value = String(difficulty || "normal").toLowerCase();
        return ["easy", "normal", "hard", "god"].includes(value)
            ? value
            : "normal";
    }

    function nomsPourDifficulte(difficulty) {
        return normaliserDifficulte(difficulty) === "god"
            ? GOD_NAMES
            : STANDARD_NAMES;
    }

    function nomValide(name, difficulty) {
        const normalizedName = String(name || "").trim();
        return nomsPourDifficulte(difficulty).includes(normalizedName);
    }

    function genererNom(difficulty, previousName = null, random = Math.random) {
        const pool = nomsPourDifficulte(difficulty);
        const previous = String(previousName || "").trim();
        const candidates = pool.length > 1
            ? pool.filter(name => name !== previous)
            : [...pool];

        const usablePool = candidates.length > 0 ? candidates : pool;
        const randomValue = Number(random());
        const safeRandom = Number.isFinite(randomValue)
            ? Math.min(0.999999999, Math.max(0, randomValue))
            : 0;
        const index = Math.floor(safeRandom * usablePool.length);

        return usablePool[index];
    }

    const api = {
        STANDARD_NAMES: [...STANDARD_NAMES],
        GOD_NAMES: [...GOD_NAMES],
        nomsPourDifficulte,
        nomValide,
        genererNom
    };

    globalThis.TTTAiNames = api;
})();
