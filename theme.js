/* Light/dark theme for the inner pages (the landing page is always dark).
   Three states: "auto" follows the OS setting, "light" and "dark" are the visitor's own choice.
   The choice is remembered and shared by all pages. Loaded from <head>, right after the
   theme-color meta, so the saved theme is applied before the first paint. The colours
   themselves live in style.css. */
(() => {
    const KEY = 'theme';
    const BAR_COLORS = { light: '#e0dee9', dark: '#0d0817' };   // keep in sync with --bg in style.css
    const NAMES = { auto: 'auto (matches your device)', light: 'light', dark: 'dark' };
    const root = document.documentElement;
    const osLight = window.matchMedia('(prefers-color-scheme: light)');
    // Opened straight from disk (a local preview), Firefox and Safari give every file its own
    // storage, so a saved choice would never reach the other pages. There the choice travels
    // in the links instead (about-me.html#theme=dark). On the real site this stays off.
    const fromDisk = location.protocol === 'file:';
    let button = null;

    // The icon shows the current choice: half circle = auto, sun = light, moon = dark
    const ICONS = {
        auto: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/>' +
            '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
        light: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/>' +
            '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
        dark: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    };

    const savedChoice = () => {
        try {
            const value = localStorage.getItem(KEY);
            return value === 'light' || value === 'dark' ? value : 'auto';
        } catch (e) {
            return 'auto';
        }
    };

    const save = (choice) => {
        try {
            if (choice === 'auto') localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, choice);
        } catch (e) { /* private mode etc.: the choice just won't persist */ }
    };

    const currentChoice = () => root.getAttribute('data-theme') || 'auto';

    const apply = (choice) => {
        if (choice === 'auto') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', choice);
    };

    // The theme actually showing right now
    const effectiveTheme = () => root.getAttribute('data-theme') || (osLight.matches ? 'light' : 'dark');

    // Every click should visibly change something, so from "auto" go to the theme the device
    // is NOT using, then to the one it is using, then back to auto.
    const nextChoice = () => {
        const device = osLight.matches ? 'light' : 'dark';
        const other = device === 'light' ? 'dark' : 'light';
        const choice = currentChoice();
        return choice === 'auto' ? other : choice === other ? device : 'auto';
    };

    // Keep the browser UI colour and the toggle's icon/label in step with the page
    const sync = () => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', BAR_COLORS[effectiveTheme()]);
        if (!button) return;
        const choice = currentChoice();
        const label = 'Theme: ' + NAMES[choice] + '. Click for ' + nextChoice() + '.';
        button.innerHTML = ICONS[choice];
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
    };

    // Local preview only: put the current choice into this page's internal links
    const carryTheme = () => {
        if (!fromDisk) return;
        const choice = currentChoice();
        document.querySelectorAll('a[href]').forEach((a) => {
            const href = a.getAttribute('href');
            if (href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;   // in-page or external
            a.setAttribute('href', href.split('#')[0] + '#theme=' + choice);
        });
    };

    // A choice made on another page or tab (also after Back, when the page comes from the cache)
    const reapply = () => {
        apply(savedChoice());
        carryTheme();
        sync();
    };

    const passed = fromDisk ? (location.hash.match(/^#theme=(light|dark|auto)$/) || [])[1] : null;
    if (passed) {
        save(passed);
        try {
            history.replaceState(null, '', location.pathname + location.search);   // tidy the address
        } catch (e) { /* the hash just stays in the address */ }
    }
    apply(passed || savedChoice());
    sync();

    if (osLight.addEventListener) osLight.addEventListener('change', sync);
    window.addEventListener('storage', (e) => { if (e.key === KEY) reapply(); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) reapply(); });

    document.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('header');
        if (!header) return;
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        button.addEventListener('click', () => {
            const next = nextChoice();
            apply(next);
            save(next);
            carryTheme();
            sync();
        });
        header.appendChild(button);
        carryTheme();
        sync();
    });
})();
