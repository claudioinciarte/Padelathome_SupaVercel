// public/js/services/theme.js
// Servicio central de tema (modo claro / oscuro / sistema).
// Se carga de forma síncrona en el <head> de todas las páginas para aplicar
// el tema ANTES del primer render (sin parpadeo).
//
// API global: PadelTheme.get() -> 'light' | 'dark' | 'system'
//             PadelTheme.set('light'|'dark'|'system')  (persiste en localStorage)
(function () {
  var STORAGE_KEY = 'theme';
  var DARK_QUERY = window.matchMedia('(prefers-color-scheme: dark)');

  function readSaved() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch (e) { /* localStorage no disponible */ }
    return 'system';
  }

  function current() {
    return readSaved();
  }

  function apply(theme) {
    var dark = theme === 'dark' || (theme === 'system' && DARK_QUERY.matches);
    document.documentElement.classList.toggle('dark', dark);
  }

  // Aplicar el tema antes del primer paint
  apply(current());

  // Si el usuario usa 'system', seguir los cambios del sistema en vivo
  try {
    DARK_QUERY.addEventListener('change', function () {
      if (current() === 'system') apply('system');
    });
  } catch (e) {
    // Safari antiguo: matchMedia sin addEventListener
  }

  window.PadelTheme = {
    get: current,
    set: function (theme) {
      if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) { /* localStorage no disponible */ }
      apply(theme);
    },
  };
})();
