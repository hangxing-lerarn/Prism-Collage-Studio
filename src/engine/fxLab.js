(function (global) {
  // =========================================================================
  // FxLabEngine: 二次元进阶特效与几何生成实验室
  // 1. 角色应援 5 色板自动聚类提取 + 画面像素吸管
  // 2. 三大玻璃碎裂切分生成器 (蛛网冲击 / 冰晶晶格 / 剑光斩击)
  // 3. 真·凹凸拼图公母卡扣边生成器 (Jigsaw Interlocking Tabs)
  // 4. 手撕画纸白毛边分形路径生成 & 漫画放射集中线/速度线绘制
  // =========================================================================

  function rgbToHex(r, g, b) {
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  }

  function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return rgbToHex(r * 255, g * 255, b * 255);
  }

  // 从角色立绘图像自动聚类提取 5 枚高颜值「角色应援色卡」
  // 返回: [主应援色, 高光亮色(瞳色/饰品), 辅色, 柔和浅底色, 深邃描边/耳色]
  const paletteCache = new Map();
  function extractCharacterOshiPalette(asset) {
    if (!asset || !asset.img) {
      return ['#4c8bf5', '#22d3ee', '#818cf8', '#eef2ff', '#1e1b4b'];
    }
    if (paletteCache.has(asset.id)) return paletteCache.get(asset.id);

    const cvs = document.createElement('canvas');
    const sampleSize = 72;
    cvs.width = sampleSize;
    cvs.height = sampleSize;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(asset.img, 0, 0, sampleSize, sampleSize);
    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

    // 按色相桶统计鲜艳像素与总体像素
    const hueBuckets = Array.from({ length: 12 }, () => ({ count: 0, r: 0, g: 0, b: 0, satSum: 0 }));
    const samples = [];

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const { h, s, l } = rgbToHsl(r, g, b);
      samples.push({ r, g, b, h, s, l });
      // 过滤纯白背景与死黑线条，聚焦角色发色/瞳色/服饰色
      if (l > 0.12 && l < 0.90 && s > 0.14) {
        const bi = Math.min(11, Math.floor(h * 12));
        // 高饱和颜色赋予更高权重
        const w = 1 + s * 2.5;
        hueBuckets[bi].count += w;
        hueBuckets[bi].r += r * w;
        hueBuckets[bi].g += g * w;
        hueBuckets[bi].b += b * w;
        hueBuckets[bi].satSum += s * w;
      }
    }

    const sortedBuckets = hueBuckets
      .map((bk, idx) => ({ ...bk, idx }))
      .filter(bk => bk.count > 2)
      .sort((a, b) => b.count - a.count);

    let mainHex = '#4c8bf5';
    let accentHex = '#f472b6';
    let subHex = '#6366f1';
    let mainHsl = { h: 0.6, s: 0.65, l: 0.55 };

    if (sortedBuckets.length > 0) {
      const b0 = sortedBuckets[0];
      const mr = b0.r / b0.count, mg = b0.g / b0.count, mb = b0.b / b0.count;
      mainHex = rgbToHex(mr, mg, mb);
      mainHsl = rgbToHsl(mr, mg, mb);

      // 寻找色相差较大的第二高光应援色（如瞳孔撞色）
      const distinct = sortedBuckets.find(b => {
        const d = Math.abs(b.idx - b0.idx);
        return Math.min(d, 12 - d) >= 2;
      }) || sortedBuckets[1];

      if (distinct) {
        accentHex = rgbToHex(distinct.r / distinct.count, distinct.g / distinct.count, distinct.b / distinct.count);
      } else {
        accentHex = hslToHex((mainHsl.h + 0.08) % 1, Math.min(0.9, mainHsl.s + 0.15), Math.min(0.72, mainHsl.l + 0.12));
      }

      const third = sortedBuckets[2] || sortedBuckets[1];
      if (third) {
        subHex = rgbToHex(third.r / third.count, third.g / third.count, third.b / third.count);
      } else {
        subHex = hslToHex((mainHsl.h + 0.92) % 1, Math.max(0.35, mainHsl.s * 0.8), 0.48);
      }
    } else if (samples.length > 0) {
      // 黑白漫画原图兜底
      mainHex = '#334155';
      accentHex = '#e11d48';
      subHex = '#64748b';
      mainHsl = { h: 0.6, s: 0.15, l: 0.35 };
    }

    const lightTintHex = hslToHex(mainHsl.h, Math.min(0.55, Math.max(0.2, mainHsl.s * 0.6)), 0.92);
    const deepDarkHex = hslToHex(mainHsl.h, Math.min(0.65, Math.max(0.25, mainHsl.s * 0.8)), 0.16);

    const palette = [mainHex, accentHex, subHex, lightTintHex, deepDarkHex];
    paletteCache.set(asset.id, palette);
    return palette;
  }

  // 调用 Chromium 原生像素放大镜吸管 (EyeDropper API)
  async function pickScreenColorWithEyedropper() {
    if (typeof window.EyeDropper === 'function') {
      try {
        const dropper = new window.EyeDropper();
        const result = await dropper.open();
        return result && result.sRGBHex ? result.sRGBHex : null;
      } catch (e) {
        return null; // 用户按 Esc 取消
      }
    }
    return null;
  }

  // =========================================================================
  // 三大玻璃碎裂切分生成器 (输出归一化 cuts 数组，无缝接入 PlanarSlicer)
  // =========================================================================
  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // 模式 1：💥 蛛网冲击碎裂 (以点击点 impactNorm 为震源向外发射放射裂纹 + 环形断层)
  function generateImpactShatterCuts(impactNorm, density = 9) {
    const cx = Math.max(0.08, Math.min(0.92, impactNorm.x));
    const cy = Math.max(0.08, Math.min(0.92, impactNorm.y));
    const rand = seededRandom(Date.now());
    const rayCount = Math.max(5, Math.min(16, Math.round(density)));
    const cuts = [];
    const rayPolylines = [];

    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / rayCount) * 0.72;
      // 折线分 3 段向外辐射至 >1.6 半径确保切穿任意边界
      const r1 = 0.14 + rand() * 0.08;
      const r2 = 0.36 + rand() * 0.14;
      const r3 = 1.65;
      const jitter1 = (rand() - 0.5) * 0.14;
      const jitter2 = jitter1 + (rand() - 0.5) * 0.12;

      const p0 = { x: cx, y: cy };
      const p1 = { x: cx + Math.cos(baseAngle + jitter1) * r1, y: cy + Math.sin(baseAngle + jitter1) * r1 };
      const p2 = { x: cx + Math.cos(baseAngle + jitter2) * r2, y: cy + Math.sin(baseAngle + jitter2) * r2 };
      const p3 = { x: cx + Math.cos(baseAngle + jitter2) * r3, y: cy + Math.sin(baseAngle + jitter2) * r3 };

      rayPolylines.push([p0, p1, p2, p3]);
      cuts.push({
        id: `shat_ray_${Date.now()}_${i}`,
        mode: 'line',
        points: [p0, p1, p2, p3],
        closed: false,
        autoExtend: true
      });
    }

    // 在部分相邻射线之间生成冲击横纹断层 (蛛网碎玻璃特征！)
    for (let i = 0; i < rayCount; i++) {
      if (rand() < 0.72) {
        const rA = rayPolylines[i];
        const rB = rayPolylines[(i + 1) % rayCount];
        const tier = rand() < 0.5 ? 1 : 2;
        cuts.push({
          id: `shat_ring_${Date.now()}_${i}`,
          mode: 'line',
          points: [
            { x: rA[tier].x, y: rA[tier].y },
            { x: rB[tier].x, y: rB[tier].y }
          ],
          closed: false,
          autoExtend: false
        });
      }
    }

    return cuts;
  }

  // 模式 2：❄ 冰晶玻璃晶格 (Voronoi 水晶多边形切片，半平面裁剪精确求边)
  function generateVoronoiCrystalCuts(cellCount = 10) {
    const rand = seededRandom(Date.now() + 77);
    const n = Math.max(4, Math.min(22, Math.round(cellCount)));

    // 抖动网格采样种子点，保证冰晶碎片大小匀称自然不扎堆
    const cols = Math.ceil(Math.sqrt(n * 1.3));
    const rows = Math.ceil(n / cols);
    const seeds = [];
    for (let r = 0; r < rows && seeds.length < n; r++) {
      for (let c = 0; c < cols && seeds.length < n; c++) {
        seeds.push({
          x: (c + 0.2 + rand() * 0.6) / cols,
          y: (r + 0.2 + rand() * 0.6) / rows
        });
      }
    }

    // 对每个种子点用半平面裁剪求 Voronoi 单元，提取内部共享晶格边
    function clipPolyHalfPlane(poly, midX, midY, nx, ny) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const prev = poly[(i - 1 + poly.length) % poly.length];
        const dCur = (cur.x - midX) * nx + (cur.y - midY) * ny;
        const dPrev = (prev.x - midX) * nx + (prev.y - midY) * ny;
        if (dCur <= 1e-7) {
          if (dPrev > 1e-7) {
            const t = dPrev / (dPrev - dCur);
            out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t });
          }
          out.push(cur);
        } else if (dPrev <= 1e-7) {
          const t = dPrev / (dPrev - dCur);
          out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t });
        }
      }
      return out;
    }

    const edgeSet = new Map();
    const pad = 0.15;
    for (let i = 0; i < seeds.length; i++) {
      let cell = [
        { x: -pad, y: -pad },
        { x: 1 + pad, y: -pad },
        { x: 1 + pad, y: 1 + pad },
        { x: -pad, y: 1 + pad }
      ];
      for (let j = 0; j < seeds.length; j++) {
        if (i === j) continue;
        const mx = (seeds[i].x + seeds[j].x) * 0.5;
        const my = (seeds[i].y + seeds[j].y) * 0.5;
        const nx = seeds[j].x - seeds[i].x;
        const ny = seeds[j].y - seeds[i].y;
        cell = clipPolyHalfPlane(cell, mx, my, nx, ny);
        if (cell.length < 3) break;
      }
      for (let k = 0; k < cell.length; k++) {
        const a = cell[k];
        const b = cell[(k + 1) % cell.length];
        // 忽略远在外部包围盒上的辅助边
        if (
          (a.x <= -pad + 1e-3 && b.x <= -pad + 1e-3) ||
          (a.x >= 1 + pad - 1e-3 && b.x >= 1 + pad - 1e-3) ||
          (a.y <= -pad + 1e-3 && b.y <= -pad + 1e-3) ||
          (a.y >= 1 + pad - 1e-3 && b.y >= 1 + pad - 1e-3)
        ) continue;

        const ka = `${Math.round(a.x * 1000)}_${Math.round(a.y * 1000)}`;
        const kb = `${Math.round(b.x * 1000)}_${Math.round(b.y * 1000)}`;
        if (ka === kb) continue;
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        if (!edgeSet.has(key)) {
          edgeSet.set(key, { a, b });
        }
      }
    }

    const cuts = [];
    let idx = 0;
    for (const { a, b } of edgeSet.values()) {
      cuts.push({
        id: `voro_${Date.now()}_${idx++}`,
        mode: 'line',
        points: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }],
        closed: false,
        autoExtend: false
      });
    }
    return cuts;
  }

  // 模式 3：⚔ 剑光斩击碎裂 (沿主刀光两侧崩出锐利斜向裂片！)
  function generateSlashShatterCuts(startNorm, endNorm, shardDensity = 7) {
    const rand = seededRandom(Date.now() + 313);
    const dx = endNorm.x - startNorm.x;
    const dy = endNorm.y - startNorm.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    // 主斩击贯穿双平行狭长眼神/刀光带 + 两侧崩裂分叉
    const pStart = { x: startNorm.x - ux * 1.5, y: startNorm.y - uy * 1.5 };
    const pEnd = { x: endNorm.x + ux * 1.5, y: endNorm.y + uy * 1.5 };
    const bandHalf = 0.055;

    const cuts = [
      {
        id: `slash_main1_${Date.now()}`,
        mode: 'line',
        points: [
          { x: pStart.x + nx * bandHalf, y: pStart.y + ny * bandHalf },
          { x: pEnd.x + nx * bandHalf * 0.65, y: pEnd.y + ny * bandHalf * 0.65 }
        ],
        closed: false,
        autoExtend: true
      },
      {
        id: `slash_main2_${Date.now()}`,
        mode: 'line',
        points: [
          { x: pStart.x - nx * bandHalf * 0.65, y: pStart.y - ny * bandHalf * 0.65 },
          { x: pEnd.x - nx * bandHalf, y: pEnd.y - ny * bandHalf }
        ],
        closed: false,
        autoExtend: true
      }
    ];

    const count = Math.max(3, Math.min(12, Math.round(shardDensity)));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count + (rand() - 0.5) * 0.08;
      const side = i % 2 === 0 ? 1 : -1;
      const basePt = {
        x: startNorm.x + dx * t + nx * side * bandHalf * 0.8,
        y: startNorm.y + dy * t + ny * side * bandHalf * 0.8
      };
      const branchAng = Math.atan2(uy, ux) + side * (0.42 + rand() * 0.55);
      const midR = 0.22 + rand() * 0.12;
      const midPt = {
        x: basePt.x + Math.cos(branchAng) * midR,
        y: basePt.y + Math.sin(branchAng) * midR
      };
      const farPt = {
        x: midPt.x + Math.cos(branchAng + side * 0.18) * 1.5,
        y: midPt.y + Math.sin(branchAng + side * 0.18) * 1.5
      };
      cuts.push({
        id: `slash_br_${Date.now()}_${i}`,
        mode: 'line',
        points: [basePt, midPt, farPt],
        closed: false,
        autoExtend: false
      });
    }
    return cuts;
  }

  // =========================================================================
  // 🧩 真·凹凸拼图公母卡扣曲线生成 (把内部直边转换为严丝合缝咬合的圆头拼图边)
  // =========================================================================
  function buildJigsawCellPath2D(cell, outerPoly, scale = 1, offsetX = 0, offsetY = 0) {
    const path = new Path2D();
    const rings = [cell.outer, ...(cell.holes || [])];

    for (const ring of rings) {
      if (!ring || ring.length < 3) continue;
      path.moveTo(offsetX + ring[0].x * scale, offsetY + ring[0].y * scale);

      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);

        // 判断该边是否属于外轮廓边界 (外框边保持干净外轮廓，内部共享切割边长>=55px则生成凹凸拼图卡扣！)
        const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
        const isOuterEdge = isPointNearOuterBoundary(mid, outerPoly, 2.5);

        if (isOuterEdge || segLen < 55) {
          path.lineTo(offsetX + b.x * scale, offsetY + b.y * scale);
        } else {
          appendCanonicalJigsawEdge(path, a, b, scale, offsetX, offsetY);
        }
      }
      path.closePath();
    }
    return path;
  }

  function isPointNearOuterBoundary(pt, outerPoly, tol) {
    for (let i = 0; i < outerPoly.length; i++) {
      const p0 = outerPoly[i];
      const p1 = outerPoly[(i + 1) % outerPoly.length];
      if (global.PlanarSlicer.distToSegment(pt, p0, p1).dist <= tol) return true;
    }
    return false;
  }

  // 使用端点坐标字典序确定唯一法线朝向，确保相邻两格一凸一凹 100% 严丝合缝咬合！
  function appendCanonicalJigsawEdge(path, a, b, scale, ox, oy) {
    const forward = (Math.round(a.x * 10) < Math.round(b.x * 10)) ||
      (Math.round(a.x * 10) === Math.round(b.x * 10) && Math.round(a.y * 10) < Math.round(b.y * 10));

    const pStart = forward ? a : b;
    const pEnd = forward ? b : a;
    const dx = pEnd.x - pStart.x;
    const dy = pEnd.y - pStart.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    // 基于边中点哈希决定卡扣朝向
    const hash = Math.sin(Math.round((pStart.x + pEnd.x) * 0.5) * 12.9898 + Math.round((pStart.y + pEnd.y) * 0.5) * 78.233);
    const sign = hash >= 0 ? 1 : -1;
    const nx = -uy * sign;
    const ny = ux * sign;

    const tabSize = Math.min(len * 0.22, 34); // 卡扣突出高度

    // 经典圆润拼图卡扣参数化关键控制点 (沿 u 0->1, 法向 n)
    function ptAt(u, n) {
      return {
        x: ox + (pStart.x + ux * (u * len) + nx * (n * tabSize)) * scale,
        y: oy + (pStart.y + uy * (u * len) + ny * (n * tabSize)) * scale
      };
    }

    // 生成离散采样高精曲线点（正反向皆可严格对称复现，零错位！）
    const curveTemplate = [
      [0.00, 0.00],
      [0.36, 0.00],
      // 缩颈内收 + 圆润大蘑菇头卡扣
      ...sampleCubic([0.36, 0.00], [0.41, -0.10], [0.37, 0.35], [0.40, 0.68], 8),
      ...sampleCubic([0.40, 0.68], [0.43, 1.04], [0.57, 1.04], [0.60, 0.68], 10),
      ...sampleCubic([0.60, 0.68], [0.63, 0.35], [0.59, -0.10], [0.64, 0.00], 8),
      [1.00, 0.00]
    ];

    const ordered = forward ? curveTemplate : curveTemplate.slice().reverse();
    for (let i = 1; i < ordered.length; i++) {
      const p = ptAt(ordered[i][0], ordered[i][1]);
      path.lineTo(p.x, p.y);
    }
  }

  function sampleCubic(p0, p1, p2, p3, steps) {
    const pts = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      pts.push([
        mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
        mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
      ]);
    }
    return pts;
  }

  // =========================================================================
  // 📄 手撕画纸白毛边 & 🎞 电影胶卷齿孔框 & 💥 单格漫画集中线渲染
  // =========================================================================
  function drawTornPaperEdges(ctx, internalSegments, scale, baseWidth) {
    if (!internalSegments || !internalSegments.length) return;
    const bandW = Math.max(12 * scale, baseWidth * 1.45);

    ctx.save();
    // 先画底层纸张撕裂阴影
    ctx.shadowColor = 'rgba(15, 23, 42, 0.38)';
    ctx.shadowBlur = 9 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.fillStyle = '#f8fafc';

    for (const seg of internalSegments) {
      const ax = seg.a.x * scale, ay = seg.a.y * scale;
      const bx = seg.b.x * scale, by = seg.b.y * scale;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy);
      if (len < 2) continue;
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;

      const steps = Math.max(6, Math.round(len / (7 * scale)));
      const seedBase = Math.round(seg.a.x * 13 + seg.a.y * 29 + seg.b.x * 17);
      const rand = seededRandom(Math.abs(seedBase) + 11);

      const leftSide = [];
      const rightSide = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = ax + dx * t;
        const py = ay + dy * t;
        const jagL = (0.38 + rand() * 0.55) * bandW;
        const jagR = (0.38 + rand() * 0.55) * bandW;
        leftSide.push({ x: px + nx * jagL, y: py + ny * jagL });
        rightSide.push({ x: px - nx * jagR, y: py - ny * jagR });
      }

      ctx.beginPath();
      ctx.moveTo(leftSide[0].x, leftSide[0].y);
      for (let i = 1; i < leftSide.length; i++) ctx.lineTo(leftSide[i].x, leftSide[i].y);
      for (let i = rightSide.length - 1; i >= 0; i--) ctx.lineTo(rightSide[i].x, rightSide[i].y);
      ctx.closePath();
      ctx.fill();

      // 叠加内层亮白纸芯，制造双层手撕毛绒纤维层次感！
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.max(1, 1.2 * scale);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFilmStripOverlay(ctx, rw, rh, scale) {
    const railW = Math.max(28 * scale, Math.min(rw, rh) * 0.048);
    const isVertical = rh >= rw * 0.95;

    ctx.save();
    ctx.fillStyle = '#0f1117';
    if (isVertical) {
      ctx.fillRect(0, 0, railW, rh);
      ctx.fillRect(rw - railW, 0, railW, rh);

      const holeW = railW * 0.46;
      const holeH = holeW * 1.35;
      const pitch = holeH * 2.05;
      ctx.fillStyle = '#f8fafc';
      for (let y = pitch * 0.4; y < rh - holeH; y += pitch) {
        ctx.beginPath();
        ctx.roundRect((railW - holeW) * 0.5, y, holeW, holeH, holeW * 0.22);
        ctx.roundRect(rw - railW + (railW - holeW) * 0.5, y, holeW, holeH, holeW * 0.22);
        ctx.fill();
      }
      // 胶卷边暗金帧码装饰
      ctx.fillStyle = '#f59e0b';
      ctx.font = `700 ${Math.max(8, Math.round(railW * 0.24))}px Consolas, monospace`;
      ctx.save();
      ctx.translate(railW * 0.84, rh * 0.22);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('▶ PRISM FILM 400TX · 24A', 0, 0);
      ctx.restore();
    } else {
      ctx.fillRect(0, 0, rw, railW);
      ctx.fillRect(0, rh - railW, rw, railW);

      const holeH = railW * 0.46;
      const holeW = holeH * 1.35;
      const pitch = holeW * 2.05;
      ctx.fillStyle = '#f8fafc';
      for (let x = pitch * 0.4; x < rw - holeW; x += pitch) {
        ctx.beginPath();
        ctx.roundRect(x, (railW - holeH) * 0.5, holeW, holeH, holeH * 0.22);
        ctx.roundRect(x, rh - railW + (railW - holeH) * 0.5, holeW, holeH, holeH * 0.22);
        ctx.fill();
      }
      ctx.fillStyle = '#f59e0b';
      ctx.font = `700 ${Math.max(8, Math.round(railW * 0.24))}px Consolas, monospace`;
      ctx.fillText('▶ PRISM CINEMA 400TX   12A', railW * 0.6, railW * 0.88);
    }
    ctx.restore();
  }

  // 绘制单格漫画/情绪线条：放射集中线、斜向速度线、凄美细雨线、星芒柔光氛围
  // 支持自定义焦点 (focusX, focusY)、留空安全半径 (safeRadius)、颜色与不透明度！
  function drawCellMangaLines(ctx, boxX, boxY, boxW, boxH, lineMode, scale, options = {}) {
    if (!lineMode || lineMode === 'none') return;
    const lineColor = typeof options === 'string' ? options : (options.color || '#0f172a');
    const opacity = typeof options === 'object' && options.opacity != null ? options.opacity : 0.78;
    const fxNorm = typeof options === 'object' && options.focusX != null ? options.focusX : 0.5;
    const fyNorm = typeof options === 'object' && options.focusY != null ? options.focusY : 0.38;
    const safeRatio = typeof options === 'object' && options.safeRadius != null ? options.safeRadius : 0.34;

    const cx = boxX + boxW * fxNorm;
    const cy = boxY + boxH * fyNorm;
    // 确保无论焦点移到哪个角落，放射线都能完整覆盖分镜格四角
    const d1 = Math.hypot(cx - boxX, cy - boxY);
    const d2 = Math.hypot(boxX + boxW - cx, cy - boxY);
    const d3 = Math.hypot(cx - boxX, boxY + boxH - cy);
    const d4 = Math.hypot(boxX + boxW - cx, boxY + boxH - cy);
    const maxR = Math.max(d1, d2, d3, d4) * 1.12;
    const innerSafeR = Math.min(boxW, boxH) * Math.max(0.08, safeRatio);
    const rand = seededRandom(Math.round(boxW * 3 + boxH * 7) + 99);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = lineColor;
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = Math.max(0.05, Math.min(1, opacity));

    if (lineMode === 'focus') {
      const spikes = 64;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + (rand() - 0.5) * 0.042;
        const inner = innerSafeR * (0.86 + rand() * 0.44);
        const halfSpread = 0.007 + rand() * 0.015;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a - halfSpread) * maxR, cy + Math.sin(a - halfSpread) * maxR);
        ctx.lineTo(cx + Math.cos(a + halfSpread) * maxR, cy + Math.sin(a + halfSpread) * maxR);
        ctx.closePath();
        ctx.fill();
      }
    } else if (lineMode === 'speed') {
      ctx.translate(cx, cy);
      ctx.rotate(-0.28);
      const spanW = maxR * 2;
      const count = 46;
      for (let i = 0; i < count; i++) {
        const y = (i / count - 0.5) * spanW;
        const avoidBand = Math.abs(y) < innerSafeR * 0.85;
        if (avoidBand && rand() < 0.78) continue;
        const minOffset = avoidBand ? innerSafeR * (0.95 + rand() * 0.35) : spanW * (0.06 + rand() * 0.22);
        const dir = rand() < 0.5 ? -1 : 1;
        const startX = dir * minOffset;
        const endX = dir * maxR * 1.15;
        ctx.lineWidth = (0.8 + rand() * 2.1) * scale;
        ctx.globalAlpha = opacity * (0.5 + rand() * 0.45);
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    } else if (lineMode === 'rain') {
      // 🌧 凄美细雨线：微倾角纤细雨丝 + 焦点面部周围柔和减弱不遮挡眼神
      ctx.translate(boxX + boxW * 0.5, boxY + boxH * 0.5);
      ctx.rotate(0.16);
      const span = Math.hypot(boxW, boxH) * 1.25;
      const drops = 78;
      ctx.lineCap = 'round';
      for (let i = 0; i < drops; i++) {
        const rx = (rand() - 0.5) * span;
        const ry = (rand() - 0.5) * span;
        // 转换回世界粗略判断与焦点距离，让角色眼部周围雨丝更轻柔
        const approxWx = boxX + boxW * 0.5 + rx;
        const approxWy = boxY + boxH * 0.5 + ry;
        const distToFocus = Math.hypot(approxWx - cx, approxWy - cy);
        if (distToFocus < innerSafeR * 0.65 && rand() < 0.72) continue;

        const len = (18 + rand() * 58) * scale;
        ctx.lineWidth = (0.7 + rand() * 1.25) * scale;
        ctx.globalAlpha = opacity * (0.24 + rand() * 0.56);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry + len);
        ctx.stroke();
      }
    } else if (lineMode === 'sparkle') {
      // ✨ 星芒柔光氛围：围绕焦点的柔和散景光斑 + 四芒星点缀（严守安全圈不挡五官）
      const bokehCount = 26;
      for (let i = 0; i < bokehCount; i++) {
        const ang = rand() * Math.PI * 2;
        const dist = innerSafeR * 0.95 + rand() * (maxR - innerSafeR * 0.85) * 0.78;
        const bx = cx + Math.cos(ang) * dist;
        const by = cy + Math.sin(ang) * dist;
        const br = (4 + rand() * 18) * scale;
        ctx.globalAlpha = opacity * (0.10 + rand() * 0.22);
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      const starCount = 22;
      for (let i = 0; i < starCount; i++) {
        const ang = (i / starCount) * Math.PI * 2 + (rand() - 0.5) * 0.25;
        const dist = innerSafeR * (0.92 + rand() * 1.45);
        const sx = cx + Math.cos(ang) * dist;
        const sy = cy + Math.sin(ang) * dist;
        const sr = (4 + rand() * 10) * scale;
        const ir = sr * 0.22;
        ctx.globalAlpha = opacity * (0.52 + rand() * 0.45);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const sa = (k * Math.PI) / 4;
          const rad = k % 2 === 0 ? sr : ir;
          const px = sx + Math.cos(sa) * rad;
          const py = sy + Math.sin(sa) * rad;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // =========================================================================
  // 🔗 自由相框「跟随所属分镜图片大小与方向同步变换」锚定引擎
  // 当 ff.followHostCell === true 时：
  // 调整所属分镜格内图片的缩放大小、旋转方向(90°/微调角)、镜像翻转或平移位置时，
  // 位于该分镜格内的自由相框将同步缩放、旋转与位移；关闭时则保持独立不动！
  // =========================================================================
  function getHostCellReferenceTransform(cellId, state) {
    if (!cellId || !state || !state.topology) return null;
    const idx = state.topology.cells.findIndex(c => c.id === cellId);
    if (idx < 0) return null;
    const cell = state.topology.cells[idx];
    const asset = cell.assetId ? state.assetMap.get(cell.assetId) : null;

    if (asset && global.CollageRenderer && global.CollageRenderer.computeCellImageParams) {
      const p = global.CollageRenderer.computeCellImageParams(cell, idx, asset, state.canvasW, state.canvasH, 1, state);
      if (p) {
        return {
          hasImage: true,
          centerX: p.centerX,
          centerY: p.centerY,
          drawW: Math.max(1, p.drawW),
          drawH: Math.max(1, p.drawH),
          totalRad: p.totalRad || 0,
          flipX: !!p.flipX,
          flipY: !!p.flipY
        };
      }
    }

    // 若该分镜格暂未填图，以该分镜格几何包围盒为参考系
    const b = cell.bounds;
    return {
      hasImage: false,
      centerX: b.cx,
      centerY: b.cy,
      drawW: Math.max(1, b.w),
      drawH: Math.max(1, b.h),
      totalRad: 0,
      flipX: false,
      flipY: false
    };
  }

  function recordFrameHostAnchor(ff, state) {
    if (!ff || !ff.followHostCell) {
      if (ff) {
        ff.hostCellId = null;
        ff.hostAnchorData = null;
      }
      return;
    }

    // 寻找包含当前自由相框中心点的底层分镜格
    const fx = ff.x * state.canvasW;
    const fy = ff.y * state.canvasH;
    let hostCell = null;
    if (!state.hideBaseCells && state.topology && Array.isArray(state.topology.cells)) {
      const sorted = state.topology.cells.slice().sort((a, b) => a.area - b.area);
      for (const c of sorted) {
        if (global.PlanarSlicer.pointInCell({ x: fx, y: fy }, c)) {
          hostCell = c;
          break;
        }
      }
    }

    if (!hostCell) {
      ff.hostCellId = null;
      ff.hostAnchorData = null;
      return;
    }

    ff.hostCellId = hostCell.id;
    const ref = getHostCellReferenceTransform(hostCell.id, state);
    if (!ref) return;

    const dx = fx - ref.centerX;
    const dy = fy - ref.centerY;
    // 逆向解旋
    const cosN = Math.cos(-ref.totalRad);
    const sinN = Math.sin(-ref.totalRad);
    const rx = dx * cosN - dy * sinN;
    const ry = dx * sinN + dy * cosN;
    // 逆向解镜像翻转
    const lx = ref.flipX ? -rx : rx;
    const ly = ref.flipY ? -ry : ry;

    const flipSign = (ref.flipX ? -1 : 1) * (ref.flipY ? -1 : 1);
    const baseDeg = (ref.totalRad * 180) / Math.PI;

    ff.hostAnchorData = {
      u: lx / ref.drawW,
      v: ly / ref.drawH,
      relW: (ff.w * state.canvasW) / ref.drawW,
      relH: (ff.h * state.canvasH) / ref.drawH,
      relRot: ((ff.rotation || 0) - baseDeg) * flipSign,
      hadImage: ref.hasImage
    };
  }

  function syncFrameFromHostAnchor(ff, state) {
    if (!ff || !ff.followHostCell || !ff.hostCellId || !ff.hostAnchorData) return;
    const ref = getHostCellReferenceTransform(ff.hostCellId, state);
    if (!ref) return;

    // 如果分镜格刚刚从无图变为有图（或清空了图片），先在当前视觉位置无缝重绑基准，避免跳变！
    if (ref.hasImage !== ff.hostAnchorData.hadImage) {
      recordFrameHostAnchor(ff, state);
      return;
    }

    const ad = ff.hostAnchorData;
    const lx = ad.u * ref.drawW;
    const ly = ad.v * ref.drawH;
    const rx = ref.flipX ? -lx : lx;
    const ry = ref.flipY ? -ly : ly;

    const cosP = Math.cos(ref.totalRad);
    const sinP = Math.sin(ref.totalRad);
    const fx = ref.centerX + rx * cosP - ry * sinP;
    const fy = ref.centerY + rx * sinP + ry * cosP;

    const flipSign = (ref.flipX ? -1 : 1) * (ref.flipY ? -1 : 1);
    const baseDeg = (ref.totalRad * 180) / Math.PI;

    ff.x = fx / Math.max(1, state.canvasW);
    ff.y = fy / Math.max(1, state.canvasH);
    ff.w = Math.max(0.03, (ad.relW * ref.drawW) / Math.max(1, state.canvasW));
    ff.h = Math.max(0.03, (ad.relH * ref.drawH) / Math.max(1, state.canvasH));
    ff.rotation = Math.round((baseDeg + ad.relRot * flipSign) * 10) / 10;
  }

  global.FxLabEngine = {
    extractCharacterOshiPalette,
    pickScreenColorWithEyedropper,
    generateImpactShatterCuts,
    generateVoronoiCrystalCuts,
    generateSlashShatterCuts,
    buildJigsawCellPath2D,
    drawTornPaperEdges,
    drawFilmStripOverlay,
    drawCellMangaLines,
    recordFrameHostAnchor,
    syncFrameFromHostAnchor
  };
})(window);
