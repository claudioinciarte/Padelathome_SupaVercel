const ICONS = {
    racket: '<svg class="app-header-logo-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 17.5c-2.2-2.2-3.2-5.4-2.6-8.3.4-1.8 1.5-3.6 3.1-5.1 1.6-1.6 3.4-2.7 5.1-3.1 2.9-.6 6.1.4 8.3 2.6 2.2 2.2 3.2 5.4 2.6 8.3-.4 1.8-1.5 3.6-3.1 5.1-1.6 1.6-3.4 2.7-5.1 3.1-2.9.6-6.1-.4-8.3-2.6z" stroke="currentColor" stroke-width="1.8"/><path d="M4 20l5.2-5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="14.2" cy="9.8" r="2.2" stroke="currentColor" stroke-width="1.6"/></svg>',
    chevron: '<svg class="app-header-caret" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

function parseJwt(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(base64).split('').map((c) =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function initialsFrom(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortName(name) {
    if (!name) return 'Cuenta';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1][0]}.`;
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
}

export function mountAppHeader({ page = '', extraHtml = '' } = {}) {
    const token = localStorage.getItem('authToken');
    const user = token ? parseJwt(token) : null;
    const isAdmin = user?.role === 'admin';
    const loggedIn = Boolean(user?.id);

    document.querySelectorAll('.app-header').forEach((el) => el.remove());

    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
        <div class="app-header-inner">
            <a href="${loggedIn ? '/dashboard.html' : '/login.html'}" class="app-header-brand">
                ${ICONS.racket}
                <span>Padel@Home</span>
            </a>
            <nav class="app-header-nav" aria-label="Principal">
                <a href="/dashboard.html" data-nav="dashboard">Inicio</a>
                <a href="/faq.html" data-nav="faq">Ayuda</a>
                ${isAdmin ? '<a href="/admin.html" data-nav="admin">Admin</a>' : ''}
            </nav>
            <div class="app-header-right">
                <div class="app-header-extra">${extraHtml}</div>
                ${loggedIn ? `
                <div class="app-header-user">
                    <button type="button" class="app-header-user-btn" id="app-header-user-btn" aria-expanded="false" aria-haspopup="true">
                        <span class="app-header-avatar">${initialsFrom(user.name)}</span>
                        <span class="app-header-name">${shortName(user.name)}</span>
                        ${ICONS.chevron}
                    </button>
                    <div class="app-header-menu" id="app-header-menu" hidden>
                        <a href="/profile.html" data-nav="profile">Mi perfil</a>
                        <button type="button" id="app-header-logout">Cerrar sesión</button>
                    </div>
                </div>
                <button type="button" class="app-header-burger" id="app-header-burger" aria-label="Abrir menú" aria-expanded="false">
                    ${ICONS.menu}
                </button>
                ` : `
                <a class="app-header-login" href="/login.html">Entrar</a>
                `}
            </div>
        </div>
        ${loggedIn ? `
        <div class="app-header-drawer" id="app-header-drawer" hidden>
            <a href="/dashboard.html" data-nav="dashboard">Inicio</a>
            <a href="/faq.html" data-nav="faq">Ayuda</a>
            <a href="/profile.html" data-nav="profile">Mi perfil</a>
            ${isAdmin ? '<a href="/admin.html" data-nav="admin">Admin</a>' : ''}
            <button type="button" id="app-header-logout-mobile">Cerrar sesión</button>
        </div>
        ` : ''}
    `;

    header.querySelectorAll(`[data-nav="${page}"]`).forEach((el) => {
        el.setAttribute('aria-current', 'page');
    });

    document.body.prepend(header);

    const menu = header.querySelector('#app-header-menu');
    const userBtn = header.querySelector('#app-header-user-btn');
    const drawer = header.querySelector('#app-header-drawer');
    const burger = header.querySelector('#app-header-burger');

    const closeMenus = () => {
        if (menu) menu.hidden = true;
        if (userBtn) userBtn.setAttribute('aria-expanded', 'false');
        if (drawer) drawer.hidden = true;
        if (burger) {
            burger.setAttribute('aria-expanded', 'false');
            burger.setAttribute('aria-label', 'Abrir menú');
            burger.innerHTML = ICONS.menu;
        }
    };

    userBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = menu.hidden;
        closeMenus();
        if (open) {
            menu.hidden = false;
            userBtn.setAttribute('aria-expanded', 'true');
        }
    });

    burger?.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = drawer.hidden;
        closeMenus();
        if (open) {
            drawer.hidden = false;
            burger.setAttribute('aria-expanded', 'true');
            burger.setAttribute('aria-label', 'Cerrar menú');
            burger.innerHTML = ICONS.close;
        }
    });

    header.querySelector('#app-header-logout')?.addEventListener('click', logout);
    header.querySelector('#app-header-logout-mobile')?.addEventListener('click', logout);

    document.addEventListener('click', (e) => {
        if (!header.contains(e.target)) closeMenus();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenus();
    });

    return header;
}
