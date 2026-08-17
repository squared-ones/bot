/* Squared One — smooth neon cursor.
 * Vanilla port of the "SmoothCursor" React component: a spring-physics arrow
 * that trails the pointer, tilts toward its velocity, and scales while moving.
 */
(function () {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="27" viewBox="0 0 50 54" fill="none" aria-hidden="true">' +
    '<path d="M42.6817 41.1495L27.5103 6.79925C26.7269 5.02557 24.2082 5.02558 23.3927 6.79925L7.59814 41.1495C6.75833 42.9759 8.52712 44.8902 10.4125 44.1954L24.3757 39.0496C24.8829 38.8627 25.4385 38.8627 25.9422 39.0496L39.8121 44.1954C41.6849 44.8902 43.4884 42.9759 42.6817 41.1495Z" fill="#0a0000"/>' +
    '<path d="M43.7146 40.6933L28.5431 6.34306C27.3556 3.65428 23.5772 3.69516 22.3668 6.32755L6.57226 40.6778C5.3134 43.4156 7.97238 46.298 10.803 45.2549L24.7662 40.109C25.0221 40.0147 25.2999 40.0156 25.5494 40.1082L39.4193 45.254C42.2261 46.2953 44.9254 43.4347 43.7146 40.6933Z" stroke="#ff0000" stroke-width="2.25"/>' +
    '</svg>';

  var el = document.createElement('div');
  el.className = 'smooth-cursor';
  el.innerHTML = SVG;
  document.body.appendChild(el);

  // Spring solver (mirrors the motion/react spring config in the source).
  function Spring(value, cfg) {
    this.target = value;
    this.value = value;
    this.velocity = 0;
    this.cfg = cfg;
  }
  Spring.prototype.set = function (v) {
    this.target = v;
  };
  Spring.prototype.update = function (dt) {
    var s = this.cfg;
    var accel =
      (-s.stiffness * (this.value - this.target) - s.damping * this.velocity) /
      s.mass;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    if (
      Math.abs(this.velocity) < s.restDelta &&
      Math.abs(this.value - this.target) < s.restDelta
    ) {
      this.value = this.target;
      this.velocity = 0;
    }
  };

  var cursorX = new Spring(0, { stiffness: 400, damping: 45, mass: 1, restDelta: 0.001 });
  var cursorY = new Spring(0, { stiffness: 400, damping: 45, mass: 1, restDelta: 0.001 });
  var rotation = new Spring(0, { stiffness: 300, damping: 60, mass: 1, restDelta: 0.001 });
  var scale = new Spring(1, { stiffness: 500, damping: 35, mass: 1, restDelta: 0.001 });
  // Squash applied on click; bounces back with a slight overshoot.
  var clickScale = new Spring(1, {
    stiffness: 600,
    damping: 24,
    mass: 1,
    restDelta: 0.001,
  });

  // The arrow's tip within the SVG (display px from the element's top-left).
  // The element is anchored so this point — not the box center — sits on the
  // cursor position, so the arrow tip points exactly where the pointer is.
  var TIP_X = 12.7;
  var TIP_Y = 2.5;
  el.style.transformOrigin = TIP_X + 'px ' + TIP_Y + 'px';

  var lastX = 0;
  var lastY = 0;
  var lastTime = performance.now();
  var vx = 0;
  var vy = 0;
  var prevAngle = 0;
  var accRotation = 0;
  var idleTimer = null;
  var pending = false;
  // Trail particles are throttled so they don't pile up on every mousemove.
  var TRAIL_INTERVAL_MS = 45;
  var lastTrailTime = 0;

  function onMouseMove(e) {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var now = performance.now();
      var dt = Math.max(1, now - lastTime);
      vx = (e.clientX - lastX) / dt;
      vy = (e.clientY - lastY) / dt;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;

      cursorX.set(e.clientX);
      cursorY.set(e.clientY);

      var speed = Math.hypot(vx, vy);
      if (speed > 0.1) {
        // Leave a fading dot behind the animated cursor while it moves.
        var trailNow = performance.now();
        if (trailNow - lastTrailTime > TRAIL_INTERVAL_MS) {
          lastTrailTime = trailNow;
          spawnTrailParticle(cursorX.value, cursorY.value);
        }
        var currentAngle = Math.atan2(vy, vx) * (180 / Math.PI) + 90;
        var diff = currentAngle - prevAngle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        accRotation += diff;
        rotation.set(accRotation);
        prevAngle = currentAngle;
        scale.set(0.95);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
          scale.set(1);
        }, 150);
      }

      kick();
    });
  }

  window.addEventListener('mousemove', onMouseMove);

  // Spawns a small fading dot at the animated cursor's position to leave a
  // trail while it moves. Each particle is removed once its animation ends.
  function spawnTrailParticle(x, y) {
    var p = document.createElement('div');
    p.className = 'cursor-trail-particle';
    var size = 1.5 + Math.random() * 2;
    var dur = (0.35 + Math.random() * 0.25).toFixed(2);
    p.style.width = size.toFixed(1) + 'px';
    p.style.height = size.toFixed(1) + 'px';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.animationDuration = dur + 's';
    document.body.appendChild(p);
    (function (node, duration) {
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, (parseFloat(duration) + 0.05) * 1000);
    })(p, dur);
  }

  // Spawns a burst of neon particles that fly outward from the animated
  // cursor's position (which trails the pointer), not the raw click coords.
  var PARTICLE_COUNT = 18;

  function spawnClickBurst(x, y) {
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var p = document.createElement('div');
      p.className = 'cursor-click-particle';

      var angle = Math.random() * Math.PI * 2;
      var dist = 24 + Math.random() * 48;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist;
      var size = 2 + Math.random() * 3.5;
      var dur = (0.35 + Math.random() * 0.3).toFixed(2);
      // A few particles burn hotter (near-white) for a bright core.
      p.style.background = Math.random() < 0.3 ? '#ffd7d7' : '#ff0000';
      p.style.width = size.toFixed(1) + 'px';
      p.style.height = size.toFixed(1) + 'px';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--dx', dx.toFixed(1) + 'px');
      p.style.setProperty('--dy', dy.toFixed(1) + 'px');
      p.style.animationDuration = dur + 's';
      document.body.appendChild(p);

      (function (node, duration) {
        setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, (parseFloat(duration) + 0.05) * 1000);
      })(p, dur);
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return; // primary button only
    clickScale.set(0.82);
    spawnClickBurst(cursorX.value, cursorY.value);
    kick();
  }

  function onMouseUp(e) {
    if (e.button !== 0) return;
    clickScale.set(1);
    kick();
  }

  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  var running = false;
  var lastFrame = performance.now();

  function kick() {
    if (!running) {
      running = true;
      lastFrame = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    if (!running) return;
    var dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (dt > 1 / 30) dt = 1 / 30;
    if (dt <= 0) dt = 0.0001;

    cursorX.update(dt);
    cursorY.update(dt);
    rotation.update(dt);
    scale.update(dt);
    clickScale.update(dt);

    el.style.transform =
      'translate3d(' + cursorX.value + 'px,' + cursorY.value + 'px,0) ' +
      'translate(' +
      -TIP_X +
      'px,' +
      -TIP_Y +
      'px) ' +
      'rotate(' + rotation.value + 'deg) scale(' +
      (scale.value * clickScale.value) +
      ')';

    var settled =
      cursorX.value === cursorX.target &&
      cursorY.value === cursorY.target &&
      rotation.value === rotation.target &&
      scale.value === scale.target &&
      clickScale.value === clickScale.target;

    if (settled) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  }

  // Hide the native cursor while the custom one is active.
  document.documentElement.classList.add('custom-cursor');
})();
