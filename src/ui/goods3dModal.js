(function (global) {
  // =========================================================================
  // Goods3DShowcase: 3D 实物吧唧 / 碎玻璃镭射小卡互动把玩预览与晒图导出器
  // =========================================================================

  let isOpen = false;
  let appStateRef = null;
  let foilMode = 'broken_glass'; // 'broken_glass' | 'rainbow' | 'glitter' | 'glossy'
  let foilIntensity = 0.68;
  let angleLocked = false;
  let targetTiltX = 0.16;
  let targetTiltY = -0.22;
  let curTiltX = 0.16;
  let curTiltY = -0.22;
  let animFrameId = null;

  const texCanvas = document.createElement('canvas');
  const workCanvas = document.createElement('canvas');
  const foilCanvas = document.createElement('canvas');

  const glassFacets = [];
  const glitterParticles = [];

  function fractPositive(v) {
    return v - Math.floor(v);
  }

  function initProceduralFoilData() {
    if (glassFacets.length > 0) return;

    const cols = 9, rows = 9;
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const rowPts = [];
      for (let c = 0; c <= cols; c++) {
        const jx = (c === 0 || c === cols) ? 0 : (Math.sin(r * 17.3 + c * 31.7) * 0.42);
        const jy = (r === 0 || r === rows) ? 0 : (Math.cos(r * 23.1 + c * 11.9) * 0.42);
        rowPts.push({
          x: -0.55 + ((c + jx) / cols) * 1.1,
          y: -0.55 + ((r + jy) / rows) * 1.1
        });
      }
      grid.push(rowPts);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p00 = grid[r][c], p10 = grid[r][c + 1];
        const p01 = grid[r + 1][c], p11 = grid[r + 1][c + 1];
        const seed1 = fractPositive(Math.sin(r * 13.7 + c * 7.3) * 43758.5453);
        const seed2 = fractPositive(Math.cos(r * 19.1 + c * 29.7) * 23421.6312);
        glassFacets.push({
          pts: [p00, p10, p11],
          nx: Math.cos(seed1 * Math.PI * 2),
          ny: Math.sin(seed1 * Math.PI * 2),
          hueBase: seed1 * 360
        });
        glassFacets.push({
          pts: [p00, p11, p01],
          nx: Math.cos(seed2 * Math.PI * 2),
          ny: Math.sin(seed2 * Math.PI * 2),
          hueBase: seed2 * 360
        });
      }
    }

    // 使用正小数 fractPositive 确保所有银葱粒子半径严格 > 0，绝不出现负半径异常！
    for (let i = 0; i < 420; i++) {
      const rx = fractPositive(Math.sin(i * 12.9898 + 1.7) * 43758.5453);
      const ry = fractPositive(Math.cos(i * 78.233 + 3.1) * 23421.631);
      const rp = fractPositive(Math.sin(i * 39.346 + 5.3) * 19283.421);
      const rs = fractPositive(Math.sin(i * 93.172 + 2.9) * 65432.123);
      const rh = fractPositive(Math.cos(i * 51.719 + 7.7) * 15731.743);
      glitterParticles.push({
        x: rx - 0.5,
        y: ry - 0.5,
        phaseA: rp * Math.PI * 2,
        phaseB: rs * Math.PI * 2,
        size: 1.1 + rs * 2.8,
        hue: Math.round(rh * 360)
      });
    }
  }

  function openShowcase(state) {
    initProceduralFoilData();
    appStateRef = state;
    angleLocked = false;
    isOpen = true;

    const maxSide = 1100;
    const scale = Math.min(2, maxSide / Math.max(state.canvasW, state.canvasH));
    global.CollageRenderer.renderOuterFrameBuffer(texCanvas, state, {
      isExport: true,
      renderScale: scale,
      exportFormat: 'png'
    });

    const modal = document.getElementById('goods3dModal');
    modal.classList.add('open');
    updateLockHintUI();
    startLoop();
  }

  function closeShowcase() {
    isOpen = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = null;
    document.getElementById('goods3dModal').classList.remove('open');
  }

  function startLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    const cvs = document.getElementById('goods3dCanvas');
    function tick() {
      if (!isOpen) return;
      try {
        curTiltX += (targetTiltX - curTiltX) * 0.14;
        curTiltY += (targetTiltY - curTiltY) * 0.14;
        render3DFrame(cvs, cvs.width, cvs.height);
      } catch (err) {
        console.error('Goods3D render error:', err);
      }
      animFrameId = requestAnimationFrame(tick);
    }
    tick();
  }

  function render3DFrame(targetCvs, W, H) {
    if (!appStateRef) return;
    const ctx = targetCvs.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // 1. 深色丝绒展台背景
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 30, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
    bgGrad.addColorStop(0, '#232838');
    bgGrad.addColorStop(0.55, '#131620');
    bgGrad.addColorStop(1, '#090b10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const tw = Math.max(1, texCanvas.width);
    const th = Math.max(1, texCanvas.height);
    const fitScale = Math.min((W * 0.68) / tw, (H * 0.74) / th);
    const dw = Math.max(1, Math.round(tw * fitScale));
    const dh = Math.max(1, Math.round(th * fitScale));

    if (workCanvas.width !== dw || workCanvas.height !== dh) {
      workCanvas.width = dw;
      workCanvas.height = dh;
    }
    if (foilCanvas.width !== dw || foilCanvas.height !== dh) {
      foilCanvas.width = dw;
      foilCanvas.height = dh;
    }

    // 准备独立闪膜光效层 foilCanvas
    const fCtx = foilCanvas.getContext('2d');
    fCtx.globalCompositeOperation = 'source-over';
    fCtx.clearRect(0, 0, dw, dh);
    renderFoilShader(fCtx, dw, dh, curTiltX, curTiltY);

    // 将原图与闪膜合成到 workCanvas，并用 destination-in 严格裁切在异形谷子非透明轮廓内！
    const wCtx = workCanvas.getContext('2d');
    wCtx.globalCompositeOperation = 'source-over';
    wCtx.clearRect(0, 0, dw, dh);
    wCtx.drawImage(texCanvas, 0, 0, dw, dh);

    // 使用 screen 滤色混合叠加闪膜光效，让暗部与亮部都能透出绚丽光泽！
    wCtx.globalCompositeOperation = 'screen';
    wCtx.drawImage(foilCanvas, 0, 0);

    // 边缘立体马口铁拱面明暗倒角
    wCtx.globalCompositeOperation = 'source-atop';
    const rimGrad = wCtx.createLinearGradient(
      0, 0,
      dw * Math.max(0.1, 0.5 + curTiltY * 0.8),
      dh * Math.max(0.1, 0.5 + curTiltX * 0.8)
    );
    rimGrad.addColorStop(0, 'rgba(255,255,255,0.34)');
    rimGrad.addColorStop(0.18, 'rgba(255,255,255,0)');
    rimGrad.addColorStop(0.82, 'rgba(0,0,0,0)');
    rimGrad.addColorStop(1, 'rgba(0,0,0,0.36)');
    wCtx.fillStyle = rimGrad;
    wCtx.fillRect(0, 0, dw, dh);

    // 严格用原贴图的 Alpha 通道裁剪掉圆形/爱心外部溢出的闪膜像素！
    wCtx.globalCompositeOperation = 'destination-in';
    wCtx.drawImage(texCanvas, 0, 0, dw, dh);
    wCtx.globalCompositeOperation = 'source-over';

    // 2. 2.5D 透视矩阵渲染厚度与落影
    const cosY = Math.cos(curTiltY);
    const cosX = Math.cos(curTiltX);
    const skewX = Math.sin(curTiltY) * 0.22;
    const skewY = -Math.sin(curTiltX) * 0.22;

    ctx.save();
    ctx.translate(W * 0.5, H * 0.49);
    ctx.transform(cosY, skewY, skewX, cosX, 0, 0);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
    ctx.shadowBlur = 42 * (W / 760);
    ctx.shadowOffsetX = -curTiltY * 55 * (W / 760);
    ctx.shadowOffsetY = (24 + curTiltX * 45) * (W / 760);
    ctx.drawImage(workCanvas, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    const thickDirX = -Math.sin(curTiltY) * 7 * (W / 760);
    const thickDirY = Math.sin(curTiltX) * 7 * (W / 760);
    ctx.save();
    ctx.filter = 'brightness(165%) contrast(60%)';
    for (let layer = 4; layer >= 1; layer--) {
      const ratio = layer / 4;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(workCanvas, -dw / 2 + thickDirX * ratio, -dh / 2 + thickDirY * ratio, dw, dh);
    }
    ctx.restore();

    ctx.drawImage(workCanvas, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.58)';
    ctx.font = `600 ${Math.round(12 * (W / 760))}px "Segoe UI", "Microsoft YaHei UI", sans-serif`;
    ctx.textAlign = 'center';
    const foilNames = {
      broken_glass: 'BROKEN GLASS HOLO · 碎玻璃镭射工艺',
      rainbow: 'IRIDESCENT HOLO · 彩虹素面镭射',
      glitter: 'STARLIGHT GLITTER · 细闪银葱星幻',
      glossy: 'HIGH GLOSS DOME · 高透亮膜扫光'
    };
    ctx.fillText(foilNames[foilMode] || '', W * 0.5, H - 18 * (W / 760));
  }

  function renderFoilShader(ctx, w, h, tx, ty) {
    const intensity = foilIntensity;
    if (intensity <= 0.02) return;

    ctx.save();
    if (foilMode === 'broken_glass') {
      const lightX = Math.sin(ty * 2.6);
      const lightY = Math.sin(tx * 2.6);
      for (const f of glassFacets) {
        const dot = f.nx * lightX + f.ny * lightY;
        const spec = Math.pow(Math.max(0, 1 - Math.abs(dot - 0.25) * 2.1), 2.6);
        if (spec < 0.04) continue;
        const hue = (f.hueBase + (tx + ty) * 240 + 360) % 360;
        ctx.fillStyle = `hsla(${hue}, 95%, 66%, ${Math.min(0.85, spec * intensity * 0.95)})`;
        ctx.beginPath();
        ctx.moveTo((0.5 + f.pts[0].x) * w, (0.5 + f.pts[0].y) * h);
        ctx.lineTo((0.5 + f.pts[1].x) * w, (0.5 + f.pts[1].y) * h);
        ctx.lineTo((0.5 + f.pts[2].x) * w, (0.5 + f.pts[2].y) * h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (foilMode === 'rainbow') {
      const shift = (tx + ty) * 1.4;
      const g = ctx.createLinearGradient(
        w * (0.1 - shift * 0.5), h * (0.1 + shift * 0.3),
        w * (0.9 + shift * 0.5), h * (0.9 - shift * 0.3)
      );
      const stops = [0, 60, 130, 200, 280, 340, 40];
      stops.forEach((baseH, idx) => {
        const hue = (baseH + (tx - ty) * 220 + 720) % 360;
        g.addColorStop(idx / (stops.length - 1), `hsla(${hue}, 92%, 62%, ${intensity * 0.52})`);
      });
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (foilMode === 'glitter') {
      // ✨ 细闪银葱星幻底：银葱金属柔光基底 + 420 颗随倾角高频闪烁的星芒银砂！
      const baseShimmer = ctx.createRadialGradient(
        w * (0.5 - ty * 0.7), h * (0.5 + tx * 0.7), 10,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.75
      );
      baseShimmer.addColorStop(0, `rgba(226, 232, 240, ${intensity * 0.22})`);
      baseShimmer.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = baseShimmer;
      ctx.fillRect(0, 0, w, h);

      const scaleFactor = Math.max(0.6, Math.min(w, h) / 420);
      for (const p of glitterParticles) {
        const wave = Math.cos(p.phaseA + tx * 7.5) * Math.cos(p.phaseB + ty * 7.5);
        const twinkle = Math.pow(Math.max(0, wave), 4);
        if (twinkle < 0.05) continue;

        const px = (0.5 + p.x) * w;
        const py = (0.5 + p.y) * h;
        const r = Math.max(0.8, p.size * scaleFactor * (0.65 + twinkle * 1.1));
        const alpha = Math.min(1, twinkle * intensity * 1.35);

        ctx.fillStyle = `hsla(${p.hue}, 80%, 88%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        if (twinkle > 0.48) {
          const arm = r * 3.1;
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.1)})`;
          ctx.lineWidth = Math.max(1, 1.3 * scaleFactor);
          ctx.beginPath();
          ctx.moveTo(px - arm, py); ctx.lineTo(px + arm, py);
          ctx.moveTo(px, py - arm); ctx.lineTo(px, py + arm);
          ctx.stroke();
        }
      }
    } else if (foilMode === 'glossy') {
      // 💿 高透亮膜扫光：清漆拱面球体高光 + 双道锐利摄影棚柔光箱斜向扫光条！
      const domeX = w * (0.5 - ty * 0.85);
      const domeY = h * (0.38 - tx * 0.85);
      const domeGrad = ctx.createRadialGradient(domeX, domeY, w * 0.02, domeX, domeY, Math.max(w, h) * 0.62);
      domeGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.85, intensity * 0.68)})`);
      domeGrad.addColorStop(0.35, `rgba(240, 249, 255, ${intensity * 0.22})`);
      domeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = domeGrad;
      ctx.fillRect(0, 0, w, h);

      // 双平行锐利亮膜反光带（随鼠标倾角大范围横扫画面！）
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(-Math.PI / 5);
      const diag = Math.hypot(w, h);
      const sweepOffset = (ty * 1.35 - tx * 1.15) * diag * 0.62;

      const bar1 = ctx.createLinearGradient(sweepOffset - diag * 0.14, 0, sweepOffset + diag * 0.14, 0);
      bar1.addColorStop(0, 'rgba(255,255,255,0)');
      bar1.addColorStop(0.35, `rgba(255,255,255,${Math.min(0.92, intensity * 0.78)})`);
      bar1.addColorStop(0.5, `rgba(255,255,255,${Math.min(0.98, intensity * 0.92)})`);
      bar1.addColorStop(0.65, `rgba(255,255,255,${Math.min(0.92, intensity * 0.78)})`);
      bar1.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bar1;
      ctx.fillRect(-diag, -diag, diag * 2, diag * 2);

      // 副窄亮线（真实亚克力/覆膜双折射边线）
      const subOffset = sweepOffset + diag * 0.19;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, intensity * 0.52)})`;
      ctx.fillRect(subOffset - diag * 0.018, -diag, diag * 0.036, diag * 2);
      ctx.restore();
    }

    // 非 glossy 模式也附带一层柔和玻璃面反光
    if (foilMode !== 'glossy') {
      const bandPos = Math.max(0.08, Math.min(0.92, 0.5 + (ty - tx) * 0.9));
      const sheen = ctx.createLinearGradient(0, 0, w, h * 0.85);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(Math.max(0, bandPos - 0.16), 'rgba(255,255,255,0)');
      sheen.addColorStop(bandPos, `rgba(255,255,255,${intensity * 0.26})`);
      sheen.addColorStop(Math.min(1, bandPos + 0.16), 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  function updateLockHintUI() {
    const lbl = document.getElementById('goods3dLockHint');
    if (lbl) {
      lbl.textContent = angleLocked
        ? '已定格锁定当前光效角度（再次单击画面可恢复跟随鼠标旋转）'
        : '移动鼠标预览 3D 流光角度 · 单击画面可定格锁定当前反光瞬间';
      lbl.style.color = angleLocked ? 'var(--success)' : 'var(--text-secondary)';
    }
  }

  function bindShowcaseEvents() {
    const modal = document.getElementById('goods3dModal');
    const cvs = document.getElementById('goods3dCanvas');
    if (!modal || !cvs) return;

    cvs.addEventListener('mousemove', (e) => {
      if (angleLocked) return;
      const rect = cvs.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetTiltY = nx * 0.42;
      targetTiltX = -ny * 0.36;
    });

    cvs.addEventListener('click', () => {
      angleLocked = !angleLocked;
      updateLockHintUI();
    });

    document.querySelectorAll('.foil-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        foilMode = btn.dataset.foil;
        document.querySelectorAll('.foil-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    const rngInt = document.getElementById('rngFoilIntensity');
    if (rngInt) {
      rngInt.addEventListener('input', () => {
        foilIntensity = (parseInt(rngInt.value, 10) || 0) / 100;
        document.getElementById('lblFoilIntensity').textContent = `${rngInt.value}%`;
      });
    }

    document.getElementById('btnCloseGoods3D').addEventListener('click', closeShowcase);
    document.getElementById('btnCancelGoods3D').addEventListener('click', closeShowcase);

    document.getElementById('btnExportGoodsShowcase').addEventListener('click', async () => {
      const outCvs = document.createElement('canvas');
      outCvs.width = 1600;
      outCvs.height = 1120;
      render3DFrame(outCvs, outCvs.width, outCvs.height);
      const dataUrl = outCvs.toDataURL('image/png');
      if (window.desktopAPI) {
        const res = await window.desktopAPI.saveExportImage({
          dataUrl,
          defaultName: `3D立体预览_${Date.now()}.png`,
          format: 'png'
        });
        if (res && !res.canceled) {
          window.desktopAPI.showItemInFolder(res.filePath);
        }
      }
    });
  }

  global.Goods3DShowcase = {
    open: openShowcase,
    close: closeShowcase,
    bindEvents: bindShowcaseEvents
  };
})(window);
