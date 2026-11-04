/* 음주량 → 혈중알코올농도(BAC) 추정. Widmark 공식 기반. */
const BAC = (() => {
  const ETHANOL_DENSITY = 0.789; // g/ml

  // 한국 술자리 기준 1단위
  const DRINKS = {
    soju:      { label: '소주',   unit: '잔', ml: 50,  abv: 16.5, emoji: '🍶' },
    beer:      { label: '맥주',   unit: '잔', ml: 500, abv: 4.5,  emoji: '🍺' },
    somaek:    { label: '소맥',   unit: '잔', ml: 250, abv: 7.5,  emoji: '🍻' },
    highball:  { label: '하이볼', unit: '잔', ml: 300, abv: 8,    emoji: '🥤' },
    wine:      { label: '와인',   unit: '잔', ml: 150, abv: 12,   emoji: '🍷' },
    whisky:    { label: '양주',   unit: '샷', ml: 45,  abv: 40,   emoji: '🥃' },
    makgeolli: { label: '막걸리', unit: '잔', ml: 200, abv: 6,    emoji: '🍚' },
  };

  const SOJU_BOTTLE_G = 360 * 0.165 * ETHANOL_DENSITY; // ≈ 46.9g
  const ELIMINATION_PER_HOUR = 0.015; // %/h

  const rFactor = (sex) => (sex === 'f' ? 0.55 : 0.68);

  function grams(drinks) {
    let g = 0;
    for (const [id, n] of Object.entries(drinks)) {
      const d = DRINKS[id];
      if (!d || !n) continue;
      g += n * d.ml * (d.abv / 100) * ETHANOL_DENSITY;
    }
    return g;
  }

  // sex: 'm' | 'f', weight: kg, drinks: {id: count}, hours: 첫 잔 이후 경과 시간
  function estimate({ sex, weight, drinks, hours }) {
    const A = grams(drinks);
    const peak = (A / (rFactor(sex) * weight)) * 0.1; // g/kg(‰) → %
    const bac = Math.max(0, peak - ELIMINATION_PER_HOUR * Math.max(0, hours));
    return { grams: A, peak, bac, sojuBottles: A / SOJU_BOTTLE_G };
  }

  // 이 사람 몸에서 소주 한 병이 올리는 BAC(%)
  function bacPerSojuBottle(sex, weight) {
    return (SOJU_BOTTLE_G / (rFactor(sex) * weight)) * 0.1;
  }

  return { DRINKS, SOJU_BOTTLE_G, estimate, bacPerSojuBottle, grams };
})();
