(function initTTTBoardUI(root) {
    function normalizeSize(value) {
        return Number(value) === 4 ? 4 : 3;
    }

    function buildBoard(container, value, onCellClick = null) {
        if (!container || typeof document?.createElement !== "function") return [];

        const size = normalizeSize(value);
        const count = size * size;

        container.innerHTML = "";
        container.style?.setProperty?.("--board-size", String(size));
        container.classList?.toggle?.("board-4x4", size === 4);

        const cells = [];
        for (let index = 0; index < count; index++) {
            const cell = document.createElement("button");
            cell.id = `cell${index}`;
            cell.className = "cell";
            cell.type = "button";
            cell.dataset.index = String(index);
            cell.setAttribute("aria-label", `Case ${index + 1}`);
            if (typeof onCellClick === "function") {
                cell.addEventListener("click", () => onCellClick(index, cell));
            }
            container.appendChild(cell);
            cells.push(cell);
        }

        return cells;
    }

    function paintCell(cell, symbol, options = {}) {
        if (!cell) return;
        const next = symbol || "";
        const changed = cell.textContent !== next;

        if (changed) {
            cell.textContent = next;
            cell.classList?.remove?.("mark-x", "mark-o");
            if (options.animate !== false) void cell.offsetWidth;
            if (next === "X") cell.classList?.add?.("mark-x");
            if (next === "O") cell.classList?.add?.("mark-o");
        } else {
            if (next === "X") cell.classList?.add?.("mark-x");
            if (next === "O") cell.classList?.add?.("mark-o");
        }

        cell.classList?.toggle?.("winning-cell", Boolean(options.winning));

        if (next === "X" || next === "O") {
            globalThis.TTTPlayerData?.applyElementCosmetic?.(cell, next, options.cosmetic);
        } else if (cell?.dataset) {
            delete cell.dataset.symbolStyle;
            delete cell.dataset.symbolTheme;
        }
    }

    root.TTTBoardUI = Object.freeze({
        normalizeSize,
        buildBoard,
        paintCell
    });
})(globalThis);
