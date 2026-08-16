// Squared One — topbar language switcher.
// Injects a compact locale <select> into the dashboard topbar
// (`.dash-topbar-right`) or, on public pages, `.home-nav`. Reloads with
// ?lang=<locale> on change (public/i18n.js picks that up after reload).
(function () {
  'use strict';

  const KEY = 'squared-one-locale';

  function currentLocale() {
    try {
      const params = new URLSearchParams(window.location.search);
      const query = params.get('lang');
      if (query) return query;
      const saved = localStorage.getItem(KEY);
      if (saved) return saved;
    } catch {
      /* storage unavailable */
    }
    return (navigator.language || 'en').toLowerCase() || 'en';
  }

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const mount = document.querySelector(
    '.dash-topbar-right, .home-nav, .auth-lang'
  );
  if (!mount) return;

  const select = document.createElement('select');
  select.className = 'lang-switcher';
  select.setAttribute('aria-label', 'Choose language');
  select.innerHTML = '<option value="en">English</option>';

  const preferred = currentLocale();

  fetch('/api/i18n/locales')
    .then((res) => res.json())
    .then((data) => {
      const locales = data.locales || [];
      select.innerHTML =
        '<option value="en">English</option>' +
        locales
          .map(
            (locale) =>
              `<option value="${esc(locale)}"${locale === preferred ? ' selected' : ''}>${esc(
                locale
              )}</option>`
          )
          .join('');
    })
    .catch(() => {});

  select.addEventListener('change', () => {
    try {
      localStorage.setItem(KEY, select.value);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('lang', select.value);
    window.location.href = url.toString();
  });

  mount.prepend(select);
})();
