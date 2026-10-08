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
        'player-one-name', 'player-one-symbol', 'player-two-name',
        'player-two-symbol', 'player-two-meta', 'replay-action-label',
        'score-player-one', 'score-player-two',
        'score-player-one-name', 'score-player-two-name',
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
        tttPreparationState: JSON.stringify(preparationState),
        ...(options.sessionStorage || {})
    });
    const localStorage = createStorage(options.localStorage || {});

    const context = {
        document,
        window: {},
        sessionStorage,
        localStorage,
        console: { log() { }, warn() { }, error() { } },
        Math,
        setTimeout(callback) {
            callback();
            return 1;
        },
        clearTimeout() { },
        location: { href: '', search: options.locationSearch || '' }
    };

    vm.createContext(context);

    const aiNamesSource = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'ai-names.js'),
        'utf8'
    );
    vm.runInContext(aiNamesSource, context);

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
    assert.equal(game.context.location.href, 'Rencontre/rencontre.html');
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


test('les noms et symboles choisis sont affichés pendant un match local', () => {
    const game = loadGame({
        gameMode: 'local',
        localPlayer1Name: 'Roosevelt',
        localPlayer2Name: 'Jefferson',
        player1Symbol: 'X',
        player2Symbol: 'O'
    });

    assert.equal(game.elements.get('player-one-name').textContent, 'Roosevelt');
    assert.equal(game.elements.get('player-one-symbol').textContent, 'X');
    assert.equal(game.elements.get('player-two-name').textContent, 'Jefferson');
    assert.equal(game.elements.get('player-two-symbol').textContent, 'O');
    assert.match(game.elements.get('turn-player').innerHTML, /Roosevelt/);
});

test('contre IA la fiche adversaire affiche son nom, difficulté et bon symbole', () => {
    const game = loadGame({
        gameMode: 'ai',
        difficulty: 'god',
        aiPlayerName: 'Roosevelt',
        aiOpponentName: 'Gojo',
        aiPlayerSymbol: 'X'
    });

    assert.equal(game.elements.get('player-one-name').textContent, 'Roosevelt');
    assert.equal(game.elements.get('player-two-name').textContent, 'Gojo');
    assert.equal(game.elements.get('player-two-symbol').textContent, 'O');
    assert.match(game.elements.get('player-two-meta').textContent, /GOD/);
});

test('le résultat local annonce le nom et le symbole du gagnant', () => {
    const game = loadGame({
        gameMode: 'local',
        localPlayer1Name: 'Roosevelt',
        localPlayer2Name: 'Jefferson',
        player1Symbol: 'X',
        player2Symbol: 'O'
    });

    finishLocalWin(game);

    assert.equal(game.elements.get('result-title').textContent, 'ROOSEVELT (X) A GAGNÉ !');
    assert.match(game.elements.get('result-message').textContent, /Jefferson/);
});

test('le replay décrit chaque action avec le vrai nom du participant', () => {
    const game = loadGame({
        gameMode: 'local',
        localPlayer1Name: 'Roosevelt',
        localPlayer2Name: 'Jefferson',
        player1Symbol: 'X',
        player2Symbol: 'O'
    });
    finishLocalWin(game);

    game.elements.get('popup-replay-button').click();
    game.elements.get('replay-next-button').click();

    assert.match(game.elements.get('replay-action-label').textContent, /Roosevelt/);
    assert.match(game.elements.get('replay-action-label').textContent, /X/);
});

test('ouvrir les paramètres sauvegarde le match courant et prépare le retour exact', () => {
    const game = loadGame({
        gameMode: 'local',
        localPlayer1Name: 'Roosevelt',
        localPlayer2Name: 'Jefferson',
        player1Symbol: 'X',
        player2Symbol: 'O'
    });

    game.cells[0].click();
    game.cells[4].click();
    game.elements.get('settings-button').click();

    const saved = JSON.parse(game.sessionStorage.getItem('tttMatchState'));
    assert.deepEqual(saved.gameBoard, ['X', '', '', '', 'O', '', '', '', '']);
    assert.equal(saved.moveHistory.length, 2);
    assert.equal(game.sessionStorage.getItem('tttResumeMatch'), '1');
    assert.equal(game.sessionStorage.getItem('tttSettingsReturn'), '../game.html');
    assert.equal(game.context.location.href, 'Parametre/parametre.html?from=game');
});

test('le retour des paramètres restaure grille, tour, historique et scores', () => {
    const matchState = {
        gameBoard: ['X', '', '', '', 'O', '', '', '', ''],
        currentLocalPlayer: 1,
        isAiThinking: false,
        gameFinished: false,
        moveHistory: [
            { index: 0, symbol: 'X', actor: 'player1' },
            { index: 4, symbol: 'O', actor: 'player2' }
        ],
        finalBoard: Array(9).fill(''),
        scores: { player1: 2, player2: 1, draw: 1 },
        isReplayMode: false,
        replayPosition: 0,
        replayMode: 'action'
    };

    const game = loadGame({
        gameMode: 'local',
        localPlayer1Name: 'Roosevelt',
        localPlayer2Name: 'Jefferson',
        player1Symbol: 'X',
        player2Symbol: 'O'
    }, {
        sessionStorage: {
            tttMatchState: JSON.stringify(matchState),
            tttResumeMatch: '1'
        }
    });

    assert.equal(game.cells[0].textContent, 'X');
    assert.equal(game.cells[4].textContent, 'O');
    assert.equal(game.evaluate('moveHistory.length'), 2);
    assert.equal(game.elements.get('score-player-one').textContent, '2');
    assert.equal(game.elements.get('score-player-two').textContent, '1');
    assert.equal(game.elements.get('score-draw').textContent, '1');
    assert.match(game.elements.get('turn-player').innerHTML, /Roosevelt/);
    assert.equal(game.sessionStorage.getItem('tttResumeMatch'), null);
});

