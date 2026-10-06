const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class FakeElement {
    constructor(id = '') {
        this.id = id;
        this.textContent = '';
        this.innerHTML = '';
        this.style = {};
        this.listeners = {};
        this.disabled = false;
    }

    addEventListener(type, callback) {
        (this.listeners[type] ||= []).push(callback);
    }

    click() {
        if (this.disabled) return;
        for (const callback of this.listeners.click || []) {
            callback({ target: this });
        }
    }
}

function createStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        }
    };
}

function loadGame(preparationState) {
    const elements = new Map();
    const ids = [
        'gamepage', 'turn-player', 'result-popup', 'result-title',
        'result-message', 'result-icon', 'restart-button', 'replay-button',
        'home-button', 'back-button', 'settings-button', 'score-x',
        'score-o', 'score-draw'
    ];

    for (const id of ids) elements.set(id, new FakeElement(id));

    const cells = Array.from({ length: 9 }, (_, index) => {
        const cell = new FakeElement(`cell${index}`);
        elements.set(cell.id, cell);
        return cell;
    });

    const document = {
        getElementById(id) {
            return elements.get(id) || null;
        },
        querySelectorAll(selector) {
            if (selector === '.cell') return cells;
            return [];
        }
    };

    const context = {
        document,
        window: {},
        sessionStorage: createStorage({
            tttPreparationState: JSON.stringify(preparationState)
        }),
        localStorage: createStorage(),
        console: { log() {}, warn() {}, error() {} },
        Math,
        setTimeout(callback) {
            callback();
            return 1;
        },
        clearTimeout() {},
        location: { href: '' }
    };

    vm.createContext(context);
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'gamepage.js'),
        'utf8'
    );
    vm.runInContext(source, context);

    return { context, cells, elements };
}

test('contre IA: un clic joueur déclenche automatiquement un coup IA', () => {
    const { cells } = loadGame({
        gameMode: 'ai',
        difficulty: 'god',
        aiPlayerSymbol: 'X'
    });

    cells[0].click();

    const played = cells.filter(cell => cell.textContent !== '');
    assert.equal(played.length, 2);
    assert.equal(cells[0].textContent, 'X');
    assert.ok(played.some(cell => cell.textContent === 'O'));
});

test('si le joueur choisit O, l IA joue X en premier', () => {
    const { cells } = loadGame({
        gameMode: 'ai',
        difficulty: 'normal',
        aiPlayerSymbol: 'O'
    });

    const played = cells.filter(cell => cell.textContent !== '');
    assert.equal(played.length, 1);
    assert.equal(played[0].textContent, 'X');
});

test('les quatre niveaux IA sont disponibles', () => {
    const { context } = loadGame({
        gameMode: 'ai',
        difficulty: 'easy',
        aiPlayerSymbol: 'X'
    });

    assert.equal(typeof context.iaFacile, 'function');
    assert.equal(typeof context.iaNormale, 'function');
    assert.equal(typeof context.iaDifficile, 'function');
    assert.equal(typeof context.iaGod, 'function');
});

test('IA normale bloque une victoire immédiate du joueur', () => {
    const { context } = loadGame({ gameMode: 'local' });
    const board = ['X', 'X', '', '', 'O', '', '', '', ''];
    assert.equal(context.iaNormale(board, 'O', 'X'), 2);
});

test('IA GOD choisit un coup qui empêche une défaite immédiate', () => {
    const { context } = loadGame({ gameMode: 'local' });
    const board = ['X', 'X', '', '', 'O', '', '', '', ''];
    assert.equal(context.iaGod(board, 'O', 'X'), 2);
});

test('la difficulté sélectionnée change réellement le coup de l IA', () => {
    const originalRandom = Math.random;
    Math.random = () => 0;

    try {
        const easy = loadGame({
            gameMode: 'ai',
            difficulty: 'easy',
            aiPlayerSymbol: 'X'
        });
        easy.cells[0].click();
        assert.equal(easy.cells[1].textContent, 'O');

        const normal = loadGame({
            gameMode: 'ai',
            difficulty: 'normal',
            aiPlayerSymbol: 'X'
        });
        normal.cells[0].click();
        assert.equal(normal.cells[4].textContent, 'O');
    } finally {
        Math.random = originalRandom;
    }
});
