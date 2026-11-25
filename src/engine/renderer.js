(function (global) {
  // =========================================================================
  // CollageRenderer v2: 无限画布视口 + 唯一总外框合成渲染引擎
  // - 编辑器视口：全屏无限点阵画布 + 相机平移缩放 (camX, camY, camZoom)
  // - 无限空间自由绘制：可在任意世界坐标绘制新总外框，框外透视原图不受边界裁切
  // - 成品导出：100% 严格只渲染并导出唯一总外框 (frameWorld) 内部的画面
  // =========================================================================

  const frameCanvas = document.createElement('canvas');
  const scratchA = document.createElement('canvas');
  const scratchB = document.createElement('canvas');
  const scratchCellContent = document.createElement('canvas');
  const scratchGhost = document.createElement('canvas');
  const scratchLoupeSrc = document.createElement('canvas');
  let grainTileCanvas = null;

  function getGrainTileCanvas() {
    if (grainTileCanvas) return grainTileCanvas;
    grainTileCanvas = document.createElement('canvas');
    grainTileCanvas.width = 128;
    grainTileCanvas.height = 128;
    const gctx = grainTileCanvas.getContext('2d');
    if (gctx && gctx.createImageData) {
      const imgData = gctx.createImageData(128, 128);
      const d = imgData.data;
      let seed = 1337;
      for (let i = 0; i < d.length; i += 4) {
        seed = (seed * 16807) % 2147483647;
        const v = (seed & 255);
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      gctx.putImageData(imgData, 0, 0);
    }
    return grainTileCanvas;
  }

  function ensureCanvasSize(cvs, w, h) {
    if (cvs.width !== w || cvs.height !== h) {
      cvs.width = w;
      cvs.height = h;
    }
  }

  function buildPath2DFromRings(outer, holes = [], scale = 1, offsetX = 0, offsetY = 0) {
    const path = new Path2D();
    if (outer && outer.length >= 3) {
      path.moveTo(offsetX + outer[0].x * scale, offsetY + outer[0].y * scale);
      for (let i = 1; i < outer.length; i++) {
        path.lineTo(offsetX + outer[i].x * scale, offsetY + outer[i].y * scale);
      }
      path.closePath();
    }
    if (holes && holes.length) {
      for (const h of holes) {
        if (h.length < 3) continue;
        path.moveTo(offsetX + h[0].x * scale, offsetY + h[0].y * scale);
        for (let i = 1; i < h.length; i++) {
          path.lineTo(offsetX + h[i].x * scale, offsetY + h[i].y * scale);
        }
        path.closePath();
      }
    }
    return path;
  }

  function computeImageDrawParams(asset, transform, boxX, boxY, boxW, boxH, exportScaleFactor = 1) {
    if (!asset || !asset.img) return null;
    const img = asset.img;
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return null;

    const tf = transform || global.PlanarSlicer.createDefaultImageTransform();
    const crop = tf.crop || { x: 0, y: 0, w: 1, h: 1 };
    const sx = crop.x * natW;
    const sy = crop.y * natH;
    const sw = Math.max(1, crop.w * natW);
    const sh = Math.max(1, crop.h * natH);

    const rot90 = ((tf.rot90 || 0) % 360 + 360) % 360;
    const fineAngle = tf.fineAngle || 0;
    const totalDeg = rot90 + fineAngle;
    const totalRad = (totalDeg * Math.PI) / 180;

    const swapped = rot90 === 90 || rot90 === 270;
    const effSrcW = swapped ? sh : sw;
    const effSrcH = swapped ? sw : sh;

    const isContain = tf.fitMode === 'contain';
    const baseScale = isContain
      ? Math.min(boxW / effSrcW, boxH / effSrcH) * 0.94
      : Math.max(boxW / effSrcW, boxH / effSrcH);
    const userScale = Math.max(0.15, tf.scale || 1);
    const finalScale = baseScale * userScale;

    const drawW = sw * finalScale;
    const drawH = sh * finalScale;
    const centerX = boxX + boxW * 0.5 + (tf.panX || 0) * boxW;
    const centerY = boxY + boxH * 0.5 + (tf.panY || 0) * boxH;

    const exportDrawW = drawW / exportScaleFactor;
    const effectivePixelRatio = exportDrawW / sw;

    return {
      img,
      sx, sy, sw, sh,
      drawW, drawH,
      centerX, centerY,
      totalRad,
      flipX: !!tf.flipX,
      flipY: !!tf.flipY,
      effectivePixelRatio
    };
  }

  function getFilterCssString(filterName) {
    switch (filterName) {
      case 'bw': return 'grayscale(100%) contrast(122%)';
      case 'vivid': return 'saturate(142%) contrast(110%)';
      case 'cold': return 'saturate(34%) contrast(108%) brightness(103%)';
      case 'invert': return 'invert(100%) contrast(115%)';
      case 'sepia': return 'sepia(78%) contrast(108%)';
      default: return 'none';
    }
  }

  function computeCellImageParams(cell, cellIdx, asset, rw, rh, renderScale, state) {
    if (!asset) return null;
    const tf = cell.transform || global.PlanarSlicer.createDefaultImageTransform();
    const b = cell.bounds;

    // 若开启「同图全场对齐铺满 (globalSpan)」，以整张外框 (0,0,rw,rh) 为基准计算坐标，实现碎裂镜面无缝贯穿！
    let boxX = b.minX * renderScale;
    let boxY = b.minY * renderScale;
    let boxW = Math.max(1, b.w * renderScale);
    let boxH = Math.max(1, b.h * renderScale);

    if (tf.globalSpan) {
      boxX = 0;
      boxY = 0;
      boxW = rw;
      boxH = rh;
    }

    const params = computeImageDrawParams(asset, tf, boxX, boxY, boxW, boxH, renderScale);
    if (!params) return null;

    // 玻璃微错位折射偏移 (refractStrength)
    const refract = ((state && state.style && state.style.refractStrength) || 0) * renderScale;
    if (refract > 0.2) {
      const seedA = Math.sin((cellIdx + 1) * 12.9898 + b.cx * 0.02) * 43758.5453;
      const seedB = Math.cos((cellIdx + 1) * 78.233 + b.cy * 0.02) * 24634.6345;
      const rx = ((seedA - Math.floor(seedA)) - 0.5) * 2 * refract;
      const ry = ((seedB - Math.floor(seedB)) - 0.5) * 2 * refract;
      params.centerX += rx;
      params.centerY += ry;
    }
    return params;
  }

  function resolveMangaLineColor(fx, state) {
    const mode = fx.mangaColorMode || 'auto';
    if (mode === 'white') return '#ffffff';
    if (mode === 'ink') return '#0f172a';
    if (mode === 'theme') return (state && state.oshiPrimary) || '#6366f1';
    if (mode === 'custom' && fx.mangaCustomColor) return fx.mangaCustomColor;
    if (fx.colorFilter === 'invert' || fx.mangaLines === 'rain' || fx.mangaLines === 'sparkle') {
      return '#ffffff';
    }
    return '#0f172a';
  }

  function drawCellVisualContent(targetCtx, cell, asset, drawParams, boxX, boxY, boxW, boxH, renderScale, state) {
    const fx = cell.fx || {};
    const filterCss = getFilterCssString(fx.colorFilter);

    targetCtx.save();
    targetCtx.globalCompositeOperation = 'source-over';
    if (filterCss !== 'none') {
      targetCtx.filter = filterCss;
    }

    // 完整全图 · 磨砂补边：底层铺满高斯虚化同图背景，前景居中完整呈现原图并附立体悬浮投影
    if (fx.blurPad && asset && asset.img) {
      const blurPx = Math.max(4, (fx.blurAmount ?? 28) * renderScale);
      const brightPct = fx.blurBrightness ?? 82;
      const bgTf = {
        ...(cell.transform || {}),
        fitMode: 'cover',
        scale: 1.38,
        panX: 0,
        panY: 0,
        crop: null
      };
      const bgParams = computeImageDrawParams(asset, bgTf, boxX, boxY, boxW, boxH, renderScale);
      if (bgParams) {
        targetCtx.save();
        targetCtx.filter = `${filterCss !== 'none' ? filterCss + ' ' : ''}blur(${blurPx}px) brightness(${brightPct}%) saturate(112%)`;
        drawTransformedImage(targetCtx, bgParams, 1);
        targetCtx.restore();
      }
      // 前景完整原图叠加柔和投影与清透细描边，与磨砂垫底拉开层次感
      targetCtx.save();
      targetCtx.shadowColor = 'rgba(0, 0, 0, 0.42)';
      targetCtx.shadowBlur = 18 * renderScale;
      targetCtx.shadowOffsetY = 3 * renderScale;
      drawTransformedImage(targetCtx, drawParams, 1);
      targetCtx.restore();

      targetCtx.save();
      targetCtx.filter = 'none';
      targetCtx.translate(drawParams.centerX, drawParams.centerY);
      targetCtx.rotate(drawParams.totalRad);
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      targetCtx.lineWidth = Math.max(1, 1.2 * renderScale);
      targetCtx.strokeRect(-drawParams.drawW * 0.5, -drawParams.drawH * 0.5, drawParams.drawW, drawParams.drawH);
      targetCtx.restore();
    } else {
      drawTransformedImage(targetCtx, drawParams, 1);
    }

    targetCtx.restore();

    // 叠加单格漫画/情绪线条（独立 source-over 绘制，绝不擦除原图！）
    if (fx.mangaLines && fx.mangaLines !== 'none' && global.FxLabEngine) {
      global.FxLabEngine.drawCellMangaLines(
        targetCtx,
        boxX, boxY, boxW, boxH,
        fx.mangaLines,
        renderScale,
        {
          color: resolveMangaLineColor(fx, state),
          opacity: fx.mangaOpacity ?? 0.78,
          focusX: fx.mangaFocusX ?? 0.5,
          focusY: fx.mangaFocusY ?? 0.38,
          safeRadius: fx.mangaSafeR ?? 0.34
        }
      );
    }
  }

  function drawTransformedImage(ctx, params, alpha = 1) {
    if (!params) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(params.centerX, params.centerY);
    ctx.rotate(params.totalRad);
    ctx.scale(params.flipX ? -1 : 1, params.flipY ? -1 : 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      params.img,
      params.sx, params.sy, params.sw, params.sh,
      -params.drawW * 0.5, -params.drawH * 0.5, params.drawW, params.drawH
    );
    ctx.restore();
  }

  function fillCheckerboardPath(ctx, path, w, h, theme = 'dark') {
    ctx.save();
    ctx.clip(path);
    const size = 16;
    const c1 = theme === 'light' ? '#e4e8f1' : '#1b1f2a';
    const c2 = theme === 'light' ? '#f5f7fc' : '#242938';
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = c2;
    for (let y = 0; y < h; y += size) {
      for (let x = ((y / size) % 2 === 0 ? 0 : size); x < w; x += size * 2) {
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.restore();
  }

  // 渲染唯一总外框内部的完整内容到目标画布 (供导出直接调用，也供无限画布合成调用)
  function renderOuterFrameBuffer(targetCanvas, state, options = {}) {
    const isExport = !!options.isExport;
    const renderScale = options.renderScale || 1;
    const exportFormat = options.exportFormat || 'png';
    const theme = state.theme || 'dark';

    const W = state.canvasW;
    const H = state.canvasH;
    const rw = Math.max(1, Math.round(W * renderScale));
    const rh = Math.max(1, Math.round(H * renderScale));

    ensureCanvasSize(targetCanvas, rw, rh);
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, rw, rh);

    const outerPolyBase = state.topology.outerPoly;
    const outerPath = buildPath2DFromRings(outerPolyBase, [], renderScale);

    if (!isExport && state.style.bgMode === 'transparent') {
      // 仅在唯一总外框轮廓内部填充透明棋盘格！外框外部保持干净无限画布！
      fillCheckerboardPath(ctx, outerPath, rw, rh, theme);
    } else if (isExport && exportFormat === 'jpeg') {
      ctx.fillStyle = state.style.bgColor1 || '#ffffff';
      ctx.fillRect(0, 0, rw, rh);
    }

    const internalCutPath = new Path2D();
    for (const seg of state.topology.activeInternalSegments) {
      internalCutPath.moveTo(seg.a.x * renderScale, seg.a.y * renderScale);
      internalCutPath.lineTo(seg.b.x * renderScale, seg.b.y * renderScale);
    }

    const gutterPx = (state.style.gutter || 0) * renderScale;
    const marginPx = (state.style.margin || 0) * renderScale;
    const borderPx = (state.style.cellBorder || 0) * renderScale;
    const outerStrokePx = (state.style.outerStroke || 0) * renderScale;

    let selectedDpiWarning = null;

    // 严格裁剪在唯一总外框内部！任何超出外框的自由相框或文字在保存时都只保留外框内的部分！
    ctx.save();
    ctx.clip(outerPath);

    if (state.style.bgMode === 'solid') {
      ctx.fillStyle = state.style.bgColor1 || '#ffffff';
      ctx.fillRect(0, 0, rw, rh);
    } else if (state.style.bgMode === 'gradient') {
      const ang = ((state.style.gradAngle || 135) * Math.PI) / 180;
      const cx = rw / 2, cy = rh / 2;
      const r = Math.hypot(rw, rh) / 2;
      const grad = ctx.createLinearGradient(
        cx - Math.cos(ang) * r, cy - Math.sin(ang) * r,
        cx + Math.cos(ang) * r, cy + Math.sin(ang) * r
      );
      grad.addColorStop(0, state.style.bgColor1 || '#ffffff');
      grad.addColorStop(1, state.style.bgColor2 || '#dbeafe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, rw, rh);
    }

    // 渲染拓扑分镜格 (支持经典漫框、真·凹凸拼图卡扣边+单块抽离悬浮、手撕纸毛边、复古胶卷框)
    const edgeStyle = state.style.edgeStyle || 'classic'; // 'classic' | 'jigsaw' | 'torn' | 'film'
    if (!state.hideBaseCells) {
      const effGutterPx = edgeStyle === 'torn' ? 0 : gutterPx;
      const effMarginPx = edgeStyle === 'film' ? Math.max(marginPx, 30 * renderScale) : marginPx;
      const fastZeroInset = edgeStyle !== 'jigsaw' && effGutterPx < 0.2 && effMarginPx < 0.2 && borderPx < 0.2;

      if (!fastZeroInset) {
        ensureCanvasSize(scratchA, rw, rh);
        ensureCanvasSize(scratchB, rw, rh);
        ensureCanvasSize(scratchCellContent, rw, rh);
      }

      const cells = state.topology.cells;
      const popOutQueue = [];

      for (let idx = 0; idx < cells.length; idx++) {
        const cell = cells[idx];
        if (cell.visible === false) continue;
        const asset = cell.assetId ? state.assetMap.get(cell.assetId) : null;
        const b = cell.bounds;
        const boxX = b.minX * renderScale;
        const boxY = b.minY * renderScale;
        const boxW = Math.max(1, b.w * renderScale);
        const boxH = Math.max(1, b.h * renderScale);

        const drawParams = computeCellImageParams(cell, idx, asset, rw, rh, renderScale, state);

        if (drawParams && state.selection && state.selection.type === 'cell' && state.selection.id === cell.id) {
          if (drawParams.effectivePixelRatio > 1.15) {
            selectedDpiWarning = { pct: Math.round(drawParams.effectivePixelRatio * 100), assetName: asset.name };
          }
        }

        const isJigsaw = edgeStyle === 'jigsaw' && global.FxLabEngine;
        const cellPath = isJigsaw
          ? global.FxLabEngine.buildJigsawCellPath2D(cell, outerPolyBase, renderScale)
          : buildPath2DFromRings(cell.outer, cell.holes, renderScale);

        // 若该格开启了「单块拼图微抽离悬浮 (popOut)」，先在原位画一个深色凹陷槽，把本体留到顶层带立体阴影绘制！
        if (cell.fx && cell.fx.popOut) {
          ctx.save();
          ctx.fillStyle = 'rgba(9, 11, 17, 0.55)';
          ctx.fill(cellPath, 'evenodd');
          ctx.restore();
          popOutQueue.push({ cell, idx, asset, drawParams, boxX, boxY, boxW, boxH, cellPath });
          continue;
        }

        if (isJigsaw) {
          ctx.save();
          ctx.clip(cellPath, 'evenodd');
          if (drawParams) {
            drawCellVisualContent(ctx, cell, asset, drawParams, boxX, boxY, boxW, boxH, renderScale, state);
          } else if (!isExport) {
            drawEmptyCellPlaceholder(ctx, cell, renderScale, state);
          }
          ctx.restore();

          // 拼图块咬合缝与立体倒角边线
          ctx.save();
          ctx.strokeStyle = state.style.cellBorderColor || '#ffffff';
          ctx.lineWidth = Math.max(1.5 * renderScale, borderPx || 2.5 * renderScale);
          ctx.lineJoin = 'round';
          ctx.stroke(cellPath);
          ctx.restore();
        } else if (fastZeroInset) {
          ctx.save();
          ctx.clip(cellPath, 'evenodd');
          if (drawParams) {
            drawCellVisualContent(ctx, cell, asset, drawParams, boxX, boxY, boxW, boxH, renderScale, state);
          } else if (!isExport) {
            drawEmptyCellPlaceholder(ctx, cell, renderScale, state);
          }
          ctx.restore();
        } else {
          if (borderPx >= 0.3) {
            const ctxA = scratchA.getContext('2d');
            ctxA.globalCompositeOperation = 'source-over';
            ctxA.clearRect(0, 0, rw, rh);
            ctxA.fillStyle = state.style.cellBorderColor || '#111827';
            ctxA.fill(cellPath, 'evenodd');

            ctxA.globalCompositeOperation = 'destination-out';
            ctxA.lineJoin = 'round';
            ctxA.lineCap = 'round';
            if (effGutterPx > 0.1) {
              ctxA.lineWidth = effGutterPx;
              ctxA.stroke(internalCutPath);
            }
            if (effMarginPx > 0.1) {
              ctxA.lineWidth = effMarginPx * 2;
              ctxA.stroke(outerPath);
            }
            ctx.drawImage(scratchA, 0, 0);
          }

          // 步骤 1：在 scratchB 上构造分镜内缩轮廓蒙版
          const ctxB = scratchB.getContext('2d');
          ctxB.globalCompositeOperation = 'source-over';
          ctxB.clearRect(0, 0, rw, rh);
          ctxB.fillStyle = '#000000';
          ctxB.fill(cellPath, 'evenodd');

          ctxB.globalCompositeOperation = 'destination-out';
          ctxB.lineJoin = 'round';
          ctxB.lineCap = 'round';
          const innerCutErase = effGutterPx + borderPx * 2;
          const innerOuterErase = (effMarginPx + borderPx) * 2;
          if (innerCutErase > 0.1) {
            ctxB.lineWidth = innerCutErase;
            ctxB.stroke(internalCutPath);
          }
          if (innerOuterErase > 0.1) {
            ctxB.lineWidth = innerOuterErase;
            ctxB.stroke(outerPath);
          }

          // 步骤 2：在独立图层 scratchCellContent 上以正常 source-over 完整绘制「磨砂补边 + 前景原图 + 漫画/情绪线条」
          // 最后统一用 destination-in 按分镜轮廓裁切一次，彻底杜绝多层绘制互相擦除！
          const ctxContent = scratchCellContent.getContext('2d');
          ctxContent.globalCompositeOperation = 'source-over';
          ctxContent.clearRect(0, 0, rw, rh);
          if (drawParams) {
            drawCellVisualContent(ctxContent, cell, asset, drawParams, boxX, boxY, boxW, boxH, renderScale, state);
            ctxContent.globalCompositeOperation = 'destination-in';
            ctxContent.drawImage(scratchB, 0, 0);
            ctxContent.globalCompositeOperation = 'source-over';
            ctx.drawImage(scratchCellContent, 0, 0);
          } else if (!isExport) {
            drawEmptyCellPlaceholder(ctxContent, cell, renderScale, state);
            ctxContent.globalCompositeOperation = 'destination-in';
            ctxContent.drawImage(scratchB, 0, 0);
            ctxContent.globalCompositeOperation = 'source-over';
            ctx.drawImage(scratchCellContent, 0, 0);
          }
        }

        if (!isExport && (state.showSlotLabels || !asset)) {
          drawCellSlotBadge(ctx, cell, idx, !!asset, renderScale);
        }
      }

      // 特殊分割边叠加材质：手撕画纸白毛边 / 复古电影胶卷齿孔框
      if (edgeStyle === 'torn' && global.FxLabEngine) {
        global.FxLabEngine.drawTornPaperEdges(ctx, state.topology.activeInternalSegments, renderScale, Math.max(14 * renderScale, gutterPx));
      } else if (edgeStyle === 'film' && global.FxLabEngine) {
        global.FxLabEngine.drawFilmStripOverlay(ctx, rw, rh, renderScale);
      }

      // 顶层绘制开启了「微抽离悬浮」的立体拼图块！
      for (const pop of popOutQueue) {
        const { cell, idx, asset, drawParams, boxX, boxY, boxW, boxH, cellPath } = pop;
        const cx = cell.bounds.cx * renderScale;
        const cy = cell.bounds.cy * renderScale;

        ctx.save();
        ctx.translate(cx + 10 * renderScale, cy - 12 * renderScale);
        ctx.rotate((3.5 * Math.PI) / 180);
        ctx.translate(-cx, -cy);

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
        ctx.shadowBlur = 24 * renderScale;
        ctx.shadowOffsetX = 6 * renderScale;
        ctx.shadowOffsetY = 12 * renderScale;
        ctx.fillStyle = state.style.cellBorderColor || '#ffffff';
        ctx.fill(cellPath, 'evenodd');
        ctx.restore();

        ctx.save();
        ctx.clip(cellPath, 'evenodd');
        if (drawParams) {
          drawCellVisualContent(ctx, cell, asset, drawParams, boxX, boxY, boxW, boxH, renderScale, state);
        } else if (!isExport) {
          drawEmptyCellPlaceholder(ctx, cell, renderScale, state);
        }
        ctx.restore();

        ctx.strokeStyle = state.style.cellBorderColor || '#ffffff';
        ctx.lineWidth = Math.max(2 * renderScale, borderPx || 3 * renderScale);
        ctx.lineJoin = 'round';
        ctx.stroke(cellPath);
        ctx.restore();

        if (!isExport && (state.showSlotLabels || !asset)) {
          drawCellSlotBadge(ctx, cell, idx, !!asset, renderScale);
        }
      }
    }

    // 若当前唯一总外框为「人物剪影容器」且开启了双重曝光线稿/柔光或局部原貌保留，在分镜之上精准对齐合成原人物融合层！
    if (
      state.contour &&
      state.contour.type === 'custom' &&
      state.contour.silhouetteMeta &&
      global.SilhouetteExtractor &&
      global.SilhouetteExtractor.renderSilhouetteFusionOverlay
    ) {
      const sm = state.contour.silhouetteMeta;
      const silAsset = sm.assetId ? state.assetMap.get(sm.assetId) : null;
      if (silAsset) {
        let bx = 0, by = 0, bw = rw, bh = rh;
        if (state.contour.keepAspect !== false && state.contour.baseAspect) {
          const targetAspect = state.contour.baseAspect;
          const curAspect = rw / rh;
          if (curAspect > targetAspect) {
            bh = rh; bw = rh * targetAspect; bx = (rw - bw) / 2;
          } else {
            bw = rw; bh = rw / targetAspect; by = (rh - bh) / 2;
          }
        }
        global.SilhouetteExtractor.renderSilhouetteFusionOverlay(ctx, sm, silAsset, bx, by, bw, bh, outerPath, renderScale);
      }
    }

    // 按跨类型统一图层栈 zOrder 升序绘制所有可见叠加图层（自由相框、贴脸装饰、连线放大镜、文字气泡可自由交错叠放！）
    const unifiedOverlays = [];
    for (const ff of (state.freeFrames || [])) {
      if (ff.visible === false) continue;
      unifiedOverlays.push({ kind: 'frame', z: ff.zOrder ?? 100, item: ff });
    }
    for (const st of (state.stickers || [])) {
      if (st.visible === false) continue;
      unifiedOverlays.push({ kind: 'sticker', z: st.zOrder ?? 200, item: st });
    }
    for (const lp of (state.loupes || [])) {
      if (lp.visible === false) continue;
      unifiedOverlays.push({ kind: 'loupe', z: lp.zOrder ?? 300, item: lp });
    }
    for (const txt of (state.texts || [])) {
      if (txt.visible === false) continue;
      unifiedOverlays.push({ kind: 'text', z: txt.zOrder ?? 400, item: txt });
    }
    unifiedOverlays.sort((a, b) => a.z - b.z);

    for (const entry of unifiedOverlays) {
      if (entry.kind === 'frame') {
        const ff = entry.item;
        const isDraggingThisFrame = state.dragAction && (
          (state.dragAction.item && state.dragAction.item.id === ff.id) ||
          (state.dragAction.frame && state.dragAction.frame.id === ff.id && state.dragAction.type !== 'pan-frame-image')
        );
        if (!isDraggingThisFrame && global.FxLabEngine && global.FxLabEngine.syncFrameFromHostAnchor) {
          global.FxLabEngine.syncFrameFromHostAnchor(ff, state);
        }
        const warn = renderFreeFrame(ctx, ff, state, rw, rh, renderScale, isExport);
        if (warn) selectedDpiWarning = warn;
      } else if (entry.kind === 'sticker') {
        const st = entry.item;
        if (!state.dragAction || state.dragAction.stickerId !== st.id) {
          if (global.StickerEngine) {
            global.StickerEngine.syncStickerCanvasFromAnchor(st, state);
          }
        }
        renderStickerItem(ctx, st, state, rw, rh, renderScale);
      } else if (entry.kind === 'loupe') {
        ensureCanvasSize(scratchLoupeSrc, rw, rh);
        const lSrcCtx = scratchLoupeSrc.getContext('2d');
        lSrcCtx.clearRect(0, 0, rw, rh);
        lSrcCtx.drawImage(targetCanvas, 0, 0);
        renderZoomLoupeItem(ctx, scratchLoupeSrc, entry.item, rw, rh, renderScale);
      } else if (entry.kind === 'text') {
        renderTextBubble(ctx, entry.item, rw, rh, renderScale);
      }
    }

    // 全局画布质感后处理层（色调倾向 globalTone / 电影感暗角 vignette / 画纸胶片微颗粒 grain，导出成品同步生效！）
    const gTone = (state.style && state.style.globalTone) || 'none';
    const gVig = (state.style && state.style.vignette) || 0;
    const gGrain = (state.style && state.style.grain) || 0;

    if (gVig > 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const vcx = rw * 0.5, vcy = rh * 0.5;
      const vr = Math.hypot(rw, rh) * 0.54;
      const vigGrad = ctx.createRadialGradient(vcx, vcy, vr * 0.36, vcx, vcy, vr);
      vigGrad.addColorStop(0, 'rgba(8, 10, 18, 0)');
      vigGrad.addColorStop(0.65, `rgba(8, 10, 18, ${(gVig / 100) * 0.28})`);
      vigGrad.addColorStop(1, `rgba(8, 10, 18, ${(gVig / 100) * 0.88})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, rw, rh);
      ctx.restore();
    }

    if (gGrain > 0.5) {
      const tile = getGrainTileCanvas();
      if (tile && ctx.createPattern) {
        const pat = ctx.createPattern(tile, 'repeat');
        if (pat) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = Math.min(0.42, (gGrain / 100) * 0.32);
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, rw, rh);
          ctx.restore();
        }
      }
    }

    ctx.restore();

    if (gTone !== 'none') {
      const toneMap = {
        cool: 'saturate(94%) contrast(105%) hue-rotate(-7deg) brightness(102%)',
        warm: 'sepia(22%) saturate(112%) contrast(103%) brightness(101%)',
        vivid: 'saturate(130%) contrast(108%)',
        muted: 'saturate(70%) contrast(96%) brightness(102%)'
      };
      const tFilter = toneMap[gTone];
      if (tFilter) {
        ensureCanvasSize(scratchA, rw, rh);
        const ctxA = scratchA.getContext('2d');
        ctxA.globalCompositeOperation = 'source-over';
        ctxA.clearRect(0, 0, rw, rh);
        ctxA.drawImage(targetCanvas, 0, 0);

        ctx.clearRect(0, 0, rw, rh);
        ctx.save();
        ctx.clip(outerPath);
        ctx.filter = tFilter;
        ctx.drawImage(scratchA, 0, 0);
        ctx.restore();
      }
    }

    if (outerStrokePx >= 0.5) {
      ctx.save();
      ctx.clip(outerPath);
      ctx.strokeStyle = state.style.outerStrokeColor || '#ffffff';
      ctx.lineWidth = outerStrokePx * 2;
      ctx.lineJoin = 'round';
      ctx.stroke(outerPath);
      ctx.restore();
    }

    return { selectedDpiWarning };
  }

  // 渲染全屏无限画布视口 (包含点阵背景 + 唯一总外框投影与内容 + 跨外框透视预览 + 自由画外框轨迹)
  function renderInfiniteViewport(viewportCanvas, state) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, viewportCanvas.clientWidth);
    const cssH = Math.max(1, viewportCanvas.clientHeight);
    const backingW = Math.round(cssW * dpr);
    const backingH = Math.round(cssH * dpr);
    ensureCanvasSize(viewportCanvas, backingW, backingH);

    const ctx = viewportCanvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    // 1. 绘制无限画布世界坐标点阵网格（支持界面外观开关显隐）
    if (!state.uiPrefs || state.uiPrefs.showCanvasGrid !== false) {
      drawInfiniteDotGrid(ctx, cssW, cssH, state);
    }

    const fw = state.frameWorld; // { x, y, w, h }
    const zoom = state.camZoom;

    // 计算总外框离屏缓冲区最佳渲染比例
    const desiredMaxSide = Math.min(2000, Math.max(fw.w, fw.h) * zoom * dpr);
    const bufScale = Math.max(0.15, Math.min(2.0, desiredMaxSide / Math.max(fw.w, fw.h)));

    const { selectedDpiWarning } = renderOuterFrameBuffer(frameCanvas, state, {
      isExport: false,
      renderScale: bufScale
    });

    // 2. 进入世界相机变换坐标系: 屏幕点 = (cssW/2, cssH/2) + (world - cam) * zoom
    ctx.save();
    ctx.translate(cssW * 0.5, cssH * 0.5);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    // 给唯一总外框投一圈柔和外阴影（开启环境背光或动态氛围色模式下叠加柔和舞台背光光晕）
    const isLight = state.theme === 'light' || state.uiTheme === 'creamy-light';
    const isOshiNeon = state.uiTheme === 'oshi-neon';
    const showAura = state.uiPrefs ? (state.uiPrefs.showStageAura !== false && (isOshiNeon || state.uiPrefs.showStageAura === 'always')) : isOshiNeon;
    const oshiHex = (state.uiPrefs && state.uiPrefs.customAccent) || state.oshiPrimary || '#a855f7';
    const worldOuterPath = buildPath2DFromRings(state.topology.outerPoly, [], 1, fw.x, fw.y);

    if (showAura) {
      ctx.save();
      const auraR = Math.max(fw.w, fw.h) * 0.78;
      const gcx = fw.x + fw.w * 0.5;
      const gcy = fw.y + fw.h * 0.5;
      const aura = ctx.createRadialGradient(gcx, gcy, auraR * 0.1, gcx, gcy, auraR);
      aura.addColorStop(0, hexToRgba(oshiHex, 0.22));
      aura.addColorStop(0.55, hexToRgba(oshiHex, 0.07));
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(gcx - auraR, gcy - auraR, auraR * 2, auraR * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = isLight
      ? 'rgba(30, 41, 59, 0.16)'
      : isOshiNeon
        ? hexToRgba(oshiHex, 0.45)
        : 'rgba(0, 0, 0, 0.68)';
    ctx.shadowBlur = (isOshiNeon ? 36 : 28) / zoom;
    ctx.shadowOffsetY = (isOshiNeon ? 4 : 8) / zoom;
    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.35)';
    ctx.fill(worldOuterPath);
    ctx.restore();

    // 绘制唯一总外框缓冲区图像
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frameCanvas, fw.x, fw.y, fw.w, fw.h);

    // 绘制唯一总外框边界轮廓线
    ctx.save();
    ctx.strokeStyle = isOshiNeon
      ? hexToRgba(oshiHex, 0.85)
      : isLight
        ? 'rgba(79, 110, 247, 0.58)'
        : 'rgba(79, 142, 247, 0.72)';
    ctx.lineWidth = 1.6 / zoom;
    ctx.stroke(worldOuterPath);
    ctx.restore();

    // 3. 在无限世界空间绘制编辑器交互层（框外透视原图可直接超出外框显示在无限画布上！）
    renderWorldOverlays(ctx, state, cssW, cssH, dpr);

    ctx.restore(); // 退出世界相机坐标系
    ctx.restore(); // 退出 DPR 缩放

    return { selectedDpiWarning };
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#a855f7').replace('#', '');
    if (clean.length !== 6) return `rgba(168, 85, 247, ${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16) || 168;
    const g = parseInt(clean.slice(2, 4), 16) || 85;
    const b = parseInt(clean.slice(4, 6), 16) || 247;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawInfiniteDotGrid(ctx, cssW, cssH, state) {
    const zoom = state.camZoom;
    let stepWorld = 50;
    while (stepWorld * zoom < 22) stepWorld *= 2;
    while (stepWorld * zoom > 90) stepWorld /= 2;

    const stepScreen = stepWorld * zoom;
    const originScreenX = cssW * 0.5 - state.camX * zoom;
    const originScreenY = cssH * 0.5 - state.camY * zoom;
    const startX = ((originScreenX % stepScreen) + stepScreen) % stepScreen;
    const startY = ((originScreenY % stepScreen) + stepScreen) % stepScreen;

    const isLight = state.theme === 'light' || state.uiTheme === 'creamy-light';
    const isOshiNeon = state.uiTheme === 'oshi-neon';
    ctx.fillStyle = isLight
      ? 'rgba(100, 116, 139, 0.22)'
      : isOshiNeon
        ? hexToRgba(state.oshiPrimary || '#a855f7', 0.22)
        : 'rgba(148, 163, 184, 0.15)';
    for (let y = startY; y < cssH; y += stepScreen) {
      for (let x = startX; x < cssW; x += stepScreen) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  function drawEmptyCellPlaceholder(ctx, cell, scale, state) {
    const b = cell.bounds;
    ctx.fillStyle = state.theme === 'light' ? 'rgba(148, 163, 184, 0.22)' : 'rgba(51, 65, 85, 0.45)';
    ctx.fillRect(b.minX * scale, b.minY * scale, b.w * scale, b.h * scale);

    if (state.dragHoverTarget && state.dragHoverTarget.type === 'cell' && state.dragHoverTarget.id === cell.id) {
      ctx.fillStyle = 'rgba(76, 139, 245, 0.38)';
      ctx.fillRect(b.minX * scale, b.minY * scale, b.w * scale, b.h * scale);
    }
  }

  function drawCellSlotBadge(ctx, cell, idx, hasImage, scale) {
    const pt = cell.repPt || cell.centroid;
    const x = pt.x * scale;
    const y = pt.y * scale;
    const label = cell.slotLabel && cell.slotLabel.trim()
      ? cell.slotLabel.trim()
      : `#${cell.slotOrder || (idx + 1)}`;

    ctx.save();
    ctx.font = `600 ${Math.max(11, Math.round(13 * Math.min(1.2, Math.max(0.75, scale))))}px "Microsoft YaHei UI", sans-serif`;
    const metrics = ctx.measureText(label);
    const pw = metrics.width + 14;
    const ph = 22;

    ctx.fillStyle = hasImage ? 'rgba(15, 23, 42, 0.62)' : 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, 6);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
    ctx.restore();
  }

  function getPolaroidInnerRect(fw, fh) {
    const padSide = Math.max(8, fw * 0.055);
    const padTop = padSide;
    const padBottom = Math.max(24, fh * 0.19);
    return {
      innerX: -fw / 2 + padSide,
      innerY: -fh / 2 + padTop,
      innerW: Math.max(10, fw - padSide * 2),
      innerH: Math.max(10, fh - padTop - padBottom),
      padBottom
    };
  }

  function renderFreeFrame(ctx, ff, state, rw, rh, renderScale, isExport) {
    const cx = ff.x * rw;
    const cy = ff.y * rh;
    const fw = ff.w * rw;
    const fh = ff.h * rh;
    const rotRad = ((ff.rotation || 0) * Math.PI) / 180;
    const asset = ff.assetId ? state.assetMap.get(ff.assetId) : null;
    let dpiWarn = null;

    ctx.save();
    ctx.globalAlpha = Math.max(0.08, Math.min(1, ff.opacity ?? 1));
    ctx.translate(cx, cy);
    ctx.rotate(rotRad);

    if (ff.shape === 'polaroid') {
      const { innerX, innerY, innerW, innerH, padBottom } = getPolaroidInnerRect(fw, fh);
      const r = (ff.cornerRadius || 4) * renderScale;

      ctx.save();
      if (ff.shadow) {
        ctx.shadowColor = ff.shadowColor || 'rgba(0,0,0,0.32)';
        ctx.shadowBlur = (ff.shadowBlur || 24) * renderScale;
        ctx.shadowOffsetY = 6 * renderScale;
      }
      ctx.fillStyle = ff.polaroidBg || '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-fw / 2, -fh / 2, fw, fh, r);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(innerX, innerY, innerW, innerH);
      ctx.clip();

      if (asset) {
        const params = computeImageDrawParams(asset, ff.transform, innerX, innerY, innerW, innerH, renderScale);
        drawTransformedImage(ctx, params, 1);
        if (params && state.selection && state.selection.type === 'frame' && state.selection.id === ff.id && params.effectivePixelRatio > 1.15) {
          dpiWarn = { pct: Math.round(params.effectivePixelRatio * 100), assetName: asset.name };
        }
      } else if (!isExport) {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(innerX, innerY, innerW, innerH);
        ctx.fillStyle = '#475569';
        ctx.font = `${Math.max(11, Math.round(13 * renderScale))}px "Microsoft YaHei UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('拖入图片', 0, innerY + innerH / 2);
      }
      ctx.restore();

      if (ff.caption) {
        ctx.fillStyle = '#334155';
        ctx.font = `600 ${Math.max(11, Math.round(padBottom * 0.38))}px "Georgia", "KaiTi", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ff.caption, 0, fh / 2 - padBottom * 0.48);
      }
    } else {
      const poly = global.SilhouetteEngine.buildFreeFrameShapePolygon(
        ff.shape,
        fw,
        fh,
        (ff.cornerRadius || 0) * renderScale,
        ff.customPoints || null
      );
      const framePath = buildPath2DFromRings(poly, [], 1);

      if (ff.shadow) {
        ctx.save();
        ctx.shadowColor = ff.shadowColor || 'rgba(0,0,0,0.38)';
        ctx.shadowBlur = (ff.shadowBlur || 22) * renderScale;
        ctx.shadowOffsetY = 5 * renderScale;
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fill(framePath);
        ctx.restore();
      }

      ctx.save();
      ctx.clip(framePath);
      if (asset) {
        const params = computeImageDrawParams(asset, ff.transform, -fw / 2, -fh / 2, fw, fh, renderScale);
        drawTransformedImage(ctx, params, 1);
        if (params && state.selection && state.selection.type === 'frame' && state.selection.id === ff.id && params.effectivePixelRatio > 1.15) {
          dpiWarn = { pct: Math.round(params.effectivePixelRatio * 100), assetName: asset.name };
        }
      } else if (!isExport) {
        ctx.fillStyle = 'rgba(76, 139, 245, 0.25)';
        ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
        ctx.fillStyle = '#f8fafc';
        ctx.font = `${Math.max(11, Math.round(13 * renderScale))}px "Microsoft YaHei UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ff.silhouetteMeta ? '人物剪影框 (拖入其他角色)' : '自由相框 (拖入图片)', 0, 0);
      }

      // 若该自由相框是由人物轮廓提取生成的剪影相框，同样支持双重曝光线稿/柔光/局部原貌保留融合！
      if (ff.silhouetteMeta && global.SilhouetteExtractor && global.SilhouetteExtractor.renderSilhouetteFusionOverlay) {
        const silAsset = ff.silhouetteMeta.assetId ? state.assetMap.get(ff.silhouetteMeta.assetId) : null;
        if (silAsset) {
          global.SilhouetteExtractor.renderSilhouetteFusionOverlay(
            ctx,
            ff.silhouetteMeta,
            silAsset,
            -fw / 2, -fh / 2, fw, fh,
            null,
            renderScale
          );
        }
      }
      ctx.restore();

      const bw = (ff.borderWidth || 0) * renderScale;
      if (bw > 0.3) {
        ctx.strokeStyle = ff.borderColor || '#ffffff';
        ctx.lineWidth = bw;
        ctx.lineJoin = 'round';
        ctx.stroke(framePath);
      }
    }

    ctx.restore();
    return dpiWarn;
  }

  function renderZoomLoupeItem(ctx, sourceSnapshotCanvas, lp, rw, rh, renderScale) {
    const sx = lp.srcX * rw;
    const sy = lp.srcY * rh;
    const dx = lp.dstX * rw;
    const dy = lp.dstY * rh;
    const minSide = Math.min(rw, rh);
    const srcR = Math.max(10 * renderScale, (lp.srcR || 0.045) * minSide);
    const dstR = Math.max(28 * renderScale, (lp.dstSize || 0.14) * minSide);
    const zoom = Math.max(1.5, lp.zoom || 3.2);
    const accent = lp.color || '#38bdf8';
    const shape = lp.shape || 'circle'; // 'circle' | 'hex' | 'rect'

    ctx.save();

    // 1. 计算源瞄准圈到目标放大框的科技感折线引线 (Elbow Leader Line)
    const vx = dx - sx;
    const vy = dy - sy;
    const dist = Math.hypot(vx, vy) || 1;
    const ux = vx / dist, uy = vy / dist;
    const pStart = { x: sx + ux * srcR, y: sy + uy * srcR };
    const pEnd = { x: dx - ux * dstR, y: dy - uy * dstR };

    // 45度折角拐点
    const elbowX = pStart.x + (pEnd.x - pStart.x) * 0.45;
    const elbowY = pStart.y + (pEnd.y - pStart.y) * 0.18;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6 * renderScale;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.8, 2.6 * renderScale);
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();

    // 源小瞄准圈 + 十字准星刻度
    ctx.beginPath();
    ctx.arc(sx, sy, srcR, 0, Math.PI * 2);
    ctx.stroke();
    const tick = srcR * 0.28;
    ctx.beginPath();
    ctx.moveTo(sx - srcR - tick * 0.4, sy); ctx.lineTo(sx - srcR + tick * 0.6, sy);
    ctx.moveTo(sx + srcR - tick * 0.6, sy); ctx.lineTo(sx + srcR + tick * 0.4, sy);
    ctx.moveTo(sx, sy - srcR - tick * 0.4); ctx.lineTo(sx, sy - srcR + tick * 0.6);
    ctx.moveTo(sx, sy + srcR - tick * 0.6); ctx.lineTo(sx, sy + srcR + tick * 0.4);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(elbowX, elbowY, 3.2 * renderScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. 构建目标放大特写框几何路径 (圆形 / 六边形战术框 / 矩形设定框)
    const dstPath = new Path2D();
    if (shape === 'hex') {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = dx + Math.cos(a) * dstR;
        const py = dy + Math.sin(a) * dstR;
        if (i === 0) dstPath.moveTo(px, py); else dstPath.lineTo(px, py);
      }
      dstPath.closePath();
    } else if (shape === 'rect') {
      dstPath.roundRect(dx - dstR * 1.15, dy - dstR * 0.88, dstR * 2.3, dstR * 1.76, 10 * renderScale);
    } else {
      dstPath.arc(dx, dy, dstR, 0, Math.PI * 2);
    }

    // 投影底板
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.52)';
    ctx.shadowBlur = 20 * renderScale;
    ctx.shadowOffsetY = 6 * renderScale;
    ctx.fillStyle = '#0f172a';
    ctx.fill(dstPath);
    ctx.restore();

    // 裁剪并从快照缓冲区采样放大画面！
    ctx.save();
    ctx.clip(dstPath);
    const sampleRadiusX = (dstR * 1.2) / zoom;
    const sampleRadiusY = (dstR * 1.2) / zoom;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      sourceSnapshotCanvas,
      sx - sampleRadiusX, sy - sampleRadiusY, sampleRadiusX * 2, sampleRadiusY * 2,
      dx - dstR * 1.2, dy - dstR * 1.2, dstR * 2.4, dstR * 2.4
    );
    ctx.restore();

    // 双层科技感外框描边
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.5, 4.5 * renderScale);
    ctx.stroke(dstPath);
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.5, 2.2 * renderScale);
    ctx.stroke(dstPath);

    // 底部设定集风批注铭牌
    if (lp.label && lp.label.trim()) {
      const fSize = Math.max(10, Math.round(13 * renderScale));
      ctx.font = `700 ${fSize}px "Microsoft YaHei UI", Consolas, sans-serif`;
      const tw = ctx.measureText(lp.label).width + 16 * renderScale;
      const th = fSize + 8 * renderScale;
      const tagY = dy + (shape === 'rect' ? dstR * 0.88 : dstR) + 4 * renderScale;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(dx - tw / 2, tagY, tw, th, 4 * renderScale);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2 * renderScale;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lp.label, dx, tagY + th / 2);
    }

    ctx.restore();
  }

  function renderStickerItem(ctx, st, state, rw, rh, renderScale) {
    const cx = st.x * rw;
    const cy = st.y * rh;
    const sw = Math.max(4, st.w * rw);
    const sh = Math.max(4, st.h * rh);
    const rotRad = ((st.rotation || 0) * Math.PI) / 180;

    ctx.save();

    // 若用户关闭了「允许破框伸出分镜格」，则将该装饰严格裁剪在所属分镜格内部！
    if (st.breakFrame === false && st.anchorType === 'cell' && st.anchorId) {
      const cell = state.topology.cells.find(c => c.id === st.anchorId);
      if (cell) {
        const cPath = buildPath2DFromRings(cell.outer, cell.holes, renderScale);
        ctx.clip(cPath, 'evenodd');
      }
    }

    ctx.globalAlpha = Math.max(0.05, Math.min(1, st.opacity ?? 1));
    ctx.translate(cx, cy);
    ctx.rotate(rotRad);
    ctx.scale(st.flipX ? -1 : 1, st.flipY ? -1 : 1);

    if (st.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.32)';
      ctx.shadowBlur = 8 * renderScale;
      ctx.shadowOffsetY = 2 * renderScale;
    }

    if (st.kind === 'builtin' && global.StickerEngine) {
      global.StickerEngine.drawBuiltinVectorSticker(
        ctx,
        st.presetId,
        sw,
        sh,
        st.color1 || '#27272a',
        st.color2 || '#fda4af',
        st.strokeColor || '#18181b'
      );
    } else if (st.kind === 'custom') {
      const cObj = state.customStickerMap && state.customStickerMap.get(st.customId);
      const img = (cObj && cObj.img) || st._cachedImg;
      if (img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
      }
    }

    ctx.restore();
  }

  function renderTextBubble(ctx, txt, rw, rh, renderScale) {
    const cx = txt.x * rw;
    const cy = txt.y * rh;
    const fontSize = Math.max(8, (txt.fontSize || 34) * renderScale);
    const lines = String(txt.text || '').split(/\r?\n/);
    const lineHeight = fontSize * 1.26;
    const weight = txt.bold ? '700' : '400';
    const style = txt.italic ? 'italic' : 'normal';
    const family = txt.fontFamily || 'Microsoft YaHei UI';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((txt.rotation || 0) * Math.PI) / 180);
    ctx.font = `${style} ${weight} ${fontSize}px "${family}", sans-serif`;

    let maxLineW = 20;
    for (const ln of lines) maxLineW = Math.max(maxLineW, ctx.measureText(ln).width);
    const textBlockH = lines.length * lineHeight;
    const padX = fontSize * 0.72;
    const padY = fontSize * 0.48;
    const bw = maxLineW + padX * 2;
    const bh = textBlockH + padY * 2;

    txt._lastBox = { w: bw / rw, h: bh / rh };

    const bType = txt.bubbleType || 'plain';
    if (bType !== 'plain') {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 10 * renderScale;
      ctx.shadowOffsetY = 3 * renderScale;
      ctx.fillStyle = txt.bubbleFill || '#ffffff';
      ctx.strokeStyle = txt.bubbleStroke || '#111827';
      ctx.lineWidth = Math.max(1.5, 3 * renderScale);
      ctx.lineJoin = 'round';

      if (bType === 'tag') {
        ctx.beginPath();
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, Math.min(bh / 2, 12 * renderScale));
        ctx.fill();
        ctx.stroke();
      } else if (bType === 'narration') {
        ctx.beginPath();
        ctx.rect(-bw / 2, -bh / 2, bw, bh);
        ctx.fill();
        ctx.stroke();
        const inset = 4 * renderScale;
        if (bw > inset * 4 && bh > inset * 4) {
          ctx.shadowColor = 'transparent';
          ctx.lineWidth = Math.max(1, 1.2 * renderScale);
          ctx.strokeRect(-bw / 2 + inset, -bh / 2 + inset, bw - inset * 2, bh - inset * 2);
        }
      } else if (bType === 'speech') {
        const rx = bw * 0.58;
        const ry = bh * 0.62;
        const tailAng = ((txt.tailAngle ?? 125) * Math.PI) / 180;
        const spread = 0.22;
        const tipDist = Math.max(rx, ry) + fontSize * 0.75;
        ctx.beginPath();
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const a = tailAng + spread + ((Math.PI * 2 - spread * 2) * i) / steps;
          const px = Math.cos(a) * rx;
          const py = Math.sin(a) * ry;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.lineTo(Math.cos(tailAng) * tipDist, Math.sin(tailAng) * tipDist);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (bType === 'burst') {
        const spikes = 22;
        const rxIn = bw * 0.56, ryIn = bh * 0.60;
        const rxOut = rxIn + fontSize * 0.55, ryOut = ryIn + fontSize * 0.55;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * Math.PI * 2;
          const isOuter = i % 2 === 0;
          const px = Math.cos(a) * (isOuter ? rxOut : rxIn);
          const py = Math.sin(a) * (isOuter ? ryOut : ryIn);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const startY = -((lines.length - 1) * lineHeight) / 2;
    const sw = (txt.strokeWidth || 0) * renderScale;

    for (let i = 0; i < lines.length; i++) {
      const ly = startY + i * lineHeight;
      if (sw > 0.3) {
        ctx.strokeStyle = txt.strokeColor || '#0f172a';
        ctx.lineWidth = sw * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(lines[i], 0, ly);
      }
      ctx.fillStyle = txt.color || (bType === 'plain' ? '#ffffff' : '#111827');
      ctx.fillText(lines[i], 0, ly);
    }

    ctx.restore();
  }

  // 在无限世界坐标 (wx, wy) 下绘制全部交互辅助叠加层！
  function renderWorldOverlays(ctx, state) {
    const fw = state.frameWorld; // { x, y, w, h }
    const zoom = state.camZoom;
    const invZ = 1 / zoom;

    // 1. 框外半透明原图透视预览 (直接绘制在无限画布世界坐标上，即使原图超出总外框也能清晰看见！)
    if (state.showXRayGhost && state.selection) {
      if (state.selection.type === 'cell') {
        const cell = state.topology.cells.find(c => c.id === state.selection.id);
        const asset = cell && cell.assetId ? state.assetMap.get(cell.assetId) : null;
        if (cell && asset) {
          const b = cell.bounds;
          const params = computeImageDrawParams(
            asset, cell.transform,
            fw.x + b.minX, fw.y + b.minY,
            Math.max(1, b.w), Math.max(1, b.h), 1
          );
          if (params) {
            // 仅在格子外部绘制半透明幽灵图（裁剪挖去当前格子内部区域，保持框内鲜艳清晰！）
            ctx.save();
            ctx.beginPath();
            ctx.rect(params.centerX - params.drawW * 2, params.centerY - params.drawH * 2, params.drawW * 4, params.drawH * 4);
            for (const ring of [cell.outer, ...(cell.holes || [])]) {
              if (ring.length < 3) continue;
              ctx.moveTo(fw.x + ring[0].x, fw.y + ring[0].y);
              for (let i = 1; i < ring.length; i++) ctx.lineTo(fw.x + ring[i].x, fw.y + ring[i].y);
              ctx.closePath();
            }
            ctx.clip('evenodd');
            drawTransformedImage(ctx, params, 0.28);
            ctx.restore();

            ctx.save();
            ctx.translate(params.centerX, params.centerY);
            ctx.rotate(params.totalRad);
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
            ctx.lineWidth = 1.5 * invZ;
            ctx.setLineDash([6 * invZ, 4 * invZ]);
            ctx.strokeRect(-params.drawW * 0.5, -params.drawH * 0.5, params.drawW, params.drawH);
            ctx.restore();
          }
        }
      } else if (state.selection.type === 'frame') {
        const ff = state.freeFrames.find(f => f.id === state.selection.id);
        const asset = ff && ff.assetId ? state.assetMap.get(ff.assetId) : null;
        if (ff && asset) {
          const cx = fw.x + ff.x * fw.w;
          const cy = fw.y + ff.y * fw.h;
          const boxW = ff.w * fw.w;
          const boxH = ff.h * fw.h;

          let innerX = -boxW / 2, innerY = -boxH / 2, innerW = boxW, innerH = boxH;
          if (ff.shape === 'polaroid') {
            const pRect = getPolaroidInnerRect(boxW, boxH);
            innerX = pRect.innerX; innerY = pRect.innerY; innerW = pRect.innerW; innerH = pRect.innerH;
          }

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(((ff.rotation || 0) * Math.PI) / 180);
          const params = computeImageDrawParams(asset, ff.transform, innerX, innerY, innerW, innerH, 1);
          if (params) {
            // 挖除相框内部，仅在相框外显示半透明完整原图方便对准选区！
            ctx.save();
            ctx.beginPath();
            ctx.rect(params.centerX - params.drawW * 2, params.centerY - params.drawH * 2, params.drawW * 4, params.drawH * 4);
            if (ff.shape === 'polaroid') {
              ctx.rect(innerX, innerY, innerW, innerH);
            } else {
              const poly = global.SilhouetteEngine.buildFreeFrameShapePolygon(
                ff.shape,
                boxW,
                boxH,
                ff.cornerRadius || 0,
                ff.customPoints || null
              );
              ctx.moveTo(poly[0].x, poly[0].y);
              for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
              ctx.closePath();
            }
            ctx.clip('evenodd');
            drawTransformedImage(ctx, params, state.frameEditImageMode ? 0.36 : 0.22);
            ctx.restore();

            ctx.save();
            ctx.translate(params.centerX, params.centerY);
            ctx.rotate(params.totalRad);
            ctx.strokeStyle = state.frameEditImageMode ? '#22d3ee' : 'rgba(34, 211, 238, 0.6)';
            ctx.lineWidth = (state.frameEditImageMode ? 2 : 1.3) * invZ;
            ctx.setLineDash([6 * invZ, 4 * invZ]);
            ctx.strokeRect(-params.drawW * 0.5, -params.drawH * 0.5, params.drawW, params.drawH);
            ctx.restore();
          }
          ctx.restore();
        }
      }
    }

    // 2. 悬空待交汇半截刀口提示
    if (state.topology.danglingEdges && state.topology.danglingEdges.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5 * invZ;
      ctx.setLineDash([7 * invZ, 5 * invZ]);
      ctx.beginPath();
      for (const de of state.topology.danglingEdges) {
        ctx.moveTo(fw.x + de.a.x, fw.y + de.a.y);
        ctx.lineTo(fw.x + de.b.x, fw.y + de.b.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const de of state.topology.danglingEdges) {
        for (const p of [de.a, de.b]) {
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(fw.x + p.x, fw.y + p.y, 5 * invZ, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 3. 选中项高亮与手柄
    if (state.selection) {
      const sel = state.selection;
      if (sel.type === 'cell') {
        const cell = state.topology.cells.find(c => c.id === sel.id);
        if (cell) {
          const p = buildPath2DFromRings(cell.outer, cell.holes, 1, fw.x, fw.y);
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5 * invZ;
          ctx.stroke(p);

          // 当选中格开启了漫画/情绪线条时，在焦点处绘制轻巧准星与留空安全圈参考虚线
          if (cell.fx && cell.fx.mangaLines && cell.fx.mangaLines !== 'none') {
            const b = cell.bounds;
            const fwx = fw.x + b.minX + b.w * (cell.fx.mangaFocusX ?? 0.5);
            const fwy = fw.y + b.minY + b.h * (cell.fx.mangaFocusY ?? 0.38);
            const safeR = Math.min(b.w, b.h) * (cell.fx.mangaSafeR ?? 0.34);

            ctx.strokeStyle = state.pickingMangaFocusCellId === cell.id ? '#f59e0b' : 'rgba(34, 211, 238, 0.72)';
            ctx.lineWidth = 1.4 * invZ;
            ctx.setLineDash([5 * invZ, 4 * invZ]);
            ctx.beginPath();
            ctx.arc(fwx, fwy, safeR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            const cr = 7 * invZ;
            ctx.beginPath();
            ctx.arc(fwx, fwy, cr, 0, Math.PI * 2);
            ctx.moveTo(fwx - cr * 1.6, fwy); ctx.lineTo(fwx + cr * 1.6, fwy);
            ctx.moveTo(fwx, fwy - cr * 1.6); ctx.lineTo(fwx, fwy + cr * 1.6);
            ctx.stroke();
          }
          ctx.restore();
        }
      } else if (sel.type === 'cut') {
        const cut = state.cuts.find(c => c.id === sel.id);
        if (cut) drawSelectedCutHandlesWorld(ctx, cut, fw, invZ);
      } else if (sel.type === 'frame') {
        const ff = state.freeFrames.find(f => f.id === sel.id);
        if (ff) {
          drawBoxHandlesWorld(
            ctx,
            fw.x + ff.x * fw.w,
            fw.y + ff.y * fw.h,
            ff.w * fw.w,
            ff.h * fw.h,
            ff.rotation || 0,
            true,
            state.frameEditImageMode && !!ff.assetId,
            invZ
          );
        }
      } else if (sel.type === 'text') {
        const txt = state.texts.find(t => t.id === sel.id);
        if (txt && txt._lastBox) {
          drawBoxHandlesWorld(
            ctx,
            fw.x + txt.x * fw.w,
            fw.y + txt.y * fw.h,
            txt._lastBox.w * fw.w,
            txt._lastBox.h * fw.h,
            txt.rotation || 0,
            false,
            false,
            invZ
          );
        }
      } else if (sel.type === 'sticker') {
        const st = (state.stickers || []).find(s => s.id === sel.id);
        if (st) {
          drawStickerOuterHandlesWorld(
            ctx,
            fw.x + st.x * fw.w,
            fw.y + st.y * fw.h,
            st.w * fw.w,
            st.h * fw.h,
            st.rotation || 0,
            st.anchorType && st.anchorType !== 'none',
            invZ
          );
        }
      } else if (sel.type === 'loupe') {
        const lp = (state.loupes || []).find(l => l.id === sel.id);
        if (lp) {
          const minSide = Math.min(fw.w, fw.h);
          const dstR = Math.max(28, (lp.dstSize || 0.14) * minSide);
          const srcR = Math.max(10, (lp.srcR || 0.045) * minSide);
          ctx.save();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.2 * invZ;
          ctx.setLineDash([5 * invZ, 4 * invZ]);
          ctx.beginPath();
          ctx.arc(fw.x + lp.srcX * fw.w, fw.y + lp.srcY * fw.h, srcR + 5 * invZ, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(fw.x + lp.dstX * fw.w, fw.y + lp.dstY * fw.h, dstR + 6 * invZ, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 3b. 当处于「🐾 贴脸装饰防误触模式」时，给未选中的小装饰也加上轻柔虚线提示框，方便在复杂头发里一眼找到胡须/小装饰！
    if (state.tool === 'sticker' && Array.isArray(state.stickers)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.lineWidth = 1.2 * invZ;
      ctx.setLineDash([4 * invZ, 4 * invZ]);
      for (const st of state.stickers) {
        if (state.selection && state.selection.type === 'sticker' && state.selection.id === st.id) continue;
        ctx.save();
        ctx.translate(fw.x + st.x * fw.w, fw.y + st.y * fw.h);
        ctx.rotate(((st.rotation || 0) * Math.PI) / 180);
        const pw = st.w * fw.w + 8 * invZ;
        const ph = st.h * fw.h + 8 * invZ;
        ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
        ctx.restore();
      }
      ctx.restore();
    }

    // 4. 自定义总外框锚点微调手柄 (支持直接把外框锚点往无限画布外部拉大！)
    if (state.editingContourNodes && state.contour.type === 'custom' && Array.isArray(state.contour.customPoints)) {
      ctx.save();
      for (const pt of state.contour.customPoints) {
        const wx = fw.x + pt.x * fw.w;
        const wy = fw.y + pt.y * fw.h;
        ctx.fillStyle = pt.smooth ? '#22d3ee' : '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * invZ;
        ctx.beginPath();
        ctx.arc(wx, wy, 6.5 * invZ, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. 正在绘制中的草稿线（尤其是自定义异形外框，直接在任意世界坐标绘制！）
    if (state.draft) {
      drawDraftPreviewWorld(ctx, state, fw, invZ);
    }
  }

  function drawSelectedCutHandlesWorld(ctx, cut, fw, invZ) {
    const sampled = global.PlanarSlicer.sampleCutPointsPx(cut, fw.w, fw.h);
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3 * invZ;
    ctx.beginPath();
    sampled.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(fw.x + p.x, fw.y + p.y);
      else ctx.lineTo(fw.x + p.x, fw.y + p.y);
    });
    ctx.stroke();

    if (cut.mode === 'curve' && cut.points.length === 2 && cut.cp1 && cut.cp2) {
      const p0 = { x: fw.x + cut.points[0].x * fw.w, y: fw.y + cut.points[0].y * fw.h };
      const p1 = { x: fw.x + cut.points[1].x * fw.w, y: fw.y + cut.points[1].y * fw.h };
      const c1 = { x: fw.x + cut.cp1.x * fw.w, y: fw.y + cut.cp1.y * fw.h };
      const c2 = { x: fw.x + cut.cp2.x * fw.w, y: fw.y + cut.cp2.y * fw.h };

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 1.5 * invZ;
      ctx.setLineDash([4 * invZ, 3 * invZ]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(c1.x, c1.y);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const cp of [c1, c2]) {
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2 * invZ;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 6.5 * invZ, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    for (const pt of cut.points) {
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * invZ;
      ctx.beginPath();
      ctx.arc(fw.x + pt.x * fw.w, fw.y + pt.y * fw.h, 6 * invZ, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 专为猫耳/猫须等精细小装饰设计的「外置防挡防误触手柄」：
  // 内部整个区域 100% 纯移动位置，手柄向外扩出 pad 距离绝不遮挡鼻尖/发际线对位！
  function drawStickerOuterHandlesWorld(ctx, cx, cy, w, h, rotDeg, isBound, invZ) {
    const pad = 11 * invZ;
    const hw = w / 2 + pad;
    const hh = h / 2 + pad;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotDeg * Math.PI) / 180);

    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.8 * invZ;
    ctx.setLineDash([5 * invZ, 3.5 * invZ]);
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.setLineDash([]);

    // 顶部旋转控制球
    const stemLen = 22 * invZ;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, -hh - stemLen);
    ctx.stroke();
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8 * invZ;
    ctx.beginPath();
    ctx.arc(0, -hh - stemLen, 5.5 * invZ, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 四角等比缩放圆点
    const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ec4899';
    for (const [qx, qy] of corners) {
      ctx.beginPath();
      ctx.arc(qx, qy, 5 * invZ, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 右侧与底侧「侧脸透视独立压窄/拉高」胶囊手柄！
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#0f172a';
    // 右中水平压窄柄
    ctx.beginPath();
    ctx.roundRect(hw - 3 * invZ, -7 * invZ, 6 * invZ, 14 * invZ, 3 * invZ);
    ctx.fill();
    ctx.stroke();
    // 底中垂直压扁柄
    ctx.beginPath();
    ctx.roundRect(-7 * invZ, hh - 3 * invZ, 14 * invZ, 6 * invZ, 3 * invZ);
    ctx.fill();
    ctx.stroke();

    if (isBound) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.beginPath();
      ctx.arc(-hw, -hh - 12 * invZ, 4 * invZ, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBoxHandlesWorld(ctx, cx, cy, w, h, rotDeg, showCorners, isEditingInnerImg, invZ) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotDeg * Math.PI) / 180);
    ctx.strokeStyle = isEditingInnerImg ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 2.2 * invZ;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // 顶部旋转杆
    const stemLen = 24 * invZ;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, -h / 2 - stemLen);
    ctx.stroke();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(0, -h / 2 - stemLen, 5.5 * invZ, 0, Math.PI * 2);
    ctx.fill();

    if (showCorners) {
      const hs = 5.5 * invZ;
      const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isEditingInnerImg ? '#10b981' : '#2563eb';
      ctx.lineWidth = 2 * invZ;
      for (const [qx, qy] of corners) {
        ctx.fillRect(qx - hs, qy - hs, hs * 2, hs * 2);
        ctx.strokeRect(qx - hs, qy - hs, hs * 2, hs * 2);
      }
    }
    ctx.restore();
  }

  function drawDraftPreviewWorld(ctx, state, fw, invZ) {
    const d = state.draft;
    ctx.save();

    // A. 在无限画布任意位置绘制新总外框 (使用纯世界坐标 worldPoints)
    if (d.kind === 'contour-world-poly' || d.kind === 'contour-world-free') {
      const pts = d.worldPoints || [];
      const all = d.cursorWorld ? [...pts, d.cursorWorld] : pts;

      if (all.length >= 2) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.14)';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.6 * invZ;
        ctx.beginPath();
        all.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        if (all.length >= 3) {
          ctx.save();
          ctx.setLineDash([6 * invZ, 5 * invZ]);
          ctx.lineTo(all[0].x, all[0].y);
          ctx.fill();
          ctx.restore();
        }
        ctx.stroke();
      }

      if (d.kind === 'contour-world-poly' && pts.length >= 3 && d.cursorWorld) {
        if (Math.hypot(d.cursorWorld.x - pts[0].x, d.cursorWorld.y - pts[0].y) <= 18 * invZ) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3 * invZ;
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, 11 * invZ, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (d.kind === 'contour-world-poly') {
        for (const p of pts) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2 * invZ;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5 * invZ, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    // B. 外框内部的直线/曲线/手绘切割刀预览
    if (d.kind === 'cut-line' || d.kind === 'cut-curve') {
      const pts = d.points.map(p => ({ x: fw.x + p.x * fw.w, y: fw.y + p.y * fw.h }));
      const cursor = d.cursor ? { x: fw.x + d.cursor.x * fw.w, y: fw.y + d.cursor.y * fw.h } : null;
      const all = cursor ? [...pts, cursor] : pts;

      if (all.length >= 2) {
        if (state.autoExtend) {
          const segs = state.topology.outerPoly.map((p, idx, arr) => ({
            a: { x: fw.x + p.x, y: fw.y + p.y },
            b: { x: fw.x + arr[(idx + 1) % arr.length].x, y: fw.y + arr[(idx + 1) % arr.length].y }
          }));
          const s0 = all[0], s1 = all[1];
          const hitBack = global.PlanarSlicer.raycastNearestSegment(s0, s0.x - s1.x, s0.y - s1.y, segs, 0.5);
          const eLast = all[all.length - 1], ePrev = all[all.length - 2];
          const hitFwd = global.PlanarSlicer.raycastNearestSegment(eLast, eLast.x - ePrev.x, eLast.y - ePrev.y, segs, 0.5);

          ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
          ctx.lineWidth = 2 * invZ;
          ctx.setLineDash([5 * invZ, 5 * invZ]);
          ctx.beginPath();
          if (hitBack) { ctx.moveTo(s0.x, s0.y); ctx.lineTo(hitBack.x, hitBack.y); }
          if (hitFwd) { ctx.moveTo(eLast.x, eLast.y); ctx.lineTo(hitFwd.x, hitFwd.y); }
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.8 * invZ;
        ctx.beginPath();
        if (d.kind === 'cut-curve' && all.length >= 3) {
          const normAll = all.map(p => ({ x: (p.x - fw.x) / fw.w, y: (p.y - fw.y) / fw.h }));
          const dense = global.PlanarSlicer.sampleCutPointsPx({ mode: 'curve', points: normAll, closed: false }, fw.w, fw.h);
          dense.forEach((p, i) => i === 0 ? ctx.moveTo(fw.x + p.x, fw.y + p.y) : ctx.lineTo(fw.x + p.x, fw.y + p.y));
        } else {
          all.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        }
        ctx.stroke();
      }

      if (pts.length >= 2 && cursor && Math.hypot(cursor.x - pts[0].x, cursor.y - pts[0].y) <= 16 * invZ) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3 * invZ;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, 11 * invZ, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const p of pts) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2 * invZ;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * invZ, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (d.kind === 'cut-free' && d.points.length >= 2) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.8 * invZ;
      ctx.beginPath();
      d.points.forEach((p, i) => {
        const wx = fw.x + p.x * fw.w, wy = fw.y + p.y * fw.h;
        if (i === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      });
      ctx.stroke();
    }

    ctx.restore();
  }

  function autoTrimTransparentCanvas(sourceCanvas, padPx = 2) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, w, h).data;

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (imgData[rowOffset + x * 4 + 3] > 3) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return sourceCanvas;
    minX = Math.max(0, minX - padPx);
    minY = Math.max(0, minY - padPx);
    maxX = Math.min(w - 1, maxX + padPx);
    maxY = Math.min(h - 1, maxY + padPx);

    const tw = maxX - minX + 1;
    const th = maxY - minY + 1;
    if (tw === w && th === h) return sourceCanvas;

    const trimmed = document.createElement('canvas');
    trimmed.width = tw;
    trimmed.height = th;
    trimmed.getContext('2d').drawImage(sourceCanvas, minX, minY, tw, th, 0, 0, tw, th);
    return trimmed;
  }

  global.CollageRenderer = {
    computeImageDrawParams,
    computeCellImageParams,
    getPolaroidInnerRect,
    renderOuterFrameBuffer,
    renderInfiniteViewport,
    autoTrimTransparentCanvas
  };
})(window);
