// Squared One — notification toasts.
// A small, dependency-free notification system with four variants and a
// dismissible, auto-expiring stack. Include this script, then:
//
//   Notify.show({ title, description, variant: 'success', duration: 5000 });
//   Notify.success('Saved', 'Your changes were applied.');
//   Notify.warning('Heads up', 'This cannot be undone.');
//   Notify.info('FYI', 'Something to know.');
//   Notify.error('Failed', 'Something went wrong.');
//
// `variant` is one of: success | warning | info | error.
// `duration` is ms before auto-dismiss; use 0 to keep it until dismissed.
(function () {
  'use strict';

  const VARIANTS = ['success', 'warning', 'info', 'error'];

  const ICONS = {
    success:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
  };

  const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  const MAX_STACK = 5;

  function ensureContainer() {
    let container = document.getElementById('notifications');
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.id = 'notifications';
    container.className = 'notifications';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(container);
    return container;
  }

  function dismiss(element) {
    if (!element || element.dataset.leaving === '1') return;
    element.dataset.leaving = '1';
    element.classList.add('is-leaving');
    const finish = () => element.remove();
    element.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 400); // Fallback if transitionend never fires.
  }

  function show(options = {}) {
    const variant = VARIANTS.includes(options.variant) ? options.variant : 'info';
    const title = typeof options.title === 'string' ? options.title : '';
    const description = typeof options.description === 'string' ? options.description : '';
    const duration = options.duration == null ? 5000 : Number(options.duration);

    if (!title && !description) return null;

    const element = document.createElement('div');
    element.className = `notification notification--${variant}`;
    element.setAttribute('role', 'alert');

    const icon = document.createElement('span');
    icon.className = 'notification__icon';
    icon.innerHTML = ICONS[variant];

    const body = document.createElement('div');
    body.className = 'notification__body';
    if (title) {
      const heading = document.createElement('p');
      heading.className = 'notification__title';
      heading.textContent = title;
      body.appendChild(heading);
    }
    if (description) {
      const text = document.createElement('p');
      text.className = 'notification__desc';
      text.textContent = description;
      body.appendChild(text);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notification__close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.innerHTML = CLOSE_ICON;
    close.addEventListener('click', () => dismiss(element));

    element.append(icon, body, close);

    const host = ensureContainer();
    host.appendChild(element);
    while (host.children.length > MAX_STACK) host.removeChild(host.firstChild);

    requestAnimationFrame(() => element.classList.add('is-visible'));

    if (duration > 0) setTimeout(() => dismiss(element), duration);
    return element;
  }

  window.Notify = {
    show,
    dismiss,
    success: (title, description, duration) =>
      show({ title, description, variant: 'success', duration }),
    warning: (title, description, duration) =>
      show({ title, description, variant: 'warning', duration }),
    info: (title, description, duration) =>
      show({ title, description, variant: 'info', duration }),
    error: (title, description, duration) =>
      show({ title, description, variant: 'error', duration }),
  };
})();
