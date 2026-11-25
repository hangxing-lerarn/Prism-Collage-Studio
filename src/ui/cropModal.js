(function (global) {
  // =========================================================================
  // CropModal: 独立单图精修裁剪、固定比例框选、90°旋转、精细拉直与镜像翻转窗口
  // =========================================================================

  let currentTarget = null; // { asset, transform, cellAspect, onApply }
  let draftTf = null;
  let cropRatioMode = 'free'; // 'free' | 'cell' | '1:1' | '16:9' | '9:16' | '4:3'
  let dragState = null;
  let imgDrawRect = { x: 0, y: 0, w: 100, h: 100 };

  const modalEl = document.getElementById('cropModal');
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  const fineSlider = document.getElementById('rngCropFineAngle');
  const fineLabel = document.getElementById('lblCropFineAngle');

  function openCropModal({ asset, transform, cellAspect, onApply }) {
    if (!asset || !asset.img) return;
    currentTarget = { asset, cellAspect: cellAspect || 1, onApply };
    const base = transform || global.PlanarSlicer.createDefaultImageTransform();
    draftTf = {
      ...base,
      crop: base.crop ? { ...base.crop } : { x: 0, y: 0, w: 1, h: 1 }
    };
    cropRatioMode = 'free';
    updateRatioButtonsUI();
    fineSlider.value = draftTf.fineAngle || 0;
    fineLabel.textContent = `${draftTf.fineAngle || 0}°`;

    modalEl.classList.add('open');
    renderCropStage();
  }

  function closeCropModal() {
    modalEl.classList.remove('open');
    currentTarget = null;
    dragState = null;
  }

  function updateRatioButtonsUI() {
    document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cratio === cropRatioMode);
    });
  }

  function getDesiredRatioNumeric() {
    if (!currentTarget) return null;
    if (cropRatioMode === 'free') return null;
    if (cropRatioMode === 'cell') return currentTarget.cellAspect || 1;
    const parts = cropRatioMode.split(':').map(Number);
    if (parts.length === 2 && parts[1]) return parts[0] / parts[1];
    return null;
  }

  function applyAspectConstraintToCrop() {
    const ratio = getDesiredRatioNumeric();
    if (!ratio || !currentTarget) return;
    const img = currentTarget.asset.img;
    const swapped = (draftTf.rot90 === 90 || draftTf.rot90 === 270);
    const effW = swapped ? img.naturalHeight : img.naturalWidth;
    const effH = swapped ? img.naturalWidth : img.naturalHeight;

    // 在归一化 crop 空间换算目标宽高
    const c = draftTf.crop;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    let pixelW = c.w * effW;
    let pixelH = pixelW / ratio;
    if (pixelH > effH) {
      pixelH = effH * 0.9;
      pixelW = pixelH * ratio;
    }
    if (pixelW > effW) {
      pixelW = effW * 0.9;
      pixelH = pixelW / ratio;
    }
    const nw = Math.min(1, pixelW / effW);
    const nh = Math.min(1, pixelH / effH);
    draftTf.crop = {
      x: Math.max(0, Math.min(1 - nw, cx - nw / 2)),
      y: Math.max(0, Math.min(1 - nh, cy - nh / 2)),
      w: nw,
      h: nh
    };
  }

  function renderCropStage() {
    if (!currentTarget || !currentTarget.asset) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, W, H);

    const img = currentTarget.asset.img;
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const rot90 = ((draftTf.rot90 || 0) % 360 + 360) % 360;
    const swapped = rot90 === 90 || rot90 === 270;
    const dispNatW = swapped ? natH : natW;
    const dispNatH = swapped ? natW : natH;

    const pad = 34;
    const fitScale = Math.min((W - pad * 2) / dispNatW, (H - pad * 2) / dispNatH);
    const dw = dispNatW * fitScale;
    const dh = dispNatH * fitScale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    imgDrawRect = { x: dx, y: dy, w: dw, h: dh };

    // 绘制变换后的完整原图
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(((rot90 + (draftTf.fineAngle || 0)) * Math.PI) / 180);
    ctx.scale(draftTf.flipX ? -1 : 1, draftTf.flipY ? -1 : 1);
    const rawW = natW * fitScale;
    const rawH = natH * fitScale;
    ctx.drawImage(img, -rawW / 2, -rawH / 2, rawW, rawH);
    ctx.restore();

    // 暗化裁剪框外部区域
    const c = draftTf.crop;
    const rx = dx + c.x * dw;
    const ry = dy + c.y * dh;
    const rw = c.w * dw;
    const rh = c.h * dh;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(rx, ry, rw, rh);
    ctx.fill('evenodd');

    // 绘制裁剪框与三分构图线
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + rw / 3, ry); ctx.lineTo(rx + rw / 3, ry + rh);
    ctx.moveTo(rx + (rw * 2) / 3, ry); ctx.lineTo(rx + (rw * 2) / 3, ry + rh);
    ctx.moveTo(rx, ry + rh / 3); ctx.lineTo(rx + rw, ry + rh / 3);
    ctx.moveTo(rx, ry + (rh * 2) / 3); ctx.lineTo(rx + rw, ry + (rh * 2) / 3);
    ctx.stroke();

    // 四角手柄
    const handles = [
      [rx, ry], [rx + rw, ry],
      [rx + rw, ry + rh], [rx, ry + rh]
    ];
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - 6, hy - 6, 12, 12);
      ctx.strokeRect(hx - 6, hy - 6, 12, 12);
    }
    ctx.restore();
  }

  function getCanvasMouse(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!currentTarget) return;
    const pt = getCanvasMouse(e);
    const { x: dx, y: dy, w: dw, h: dh } = imgDrawRect;
    const c = draftTf.crop;
    const rx = dx + c.x * dw;
    const ry = dy + c.y * dh;
    const rw = c.w * dw;
    const rh = c.h * dh;

    const corners = [
      { mode: 'nw', x: rx, y: ry },
      { mode: 'ne', x: rx + rw, y: ry },
      { mode: 'se', x: rx + rw, y: ry + rh },
      { mode: 'sw', x: rx, y: ry + rh }
    ];
    for (const cn of corners) {
      if (Math.hypot(pt.x - cn.x, pt.y - cn.y) <= 12) {
        dragState = { mode: cn.mode, startPt: pt, startCrop: { ...c } };
        return;
      }
    }

    if (pt.x >= rx && pt.x <= rx + rw && pt.y >= ry && pt.y <= ry + rh) {
      dragState = { mode: 'move', startPt: pt, startCrop: { ...c } };
    } else {
      // 在新位置直接拉出新裁剪框
      const nx = Math.max(0, Math.min(0.95, (pt.x - dx) / dw));
      const ny = Math.max(0, Math.min(0.95, (pt.y - dy) / dh));
      draftTf.crop = { x: nx, y: ny, w: 0.05, h: 0.05 };
      dragState = { mode: 'se', startPt: pt, startCrop: { ...draftTf.crop } };
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragState || !currentTarget) return;
    const pt = getCanvasMouse(e);
    const { w: dw, h: dh } = imgDrawRect;
    const deltaX = (pt.x - dragState.startPt.x) / dw;
    const deltaY = (pt.y - dragState.startPt.y) / dh;
    const sc = dragState.startCrop;
    const minSize = 0.06;

    if (dragState.mode === 'move') {
      draftTf.crop.x = Math.max(0, Math.min(1 - sc.w, sc.x + deltaX));
      draftTf.crop.y = Math.max(0, Math.min(1 - sc.h, sc.y + deltaY));
    } else {
      let x0 = sc.x, y0 = sc.y, x1 = sc.x + sc.w, y1 = sc.y + sc.h;
      if (dragState.mode.includes('w')) x0 = Math.max(0, Math.min(x1 - minSize, sc.x + deltaX));
      if (dragState.mode.includes('e')) x1 = Math.min(1, Math.max(x0 + minSize, sc.x + sc.w + deltaX));
      if (dragState.mode.includes('n')) y0 = Math.max(0, Math.min(y1 - minSize, sc.y + deltaY));
      if (dragState.mode.includes('s')) y1 = Math.min(1, Math.max(y0 + minSize, sc.y + sc.h + deltaY));

      let nw = x1 - x0;
      let nh = y1 - y0;
      const ratio = getDesiredRatioNumeric();
      if (ratio) {
        const img = currentTarget.asset.img;
        const swapped = (draftTf.rot90 === 90 || draftTf.rot90 === 270);
        const effW = swapped ? img.naturalHeight : img.naturalWidth;
        const effH = swapped ? img.naturalWidth : img.naturalHeight;
        nh = Math.min(1 - y0, (nw * effW) / (ratio * effH));
        nw = (nh * effH * ratio) / effW;
      }
      draftTf.crop = { x: x0, y: y0, w: Math.max(minSize, nw), h: Math.max(minSize, nh) };
    }
    renderCropStage();
  });

  window.addEventListener('mouseup', () => {
    dragState = null;
  });

  // 绑定按钮事件
  document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cropRatioMode = btn.dataset.cratio;
      updateRatioButtonsUI();
      applyAspectConstraintToCrop();
      renderCropStage();
    });
  });

  document.getElementById('btnCropRotLeft').addEventListener('click', () => {
    if (!draftTf) return;
    draftTf.rot90 = ((draftTf.rot90 || 0) - 90 + 360) % 360;
    renderCropStage();
  });

  document.getElementById('btnCropRotRight').addEventListener('click', () => {
    if (!draftTf) return;
    draftTf.rot90 = ((draftTf.rot90 || 0) + 90) % 360;
    renderCropStage();
  });

  document.getElementById('btnCropFlipH').addEventListener('click', () => {
    if (!draftTf) return;
    draftTf.flipX = !draftTf.flipX;
    renderCropStage();
  });

  document.getElementById('btnCropFlipV').addEventListener('click', () => {
    if (!draftTf) return;
    draftTf.flipY = !draftTf.flipY;
    renderCropStage();
  });

  fineSlider.addEventListener('input', () => {
    if (!draftTf) return;
    draftTf.fineAngle = parseFloat(fineSlider.value) || 0;
    fineLabel.textContent = `${draftTf.fineAngle}°`;
    renderCropStage();
  });

  document.getElementById('btnResetCropAngle').addEventListener('click', () => {
    if (!draftTf) return;
    draftTf.fineAngle = 0;
    fineSlider.value = 0;
    fineLabel.textContent = '0°';
    renderCropStage();
  });

  document.getElementById('btnResetFullCrop').addEventListener('click', () => {
    if (!draftTf) return;
    draftTf.crop = { x: 0, y: 0, w: 1, h: 1 };
    draftTf.rot90 = 0;
    draftTf.fineAngle = 0;
    draftTf.flipX = false;
    draftTf.flipY = false;
    fineSlider.value = 0;
    fineLabel.textContent = '0°';
    renderCropStage();
  });

  document.getElementById('btnCloseCropModal').addEventListener('click', closeCropModal);
  document.getElementById('btnCancelCrop').addEventListener('click', closeCropModal);
  document.getElementById('btnApplyCrop').addEventListener('click', () => {
    if (currentTarget && currentTarget.onApply) {
      const isFull =
        draftTf.crop.x <= 0.002 &&
        draftTf.crop.y <= 0.002 &&
        draftTf.crop.w >= 0.996 &&
        draftTf.crop.h >= 0.996;
      currentTarget.onApply({
        ...draftTf,
        scale: 1,
        panX: 0,
        panY: 0,
        crop: isFull ? null : { ...draftTf.crop }
      });
    }
    closeCropModal();
  });

  global.CropModal = {
    open: openCropModal,
    close: closeCropModal
  };
})(window);
