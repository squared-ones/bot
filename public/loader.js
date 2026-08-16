// Squared One loading screen — shows a full-page overlay with a self-playing
// snake game and an asset-load progress bar while the page loads, then fades
// out. Self-contained: any page can show it by including this script at the
// top of <body>.
//
// The snake logic is a faithful vanilla port of the SnakeLoader component:
// it takes the shortest path to each apple while only stepping into squares
// that leave enough open room to keep going, so it never boxes itself in.

(function () {
  'use strict';

  const WIDTH = 7; // cells per side
  const SPEED = 75; // ms per frame
  const MIN_MS = 900; // minimum time the loader stays visible
  const STALL_MS = 12000; // give up waiting on assets after this long
  const FADE_MS = 450; // fade-out duration
  const DOT_PX = 12; // rendered size of each dot
  const TRICKLE_CAP = 80; // indeterminate ceiling before assets finish

  /* ------------------------- frame generation ------------------------- */

  function neighbours(p, w) {
    const row = (p / w) | 0;
    const col = p % w;
    const out = [];
    if (row > 0) out.push(p - w);
    if (row < w - 1) out.push(p + w);
    if (col > 0) out.push(p - 1);
    if (col < w - 1) out.push(p + 1);
    return out;
  }

  function distance(from, to, walls, w, n) {
    if (from === to) return 0;
    const seen = new Set([from]);
    let front = [from];
    let d = 0;
    while (front.length) {
      d++;
      const next = [];
      for (const cell of front) {
        for (const nb of neighbours(cell, w)) {
          if (nb === to) return d;
          if (!seen.has(nb) && !walls.has(nb)) {
            seen.add(nb);
            next.push(nb);
          }
        }
      }
      front = next;
    }
    return n + 1;
  }

  function reachable(start, walls, w) {
    const seen = new Set([start]);
    const queue = [start];
    let i = 0;
    while (i < queue.length) {
      for (const nb of neighbours(queue[i++], w)) {
        if (!seen.has(nb) && !walls.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    return seen.size;
  }

  function firstFree(walls, n) {
    for (let i = 0; i < n; i++) if (!walls.has(i)) return i;
    return -1;
  }

  function isSafe(cell, apple, tail, used, length, w) {
    const walls = new Set(used);
    if (cell !== apple) walls.delete(tail);
    walls.add(cell);
    return reachable(cell, walls, w) > length;
  }

  function generateSnakeFrames(width) {
    const w = Math.max(3, Math.floor(width));
    const n = w * w;

    const snake = [0, 1];
    const used = new Set(snake);
    const body = [];
    const apples = [];

    const spawn = () => {
      const free = [];
      for (let i = 0; i < n; i++) if (!used.has(i)) free.push(i);
      return free.length ? free[(Math.random() * free.length) | 0] : -1;
    };

    let apple = spawn();
    let budget = n * 5;

    while (snake.length < n && apple >= 0 && --budget > 0) {
      body.push([...snake]);
      apples.push([apple]);

      const head = snake[snake.length - 1];
      const tail = snake[0];
      const open = neighbours(head, w).filter(
        (nb) => !used.has(nb) || nb === tail
      );

      let move = -1;
      let best = n + 1;
      for (const nb of open) {
        if (!isSafe(nb, apple, tail, used, snake.length, w)) continue;
        const d = distance(nb, apple, used, w, n);
        if (d < best) {
          best = d;
          move = nb;
        }
      }

      if (move < 0) {
        let room = -1;
        for (const nb of open) {
          const sim = new Set(used);
          sim.delete(tail);
          sim.add(nb);
          const seed = firstFree(sim, n);
          const size = seed >= 0 ? reachable(seed, sim, w) : 0;
          if (size > room) {
            room = size;
            move = nb;
          }
        }
        if (move < 0) break;
      }

      const grows = move === apple;
      if (!grows) used.delete(snake.shift());
      snake.push(move);
      used.add(move);
      if (grows) apple = spawn();
    }

    const full = [...snake];
    body.push(full, full, [], full, []);
    apples.push([], [], [], [], []);

    return { body, apples };
  }

  /* ----------------------------- overlay ----------------------------- */

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 's2-loader';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', 'Loading');
    overlay.innerHTML =
      '<div class="s2-loader-inner">' +
      '<div class="s2-loader-brand">Squared One</div>' +
      '<div class="s2-snake" aria-hidden="true"></div>' +
      '<div class="s2-loader-progress"><span class="s2-progress-fill"></span></div>' +
      '<div class="s2-loader-label">Loading <span class="s2-progress-pct">0%</span></div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function buildGrid(overlay, width) {
    const grid = overlay.querySelector('.s2-snake');
    grid.style.gridTemplateColumns = `repeat(${width}, ${DOT_PX}px)`;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < width * width; i++) {
      const dot = document.createElement('span');
      dot.className = 's2-dot';
      frag.appendChild(dot);
    }
    grid.appendChild(frag);
    return Array.from(grid.children);
  }

  function start() {
    const overlay = buildOverlay();
    const dots = buildGrid(overlay, WIDTH);
    const barFill = overlay.querySelector('.s2-progress-fill');
    const pctEl = overlay.querySelector('.s2-progress-pct');
    const startedAt = Date.now();
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    /* -------- load progress -------- */
    let total = 0;
    let loaded = 0;
    let trickle = 0;
    let lastPct = 0;

    function setProgress(pct) {
      pct = Math.max(0, Math.min(100, Math.round(pct)));
      if (pct < lastPct) pct = lastPct; // never move backwards
      lastPct = pct;
      barFill.style.width = pct + '%';
      pctEl.textContent = pct + '%';
    }

    function renderProgress() {
      const ratio = total ? (loaded / total) * 100 : trickle;
      // Cap at 99% — 100% is reserved for the final fade-out.
      setProgress(Math.min(99, Math.max(trickle, ratio)));
    }

    const trickleTimer = setInterval(() => {
      if (trickle < TRICKLE_CAP) {
        trickle = Math.min(TRICKLE_CAP, trickle + 0.6);
        renderProgress();
      }
    }, 120);

    function collectAssets() {
      const pending = [];
      const track = (done, attach) => {
        total++;
        if (done) loaded++;
        else pending.push(attach);
      };

      // Images already in the DOM (logo, icons, etc.).
      Array.from(document.images).forEach((img) => {
        if (img.complete) {
          track(true);
          return;
        }
        track(false, (cb) => {
          img.addEventListener('load', cb, { once: true });
          img.addEventListener('error', cb, { once: true });
        });
      });

      // Stylesheets — render-blocking ones are done, async ones may not be.
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach(
        (link) => {
          if (link.sheet) {
            track(true);
            return;
          }
          track(false, (cb) => {
            link.addEventListener('load', cb, { once: true });
            link.addEventListener('error', cb, { once: true });
          });
        }
      );

      // Web fonts.
      if (document.fonts && document.fonts.status !== 'loaded') {
        track(false, (cb) => document.fonts.ready.then(cb, cb));
      }

      pending.forEach((attach) =>
        attach(() => {
          loaded++;
          renderProgress();
        })
      );
      renderProgress();
    }

    if (
      document.readyState === 'interactive' ||
      document.readyState === 'complete'
    ) {
      collectAssets();
    } else {
      document.addEventListener('DOMContentLoaded', collectAssets, {
        once: true,
      });
    }

    /* -------- snake entertainment -------- */
    let stopAnim = null;
    if (!reduced) {
      let game = generateSnakeFrames(WIDTH);
      let frame = 0;

      stopAnim = (function () {
        const timer = setInterval(() => {
          const bodySet = new Set(game.body[frame] || []);
          const appleSet = new Set(game.apples[frame] || []);
          for (let i = 0; i < dots.length; i++) {
            dots[i].classList.toggle('active', bodySet.has(i));
            dots[i].classList.toggle('accent', appleSet.has(i));
          }
          frame++;
          if (frame >= game.body.length) {
            game = generateSnakeFrames(WIDTH);
            frame = 0;
          }
        }, SPEED);
        return () => clearInterval(timer);
      })();
    }

    /* -------- finish & fade -------- */
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      const wait = Math.max(0, MIN_MS - (Date.now() - startedAt));
      setTimeout(() => {
        clearInterval(trickleTimer);
        setProgress(100);
        if (stopAnim) stopAnim();
        overlay.classList.add('s2-loader-hidden');
        setTimeout(() => overlay.remove(), FADE_MS);
      }, wait);
    }

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish, { once: true });
      // Safety net in case an asset hangs forever.
      setTimeout(finish, STALL_MS);
    }
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }
})();
