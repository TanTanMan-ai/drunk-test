/* 결과 공유 카드 (1080×1920, 인스타 스토리 비율) */
const SHARE = (() => {
  const W = 1080, H = 1920;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawCard(state, res) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const font = (w, s) => `${w} ${s}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1a1b2e'); bg.addColorStop(1, '#0f1020');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, 640, 50, W / 2, 640, 620);
    glow.addColorStop(0, 'rgba(255,107,107,.35)'); glow.addColorStop(1, 'rgba(255,107,107,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.fillStyle = '#9a9cb3';
    ctx.font = font(700, 40); ctx.fillText('주량 테스트 🍻', W / 2, 210);

    ctx.font = font(400, 260); ctx.fillText(res.grade.emoji, W / 2, 620);

    ctx.fillStyle = '#f4f4f8'; ctx.font = font(800, 72);
    const name = state.nickname ? `${state.nickname}님은` : '지금 상태는';
    ctx.fillText(name, W / 2, 780);
    ctx.font = font(900, 120);
    ctx.fillText(res.grade.name, W / 2, 920);

    ctx.fillStyle = '#9a9cb3'; ctx.font = font(600, 40);
    if (res.mode === 'drunk') {
      ctx.fillText('추정 주량', W / 2, 1090);
      const g = ctx.createLinearGradient(240, 0, 840, 0);
      g.addColorStop(0, '#ff6b6b'); g.addColorStop(1, '#feca57');
      ctx.fillStyle = g; ctx.font = font(900, 150);
      ctx.fillText(`소주 ${SCORE.fmtRange(res.range, res.capped)}병`, W / 2, 1250);
      ctx.fillStyle = '#9a9cb3'; ctx.font = font(600, 40);
      ctx.fillText(`지금 추정 혈중알코올농도 ${res.est.bac.toFixed(3)}%`, W / 2, 1340);
    } else {
      ctx.fillText('컨디션 점수', W / 2, 1090);
      ctx.fillStyle = '#feca57'; ctx.font = font(900, 170);
      ctx.fillText(`${res.condition}점`, W / 2, 1260);
      ctx.fillStyle = '#9a9cb3'; ctx.font = font(600, 40);
      ctx.fillText('맨정신 기준 측정', W / 2, 1340);
    }

    // 게임별 저하 바
    const rows = [['초록만 탭!', res.imp.gonogo], ['따라가!', res.imp.track], ['거꾸로!', res.imp.span], ['버텨!', res.imp.balance]].filter(r => r[1] != null);
    let y = 1460;
    for (const [nm, v] of rows) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#f4f4f8'; ctx.font = font(700, 36); ctx.fillText(nm, 160, y + 14);
      ctx.fillStyle = '#23243a'; roundRect(ctx, 340, y - 14, 580, 28, 14); ctx.fill();
      const g = ctx.createLinearGradient(340, 0, 920, 0);
      g.addColorStop(0, '#2ecc71'); g.addColorStop(.5, '#feca57'); g.addColorStop(1, '#ff4757');
      ctx.fillStyle = g; roundRect(ctx, 340, y - 14, Math.max(28, 580 * v), 28, 14); ctx.fill();
      y += 76;
    }

    ctx.textAlign = 'center'; ctx.fillStyle = '#6b6d85'; ctx.font = font(600, 30);
    ctx.fillText('재미로 보는 추정치 · 음주운전 절대 금지', W / 2, 1820);
    return c;
  }

  async function share(state, res) {
    const canvas = drawCard(state, res);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'drunk-test.png', { type: 'image/png' });
    const text = res.mode === 'drunk'
      ? `나 주량 소주 ${SCORE.fmtRange(res.range, res.capped)}병 나옴 🍻 너도 해봐`
      : `주량 테스트 컨디션 ${res.condition}점 😎 너도 해봐`;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '주량 테스트', text });
        return;
      }
      if (navigator.share) { await navigator.share({ title: '주량 테스트', text, url: location.href }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    // 폴백: 이미지 미리보기 (길게 눌러 저장)
    const url = URL.createObjectURL(blob);
    const ov = document.createElement('div');
    ov.className = 'share-preview';
    ov.innerHTML = `<img src="${url}" alt="결과 카드"><p>이미지를 길게 눌러 저장하세요</p><button class="btn ghost">닫기</button>`;
    ov.querySelector('button').onclick = () => { ov.remove(); URL.revokeObjectURL(url); };
    document.body.appendChild(ov);
  }

  return { share, drawCard };
})();