test('changer de mode efface aussi l état du match sans toucher aux paramètres globaux', () => {
    const game = loadGame(
        { gameMode: 'local', player1Symbol: 'X', player2Symbol: 'O' },
        {
            localStorage: { tttSettings: JSON.stringify({ volume: 70, language: 'fr' }) },
            sessionStorage: {
                tttMatchState: JSON.stringify({ gameBoard: ['X'] }),
                tttResumeMatch: '1'
            }
        }
    );
    finishLocalWin(game);

    game.elements.get('change-mode-button').click();

    assert.equal(game.sessionStorage.getItem('tttPreparationState'), null);
    assert.equal(game.sessionStorage.getItem('tttMatchState'), null);
    assert.equal(game.sessionStorage.getItem('tttResumeMatch'), null);
    assert.notEqual(game.localStorage.getItem('tttSettings'), null);
});

test('la page paramètres ne contient plus thème, mode sombre ni symbole par défaut', () => {
    const html = fs.readFileSync(
        path.join(__dirname, '..', 'Parametre', 'parametre.html'),
        'utf8'
    );

    assert.doesNotMatch(html, /Mode sombre/i);
    assert.doesNotMatch(html, /Symbole par défaut/i);
    assert.doesNotMatch(html, /name="theme"/i);
    assert.match(html, />\s*Son\s*</i);
    assert.match(html, />\s*Volume\s*</i);
    assert.match(html, />\s*Langue\s*</i);
});

test('les quatre difficultés sélectionnées déclenchent réellement une réponse IA', () => {
    for (const difficulty of ['easy', 'normal', 'hard', 'god']) {
        const game = loadGame({
            gameMode: 'ai',
            difficulty,
            aiPlayerName: 'Roosevelt',
            aiPlayerSymbol: 'X'
        });

        game.cells[0].click();

        const played = game.cells.filter(cell => cell.textContent !== '');
        assert.equal(played.length, 2, `aucune réponse IA correcte pour ${difficulty}`);
        assert.equal(game.cells[0].textContent, 'X');
        assert.ok(played.some(cell => cell.textContent === 'O'));
    }
});

test('une défaite contre IA annonce le nom du bot et utilise le style défaite', () => {
    const game = loadGame({
        gameMode: 'ai',
        difficulty: 'god',
        aiPlayerName: 'Roosevelt',
        aiOpponentName: 'Sukuna',
        aiPlayerSymbol: 'X'
    });

    game.evaluate(`
        gameBoard = ['O', 'O', 'O', 'X', 'X', '', '', '', ''];
        gameFinished = true;
    `);
    game.context.showResult('O');

    assert.equal(game.elements.get('result-title').textContent, 'DÉFAITE');
    assert.match(game.elements.get('result-message').textContent, /Sukuna/);
    assert.match(game.elements.get('result-message').textContent, /GOD/);
    assert.equal(game.elements.get('result-icon').textContent, '🤖');
    assert.ok(game.elements.get('result-popup').classList.contains('result-defeat'));
});

test('un match nul affiche les deux noms et symboles', () => {
    const game = loadGame({
        gameMode: 'local',
        localPlayer1Name: 'Roosevelt',
        localPlayer2Name: 'Jefferson',
        player1Symbol: 'X',
        player2Symbol: 'O'
    });

    game.context.showResult(null);

    assert.equal(game.elements.get('result-title').textContent, 'MATCH NUL !');
    assert.ok(game.elements.get('result-popup').classList.contains('result-draw'));
    assert.match(game.elements.get('result-message').textContent, /Roosevelt \(X\)/);
    assert.match(game.elements.get('result-message').textContent, /Jefferson \(O\)/);
});


test('les noms GOD sont limités à Gojo et Sukuna', () => {
    const game = loadGame({ gameMode: 'local' });
    const api = game.context.TTTAiNames;

    assert.deepEqual(Array.from(api.GOD_NAMES), ['Gojo', 'Sukuna']);
    for (let i = 0; i < 20; i++) {
        assert.ok(['Gojo', 'Sukuna'].includes(api.genererNom('god')));
    }
});

test('les difficultés non GOD utilisent le pool de prénoms classiques', () => {
    const game = loadGame({ gameMode: 'local' });
    const api = game.context.TTTAiNames;

    for (const difficulty of ['easy', 'normal', 'hard']) {
        const name = api.genererNom(difficulty, null, () => 0);
        assert.equal(name, 'Thome');
        assert.equal(['Gojo', 'Sukuna'].includes(name), false);
    }
});

test('le nom IA sauvegardé est conservé pendant la partie', () => {
    const game = loadGame({
        gameMode: 'ai',
        difficulty: 'normal',
        aiPlayerName: 'Roosevelt',
        aiOpponentName: 'Olivier',
        aiPlayerSymbol: 'X'
    });

    assert.equal(game.elements.get('player-two-name').textContent, 'Olivier');
    assert.equal(JSON.parse(game.sessionStorage.getItem('tttPreparationState')).aiOpponentName, 'Olivier');
});

test('une victoire utilise le style victoire', () => {
    const game = loadGame({
        gameMode: 'local',
        localPlayer1Name: 'Roosevelt',
        localPlayer2Name: 'Jefferson',
        player1Symbol: 'X',
        player2Symbol: 'O'
    });

    finishLocalWin(game);
    assert.ok(game.elements.get('result-popup').classList.contains('result-victory'));
});
