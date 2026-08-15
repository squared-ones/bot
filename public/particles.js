// Shared red/black particle background for Squared One pages.
(function () {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  class Dot {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r = Math.random() * 1.5 + 0.5;
    }
    step() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W) this.vx *= -1;
      if (this.y < 0 || this.y > H) this.vy *= -1;
    }
  }

  const DOTS = Array.from({ length: 55 }, () => new Dot());

  function frame() {
    ctx.fillStyle = 'rgba(5,0,0,0.22)';
    ctx.fillRect(0, 0, W, H);

    DOTS.forEach((d) => d.step());
    for (let i = 0; i < DOTS.length; i++) {
      for (let j = i + 1; j < DOTS.length; j++) {
        const dx = DOTS[i].x - DOTS[j].x;
        const dy = DOTS[i].y - DOTS[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.strokeStyle = `rgba(255,0,0,${(1 - dist / 110) * 0.35})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(DOTS[i].x, DOTS[i].y);
          ctx.lineTo(DOTS[j].x, DOTS[j].y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(255,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(DOTS[i].x, DOTS[i].y, DOTS[i].r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduced) requestAnimationFrame(frame);
  }
  frame();
})();
