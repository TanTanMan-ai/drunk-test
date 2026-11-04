/* 미니게임. 각 게임: run(host, done[, fallback]) → done(result) */
const GAMES = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const rand = (a, b) => a + Math.random() * (b - a);

  function fmtTime(ms) { return Math.max(0, ms / 1000).toFixed(1); }

  // 3·2·1 카운트다운 오버레이
  function countdown(host, onGo) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    host.appendChild(ov);
    let n = 3;
    const tick = () => {
      if (n > 0) {
        ov.innerHTML = `<span class="pop">${n}</span>`;
        n--;
        setTimeout(tick, 700);
      } else {
        ov.innerHTML = `<span class="pop">시작!</span>`;
        setTimeout(() => { ov.remove(); onGo(); }, 450);
      }
    };
    tick();
  }

  // 타이머 루프 (남은 시간 표시 + 종료 콜백)
  function runTimer(el, durationMs, onEnd) {
    const start = performance.now();
    let raf, ended = false;
    const loop = () => {
      const left = durationMs - (performance.now() - start);
      el.textContent = fmtTime(left);
      if (left <= 0) { if (!ended) { ended = true; onEnd(); } return; }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { ended = true; cancelAnimationFrame(raf); };
  }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }

  /* ───────── 1. 참아! (Go/No-Go) ───────── */
  const gonogo = {
    id: 'gonogo', name: '참아!', emoji: '🟢', duration: 15, countdown: true,
    desc: '초록 원이 뜨면 최대한 빨리 탭!\n빨간 원은 절대 누르지 마세요.',
    run(host, done) {
      host.innerHTML = `<div class="game-area gng"><div class="timer">15.0</div><div class="stim"></div><div class="feedback"></div></div>`;
      const area = $('.gng', host), stim = $('.stim', host), fb = $('.feedback', host), timerEl = $('.timer', host);
      const rts = []; let fa = 0, miss = 0, hits = 0;
      let stimOn = null, color = null, showT = null, hideT = null, stopTimer = null, finished = false;
      const DURATION = 15000;
      const start = performance.now();

      const flash = (txt, cls) => {
        fb.textContent = txt; fb.className = `feedback show ${cls}`;
        setTimeout(() => fb.classList.remove('show'), 120);
      };
      const place = () => {
        const r = area.getBoundingClientRect();
        const s = 110;
        stim.style.left = rand(12, r.width - s - 12) + 'px';
        stim.style.top = rand(60, r.height - s - 12) + 'px';
      };
      const schedule = () => { showT = setTimeout(show, rand(500, 1300)); };
      const show = () => {
        if (finished || performance.now() - start > DURATION - 900) return;
        color = Math.random() < 0.7 ? 'green' : 'red';
        place();
        stim.className = `stim show ${color}`;
        stimOn = performance.now();
        hideT = setTimeout(hide, 900);
      };
      const hide = () => {
        if (stimOn && color === 'green') miss++;
        stimOn = null; stim.className = 'stim';
        schedule();
      };
      const onTap = (e) => {
        e.preventDefault();
        if (!stimOn) return;
        const rt = performance.now() - stimOn;
        clearTimeout(hideT);
        if (color === 'green') { if (rt > 120) { rts.push(rt); hits++; flash(`${Math.round(rt)}ms`, 'good'); } }
        else { fa++; flash('앗! 빨강!', 'bad'); }
        stimOn = null; stim.className = 'stim';
        schedule();
      };
      area.addEventListener('pointerdown', onTap);

      const finish = () => {
        finished = true;
        clearTimeout(showT); clearTimeout(hideT);
        area.removeEventListener('pointerdown', onTap);
        done({ rt: rts.length ? mean(rts) : 650, fa, miss, hits });
      };
      stopTimer = runTimer(timerEl, DURATION, finish);
      schedule();
      return () => { finished = true; stopTimer && stopTimer(); clearTimeout(showT); clearTimeout(hideT); };
    },
  };

  /* ───────── 2. 따라가! (추적) ───────── */
  const track = {
    id: 'track', name: '따라가!', emoji: '🎯', duration: 10, countdown: false,
    desc: '떠다니는 원 위에 손가락을 계속 올려두세요.\n손을 떼면 감점!',
    run(host, done) {
      host.innerHTML = `<div class="game-area trk"><canvas></canvas><div class="timer">10.0</div><div class="hint">원을 누르면 시작돼요</div></div>`;
      const area = $('.trk', host), canvas = $('canvas', host), hint = $('.hint', host), timerEl = $('.timer', host);
      const { ctx, w, h } = setupCanvas(canvas);
      const R = 36, MAXD = 120, DURATION = 10000;
      let pointer = null, started = false, t0 = 0, raf = 0, finished = false;
      const samples = [];
      const cx = w / 2, cy = h / 2;
      const ax = (w / 2 - R - 16), ay = (h / 2 - R - 16);
      // t=0에 정중앙에서 출발하도록 위상은 0, 방향만 무작위
      const sx = Math.random() < 0.5 ? -1 : 1, sy = Math.random() < 0.5 ? -1 : 1;
      const target = (t) => ({
        x: cx + sx * ax * (0.65 * Math.sin(1.1 * t) + 0.35 * Math.sin(2.3 * t)),
        y: cy + sy * ay * (0.65 * Math.sin(0.9 * t) + 0.35 * Math.sin(2.7 * t)),
      });
      let tp = { x: cx, y: cy };

      const getPos = (e) => { const r = area.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      const onDown = (e) => {
        e.preventDefault(); area.setPointerCapture(e.pointerId);
        pointer = getPos(e);
        if (!started && Math.hypot(pointer.x - tp.x, pointer.y - tp.y) <= R + 10) {
          started = true; t0 = performance.now(); hint.textContent = '';
          runTimer(timerEl, DURATION, finish);
        }
      };
      const onMove = (e) => { if (pointer) pointer = getPos(e); };
      const onUp = () => { pointer = null; };
      area.addEventListener('pointerdown', onDown);
      area.addEventListener('pointermove', onMove);
      area.addEventListener('pointerup', onUp);
      area.addEventListener('pointercancel', onUp);

      const draw = () => {
        if (finished) return;
        const t = started ? (performance.now() - t0) / 1000 : 0;
        tp = target(t);
        let d = MAXD, on = false;
        if (pointer) { d = Math.min(MAXD, Math.hypot(pointer.x - tp.x, pointer.y - tp.y)); on = d <= R; }
        if (started) samples.push(d);
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath(); ctx.arc(tp.x, tp.y, R, 0, Math.PI * 2);
        ctx.fillStyle = !started ? '#feca57' : on ? '#2ecc71' : '#ff4757';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 30; ctx.fill(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
        if (pointer) { ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 10, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill(); }
        raf = requestAnimationFrame(draw);
      };
      draw();

      const finish = () => {
        if (finished) return;
        finished = true; cancelAnimationFrame(raf);
        done({ dist: samples.length ? mean(samples) : MAXD, onRatio: samples.filter(d => d <= R).length / Math.max(1, samples.length) });
      };
      return () => { finished = true; cancelAnimationFrame(raf); };
    },
  };

  /* ───────── 3. 거꾸로! (숫자 역순 기억) ───────── */
  const span = {
    id: 'span', name: '거꾸로!', emoji: '🔢', duration: null, countdown: true,
    desc: '숫자가 하나씩 지나가요.\n끝나면 거꾸로 순서대로 입력하세요.',
    run(host, done) {
      host.innerHTML = `
        <div class="game-area spn">
          <div class="status">잘 보세요</div>
          <div class="digit"></div>
          <div class="entry"></div>
          <div class="keypad" aria-disabled="true">
            ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
            <button data-k="back">⌫</button><button data-k="0">0</button><button data-k="clear">C</button>
          </div>
        </div>`;
      const digitEl = $('.digit', host), status = $('.status', host), entryEl = $('.entry', host), pad = $('.keypad', host);
      let len = 3, fails = 0, best = 2, seq = [], entry = '', alive = true, inputOn = false;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      const render = () => { entryEl.textContent = entry.split('').join(' '); };
      const genSeq = (n) => {
        const s = [];
        while (s.length < n) { const d = Math.floor(Math.random() * 10); if (s[s.length - 1] !== d) s.push(d); }
        return s;
      };
      async function round() {
        if (!alive) return;
        seq = genSeq(len); entry = ''; render();
        pad.setAttribute('aria-disabled', 'true'); inputOn = false;
        status.textContent = `${len}자리 · 잘 보세요`;
        await sleep(500);
        for (const d of seq) {
          if (!alive) return;
          digitEl.textContent = d; digitEl.classList.remove('pop'); void digitEl.offsetWidth; digitEl.classList.add('pop');
          await sleep(600);
          digitEl.textContent = '';
          await sleep(220);
        }
        status.textContent = '거꾸로 입력!';
        pad.setAttribute('aria-disabled', 'false'); inputOn = true;
      }
      async function judge() {
        inputOn = false; pad.setAttribute('aria-disabled', 'true');
        const ok = entry === seq.slice().reverse().join('');
        if (ok) {
          best = len; fails = 0; len++;
          status.textContent = '정답! 한 자리 추가 🔥';
          if (len > 8) { await sleep(700); return finish(); }
        } else {
          fails++;
          status.textContent = fails >= 2 ? `정답은 ${seq.slice().reverse().join('')}` : '아쉽! 같은 자리수로 한 번 더';
          if (fails >= 2) { await sleep(1100); return finish(); }
        }
        await sleep(800);
        round();
      }
      const onKey = (e) => {
        const b = e.target.closest('button'); if (!b || !inputOn) return;
        const k = b.dataset.k;
        if (k === 'back') entry = entry.slice(0, -1);
        else if (k === 'clear') entry = '';
        else if (entry.length < len) entry += k;
        render();
        if (entry.length === len) judge();
      };
      pad.addEventListener('pointerdown', onKey);
      const finish = () => { if (!alive) return; alive = false; done({ len: best }); };
      round();
      return () => { alive = false; };
    },
  };

  /* ───────── 4. 버텨! (균형, 가속도 센서) ───────── */
  const balance = {
    id: 'balance', name: '버텨!', emoji: '🧘', duration: 10, countdown: false,
    desc: '폰을 손바닥 위에 수평으로 올리고\n10초만 가만히 버티세요.',
    run(host, done, fallback) {
      host.innerHTML = `<div class="game-area bal"><div class="level"><div class="bubble"></div></div><div class="timer">10.0</div><div class="hint">준비되면 화면을 탭하세요</div></div>`;
      const area = $('.bal', host), bubble = $('.bubble', host), hint = $('.hint', host), timerEl = $('.timer', host);
      const DURATION = 10000;
      let handler = null, alive = true, started = false, armed = false;
      const samples = [];

      const cleanup = () => { if (handler) window.removeEventListener('devicemotion', handler); handler = null; };
      const bail = () => { if (!alive) return; alive = false; cleanup(); fallback(); };

      async function begin() {
        if (armed) return; armed = true;
        hint.textContent = '센서 확인 중…';
        if (typeof DeviceMotionEvent === 'undefined') return bail();
        try {
          if (typeof DeviceMotionEvent.requestPermission === 'function') {
            const r = await DeviceMotionEvent.requestPermission();
            if (r !== 'granted') return bail();
          }
        } catch (e) { return bail(); }
        let got = false;
        handler = (e) => {
          const a = e.accelerationIncludingGravity;
          if (!a || a.x == null) return;
          got = true;
          const mag = Math.hypot(a.x, a.y, a.z);
          const tx = Math.max(-1, Math.min(1, a.x / 9.8)), ty = Math.max(-1, Math.min(1, a.y / 9.8));
          bubble.style.transform = `translate(calc(-50% + ${-tx * 80}px), calc(-50% + ${ty * 80}px))`;
          if (!started) { started = true; hint.textContent = '가만히…'; runTimer(timerEl, DURATION, finish); }
          samples.push(mag);
        };
        window.addEventListener('devicemotion', handler);
        setTimeout(() => { if (!got) bail(); }, 1500);
      }
      const onTap = (e) => { e.preventDefault(); begin(); };
      area.addEventListener('pointerdown', onTap, { once: true });

      const finish = () => {
        if (!alive) return; alive = false; cleanup();
        // 이동평균 대비 잔차의 RMS = 흔들림
        const W = 8; let acc = 0, n = 0;
        for (let i = W; i < samples.length; i++) {
          let m = 0; for (let j = i - W; j < i; j++) m += samples[j]; m /= W;
          const d = samples[i] - m; acc += d * d; n++;
        }
        const sway = n ? Math.sqrt(acc / n) : 0.3;
        done({ sway, n: samples.length });
      };
      return () => { alive = false; cleanup(); };
    },
  };

  /* ───────── 5. 똑바로! (직선 긋기, 센서 대체용) ───────── */
  const line = {
    id: 'line', name: '똑바로!', emoji: '📏', duration: null, countdown: false,
    desc: '왼쪽 점에서 오른쪽 점까지\n손가락으로 똑바로 그으세요.',
    run(host, done) {
      host.innerHTML = `<div class="game-area lin"><canvas></canvas><div class="hint">왼쪽 점에서 시작해 오른쪽 점에서 손을 떼세요</div></div>`;
      const area = $('.lin', host), canvas = $('canvas', host), hint = $('.hint', host);
      const { ctx, w, h } = setupCanvas(canvas);
      const A = { x: w * 0.14, y: h * 0.56 }, B = { x: w * 0.86, y: h * 0.44 };
      const START_R = 44, END_R = 52;
      let pts = [], drawing = false, attempts = 0, alive = true;
      const devs = [];

      const getPos = (e) => { const r = area.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      const perp = (p) => {
        const dx = B.x - A.x, dy = B.y - A.y;
        return Math.abs(dy * p.x - dx * p.y + B.x * A.y - B.y * A.x) / Math.hypot(dx, dy);
      };
      const draw = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.setLineDash([6, 10]); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
        for (const [p, c] of [[A, '#2ecc71'], [B, '#feca57']]) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 25; ctx.fill(); ctx.shadowBlur = 0;
        }
        if (pts.length > 1) {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (const p of pts) ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
        }
      };
      draw();

      const onDown = (e) => {
        e.preventDefault(); const p = getPos(e);
        if (Math.hypot(p.x - A.x, p.y - A.y) > START_R) { hint.textContent = '초록 점에서 시작하세요'; return; }
        area.setPointerCapture(e.pointerId); drawing = true; pts = [p]; hint.textContent = ''; draw();
      };
      const onMove = (e) => { if (!drawing) return; pts.push(getPos(e)); draw(); };
      const onUp = (e) => {
        if (!drawing) return; drawing = false;
        const last = pts[pts.length - 1];
        attempts++;
        if (Math.hypot(last.x - B.x, last.y - B.y) > END_R || pts.length < 3) {
          if (attempts >= 3) return finish(40);
          hint.textContent = '노란 점까지 한 번에 그어주세요'; pts = []; draw(); return;
        }
        // 이벤트가 드문드문 와도 공정하게: 선분을 4px 간격으로 보간해서 편차 계산
        const dense = [];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
          for (let k = 0; k < n; k++) dense.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
        }
        dense.push(last);
        finish(mean(dense.map(perp)));
      };
      area.addEventListener('pointerdown', onDown);
      area.addEventListener('pointermove', onMove);
      area.addEventListener('pointerup', onUp);
      area.addEventListener('pointercancel', onUp);

      const finish = (dev) => { if (!alive) return; alive = false; setTimeout(() => done({ dev }), 350); };
      return () => { alive = false; };
    },
  };

  return { gonogo, track, span, balance, line, countdown };
})();
