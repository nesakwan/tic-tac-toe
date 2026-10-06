const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(...names) {
        names.forEach(name => this.values.add(name));
    }

    remove(...names) {
        names.forEach(name => this.values.delete(name));
    }

    contains(name) {
        return this.values.has(name);
    }

    toggle(name, force) {
        if (force === true) {
            this.values.add(name);
            return true;
        }
        if (force === false) {
            this.values.delete(name);
            return false;
        }
        if (this.values.has(name)) {
            this.values.delete(name);
            return false;
        }
        this.values.add(name);
        return true;
    }
}

class FakeElement {
    constructor(id = '') {
        this.id = id;
        this.textContent = '';
        this.innerHTML = '';
        this.style = {};
        this.listeners = {};
        this.disabled = false;
        this.checked = false;
        this.value = '';
        this.dataset = {};
        this.classList = new FakeClassList();
    }

    addEventListener(type, callback) {
        (this.listeners[type] ||= []).push(callback);
    }

    dispatch(type) {
        for (const callback of this.listeners[type] || []) {
            callback({ target: this });
        }
    }

    click() {
        if (this.disabled) return;
        this.dispatch('click');
    }

    change() {
        this.dispatch('change');
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

function loadGame(preparationState, options = {}) {
    const elements = new Map();
    const ids = [
        'gamepage', 'turn-player', 'result-popup', 'result-title',
        'result-message', 'result-icon', 'restart-button', 'replay-button',
        'home-button', 'back-button', 'settings-button', 'score-x',
        'score-o', 'score-draw',
        'close-result-button', 'popup-restart-button', 'popup-replay-button',
        'change-mode-button', 'end-actions', 'end-replay-button',
        'end-restart-button', 'end-change-mode-button', 'replay-panel',
        'replay-mode-action', 'replay-mode-turn', 'replay-start-button',
        'replay-prev-button', 'replay-progress', 'replay-next-button',
        'replay-end-button', 'replay-exit-button'
    ];

    for (const id of ids) elements.set(id, new FakeElement(id));

    elements.get('replay-mode-action').value = 'action';
    elements.get('replay-mode-action').checked = true;
    elements.get('replay-mode-turn').value = 'turn';

    const cells = Array.from({ length: 9 }, (_, index) => {
        const cell = new FakeElement(`cell${index}`);
        cell.dataset.index = String(index);
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

    const sessionStorage = createStorage({
        tttPreparationState: JSON.stringify(preparationState)
    });
    const localStorage = createStorage(options.localStorage || {});

    const context = {
        document,
        window: {},
        sessionStorage,
        localStorage,
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

    function evaluate(expression) {
        return vm.runInContext(expression, context);
    }

    return {
        context,
        cells,
        elements,
        sessionStorage,
        localStorage,
        evaluate
    };
}

function finishLocalWin(game) {
    // X gagne sur la première ligne.
    [0, 3, 1, 4, 2].forEach(index => game.cells[index].click());
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

test('chaque vrai coup local est enregistré une seule fois dans l historique', () => {
    const game = loadGame({ gameMode: 'local' });

    game.cells[0].click();
    game.cells[3].click();

    const history = game.evaluate('moveHistory.map(move => ({...move}))');
    assert.deepEqual(JSON.parse(JSON.stringify(history)), [
        { index: 0, symbol: 'X', actor: 'player1' },
        { index: 3, symbol: 'O', actor: 'player2' }
    ]);
});

test('chaque vrai coup IA est enregistré une seule fois dans l historique', () => {
    const game = loadGame({
        gameMode: 'ai',
        difficulty: 'normal',
        aiPlayerSymbol: 'X'
    });

    game.cells[0].click();

    const history = game.evaluate('moveHistory.map(move => ({...move}))');
    assert.equal(history.length, 2);
    assert.equal(history[0].actor, 'human');
    assert.equal(history[1].actor, 'ai');
});

test('les simulations Minimax ne polluent jamais l historique', () => {
    const game = loadGame({ gameMode: 'local' });
    const board = ['X', '', '', '', 'O', '', '', '', ''];

    game.context.iaGod(board, 'O', 'X');
    game.context.iaDifficile(board, 'O', 'X');

    assert.equal(game.evaluate('moveHistory.length'), 0);
});

test('fermer le résultat garde le plateau final bloqué et affiche les actions de fin', () => {
    const game = loadGame({ gameMode: 'local' });
    finishLocalWin(game);

    const finalState = game.cells.map(cell => cell.textContent);
    assert.equal(game.elements.get('result-popup').style.display, 'flex');

    game.elements.get('close-result-button').click();

    assert.equal(game.elements.get('result-popup').style.display, 'none');
    assert.equal(game.elements.get('end-actions').style.display, 'flex');

    game.cells[8].click();
    assert.deepEqual(game.cells.map(cell => cell.textContent), finalState);
});

test('replay action par action reconstruit exactement un coup à chaque suivant', () => {
    const game = loadGame({ gameMode: 'local' });
    finishLocalWin(game);

    game.elements.get('popup-replay-button').click();
    assert.deepEqual(game.cells.map(cell => cell.textContent), Array(9).fill(''));

    game.elements.get('replay-next-button').click();
    assert.equal(game.cells[0].textContent, 'X');
    assert.equal(game.cells.filter(cell => cell.textContent !== '').length, 1);

    game.elements.get('replay-next-button').click();
    assert.equal(game.cells[3].textContent, 'O');
    assert.equal(game.cells.filter(cell => cell.textContent !== '').length, 2);
});

test('replay tour par tour avance par paire et accepte un dernier coup impair', () => {
    const game = loadGame({ gameMode: 'local' });
    finishLocalWin(game); // 5 coups

    game.elements.get('popup-replay-button').click();
    game.elements.get('replay-mode-action').checked = false;
    game.elements.get('replay-mode-turn').checked = true;
    game.elements.get('replay-mode-turn').change();

    game.elements.get('replay-next-button').click();
    assert.equal(game.cells.filter(cell => cell.textContent !== '').length, 2);
    assert.equal(game.cells[0].textContent, 'X');
    assert.equal(game.cells[3].textContent, 'O');

    game.elements.get('replay-end-button').click();
    assert.equal(game.cells.filter(cell => cell.textContent !== '').length, 5);
    assert.equal(game.cells[2].textContent, 'X');
});

test('quitter le replay restaure immédiatement le plateau final sans rouvrir la popup', () => {
    const game = loadGame({ gameMode: 'local' });
    finishLocalWin(game);
    const finalState = game.cells.map(cell => cell.textContent);

    game.elements.get('popup-replay-button').click();
    game.elements.get('replay-next-button').click();
    game.elements.get('replay-exit-button').click();

    assert.deepEqual(game.cells.map(cell => cell.textContent), finalState);
    assert.equal(game.elements.get('result-popup').style.display, 'none');
    assert.equal(game.elements.get('end-actions').style.display, 'flex');
});

test('rejouer vide l historique et démarre une nouvelle partie avec la même configuration', () => {
    const game = loadGame({ gameMode: 'local' });
    finishLocalWin(game);
    assert.equal(game.evaluate('moveHistory.length'), 5);

    game.elements.get('popup-restart-button').click();

    assert.equal(game.evaluate('moveHistory.length'), 0);
    assert.deepEqual(game.cells.map(cell => cell.textContent), Array(9).fill(''));
    assert.equal(game.elements.get('result-popup').style.display, 'none');
    assert.equal(game.elements.get('end-actions').style.display, 'none');
});

test('rejouer contre IA avec O fait recommencer automatiquement l IA en X', () => {
    const game = loadGame({
        gameMode: 'ai',
        difficulty: 'normal',
        aiPlayerSymbol: 'O'
    });

    game.context.resetGame();

    const played = game.cells.filter(cell => cell.textContent !== '');
    assert.equal(played.length, 1);
    assert.equal(played[0].textContent, 'X');
    assert.equal(game.evaluate('moveHistory.length'), 1);
});

test('changer de mode efface seulement la préparation et revient à étape 1', () => {
    const game = loadGame(
        { gameMode: 'local', player1Symbol: 'X', player2Symbol: 'O' },
        { localStorage: { theme: 'purple', volume: '70' } }
    );
    finishLocalWin(game);

    game.elements.get('change-mode-button').click();

    assert.equal(game.sessionStorage.getItem('tttPreparationState'), null);
    assert.equal(game.localStorage.getItem('theme'), 'purple');
    assert.equal(game.localStorage.getItem('volume'), '70');
    assert.equal(game.context.location.href, 'Akatsuki/rencontre.html');
});

test('replay tour par tour revient au tour précédent depuis une fin impaire', () => {
    const game = loadGame({ gameMode: 'local' });
    finishLocalWin(game); // 5 coups

    game.elements.get('popup-replay-button').click();
    game.elements.get('replay-mode-action').checked = false;
    game.elements.get('replay-mode-turn').checked = true;
    game.elements.get('replay-mode-turn').change();
    game.elements.get('replay-end-button').click();

    assert.equal(game.cells.filter(cell => cell.textContent !== '').length, 5);

    game.elements.get('replay-prev-button').click();

    assert.equal(game.cells.filter(cell => cell.textContent !== '').length, 4);
    assert.equal(game.cells[2].textContent, '');
});

test('replay tour par tour garde le premier coup IA seul quand l IA commence', () => {
    const game = loadGame({
        gameMode: 'ai',
        difficulty: 'normal',
        aiPlayerSymbol: 'O'
    });

    // L'IA a joué X. Le joueur répond, puis l'IA répond : 3 actions réelles.
    const freeCell = game.cells.find(cell => cell.textContent === '');
    freeCell.click();
    game.evaluate('gameFinished = true; finalBoard = [...gameBoard]');

    game.context.demarrerReplay();
    game.elements.get('replay-mode-action').checked = false;
    game.elements.get('replay-mode-turn').checked = true;
    game.elements.get('replay-mode-turn').change();
    game.elements.get('replay-next-button').click();

    const shown = game.cells.filter(cell => cell.textContent !== '');
    assert.equal(shown.length, 1);
    assert.equal(shown[0].textContent, 'X');
});
