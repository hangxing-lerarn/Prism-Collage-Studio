(function (global) {
  // =========================================================================
  // PlanarSlicer: 2D 平面拓扑连续切割引擎
  // 支持：
  // 1. 直线、多段折线、锚点 C/S 三次贝塞尔曲线、手绘平滑曲线
  // 2. 任意异形外轮廓裁剪 (正圆、心形、星芒、邮票、自定义不规则多边形/曲线)
  // 3. 半截悬空刀口暂存与 T 型 / Y 型多格自动交汇闭合
  // 4. 可选射线/切线自动延伸切穿边界
  // 5. 内部自闭合“挖洞”成格 (画中画独立内嵌格 + 母格带孔洞)
  // 6. 持久保留各格子图片与构图参数
  // =========================================================================

  function signedArea(poly) {
    let sum = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum * 0.5; // Y轴向下时，顺时针(CW) > 0
  }

  function polyBounds(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  function polyCentroid(poly) {
    let cx = 0, cy = 0, a = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const p0 = poly[i];
      const p1 = poly[(i + 1) % n];
      const cross = p0.x * p1.y - p1.x * p0.y;
      a += cross;
      cx += (p0.x + p1.x) * cross;
      cy += (p0.y + p1.y) * cross;
    }
    if (Math.abs(a) < 1e-5) {
      const b = polyBounds(poly);
      return { x: b.cx, y: b.cy };
    }
    a *= 3;
    return { x: cx / a, y: cy / a };
  }

  function pointInRing(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].x, yi = ring[i].y;
      const xj = ring[j].x, yj = ring[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < ((xj - xi) * (pt.y - yi)) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInCell(pt, cell) {
    if (!pointInRing(pt, cell.outer)) return false;
    if (cell.holes && cell.holes.length) {
      for (const h of cell.holes) {
        if (pointInRing(pt, h)) return false;
      }
    }
    return true;
  }

  function distToSegment(pt, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) return { dist: Math.hypot(pt.x - a.x, pt.y - a.y), proj: { x: a.x, y: a.y }, t: 0 };
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    return { dist: Math.hypot(pt.x - px, pt.y - py), proj: { x: px, y: py }, t };
  }

  // 将一条参数化 cut (归一化坐标) 采样为像素折线点串
  function sampleCutPointsPx(cut, W, H) {
    const pts = (cut.points || []).map(p => ({ x: p.x * W, y: p.y * H }));
    if (pts.length < 2) return pts;

    if (cut.mode === 'curve') {
      // 支持带双控制点 cp1, cp2 的三次贝塞尔曲线 (C型 / S型)，也支持多锚点平滑曲线
      if (pts.length === 2 && cut.cp1 && cut.cp2) {
        const p0 = pts[0];
        const p3 = pts[1];
        const p1 = { x: cut.cp1.x * W, y: cut.cp1.y * H };
        const p2 = { x: cut.cp2.x * W, y: cut.cp2.y * H };
        const steps = 56;
        const out = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const mt = 1 - t;
          out.push({
            x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
            y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
          });
        }
        return out;
      }
      // 多点开放/闭合 Catmull-Rom 样条
      return sampleOpenOrClosedSpline(pts, !!cut.closed, 20);
    }

    if (cut.mode === 'free') {
      return sampleOpenOrClosedSpline(pts, !!cut.closed, 14);
    }

    // 直线或折线
    if (cut.closed && pts.length >= 3) {
      return pts.concat([{ x: pts[0].x, y: pts[0].y }]);
    }
    return pts;
  }

  function sampleOpenOrClosedSpline(pts, closed, segSteps = 16) {
    if (pts.length < 2) return pts.slice();
    if (closed && pts.length >= 3) {
      const dense = global.SilhouetteEngine.sampleClosedCatmullRom(
        pts.map(p => ({ x: p.x, y: p.y, smooth: true })),
        segSteps
      );
      dense.push({ x: dense[0].x, y: dense[0].y });
      return dense;
    }
    if (pts.length === 2) return pts.slice();
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];
      for (let s = 0; s < segSteps; s++) {
        const t = s / segSteps;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push({ x: pts[n - 1].x, y: pts[n - 1].y });
    return out;
  }

  // 射线与线段集合求最近交点 (用于自动延伸切透 & 边界磁吸)
  function raycastNearestSegment(origin, dirX, dirY, segments, minT = 0.5) {
    const len = Math.hypot(dirX, dirY);
    if (len < 1e-8) return null;
    const ux = dirX / len;
    const uy = dirY / len;
    let bestT = Infinity;
    let bestPt = null;

    for (const seg of segments) {
      const sx = seg.b.x - seg.a.x;
      const sy = seg.b.y - seg.a.y;
      const denom = ux * sy - uy * sx;
      if (Math.abs(denom) < 1e-9) continue;
      const qx = seg.a.x - origin.x;
      const qy = seg.a.y - origin.y;
      const t = (qx * sy - qy * sx) / denom;
      const u = (qx * uy - qy * ux) / denom;
      if (t >= minT && u >= -1e-5 && u <= 1 + 1e-5) {
        if (t < bestT) {
          bestT = t;
          bestPt = { x: origin.x + ux * t, y: origin.y + uy * t };
        }
      }
    }
    return bestPt;
  }

  // 计算两条线段的交点参数 (t, u) in [0, 1]
  function segmentIntersection(a1, a2, b1, b2) {
    const rX = a2.x - a1.x;
    const rY = a2.y - a1.y;
    const sX = b2.x - b1.x;
    const sY = b2.y - b1.y;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-8) return null;
    const qpX = b1.x - a1.x;
    const qpY = b1.y - a1.y;
    const t = (qpX * sY - qpY * sX) / denom;
    const u = (qpX * rY - qpY * rX) / denom;
    const eps = 1e-5;
    if (t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps) {
      return {
        t: Math.max(0, Math.min(1, t)),
        u: Math.max(0, Math.min(1, u)),
        x: a1.x + Math.max(0, Math.min(1, t)) * rX,
        y: a1.y + Math.max(0, Math.min(1, t)) * rY
      };
    }
    return null;
  }

  // 点是否在多边形边线上
  function pointNearRingBoundary(pt, ring, tol = 2.0) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (distToSegment(pt, a, b).dist <= tol) return true;
    }
    return false;
  }

  // 主求解器：给定外轮廓多边形 + cuts 列表，计算平面分镜格 + 待交汇悬空刀口
  function solvePlanarSubdivision(outerPoly, cuts, W, H, prevCells = []) {
    const rawSegments = [];

    // 1. 加入外轮廓边
    for (let i = 0; i < outerPoly.length; i++) {
      const a = outerPoly[i];
      const b = outerPoly[(i + 1) % outerPoly.length];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 0.05) {
        rawSegments.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, isOuter: true, cutId: null });
      }
    }

    // 2. 逐条处理切割刀口 (支持端点吸附 & 自动延伸切透)
    const sampledCutPolylines = [];
    const snapRadius = Math.max(6, Math.min(W, H) * 0.012);

    for (const cut of cuts) {
      let polyPts = sampleCutPointsPx(cut, W, H);
      if (polyPts.length < 2) continue;

      if (!cut.closed) {
        // 检查起点和终点是否靠近现有边或需要自动延伸
        const startPt = polyPts[0];
        const endPt = polyPts[polyPts.length - 1];

        // 起点吸附或反向延伸
        const snapStart = findSnapTarget(startPt, rawSegments, snapRadius);
        if (snapStart) {
          polyPts[0] = snapStart;
        } else if (cut.autoExtend && pointInRing(startPt, outerPoly)) {
          const dirX = polyPts[0].x - polyPts[1].x;
          const dirY = polyPts[0].y - polyPts[1].y;
          const hit = raycastNearestSegment(polyPts[0], dirX, dirY, rawSegments, 0.1);
          if (hit) polyPts = [hit, ...polyPts];
        }

        // 终点吸附或正向延伸
        const lastIdx = polyPts.length - 1;
        const snapEnd = findSnapTarget(polyPts[lastIdx], rawSegments, snapRadius);
        if (snapEnd) {
          polyPts[lastIdx] = snapEnd;
        } else if (cut.autoExtend && pointInRing(polyPts[lastIdx], outerPoly)) {
          const dirX = polyPts[lastIdx].x - polyPts[lastIdx - 1].x;
          const dirY = polyPts[lastIdx].y - polyPts[lastIdx - 1].y;
          const hit = raycastNearestSegment(polyPts[lastIdx], dirX, dirY, rawSegments, 0.1);
          if (hit) polyPts = [...polyPts, hit];
        }
      }

      sampledCutPolylines.push({ cutId: cut.id, pts: polyPts, closed: !!cut.closed });
      for (let i = 0; i < polyPts.length - 1; i++) {
        const a = polyPts[i];
        const b = polyPts[i + 1];
        if (Math.hypot(b.x - a.x, b.y - a.y) > 0.05) {
          rawSegments.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, isOuter: false, cutId: cut.id });
        }
      }
    }

    // 3. 计算全部线段两两交点并打断细分
    const splitParams = rawSegments.map(() => [0, 1]);
    for (let i = 0; i < rawSegments.length; i++) {
      const s1 = rawSegments[i];
      for (let j = i + 1; j < rawSegments.length; j++) {
        const s2 = rawSegments[j];
        // AABB 快速排斥
        if (
          Math.max(s1.a.x, s1.b.x) + 1 < Math.min(s2.a.x, s2.b.x) ||
          Math.max(s2.a.x, s2.b.x) + 1 < Math.min(s1.a.x, s1.b.x) ||
          Math.max(s1.a.y, s1.b.y) + 1 < Math.min(s2.a.y, s2.b.y) ||
          Math.max(s2.a.y, s2.b.y) + 1 < Math.min(s1.a.y, s1.b.y)
        ) continue;

        const inter = segmentIntersection(s1.a, s1.b, s2.a, s2.b);
        if (inter) {
          splitParams[i].push(inter.t);
          splitParams[j].push(inter.u);
        }
      }
    }

    // 4. 顶点焊接与无向边去重 (并剔除落在外轮廓外部的刀口子段)
    const WELD_EPS = 0.75;
    const vertices = [];
    function getOrCreateVertex(x, y) {
      for (let i = 0; i < vertices.length; i++) {
        if (Math.abs(vertices[i].x - x) <= WELD_EPS && Math.abs(vertices[i].y - y) <= WELD_EPS) {
          return i;
        }
      }
      const id = vertices.length;
      vertices.push({ id, x, y });
      return id;
    }

    const edgeMap = new Map();
    const edges = [];

    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      const ts = splitParams[i].slice().sort((a, b) => a - b);
      for (let k = 0; k < ts.length - 1; k++) {
        const t0 = ts[k];
        const t1 = ts[k + 1];
        if (t1 - t0 < 1e-5) continue;
        const p0 = { x: seg.a.x + (seg.b.x - seg.a.x) * t0, y: seg.a.y + (seg.b.y - seg.a.y) * t0 };
        const p1 = { x: seg.a.x + (seg.b.x - seg.a.x) * t1, y: seg.a.y + (seg.b.y - seg.a.y) * t1 };
        if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.3) continue;

        if (!seg.isOuter) {
          const mid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
          if (!pointInRing(mid, outerPoly) && !pointNearRingBoundary(mid, outerPoly, 2.0)) {
            continue;
          }
        }

        const u = getOrCreateVertex(p0.x, p0.y);
        const v = getOrCreateVertex(p1.x, p1.y);
        if (u === v) continue;

        const key = u < v ? `${u}_${v}` : `${v}_${u}`;
        if (edgeMap.has(key)) {
          const existing = edgeMap.get(key);
          if (seg.isOuter) existing.isOuter = true;
          if (seg.cutId) existing.cutIds.add(seg.cutId);
        } else {
          const eObj = {
            id: edges.length,
            u,
            v,
            isOuter: seg.isOuter,
            cutIds: new Set(seg.cutId ? [seg.cutId] : []),
            active: true
          };
          edgeMap.set(key, eObj);
          edges.push(eObj);
        }
      }
    }

    // 5. 剥离度数为 1 的悬空未贯通刀口 (Pending Dangling Cuts)
    const adj = Array.from({ length: vertices.length }, () => new Set());
    for (const e of edges) {
      adj[e.u].add(e.id);
      adj[e.v].add(e.id);
    }

    const queue = [];
    for (let v = 0; v < vertices.length; v++) {
      if (adj[v].size === 1) queue.push(v);
    }

    const danglingEdges = [];
    while (queue.length > 0) {
      const v = queue.pop();
      if (adj[v].size !== 1) continue;
      const [edgeId] = adj[v];
      const e = edges[edgeId];
      if (!e.active || e.isOuter) continue;
      e.active = false;
      danglingEdges.push({
        a: vertices[e.u],
        b: vertices[e.v],
        cutIds: Array.from(e.cutIds)
      });
      adj[e.u].delete(edgeId);
      adj[e.v].delete(edgeId);
      const other = e.u === v ? e.v : e.u;
      if (adj[other].size === 1) queue.push(other);
    }

    const activeEdges = edges.filter(e => e.active);
    const activeInternalSegments = activeEdges
      .filter(e => !e.isOuter)
      .map(e => ({ a: vertices[e.u], b: vertices[e.v], cutIds: Array.from(e.cutIds) }));

    // 6. 连通分量分析 + 半边(Half-Edge)平面面片提取
    const vComp = new Int32Array(vertices.length).fill(-1);
    let compCount = 0;
    for (let startV = 0; startV < vertices.length; startV++) {
      if (adj[startV].size === 0 || vComp[startV] !== -1) continue;
      const cid = compCount++;
      const bfs = [startV];
      vComp[startV] = cid;
      while (bfs.length > 0) {
        const cur = bfs.pop();
        for (const eid of adj[cur]) {
          const e = edges[eid];
          if (!e.active) continue;
          const nxt = e.u === cur ? e.v : e.u;
          if (vComp[nxt] === -1) {
            vComp[nxt] = cid;
            bfs.push(nxt);
          }
        }
      }
    }

    const halfEdges = [];
    const outHalfEdges = Array.from({ length: vertices.length }, () => []);

    for (const e of activeEdges) {
      const h0 = {
        id: halfEdges.length,
        from: e.u,
        to: e.v,
        twin: halfEdges.length + 1,
        edge: e,
        angle: Math.atan2(vertices[e.v].y - vertices[e.u].y, vertices[e.v].x - vertices[e.u].x),
        visited: false
      };
      const h1 = {
        id: halfEdges.length + 1,
        from: e.v,
        to: e.u,
        twin: halfEdges.length,
        edge: e,
        angle: Math.atan2(vertices[e.u].y - vertices[e.v].y, vertices[e.u].x - vertices[e.v].x),
        visited: false
      };
      halfEdges.push(h0, h1);
      outHalfEdges[e.u].push(h0);
      outHalfEdges[e.v].push(h1);
    }

    for (let v = 0; v < vertices.length; v++) {
      outHalfEdges[v].sort((a, b) => a.angle - b.angle);
      const list = outHalfEdges[v];
      for (let i = 0; i < list.length; i++) {
        list[i].orderIdx = i;
      }
    }

    const positiveFaces = [];
    const negativeEnvelopes = []; // 内部闭合挖洞组件的外包络

    for (const hStart of halfEdges) {
      if (hStart.visited) continue;
      const cycleVerts = [];
      let cur = hStart;
      let guard = 0;
      while (!cur.visited && guard < halfEdges.length + 5) {
        cur.visited = true;
        cycleVerts.push(vertices[cur.from]);
        const twin = halfEdges[cur.twin];
        const list = outHalfEdges[cur.to];
        const nextIdx = (twin.orderIdx - 1 + list.length) % list.length;
        cur = list[nextIdx];
        guard++;
      }
      if (cycleVerts.length < 3) continue;
      const area = signedArea(cycleVerts);
      const compId = vComp[hStart.from];
      if (area > 25) {
        positiveFaces.push({
          outer: cycleVerts,
          holes: [],
          area,
          compId,
          bounds: polyBounds(cycleVerts),
          centroid: polyCentroid(cycleVerts)
        });
      } else if (area < -25) {
        negativeEnvelopes.push({
          ring: cycleVerts, // CCW 环，用于 evenodd 挖洞
          absArea: Math.abs(area),
          compId,
          samplePt: cycleVerts[0]
        });
      }
    }

    // 找出外轮廓所属的主分量 (面积最大的负包络即最外围无限面)
    let rootCompId = 0;
    let maxEnvArea = -1;
    for (const env of negativeEnvelopes) {
      if (env.absArea > maxEnvArea) {
        maxEnvArea = env.absArea;
        rootCompId = env.compId;
      }
    }

    // 将内部独立闭合组件的负包络，挂接到包裹它的最小母面片的 holes[] 中（实现画中画挖洞成格！）
    for (const env of negativeEnvelopes) {
      if (env.compId === rootCompId) continue;
      let bestParent = null;
      for (const face of positiveFaces) {
        if (face.compId === env.compId) continue;
        if (face.area <= env.absArea) continue;
        if (pointInRing(env.samplePt, face.outer)) {
          if (!bestParent || face.area < bestParent.area) {
            bestParent = face;
          }
        }
      }
      if (bestParent) {
        bestParent.holes.push(env.ring);
      }
    }

    // 按视觉阅读顺序 (从上到下、从左到右) 排序面片，并继承旧格子的图片与构图
    positiveFaces.sort((a, b) => {
      const rowDiff = a.centroid.y - b.centroid.y;
      if (Math.abs(rowDiff) > H * 0.08) return rowDiff;
      return a.centroid.x - b.centroid.x;
    });

    const usedPrevIds = new Set();
    const cells = positiveFaces.map((face, idx) => {
      // 找到一个确保落在面片内部（且避开孔洞）的代表点
      const repPt = findInteriorPoint(face);
      let matchedPrev = null;

      // 优先匹配包含新代表点的旧格子
      for (const prev of prevCells) {
        if (usedPrevIds.has(prev.id)) continue;
        if (pointInCell(repPt, prev)) {
          matchedPrev = prev;
          break;
        }
      }
      // 次选：旧格子代表点落在新面片内 (如删除分割线合并两格时继承主格图片)
      if (!matchedPrev) {
        for (const prev of prevCells) {
          if (usedPrevIds.has(prev.id)) continue;
          if (prev.repPt && pointInCell(prev.repPt, face)) {
            matchedPrev = prev;
            break;
          }
        }
      }

      if (matchedPrev) usedPrevIds.add(matchedPrev.id);

      return {
        id: matchedPrev ? matchedPrev.id : `cell_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        outer: face.outer,
        holes: face.holes,
        area: face.area,
        bounds: face.bounds,
        centroid: face.centroid,
        repPt,
        slotLabel: matchedPrev ? (matchedPrev.slotLabel || '') : '',
        slotOrder: matchedPrev ? matchedPrev.slotOrder : null,
        visible: matchedPrev ? (matchedPrev.visible !== false) : true,
        assetId: matchedPrev ? matchedPrev.assetId : null,
        fx: matchedPrev && matchedPrev.fx
          ? { ...matchedPrev.fx }
          : { blurPad: false, blurAmount: 26, colorFilter: 'none', mangaLines: 'none', popOut: false },
        transform: matchedPrev && matchedPrev.transform
          ? { ...matchedPrev.transform }
          : createDefaultImageTransform()
      };
    });

    return {
      cells,
      activeInternalSegments,
      danglingEdges,
      sampledCutPolylines
    };
  }

  function findSnapTarget(pt, segments, radius) {
    let bestDist = radius;
    let bestPt = null;
    // 优先吸附已有端点 (方便 T 型 / Y 型精准咬合)
    for (const seg of segments) {
      const da = Math.hypot(pt.x - seg.a.x, pt.y - seg.a.y);
      if (da <= bestDist * 1.25) {
        bestDist = da / 1.25;
        bestPt = { x: seg.a.x, y: seg.a.y };
      }
      const db = Math.hypot(pt.x - seg.b.x, pt.y - seg.b.y);
      if (db <= bestDist * 1.25) {
        bestDist = db / 1.25;
        bestPt = { x: seg.b.x, y: seg.b.y };
      }
    }
    if (bestPt) return bestPt;

    for (const seg of segments) {
      const res = distToSegment(pt, seg.a, seg.b);
      if (res.dist <= bestDist) {
        bestDist = res.dist;
        bestPt = res.proj;
      }
    }
    return bestPt;
  }

  function findInteriorPoint(face) {
    if (pointInCell(face.centroid, face)) return face.centroid;
    const b = face.bounds;
    // 网格采样寻找严格位于面片内部且不在孔洞内的点
    const steps = 8;
    for (let r = 1; r < steps; r++) {
      for (let c = 1; c < steps; c++) {
        const pt = { x: b.minX + (b.w * c) / steps, y: b.minY + (b.h * r) / steps };
        if (pointInCell(pt, face)) return pt;
      }
    }
    // 兜底：取第一条边中点微向内偏置
    const a = face.outer[0];
    const bPt = face.outer[1];
    const ux = bPt.x - a.x;
    const uy = bPt.y - a.y;
    const len = Math.hypot(ux, uy) || 1;
    return { x: (a.x + bPt.x) * 0.5 - (uy / len) * 2, y: (a.y + bPt.y) * 0.5 + (ux / len) * 2 };
  }

  function createDefaultImageTransform() {
    return {
      scale: 1,       // 相对于 Cover 铺满格子的倍率 (1 = 刚好铺满 Cover)
      panX: 0,        // 归一化偏移 (相对于格子宽)
      panY: 0,        // 归一化偏移 (相对于格子高)
      rotation: 0,    // 角度制总旋转 = baseRot90 + fineAngle
      rot90: 0,       // 0, 90, 180, 270
      fineAngle: 0,   // -45 ~ +45
      flipX: false,
      flipY: false,
      crop: null      // null 或 { x: 0..1, y: 0..1, w: 0..1, h: 0..1 } 原图预裁剪框
    };
  }

  global.PlanarSlicer = {
    signedArea,
    polyBounds,
    polyCentroid,
    pointInRing,
    pointInCell,
    distToSegment,
    sampleCutPointsPx,
    raycastNearestSegment,
    solvePlanarSubdivision,
    createDefaultImageTransform
  };
})(window);
