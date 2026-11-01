/* Video switcher: shows one video at a time and lets the visitor choose which one.
   The page lists every video as <figure class="video-item"> inside [data-video-switcher], with
   data-video (YouTube id), data-slug, data-label, data-poster and an optional data-group.
   data-aspect ("16/9", "1/1", "9/16") gives the shape of the film and of its poster; without it the stage is 2:1.
   data-poster-light is the poster for the light theme (data-poster then serves the dark one). A film that is not on
   YouTube yet has data-soon instead of data-video: it shows its poster marked "Coming soon", without a play button.
   data-scatterer ("circle", "square" or "cross") sorts the films by the scatterer they show: once there are two or
   more, a row of the scatterers drawn to scale is shown above the buttons, and the buttons list the chosen one's films
   (pressing another scatterer keeps the same data-label when that scatterer has it). Give each film a data-slug that
   includes the scatterer, e.g. "square-long".
   Without JavaScript the page keeps listing them all (each embedded inside <noscript>); with it,
   they are replaced by one player with a poster, a caption and one button per video.
   YouTube is only contacted when someone presses play. #video=<slug> in the address opens that
   video, and the address follows the choice so a particular video can be linked. */
(() => {
    const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>';
    const embedUrl = (id) => 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&playsinline=1';

    // The scatterers of the acoustic cloning experiment, to scale (millimetres, centred in a 110 box): a circle of
    // radius 50, a square of side 100, and a cross of five squares of side 35.
    const SHAPES = {
        circle: { label: 'Circle', path: '<circle cx="55" cy="55" r="50"/>' },
        square: { label: 'Square', path: '<rect x="5" y="5" width="100" height="100"/>' },
        cross: { label: 'Cross', path: '<path d="M37.5 2.5h35v35h35v35h-35v35h-35v-35h-35v-35h35z"/>' }
    };
    const shapeIcon = (name) => '<svg viewBox="0 0 110 110" aria-hidden="true" focusable="false" fill="currentColor">' +
        SHAPES[name].path + '</svg>';

    const make = (tag, className, attrs = {}) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
        return el;
    };

    const aspect = (text) => {
        const match = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(text || '');
        return match && Number(match[1]) > 0 && Number(match[2]) > 0 ? [Number(match[1]), Number(match[2])] : [2, 1];
    };

    document.querySelectorAll('[data-video-switcher]').forEach((root) => {
        const items = [...root.querySelectorAll('.video-item')].map((el) => {
            const caption = el.querySelector('figcaption');
            return {
                id: el.dataset.video,
                slug: el.dataset.slug || el.dataset.video,
                label: el.dataset.label || el.dataset.slug || el.dataset.video,
                poster: el.dataset.poster || '',
                posterLight: el.dataset.posterLight || '',
                soon: el.hasAttribute('data-soon'),
                group: el.dataset.group || '',
                scatterer: el.dataset.scatterer || '',
                ratio: aspect(el.dataset.aspect),
                title: (caption ? caption.textContent : '').replace(/\s+/g, ' ').trim()
            };
        }).filter((item) => item.id || item.soon);
        if (!items.length) return;

        const ui = make('div', 'video-ui');
        const stage = make('div', 'video-stage');
        const caption = make('div', 'video-caption', { 'aria-live': 'polite' });
        const buttons = [];
        // With two or more scatterers: the picker's buttons, and the list of films for each scatterer
        const scatterers = [...new Set(items.map((item) => item.scatterer).filter((name) => SHAPES[name]))];
        const pickers = [];
        const lists = [];
        let current = 0;
        let playing = false;

        // The poster as one picture, or as a dark and a light one of which style.css shows the one that matches the theme
        const pictures = (item) => {
            const size = { alt: '', width: '1280', height: String(Math.round(1280 * item.ratio[1] / item.ratio[0])) };
            if (!item.poster) return [];
            if (!item.posterLight) return [make('img', '', { src: item.poster, ...size })];
            return [
                make('img', 'poster-dark', { src: item.poster, loading: 'lazy', ...size }),
                make('img', 'poster-light', { src: item.posterLight, loading: 'lazy', ...size })
            ];
        };

        const poster = (item) => {
            if (item.soon) {
                const still = make('div', 'video-poster is-soon', { role: 'img', 'aria-label': item.title + ' (coming soon)' });
                still.append(...pictures(item), Object.assign(make('span', 'video-soon'), { textContent: 'Coming soon' }));
                return still;
            }
            const button = make('button', 'video-poster', { type: 'button', 'aria-label': 'Play video: ' + item.title });
            button.append(...pictures(item));
            const play = make('span', 'video-play');
            play.innerHTML = PLAY;
            button.append(play);
            button.addEventListener('click', () => {
                select(current, { play: true });
                const frame = stage.querySelector('iframe');
                if (frame) frame.focus();
            });
            return button;
        };

        const player = (item) => make('iframe', '', {
            src: embedUrl(item.id),
            title: item.title,
            allow: 'autoplay; encrypted-media; picture-in-picture; web-share',
            referrerpolicy: 'strict-origin-when-cross-origin',
            allowfullscreen: ''
        });

        // Choosing while a video is playing starts the new one straight away; before that it just shows its poster
        const select = (index, { play = playing, hash = false } = {}) => {
            current = index;
            play = play && Boolean(items[index].id);   // a film that is not up yet only shows its poster
            playing = play;
            buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
            pickers.forEach(({ name, button }) => button.setAttribute('aria-pressed', String(name === items[index].scatterer)));
            lists.forEach(({ key, element }) => { element.hidden = key !== items[index].scatterer; });
            caption.textContent = items[index].title;
            stage.style.setProperty('--video-w', items[index].ratio[0]);
            stage.style.setProperty('--video-h', items[index].ratio[1]);
            stage.replaceChildren(play ? player(items[index]) : poster(items[index]));
            if (hash) {
                try {
                    history.replaceState(null, '', '#video=' + items[index].slug);
                } catch (e) { /* the address just stays as it is */ }
            }
        };

        const indexFromHash = () => {
            const match = location.hash.match(/^#video=([\w-]+)$/);
            return match ? items.findIndex((item) => item.slug === match[1]) : -1;
        };

        ui.append(stage, caption);

        if (items.length > 1) {
            const choices = make('div', 'video-choices-wrap');
            const picker = scatterers.length > 1;
            if (picker) {
                const row = make('div', 'video-scatterers', { role: 'group', 'aria-label': 'Scatterer' });
                scatterers.forEach((name) => {
                    const button = make('button', 'video-scatterer', { type: 'button', 'aria-pressed': 'false' });
                    button.innerHTML = shapeIcon(name);
                    button.append(Object.assign(make('span'), { textContent: SHAPES[name].label }));
                    button.addEventListener('click', () => {
                        const same = items.findIndex((item) => item.scatterer === name && item.label === items[current].label);
                        select(same >= 0 ? same : items.findIndex((item) => item.scatterer === name), { hash: true });
                    });
                    pickers.push({ name, button });
                    row.append(button);
                });
                choices.append(row);
            }
            // The buttons are listed by scatterer when there is a picker, else by data-group (with its name above)
            const keyOf = (item) => (picker ? item.scatterer : item.group);
            [...new Set(items.map(keyOf))].forEach((key) => {
                const section = make('div', 'video-group');
                if (key && !picker) section.append(Object.assign(make('div', 'video-group-label'), { textContent: key }));
                const name = picker && SHAPES[key] ? SHAPES[key].label : key;
                const list = make('div', 'video-choices', { role: 'group', 'aria-label': name ? 'Videos: ' + name : 'Choose a video' });
                items.forEach((item, i) => {
                    if (keyOf(item) !== key) return;
                    const button = make('button', '', { type: 'button', 'aria-pressed': 'false' });
                    button.textContent = item.label;
                    button.addEventListener('click', () => select(i, { hash: true }));
                    buttons[i] = button;
                    list.append(button);
                });
                section.append(list);
                if (picker) lists.push({ key, element: section });
                choices.append(section);
            });
            // Above the film, so that the buttons keep their place when a film of another shape is chosen
            ui.prepend(choices);
        }

        select(Math.max(0, indexFromHash()), { play: false });
        window.addEventListener('hashchange', () => {
            const i = indexFromHash();
            if (i >= 0 && i !== current) select(i);
        });
        root.classList.add('is-enhanced');
        root.append(ui);
    });
})();
