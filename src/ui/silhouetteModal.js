(function (global) {
  // =========================================================================
  // SilhouetteExtractor: 创意玩法 · 人物轮廓提取与剪影容器融合引擎
  // - 支持：透明通道直提 / 边缘梯度防漏抠图 / 套索手绘初筛
  // - 支持：+ 保留笔 / - 擦除笔 / ★ 局部原貌保留笔（滚轮调笔刷、右键临时反选、多步撤回）
  // - 支持：立牌外扩包边 (Morphological Disc Offset) + 轮廓平滑简化
  // - 支持三种融合玩法：
  //   1. pure           纯粹剪影分镜框（核心默认）
  //   2. double_lineart 双重曝光 · 原人物衣褶线稿叠印
  //   3. double_soft    双重曝光 · 原人物柔光虚影叠印
  //   4. hero_partial   主视觉保留 · 上半身/局部原图 + 裙摆内切分镜
  // =========================================================================

  const MAX_WORK_SIDE = 420;
  const MIN_ZOOM = 0.75;
  const MAX_ZOOM = 8.0;

  let isOpen = false;
  let activeAsset = null;
  let onApplyCallback = null; // (resultPayload, targetMode: 'outer' | 'frame') => void

  let workW = 240;
  let workH = 320;
  let imgRGBA = null;       // Uint8ClampedArray (workW * workH * 4)
  let edgeGrad = null;      // Float32Array (workW * workH) Sobel 边缘梯度强度
  let fgMask = null;        // Uint8Array (0 = 背景剔除, 1 = 人物主体保留)
  let heroKeepMask = null;  // Uint8Array (0 = 分镜区, 1 = 玩法3手涂保留原人物区)
  let hasPaintedHeroKeep = false;
  let maskHistory = [];

  // 交互参数状态
  let segMode = 'edge_flood'; // 'alpha' | 'edge_flood' | 'lasso'
  let tolerance = 34;         // 5 ~ 95
  let edgeGuard = 58;         // 0 ~ 100 边缘反差防漏锁强度（保护浅色头纱/光环不被背景吞没）
  let brushTool = 'add';      // 'add' | 'erase' | 'hero'
  let brushRadius = 14;       // 工作网格像素半径 3 ~ 45
  let dieCutOffset = 3;       // -8 ~ +20 立牌外扩包边
  let smoothEps = 2.6;        // 0.8 ~ 9.0 轮廓平滑简化度
  let initBlendMode = 'pure'; // 'pure' | 'double_lineart' | 'double_soft' | 'hero_partial'

  // 画布交互与视图缩放平移状态
  let isPainting = false;
  let paintEffectiveTool = 'add';
  let lastGridPt = null;
  let cursorGridPt = null;
  let lassoPoints = [];
  let viewZoom = 1;
  let viewPanX = 0;
  let viewPanY = 0;
  let isPanning = false;
  let isSpaceDown = false;
  let panStartClient = null;
  let panStartOffset = null;

  // 实时计算出的轮廓缓存
  let cachedProcessedMask = null;
  let cachedContourResult = null; // { customPoints, cropNorm, aspect, rawLoopGrid }

  const srcSampleCanvas = document.createElement('canvas');
  const maskTintCanvas = document.createElement('canvas');
  const fusionScratchA = document.createElement('canvas');
  const fusionScratchB = document.createElement('canvas');

  // ==================== 1. 图像采样与 Sobel 边缘防漏场计算 ====================
  function computeSobelEdgeGrad() {
    edgeGrad = new Float32Array(workW * workH);
    if (!imgRGBA) return;
    for (let y = 1; y < workH - 1; y++) {
      for (let x = 1; x < workW - 1; x++) {
        let maxMag = 0;
        for (let c = 0; c < 3; c++) {
          const idxTL = ((y - 1) * workW + (x - 1)) * 4 + c;
          const idxTC = ((y - 1) * workW + x) * 4 + c;
          const idxTR = ((y - 1) * workW + (x + 1)) * 4 + c;
          const idxML = (y * workW + (x - 1)) * 4 + c;
          const idxMR = (y * workW + (x + 1)) * 4 + c;
          const idxBL = ((y + 1) * workW + (x - 1)) * 4 + c;
          const idxBC = ((y + 1) * workW + x) * 4 + c;
          const idxBR = ((y + 1) * workW + (x + 1)) * 4 + c;

          const gx = -imgRGBA[idxTL] + imgRGBA[idxTR] - 2 * imgRGBA[idxML] + 2 * imgRGBA[idxMR] - imgRGBA[idxBL] + imgRGBA[idxBR];
          const gy = -imgRGBA[idxTL] - 2 * imgRGBA[idxTC] - imgRGBA[idxTR] + imgRGBA[idxBL] + 2 * imgRGBA[idxBC] + imgRGBA[idxBR];
          const mag = Math.hypot(gx, gy) * 0.25;
          if (mag > maxMag) maxMag = mag;
        }
        edgeGrad[y * workW + x] = maxMag;
      }
    }
  }

  function prepareSourceGrid(asset) {
    const img = asset.img;
    const natW = img.naturalWidth || asset.width || 400;
    const natH = img.naturalHeight || asset.height || 400;
    const scale = Math.min(1, MAX_WORK_SIDE / Math.max(natW, natH));
    workW = Math.max(48, Math.round(natW * scale));
    workH = Math.max(48, Math.round(natH * scale));

    srcSampleCanvas.width = workW;
    srcSampleCanvas.height = workH;
    const sctx = srcSampleCanvas.getContext('2d', { willReadFrequently: true });
    sctx.clearRect(0, 0, workW, workH);
    sctx.drawImage(img, 0, 0, workW, workH);
    imgRGBA = sctx.getImageData(0, 0, workW, workH).data;

    // 计算 RGB 最大通道 Sobel 梯度（即便浅米白头纱与暖白背景亮度接近，微小色相/明度跃变也能形成防漏堤坝！）
    computeSobelEdgeGrad();

    fgMask = new Uint8Array(workW * workH);
    heroKeepMask = new Uint8Array(workW * workH);
    hasPaintedHeroKeep = false;
    maskHistory = [];
    lassoPoints = [];

    // 自动检测原图是否自带透明通道
    let transparentCount = 0;
    const total = workW * workH;
    for (let i = 0; i < total; i++) {
      if (imgRGBA[i * 4 + 3] < 235) transparentCount++;
    }
    segMode = (transparentCount > total * 0.03) ? 'alpha' : 'edge_flood';
  }

  function pushMaskUndo() {
    if (!fgMask || !heroKeepMask) return;
    maskHistory.push({
      fg: new Uint8Array(fgMask),
      hero: new Uint8Array(heroKeepMask),
      hasHero: hasPaintedHeroKeep
    });
    if (maskHistory.length > 20) maskHistory.shift();
    const undoBtn = document.getElementById('btnSilUndoBrush');
    if (undoBtn) undoBtn.disabled = maskHistory.length === 0;
  }

  function undoBrushStep() {
    if (!maskHistory.length) return;
    const snap = maskHistory.pop();
    fgMask = snap.fg;
    heroKeepMask = snap.hero;
    hasPaintedHeroKeep = snap.hasHero;
    const undoBtn = document.getElementById('btnSilUndoBrush');
    if (undoBtn) undoBtn.disabled = maskHistory.length === 0;
    recomputeContourFromMask();
    renderModalPreview();
  }

  // ==================== 2. 智能背景抠除与初筛算法 ====================
  function runAutoSegmentation() {
    if (!imgRGBA) return;
    const total = workW * workH;

    if (segMode === 'alpha') {
      let anyFg = false;
      for (let i = 0; i < total; i++) {
        const v = imgRGBA[i * 4 + 3] > 32 ? 1 : 0;
        fgMask[i] = v;
        if (v) anyFg = true;
      }
      // 若原图实际无透明通道却选了 alpha，自动回退全选提醒或切回防漏抠除
      if (!anyFg) fgMask.fill(1);
      recomputeContourFromMask();
      renderModalPreview();
      return;
    }

    if (segMode === 'lasso') {
      // 套索模式下未圈选前保留当前蒙版或清空等待圈选
      recomputeContourFromMask();
      renderModalPreview();
      return;
    }

    // 边缘梯度防漏漫水抠除 (edge_flood)
    // 1) 沿四条画布边界均匀采集背景色样本簇（兼容顶部光束与底部地板渐变色差！）
    const bgSamples = [];
    const stepX = Math.max(4, Math.floor(workW / 18));
    const stepY = Math.max(4, Math.floor(workH / 18));

    function sampleAt(x, y) {
      const idx = (y * workW + x) * 4;
      if (imgRGBA[idx + 3] < 32) return;
      bgSamples.push([imgRGBA[idx], imgRGBA[idx + 1], imgRGBA[idx + 2], x, y]);
    }
    for (let x = 0; x < workW; x += stepX) {
      sampleAt(x, 0);
      sampleAt(x, 1);
      // 底部仅采左右两侧边角，防止直接把立绘踩底边的裙摆当成背景色！
      if (x < workW * 0.16 || x > workW * 0.84) {
        sampleAt(x, workH - 1);
      }
    }
    for (let y = 0; y < workH; y += stepY) {
      sampleAt(0, y);
      sampleAt(workW - 1, y);
    }

    const visitedBg = new Uint8Array(total);
    const queue = new Int32Array(total);
    let qHead = 0, qTail = 0;

    const colorThreshSq = Math.pow(tolerance * 1.85, 2) * 3;
    const localStepThreshSq = Math.pow(Math.max(8, tolerance * 0.52), 2) * 3;
    // edgeGuard 越高，越严格拦截跨越轮廓边缘的渗透
    const gradBarrier = edgeGuard <= 2 ? 9999 : Math.max(10, 118 - edgeGuard * 0.96);

    function isLikelyBorderBg(idx, px, py) {
      const o = idx * 4;
      if (imgRGBA[o + 3] < 32) return true;
      const r = imgRGBA[o], g = imgRGBA[o + 1], b = imgRGBA[o + 2];
      // 与空间距离较近的边界背景样本对比，适应上下渐变背景
      let minColorDistSq = Infinity;
      for (let k = 0; k < bgSamples.length; k++) {
        const s = bgSamples[k];
        const spatialWeight = (Math.abs(px - s[3]) / workW + Math.abs(py - s[4]) / workH);
        if (spatialWeight > 0.85 && bgSamples.length > 8) continue;
        const dr = r - s[0], dg = g - s[1], db = b - s[2];
        const dSq = dr * dr + dg * dg + db * db;
        if (dSq < minColorDistSq) minColorDistSq = dSq;
      }
      return minColorDistSq <= colorThreshSq;
    }

    function trySeed(x, y) {
      const idx = y * workW + x;
      if (visitedBg[idx]) return;
      // 底部正中央若人物裙摆接地，不强行种种子，除非颜色匹配边界背景簇
      if (isLikelyBorderBg(idx, x, y)) {
        visitedBg[idx] = 1;
        queue[qTail++] = idx;
      }
    }

    for (let x = 0; x < workW; x++) {
      trySeed(x, 0);
      trySeed(x, workH - 1);
    }
    for (let y = 0; y < workH; y++) {
      trySeed(0, y);
      trySeed(workW - 1, y);
    }

    const dirs = [-1, 1, -workW, workW];
    while (qHead < qTail) {
      const cur = queue[qHead++];
      const cx = cur % workW;
      const cy = (cur - cx) / workW;
      const co = cur * 4;
      const cr = imgRGBA[co], cg = imgRGBA[co + 1], cb = imgRGBA[co + 2];

      for (let d = 0; d < 4; d++) {
        const nb = cur + dirs[d];
        if (nb < 0 || nb >= total || visitedBg[nb]) continue;
        const nx = nb % workW;
        if (Math.abs(nx - cx) > 1) continue; // 防跨行折返
        const ny = (nb - nx) / workW;

        const no = nb * 4;
        if (imgRGBA[no + 3] < 32) {
          visitedBg[nb] = 1;
          queue[qTail++] = nb;
          continue;
        }

        // 遇到明显的人物轮廓梯度线时停止漫水渗透（保护浅色头纱与白裙！）
        if (edgeGrad[nb] > gradBarrier) continue;

        // 相邻像素跳变约束 + 全局背景簇色差约束双重校验
        const lr = imgRGBA[no] - cr, lg = imgRGBA[no + 1] - cg, lb = imgRGBA[no + 2] - cb;
        if (lr * lr + lg * lg + lb * lb > localStepThreshSq) continue;

        if (isLikelyBorderBg(nb, nx, ny)) {
          visitedBg[nb] = 1;
          queue[qTail++] = nb;
        }
      }
    }

    for (let i = 0; i < total; i++) {
      fgMask[i] = visitedBg[i] ? 0 : 1;
    }

    // 自动填补人物内部被误抠的封闭小孔洞并剔除外部微小噪点
    cleanMaskIslandsAndHoles(fgMask, workW, workH);
    recomputeContourFromMask();
    renderModalPreview();
  }

  // 保留最大前景连通域（及与其紧邻的大块如悬浮光环），并填满人物躯干内部所有封闭孔洞！
  function cleanMaskIslandsAndHoles(mask, w, h) {
    const total = w * h;
    // 1) 过滤过小悬浮碎块（保留最大连通块，以及面积 >= 最大块 1.5% 的附属部件如头顶光环/武器）
    const labels = new Int32Array(total);
    const sizes = [0];
    const q = new Int32Array(total);
    let curLabel = 0;

    for (let i = 0; i < total; i++) {
      if (mask[i] === 1 && labels[i] === 0) {
        curLabel++;
        let head = 0, tail = 0, cnt = 0;
        labels[i] = curLabel;
        q[tail++] = i;
        while (head < tail) {
          const u = q[head++];
          cnt++;
          const ux = u % w;
          if (ux > 0 && mask[u - 1] === 1 && labels[u - 1] === 0) { labels[u - 1] = curLabel; q[tail++] = u - 1; }
          if (ux < w - 1 && mask[u + 1] === 1 && labels[u + 1] === 0) { labels[u + 1] = curLabel; q[tail++] = u + 1; }
          if (u >= w && mask[u - w] === 1 && labels[u - w] === 0) { labels[u - w] = curLabel; q[tail++] = u - w; }
          if (u + w < total && mask[u + w] === 1 && labels[u + w] === 0) { labels[u + w] = curLabel; q[tail++] = u + w; }
        }
        sizes.push(cnt);
      }
    }

    let maxArea = 0;
    for (let k = 1; k < sizes.length; k++) if (sizes[k] > maxArea) maxArea = sizes[k];
    if (maxArea > 0) {
      const keepMin = Math.max(18, Math.round(maxArea * 0.015));
      for (let i = 0; i < total; i++) {
        if (mask[i] === 1 && sizes[labels[i]] < keepMin) mask[i] = 0;
      }
    }

    // 2) 从画布四边对 0 做漫水标记外部真正背景，未被访问到的 0 即为人物内部孔洞，全部填为 1！
    const extZero = new Uint8Array(total);
    let head = 0, tail = 0;
    for (let x = 0; x < w; x++) {
      if (mask[x] === 0 && !extZero[x]) { extZero[x] = 1; q[tail++] = x; }
      const bot = (h - 1) * w + x;
      if (mask[bot] === 0 && !extZero[bot]) { extZero[bot] = 1; q[tail++] = bot; }
    }
    for (let y = 0; y < h; y++) {
      const l = y * w, r = y * w + (w - 1);
      if (mask[l] === 0 && !extZero[l]) { extZero[l] = 1; q[tail++] = l; }
      if (mask[r] === 0 && !extZero[r]) { extZero[r] = 1; q[tail++] = r; }
    }
    while (head < tail) {
      const u = q[head++];
      const ux = u % w;
      if (ux > 0 && mask[u - 1] === 0 && !extZero[u - 1]) { extZero[u - 1] = 1; q[tail++] = u - 1; }
      if (ux < w - 1 && mask[u + 1] === 0 && !extZero[u + 1]) { extZero[u + 1] = 1; q[tail++] = u + 1; }
      if (u >= w && mask[u - w] === 0 && !extZero[u - w]) { extZero[u - w] = 1; q[tail++] = u - w; }
      if (u + w < total && mask[u + w] === 0 && !extZero[u + w]) { extZero[u + w] = 1; q[tail++] = u + w; }
    }
    for (let i = 0; i < total; i++) {
      if (mask[i] === 0 && !extZero[i]) mask[i] = 1;
    }
  }

  // ==================== 3. 立牌圆盘外扩/内缩 + 闭合边界追踪矢量化 ====================
  function applyDiscOffset(srcMask, w, h, radius) {
    const r = Math.round(radius);
    if (r === 0) return new Uint8Array(srcMask);
    const out = new Uint8Array(w * h);
    const absR = Math.abs(r);
    const offsets = [];
    for (let dy = -absR; dy <= absR; dy++) {
      for (let dx = -absR; dx <= absR; dx++) {
        if (dx * dx + dy * dy <= absR * absR + 0.25) offsets.push([dx, dy]);
      }
    }

    if (r > 0) {
      // 圆盘膨胀（立牌外扩包边，自动桥接发丝与悬浮光环！）
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (srcMask[y * w + x] === 1) {
            for (let k = 0; k < offsets.length; k++) {
              const nx = x + offsets[k][0], ny = y + offsets[k][1];
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
            }
          }
        }
      }
    } else {
      // 圆盘腐蚀（内缩修边）
      out.fill(1);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (srcMask[y * w + x] === 0) {
            for (let k = 0; k < offsets.length; k++) {
              const nx = x + offsets[k][0], ny = y + offsets[k][1];
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 0;
            }
          }
        }
      }
      // 边界外视为 0 的向内腐蚀
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x < absR || x >= w - absR || y < absR || y >= h - absR) {
            // 若原图贴边则保留贴边不强行削边
          }
        }
      }
    }
    return out;
  }

  // Moore-Neighbor 闭合外轮廓追踪（加 1px 透明安全框确保贴边裙摆也能 100% 闭合绕回起点！）
  function traceMainOuterContour(mask, w, h) {
    const pw = w + 2;
    const ph = h + 2;
    const pad = new Uint8Array(pw * ph);

    // 仅追踪最大主连通块的外边界，防止多块分离导致切割拓扑断裂
    const labels = new Int32Array(w * h);
    const q = new Int32Array(w * h);
    let bestLabel = 0, bestSize = 0, curLabel = 0;
    for (let i = 0; i < w * h; i++) {
      if (mask[i] === 1 && labels[i] === 0) {
        curLabel++;
        let head = 0, tail = 0, cnt = 0;
        labels[i] = curLabel;
        q[tail++] = i;
        while (head < tail) {
          const u = q[head++];
          cnt++;
          const ux = u % w;
          if (ux > 0 && mask[u - 1] === 1 && labels[u - 1] === 0) { labels[u - 1] = curLabel; q[tail++] = u - 1; }
          if (ux < w - 1 && mask[u + 1] === 1 && labels[u + 1] === 0) { labels[u + 1] = curLabel; q[tail++] = u + 1; }
          if (u >= w && mask[u - w] === 1 && labels[u - w] === 0) { labels[u - w] = curLabel; q[tail++] = u - w; }
          if (u + w < w * h && mask[u + w] === 1 && labels[u + w] === 0) { labels[u + w] = curLabel; q[tail++] = u + w; }
        }
        if (cnt > bestSize) { bestSize = cnt; bestLabel = curLabel; }
      }
    }

    if (bestSize < 12) return null;

    let startX = -1, startY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (labels[y * w + x] === bestLabel) {
          pad[(y + 1) * pw + (x + 1)] = 1;
          if (startX < 0) { startX = x + 1; startY = y + 1; }
        }
      }
    }
    if (startX < 0) return null;

    // 顺时针 8 邻域偏移: W, NW, N, NE, E, SE, S, SW
    const cwDx = [-1, -1, 0, 1, 1, 1, 0, -1];
    const cwDy = [0, -1, -1, -1, 0, 1, 1, 1];

    const loop = [];
    let cx = startX, cy = startY;
    let backDir = 0; // 从左侧空白进入起点 (W)
    const maxSteps = pw * ph * 2;

    for (let step = 0; step < maxSteps; step++) {
      loop.push({ x: cx - 0.5, y: cy - 0.5 }); // 转换回原 workW x workH 像素中心坐标
      let foundNext = false;
      for (let k = 1; k <= 8; k++) {
        const d = (backDir + k) % 8;
        const nx = cx + cwDx[d];
        const ny = cy + cwDy[d];
        if (pad[ny * pw + nx] === 1) {
          const prevEmptyDir = (d + 7) % 8;
          // 下一轮回退方向指向刚才紧邻的空白格相对于新点的方向
          const ex = cx + cwDx[prevEmptyDir] - nx;
          const ey = cy + cwDy[prevEmptyDir] - ny;
          for (let m = 0; m < 8; m++) {
            if (cwDx[m] === ex && cwDy[m] === ey) { backDir = m; break; }
          }
          cx = nx;
          cy = ny;
          foundNext = true;
          break;
        }
      }
      if (!foundNext || (cx === startX && cy === startY && loop.length > 4)) break;
    }

    return loop.length >= 6 ? loop : null;
  }

  function recomputeContourFromMask() {
    if (!fgMask) return;
    // 先做立牌外扩/内缩 + 填补外扩后新闭合的细缝孔洞
    const morphed = applyDiscOffset(fgMask, workW, workH, dieCutOffset);
    cleanMaskIslandsAndHoles(morphed, workW, workH);
    cachedProcessedMask = morphed;

    const rawLoop = traceMainOuterContour(morphed, workW, workH);
    if (!rawLoop) {
      cachedContourResult = null;
      updateVertexBadgeUI(0);
      return;
    }

    // 闭合滑动平均预消锯齿（消除像素阶梯感）
    const avgRadius = Math.max(1, Math.round(smoothEps * 0.9));
    let smoothed = rawLoop;
    for (let pass = 0; pass < 2; pass++) {
      const next = [];
      const n = smoothed.length;
      for (let i = 0; i < n; i++) {
        let sx = 0, sy = 0, cnt = 0;
        for (let k = -avgRadius; k <= avgRadius; k++) {
          const p = smoothed[(i + k + n) % n];
          sx += p.x; sy += p.y; cnt++;
        }
        next.push({ x: sx / cnt, y: sy / cnt });
      }
      smoothed = next;
    }

    // 使用 RDP 算法按轮廓平滑度简化锚点数（分成两半闭合简化以保留首尾极值点！）
    const half = Math.floor(smoothed.length / 2);
    const partA = global.SilhouetteEngine.simplifyPolyline(smoothed.slice(0, half + 1), smoothEps);
    const partB = global.SilhouetteEngine.simplifyPolyline(smoothed.slice(half).concat([smoothed[0]]), smoothEps);
    let simplified = partA.slice(0, -1).concat(partB.slice(0, -1));
    if (simplified.length < 4) simplified = smoothed.filter((_, i) => i % Math.max(1, Math.floor(smoothed.length / 24)) === 0);

    // 求精确轮廓包围盒并归一化到 0..1，同时记录在原图中的对齐矩形 cropNorm
    const densePreview = global.SilhouetteEngine.smoothClosedPolygonChaikin(simplified, simplified.length <= 90 ? 2 : 1);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of [...simplified, ...densePreview]) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const bw = Math.max(8, maxX - minX);
    const bh = Math.max(8, maxY - minY);

    const customPoints = global.SilhouetteEngine.ensureClockwiseScreen(simplified).map(p => ({
      x: Math.max(0, Math.min(1, (p.x - minX) / bw)),
      y: Math.max(0, Math.min(1, (p.y - minY) / bh)),
      smooth: true
    }));

    cachedContourResult = {
      customPoints,
      aspect: bw / bh,
      cropNorm: {
        x: minX / workW,
        y: minY / workH,
        w: bw / workW,
        h: bh / workH
      },
      denseLoopGrid: densePreview
    };

    updateVertexBadgeUI(customPoints.length);
  }

  function updateVertexBadgeUI(count) {
    const badge = document.getElementById('silVertexBadge');
    if (badge) {
      badge.textContent = count > 0 ? `已提取 ${count} 个平滑锚点` : '未检测到有效人物主体（请用 +保留笔涂抹）';
      badge.style.color = count > 0 ? 'var(--accent-cyan)' : 'var(--warning)';
    }
  }

  // ==================== 4. 视图缩放平移计算与实时可视化渲染 ====================
  function computeBaseScale(W, H) {
    const pad = 18;
    return Math.min((W - pad * 2) / Math.max(1, workW), (H - pad * 2) / Math.max(1, workH));
  }

  function clampViewPan(W, H, dw, dh) {
    // 保证无论如何拖拽平移，图像至少保留 64px 留在视口内，防止拖丢
    const margin = 64;
    const baseOx = (W - dw) * 0.5;
    const baseOy = (H - dh) * 0.5;
    const minOx = margin - dw;
    const maxOx = W - margin;
    const minOy = margin - dh;
    const maxOy = H - margin;
    const clampedOx = Math.max(minOx, Math.min(maxOx, baseOx + viewPanX));
    const clampedOy = Math.max(minOy, Math.min(maxOy, baseOy + viewPanY));
    viewPanX = clampedOx - baseOx;
    viewPanY = clampedOy - baseOy;
  }

  function syncZoomHudUI() {
    const lbl = document.getElementById('lblSilZoom');
    if (lbl) lbl.textContent = `${Math.round(viewZoom * 100)}%`;
    const stageBox = document.getElementById('silStageBox');
    if (stageBox) {
      stageBox.classList.toggle('pan-dragging', isPanning);
      stageBox.classList.toggle('pan-ready', !isPanning && isSpaceDown);
    }
  }

  function resetViewZoom() {
    viewZoom = 1;
    viewPanX = 0;
    viewPanY = 0;
    syncZoomHudUI();
    renderModalPreview();
  }

  function zoomAtCanvasPoint(nextZoomRaw, anchorCx, anchorCy) {
    const cvs = document.getElementById('silExtractCanvas');
    if (!cvs) return;
    const W = cvs.width;
    const H = cvs.height;
    const baseScale = computeBaseScale(W, H);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoomRaw));
    if (Math.abs(nextZoom - viewZoom) < 1e-4) return;

    const cx = Number.isFinite(anchorCx) ? anchorCx : W * 0.5;
    const cy = Number.isFinite(anchorCy) ? anchorCy : H * 0.5;

    const oldScale = baseScale * viewZoom;
    const oldDw = workW * oldScale;
    const oldDh = workH * oldScale;
    const oldOx = (W - oldDw) * 0.5 + viewPanX;
    const oldOy = (H - oldDh) * 0.5 + viewPanY;

    // 锁定鼠标指针下的网格坐标，缩放后该像素依然精准停留在鼠标正下方
    const gx = (cx - oldOx) / Math.max(1e-5, oldScale);
    const gy = (cy - oldOy) / Math.max(1e-5, oldScale);

    viewZoom = nextZoom;
    const newScale = baseScale * viewZoom;
    const newDw = workW * newScale;
    const newDh = workH * newScale;

    if (Math.abs(viewZoom - 1) < 0.02) {
      viewZoom = 1;
      viewPanX = 0;
      viewPanY = 0;
    } else {
      viewPanX = cx - gx * newScale - (W - newDw) * 0.5;
      viewPanY = cy - gy * newScale - (H - newDh) * 0.5;
      clampViewPan(W, H, newDw, newDh);
    }

    syncZoomHudUI();
    renderModalPreview();
  }

  function renderModalPreview() {
    const cvs = document.getElementById('silExtractCanvas');
    if (!cvs || !activeAsset || !activeAsset.img) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width;
    const H = cvs.height;
    ctx.clearRect(0, 0, W, H);

    // 棋盘格暗底
    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, W, H);

    const baseScale = computeBaseScale(W, H);
    const scale = baseScale * viewZoom;
    const dw = workW * scale;
    const dh = workH * scale;
    clampViewPan(W, H, dw, dh);
    const ox = (W - dw) * 0.5 + viewPanX;
    const oy = (H - dh) * 0.5 + viewPanY;
    cvs._viewBox = { ox, oy, dw, dh, scale, baseScale };

    // 1. 绘制高清原人物底图
    ctx.drawImage(activeAsset.img, ox, oy, dw, dh);

    // 2. 绘制剔除区深色半透明遮罩 + 玩法3手涂原貌保留区暖金高亮遮罩
    const showMask = cachedProcessedMask || fgMask;
    if (showMask) {
      maskTintCanvas.width = workW;
      maskTintCanvas.height = workH;
      const mctx = maskTintCanvas.getContext('2d');
      const mImg = mctx.createImageData(workW, workH);
      const md = mImg.data;
      for (let i = 0; i < workW * workH; i++) {
        const o = i * 4;
        if (showMask[i] === 0) {
          // 被剔除的背景：压暗为深蓝灰半透明，让提取出的人物轮廓高亮浮现！
          md[o] = 8; md[o + 1] = 11; md[o + 2] = 20; md[o + 3] = 192;
        } else if (hasPaintedHeroKeep && heroKeepMask && heroKeepMask[i] === 1) {
          // 手涂的原人物面容保留区：琥珀柔金提示色
          md[o] = 251; md[o + 1] = 191; md[o + 2] = 36; md[o + 3] = 95;
        } else {
          md[o + 3] = 0;
        }
      }
      mctx.putImageData(mImg, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(maskTintCanvas, ox, oy, dw, dh);
      ctx.restore();
    }

    // 3. 绘制实时提取出的平滑立牌刀模外框线！
    if (cachedContourResult && cachedContourResult.denseLoopGrid.length >= 3) {
      const pts = cachedContourResult.denseLoopGrid;
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, i) => {
        const sx = ox + p.x * scale;
        const sy = oy + p.y * scale;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 3.2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // 4. 若正在套索圈选，绘制套索轨迹
    if (segMode === 'lasso' && lassoPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      lassoPoints.forEach((p, idx) => {
        const sx = ox + p.x * scale, sy = oy + p.y * scale;
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      if (cursorGridPt) ctx.lineTo(ox + cursorGridPt.x * scale, oy + cursorGridPt.y * scale);
      ctx.stroke();
      ctx.restore();
    }

    // 5. 绘制画笔实时圆形光标预览（平移拖拽中隐藏笔刷圈，显示抓手）
    if (cursorGridPt && segMode !== 'lasso' && !isPanning && !isSpaceDown) {
      const sx = ox + cursorGridPt.x * scale;
      const sy = oy + cursorGridPt.y * scale;
      const sr = Math.max(2, brushRadius * scale);
      ctx.save();
      ctx.strokeStyle = brushTool === 'erase' ? '#fb7185' : brushTool === 'hero' ? '#fbbf24' : '#34d399';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ==================== 5. 画笔涂抹与套索交互 ====================
  function paintCircleOnGrid(gx, gy, toolMode) {
    const r = brushRadius;
    const rSq = r * r;
    const x0 = Math.max(0, Math.floor(gx - r));
    const x1 = Math.min(workW - 1, Math.ceil(gx + r));
    const y0 = Math.max(0, Math.floor(gy - r));
    const y1 = Math.min(workH - 1, Math.ceil(gy + r));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((x - gx) * (x - gx) + (y - gy) * (y - gy) <= rSq) {
          const idx = y * workW + x;
          if (toolMode === 'add') fgMask[idx] = 1;
          else if (toolMode === 'erase') { fgMask[idx] = 0; heroKeepMask[idx] = 0; }
          else if (toolMode === 'hero') { fgMask[idx] = 1; heroKeepMask[idx] = 1; hasPaintedHeroKeep = true; }
          else if (toolMode === 'hero-erase') { heroKeepMask[idx] = 0; }
        }
      }
    }
  }

  function paintStrokeSegment(p0, p1, toolMode) {
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, brushRadius * 0.35)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paintCircleOnGrid(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t, toolMode);
    }
  }

  function commitLassoPolygonToMask() {
    if (lassoPoints.length < 3) return;
    pushMaskUndo();
    const tmp = document.createElement('canvas');
    tmp.width = workW;
    tmp.height = workH;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#ffffff';
    tctx.beginPath();
    lassoPoints.forEach((p, i) => i === 0 ? tctx.moveTo(p.x, p.y) : tctx.lineTo(p.x, p.y));
    tctx.closePath();
    tctx.fill();
    const d = tctx.getImageData(0, 0, workW, workH).data;
    for (let i = 0; i < workW * workH; i++) {
      fgMask[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    }
    lassoPoints = [];
    // 套索完成后自动切回画笔修补模式方便微调细节
    segMode = 'edge_flood';
    syncModalControlsUI();
    recomputeContourFromMask();
    renderModalPreview();
  }

  // 生成手涂局部原貌保留蒙版 DataURL（供玩法3在主画布高清渲染）
  function exportHeroKeepMaskDataUrl() {
    if (!hasPaintedHeroKeep || !heroKeepMask) return null;
    let any = false;
    for (let i = 0; i < heroKeepMask.length; i++) { if (heroKeepMask[i]) { any = true; break; } }
    if (!any) return null;

    const c = document.createElement('canvas');
    c.width = workW;
    c.height = workH;
    const cctx = c.getContext('2d');
    const imgD = cctx.createImageData(workW, workH);
    for (let i = 0; i < workW * workH; i++) {
      if (heroKeepMask[i]) {
        imgD.data[i * 4] = 255;
        imgD.data[i * 4 + 1] = 255;
        imgD.data[i * 4 + 2] = 255;
        imgD.data[i * 4 + 3] = 255;
      }
    }
    cctx.putImageData(imgD, 0, 0);
    return c.toDataURL('image/png');
  }

  // ==================== 6. 主画布融合叠加层渲染器（玩法 2 线稿/虚影 & 玩法 3 局部原貌保留） ====================
  function getOrBuildCharacterLineartCanvas(asset, hexColor) {
    const color = hexColor || '#fef08a';
    if (asset._silLineartCache && asset._silLineartCache.color === color) {
      return asset._silLineartCache.canvas;
    }
    const img = asset.img;
    if (!img) return null;
    const natW = img.naturalWidth || asset.width || 600;
    const natH = img.naturalHeight || asset.height || 600;
    const maxSide = 920;
    const sc = Math.min(1, maxSide / Math.max(natW, natH));
    const lw = Math.max(32, Math.round(natW * sc));
    const lh = Math.max(32, Math.round(natH * sc));

    const cvs = document.createElement('canvas');
    cvs.width = lw;
    cvs.height = lh;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, lw, lh);
    const src = ctx.getImageData(0, 0, lw, lh).data;
    const outImg = ctx.createImageData(lw, lh);
    const out = outImg.data;

    const clean = String(color).replace('#', '');
    const tr = parseInt(clean.slice(0, 2), 16) || 254;
    const tg = parseInt(clean.slice(2, 4), 16) || 240;
    const tb = parseInt(clean.slice(4, 6), 16) || 138;

    const lum = new Float32Array(lw * lh);
    for (let i = 0; i < lw * lh; i++) {
      const o = i * 4;
      lum[i] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) * (src[o + 3] / 255);
    }

    for (let y = 1; y < lh - 1; y++) {
      for (let x = 1; x < lw - 1; x++) {
        const tl = lum[(y - 1) * lw + (x - 1)], tc = lum[(y - 1) * lw + x], trv = lum[(y - 1) * lw + (x + 1)];
        const ml = lum[y * lw + (x - 1)], mr = lum[y * lw + (x + 1)];
        const bl = lum[(y + 1) * lw + (x - 1)], bc = lum[(y + 1) * lw + x], br = lum[(y + 1) * lw + (x + 1)];
        const gx = -tl + trv - 2 * ml + 2 * mr - bl + br;
        const gy = -tl - 2 * tc - trv + bl + 2 * bc + br;
        const mag = Math.hypot(gx, gy);
        const alpha = Math.max(0, Math.min(255, (mag - 24) * 2.35));
        const o = (y * lw + x) * 4;
        out[o] = tr;
        out[o + 1] = tg;
        out[o + 2] = tb;
        out[o + 3] = alpha;
      }
    }
    ctx.putImageData(outImg, 0, 0);
    asset._silLineartCache = { color, canvas: cvs };
    return cvs;
  }

  // 计算原人物图在目标剪影包围盒 (boxX, boxY, boxW, boxH) 中的精确 1:1 映射矩形
  function drawAlignedSourceImage(ctx, imgLike, cropNorm, boxX, boxY, boxW, boxH) {
    const cn = cropNorm || { x: 0, y: 0, w: 1, h: 1 };
    const fullW = boxW / Math.max(0.02, cn.w);
    const fullH = boxH / Math.max(0.02, cn.h);
    const drawX = boxX - cn.x * fullW;
    const drawY = boxY - cn.y * fullH;
    ctx.drawImage(imgLike, drawX, drawY, fullW, fullH);
  }

  function renderSilhouetteFusionOverlay(ctx, silMeta, asset, boxX, boxY, boxW, boxH, clipPath, renderScale = 1) {
    if (!silMeta || !asset || !asset.img) return;
    const mode = silMeta.blendMode || 'pure';
    if (mode === 'pure') return; // 玩法 1：纯粹剪影分镜，不叠加原图纹理

    const opacity = Math.max(0.05, Math.min(1, silMeta.overlayOpacity ?? 0.48));
    const cropNorm = silMeta.cropNorm || { x: 0, y: 0, w: 1, h: 1 };

    ctx.save();
    if (clipPath) ctx.clip(clipPath, 'evenodd');

    if (mode === 'double_lineart') {
      // 玩法 2A：双重曝光 · 提取原人物衣褶/五官/光环线稿叠印在分镜之上！
      const lineCvs = getOrBuildCharacterLineartCanvas(asset, silMeta.lineartColor || '#fef08a');
      if (lineCvs) {
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = 'source-over';
        drawAlignedSourceImage(ctx, lineCvs, cropNorm, boxX, boxY, boxW, boxH);
      }
    } else if (mode === 'double_soft') {
      // 玩法 2B：双重曝光 · 柔光原人物纹理半透明叠印
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = Math.min(1, opacity * 1.15);
      drawAlignedSourceImage(ctx, asset.img, cropNorm, boxX, boxY, boxW, boxH);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity * 0.42;
      drawAlignedSourceImage(ctx, asset.img, cropNorm, boxX, boxY, boxW, boxH);
    } else if (mode === 'hero_partial') {
      // 玩法 3：主视觉保留（上半身/手涂区清晰呈现原人物面容光环，下半身裙摆头纱化作多格分镜！）
      const rw = Math.max(1, Math.ceil(boxW));
      const rh = Math.max(1, Math.ceil(boxH));
      if (fusionScratchA.width !== rw || fusionScratchA.height !== rh) {
        fusionScratchA.width = rw;
        fusionScratchA.height = rh;
        fusionScratchB.width = rw;
        fusionScratchB.height = rh;
      }

      const ctxA = fusionScratchA.getContext('2d');
      ctxA.globalCompositeOperation = 'source-over';
      ctxA.clearRect(0, 0, rw, rh);
      drawAlignedSourceImage(ctxA, asset.img, cropNorm, 0, 0, rw, rh);

      const ctxB = fusionScratchB.getContext('2d');
      ctxB.globalCompositeOperation = 'source-over';
      ctxB.clearRect(0, 0, rw, rh);

      const featherRatio = Math.max(0.03, silMeta.heroFeather ?? 0.14);
      if (silMeta.heroKeepImg) {
        const blurPx = Math.max(4, Math.round(Math.min(rw, rh) * featherRatio * 0.35));
        ctxB.save();
        ctxB.filter = `blur(${blurPx}px)`;
        drawAlignedSourceImage(ctxB, silMeta.heroKeepImg, cropNorm, 0, 0, rw, rh);
        ctxB.restore();
      } else {
        const keepY = Math.max(0.08, Math.min(0.88, silMeta.heroKeepRatio ?? 0.34));
        const y0 = Math.max(0, (keepY - featherRatio * 0.5) * rh);
        const y1 = Math.min(rh, (keepY + featherRatio * 0.85) * rh);
        const grad = ctxB.createLinearGradient(0, y0, 0, Math.max(y0 + 2, y1));
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctxB.fillStyle = grad;
        ctxB.fillRect(0, 0, rw, y1);
      }

      ctxA.globalCompositeOperation = 'destination-in';
      ctxA.drawImage(fusionScratchB, 0, 0);

      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(fusionScratchA, boxX, boxY, boxW, boxH);
    }

    ctx.restore();
  }

  // ==================== 7. 模态窗打开、控件同步与事件绑定 ====================
  function syncModalControlsUI() {
    document.querySelectorAll('#silModal .sil-seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.seg === segMode);
    });
    document.querySelectorAll('#silModal .sil-brush-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.btool === brushTool);
    });
    const tolRow = document.getElementById('silFloodParamsBox');
    if (tolRow) tolRow.style.display = segMode === 'edge_flood' ? 'flex' : 'none';
    const lassoHint = document.getElementById('silLassoHintBox');
    if (lassoHint) lassoHint.style.display = segMode === 'lasso' ? 'flex' : 'none';

    const rngTol = document.getElementById('rngSilTolerance');
    if (rngTol) { rngTol.value = tolerance; document.getElementById('lblSilTolerance').textContent = String(tolerance); }
    const rngGuard = document.getElementById('rngSilEdgeGuard');
    if (rngGuard) { rngGuard.value = edgeGuard; document.getElementById('lblSilEdgeGuard').textContent = `${edgeGuard}%`; }
    const rngBrush = document.getElementById('rngSilBrushSize');
    if (rngBrush) { rngBrush.value = brushRadius; document.getElementById('lblSilBrushSize').textContent = `${brushRadius}px`; }
    const rngOff = document.getElementById('rngSilOffset');
    if (rngOff) { rngOff.value = dieCutOffset; document.getElementById('lblSilOffset').textContent = `${dieCutOffset > 0 ? '+' : ''}${dieCutOffset}px`; }
    const rngSm = document.getElementById('rngSilSmooth');
    if (rngSm) { rngSm.value = smoothEps; document.getElementById('lblSilSmooth').textContent = smoothEps.toFixed(1); }
    const selBlend = document.getElementById('selSilInitBlend');
    if (selBlend) selBlend.value = initBlendMode;
  }

  function openExtractor(asset, onApply) {
    if (!asset || !asset.img) return;
    activeAsset = asset;
    onApplyCallback = onApply;
    isOpen = true;
    initBlendMode = 'pure';
    brushTool = 'add';
    viewZoom = 1;
    viewPanX = 0;
    viewPanY = 0;
    isPanning = false;
    isSpaceDown = false;

    prepareSourceGrid(asset);
    runAutoSegmentation();
    syncModalControlsUI();
    syncZoomHudUI();

    const modal = document.getElementById('silModal');
    if (modal) modal.classList.add('open');
    renderModalPreview();
  }

  function closeExtractor() {
    isOpen = false;
    isPainting = false;
    isPanning = false;
    isSpaceDown = false;
    syncZoomHudUI();
    const modal = document.getElementById('silModal');
    if (modal) modal.classList.remove('open');
  }

  async function finalizeAndApply(targetKind) {
    if (!cachedContourResult || cachedContourResult.customPoints.length < 3) return;
    const heroDataUrl = exportHeroKeepMaskDataUrl();
    let heroKeepImg = null;
    if (heroDataUrl) {
      heroKeepImg = await new Promise(resolve => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = heroDataUrl;
      });
    }

    // 若用户涂了 ★ 原貌保留笔但忘了切下拉框，贴心自动切到 hero_partial
    const finalBlend = (hasPaintedHeroKeep && heroDataUrl && initBlendMode === 'pure')
      ? 'hero_partial'
      : initBlendMode;

    const payload = {
      assetId: activeAsset.id,
      assetName: activeAsset.name,
      customPoints: cachedContourResult.customPoints,
      aspect: cachedContourResult.aspect,
      silhouetteMeta: {
        assetId: activeAsset.id,
        cropNorm: cachedContourResult.cropNorm,
        blendMode: finalBlend,
        overlayOpacity: finalBlend === 'hero_partial' ? 0.96 : 0.48,
        lineartColor: '#fef08a',
        heroKeepRatio: 0.34,
        heroFeather: 0.14,
        heroKeepDataUrl: heroDataUrl || null,
        heroKeepImg: heroKeepImg || null
      }
    };

    closeExtractor();
    if (typeof onApplyCallback === 'function') {
      onApplyCallback(payload, targetKind);
    }
  }

  function canvasEventToGrid(e, cvs) {
    const rect = cvs.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * cvs.width;
    const cy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * cvs.height;
    const vb = cvs._viewBox || { ox: 0, oy: 0, scale: 1 };
    return {
      x: (cx - vb.ox) / vb.scale,
      y: (cy - vb.oy) / vb.scale
    };
  }

  function bindModalEvents() {
    const modal = document.getElementById('silModal');
    const cvs = document.getElementById('silExtractCanvas');
    if (!modal || !cvs) return;

    document.querySelectorAll('#silModal .sil-seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        segMode = btn.dataset.seg;
        lassoPoints = [];
        syncModalControlsUI();
        if (segMode !== 'lasso') runAutoSegmentation();
        else renderModalPreview();
      });
    });

    const rngTol = document.getElementById('rngSilTolerance');
    rngTol.addEventListener('input', () => {
      tolerance = parseInt(rngTol.value, 10) || 34;
      document.getElementById('lblSilTolerance').textContent = String(tolerance);
      runAutoSegmentation();
    });

    const rngGuard = document.getElementById('rngSilEdgeGuard');
    rngGuard.addEventListener('input', () => {
      edgeGuard = parseInt(rngGuard.value, 10) || 58;
      document.getElementById('lblSilEdgeGuard').textContent = `${edgeGuard}%`;
      runAutoSegmentation();
    });

    document.querySelectorAll('#silModal .sil-brush-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        brushTool = btn.dataset.btool;
        if (segMode === 'lasso') { segMode = 'edge_flood'; lassoPoints = []; }
        syncModalControlsUI();
        renderModalPreview();
      });
    });

    const rngBrush = document.getElementById('rngSilBrushSize');
    rngBrush.addEventListener('input', () => {
      brushRadius = Math.max(1, parseInt(rngBrush.value, 10) || 14);
      document.getElementById('lblSilBrushSize').textContent = `${brushRadius}px`;
      renderModalPreview();
    });

    document.getElementById('btnSilUndoBrush').addEventListener('click', undoBrushStep);
    document.getElementById('btnSilFillAll').addEventListener('click', () => {
      pushMaskUndo();
      fgMask.fill(1);
      recomputeContourFromMask();
      renderModalPreview();
    });
    document.getElementById('btnSilClearMask').addEventListener('click', () => {
      pushMaskUndo();
      fgMask.fill(0);
      heroKeepMask.fill(0);
      hasPaintedHeroKeep = false;
      recomputeContourFromMask();
      renderModalPreview();
    });
    document.getElementById('btnSilFinishLasso').addEventListener('click', commitLassoPolygonToMask);

    const rngOff = document.getElementById('rngSilOffset');
    rngOff.addEventListener('input', () => {
      dieCutOffset = parseInt(rngOff.value, 10) || 0;
      document.getElementById('lblSilOffset').textContent = `${dieCutOffset > 0 ? '+' : ''}${dieCutOffset}px`;
      recomputeContourFromMask();
      renderModalPreview();
    });

    const rngSm = document.getElementById('rngSilSmooth');
    rngSm.addEventListener('input', () => {
      smoothEps = parseFloat(rngSm.value) || 2.6;
      document.getElementById('lblSilSmooth').textContent = smoothEps.toFixed(1);
      recomputeContourFromMask();
      renderModalPreview();
    });

    document.getElementById('selSilInitBlend').addEventListener('change', (ev) => {
      initBlendMode = ev.target.value;
    });

    // 画布鼠标涂抹、空格/中键平移、右键临时反选擦除、套索圈选、Ctrl+滚轮缩放与滚轮调笔刷大小
    const stageBox = document.getElementById('silStageBox');
    cvs.addEventListener('contextmenu', e => e.preventDefault());

    document.getElementById('btnSilZoomIn').addEventListener('click', () => {
      zoomAtCanvasPoint(viewZoom * 1.25, cvs.width * 0.5, cvs.height * 0.5);
    });
    document.getElementById('btnSilZoomOut').addEventListener('click', () => {
      zoomAtCanvasPoint(viewZoom / 1.25, cvs.width * 0.5, cvs.height * 0.5);
    });
    document.getElementById('btnSilZoomReset').addEventListener('click', resetViewZoom);

    cvs.addEventListener('mousedown', (e) => {
      if (!isOpen) return;

      // 中键按住 或 空格+左键按住：进入画布拖拽平移模式（不落笔涂抹）
      if (e.button === 1 || (isSpaceDown && e.button === 0)) {
        e.preventDefault();
        isPanning = true;
        const rect = cvs.getBoundingClientRect();
        panStartClient = {
          x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * cvs.width,
          y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * cvs.height
        };
        panStartOffset = { x: viewPanX, y: viewPanY };
        syncZoomHudUI();
        renderModalPreview();
        return;
      }

      const gpt = canvasEventToGrid(e, cvs);
      cursorGridPt = gpt;

      if (segMode === 'lasso') {
        if (e.button === 2) { lassoPoints.pop(); renderModalPreview(); return; }
        const closeSnapDist = 10 / Math.max(1, viewZoom);
        if (lassoPoints.length >= 3 && Math.hypot(gpt.x - lassoPoints[0].x, gpt.y - lassoPoints[0].y) <= closeSnapDist) {
          commitLassoPolygonToMask();
          return;
        }
        lassoPoints.push(gpt);
        renderModalPreview();
        return;
      }

      pushMaskUndo();
      isPainting = true;
      if (e.button === 2 || e.altKey) {
        paintEffectiveTool = brushTool === 'hero' ? 'hero-erase' : (brushTool === 'erase' ? 'add' : 'erase');
      } else {
        paintEffectiveTool = brushTool;
      }
      lastGridPt = gpt;
      paintCircleOnGrid(gpt.x, gpt.y, paintEffectiveTool);
      recomputeContourFromMask();
      renderModalPreview();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isOpen) return;
      if (isPanning && panStartClient && panStartOffset) {
        const rect = cvs.getBoundingClientRect();
        const curCx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * cvs.width;
        const curCy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * cvs.height;
        viewPanX = panStartOffset.x + (curCx - panStartClient.x);
        viewPanY = panStartOffset.y + (curCy - panStartClient.y);
        renderModalPreview();
        return;
      }
      if (e.target === cvs || isPainting) {
        const gpt = canvasEventToGrid(e, cvs);
        cursorGridPt = gpt;
        if (isPainting && lastGridPt) {
          paintStrokeSegment(lastGridPt, gpt, paintEffectiveTool);
          lastGridPt = gpt;
          recomputeContourFromMask();
        }
        renderModalPreview();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        panStartClient = null;
        panStartOffset = null;
        syncZoomHudUI();
        renderModalPreview();
      }
      if (isPainting) {
        isPainting = false;
        lastGridPt = null;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!isOpen) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space' && !isSpaceDown) {
        e.preventDefault();
        isSpaceDown = true;
        syncZoomHudUI();
        renderModalPreview();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoBrushStep();
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetViewZoom();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && isSpaceDown) {
        isSpaceDown = false;
        syncZoomHudUI();
        if (isOpen) renderModalPreview();
      }
    });

    cvs.addEventListener('dblclick', () => {
      if (segMode === 'lasso' && lassoPoints.length >= 3) {
        commitLassoPolygonToMask();
      }
    });

    const handleStageWheel = (e) => {
      if (!isOpen) return;
      e.preventDefault();
      e.stopPropagation();

      // 默认按住 Ctrl + 滚轮：以鼠标当前指针为中心无级放大/缩小画面
      if (e.ctrlKey || e.metaKey) {
        const rect = cvs.getBoundingClientRect();
        const cx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * cvs.width;
        const cy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * cvs.height;
        const factor = e.deltaY < 0 ? 1.18 : (1 / 1.18);
        zoomAtCanvasPoint(viewZoom * factor, cx, cy);
        return;
      }

      // 普通滚轮滑动（不按 Ctrl）：继续控制笔刷大小（精细小笔刷区间按 1px 微调，大笔刷按 2px 调节）
      const step = brushRadius <= 6 ? 1 : 2;
      const delta = e.deltaY < 0 ? step : -step;
      brushRadius = Math.max(1, Math.min(45, brushRadius + delta));
      const gpt = canvasEventToGrid(e, cvs);
      cursorGridPt = gpt;
      syncModalControlsUI();
      renderModalPreview();
    };

    (stageBox || cvs).addEventListener('wheel', handleStageWheel, { passive: false });
    // 防止在弹窗其他边缘误触 Ctrl+滚轮 导致整个客户端页面缩放
    modal.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    }, { passive: false });

    document.getElementById('btnCloseSilModal').addEventListener('click', closeExtractor);
    document.getElementById('btnCancelSilModal').addEventListener('click', closeExtractor);
    document.getElementById('btnApplySilOuter').addEventListener('click', () => finalizeAndApply('outer'));
    document.getElementById('btnApplySilFreeFrame').addEventListener('click', () => finalizeAndApply('frame'));
  }

  global.SilhouetteExtractor = {
    open: openExtractor,
    close: closeExtractor,
    bindEvents: bindModalEvents,
    renderSilhouetteFusionOverlay,
    // 导出核心几何函数便于自动化单元测试直接验证！
    _testExtractFromRGBA(rgba, w, h, opts = {}) {
      workW = w; workH = h;
      imgRGBA = rgba;
      computeSobelEdgeGrad();
      fgMask = new Uint8Array(w * h);
      heroKeepMask = new Uint8Array(w * h);
      segMode = opts.segMode || 'edge_flood';
      tolerance = opts.tolerance ?? 34;
      edgeGuard = opts.edgeGuard ?? 55;
      dieCutOffset = opts.dieCutOffset ?? 2;
      smoothEps = opts.smoothEps ?? 2.2;
      runAutoSegmentation();
      return cachedContourResult;
    }
  };
})(window);
