// Squared One — shared site chrome (topbar + footer).
// Renders the canonical header into #site-header and footer into #site-footer,
// then wires the "Add to Discord" invite button from /api/invite.
//
// Include this script once per page (before footer.js / i18n.js /
// language-switcher.js so they see the injected markup), and drop a
// <div id="site-header"></div> where the topbar belongs and a
// <div id="site-footer"></div> where the footer belongs.
(function () {
  'use strict';

  const HEADER =
    '<header class="topbar">' +
    '  <div class="topbar-inner">' +
    '    <a class="logo" href="/">' +
    '      <img class="logo-img" src="/img/logo.png" alt="Squared One logo" />' +
    '      <span class="logo-text">SQUARED ONE</span>' +
    '    </a>' +
    '    <nav class="home-nav">' +
    '      <a class="btn btn-secondary btn-sm" href="/pricing" data-i18n="web.nav.pricing">Pricing</a>' +
    '      <a class="btn btn-secondary btn-sm" href="/support" data-i18n="web.nav.support">Support</a>' +
    '      <a class="btn btn-secondary btn-sm" href="/translate" data-i18n="web.nav.translate">Translate</a>' +
    '      <a class="btn btn-secondary btn-sm" href="/dashboard" data-i18n="web.nav.dashboard">Open dashboard</a>' +
    '      <a class="btn btn-primary btn-sm" id="invite-btn" href="#" target="_blank" rel="noopener" data-i18n="web.nav.invite">Add to Discord</a>' +
    '    </nav>' +
    '  </div>' +
    '</header>';

  const FOOTER =
    '<footer class="footer">' +
    '  <div class="footer-inner">' +
    '    <div class="footer-top">' +
    '      <a href="/" class="footer-brand" aria-label="Squared One">' +
    '        <img class="footer-logo" src="/img/logo.png" alt="Squared One logo" />' +
    '        <span class="footer-brand-name">SQUARED ONE</span>' +
    '      </a>' +
    '      <ul class="footer-social">' +
    '        <li>' +
    '          <a class="footer-social-btn" id="footer-discord" href="/support" aria-label="Discord support server">' +
    '            <svg viewBox="0 0 127.14 96.36" aria-hidden="true"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>' +
    '          </a>' +
    '        </li>' +
    '        <li>' +
    '          <a class="footer-social-btn" id="footer-github" href="https://github.com/squared-ones/bot" target="_blank" rel="noopener" aria-label="GitHub">' +
    '            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>' +
    '          </a>' +
    '        </li>' +
    '      </ul>' +
    '    </div>' +
    '    <div class="footer-bottom">' +
    '      <nav class="footer-main-nav" aria-label="Main">' +
    '        <ul>' +
    '          <li><a href="/dashboard">dashboard</a></li>' +
    '          <li><a href="/pricing">pricing</a></li>' +
    '          <li><a href="/support">support</a></li>' +
    '          <li><a href="/translate">translate</a></li>' +
    '          <li><a href="/">home</a></li>' +
    '        </ul>' +
    '      </nav>' +
    '      <div class="footer-legal" aria-label="Legal">' +
    '        <ul>' +
    '          <li><a href="/privacy">privacy</a></li>' +
    '          <li><a href="/terms">terms</a></li>' +
    '        </ul>' +
    '      </div>' +
    '      <div class="footer-copyright">' +
    '        <div>© 2026 Squared One</div>' +
    '        <div>Apache License 2.0</div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</footer>';

  function render() {
    const headerEl = document.getElementById('site-header');
    const footerEl = document.getElementById('site-footer');

    if (headerEl) {
      headerEl.outerHTML = HEADER;
    }
    if (footerEl) {
      footerEl.outerHTML = FOOTER;
    }

    // Wire the invite button from the server (uses CLIENT_ID).
    const btn = document.getElementById('invite-btn');
    if (btn) {
      fetch('/api/invite')
        .then((r) => r.json())
        .then((d) => {
          if (d && d.url) btn.href = d.url;
          else btn.remove();
        })
        .catch(() => btn.remove());
    }
  }

  // The placeholder elements exist by the time this script runs (it is
  // included at the end of <body>), so render synchronously to avoid a
  // flash. The page loader overlay covers this window anyway.
  render();
})();
