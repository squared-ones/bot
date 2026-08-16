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

  var lastX = 0;
  var lastY = 0;
  var lastTime = performance.now();
  var vx = 0;
  var vy = 0;
  var prevAngle = 0;
  var accRotation = 0;
  var idleTimer = null;
  var pending = false;

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

    el.style.transform =
      'translate3d(' + cursorX.value + 'px,' + cursorY.value + 'px,0) ' +
      'rotate(' + rotation.value + 'deg) scale(' + scale.value + ') ' +
      'translate(-50%, -50%)';

    var settled =
      cursorX.value === cursorX.target &&
      cursorY.value === cursorY.target &&
      rotation.value === rotation.target &&
      scale.value === scale.target;

    if (settled) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  }

  // Hide the native cursor while the custom one is active.
  document.documentElement.classList.add('custom-cursor');
})();
