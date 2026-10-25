/* Video switcher: shows one video at a time and lets the visitor choose which one.
   The page lists every video as <figure class="video-item"> inside [data-video-switcher], with
   data-video (YouTube id), data-slug, data-label, data-poster and an optional data-group.
   Without JavaScript the page keeps listing them all (each embedded inside <noscript>); with it,
   they are replaced by one player with a poster, a caption and one button per video.
   YouTube is only contacted when someone presses play. #video=<slug> in the address opens that
   video, and the address follows the choice so a particular video can be linked. */
(() => {
    const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>';
    const embedUrl = (id) => 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&playsinline=1';

    const make = (tag, className, attrs = {}) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
        return el;
    };

    document.querySelectorAll('[data-video-switcher]').forEach((root) => {
        const items = [...root.querySelectorAll('.video-item')].map((el) => {
            const caption = el.querySelector('figcaption');
            return {
                id: el.dataset.video,
                slug: el.dataset.slug || el.dataset.video,
                label: el.dataset.label || el.dataset.slug || el.dataset.video,
                poster: el.dataset.poster || '',
                group: el.dataset.group || '',
                title: (caption ? caption.textContent : '').replace(/\s+/g, ' ').trim()
            };
        }).filter((item) => item.id);
        if (!items.length) return;

        const ui = make('div', 'video-ui');
        const stage = make('div', 'video-stage');
        const caption = make('div', 'video-caption', { 'aria-live': 'polite' });
        const buttons = [];
        let current = 0;
        let playing = false;

        const poster = (item) => {
            const button = make('button', 'video-poster', { type: 'button', 'aria-label': 'Play video: ' + item.title });
            if (item.poster) {
                const img = make('img', '', { src: item.poster, alt: '', width: '1280', height: '640' });
                button.append(img);
            }
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
            playing = play;
            buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
            caption.textContent = items[index].title;
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
            [...new Set(items.map((item) => item.group))].forEach((group) => {
                const section = make('div', 'video-group');
                if (group) section.append(Object.assign(make('div', 'video-group-label'), { textContent: group }));
                const list = make('div', 'video-choices', { role: 'group', 'aria-label': group ? 'Videos: ' + group : 'Choose a video' });
                items.forEach((item, i) => {
                    if (item.group !== group) return;
                    const button = make('button', '', { type: 'button', 'aria-pressed': 'false' });
                    button.textContent = item.label;
                    button.addEventListener('click', () => select(i, { hash: true }));
                    buttons[i] = button;
                    list.append(button);
                });
                section.append(list);
                choices.append(section);
            });
            ui.append(choices);
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
