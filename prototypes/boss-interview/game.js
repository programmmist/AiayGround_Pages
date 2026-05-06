(() => {
  const MAX_TURNS = 7;
  const weaknesses = {
    pride: '자존심',
    fear: '두려움',
    greed: '탐욕',
  };
  const bosses = [
    { name: '백작 볼트니아', bio: '모든 패배를 부하 탓으로 돌리는 전격 성채의 주인.', weakness: 'pride' },
    { name: '심해 사장 모르핀', bio: '계약서와 침묵으로 도시를 삼킨 해저 재벌.', weakness: 'greed' },
    { name: '거울 여왕 세라핀', bio: '예언을 독점해 반란을 막는 무대 위 독재자.', weakness: 'fear' },
  ];
  const cards = [
    {
      id: 'legacy', title: '전성기 질문', desc: '가장 자랑스러운 승리를 묻는다.', pressure: 1,
      responses: {
        pride: ['“내 전성기? 아직 시작도 안 했지.”', '과장된 연대기를 세 번 고쳐 말한다.', '자존심 단서: 업적을 의심받자 답변이 길어진다.'],
        fear: ['“과거는 중요하지 않아. 다음 질문.”', '승리 이야기를 피하고 경호원을 확인한다.', '두려움 단서: 과거보다 미래의 위협을 더 경계한다.'],
        greed: ['“그 승리 덕에 세금 징수권을 얻었지.”', '영광보다 수익 배분을 먼저 계산한다.', '탐욕 단서: 명예보다 보상을 기억한다.'],
      }
    },
    {
      id: 'loss', title: '패배 기록', desc: '숨긴 실패 사례를 찌른다.', pressure: 2,
      responses: {
        pride: ['“패배가 아니라 전략적 양보였다.”', '실패라는 단어에 즉시 말을 끊는다.', '자존심 단서: 패배 표현을 견디지 못한다.'],
        fear: ['“그 이름은 어디서 들었지?”', '손가락이 떨리고 퇴로 쪽을 본다.', '두려움 단서: 특정 실패보다 그 실패를 만든 적을 겁낸다.'],
        greed: ['“손실은 보험금으로 메웠다.”', '피해자보다 장부 손실을 먼저 언급한다.', '탐욕 단서: 실패를 돈의 손익으로만 본다.'],
      }
    },
    {
      id: 'hostage', title: '인질 교환', desc: '부하 하나와 보물 하나 중 무엇을 구할지 묻는다.', pressure: 1,
      responses: {
        pride: ['“내 부하는 나를 위해 죽는 걸 영광으로 안다.”', '선택지를 모욕으로 받아들인다.', '자존심 단서: 타인의 생존보다 자신의 위신을 우선한다.'],
        fear: ['“함정일 수 있어. 아무도 움직이지 마.”', '구출보다 매복 가능성을 길게 따진다.', '두려움 단서: 손실보다 위험 노출을 두려워한다.'],
        greed: ['“보물의 정확한 감정가는?”', '인질 이름은 묻지 않고 보관 위치를 묻는다.', '탐욕 단서: 사람보다 물건의 가치 평가에 집착한다.'],
      }
    },
    {
      id: 'rumor', title: '소문 흘리기', desc: '거짓 정보를 던져 반응을 본다.', pressure: 2,
      responses: {
        pride: ['“누가 감히 그런 말을!”', '사실 여부보다 소문을 낸 자의 처벌을 명령한다.', '자존심 단서: 이미지 손상을 즉시 응징하려 한다.'],
        fear: ['“그들이 벌써 알아냈나?”', '거짓 소문을 사실로 착각하고 방어 계획을 말한다.', '두려움 단서: 존재하지 않는 위협에도 과잉 반응한다.'],
        greed: ['“그 정보, 사려는 자가 있겠군.”', '소문을 팔 시장부터 계산한다.', '탐욕 단서: 위기 정보도 상품으로 본다.'],
      }
    },
  ];

  const screens = { start: byId('startScreen'), game: byId('gameScreen'), result: byId('resultScreen') };
  const el = {
    bossName: byId('bossName'), bossBio: byId('bossBio'), turnText: byId('turnText'), pressureText: byId('pressureText'), contradictionText: byId('contradictionText'),
    dialogue: byId('dialogue'), cards: byId('cards'), evidenceList: byId('evidenceList'), resultTitle: byId('resultTitle'), resultSummary: byId('resultSummary'), resultStats: byId('resultStats'), resultJson: byId('resultJson')
  };
  let state;
  function byId(id) { return document.getElementById(id); }
  function show(name) { Object.values(screens).forEach(s => s.classList.remove('screen-active')); screens[name].classList.add('screen-active'); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function start() {
    const boss = pick(bosses);
    state = { boss, turns: MAX_TURNS, pressure: 0, contradictions: 0, asked: [], evidence: [], score: 0, finished: false };
    el.bossName.textContent = boss.name;
    el.bossBio.textContent = boss.bio;
    el.dialogue.innerHTML = `<span class="speaker">${boss.name}</span>\n“질문은 ${MAX_TURNS}개까지다. 그 안에 날 꺾을 수 있겠나?”`;
    show('game');
    render();
  }
  function ask(card) {
    if (state.finished || state.turns <= 0) return;
    state.turns -= 1;
    state.pressure += card.pressure;
    state.asked.push(card.id);
    const pack = card.responses[state.boss.weakness];
    const contradiction = state.asked.length > 1 && Math.random() < 0.32 + state.pressure * 0.035;
    if (contradiction) state.contradictions += 1;
    const extra = contradiction ? '\n\n[모순] 이전 답변과 시간/동기가 맞지 않는다.' : '';
    state.evidence.unshift(pack[2] + (contradiction ? ' + 모순 발생' : ''));
    state.score += 10 + card.pressure * 5 + (contradiction ? 12 : 0);
    el.dialogue.innerHTML = `<span class="speaker">질문: ${card.title}</span>\n${card.desc}\n\n<span class="speaker">${state.boss.name}</span>\n${pack[0]}\n${pack[1]}${extra}`;
    if (state.turns <= 0) finish(false, '턴을 모두 사용했다.');
    render();
  }
  function accuse(type) {
    if (state.finished) return;
    const correct = type === state.boss.weakness;
    finish(correct, correct ? `${weaknesses[type]}을 정확히 찔렀다.` : `${weaknesses[type]} 지목은 빗나갔다. 실제 약점은 ${weaknesses[state.boss.weakness]}.`);
  }
  function finish(win, reason) {
    state.finished = true;
    const confidence = Math.min(100, Math.round(state.score + state.contradictions * 8 + state.turns * 4));
    const report = {
      id: 'boss-interview', boss: state.boss.name, hiddenWeakness: weaknesses[state.boss.weakness], win, reason,
      questionsAsked: MAX_TURNS - state.turns, turnsRemaining: state.turns, pressure: state.pressure, contradictions: state.contradictions, confidence,
      validationQuestion: '공격 대신 질문 카드로 보스의 거짓말/회피 패턴을 읽는 추론 루프가 5분 안에 재미 신호를 내는가?'
    };
    el.resultTitle.textContent = win ? '심문 성공' : '심문 실패';
    el.resultSummary.textContent = win ? '질문 선택과 반응 단서만으로 약점을 맞혔습니다. 다음 확인 포인트는 “읽었다”는 느낌이 충분했는지입니다.' : reason;
    el.resultStats.innerHTML = Object.entries({질문: report.questionsAsked, 남은턴: report.turnsRemaining, 압박: report.pressure, 모순: report.contradictions, 확신도: report.confidence}).map(([k,v]) => `<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
    el.resultJson.textContent = JSON.stringify(report, null, 2);
    show('result');
  }
  function render() {
    el.turnText.textContent = state.turns;
    el.pressureText.textContent = state.pressure;
    el.contradictionText.textContent = state.contradictions;
    el.cards.innerHTML = cards.map(c => `<button class="card" data-card="${c.id}"><strong>${c.title}</strong><span>${c.desc}<br>압박 +${c.pressure}</span></button>`).join('');
    el.evidenceList.innerHTML = state.evidence.length ? state.evidence.slice(0, 6).map(e => `<li>${e}</li>`).join('') : '<li>아직 단서가 없습니다.</li>';
    el.cards.querySelectorAll('[data-card]').forEach(btn => btn.addEventListener('click', () => ask(cards.find(c => c.id === btn.dataset.card))));
  }
  byId('startButton').addEventListener('click', start);
  byId('retryButton').addEventListener('click', start);
  document.querySelectorAll('[data-accuse]').forEach(btn => btn.addEventListener('click', () => accuse(btn.dataset.accuse)));
})();
