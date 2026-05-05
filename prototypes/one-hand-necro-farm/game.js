(() => {
  const RUN_SECONDS = 300;
  const WAVE_INTERVAL = 60;
  const TICK_MS = 250;
  const GROW_SECONDS = 9;
  const ROT_SECONDS = 7;
  const MAX_HEALTH = 10;

  const screens = {
    start: document.getElementById('startScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen'),
  };
  const el = {
    grid: document.getElementById('grid'),
    timeText: document.getElementById('timeText'),
    waveText: document.getElementById('waveText'),
    healthText: document.getElementById('healthText'),
    goldText: document.getElementById('goldText'),
    skeletonText: document.getElementById('skeletonText'),
    plantedText: document.getElementById('plantedText'),
    harvestText: document.getElementById('harvestText'),
    rotText: document.getElementById('rotText'),
    clearedText: document.getElementById('clearedText'),
    hintText: document.getElementById('hintText'),
    waveLog: document.getElementById('waveLog'),
    enemyMarker: document.getElementById('enemyMarker'),
    resultTitle: document.getElementById('resultTitle'),
    resultSummary: document.getElementById('resultSummary'),
    resultStats: document.getElementById('resultStats'),
    resultJson: document.getElementById('resultJson'),
  };

  let state = null;
  let timer = null;

  function emptyCell() {
    return { state: 'empty', timer: 0 };
  }

  function newRun() {
    return {
      startedAt: new Date().toISOString(),
      elapsed: 0,
      waveTimer: WAVE_INTERVAL,
      waveNumber: 0,
      health: MAX_HEALTH,
      gold: 6,
      skeletons: 0,
      cells: Array.from({ length: 9 }, emptyCell),
      stats: {
        planted: 0,
        harvested: 0,
        rotted: 0,
        skeletonsRaised: 0,
        wavesCleared: 0,
        damageTaken: 0,
        failedWaves: 0,
      },
      events: [],
      lastMessage: '빈 칸을 눌러 씨앗을 심으세요.',
      finished: false,
    };
  }

  function logEvent(type, data = {}) {
    state.events.push({ t: Math.round(state.elapsed * 10) / 10, type, ...data });
    if (state.events.length > 80) state.events.shift();
  }

  function showScreen(name) {
    Object.values(screens).forEach((screen) => screen.classList.remove('screen-active'));
    screens[name].classList.add('screen-active');
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.ceil(totalSeconds));
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function plant(index) {
    if (!state || state.finished) return;
    const cell = state.cells[index];
    if (cell.state !== 'empty') return;
    if (state.gold <= 0) {
      state.lastMessage = '골드가 부족합니다. 성장한 작물을 수확해 골드를 확보하세요.';
      render();
      return;
    }
    state.gold -= 1;
    state.cells[index] = { state: 'growing', timer: 0 };
    state.stats.planted += 1;
    state.lastMessage = '씨앗을 심었습니다. 성장 후 바로 수확하거나 더 기다려 부패시킬 수 있습니다.';
    logEvent('crop_planted', { cell: index });
    render();
  }

  function harvest(index) {
    if (!state || state.finished) return;
    const cell = state.cells[index];
    if (!['grown', 'rotten'].includes(cell.state)) return;
    const reward = cell.state === 'rotten' ? 1 : 3;
    state.gold += reward;
    state.cells[index] = emptyCell();
    state.stats.harvested += 1;
    state.lastMessage = cell.state === 'rotten'
      ? '늦게 수확해 골드는 적지만, 빈 칸을 확보했습니다.'
      : '작물을 수확해 골드를 얻었습니다. 방어 준비도 놓치지 마세요.';
    logEvent('crop_harvested', { cell: index, reward, wasRotten: cell.state === 'rotten' });
    render();
  }

  function raiseSkeleton(index) {
    if (!state || state.finished) return;
    const cell = state.cells[index];
    if (cell.state !== 'rotten') return;
    state.skeletons += 1;
    state.cells[index] = emptyCell();
    state.stats.rotted += 1;
    state.stats.skeletonsRaised += 1;
    state.lastMessage = '부패 작물을 해골로 바꿨습니다. 다음 웨이브 방어력이 올라갑니다.';
    logEvent('skeleton_raised', { cell: index, skeletons: state.skeletons });
    render();
  }

  function resolveWave() {
    state.waveNumber += 1;
    const enemyPower = 2 + state.waveNumber * 2;
    const defense = state.skeletons * 3;
    logEvent('wave_started', { wave: state.waveNumber, enemyPower, defense });

    if (defense >= enemyPower) {
      const spent = Math.max(1, Math.ceil(enemyPower / 4));
      state.skeletons = Math.max(0, state.skeletons - spent);
      state.gold += 2;
      state.stats.wavesCleared += 1;
      state.lastMessage = `${state.waveNumber}번째 웨이브를 막았습니다. 해골 ${spent}기가 소모되고 보상 골드 2를 얻었습니다.`;
      logEvent('wave_cleared', { wave: state.waveNumber, spent, skeletons: state.skeletons });
    } else {
      const damage = Math.max(1, enemyPower - defense);
      state.health -= damage;
      state.skeletons = 0;
      state.stats.damageTaken += damage;
      state.stats.failedWaves += 1;
      state.lastMessage = `${state.waveNumber}번째 웨이브 방어 실패. 피해 ${damage}. 수확만 하면 방어가 비어버립니다.`;
      logEvent('wave_failed', { wave: state.waveNumber, damage });
      if (state.health <= 0) {
        finishRun('failed');
        return;
      }
    }
    state.waveTimer = WAVE_INTERVAL;
  }

  function updateCells(dt) {
    for (const cell of state.cells) {
      if (cell.state === 'growing') {
        cell.timer += dt;
        if (cell.timer >= GROW_SECONDS) {
          cell.state = 'grown';
          cell.timer = 0;
          logEvent('crop_grown');
        }
      } else if (cell.state === 'grown') {
        cell.timer += dt;
        if (cell.timer >= ROT_SECONDS) {
          cell.state = 'rotten';
          cell.timer = 0;
          logEvent('crop_rotted');
        }
      }
    }
  }

  function tick() {
    if (!state || state.finished) return;
    const dt = TICK_MS / 1000;
    state.elapsed += dt;
    state.waveTimer -= dt;
    updateCells(dt);
    if (state.waveTimer <= 0) resolveWave();
    if (!state.finished && state.elapsed >= RUN_SECONDS) finishRun('survived');
    render();
  }

  function resultPayload(outcome) {
    const activeChoiceCount = state.stats.harvested + state.stats.rotted;
    const harvestRatio = activeChoiceCount ? state.stats.harvested / activeChoiceCount : 0;
    const rotRatio = activeChoiceCount ? state.stats.rotted / activeChoiceCount : 0;
    return {
      prototype_id: 'one-hand-necro-farm',
      source_iteration: 'iteration-live-001',
      validation_question: '수확할지 부패시킬지의 선택이 5분 동안 의미 있는 판단으로 느껴지는가?',
      outcome,
      elapsed_seconds: Math.round(state.elapsed),
      health: Math.max(0, state.health),
      gold: state.gold,
      skeletons: state.skeletons,
      stats: { ...state.stats, activeChoiceCount, harvestRatio, rotRatio },
      ended_at: new Date().toISOString(),
      recent_events: state.events.slice(-24),
    };
  }

  function finishRun(outcome) {
    state.finished = true;
    clearInterval(timer);
    timer = null;
    const payload = resultPayload(outcome);
    el.resultTitle.textContent = outcome === 'survived' ? '5분 생존' : '농장 붕괴';
    el.resultSummary.textContent = outcome === 'survived'
      ? '검증 세션을 끝까지 완료했습니다. 수확/부패 선택 비율과 다시 하고 싶은지 여부를 확인하세요.'
      : '웨이브 압박을 버티지 못했습니다. 수확 위주였는지, 부패 준비가 늦었는지 확인하세요.';
    el.resultStats.innerHTML = '';
    const cards = [
      ['생존 시간', formatTime(payload.elapsed_seconds)],
      ['수확', payload.stats.harvested],
      ['부패 선택', payload.stats.rotted],
      ['생성 해골', payload.stats.skeletonsRaised],
      ['막은 웨이브', payload.stats.wavesCleared],
      ['받은 피해', payload.stats.damageTaken],
    ];
    for (const [label, value] of cards) {
      const div = document.createElement('div');
      div.className = 'result-card';
      div.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      el.resultStats.appendChild(div);
    }
    el.resultJson.value = JSON.stringify(payload, null, 2);
    showScreen('result');
  }

  function renderCell(cell, index) {
    const button = document.createElement('button');
    button.className = `cell ${cell.state}`;
    button.type = 'button';

    let icon = '＋';
    let label = '씨앗 심기';
    let progress = 0;
    if (cell.state === 'growing') {
      icon = '🌱';
      label = '성장 중';
      progress = Math.min(100, (cell.timer / GROW_SECONDS) * 100);
    } else if (cell.state === 'grown') {
      icon = '🌾';
      label = '수확 가능 · 곧 부패';
      progress = Math.min(100, (cell.timer / ROT_SECONDS) * 100);
    } else if (cell.state === 'rotten') {
      icon = '💀';
      label = '해골 생성 가능';
      progress = 100;
    }
    button.style.setProperty('--progress', `${progress}%`);
    button.innerHTML = `<div class="cell-content"><div><div class="icon">${icon}</div><span class="cell-label">${label}</span></div></div>`;
    if (cell.state === 'empty') button.addEventListener('click', () => plant(index));

    if (cell.state === 'grown' || cell.state === 'rotten') {
      const actions = document.createElement('div');
      actions.className = 'cell-actions';
      const harvestButton = document.createElement('button');
      harvestButton.className = 'harvest';
      harvestButton.type = 'button';
      harvestButton.textContent = cell.state === 'rotten' ? '늦수확' : '수확';
      harvestButton.addEventListener('click', (event) => { event.stopPropagation(); harvest(index); });
      actions.appendChild(harvestButton);
      if (cell.state === 'rotten') {
        const raiseButton = document.createElement('button');
        raiseButton.className = 'raise';
        raiseButton.type = 'button';
        raiseButton.textContent = '해골';
        raiseButton.addEventListener('click', (event) => { event.stopPropagation(); raiseSkeleton(index); });
        actions.appendChild(raiseButton);
      }
      button.appendChild(actions);
    }
    return button;
  }

  function render() {
    if (!state) return;
    el.timeText.textContent = formatTime(RUN_SECONDS - state.elapsed);
    el.waveText.textContent = formatTime(state.waveTimer);
    el.healthText.textContent = Math.max(0, state.health);
    el.goldText.textContent = state.gold;
    el.skeletonText.textContent = state.skeletons;
    el.plantedText.textContent = state.stats.planted;
    el.harvestText.textContent = state.stats.harvested;
    el.rotText.textContent = state.stats.rotted;
    el.clearedText.textContent = state.stats.wavesCleared;
    el.hintText.textContent = state.lastMessage;
    el.waveLog.textContent = `웨이브 ${state.waveNumber + 1}: 필요 방어력 예상 ${2 + (state.waveNumber + 1) * 2}, 현재 방어력 ${state.skeletons * 3}`;
    const enemyPos = 100 - Math.max(0, Math.min(100, (state.waveTimer / WAVE_INTERVAL) * 100));
    el.enemyMarker.style.setProperty('--enemy-pos', `${enemyPos}%`);
    el.grid.innerHTML = '';
    state.cells.forEach((cell, index) => el.grid.appendChild(renderCell(cell, index)));
  }

  function startRun() {
    clearInterval(timer);
    state = newRun();
    logEvent('run_started');
    showScreen('game');
    render();
    timer = setInterval(tick, TICK_MS);
  }

  function copyResult() {
    el.resultJson.select();
    navigator.clipboard?.writeText(el.resultJson.value).catch(() => document.execCommand('copy'));
  }

  document.getElementById('startButton').addEventListener('click', startRun);
  document.getElementById('restartTopButton').addEventListener('click', startRun);
  document.getElementById('retryButton').addEventListener('click', startRun);
  document.getElementById('copyResultButton').addEventListener('click', copyResult);
})();
