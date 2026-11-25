(function (global) {
  const SILHOUETTE_PRESETS = [
    { id: 'rect', name: '标准矩形', symmetric: false, icon: '<rect x="3" y="5" width="22" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'rounded', name: '大圆角框', symmetric: false, icon: '<rect x="3" y="5" width="22" height="18" rx="6" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'circle', name: '正圆/吧唧', symmetric: true, icon: '<circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'ellipse', name: '椭圆画框', symmetric: false, icon: '<ellipse cx="14" cy="14" rx="11" ry="8" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'capsule', name: '胶囊跑道', symmetric: false, icon: '<rect x="2" y="7" width="24" height="14" rx="7" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'diamond', name: '菱形徽章', symmetric: true, icon: '<polygon points="14,3 25,14 14,25 3,14" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'hexagon', name: '正六边形', symmetric: true, icon: '<polygon points="14,3 24,8.5 24,19.5 14,25 4,19.5 4,8.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'octagon', name: '正八边形', symmetric: true, icon: '<polygon points="9.5,3 18.5,3 25,9.5 25,18.5 18.5,25 9.5,25 3,18.5 3,9.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'heart', name: '爱心异形', symmetric: true, icon: '<path d="M14 24 C14 24 4 17 4 10.5 C4 7 6.8 4.5 10 4.5 C12 4.5 13.4 5.6 14 7 C14.6 5.6 16 4.5 18 4.5 C21.2 4.5 24 7 24 10.5 C24 17 14 24 14 24 Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'star5', name: '五角星章', symmetric: true, icon: '<polygon points="14,3 17.2,10 25,10.8 19.2,16 20.8,24 14,19.8 7.2,24 8.8,16 3,10.8 10.8,10" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'sparkle4', name: '四角星芒', symmetric: true, icon: '<polygon points="14,2 17,11 26,14 17,17 14,26 11,17 2,14 11,11" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'fan', name: '和风折扇', symmetric: true, icon: '<path d="M4 12 A13 13 0 0 1 24 12 L18 23 A5 5 0 0 0 10 23 Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'shield', name: '纹章盾牌', symmetric: true, icon: '<path d="M5 5 L14 3 L23 5 L23 14 C23 20 14 25 14 25 C14 25 5 20 5 14 Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'stamp', name: '邮票齿孔', symmetric: false, icon: '<rect x="4" y="5" width="20" height="18" stroke-dasharray="2.5 2" fill="none" stroke="currentColor" stroke-width="2"/>' }
  ];

  // Catmull-Rom 闭合平滑样条采样
  function sampleClosedCatmullRom(pts, segmentsPerEdge = 16) {
    const n = pts.length;
    if (n < 3) return pts.map(p => ({ x: p.x, y: p.y }));
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];

      if (p1.smooth === false && p2.smooth === false) {
        out.push({ x: p1.x, y: p1.y });
        continue;
      }

      const steps = (p1.smooth || p2.smooth) ? segmentsPerEdge : 1;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        out.push({ x, y });
      }
    }
    return out;
  }

  // Ramer-Douglas-Peucker 简化手绘轨迹
  function simplifyPolyline(pts, epsilon) {
    if (pts.length <= 2) return pts.slice();
    let maxDist = 0;
    let index = 0;
    const start = pts[0];
    const end = pts[pts.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lenSq = dx * dx + dy * dy;

    for (let i = 1; i < pts.length - 1; i++) {
      let dist;
      if (lenSq === 0) {
        dist = Math.hypot(pts[i].x - start.x, pts[i].y - start.y);
      } else {
        const t = Math.max(0, Math.min(1, ((pts[i].x - start.x) * dx + (pts[i].y - start.y) * dy) / lenSq));
        dist = Math.hypot(pts[i].x - (start.x + t * dx), pts[i].y - (start.y + t * dy));
      }
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left = simplifyPolyline(pts.slice(0, index + 1), epsilon);
      const right = simplifyPolyline(pts.slice(index), epsilon);
      return left.slice(0, -1).concat(right);
    }
    return [start, end];
  }

  // Chaikin 保凸平滑闭合多边形（绝不产生自交环，专用于复杂人物剪影外轮廓平滑，确保平面分镜切割 100% 稳定！）
  function smoothClosedPolygonChaikin(pts, iterations = 2) {
    let cur = pts.map(p => ({ x: p.x, y: p.y }));
    for (let it = 0; it < iterations; it++) {
      if (cur.length < 3 || cur.length > 360) break;
      const next = [];
      const n = cur.length;
      for (let i = 0; i < n; i++) {
        const a = cur[i];
        const b = cur[(i + 1) % n];
        next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      cur = next;
    }
    return cur;
  }

  function ensureClockwiseScreen(poly) {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      sum += a.x * b.y - b.x * a.y;
    }
    if (sum < 0) return poly.slice().reverse();
    return poly;
  }

  // 生成画布总外轮廓像素多边形 (顺时针 CW on screen)
  function buildOuterContourPolygon(contourCfg, W, H) {
    const type = (contourCfg && contourCfg.type) || 'rect';
    const keepAspect = contourCfg && contourCfg.keepAspect !== false;
    const presetMeta = SILHOUETTE_PRESETS.find(p => p.id === type);

    // 计算绘制包围盒 (用于正圆/爱心/徽章 1:1 智能保形)
    let bx = 0, by = 0, bw = W, bh = H;
    if (keepAspect && presetMeta && presetMeta.symmetric) {
      const side = Math.min(W, H);
      bx = (W - side) / 2;
      by = (H - side) / 2;
      bw = side;
      bh = side;
    } else if (keepAspect && type === 'custom' && contourCfg.baseAspect) {
      const targetAspect = contourCfg.baseAspect;
      const curAspect = W / H;
      if (curAspect > targetAspect) {
        bh = H;
        bw = H * targetAspect;
        bx = (W - bw) / 2;
      } else {
        bw = W;
        bh = W / targetAspect;
        by = (H - bh) / 2;
      }
    }

    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const pts = [];

    if (type === 'custom' && Array.isArray(contourCfg.customPoints) && contourCfg.customPoints.length >= 3) {
      const mapped = contourCfg.customPoints.map(p => ({
        x: bx + p.x * bw,
        y: by + p.y * bh,
        smooth: !!p.smooth
      }));
      // 若为人物轮廓提取出的密集剪影，采用无自交 Chaikin 平滑，保证复杂裙摆头纱内切割零误差！
      if (contourCfg.silhouetteMeta) {
        const iters = mapped.length <= 90 ? 2 : mapped.length <= 180 ? 1 : 0;
        return ensureClockwiseScreen(smoothClosedPolygonChaikin(mapped, iters));
      }
      const anySmooth = mapped.some(p => p.smooth);
      const segs = Math.max(3, Math.min(18, Math.round(160 / Math.max(1, mapped.length))));
      const dense = anySmooth ? sampleClosedCatmullRom(mapped, segs) : mapped;
      return ensureClockwiseScreen(dense);
    }

    switch (type) {
      case 'rect': {
        pts.push(
          { x: 0, y: 0 },
          { x: W, y: 0 },
          { x: W, y: H },
          { x: 0, y: H }
        );
        break;
      }
      case 'rounded': {
        const r = Math.min(W, H) * 0.12;
        const steps = 14;
        const corners = [
          { cx: W - r, cy: r, a0: -Math.PI / 2, a1: 0 },
          { cx: W - r, cy: H - r, a0: 0, a1: Math.PI / 2 },
          { cx: r, cy: H - r, a0: Math.PI / 2, a1: Math.PI },
          { cx: r, cy: r, a0: Math.PI, a1: Math.PI * 1.5 }
        ];
        for (const c of corners) {
          for (let i = 0; i <= steps; i++) {
            const a = c.a0 + (c.a1 - c.a0) * (i / steps);
            pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
          }
        }
        break;
      }
      case 'circle':
      case 'ellipse': {
        const rx = bw * 0.49;
        const ry = bh * 0.49;
        const steps = 128;
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
          pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
        }
        break;
      }
      case 'capsule': {
        const steps = 32;
        if (W >= H) {
          const r = H * 0.48;
          const lx = r + W * 0.01;
          const rx = W - lx;
          for (let i = 0; i <= steps; i++) {
            const a = -Math.PI / 2 + Math.PI * (i / steps);
            pts.push({ x: rx + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r });
          }
          for (let i = 0; i <= steps; i++) {
            const a = Math.PI / 2 + Math.PI * (i / steps);
            pts.push({ x: lx + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r });
          }
        } else {
          const r = W * 0.48;
          const ty = r + H * 0.01;
          const by2 = H - ty;
          for (let i = 0; i <= steps; i++) {
            const a = Math.PI + Math.PI * (i / steps);
            pts.push({ x: W / 2 + Math.cos(a) * r, y: ty + Math.sin(a) * r });
          }
          for (let i = 0; i <= steps; i++) {
            const a = 0 + Math.PI * (i / steps);
            pts.push({ x: W / 2 + Math.cos(a) * r, y: by2 + Math.sin(a) * r });
          }
        }
        break;
      }
      case 'diamond': {
        pts.push(
          { x: cx, y: by + bh * 0.02 },
          { x: bx + bw * 0.98, y: cy },
          { x: cx, y: by + bh * 0.98 },
          { x: bx + bw * 0.02, y: cy }
        );
        break;
      }
      case 'hexagon':
      case 'octagon': {
        const sides = type === 'hexagon' ? 6 : 8;
        const rx = bw * 0.485;
        const ry = bh * 0.485;
        const offset = type === 'hexagon' ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / 8;
        for (let i = 0; i < sides; i++) {
          const a = offset + (i / sides) * Math.PI * 2;
          pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
        }
        break;
      }
      case 'heart': {
        const steps = 128;
        for (let i = 0; i < steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          // 经典心形参数方程 (t=0 顶部裂口顺时针)
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          pts.push({
            x: cx + (hx / 17) * (bw * 0.48),
            y: cy + ((hy + 2.2) / 16.5) * (bh * 0.47)
          });
        }
        break;
      }
      case 'star5': {
        const outerR = bw * 0.49;
        const innerR = bw * 0.21;
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * (r * (bh / bw)) });
        }
        break;
      }
      case 'sparkle4': {
        // 平滑内凹四角星芒
        const outerR = bw * 0.49;
        const innerR = bw * 0.14;
        const anchors = [];
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = -Math.PI / 2 + (i * Math.PI) / 4;
          anchors.push({
            x: cx + Math.cos(a) * r,
            y: cy + Math.sin(a) * (r * (bh / bw)),
            smooth: i % 2 === 1
          });
        }
        return ensureClockwiseScreen(sampleClosedCatmullRom(anchors, 12));
      }
      case 'fan': {
        const pivotX = cx;
        const pivotY = by + bh * 0.86;
        const rOuter = bw * 0.56;
        const rInner = bw * 0.17;
        const aStart = -Math.PI * 0.84;
        const aEnd = -Math.PI * 0.16;
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const a = aStart + (aEnd - aStart) * (i / steps);
          pts.push({ x: pivotX + Math.cos(a) * rOuter, y: pivotY + Math.sin(a) * rOuter });
        }
        for (let i = steps; i >= 0; i--) {
          const a = aStart + (aEnd - aStart) * (i / steps);
          pts.push({ x: pivotX + Math.cos(a) * rInner, y: pivotY + Math.sin(a) * rInner });
        }
        break;
      }
      case 'shield': {
        const topY = by + bh * 0.05;
        const midY = by + bh * 0.48;
        const botY = by + bh * 0.96;
        const leftX = bx + bw * 0.08;
        const rightX = bx + bw * 0.92;
        pts.push({ x: cx, y: by + bh * 0.02 });
        pts.push({ x: rightX, y: topY + bh * 0.04 });
        pts.push({ x: rightX, y: midY });
        const steps = 28;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = (1 - t) * (1 - t) * rightX + 2 * (1 - t) * t * (bx + bw * 0.86) + t * t * cx;
          const y = (1 - t) * (1 - t) * midY + 2 * (1 - t) * t * (by + bh * 0.82) + t * t * botY;
          pts.push({ x, y });
        }
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * (bx + bw * 0.14) + t * t * leftX;
          const y = (1 - t) * (1 - t) * botY + 2 * (1 - t) * t * (by + bh * 0.82) + t * t * midY;
          pts.push({ x, y });
        }
        pts.push({ x: leftX, y: topY + bh * 0.04 });
        break;
      }
      case 'stamp': {
        // 邮票齿孔边
        const pad = Math.min(W, H) * 0.025;
        const x0 = pad, y0 = pad, x1 = W - pad, y1 = H - pad;
        const toothPitch = Math.max(24, Math.min(W, H) * 0.065);
        const r = toothPitch * 0.24;

        function addPerforatedEdge(sx, sy, ex, ey) {
          const len = Math.hypot(ex - sx, ey - sy);
          const count = Math.max(3, Math.round(len / toothPitch));
          const ux = (ex - sx) / len;
          const uy = (ey - sy) / len;
          // 顺时针向内的法线 (右手法则 screen coords: (-uy, ux))
          const nx = -uy;
          const ny = ux;
          pts.push({ x: sx, y: sy });
          for (let i = 0; i < count; i++) {
            const cDist = ((i + 0.5) / count) * len;
            const px = sx + ux * (cDist - r);
            const py = sy + uy * (cDist - r);
            pts.push({ x: px, y: py });
            const mx = sx + ux * cDist;
            const my = sy + uy * cDist;
            const baseA = Math.atan2(-uy, -ux);
            for (let s = 1; s < 8; s++) {
              // 半圆向内凹陷
              const theta = (s / 8) * Math.PI;
              const cosT = Math.cos(theta);
              const sinT = Math.sin(theta);
              pts.push({
                x: mx - ux * r * cosT + nx * r * sinT,
                y: my - uy * r * cosT + ny * r * sinT
              });
            }
            pts.push({ x: sx + ux * (cDist + r), y: sy + uy * (cDist + r) });
          }
        }
        addPerforatedEdge(x0, y0, x1, y0);
        addPerforatedEdge(x1, y0, x1, y1);
        addPerforatedEdge(x1, y1, x0, y1);
        addPerforatedEdge(x0, y1, x0, y0);
        break;
      }
      default: {
        pts.push({ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H });
      }
    }

    return ensureClockwiseScreen(pts);
  }

  // 构建自由叠放相框的局部多边形 (局部中心 0,0，尺寸 fw, fh，支持 custom 人物剪影自由相框！)
  function buildFreeFrameShapePolygon(shapeType, fw, fh, cornerRadius = 0, customPoints = null) {
    const hw = fw / 2;
    const hh = fh / 2;
    if (shapeType === 'custom' && Array.isArray(customPoints) && customPoints.length >= 3) {
      const mapped = customPoints.map(p => ({
        x: (p.x - 0.5) * fw,
        y: (p.y - 0.5) * fh
      }));
      const iters = mapped.length <= 90 ? 2 : mapped.length <= 180 ? 1 : 0;
      return ensureClockwiseScreen(smoothClosedPolygonChaikin(mapped, iters));
    }
    switch (shapeType) {
      case 'circle': {
        const pts = [];
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          pts.push({ x: Math.cos(a) * hw, y: Math.sin(a) * hh });
        }
        return pts;
      }
      case 'slant-left': {
        const skew = Math.min(fw * 0.22, fh * 0.45);
        return [
          { x: -hw + skew, y: -hh },
          { x: hw, y: -hh },
          { x: hw - skew, y: hh },
          { x: -hw, y: hh }
        ];
      }
      case 'slant-right': {
        const skew = Math.min(fw * 0.22, fh * 0.45);
        return [
          { x: -hw, y: -hh },
          { x: hw - skew, y: -hh },
          { x: hw, y: hh },
          { x: -hw + skew, y: hh }
        ];
      }
      case 'diamond':
        return [
          { x: 0, y: -hh },
          { x: hw, y: 0 },
          { x: 0, y: hh },
          { x: -hw, y: 0 }
        ];
      case 'hexagon': {
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
          pts.push({ x: Math.cos(a) * hw, y: Math.sin(a) * hh });
        }
        return pts;
      }
      case 'heart': {
        const pts = [];
        for (let i = 0; i < 72; i++) {
          const t = (i / 72) * Math.PI * 2;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          pts.push({
            x: (hx / 16.5) * hw,
            y: ((hy + 2.2) / 16) * hh
          });
        }
        return pts;
      }
      case 'star': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const rRatio = i % 2 === 0 ? 1 : 0.43;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push({ x: Math.cos(a) * hw * rRatio, y: Math.sin(a) * hh * rRatio });
        }
        return pts;
      }
      case 'rect':
      case 'polaroid':
      default: {
        const r = Math.min(cornerRadius, hw, hh);
        if (r <= 0.5) {
          return [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: hw, y: hh },
            { x: -hw, y: hh }
          ];
        }
        const pts = [];
        const corners = [
          { cx: hw - r, cy: -hh + r, a0: -Math.PI / 2, a1: 0 },
          { cx: hw - r, cy: hh - r, a0: 0, a1: Math.PI / 2 },
          { cx: -hw + r, cy: hh - r, a0: Math.PI / 2, a1: Math.PI },
          { cx: -hw + r, cy: -hh + r, a0: Math.PI, a1: Math.PI * 1.5 }
        ];
        for (const c of corners) {
          for (let i = 0; i <= 8; i++) {
            const a = c.a0 + (c.a1 - c.a0) * (i / 8);
            pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
          }
        }
        return pts;
      }
    }
  }

  global.SilhouetteEngine = {
    SILHOUETTE_PRESETS,
    sampleClosedCatmullRom,
    smoothClosedPolygonChaikin,
    simplifyPolyline,
    ensureClockwiseScreen,
    buildOuterContourPolygon,
    buildFreeFrameShapePolygon
  };
})(window);
