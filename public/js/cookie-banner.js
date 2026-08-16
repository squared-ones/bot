// Squared One cookie consent banner. Self-contained: any page can show it by
// including this script. Shows once, then remembers the choice for a year in
// a first-party cookie.

(function () {
  'use strict';

  const CONSENT_KEY = 'squared_one_cookie_consent';

  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + name + '=([^;]*)')
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    ).toUTCString();
    document.cookie =
      `${name}=${encodeURIComponent(value)}; expires=${expires}; ` +
      'path=/; SameSite=Lax';
  }

  // Already answered — don't show again.
  if (getCookie(CONSENT_KEY)) return;

  function buildBanner() {
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<p class="cookie-banner-copy">' +
      'We use cookies to run the dashboard, remember your preferences, and ' +
      'keep you signed in. See our <a href="/privacy">privacy policy</a>.' +
      '</p>' +
      '<div class="cookie-banner-actions">' +
      '<button type="button" class="btn btn-secondary btn-sm cookie-decline">Decline</button>' +
      '<button type="button" class="btn btn-primary btn-sm cookie-accept">Accept</button>' +
      '</div>';
    return banner;
  }

  function mount() {
    const banner = buildBanner();
    document.body.appendChild(banner);

    function choose(value) {
      setCookie(CONSENT_KEY, value, 365);
      banner.classList.add('cookie-banner-hidden');
      setTimeout(() => banner.remove(), 400);
    }

    banner
      .querySelector('.cookie-accept')
      .addEventListener('click', () => choose('accepted'));
    banner
      .querySelector('.cookie-decline')
      .addEventListener('click', () => choose('declined'));
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();
