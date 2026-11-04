/* 화면 흐름: 인트로 → 입력 → 게임 ×4 → 결과 */
const APP = (() => {
  const root = document.getElementById('app');
  const ORDER = ['gonogo', 'track', 'span', 'balance'];
  const HOURS = [[0.5, '30분'], [1, '1시간'], [2, '2시간'], [3, '3시간+']];
  const emptyDrinks = () => Object.fromEntries(Object.keys(BAC.DRINKS).map(k => [k, 0]));

  const state = { nickname: '', sex: 'm', weight: 65, drinks: emptyDrinks(), hours: 1, results: {}, party: [] };
  let cleanup = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function render(html) {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    root.innerHTML = html; window.scrollTo(0, 0);
  }
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];

  /* ── 인트로 ── */
  function intro() {
    render(`
      <section class="screen">
        <div class="hero"><div class="emoji">🍻</div><h1>주량 테스트</h1><p>반응속도·균형·기억력으로<br>1분 만에 재는 내 주량</p></div>
        <div class="spacer"></div>
        <label class="check"><input type="checkbox" id="adult"> 만 19세 이상이에요</label>
        <button class="btn primary" id="go" disabled>시작하기</button>
        <p class="fine">재미로 보는 추정치예요. 결과와 상관없이 음주운전은 절대 금지!</p>
      </section>`);
    $('#adult').onchange = (e) => { $('#go').disabled = !e.target.checked; };
    $('#go').onclick = setup;
  }

  /* ── 입력 ── */
  function setup() {
    state.results = {};
    const drinkRows = Object.entries(BAC.DRINKS).map(([id, d]) => `
      <div class="drink" data-id="${id}">
        <span class="ic">${d.emoji}</span>
        <span class="nm">${d.label}<small>${d.ml}ml · ${d.abv}%</small></span>
        <span class="ctl"><button data-d="-1">−</button><span class="n">0</span><button data-d="1">+</button></span>
      </div>`).join('');
    render(`
      <section class="screen">
        <div><div class="step">1단계</div><h2>오늘 얼마나 마셨어요?</h2></div>
        <div class="card">
          <div class="field"><h3>닉네임 (선택)</h3><input class="text-input" id="nick" maxlength="10" placeholder="결과 카드에 들어가요" value="${esc(state.nickname)}"></div>
          <div class="field"><h3>성별</h3><div class="seg" id="sex"><button data-v="m">남</button><button data-v="f">여</button></div></div>
          <div class="field"><h3>몸무게</h3><div class="range-row"><input type="range" id="w" min="40" max="120" step="1" value="${state.weight}"><output id="wo">${state.weight}kg</output></div></div>
        </div>
        <div class="card">
          <h3>마신 양 (지금까지)</h3>
          <div class="drinks">${drinkRows}</div>
          <div class="summary"><b id="sum">소주 0병</b><span id="sumg">알코올 0g</span></div>
        </div>
        <div class="card">
          <h3>첫 잔 마신 지</h3>
          <div class="chips" id="hours">${HOURS.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>
        </div>
        <button class="btn primary" id="start">테스트 시작 →</button>
        <p class="fine">안 마셨으면 0으로 두고 시작해도 돼요. 맨정신 컨디션 점수가 나와요.</p>
      </section>`);

    const syncSeg = (sel, val) => $$(`${sel} button`).forEach(b => b.classList.toggle('on', b.dataset.v == val));
    syncSeg('#sex', state.sex); syncSeg('#hours', state.hours);
    const updateSummary = () => {
      const est = BAC.estimate(state);
      $('#sum').textContent = `소주 ${est.sojuBottles.toFixed(1)}병 분량`;
      $('#sumg').textContent = `알코올 ${Math.round(est.grams)}g`;
    };
    $$('.drink').forEach(row => {
      const id = row.dataset.id, n = row.querySelector('.n');
      n.textContent = state.drinks[id];
      row.querySelectorAll('button').forEach(b => b.onclick = () => {
        state.drinks[id] = Math.max(0, Math.min(30, state.drinks[id] + Number(b.dataset.d)));
        n.textContent = state.drinks[id]; updateSummary();
      });
    });
    $('#sex').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.sex = b.dataset.v; syncSeg('#sex', state.sex); updateSummary(); };
    $('#hours').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.hours = Number(b.dataset.v); syncSeg('#hours', state.hours); updateSummary(); };
    $('#w').oninput = (e) => { state.weight = Number(e.target.value); $('#wo').textContent = `${state.weight}kg`; updateSummary(); };
    $('#nick').oninput = (e) => { state.nickname = e.target.value.trim(); };
    updateSummary();
    $('#start').onclick = () => brief(0);
  }

  /* ── 게임 안내 ── */
  function brief(i) {
    const g = GAMES[ORDER[i]];
    render(`
      <section class="screen center">
        <div class="step">${i + 1} / ${ORDER.length}</div>
        <div class="emoji big">${g.emoji}</div>
        <h2>${g.name}</h2>
        <p style="color:var(--muted);white-space:pre-line">${g.desc}</p>
        ${g.duration ? `<p class="fine">${g.duration}초</p>` : ''}
        <div class="spacer"></div>
        <button class="btn primary" id="ready">준비 완료</button>
      </section>`);
    $('#ready').onclick = () => play(i);
  }

  /* ── 게임 실행 ── */
  function play(i) {
    const id = ORDER[i];
    const g = GAMES[id];
    render(`<section class="screen play"><header><span id="gname">${g.emoji} ${g.name}</span><span>${i + 1}/${ORDER.length}</span></header><div id="stage"></div></section>`);
    const stage = $('#stage');
    const next = () => (i + 1 < ORDER.length ? brief(i + 1) : result());

    const launch = (game, done, fallback) => {
      const start = () => { cleanup = game.run(stage, done, fallback); };
      if (!game.countdown) return start();
      // 카운트다운이 끝난 뒤에 게임을 시작한다
      stage.innerHTML = `<div class="game-area"></div>`;
      GAMES.countdown(stage.firstElementChild, start);
    };
    if (id === 'balance') {
      launch(g, (r) => { state.results.balance = r; next(); }, () => {
        // 센서 불가 → 똑바로! 로 조용히 전환
        state.results.balanceFallback = true;
        $('#gname').textContent = `${GAMES.line.emoji} ${GAMES.line.name}`;
        stage.innerHTML = '';
        launch(GAMES.line, (r) => { state.results.line = r; next(); });
      });
    } else {
      launch(g, (r) => { state.results[id] = r; next(); });
    }
  }

  /* ── 결과 ── */
  function result() {
    const res = SCORE.compute(state);
    state.party.push({ nickname: state.nickname || `${state.party.length + 1}번째 사람`, res });
    const r = state.results;
    const bars = [
      ['참아!', res.imp.gonogo, r.gonogo ? `${Math.round(r.gonogo.rt)}ms · 실수 ${r.gonogo.fa}` : ''],
      ['따라가!', res.imp.track, r.track ? `오차 ${Math.round(r.track.dist)}px` : ''],
      ['거꾸로!', res.imp.span, r.span ? `${r.span.len}자리` : ''],
      [r.balance ? '버텨!' : '똑바로!', res.imp.balance, r.balance ? `흔들림 ${r.balance.sway.toFixed(2)}` : r.line ? `편차 ${Math.round(r.line.dev)}px` : ''],
    ].filter(b => b[1] != null);

    const bac = res.est.bac;
    const badge = bac >= 0.08 ? `<span class="badge warn">면허취소 기준(0.08%) 초과</span>`
      : bac >= 0.03 ? `<span class="badge warn">면허정지 기준(0.03%) 초과</span>`
      : res.mode === 'drunk' ? `<span class="badge ok">운전 기준 미만 (그래도 운전은 X)</span>` : '';

    const headline = res.mode === 'drunk' ? `
      <div class="headline">
        <div class="label">${state.nickname ? esc(state.nickname) + '님의 ' : ''}추정 주량</div>
        <div class="value">소주 ${SCORE.fmtRange(res.range, res.capped)}병</div>
        <div class="sub">마신 양 소주 ${res.est.sojuBottles.toFixed(1)}병 분량 · 추정 혈중알코올농도 ${bac.toFixed(3)}%</div>
        ${badge}
        ${res.capped ? `<div class="sub">측정 한계까지 멀쩡해요. 이 이상은 알 수 없어요.</div>` : ''}
      </div>` : `
      <div class="headline">
        <div class="label">맨정신 컨디션 점수</div>
        <div class="value">${res.condition}점</div>
        <div class="sub">${bac > 0 ? `마신 양이 적어서 주량 계산은 생략했어요 (추정 ${bac.toFixed(3)}%)` : '술 마신 뒤 다시 하면 주량이 나와요'}</div>
      </div>`;

    const board = state.party.length > 1 ? `
      <div class="card"><h3>오늘 술자리 순위</h3><div class="board">
        ${state.party.slice().sort((a, b) => (b.res.bottles || 0) - (a.res.bottles || 0) || b.res.condition - a.res.condition)
          .map((p, i) => `<div class="row"><span class="rk">${i + 1}</span><span class="nm">${esc(p.nickname)}</span><span class="vl">${p.res.mode === 'drunk' ? `${SCORE.fmtBottles(p.res.bottles)}병` : `${p.res.condition}점`}</span></div>`).join('')}
      </div></div>` : '';

    render(`
      <section class="screen result">
        <div class="grade"><div class="emoji">${res.grade.emoji}</div><h2>${res.grade.name}</h2><p>${res.grade.desc}</p></div>
        ${headline}
        <div class="card"><h3>게임별 저하 정도</h3><div class="bars">
          ${bars.map(([nm, v, vl]) => `<div class="bar"><span class="nm">${nm}</span><span class="tr"><span class="fl" style="width:${Math.max(4, Math.round(v * 100))}%"></span></span><span class="vl">${vl}</span></div>`).join('')}
        </div></div>
        ${board}
        <button class="btn primary" id="share">결과 공유하기</button>
        <div class="btn-row"><button class="btn" id="nextp">다음 사람 🙋</button><button class="btn ghost" id="restart">처음부터</button></div>
        <details><summary>어떻게 계산했나요?</summary>
          <p>마신 양과 성별·몸무게로 Widmark 공식을 써서 지금 혈중알코올농도를 추정해요. 그리고 반응속도·충동 억제·추적·기억·균형 네 가지 테스트로 실제 기능이 얼마나 떨어졌는지 재요. 보통 사람이 그 정도로 떨어지려면 농도가 얼마여야 하는지와 비교해서, 마신 것에 비해 덜 떨어졌으면 주량이 높다고 봐요.</p>
          <p>기기와 컨디션에 따라 오차가 커요. 어디까지나 재미로 봐주세요. 주량이 높게 나와도 간은 똑같이 일하고 있어요.</p>
        </details>
        <p class="fine">재미로 보는 추정치 · 음주운전 절대 금지</p>
      </section>`);
    $('#share').onclick = () => SHARE.share(state, res);
    $('#nextp').onclick = () => { state.nickname = ''; state.drinks = emptyDrinks(); state.results = {}; setup(); };
    $('#restart').onclick = () => { state.party = []; state.nickname = ''; state.drinks = emptyDrinks(); state.results = {}; intro(); };
  }

  intro();
  return { state };
})();
