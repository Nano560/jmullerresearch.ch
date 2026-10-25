/* Phone menu: below 600px the navigation collapses behind a menu button (the usual "hamburger").
   The button is added here, so without JavaScript the links simply stay visible.
   The CSS that shows and hides things is in style.css (.nav-toggle, nav.menu-ready). */
(() => {
    const header = document.querySelector('header');
    const nav = header && header.querySelector('nav');
    if (!nav) return;

    const BARS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    nav.id = nav.id || 'site-nav';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-toggle';
    button.setAttribute('aria-controls', nav.id);

    const setOpen = (open) => {
        nav.classList.toggle('is-open', open);
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        button.innerHTML = open ? CROSS : BARS;
    };

    button.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) {
            setOpen(false);
            button.focus();
        }
    });

    setOpen(false);
    header.insertBefore(button, header.firstChild);
    nav.classList.add('menu-ready');
})();
