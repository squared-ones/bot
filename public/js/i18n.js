// Squared One — client-side i18n loader (no machine translation).
// Include this script and mark text with `data-i18n="key"` (or
// `data-i18n-placeholder="key"` for inputs). It fetches the selected locale's
// strings from /api/i18n/strings and swaps them in. Falls back to English.
//
// Locale is resolved from: ?lang= query → localStorage → navigator.language.
(function () {
  'use strict';

  const LS_KEY = 'squared-one-locale';

  function detectLocale() {
    try {
      const params = new URLSearchParams(window.location.search);
      const query = params.get('lang');
      if (query) return query;
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return saved;
    } catch {
      /* storage unavailable */
    }
    return (navigator.language || 'en').toLowerCase() || 'en';
  }

  let strings = {};

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (strings[key] != null) el.textContent = strings[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (strings[key] != null) el.setAttribute('placeholder', strings[key]);
    });
    document.dispatchEvent(
      new CustomEvent('i18n:ready', { detail: { locale: detectLocale() } })
    );
  }

  window.I18N = {
    locale: detectLocale(),
    t(key, vars) {
      let text = strings[key] != null ? strings[key] : key;
      if (vars) {
        text = text.replace(/\{(\w+)\}/g, (match, name) =>
          Object.prototype.hasOwnProperty.call(vars, name)
            ? String(vars[name])
            : match
        );
      }
      return text;
    },
    setLocale(locale) {
      try {
        localStorage.setItem(LS_KEY, locale);
      } catch {
        /* ignore */
      }
      window.location.reload();
    },
  };

  fetch('/api/i18n/strings?locale=' + encodeURIComponent(detectLocale()))
    .then((res) => res.json())
    .then((data) => {
      strings = data.strings || {};
      apply();
    })
    .catch(() => {});
})();
