/* Padel@Home: navegación legal y almacenamiento estrictamente necesario. */
(function () {
  'use strict';
  function addLegalFooter() {
    if (document.querySelector('[data-legal-footer]')) return;
    var footer = document.createElement('footer');
    footer.dataset.legalFooter = 'true';
    footer.className = 'pah-legal-footer';
    footer.innerHTML = '<nav aria-label="Información legal">' +
      '<a href="/privacy.html">Privacidad</a>' +
      '<a href="/terms.html">Términos y condiciones</a>' +
      '<a href="/cookies.html">Cookies</a>' +
      '<a href="/accessibility.html">Accesibilidad</a>' +
      '</nav>';
    var style = document.createElement('style');
    style.textContent = '.pah-legal-footer{padding:1.5rem 1rem;text-align:center;border-top:1px solid #e5e7eb;color:#4b5563;font-size:.875rem}.pah-legal-footer nav{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem 1rem}.pah-legal-footer a{color:#1d4ed8;text-decoration:underline;text-underline-offset:2px}.pah-legal-footer a:focus-visible{outline:3px solid #f59e0b;outline-offset:3px}.dark .pah-legal-footer{border-color:#374151;color:#d1d5db}.dark .pah-legal-footer a{color:#93c5fd}';
    document.head.appendChild(style);
    document.body.appendChild(footer);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLegalFooter);
  else addLegalFooter();
})();
