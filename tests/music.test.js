const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class EventTargetFake {
    constructor() {
        this.listeners = new Map();
    }

    addEventListener(type, callback) {
        const list = this.listeners.get(type) || [];
        list.push(callback);
        this.listeners.set(type, list);
    }

    removeEventListener(type, callback) {
        const list = this.listeners.get(type) || [];
        this.listeners.set(type, list.filter(item => item !== callback));
    }

    dispatchEvent(event) {
        for (const callback of this.listeners.get(event.type) || []) {
            callback(event);
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

class FakeAudio extends EventTargetFake {
    constructor(src) {
        super();
        this.src = src;
        this.loop = false;
        this.preload = '';
        this.volume = 1;
        this.currentTime = 0;
        this.duration = 180;
        this.readyState = 1;
        this.paused = true;
        this.playCount = 0;
        this.pauseCount = 0;
    }

    play() {
        this.paused = false;
        this.playCount += 1;
        return Promise.resolve();
    }

    pause() {
        this.paused = true;
        this.pauseCount += 1;
    }
}

function loadMusic({ settings, ownerId = null, hasFocus = true } = {}) {
    const localStorage = createStorage({
        ...(settings ? { tttSettings: JSON.stringify(settings) } : {}),
        ...(ownerId ? { tttMusicOwner: JSON.stringify({ id: ownerId }) } : {})
    });
    const sessionStorage = createStorage();

    const document = new EventTargetFake();
    document.currentScript = {
        dataset: {
            musicSrc: 'Sounds/theme.mp3'
        }
    };
    document.visibilityState = 'visible';
    document.hasFocus = () => hasFocus;

    const window = new EventTargetFake();

    const context = {
        document,
        window,
        localStorage,
        sessionStorage,
        Audio: FakeAudio,
        console: { warn() {}, log() {}, error() {} },
        Date,
        Math,
        crypto: { randomUUID: () => 'tab-1' },
        setTimeout,
        clearTimeout
    };

    vm.createContext(context);
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'music.js'),
        'utf8'
    );
    vm.runInContext(source, context);

    return { context, window, document, localStorage, sessionStorage, audio: window.tttMusic.audio };
}

test('la page active prend le contrôle musical et joue une seule instance', () => {
    const music = loadMusic({
        settings: { soundEnabled: true, volume: 70, language: 'fr' }
    });

    assert.equal(music.window.tttMusic.isOwner(), true);
    assert.equal(music.audio.playCount, 1);
    assert.equal(music.audio.paused, false);
});

test('un onglet perdant le contrôle se met en pause et ne redémarre pas sur un changement de paramètres distant', () => {
    const music = loadMusic({
        settings: { soundEnabled: true, volume: 70, language: 'fr' }
    });

    const initialPlayCount = music.audio.playCount;

    music.localStorage.setItem(
        'tttMusicOwner',
        JSON.stringify({ id: 'tab-2' })
    );
    music.window.dispatchEvent({
        type: 'storage',
        key: 'tttMusicOwner',
        newValue: JSON.stringify({ id: 'tab-2' })
    });

    assert.equal(music.audio.paused, true);
    assert.equal(music.window.tttMusic.isOwner(), false);

    music.window.dispatchEvent({
        type: 'storage',
        key: 'tttSettings',
        newValue: JSON.stringify({ soundEnabled: true, volume: 35, language: 'fr' })
    });

    assert.equal(music.audio.volume, 0.35);
    assert.equal(music.audio.playCount, initialPlayCount);
    assert.equal(music.audio.paused, true);
});

test('un réglage effectué dans la page courante peut reprendre le contrôle musical', () => {
    const music = loadMusic({
        settings: { soundEnabled: true, volume: 70, language: 'fr' },
        ownerId: 'tab-2',
        hasFocus: false
    });

    assert.equal(music.audio.playCount, 0);

    music.window.dispatchEvent({
        type: 'ttt-settings-changed',
        detail: { soundEnabled: true, volume: 50, language: 'fr' }
    });

    assert.equal(music.window.tttMusic.isOwner(), true);
    assert.equal(music.audio.volume, 0.5);
    assert.equal(music.audio.playCount, 1);
});

test('couper le son met la musique en pause et libère le contrôle', () => {
    const music = loadMusic({
        settings: { soundEnabled: true, volume: 70, language: 'fr' }
    });

    music.window.dispatchEvent({
        type: 'ttt-settings-changed',
        detail: { soundEnabled: false, volume: 70, language: 'fr' }
    });

    assert.equal(music.audio.paused, true);
    assert.equal(music.localStorage.getItem('tttMusicOwner'), null);
});
