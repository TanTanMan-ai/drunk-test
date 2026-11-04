/* 게임 결과 → 기능 저하 지수 → 등가 BAC → 주량 */
const SCORE = (() => {
  // [맨정신 기준, 많이 취함 기준] — 고정 평균값. 데이터 쌓이면 조정.
  const ANCHORS = {
    gonogo:  { rt: [380, 550], fa: [1, 4] },
    track:   { dist: [25, 70] },
    span:    { len: [5, 3] },       // 낮을수록 나쁨
    balance: { sway: [0.08, 0.25] },
    line:    { dev: [8, 25] },
  };
  const WEIGHTS = { gonogo: 0.3, track: 0.3, span: 0.2, balance: 0.2 };
  const MAX_EQ_BAC = 0.12;

  const GRADES = [
    { max: 0.02, name: '멀쩡',  emoji: '😎', desc: '아직 시작도 안 한 수준이에요.' },
    { max: 0.05, name: '알딸딸', emoji: '🙂', desc: '기분 좋게 올라오는 중.' },
    { max: 0.08, name: '취함',  emoji: '😵‍💫', desc: '슬슬 말이 많아지는 구간.' },
    { max: 9,    name: '만취',  emoji: '🫠', desc: '오늘은 여기까지. 대리 부르세요.' },
  ];

  // 안 마셨을 때(맨정신 모드)는 취기 대신 컨디션으로 표현
  const SOBER_GRADES = [
    { max: 0.02, name: '쌩쌩',  emoji: '😎', desc: '반응이 아주 좋아요. 오늘 컨디션 최상!' },
    { max: 0.05, name: '보통',  emoji: '🙂', desc: '평범한 하루의 컨디션이에요.' },
    { max: 0.08, name: '피곤',  emoji: '😪', desc: '좀 느려요. 커피 한 잔 어때요?' },
    { max: 9,    name: '방전',  emoji: '🫠', desc: '맨정신인데 이 정도면… 일찍 자요.' },
  ];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const norm = (v, [a, b]) => clamp((v - a) / (b - a), 0, 1);

  function impairments(results) {
    const imp = {};
    if (results.gonogo) {
      const g = results.gonogo;
      imp.gonogo = 0.6 * norm(g.rt, ANCHORS.gonogo.rt) + 0.4 * norm(g.fa, ANCHORS.gonogo.fa);
    }
    if (results.track) imp.track = norm(results.track.dist, ANCHORS.track.dist);
    if (results.span) imp.span = norm(results.span.len, ANCHORS.span.len);
    if (results.balance) imp.balance = norm(results.balance.sway, ANCHORS.balance.sway);
    else if (results.line) imp.balance = norm(results.line.dev, ANCHORS.line.dev);
    return imp;
  }

  function compute(state) {
    const imp = impairments(state.results);
    let wsum = 0, acc = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) {
      if (imp[k] == null) continue;
      acc += w * imp[k];
      wsum += w;
    }
    const composite = wsum ? acc / wsum : 0;         // 0 (멀쩡) ~ 1 (만취)
    const eqBac = composite * MAX_EQ_BAC;             // 평균인이면 이 정도 BAC에서 나올 저하
    const est = BAC.estimate(state);
    const table = est.bac >= 0.02 ? GRADES : SOBER_GRADES;
    const grade = table.find(g => eqBac < g.max) || table[table.length - 1];
    const condition = Math.round((1 - composite) * 100);

    const out = { imp, composite, eqBac, est, grade, condition, mode: 'sober' };

    if (est.bac >= 0.02) {
      // 내성 배율 = 마신 만큼 추정되는 BAC ÷ 실제 저하로 보이는 BAC
      const ratio = clamp(est.bac / Math.max(eqBac, 0.015), 0.3, 3);
      const avgBottles = 0.08 / BAC.bacPerSojuBottle(state.sex, state.weight); // 평균인이 0.08%에 닿는 병 수
      const bottles = avgBottles * ratio;
      out.mode = 'drunk';
      out.ratio = ratio;
      out.capped = ratio >= 3;
      out.bottles = bottles;
      out.range = [bottles * 0.8, bottles * 1.2];
    }
    return out;
  }

  // 0.5병 단위, 최소 0.5
  function fmtBottles(n) { return String(Math.max(0.5, Math.round(n * 2) / 2)); }
  // "2~3" 또는 양끝이 같으면 "2.5"
  function fmtRange([a, b], capped) {
    const lo = fmtBottles(a), hi = fmtBottles(b);
    return (lo === hi ? lo : `${lo}~${hi}`) + (capped ? '+' : '');
  }

  return { ANCHORS, WEIGHTS, GRADES, SOBER_GRADES, compute, fmtBottles, fmtRange };
})();
