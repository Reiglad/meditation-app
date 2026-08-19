// health-chart.js
// 健康記録（睡眠の質・気分・ストレス・エネルギー・集中力）の推移を示す
// シンプルな折れ線グラフを Canvas 2D API で自前描画する（外部ライブラリ不使用）。

const HealthChart = (() => {
  return {
    /**
     * 折れ線グラフを描画する
     * @param {HTMLCanvasElement} canvas
     * @param {Array<{date: string, value: number|null}>} points - value は1〜5、欠損はnull
     * @param {string} color - 線・点の色（CSSカラー文字列）
     */
    draw(canvas, points, color) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || canvas.clientWidth || 300;
      const height = rect.height || canvas.clientHeight || 140;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (points.length === 0) return;

      const padding = { top: 14, right: 10, bottom: 20, left: 8 };
      const w = width - padding.left - padding.right;
      const h = height - padding.top - padding.bottom;

      const yFor = (value) => padding.top + h - ((value - 1) / 4) * h;
      const xFor = (index) =>
        padding.left + (points.length <= 1 ? w / 2 : (index / (points.length - 1)) * w);

      // 横グリッド線（評価1〜5の各ライン）
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      for (let v = 1; v <= 5; v++) {
        const y = yFor(v);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + w, y);
        ctx.stroke();
      }

      // 折れ線（欠損（null）は線をつながず途切れさせる）
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let penDown = false;
      ctx.beginPath();
      points.forEach((p, i) => {
        if (p.value === null || p.value === undefined) {
          penDown = false;
          return;
        }
        const x = xFor(i);
        const y = yFor(p.value);
        if (!penDown) {
          ctx.moveTo(x, y);
          penDown = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // データ点
      ctx.fillStyle = color;
      points.forEach((p, i) => {
        if (p.value === null || p.value === undefined) return;
        const x = xFor(i);
        const y = yFor(p.value);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // X軸ラベル（日付を間引いて "M/D" 表示）
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const labelStep = Math.max(1, Math.ceil(points.length / 6));
      points.forEach((p, i) => {
        const isLast = i === points.length - 1;
        if (i % labelStep !== 0 && !isLast) return;
        const x = xFor(i);
        const [, m, d] = p.date.split('-');
        ctx.fillText(`${Number(m)}/${Number(d)}`, x, height - 4);
      });
    },
  };
})();
