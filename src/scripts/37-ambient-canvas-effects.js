
// -----------------------------------------------------------------------
// v0.52.0 — Living atmosphere. Paints #ambientCanvas with a slow flow
// field that reads the team's state: four drifting gradient orbs plus a
// field of motes riding a layered-sine flow. syncFromState() (called at
// the top of every render) eases a tension value derived from open
// attention items and Urgent / Support-needed levels: tension warms the
// palette, dilates time, and adds turbulence. eventPulse() (called from
// appendEvent) ripples the field on every write: warm violet for people
// events (meetings, notes, follow-ups, goals), cyan for everything else.
// Honors Stable mode (canvas hidden by CSS, loop parked), honors
// prefers-reduced-motion (one calm static frame, no loop), pauses when
// the tab is hidden, and caps devicePixelRatio at 1.5 to keep the fill
// cheap. Zero network, zero dependencies, ~2ms a frame on a laptop.
// v0.52.1 — Orb drift raised to perceptible, and the module now also
// paints #cursorCanvas with a cursor trail.
// v0.52.3 — The trail is a mist: soft vapour puffs that bloom, drift, and
// dissipate (drawMist) instead of a stroked ribbon.
// -----------------------------------------------------------------------
window.TP_AMBIENT = (() => {
  const canvas = document.getElementById('ambientCanvas');
  const noop = { syncFromState() {}, eventPulse() {} };
  if (!canvas || typeof canvas.getContext !== 'function') return noop;
  const ctx = canvas.getContext('2d');
  if (!ctx) return noop;

  // v0.52.1: cursor trail on an optional second canvas above the UI; if it
  // is missing, the atmosphere still runs and the trail is simply skipped.
  // Mouse pointers only (no trail while dragging a touch screen), never
  // under reduced motion or Stable mode.
  // v0.52.3: the trail is a mist. Movement sheds tiny vapour puffs that
  // bloom and dissipate; see drawMist below.
  const cursorCanvas = document.getElementById('cursorCanvas');
  const cursorCtx = cursorCanvas && typeof cursorCanvas.getContext === 'function' ? cursorCanvas.getContext('2d') : null;
  const puffs = [];
  const MIST_LIFE = 780;
  const MIST_MAX = 26;
  const MIST_COLS = [[122, 116, 220], [86, 150, 214]];

  const COOL = [[109, 93, 246], [0, 179, 230], [41, 87, 214], [138, 92, 255]];
  const WARM = [226, 68, 92];
  // Orbs are placed in viewport fractions so they frame the content pane the
  // same way the old static radial-gradients did: upper right, left edge,
  // lower middle, upper left. warmable controls how much of the tension
  // colour shift each orb accepts so the field never goes uniformly red.
  // v0.52.1: amplitudes and frequencies raised ~1.5x. The old values gave a
  // full drift cycle of 3+ minutes, which read as frozen next to the motes.
  const ORBS = [
    { cx: 0.86, cy: -0.05, r: 0.52, c: COOL[0], a: 0.100, fx: 0.075, fy: 0.062, ax: 105, ay: 66, warmable: 1.0 },
    { cx: -0.06, cy: 0.30, r: 0.46, c: COOL[1], a: 0.085, fx: 0.058, fy: 0.078, ax: 95, ay: 80, warmable: 0.35 },
    { cx: 0.45, cy: 1.05, r: 0.50, c: COOL[2], a: 0.080, fx: 0.066, fy: 0.055, ax: 120, ay: 64, warmable: 1.0 },
    { cx: 0.20, cy: -0.10, r: 0.34, c: COOL[3], a: 0.070, fx: 0.090, fy: 0.072, ax: 85, ay: 90, warmable: 0.35 },
  ];

  const state = { t: Math.random() * 500, tension: 0, target: 0, energy: 0, raf: 0, running: false, lastTs: 0 };
  const ripples = [];
  let w = 0;
  let h = 0;
  let motes = [];

  const reduceQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduceMotion = () => !!(reduceQuery && reduceQuery.matches);
  const stableMode = () => document.body.classList.contains('stable-mode');

  function mix(c1, c2, t) {
    return [Math.round(c1[0] + (c2[0] - c1[0]) * t), Math.round(c1[1] + (c2[1] - c1[1]) * t), Math.round(c1[2] + (c2[2] - c1[2]) * t)];
  }
  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`; }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (cursorCanvas && cursorCtx) {
      cursorCanvas.width = Math.max(1, Math.round(w * dpr));
      cursorCanvas.height = Math.max(1, Math.round(h * dpr));
      cursorCanvas.style.width = `${w}px`;
      cursorCanvas.style.height = `${h}px`;
      cursorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    seedMotes();
    if (!state.running) drawFrame(0);
  }

  function seedMotes() {
    const count = w < 900 ? 26 : 58;
    motes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      v: 0.35 + Math.random() * 0.5,
      c: COOL[Math.floor(Math.random() * COOL.length)],
      a: 0.14 + Math.random() * 0.18,
      r: 0.8 + Math.random() * 1.4,
    }));
  }

  // Cheap divergence-free-looking flow: three layered sines. Time already
  // dilates with tension in the loop, so the field itself stays stateless.
  function flowAngle(x, y, t) {
    return Math.sin(x * 0.0016 + t * 0.28) + Math.cos(y * 0.0013 - t * 0.22) + Math.sin((x + y) * 0.0007 + t * 0.11);
  }

  function drawFrame(dt) {
    ctx.clearRect(0, 0, w, h);
    const t = state.t;
    const tn = state.tension;
    const en = state.energy;
    for (const o of ORBS) {
      const col = mix(o.c, WARM, Math.min(1, tn * o.warmable * 0.75));
      const x = o.cx * w + Math.sin(t * o.fx + o.ax) * o.ax * (1 + tn * 0.8);
      const y = o.cy * h + Math.cos(t * o.fy + o.ay) * o.ay * (1 + tn * 0.8);
      const r = o.r * Math.max(w, h) * (1 + Math.sin(t * 0.05 + o.ax) * 0.04 + en * 0.05);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, o.a * (1 + tn * 0.55 + en * 0.6)));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const speed = 0.5 + tn * 1.7 + en * 1.2;
    for (const m of motes) {
      if (dt > 0) {
        const ang = flowAngle(m.x, m.y, t) * (1 + tn * 0.7);
        m.x += Math.cos(ang) * m.v * speed * dt * 24;
        m.y += Math.sin(ang) * m.v * speed * dt * 24 + (tn > 0.55 ? Math.sin(t * 3 + m.x * 0.05) * tn * 0.35 : 0);
        if (m.x < -8) m.x = w + 8; else if (m.x > w + 8) m.x = -8;
        if (m.y < -8) m.y = h + 8; else if (m.y > h + 8) m.y = -8;
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, 6.2832);
      ctx.fillStyle = rgba(m.c, m.a * (0.8 + en * 0.8));
      ctx.fill();
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      if (dt > 0) {
        rp.r += dt * (240 + rp.kick * 180);
        rp.a -= dt * 0.55;
      }
      if (rp.a <= 0.01) { ripples.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, 6.2832);
      ctx.strokeStyle = rgba(rp.c, rp.a);
      ctx.lineWidth = 1.5 + rp.kick;
      ctx.stroke();
    }
  }

  // The mist, v0.52.3. Replaces the comet ribbon, which still read as a
  // hard object at speed. Movement now sheds small vapour puffs: each one
  // is a soft radial gradient that blooms to roughly three times its spawn
  // radius, drifts gently upward, and dissipates over MIST_LIFE. No
  // strokes and no polyline, so there is nothing left to look segmented,
  // just overlapping soft gradients at very low alpha.
  function drawMist(now) {
    if (!cursorCtx) return;
    cursorCtx.clearRect(0, 0, w, h);
    while (puffs.length && now - puffs[0].t > MIST_LIFE) puffs.shift();
    if (!puffs.length) return;
    for (const p of puffs) {
      const age = (now - p.t) / MIST_LIFE;
      if (age >= 1) continue;
      const sec = (now - p.t) / 1000;
      const r = p.r0 * (1 + 2.2 * age);
      const x = p.x + p.vx * sec;
      const y = p.y + p.vy * sec;
      const a = 0.12 * Math.pow(1 - age, 1.6);
      const g = cursorCtx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(p.c, a * 0.9));
      g.addColorStop(0.6, rgba(p.c, a * 0.35));
      g.addColorStop(1, rgba(p.c, 0));
      cursorCtx.fillStyle = g;
      cursorCtx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function loop(ts) {
    if (!state.running) return;
    if (stableMode()) { park(); return; }
    const dt = state.lastTs ? Math.min(0.05, (ts - state.lastTs) / 1000) : 0.016;
    state.lastTs = ts;
    state.tension += (state.target - state.tension) * Math.min(1, dt * 1.4);
    state.energy = Math.max(0, state.energy * Math.pow(0.3, dt));
    state.t += dt * (0.6 + state.tension * 0.7 + state.energy * 0.5);
    drawFrame(dt);
    drawMist(ts);
    state.raf = window.requestAnimationFrame(loop);
  }

  function start() {
    if (state.running || reduceMotion() || stableMode() || document.hidden) return;
    if (typeof window.requestAnimationFrame !== 'function') return;
    state.running = true;
    state.lastTs = 0;
    state.raf = window.requestAnimationFrame(loop);
  }

  function park() {
    state.running = false;
    if (state.raf) window.cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  // Tension: how much of the team currently needs a human. Urgent counts
  // hard, Support needed counts softer, and every open attention detail
  // adds a little. Normalized against team size so one red dot on a team
  // of two reads hotter than one red dot on a team of ten.
  function syncFromState() {
    try {
      const people = (app?.doc?.people || []).filter((p) => p && !p.archived);
      let heat = 0;
      let attention = 0;
      for (const p of people) {
        const fill = supportLevelFill(p.supportLevel);
        if (fill === 'red') heat += 1.6;
        else if (fill === 'amber') heat += 0.7;
        try { attention += (getMetrics(p.id)?.attentionDetails || []).length; } catch (_) { /* metrics not ready yet */ }
      }
      const denom = Math.max(3, people.length * 1.6);
      state.target = Math.max(0, Math.min(1, (heat + attention * 0.8) / denom));
    } catch (_) {
      state.target = 0;
    }
    if (stableMode()) { park(); return; }
    if (reduceMotion()) { state.tension = state.target; drawFrame(0); return; }
    start();
  }

  function eventPulse(type) {
    if (reduceMotion() || stableMode()) return;
    const warm = /^(meeting|note|followup|follow_up|pulse|goal)/.test(String(type));
    ripples.push({
      x: w * (0.45 + Math.random() * 0.35),
      y: h * (0.25 + Math.random() * 0.4),
      r: 8,
      a: warm ? 0.34 : 0.24,
      kick: warm ? 1 : 0.4,
      c: warm ? [168, 102, 255] : [0, 179, 230],
    });
    if (ripples.length > 6) ripples.shift();
    state.energy = Math.min(1, state.energy + (warm ? 0.45 : 0.22));
    start();
  }

  window.addEventListener('resize', resize);
  let lastTrailX = -1e9;
  let lastTrailY = -1e9;
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (reduceMotion() || stableMode() || !cursorCtx) return;
    // v0.52.3: shed a puff every 12px of travel. Sparser than the old
    // ribbon samples; the bloom and overlap fill the gaps softly.
    const dx = event.clientX - lastTrailX;
    const dy = event.clientY - lastTrailY;
    if (dx * dx + dy * dy < 144) return;
    lastTrailX = event.clientX;
    lastTrailY = event.clientY;
    puffs.push({
      x: event.clientX + (Math.random() - 0.5) * 8,
      y: event.clientY + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 14,
      vy: -6 - Math.random() * 10,
      r0: 4 + Math.random() * 3.5,
      c: MIST_COLS[Math.floor(Math.random() * MIST_COLS.length)],
      t: performance.now()
    });
    if (puffs.length > MIST_MAX) puffs.shift();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) park(); else start(); });
  if (reduceQuery && typeof reduceQuery.addEventListener === 'function') {
    reduceQuery.addEventListener('change', () => {
      if (reduceMotion()) { park(); state.tension = state.target; drawFrame(0); } else { start(); }
    });
  }

  resize();
  if (reduceMotion()) { drawFrame(0); } else { start(); }
  return { syncFromState, eventPulse, pause: park, resume: start };
})();
