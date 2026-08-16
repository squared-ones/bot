/* Squared One — site footer links.
 * Upgrades the Discord/GitHub social links from /api/meta when configured,
 * falling back to the static defaults baked into the footer markup.
 */
(function () {
  fetch('/api/meta')
    .then((r) => r.json())
    .then((d) => {
      if (!d) return;
      const discord = document.getElementById('footer-discord');
      const github = document.getElementById('footer-github');
      if (discord && d.support) {
        discord.href = d.support;
        discord.target = '_blank';
        discord.rel = 'noopener';
      }
      if (github && d.github) github.href = d.github;
    })
    .catch(() => {});
})();
