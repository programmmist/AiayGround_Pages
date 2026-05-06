(() => {
  const RUN_SECONDS = 180;
  const MAX_HULL = 100;
  const MAX_CARGO = 5;
  const BASE_R = 54;
  const SCRAP_COUNT = 16;
  const MINE_COUNT = 7;
  const TWO_PI = Math.PI * 2;

  const screens = {
    start: document.getElementById('startScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen'),
  };
  const el = {
    canvas: document.getElementById('gameCanvas'),
    timeText: document.getElementById('timeText'),
    scoreText: document.getElementById('scoreText'),
    hullText: document.getElementById('hullText'),
    cargoText: document.getElementById('cargoText'),
    comboText: document.getElementById('comboText'),
    polarityButton: document.getElementById('polarityButton'),
    hintText: document.getElementById('hintText'),
    resultTitle: document.getElementById('resultTitle'),
    resultSummary: document.getElementById('resultSummary'),
    resultStats: document.getElementById('resultStats'),
    resultJson: document.getElementById('resultJson'),
  };
  const ctx = el.canvas.getContext('2d');

  let state = null;
  let raf = 0;
  let last = 0;
  let pointer = { active: false, x: 0, y: 0, lastTap: 0 };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function fmtTime(s) {
    const t = Math.max(0, Math.ceil(s));
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }
  function screenToCanvas(evt) {
    const r = el.canvas.getBoundingClientRect();
    return { x: (evt.clientX - r.left) * el.canvas.width / r.width, y: (evt.clientY - r.top) * el.canvas.height / r.height };
  }
  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove('screen-active'));
    screens[name].classList.add('screen-active');
  }
  function spawn(type) {
    const angle = rand(0, TWO_PI);
    const radius = rand(125, 420);
    const x = clamp(480 + Math.cos(angle) * radius, 45, 915);
    const y = clamp(320 + Math.sin(angle) * radius, 45, 595);
    return {
      type, x, y,
      vx: rand(-18, 18), vy: rand(-18, 18),
      r: type === 'scrap' ? rand(8, 13) : rand(12, 17),
      value: type === 'scrap' ? Math.round(rand(8, 18)) : 0,
      hot: rand(0, 1),
    };
  }
  function newRun() {
    return {
      startedAt: new Date().toISOString(),
      elapsed: 0,
      hull: MAX_HULL,
      score: 0,
      combo: 1,
      comboTimer: 0,
      polarity: 'attract',
      ship: { x: 480, y: 420, vx: 0, vy: 0, r: 16, cargo: 0 },
      objects: [
        ...Array.from({ length: SCRAP_COUNT }, () => spawn('scrap')),
        ...Array.from({ length: MINE_COUNT }, () => spawn('mine')),
      ],
      stats: {
        delivered: 0,
        maxCombo: 1,
        switches: 0,
        mineHits: 0,
        nearMisses: 0,
        closeCalls: 0,
        scrapTouched: 0,
      },
      events: [],
      finished: false,
    };
  }
  function log(type, data = {}) {
    state.events.push({ t: Math.round(state.elapsed * 10) / 10, type, ...data });
    if (state.events.length > 100) state.events.shift();
  }
  function switchPolarity() {
    if (!state || state.finished) return;
    state.polarity = state.polarity === 'attract' ? 'repel' : 'attract';
    state.stats.switches += 1;
    el.polarityButton.textContent = state.polarity === 'attract' ? '흡인' : '반발';
    el.polarityButton.className = `polarity ${state.polarity}`;
    el.hintText.textContent = state.polarity === 'attract' ? '폐품을 빠르게 끌어오지만 지뢰도 위험해집니다.' : '지뢰를 밀어내며 정리하세요. 폐품 수집 속도는 느려집니다.';
    log('switch', { polarity: state.polarity });
  }
  function start() {
    cancelAnimationFrame(raf);
    state = newRun();
    pointer = { active: false, x: 0, y: 0, lastTap: 0 };
    last = performance.now();
    el.polarityButton.textContent = '흡인';
    el.polarityButton.className = 'polarity attract';
    show('game');
    raf = requestAnimationFrame(loop);
  }
  function update(dt) {
    state.elapsed += dt;
    const ship = state.ship;
    if (pointer.active) {
      const dx = pointer.x - ship.x;
      const dy = pointer.y - ship.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const thrust = clamp(len / 180, 0, 1) * 280;
      ship.vx += dx / len * thrust * dt;
      ship.vy += dy / len * thrust * dt;
    }
    ship.vx *= Math.pow(0.985, dt * 60);
    ship.vy *= Math.pow(0.985, dt * 60);
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    if (ship.x < ship.r || ship.x > 960 - ship.r) { ship.vx *= -0.55; ship.x = clamp(ship.x, ship.r, 960 - ship.r); }
    if (ship.y < ship.r || ship.y > 640 - ship.r) { ship.vy *= -0.55; ship.y = clamp(ship.y, ship.r, 640 - ship.r); }

    const base = { x: 480, y: 320 };
    const modeSign = state.polarity === 'attract' ? 1 : -1;
    for (const o of state.objects) {
      const dx = ship.x - o.x;
      const dy = ship.y - o.y;
      const d = Math.max(20, Math.hypot(dx, dy));
      const range = o.type === 'mine' ? 155 : 220;
      if (d < range) {
        const polarityEffect = o.type === 'scrap' ? modeSign : modeSign;
        const force = (1 - d / range) * (o.type === 'scrap' ? 170 : 225) * polarityEffect;
        o.vx += dx / d * force * dt;
        o.vy += dy / d * force * dt;
      }
      o.vx += Math.sin(state.elapsed * 0.8 + o.hot * 9) * 2 * dt;
      o.vy += Math.cos(state.elapsed * 0.7 + o.hot * 7) * 2 * dt;
      o.vx *= Math.pow(0.992, dt * 60);
      o.vy *= Math.pow(0.992, dt * 60);
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < o.r || o.x > 960 - o.r) { o.vx *= -0.65; o.x = clamp(o.x, o.r, 960 - o.r); }
      if (o.y < o.r || o.y > 640 - o.r) { o.vy *= -0.65; o.y = clamp(o.y, o.r, 640 - o.r); }

      const toShip = Math.hypot(o.x - ship.x, o.y - ship.y);
      if (o.type === 'mine' && toShip < ship.r + o.r + 18 && toShip > ship.r + o.r) state.stats.nearMisses += dt;
      if (toShip < ship.r + o.r) {
        if (o.type === 'scrap') {
          ship.cargo = Math.min(MAX_CARGO, ship.cargo + 1);
          state.stats.scrapTouched += 1;
          log('pickup', { cargo: ship.cargo });
          Object.assign(o, spawn('scrap'));
        } else {
          const damage = state.polarity === 'repel' ? 7 : 16;
          state.hull = Math.max(0, state.hull - damage);
          state.stats.mineHits += 1;
          state.combo = 1;
          state.comboTimer = 0;
          ship.vx += (ship.x - o.x) * 5;
          ship.vy += (ship.y - o.y) * 5;
          log('mine_hit', { damage, hull: Math.round(state.hull) });
          Object.assign(o, spawn('mine'));
        }
      }
    }
    if (dist(ship, base) < BASE_R && ship.cargo > 0) {
      const delivered = ship.cargo;
      state.score += delivered * 20 * state.combo;
      state.stats.delivered += delivered;
      state.combo = Math.min(9, state.combo + 1);
      state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
      state.comboTimer = 10;
      ship.cargo = 0;
      log('deliver', { delivered, combo: state.combo, score: state.score });
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    state.hull -= dt * 1.15;
    state.stats.closeCalls = Math.round(state.stats.nearMisses);
    if (state.elapsed >= RUN_SECONDS || state.hull <= 0) finish();
  }
  function drawCircle(x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TWO_PI); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function draw() {
    ctx.clearRect(0, 0, 960, 640);
    ctx.fillStyle = '#060813'; ctx.fillRect(0, 0, 960, 640);
    ctx.strokeStyle = 'rgba(106,247,255,.08)'; ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke(); }
    for (let y = 0; y <= 640; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
    const basePulse = 1 + Math.sin(state.elapsed * 4) * 0.04;
    drawCircle(480, 320, BASE_R * basePulse, 'rgba(106,247,255,.09)', 'rgba(106,247,255,.45)');
    ctx.fillStyle = '#6af7ff'; ctx.font = '700 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('기지', 480, 326);

    const ship = state.ship;
    const aura = state.polarity === 'attract' ? 'rgba(134,255,152,.12)' : 'rgba(255,180,94,.14)';
    drawCircle(ship.x, ship.y, state.polarity === 'attract' ? 220 : 155, aura, null);
    for (const o of state.objects) {
      if (o.type === 'scrap') drawCircle(o.x, o.y, o.r, '#86ff98', 'rgba(255,255,255,.5)');
      else {
        drawCircle(o.x, o.y, o.r + Math.sin(state.elapsed * 8 + o.hot) * 2, '#ff7b4f', '#ffd08a');
        ctx.strokeStyle = 'rgba(255,99,122,.45)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 10, 0, TWO_PI); ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(Math.atan2(ship.vy, ship.vx || 1));
    ctx.fillStyle = '#edf5ff';
    ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-13, -11); ctx.lineTo(-7, 0); ctx.lineTo(-13, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
    drawCircle(ship.x, ship.y, ship.r + 4, 'rgba(255,255,255,.04)', state.polarity === 'attract' ? '#86ff98' : '#ffb45e');

    if (pointer.active) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ship.x, ship.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
      drawCircle(pointer.x, pointer.y, 10, 'rgba(255,255,255,.16)', 'rgba(255,255,255,.45)');
    }
  }
  function renderHud() {
    el.timeText.textContent = fmtTime(RUN_SECONDS - state.elapsed);
    el.scoreText.textContent = Math.round(state.score);
    el.hullText.textContent = Math.max(0, Math.round(state.hull));
    el.cargoText.textContent = `${state.ship.cargo}/${MAX_CARGO}`;
    el.comboText.textContent = `x${state.combo}`;
  }
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    if (!state.finished) {
      update(dt);
      draw();
      renderHud();
      raf = requestAnimationFrame(loop);
    }
  }
  function finish() {
    if (state.finished) return;
    state.finished = true;
    cancelAnimationFrame(raf);
    const survived = state.elapsed >= RUN_SECONDS && state.hull > 0;
    const summary = {
      id: 'polarity-salvage',
      startedAt: state.startedAt,
      survived,
      elapsedSeconds: Math.round(state.elapsed),
      score: Math.round(state.score),
      delivered: state.stats.delivered,
      maxCombo: state.stats.maxCombo,
      switches: state.stats.switches,
      mineHits: state.stats.mineHits,
      nearMissSeconds: Math.round(state.stats.nearMisses),
      remainingHull: Math.max(0, Math.round(state.hull)),
      validationQuestion: '끌어당기기/밀어내기 극성 전환이 3분 동안 리스크-보상 판단을 계속 만들 수 있는가?',
    };
    el.resultTitle.textContent = survived ? '3분 회수 성공' : '회수선 손실';
    el.resultSummary.textContent = survived
      ? '끝까지 살아남았습니다. 스위치 횟수와 지뢰 피격 수가 낮고 배달량이 높으면 판단 루프가 작동한 것입니다.'
      : '선체가 먼저 소진되었습니다. 반발 타이밍이 충분히 읽히는지, 지뢰 밀도가 과한지 확인하세요.';
    el.resultStats.innerHTML = Object.entries({
      점수: summary.score,
      배달: summary.delivered,
      최대콤보: `x${summary.maxCombo}`,
      극성전환: summary.switches,
      지뢰피격: summary.mineHits,
      근접회피초: summary.nearMissSeconds,
    }).map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
    el.resultJson.textContent = JSON.stringify(summary, null, 2);
    show('result');
  }

  document.getElementById('startButton').addEventListener('click', start);
  document.getElementById('retryButton').addEventListener('click', start);
  el.polarityButton.addEventListener('click', switchPolarity);
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); switchPolarity(); } });
  el.canvas.addEventListener('pointerdown', (e) => {
    const now = performance.now();
    if (now - pointer.lastTap < 280) switchPolarity();
    pointer.lastTap = now;
    pointer.active = true;
    Object.assign(pointer, screenToCanvas(e));
    el.canvas.setPointerCapture(e.pointerId);
  });
  el.canvas.addEventListener('pointermove', (e) => { if (pointer.active) Object.assign(pointer, screenToCanvas(e)); });
  el.canvas.addEventListener('pointerup', () => { pointer.active = false; });
  el.canvas.addEventListener('pointercancel', () => { pointer.active = false; });
})();
