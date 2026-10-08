(() => {
    let overlay = null;
    let hideTimer = null;

    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'phase-transition-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="phase-transition-card" role="status" aria-live="polite">
                <span class="phase-transition-kicker">TIC TAC TOE</span>
                <h2 class="phase-transition-title">Préparez-vous</h2>
                <p class="phase-transition-subtitle"></p>
            </div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    function show({ kicker = 'TIC TAC TOE', title = 'Préparez-vous', subtitle = '', duration = 1100 } = {}) {
        const node = ensureOverlay();
        if (hideTimer) clearTimeout(hideTimer);
        node.querySelector('.phase-transition-kicker').textContent = kicker;
        node.querySelector('.phase-transition-title').textContent = title;
        node.querySelector('.phase-transition-subtitle').textContent = subtitle;
        node.hidden = false;
        requestAnimationFrame(() => node.classList.add('is-visible'));

        return new Promise(resolve => {
            hideTimer = setTimeout(() => {
                node.classList.remove('is-visible');
                setTimeout(() => {
                    node.hidden = true;
                    resolve();
                }, 230);
            }, Math.max(350, Number(duration) || 1100));
        });
    }

    function hide() {
        const node = ensureOverlay();
        if (hideTimer) clearTimeout(hideTimer);
        node.classList.remove('is-visible');
        node.hidden = true;
    }

    globalThis.TTTPhaseTransition = Object.freeze({ show, hide });
})();
