(function () {
  // =========================================================================
  // Prism Collage Studio v2 主控制器 (无限画布 + 唯一总外框 + 按需折叠界面)
  // =========================================================================

  const FREE_FRAME_SHAPES = [
    { id: 'rect', name: '矩形相框', icon: '<rect x="4" y="6" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'circle', name: '圆形相框', icon: '<circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'polaroid', name: '拍立得卡', icon: '<rect x="5" y="3" width="18" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="5" y1="19" x2="23" y2="19" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'slant-left', name: '左斜切条', icon: '<polygon points="8,5 25,5 20,23 3,23" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'slant-right', name: '右斜切条', icon: '<polygon points="3,5 20,5 25,23 8,23" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'diamond', name: '菱形框', icon: '<polygon points="14,3 25,14 14,25 3,14" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'hexagon', name: '六边形框', icon: '<polygon points="14,3 24,8.5 24,19.5 14,25 4,19.5 4,8.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'heart', name: '爱心相框', icon: '<path d="M14 23 C14 23 4 16 4 10 C4 6.8 6.8 4.5 9.8 4.5 C11.8 4.5 13.3 5.5 14 7 C14.7 5.5 16.2 4.5 18.2 4.5 C21.2 4.5 24 6.8 24 10 C24 16 14 23 14 23 Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'star', name: '星形相框', icon: '<polygon points="14,3 17,10 25,10.8 19,16 20.8,24 14,19.8 7.2,24 9,16 3,10.8 11,10" fill="none" stroke="currentColor" stroke-width="2"/>' }
  ];

  const DRAWER_TITLES = {
    assets: '素材与模板库',
    contour: '画布与唯一外框',
    slicer: '分镜与特效切分',
    frames: '相框与特写放大镜',
    stickers: '贴饰与台词气泡',
    creative: '创意玩法 · 人物剪影框',
    settings: '外观与画风设置'
  };

  const TOOL_HINTS = {
    'select': '选择模式：按住空格或中键平移画布；在图片上直接拖动调整选区，滚轮缩放图片',
    'hand': '抓手平移模式：在画布任意位置按住左键直接拖动视野，Ctrl + 滚轮缩放视图',
    'cut-line': '直线/折线刀：跨边界拉线切开；中间单击拐弯续画，中间双击暂存半截刀口(T/Y交汇)',
    'cut-curve': '曲线刀：拖出一段线后拉动青色控制柄调出 C 弧或 S 波浪线；也可逐点画多段曲线',
    'cut-free': '手绘平滑刀：按住鼠标自由画弯曲刀路，松手自动平滑；首尾靠近自动闭合挖洞成格',
    'shatter-impact': '放射裂纹切分：点击画布任意焦点位置作为中心，自动生成放射状碎裂分镜',
    'shatter-slash': '斜向裂纹切分：按住鼠标划出一道主分割线，两侧自动生成斜向碎裂分镜',
    'contour-pen': '手绘唯一总外框：在无限画布任意位置点击锚点（或按住圈选），闭合即设为新总外框',
    'sticker': '贴饰防误触模式：底层照片与相框已锁定，左键拖动只移动小贴饰，方向键可 1px 微调'
  };

  const mainCanvas = document.getElementById('mainCanvas');
  const viewportEl = document.getElementById('canvasViewport');
  const floatingInspectorEl = document.getElementById('floatingInspector');
  const floatingFrameBarEl = document.getElementById('floatingFrameBar');

  const state = {
    theme: 'dark',
    uiTheme: 'pro-dark',         // 'pro-dark' | 'oshi-neon' | 'creamy-light'
    oshiPrimary: '#a855f7',
    oshiSecondary: '#ec4899',
    uiPrefs: {
      customAccent: null,        // null = 跟随主题 | '#rrggbb' = 手动强调色
      glassAlpha: 80,            // 55 ~ 96 (%)
      showCanvasGrid: true,
      showStageAura: true,
      motionSpeed: 'smooth'      // 'smooth' | 'fast' | 'none'
    },
    pickingMangaFocusCellId: null,
    tool: 'select',              // 'select' | 'hand' | 'cut-line' | 'cut-curve' | 'cut-free' | 'contour-pen'
    lastCutTool: 'cut-line',
    contourSubMode: 'poly',      // 'poly' | 'free'
    activeDrawer: 'assets',
    drawerCollapsed: false,
    rightDockCollapsed: false,
    rightDockView: 'split',      // 'split' | 'inspector' | 'layers'
    spacePressed: false,

    editingContourNodes: false,
    frameEditImageMode: true,    // 选中含图自由相框时：true=左键拖动框内图片区域，false=左键移动相框位置
    autoExtend: false,
    showXRayGhost: true,
    showSlotLabels: true,

    // 无限画布相机状态 (世界坐标单位 = 导出像素)
    camX: 960,
    camY: 540,
    camZoom: 0.5,

    // 无限画布中唯一的总外框世界包围盒 (保存时只保存此外框内的内容)
    frameWorld: { x: 0, y: 0, w: 1920, h: 1080 },
    canvasW: 1920,
    canvasH: 1080,
    hideBaseCells: false,

    contour: {
      type: 'rect',
      keepAspect: true,
      baseAspect: 16 / 9,
      customPoints: []
    },

    style: {
      bgMode: 'solid',
      bgColor1: '#0f172a',
      bgColor2: '#1e293b',
      gradAngle: 135,
      gutter: 14,
      margin: 18,
      cellBorder: 4,
      cellBorderColor: '#ffffff',
      outerStroke: 0,
      outerStrokeColor: '#ffffff',
      edgeStyle: 'classic',
      refractStrength: 0,
      globalTone: 'none',
      vignette: 0,
      grain: 0
    },

    cuts: [
      { id: 'init_c1', mode: 'line', points: [{ x: 0.38, y: 0 }, { x: 0.27, y: 1 }], closed: false, autoExtend: true },
      { id: 'init_c2', mode: 'line', points: [{ x: 0.73, y: 0 }, { x: 0.62, y: 1 }], closed: false, autoExtend: true }
    ],

    topology: {
      outerPoly: [],
      cells: [],
      activeInternalSegments: [],
      danglingEdges: [],
      sampledCutPolylines: []
    },

    freeFrames: [],
    stickers: [],
    loupes: [],
    texts: [],
    nextZOrder: 50,

    assets: [],
    assetMap: new Map(),
    customStickers: [],          // { id, name, dataUrl, rawDataUrl, width, height }
    customStickerMap: new Map(), // id -> { ...item, img }
    customTemplates: [],
    activeTplCategory: 'all',
    systemFonts: ['Microsoft YaHei UI', 'Microsoft YaHei', 'SimHei', 'KaiTi', 'SimSun', 'Arial', 'Impact', 'Georgia'],

    selection: null,
    draft: null,
    dragAction: null,
    dragHoverTarget: null,

    history: [],
    historyIndex: -1
  };

  function showToast(msg) {
    const box = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 220);
    }, 2800);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==================== 三套自定义 UI 主题切换 & 角色应援色实时注入 ====================
  function hexToRgbaStr(hex, alpha) {
    const clean = String(hex || '#a855f7').replace('#', '');
    if (clean.length !== 6) return `rgba(168, 85, 247, ${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16) || 168;
    const g = parseInt(clean.slice(2, 4), 16) || 85;
    const b = parseInt(clean.slice(4, 6), 16) || 247;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function syncOshiLiveCssVars(primaryHex, secondaryHex) {
    const p = primaryHex || state.oshiPrimary || '#a855f7';
    const s = secondaryHex || state.oshiSecondary || '#ec4899';
    state.oshiPrimary = p;
    state.oshiSecondary = s;
    const root = document.documentElement;
    root.style.setProperty('--oshi-primary', p);
    root.style.setProperty('--oshi-secondary', s);
    root.style.setProperty('--oshi-soft', hexToRgbaStr(p, 0.19));
    root.style.setProperty('--oshi-border', hexToRgbaStr(p, 0.50));
    root.style.setProperty('--oshi-glow', hexToRgbaStr(p, 0.36));
  }

  function applyUITheme(themeId, silent = false) {
    const valid = ['pro-dark', 'oshi-neon', 'creamy-light'].includes(themeId) ? themeId : 'pro-dark';
    state.uiTheme = valid;
    state.theme = valid === 'creamy-light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-ui-theme', valid);
    document.documentElement.setAttribute('data-theme', state.theme);

    document.querySelectorAll('#uiThemeSwitcher [data-ui-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.uiTheme === valid);
    });

    try { localStorage.setItem('prism_ui_theme', valid); } catch (e) {}
    requestRender();

    if (!silent) {
      const names = {
        'pro-dark': '已切换为「深色毛玻璃」界面风格',
        'oshi-neon': '已切换为「动态氛围色」界面风格',
        'creamy-light': '已切换为「浅色亚克力」界面风格'
      };
      showToast(names[valid]);
    }
  }

  function applyUIPrefsToDOM(save = true) {
    const prefs = state.uiPrefs;
    const root = document.documentElement;
    root.style.setProperty('--glass-alpha', ((prefs.glassAlpha ?? 80) / 100).toFixed(2));
    root.setAttribute('data-motion', prefs.motionSpeed || 'smooth');

    if (prefs.customAccent) {
      root.setAttribute('data-custom-accent', 'on');
      root.style.setProperty('--user-accent', prefs.customAccent);
      root.style.setProperty('--user-accent-soft', hexToRgbaStr(prefs.customAccent, 0.16));
      root.style.setProperty('--user-accent-border', hexToRgbaStr(prefs.customAccent, 0.45));
    } else {
      root.removeAttribute('data-custom-accent');
    }

    // 同步左下角风格设置面板 UI 状态
    const rngAlpha = document.getElementById('rngGlassAlpha');
    if (rngAlpha) {
      rngAlpha.value = prefs.glassAlpha ?? 80;
      document.getElementById('lblGlassAlpha').textContent = `${prefs.glassAlpha ?? 80}%`;
    }
    const chkGrid = document.getElementById('chkShowCanvasGrid');
    if (chkGrid) chkGrid.checked = prefs.showCanvasGrid !== false;
    const chkAura = document.getElementById('chkShowStageAura');
    if (chkAura) chkAura.checked = prefs.showStageAura !== false;

    document.querySelectorAll('.accent-preset-dot').forEach(dot => {
      dot.classList.toggle('active', prefs.customAccent && dot.dataset.accent.toLowerCase() === prefs.customAccent.toLowerCase());
    });
    const inpAcc = document.getElementById('inpCustomAccent');
    if (inpAcc && prefs.customAccent) inpAcc.value = prefs.customAccent;

    document.querySelectorAll('#motionSpeedGroup [data-motion]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.motion === (prefs.motionSpeed || 'smooth'));
    });

    if (save) {
      try { localStorage.setItem('prism_ui_prefs_v1', JSON.stringify(prefs)); } catch (e) {}
    }
    requestRender();
  }

  // ==================== 左侧模块抽屉、内部胶囊子页签与指针工具联动（带阻尼推拉动效） ====================
  const RAIL_ORDER = ['assets', 'contour', 'slicer', 'frames', 'stickers', 'creative', 'settings'];

  function switchDrawerSubTab(groupName, subtabId) {
    const tabBar = document.querySelector(`.seg-tabs[data-tab-group="${groupName}"]`);
    const pane = document.getElementById(`pane-${groupName}`);
    if (!tabBar || !pane) return;

    const tabs = Array.from(tabBar.querySelectorAll('.seg-tab'));
    const prevIdx = tabs.findIndex(b => b.classList.contains('active'));
    const nextIdx = tabs.findIndex(b => b.dataset.subtab === subtabId);
    const dir = (prevIdx >= 0 && nextIdx >= 0 && nextIdx < prevIdx) ? 'left' : 'right';

    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === subtabId);
    });
    pane.querySelectorAll('.subtab-panel').forEach(panel => {
      const isTarget = panel.dataset.subpanel === subtabId;
      if (isTarget && prevIdx !== nextIdx) {
        panel.dataset.tabDir = dir;
        panel.classList.remove('active');
        void panel.offsetWidth; // 触发顺滑水平推入重绘
      }
      panel.classList.toggle('active', isTarget);
    });
  }

  function openDrawer(drawerName, toggleIfSame = false) {
    // 兼容旧合并模块自动路由到对应子页签
    if (drawerName === 'templates') {
      openDrawer('assets', false);
      switchDrawerSubTab('assets', 'assets-tpl');
      return;
    }
    if (drawerName === 'text') {
      openDrawer('stickers', false);
      switchDrawerSubTab('stickers', 'stickers-dialogue');
      return;
    }
    if (drawerName === 'layers') {
      setRightDockCollapsed(false);
      return;
    }

    const drawerEl = document.getElementById('contextDrawer');
    if (toggleIfSame && state.activeDrawer === drawerName && !state.drawerCollapsed) {
      state.drawerCollapsed = true;
      drawerEl.classList.add('collapsed');
      document.querySelectorAll('#leftIconRail .rail-btn').forEach(b => b.classList.remove('active'));
      requestRender();
      return;
    }

    const wasOpen = !state.drawerCollapsed;
    const prevDrawer = state.activeDrawer;
    const isSwitchingModule = wasOpen && prevDrawer !== drawerName;
    const prevIdx = RAIL_ORDER.indexOf(prevDrawer);
    const nextIdx = RAIL_ORDER.indexOf(drawerName);
    const slideDir = (prevIdx >= 0 && nextIdx >= 0 && nextIdx < prevIdx) ? 'down' : 'up';

    state.activeDrawer = drawerName;
    state.drawerCollapsed = false;
    drawerEl.classList.remove('collapsed');

    const titleEl = document.getElementById('drawerTitle');
    titleEl.textContent = DRAWER_TITLES[drawerName] || '';

    if (isSwitchingModule) {
      drawerEl.classList.remove('swap-detent');
      titleEl.classList.remove('title-glide');
      void drawerEl.offsetWidth;
      drawerEl.classList.add('swap-detent');
      titleEl.classList.add('title-glide');
    }

    document.querySelectorAll('#leftIconRail .rail-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.drawer === drawerName);
    });
    document.querySelectorAll('.drawer-pane').forEach(p => {
      const isTarget = p.id === `pane-${drawerName}`;
      if (isTarget && isSwitchingModule) {
        p.dataset.slideDir = slideDir;
        p.classList.remove('active');
        void p.offsetWidth;
      }
      p.classList.toggle('active', isTarget);
    });
    requestRender();
  }

  function setRightDockCollapsed(collapsed) {
    state.rightDockCollapsed = !!collapsed;
    const dockEl = document.getElementById('rightDock');
    const expandBtn = document.getElementById('btnExpandRightDock');
    if (dockEl) dockEl.classList.toggle('collapsed', state.rightDockCollapsed);
    if (expandBtn) expandBtn.classList.toggle('visible', state.rightDockCollapsed);
    requestRender();
  }

  function setActiveTool(toolName, autoSyncDrawer = true) {
    state.tool = toolName;
    state.draft = null;
    if (toolName === 'cut-line' || toolName === 'cut-curve' || toolName === 'cut-free' || toolName.startsWith('shatter-')) {
      state.lastCutTool = toolName;
    }
    if (toolName !== 'contour-pen') {
      state.editingContourNodes = false;
    }

    // 同步画布顶部指针胶囊岛激活态
    const isCut = toolName.startsWith('cut-') || toolName.startsWith('shatter-');
    document.querySelectorAll('#mainToolStrip .tool-btn').forEach(btn => {
      const t = btn.dataset.tool;
      btn.classList.toggle('active', t === toolName || (t === 'cut-group' && isCut));
    });

    // 同步切割抽屉内的子刀按钮
    document.querySelectorAll('.slice-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cutTool === toolName);
    });

    // 选择对应工具时自动打开对应模块与精准子页签！
    if (autoSyncDrawer) {
      if (toolName.startsWith('shatter-')) {
        openDrawer('slicer', false);
        switchDrawerSubTab('slicer', 'slicer-shatter');
      } else if (isCut) {
        openDrawer('slicer', false);
        switchDrawerSubTab('slicer', 'slicer-basic');
      } else if (toolName === 'contour-pen') {
        openDrawer('contour', false);
        switchDrawerSubTab('contour', 'contour-draw');
      } else if (toolName === 'sticker') {
        openDrawer('stickers', false);
      }
    }

    document.getElementById('toolHintText').textContent = TOOL_HINTS[toolName] || TOOL_HINTS.select;
    updateCursorStyle();
    updateFloatingFrameBarPosition();
    requestRender();
  }

  function updateCursorStyle() {
    if (state.dragAction && state.dragAction.type === 'pan-camera') {
      mainCanvas.style.cursor = 'grabbing';
    } else if (state.spacePressed || state.tool === 'hand') {
      mainCanvas.style.cursor = 'grab';
    } else if (state.pickingMangaFocusCellId) {
      mainCanvas.style.cursor = 'crosshair';
    } else if (state.tool === 'select' || state.tool === 'sticker') {
      mainCanvas.style.cursor = 'default';
    } else {
      mainCanvas.style.cursor = 'crosshair';
    }
  }

  // ==================== 无限画布坐标转换 ====================
  function getPointerCoords(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const vpW = Math.max(1, rect.width);
    const vpH = Math.max(1, rect.height);

    // 屏幕像素 -> 无限画布世界坐标 (wx, wy)
    const wx = state.camX + (vx - vpW * 0.5) / state.camZoom;
    const wy = state.camY + (vy - vpH * 0.5) / state.camZoom;

    // 世界坐标 -> 唯一总外框内部局部坐标 (fx, fy) 与归一化比例 (nx, ny)
    const fw = state.frameWorld;
    const fx = wx - fw.x;
    const fy = wy - fw.y;
    const nx = fx / Math.max(1, fw.w);
    const ny = fy / Math.max(1, fw.h);

    return { vx, vy, vpW, vpH, wx, wy, fx, fy, nx, ny };
  }

  function worldToViewportScreen(wx, wy) {
    const vpW = mainCanvas.clientWidth;
    const vpH = mainCanvas.clientHeight;
    return {
      vx: vpW * 0.5 + (wx - state.camX) * state.camZoom,
      vy: vpH * 0.5 + (wy - state.camY) * state.camZoom
    };
  }

  function fitCameraToOuterFrame() {
    const leftOcc = state.drawerCollapsed ? 80 : 386;
    const rightOcc = state.rightDockCollapsed ? 20 : 302;
    const availW = Math.max(260, mainCanvas.clientWidth - leftOcc - rightOcc - 52);
    const availH = Math.max(200, mainCanvas.clientHeight - 138);
    const fw = state.frameWorld;
    state.camZoom = Math.min(availW / fw.w, availH / fw.h, 1.25);

    const visualCenterX = leftOcc + (mainCanvas.clientWidth - leftOcc - rightOcc) * 0.5;
    const screenOffsetX = visualCenterX - mainCanvas.clientWidth * 0.5;
    state.camX = fw.x + fw.w * 0.5 - screenOffsetX / state.camZoom;
    state.camY = fw.y + fw.h * 0.5 - 6 / state.camZoom;
    updateZoomHudUI();
    updateFloatingFrameBarPosition();
    requestRender();
  }

  function updateZoomHudUI() {
    document.getElementById('zoomPercentLabel').textContent = `${Math.round(state.camZoom * 100)}%`;
    document.getElementById('canvasDimBadge').textContent = `${state.canvasW} × ${state.canvasH} px`;
  }

  // ==================== 历史撤销 / 重做 ====================
  function captureSnapshot() {
    return JSON.stringify({
      frameWorld: state.frameWorld,
      canvasW: state.canvasW,
      canvasH: state.canvasH,
      nextZOrder: state.nextZOrder || 50,
      hideBaseCells: state.hideBaseCells,
      contour: state.contour,
      style: state.style,
      cuts: state.cuts,
      cellsMeta: state.topology.cells.map(c => ({
        id: c.id,
        repNorm: { x: c.repPt.x / state.canvasW, y: c.repPt.y / state.canvasH },
        slotLabel: c.slotLabel,
        slotOrder: c.slotOrder,
        visible: c.visible !== false,
        locked: !!c.locked,
        assetId: c.assetId,
        fx: c.fx,
        transform: c.transform
      })),
      freeFrames: state.freeFrames,
      stickers: state.stickers,
      loupes: state.loupes,
      texts: state.texts
    });
  }

  function allocZOrder() {
    state.nextZOrder = (state.nextZOrder || 50) + 1;
    return state.nextZOrder;
  }

  function getAllOverlayEntriesSortedDesc() {
    const entries = [];
    for (const ff of state.freeFrames) {
      if (ff.zOrder == null) ff.zOrder = allocZOrder();
      entries.push({ kind: 'frame', item: ff, z: ff.zOrder });
    }
    for (const st of state.stickers) {
      if (st.zOrder == null) st.zOrder = allocZOrder();
      entries.push({ kind: 'sticker', item: st, z: st.zOrder });
    }
    for (const lp of state.loupes) {
      if (lp.zOrder == null) lp.zOrder = allocZOrder();
      entries.push({ kind: 'loupe', item: lp, z: lp.zOrder });
    }
    for (const txt of state.texts) {
      if (txt.zOrder == null) txt.zOrder = allocZOrder();
      entries.push({ kind: 'text', item: txt, z: txt.zOrder });
    }
    return entries.sort((a, b) => b.z - a.z); // 顶层在前
  }

  function pushHistory() {
    const snap = captureSnapshot();
    if (state.historyIndex >= 0 && state.history[state.historyIndex] === snap) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snap);
    if (state.history.length > 45) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
    renderLayerManagerUI();
  }

  function rehydrateSilhouetteMetaImages() {
    const metas = [];
    if (state.contour && state.contour.silhouetteMeta) metas.push(state.contour.silhouetteMeta);
    for (const ff of (state.freeFrames || [])) {
      if (ff.silhouetteMeta) metas.push(ff.silhouetteMeta);
    }
    for (const m of metas) {
      m.heroKeepImg = null;
      if (m.heroKeepDataUrl) {
        loadImageElement(m.heroKeepDataUrl).then(im => {
          m.heroKeepImg = im;
          requestRender();
        });
      }
    }
  }

  function restoreSnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    state.canvasW = data.canvasW || 1920;
    state.canvasH = data.canvasH || 1080;
    state.nextZOrder = data.nextZOrder || 50;
    state.frameWorld = data.frameWorld || { x: 0, y: 0, w: state.canvasW, h: state.canvasH };
    state.hideBaseCells = !!data.hideBaseCells;
    state.contour = data.contour;
    state.style = data.style;
    state.cuts = data.cuts || [];
    state.freeFrames = data.freeFrames || [];
    state.stickers = data.stickers || [];
    state.loupes = data.loupes || [];
    state.texts = data.texts || [];
    rehydrateSilhouetteMetaImages();

    const prevStubs = (data.cellsMeta || []).map(m => ({
      id: m.id,
      outer: [
        { x: m.repNorm.x * state.canvasW - 2, y: m.repNorm.y * state.canvasH - 2 },
        { x: m.repNorm.x * state.canvasW + 2, y: m.repNorm.y * state.canvasH - 2 },
        { x: m.repNorm.x * state.canvasW + 2, y: m.repNorm.y * state.canvasH + 2 },
        { x: m.repNorm.x * state.canvasW - 2, y: m.repNorm.y * state.canvasH + 2 }
      ],
      holes: [],
      repPt: { x: m.repNorm.x * state.canvasW, y: m.repNorm.y * state.canvasH },
      slotLabel: m.slotLabel,
      slotOrder: m.slotOrder,
      visible: m.visible !== false,
      locked: !!m.locked,
      assetId: m.assetId,
      fx: m.fx,
      transform: m.transform
    }));
    rebuildTopology(prevStubs);
    syncGlobalControlsFromState();
    updateZoomHudUI();
    renderSelectionInspector();
    renderLayerManagerUI();
    updateFloatingFrameBarPosition();
    requestRender();
    updateUndoRedoButtons();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      restoreSnapshot(state.history[state.historyIndex]);
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      restoreSnapshot(state.history[state.historyIndex]);
    }
  }

  function updateUndoRedoButtons() {
    document.getElementById('btnUndo').disabled = state.historyIndex <= 0;
    document.getElementById('btnRedo').disabled = state.historyIndex >= state.history.length - 1;
  }

  // ==================== 拓扑重算与渲染调度 ====================
  function rebuildTopology(overridePrevCells = null) {
    state.canvasW = Math.max(60, Math.round(state.frameWorld.w));
    state.canvasH = Math.max(60, Math.round(state.frameWorld.h));
    const outerPoly = window.SilhouetteEngine.buildOuterContourPolygon(state.contour, state.canvasW, state.canvasH);
    const prev = overridePrevCells || state.topology.cells || [];
    const solved = window.PlanarSlicer.solvePlanarSubdivision(outerPoly, state.cuts, state.canvasW, state.canvasH, prev);
    state.topology = {
      outerPoly,
      ...solved
    };
    renderCutListUI();
    renderAssetGridUI();
    renderLayerManagerUI();
  }

  let rafPending = false;
  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      renderAll();
    });
  }

  function renderAll() {
    const res = window.CollageRenderer.renderInfiniteViewport(mainCanvas, state);
    const pill = document.getElementById('dpiWarningPill');
    const txt = document.getElementById('dpiWarningText');
    if (res && res.selectedDpiWarning) {
      pill.classList.add('visible');
      txt.textContent = `放大率 ${res.selectedDpiWarning.pct}%（超出原图物理像素，导出可能轻微模糊）`;
    } else {
      pill.classList.remove('visible');
    }
    updateFloatingFrameBarPosition();
  }

  // 更新自由相框上方的画布内快捷切换条位置
  function updateFloatingFrameBarPosition() {
    if (state.tool === 'select' && state.selection && state.selection.type === 'frame') {
      const ff = state.freeFrames.find(f => f.id === state.selection.id);
      if (ff) {
        const fw = state.frameWorld;
        const cx = fw.x + ff.x * fw.w;
        const cy = fw.y + ff.y * fw.h;
        const halfH = (ff.h * fw.h) * 0.5;
        const scr = worldToViewportScreen(cx, cy - halfH);

        floatingFrameBarEl.classList.add('visible');
        floatingFrameBarEl.style.left = `${ Math.max(130, Math.min(mainCanvas.clientWidth - 150, scr.vx)) }px`;
        floatingFrameBarEl.style.top = `${ Math.max(54, scr.vy - 30) }px`;

        const hasImg = !!ff.assetId;
        document.getElementById('btnModePanFrameImg').style.display = hasImg ? 'inline-flex' : 'none';
        document.getElementById('btnQuickCropFrame').style.display = hasImg ? 'inline-flex' : 'none';
        document.getElementById('btnModeMoveFrame').classList.toggle('btn-primary', !state.frameEditImageMode || !hasImg);
        document.getElementById('btnModePanFrameImg').classList.toggle('btn-primary', state.frameEditImageMode && hasImg);
        const followBtn = document.getElementById('btnToggleFrameFollowCell');
        if (followBtn) followBtn.classList.toggle('btn-primary', !!ff.followHostCell);
        return;
      }
    }
    floatingFrameBarEl.classList.remove('visible');
  }

  // ==================== 图片导入与智能分配（填入后自动进入选区构图模式！） ====================
  async function importImagePayloads(payloads) {
    const addedAssets = [];
    for (const item of payloads) {
      if (!item || !item.dataUrl) continue;
      const img = await loadImageElement(item.dataUrl);
      if (!img) continue;
      const asset = {
        id: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: item.name || '未命名图片',
        dataUrl: item.dataUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        img
      };
      state.assets.push(asset);
      state.assetMap.set(asset.id, asset);
      addedAssets.push(asset);
    }
    if (addedAssets.length > 0) {
      renderAssetGridUI();
      renderOshiPaletteUI();
      showToast(`已导入 ${addedAssets.length} 张图片素材`);
    }
    return addedAssets;
  }

  function loadImageElement(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function readBrowserFilesAsPayloads(fileList) {
    const promises = Array.from(fileList)
      .filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(f.name))
      .map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      }));
    return Promise.all(promises);
  }

  async function extractDroppedImagePayloads(dataTransfer) {
    if (window.desktopAPI && dataTransfer.files && dataTransfer.files.length > 0) {
      const paths = [];
      for (const f of dataTransfer.files) {
        const p = window.desktopAPI.getPathForFile(f);
        if (p) paths.push(p);
      }
      if (paths.length > 0) {
        const res = await window.desktopAPI.readDroppedPaths(paths);
        if (res && res.length > 0) return res;
      }
    }
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      const list = await readBrowserFilesAsPayloads(dataTransfer.files);
      return list.filter(Boolean);
    }
    return [];
  }

  function countAssetUsage(assetId) {
    let count = 0;
    for (const c of state.topology.cells) if (c.assetId === assetId) count++;
    for (const f of state.freeFrames) {
      if (f.assetId === assetId) count++;
      if (f.silhouetteMeta && f.silhouetteMeta.assetId === assetId) count++;
    }
    if (state.contour && state.contour.silhouetteMeta && state.contour.silhouetteMeta.assetId === assetId) count++;
    return count;
  }

  function renderAssetGridUI() {
    const grid = document.getElementById('assetGrid');
    const info = document.getElementById('assetCountInfo');
    info.textContent = `已导入 ${state.assets.length} 张素材（拖入画布格子/相框，或双击卡片填入）`;

    grid.innerHTML = '';
    for (const ast of state.assets) {
      const used = countAssetUsage(ast.id);
      const card = document.createElement('div');
      card.className = 'asset-card';
      card.draggable = true;
      card.title = `${ast.name} (${ast.width}×${ast.height})\n拖拽到画布格子或相框即可填充`;

      card.innerHTML = `
        <img src="${ast.dataUrl}" alt="${ast.name}" />
        ${used > 0 ? `<span class="asset-used-badge">已用 ×${used}</span>` : ''}
        <button class="asset-del-btn" title="移除素材">✕</button>
        <div class="asset-meta">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:74px;">${ast.name}</span>
          <span>${ast.width}×${ast.height}</span>
        </div>
      `;

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/asset-id', ast.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      card.addEventListener('dblclick', () => assignAssetToSelectedOrFirstEmpty(ast.id));
      card.querySelector('.asset-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeAssetById(ast.id);
      });
      grid.appendChild(card);
    }
    renderCreativePanelUI();
  }

  function removeAssetById(assetId) {
    state.assets = state.assets.filter(a => a.id !== assetId);
    state.assetMap.delete(assetId);
    for (const c of state.topology.cells) if (c.assetId === assetId) c.assetId = null;
    for (const f of state.freeFrames) if (f.assetId === assetId) f.assetId = null;
    pushHistory();
    renderAssetGridUI();
    renderSelectionInspector();
    requestRender();
  }

  // 核心优化：每次把图片放入相框或分镜格后，自动切回「选择/构图」并开启图片区域调节模式！
  function fillImageIntoCell(cell, assetId) {
    cell.assetId = assetId;
    cell.transform = window.PlanarSlicer.createDefaultImageTransform();
    // 若该分镜格范围内已有开启「随所属分镜联动」的自由相框，以当前相框位置为基准绑定新图片坐标系
    if (window.FxLabEngine) {
      for (const ff of state.freeFrames) {
        if (ff.followHostCell) {
          const cx = ff.x * state.canvasW;
          const cy = ff.y * state.canvasH;
          if ((ff.hostCellId === cell.id) || window.PlanarSlicer.pointInCell({ x: cx, y: cy }, cell)) {
            window.FxLabEngine.recordFrameHostAnchor(ff, state);
          }
        }
      }
    }
    setActiveTool('select', false);
    selectItem('cell', cell.id);
  }

  function fillImageIntoFrame(ff, assetId) {
    ff.assetId = assetId;
    ff.transform = window.PlanarSlicer.createDefaultImageTransform();
    state.frameEditImageMode = true; // 填入图片后默认允许直接拖动改变图片显示区域！
    setActiveTool('select', false);
    selectItem('frame', ff.id);
  }

  function assignAssetToSelectedOrFirstEmpty(assetId) {
    if (state.selection && state.selection.type === 'frame') {
      const ff = state.freeFrames.find(f => f.id === state.selection.id);
      if (ff) {
        fillImageIntoFrame(ff, assetId);
        pushHistory();
        renderAssetGridUI();
        return;
      }
    }
    if (state.selection && state.selection.type === 'cell') {
      const cell = state.topology.cells.find(c => c.id === state.selection.id);
      if (cell) {
        fillImageIntoCell(cell, assetId);
        pushHistory();
        renderAssetGridUI();
        return;
      }
    }
    const emptyFrame = state.freeFrames.find(f => !f.assetId);
    if (emptyFrame) {
      fillImageIntoFrame(emptyFrame, assetId);
      pushHistory();
      renderAssetGridUI();
      return;
    }
    const emptyCell = !state.hideBaseCells && state.topology.cells.find(c => !c.assetId);
    if (emptyCell) {
      fillImageIntoCell(emptyCell, assetId);
      pushHistory();
      renderAssetGridUI();
      return;
    }
    // 若全部已填满且只有单格，则替换第一格
    if (!state.hideBaseCells && state.topology.cells.length > 0) {
      fillImageIntoCell(state.topology.cells[0], assetId);
      pushHistory();
      renderAssetGridUI();
    }
  }

  function autoFillEmptySlots(assetsToUse = null) {
    const pool = assetsToUse || state.assets;
    if (!pool.length) return showToast('请先导入图片素材');

    const orderedCells = state.hideBaseCells ? [] : state.topology.cells.slice().sort((a, b) => {
      return (a.slotOrder ?? 9999) - (b.slotOrder ?? 9999);
    });

    let pIdx = 0;
    for (const cell of orderedCells) {
      if (!cell.assetId && pIdx < pool.length) {
        cell.assetId = pool[pIdx++].id;
        cell.transform = window.PlanarSlicer.createDefaultImageTransform();
      }
    }
    for (const ff of state.freeFrames) {
      if (!ff.assetId && pIdx < pool.length) {
        ff.assetId = pool[pIdx++].id;
        ff.transform = window.PlanarSlicer.createDefaultImageTransform();
      }
    }
    setActiveTool('select', false);
    pushHistory();
    renderAssetGridUI();
    requestRender();
  }

  // ==================== 命中测试 (局部外框坐标 fx, fy / nx, ny) ====================
  function hitTestStickerOuterHandles(fx, fy) {
    if (!state.selection || state.selection.type !== 'sticker') return null;
    const st = state.stickers.find(s => s.id === state.selection.id);
    if (!st) return null;

    const invZ = 1 / state.camZoom;
    const pad = 11 * invZ;
    const hw = (st.w * state.canvasW) / 2 + pad;
    const hh = (st.h * state.canvasH) / 2 + pad;
    const cx = st.x * state.canvasW;
    const cy = st.y * state.canvasH;
    const rad = (-(st.rotation || 0) * Math.PI) / 180;
    const dx = fx - cx, dy = fy - cy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    const hitR = 11 * invZ;
    const stemLen = 22 * invZ;

    // 顶部旋转球
    if (Math.hypot(lx, ly - (-hh - stemLen)) <= hitR * 1.25) {
      return { action: 'rotate-sticker', st };
    }
    // 右侧黄胶囊：侧脸透视水平压窄/拉宽
    if (Math.abs(lx - hw) <= hitR && Math.abs(ly) <= 12 * invZ) {
      return { action: 'squash-sticker-x', st };
    }
    // 底侧黄胶囊：垂直压扁/拉高
    if (Math.abs(lx) <= 12 * invZ && Math.abs(ly - hh) <= hitR) {
      return { action: 'squash-sticker-y', st };
    }
    // 四角外置圆点：等比缩放
    const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    for (const [qx, qy] of corners) {
      if (Math.hypot(lx - qx, ly - qy) <= hitR) {
        return {
          action: 'resize-sticker-uniform',
          st,
          startW: st.w,
          startH: st.h,
          startDist: Math.max(8, Math.hypot(dx, dy))
        };
      }
    }
    return null;
  }

  function hitTestSingleSticker(st, fx, fy, extraPadScreen = 6) {
    if (st.visible === false || st.locked) return false;
    const invZ = 1 / state.camZoom;
    const minHalf = 14 * invZ;
    const cx = st.x * state.canvasW;
    const cy = st.y * state.canvasH;
    const rad = (-(st.rotation || 0) * Math.PI) / 180;
    const dx = fx - cx, dy = fy - cy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    const hw = Math.max(minHalf, (st.w * state.canvasW) / 2 + extraPadScreen * invZ);
    const hh = Math.max(minHalf, (st.h * state.canvasH) / 2 + extraPadScreen * invZ);
    return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
  }

  function hitTestStickerBody(fx, fy, extraPadScreen = 6) {
    const sorted = state.stickers.slice().sort((a, b) => (b.zOrder ?? 200) - (a.zOrder ?? 200));
    for (const st of sorted) {
      if (hitTestSingleSticker(st, fx, fy, extraPadScreen)) return st;
    }
    return null;
  }

  // 自动将小装饰锚定绑定到它正下方的角色照片上，使后续照片缩放平移时猫耳朵同步跟随！
  function autoBindStickerToUnderlyingPhoto(st) {
    if (st.followPhoto === false) {
      st.anchorType = 'none';
      st.anchorId = null;
      st.anchorData = null;
      return;
    }
    const hitFf = hitTestFreeFrame(st.x, st.y);
    if (hitFf && hitFf.assetId) {
      st.anchorType = 'frame';
      st.anchorId = hitFf.id;
      window.StickerEngine.recordStickerAnchorFromCanvas(st, state);
      return;
    }
    const hitCl = hitTestCell(st.x * state.canvasW, st.y * state.canvasH);
    if (hitCl && hitCl.assetId) {
      st.anchorType = 'cell';
      st.anchorId = hitCl.id;
      window.StickerEngine.recordStickerAnchorFromCanvas(st, state);
      return;
    }
    st.anchorType = 'none';
    st.anchorId = null;
    st.anchorData = null;
  }

  function hitTestSingleLoupe(lp, fx, fy) {
    if (lp.visible === false || lp.locked) return null;
    const minSide = Math.min(state.canvasW, state.canvasH);
    const invZ = 1 / state.camZoom;
    const sx = lp.srcX * state.canvasW, sy = lp.srcY * state.canvasH;
    const dx = lp.dstX * state.canvasW, dy = lp.dstY * state.canvasH;
    const srcR = Math.max(14 * invZ, (lp.srcR || 0.045) * minSide + 6 * invZ);
    const dstR = Math.max(28 * invZ, (lp.dstSize || 0.14) * minSide + 6 * invZ);
    if (Math.hypot(fx - sx, fy - sy) <= srcR) return { part: 'src', loupe: lp };
    if (Math.hypot(fx - dx, fy - dy) <= dstR) return { part: 'dst', loupe: lp };
    return null;
  }

  function hitTestSingleText(t, nx, ny) {
    if (t.visible === false || t.locked) return false;
    const box = t._lastBox || { w: 0.16, h: 0.08 };
    const dx = (nx - t.x) * state.canvasW;
    const dy = (ny - t.y) * state.canvasH;
    const ang = (-(t.rotation || 0) * Math.PI) / 180;
    const lx = dx * Math.cos(ang) - dy * Math.sin(ang);
    const ly = dx * Math.sin(ang) + dy * Math.cos(ang);
    const hw = (box.w * state.canvasW) / 2 + 8;
    const hh = (box.h * state.canvasH) / 2 + 8;
    return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
  }

  function hitTestSingleFrame(ff, nx, ny) {
    if (ff.visible === false || ff.locked) return false;
    const dx = (nx - ff.x) * state.canvasW;
    const dy = (ny - ff.y) * state.canvasH;
    const ang = (-(ff.rotation || 0) * Math.PI) / 180;
    const lx = dx * Math.cos(ang) - dy * Math.sin(ang);
    const ly = dx * Math.sin(ang) + dy * Math.cos(ang);
    const hw = (ff.w * state.canvasW) / 2;
    const hh = (ff.h * state.canvasH) / 2;
    return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
  }

  function hitTestFreeFrame(nx, ny) {
    const sorted = state.freeFrames.slice().sort((a, b) => (b.zOrder ?? 100) - (a.zOrder ?? 100));
    for (const ff of sorted) {
      if (hitTestSingleFrame(ff, nx, ny)) return ff;
    }
    return null;
  }

  function hitTestCutLine(fx, fy) {
    const tol = Math.max(6, 10 / state.camZoom);
    for (let i = state.cuts.length - 1; i >= 0; i--) {
      const cut = state.cuts[i];
      const sampled = window.PlanarSlicer.sampleCutPointsPx(cut, state.canvasW, state.canvasH);
      for (let k = 0; k < sampled.length - 1; k++) {
        if (window.PlanarSlicer.distToSegment({ x: fx, y: fy }, sampled[k], sampled[k + 1]).dist <= tol) {
          return cut;
        }
      }
    }
    return null;
  }

  function hitTestCell(fx, fy) {
    if (state.hideBaseCells) return null;
    const sorted = state.topology.cells.slice().sort((a, b) => a.area - b.area);
    for (const cell of sorted) {
      if (cell.visible === false || cell.locked) continue;
      if (window.PlanarSlicer.pointInCell({ x: fx, y: fy }, cell)) return cell;
    }
    return null;
  }

  function selectItem(type, id) {
    state.selection = (type && id) ? { type, id } : null;
    renderSelectionInspector();
    renderOshiPaletteUI();
    renderLayerManagerUI();
    renderCreativePanelUI();
    updateFloatingFrameBarPosition();
    requestRender();
  }

  function isPointTouchingAnyBoundaryOrCut(fx, fy) {
    const tol = Math.max(8, 14 / state.camZoom);
    const outer = state.topology.outerPoly;
    for (let i = 0; i < outer.length; i++) {
      if (window.PlanarSlicer.distToSegment({ x: fx, y: fy }, outer[i], outer[(i + 1) % outer.length]).dist <= tol) {
        return true;
      }
    }
    for (const seg of state.topology.activeInternalSegments) {
      if (window.PlanarSlicer.distToSegment({ x: fx, y: fy }, seg.a, seg.b).dist <= tol) return true;
    }
    for (const seg of state.topology.danglingEdges) {
      if (window.PlanarSlicer.distToSegment({ x: fx, y: fy }, seg.a, seg.b).dist <= tol) return true;
    }
    return false;
  }

  function applyShiftAngleSnapNorm(anchorNorm, curNorm) {
    const dx = (curNorm.x - anchorNorm.x) * state.canvasW;
    const dy = (curNorm.y - anchorNorm.y) * state.canvasH;
    const len = Math.hypot(dx, dy);
    const snappedAng = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return {
      x: anchorNorm.x + (Math.cos(snappedAng) * len) / state.canvasW,
      y: anchorNorm.y + (Math.sin(snappedAng) * len) / state.canvasH
    };
  }

  // ==================== 无限画布鼠标核心事件 ====================
  mainCanvas.addEventListener('mousedown', (e) => {
    const pos = getPointerCoords(e);

    // 1. 鼠标中键(滚轮键) 或 按住空格键 或 按住Ctrl键 或 抓手工具(hand)：随时直接拖动平移整个无限画布视野！
    if (e.button === 1 || (e.button === 0 && (state.spacePressed || e.ctrlKey || state.tool === 'hand'))) {
      e.preventDefault();
      state.dragAction = {
        type: 'pan-camera',
        startVx: pos.vx,
        startVy: pos.vy,
        origCamX: state.camX,
        origCamY: state.camY
      };
      updateCursorStyle();
      return;
    }

    if (e.button === 2) {
      if (state.draft) {
        state.draft = null;
        requestRender();
      }
      return;
    }
    if (e.button !== 0) return;

    // 1.5 单格漫画/氛围线条「点击画面定焦点」交互模式
    if (state.pickingMangaFocusCellId) {
      const targetCell = state.topology.cells.find(c => c.id === state.pickingMangaFocusCellId);
      state.pickingMangaFocusCellId = null;
      if (targetCell) {
        if (!targetCell.fx) targetCell.fx = { blurPad: false, blurAmount: 28, colorFilter: 'none', mangaLines: 'focus', popOut: false };
        const b = targetCell.bounds;
        targetCell.fx.mangaFocusX = Math.max(0.02, Math.min(0.98, (pos.fx - b.minX) / Math.max(1, b.w)));
        targetCell.fx.mangaFocusY = Math.max(0.02, Math.min(0.98, (pos.fy - b.minY) / Math.max(1, b.h)));
        updateCursorStyle();
        document.getElementById('toolHintText').textContent = TOOL_HINTS[state.tool] || TOOL_HINTS.select;
        pushHistory();
        renderSelectionInspector();
        requestRender();
        showToast('已将线条焦点对准点击位置');
        return;
      }
      updateCursorStyle();
    }

    // 2. 自定义外框锚点微调手柄检测 (支持直接把锚点拖出旧边界自动扩展外框！)
    if (state.editingContourNodes && state.contour.type === 'custom') {
      const pts = state.contour.customPoints;
      const fw = state.frameWorld;
      for (let i = 0; i < pts.length; i++) {
        const vx = fw.x + pts[i].x * fw.w;
        const vy = fw.y + pts[i].y * fw.h;
        if (Math.hypot(pos.wx - vx, pos.wy - vy) <= 13 / state.camZoom) {
          state.dragAction = { type: 'contour-node', idx: i };
          return;
        }
      }
    }

    // 3. 在无限画布任意位置自由绘制唯一总外框 (contour-pen，完全不受旧模板画布限制！)
    if (state.tool === 'contour-pen') {
      if (state.contourSubMode === 'free') {
        state.draft = {
          kind: 'contour-world-free',
          worldPoints: [{ x: pos.wx, y: pos.wy }]
        };
      } else {
        const wPt = { x: pos.wx, y: pos.wy, smooth: true };
        if (!state.draft || state.draft.kind !== 'contour-world-poly') {
          state.draft = {
            kind: 'contour-world-poly',
            worldPoints: [wPt],
            cursorWorld: wPt
          };
        } else {
          const first = state.draft.worldPoints[0];
          if (state.draft.worldPoints.length >= 3 && Math.hypot(pos.wx - first.x, pos.wy - first.y) <= 18 / state.camZoom) {
            applyWorldPointsAsSingleOuterFrame(state.draft.worldPoints, true);
            state.draft = null;
            return;
          }
          state.draft.worldPoints.push(wPt);
        }
      }
      requestRender();
      return;
    }

    // 3.5 贴脸装饰专属防误触模式 (state.tool === 'sticker'：底层照片与相框全部锁定，100% 只移动小装饰位置！)
    if (state.tool === 'sticker') {
      const handleHit = hitTestStickerOuterHandles(pos.fx, pos.fy);
      if (handleHit) {
        state.dragAction = {
          type: handleHit.action,
          sticker: handleHit.st,
          stickerId: handleHit.st.id,
          startW: handleHit.startW,
          startH: handleHit.startH,
          startDist: handleHit.startDist
        };
        return;
      }

      // 命中任意小装饰本体（含猫须透明镂空区）-> 纯粹移动该小装饰位置！
      const hitSt = hitTestStickerBody(pos.fx, pos.fy, 8);
      if (hitSt) {
        selectItem('sticker', hitSt.id);
        state.dragAction = {
          type: 'move-sticker',
          sticker: hitSt,
          stickerId: hitSt.id,
          startNx: pos.nx,
          startNy: pos.ny,
          origX: hitSt.x,
          origY: hitSt.y
        };
        return;
      }

      // 若已选中某个小装饰且在它附近 (36px 内) 拖拽，也直接平稳挪动该小装饰，绝不误触底下照片！
      if (state.selection && state.selection.type === 'sticker') {
        const curSt = state.stickers.find(s => s.id === state.selection.id);
        if (curSt) {
          const nearSt = hitTestStickerBody(pos.fx, pos.fy, 36);
          if (nearSt && nearSt.id === curSt.id) {
            state.dragAction = {
              type: 'move-sticker',
              sticker: curSt,
              stickerId: curSt.id,
              startNx: pos.nx,
              startNy: pos.ny,
              origX: curSt.x,
              origY: curSt.y
            };
            return;
          }
        }
      }

      // 点在远离小装饰的空白处：仅取消选中并允许平移视野，绝对不改动底下分镜照片或相框！
      selectItem(null, null);
      state.dragAction = {
        type: 'pan-camera',
        startVx: pos.vx,
        startVy: pos.vy,
        origCamX: state.camX,
        origCamY: state.camY
      };
      updateCursorStyle();
      return;
    }

    // 4. 选择与构图模式 (Select Tool)
    if (state.tool === 'select') {
      // 4.0 若当前已选中某个装饰贴纸，优先检测它的外置手柄
      const stHandleHit = hitTestStickerOuterHandles(pos.fx, pos.fy);
      if (stHandleHit) {
        state.dragAction = {
          type: stHandleHit.action,
          sticker: stHandleHit.st,
          stickerId: stHandleHit.st.id,
          startW: stHandleHit.startW,
          startH: stHandleHit.startH,
          startDist: stHandleHit.startDist
        };
        return;
      }
      // 4a. 已选中分割线的控制柄检测
      if (state.selection && state.selection.type === 'cut') {
        const selCut = state.cuts.find(c => c.id === state.selection.id);
        if (selCut) {
          const hitR = 13 / state.camZoom;
          if (selCut.mode === 'curve' && selCut.cp1 && selCut.cp2) {
            if (Math.hypot(pos.fx - selCut.cp1.x * state.canvasW, pos.fy - selCut.cp1.y * state.canvasH) <= hitR) {
              state.dragAction = { type: 'cut-cp1', cut: selCut };
              return;
            }
            if (Math.hypot(pos.fx - selCut.cp2.x * state.canvasW, pos.fy - selCut.cp2.y * state.canvasH) <= hitR) {
              state.dragAction = { type: 'cut-cp2', cut: selCut };
              return;
            }
          }
          for (let i = 0; i < selCut.points.length; i++) {
            const pt = selCut.points[i];
            if (Math.hypot(pos.fx - pt.x * state.canvasW, pos.fy - pt.y * state.canvasH) <= hitR) {
              state.dragAction = { type: 'cut-anchor', cut: selCut, idx: i };
              return;
            }
          }
        }
      }

      // 4b. 已选中自由相框或文字的旋转杆与四角缩放块检测
      if (state.selection && (state.selection.type === 'frame' || state.selection.type === 'text')) {
        const item = state.selection.type === 'frame'
          ? state.freeFrames.find(f => f.id === state.selection.id)
          : state.texts.find(t => t.id === state.selection.id);
        if (item) {
          const bw = (state.selection.type === 'frame' ? item.w : (item._lastBox?.w || 0.15)) * state.canvasW;
          const bh = (state.selection.type === 'frame' ? item.h : (item._lastBox?.h || 0.08)) * state.canvasH;
          const cx = item.x * state.canvasW;
          const cy = item.y * state.canvasH;
          const rad = (-(item.rotation || 0) * Math.PI) / 180;
          const dx = pos.fx - cx, dy = pos.fy - cy;
          const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
          const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
          const hitR = 13 / state.camZoom;
          const stemLen = 24 / state.camZoom;

          if (Math.hypot(lx, ly - (-bh / 2 - stemLen)) <= hitR * 1.3) {
            state.dragAction = { type: 'rotate-item', item };
            return;
          }
          if (state.selection.type === 'frame') {
            const corners = [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]];
            for (const [qx, qy] of corners) {
              if (Math.hypot(lx - qx, ly - qy) <= hitR) {
                state.dragAction = {
                  type: 'resize-frame',
                  frame: item,
                  startW: item.w,
                  startH: item.h,
                  startDist: Math.max(10, Math.hypot(dx, dy))
                };
                return;
              }
            }
          }
        }
      }

      // 4c. 按图层栈从顶层到底层依次检测所有可见且未锁定的叠加层（若上层被 🔒 锁定或 👁 隐藏，鼠标点击直接穿透到下层重叠图片！）
      const sortedOverlays = getAllOverlayEntriesSortedDesc();
      for (const entry of sortedOverlays) {
        if (entry.kind === 'loupe') {
          const hitLp = hitTestSingleLoupe(entry.item, pos.fx, pos.fy);
          if (hitLp) {
            selectItem('loupe', hitLp.loupe.id);
            state.dragAction = {
              type: hitLp.part === 'src' ? 'move-loupe-src' : 'move-loupe-dst',
              loupe: hitLp.loupe,
              startNx: pos.nx,
              startNy: pos.ny,
              origX: hitLp.part === 'src' ? hitLp.loupe.srcX : hitLp.loupe.dstX,
              origY: hitLp.part === 'src' ? hitLp.loupe.srcY : hitLp.loupe.dstY
            };
            return;
          }
        } else if (entry.kind === 'text') {
          if (hitTestSingleText(entry.item, pos.nx, pos.ny)) {
            selectItem('text', entry.item.id);
            state.dragAction = {
              type: 'move-item',
              item: entry.item,
              startNx: pos.nx,
              startNy: pos.ny,
              origX: entry.item.x,
              origY: entry.item.y
            };
            return;
          }
        } else if (entry.kind === 'sticker') {
          if (hitTestSingleSticker(entry.item, pos.fx, pos.fy, 4)) {
            selectItem('sticker', entry.item.id);
            state.dragAction = {
              type: 'move-sticker',
              sticker: entry.item,
              stickerId: entry.item.id,
              startNx: pos.nx,
              startNy: pos.ny,
              origX: entry.item.x,
              origY: entry.item.y
            };
            return;
          }
        } else if (entry.kind === 'frame') {
          const hitFf = entry.item;
          if (hitTestSingleFrame(hitFf, pos.nx, pos.ny)) {
            selectItem('frame', hitFf.id);
            if (hitFf.assetId && state.frameEditImageMode) {
              if (!hitFf.transform) hitFf.transform = window.PlanarSlicer.createDefaultImageTransform();
              const boxW = hitFf.w * state.canvasW;
              const boxH = hitFf.h * state.canvasH;
              let innerW = boxW, innerH = boxH;
              if (hitFf.shape === 'polaroid') {
                const pr = window.CollageRenderer.getPolaroidInnerRect(boxW, boxH);
                innerW = pr.innerW; innerH = pr.innerH;
              }
              state.dragAction = {
                type: 'pan-frame-image',
                frame: hitFf,
                innerW: Math.max(10, innerW),
                innerH: Math.max(10, innerH),
                startFx: pos.fx,
                startFy: pos.fy,
                origPanX: hitFf.transform.panX || 0,
                origPanY: hitFf.transform.panY || 0
              };
            } else {
              state.dragAction = {
                type: 'move-item',
                item: hitFf,
                itemKind: 'frame',
                startNx: pos.nx,
                startNy: pos.ny,
                origX: hitFf.x,
                origY: hitFf.y
              };
            }
            return;
          }
        }
      }

      // 4e. 命中分割刀口线
      const hitCut = hitTestCutLine(pos.fx, pos.fy);
      if (hitCut) {
        selectItem('cut', hitCut.id);
        state.dragAction = {
          type: 'move-cut',
          cut: hitCut,
          startNx: pos.nx,
          startNy: pos.ny,
          origPoints: hitCut.points.map(p => ({ ...p })),
          origCp1: hitCut.cp1 ? { ...hitCut.cp1 } : null,
          origCp2: hitCut.cp2 ? { ...hitCut.cp2 } : null
        };
        return;
      }

      // 4f. 命中分镜格
      const hitCell = hitTestCell(pos.fx, pos.fy);
      if (hitCell) {
        selectItem('cell', hitCell.id);
        if (e.altKey && hitCell.assetId) {
          state.dragAction = { type: 'swap-cell', sourceCell: hitCell };
          return;
        }
        if (hitCell.assetId) {
          if (!hitCell.transform) hitCell.transform = window.PlanarSlicer.createDefaultImageTransform();
          state.dragAction = {
            type: 'pan-cell-image',
            cell: hitCell,
            boxW: Math.max(10, hitCell.bounds.w),
            boxH: Math.max(10, hitCell.bounds.h),
            startFx: pos.fx,
            startFy: pos.fy,
            origPanX: hitCell.transform.panX || 0,
            origPanY: hitCell.transform.panY || 0
          };
          return;
        }
        // 如果点击的是没有图片的空白格子并拖拽，也顺滑地平移整个无限画布视野！
        state.dragAction = {
          type: 'pan-camera',
          startVx: pos.vx,
          startVy: pos.vy,
          origCamX: state.camX,
          origCamY: state.camY
        };
        updateCursorStyle();
        return;
      }

      // 4g. 点击外框外部的无限画布空白处：取消选中并直接抓手拖拽平移画布视野！
      selectItem(null, null);
      state.dragAction = {
        type: 'pan-camera',
        startVx: pos.vx,
        startVy: pos.vy,
        origCamX: state.camX,
        origCamY: state.camY
      };
      updateCursorStyle();
      return;
    }

    // 5. 直线/折线切割刀 & 锚点曲线刀
    if (state.tool === 'cut-line' || state.tool === 'cut-curve') {
      const isCurve = state.tool === 'cut-curve';
      let ptNorm = { x: pos.nx, y: pos.ny };
      if (e.shiftKey && state.draft && state.draft.points.length > 0) {
        ptNorm = applyShiftAngleSnapNorm(state.draft.points[state.draft.points.length - 1], ptNorm);
      }

      if (!state.draft) {
        state.draft = {
          kind: isCurve ? 'cut-curve' : 'cut-line',
          points: [ptNorm],
          cursor: ptNorm,
          dragStartScreen: { x: pos.vx, y: pos.vy },
          isDraggingStroke: true
        };
      } else {
        const first = state.draft.points[0];
        const distFirst = Math.hypot((ptNorm.x - first.x) * state.canvasW, (ptNorm.y - first.y) * state.canvasH);
        if (state.draft.points.length >= 2 && distFirst <= 18 / state.camZoom) {
          commitDraftCut(state.draft.points, isCurve ? 'curve' : 'line', true);
          state.draft = null;
          return;
        }
        state.draft.points.push(ptNorm);
        if (state.draft.points.length >= 2 && isPointTouchingAnyBoundaryOrCut(ptNorm.x * state.canvasW, ptNorm.y * state.canvasH)) {
          commitDraftCut(state.draft.points, isCurve ? 'curve' : 'line', false);
          state.draft = null;
          return;
        }
      }
      requestRender();
      return;
    }

    // 6. 手绘平滑曲线切割刀
    if (state.tool === 'cut-free') {
      state.draft = {
        kind: 'cut-free',
        points: [{ x: pos.nx, y: pos.ny }]
      };
      requestRender();
      return;
    }

    // 7. 💥 蛛网冲击碎裂锤 (一击在震源处炸开蛛网冲击分镜！)
    if (state.tool === 'shatter-impact') {
      const density = parseInt(document.getElementById('rngShatterDensity').value, 10) || 9;
      applyGeneratedShatterCuts(window.FxLabEngine.generateImpactShatterCuts({ x: pos.nx, y: pos.ny }, density));
      return;
    }

    // 8. ⚔ 剑光斩击刀 (划出一道主刀光并崩出斜向碎镜片！)
    if (state.tool === 'shatter-slash') {
      state.draft = {
        kind: 'cut-line',
        isSlashShatter: true,
        points: [{ x: pos.nx, y: pos.ny }],
        cursor: { x: pos.nx, y: pos.ny },
        dragStartScreen: { x: pos.vx, y: pos.vy },
        isDraggingStroke: true
      };
      requestRender();
    }
  });

  window.addEventListener('mousemove', (e) => {
    const pos = getPointerCoords(e);

    if (state.dragAction) {
      const act = state.dragAction;
      if (act.type === 'pan-camera') {
        state.camX = act.origCamX - (pos.vx - act.startVx) / state.camZoom;
        state.camY = act.origCamY - (pos.vy - act.startVy) / state.camZoom;
        requestRender();
      } else if (act.type === 'pan-cell-image') {
        act.cell.transform.panX = act.origPanX + (pos.fx - act.startFx) / act.boxW;
        act.cell.transform.panY = act.origPanY + (pos.fy - act.startFy) / act.boxH;
        requestRender();
      } else if (act.type === 'pan-frame-image') {
        // 将鼠标位移旋转到自由相框自身的局部方向，即使拍立得倾斜也能丝滑指哪移哪！
        const dfx = pos.fx - act.startFx;
        const dfy = pos.fy - act.startFy;
        const rad = (-(act.frame.rotation || 0) * Math.PI) / 180;
        const localDx = dfx * Math.cos(rad) - dfy * Math.sin(rad);
        const localDy = dfx * Math.sin(rad) + dfy * Math.cos(rad);
        act.frame.transform.panX = act.origPanX + localDx / act.innerW;
        act.frame.transform.panY = act.origPanY + localDy / act.innerH;
        requestRender();
      } else if (act.type === 'move-loupe-src') {
        act.loupe.srcX = Math.max(0.01, Math.min(0.99, act.origX + (pos.nx - act.startNx)));
        act.loupe.srcY = Math.max(0.01, Math.min(0.99, act.origY + (pos.ny - act.startNy)));
        requestRender();
      } else if (act.type === 'move-loupe-dst') {
        act.loupe.dstX = act.origX + (pos.nx - act.startNx);
        act.loupe.dstY = act.origY + (pos.ny - act.startNy);
        requestRender();
      } else if (act.type === 'move-sticker') {
        act.sticker.x = act.origX + (pos.nx - act.startNx);
        act.sticker.y = act.origY + (pos.ny - act.startNy);
        requestRender();
      } else if (act.type === 'rotate-sticker') {
        const cx = act.sticker.x * state.canvasW;
        const cy = act.sticker.y * state.canvasH;
        const ang = (Math.atan2(pos.fy - cy, pos.fx - cx) * 180) / Math.PI + 90;
        act.sticker.rotation = e.shiftKey ? Math.round(ang / 15) * 15 : Math.round(ang * 10) / 10;
        renderSelectionInspector();
        requestRender();
      } else if (act.type === 'resize-sticker-uniform') {
        const cx = act.sticker.x * state.canvasW;
        const cy = act.sticker.y * state.canvasH;
        const curDist = Math.max(6, Math.hypot(pos.fx - cx, pos.fy - cy));
        const ratio = curDist / act.startDist;
        act.sticker.w = Math.max(0.015, Math.min(1.5, act.startW * ratio));
        act.sticker.h = Math.max(0.015, Math.min(1.5, act.startH * ratio));
        renderSelectionInspector();
        requestRender();
      } else if (act.type === 'squash-sticker-x' || act.type === 'squash-sticker-y') {
        // 侧脸透视独立压窄/拉高计算
        const cx = act.sticker.x * state.canvasW;
        const cy = act.sticker.y * state.canvasH;
        const rad = (-(act.sticker.rotation || 0) * Math.PI) / 180;
        const dx = pos.fx - cx, dy = pos.fy - cy;
        const lx = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad));
        const ly = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));
        const padPx = 11 / state.camZoom;
        if (act.type === 'squash-sticker-x') {
          act.sticker.w = Math.max(0.012, Math.min(1.5, ((lx - padPx) * 2) / state.canvasW));
        } else {
          act.sticker.h = Math.max(0.012, Math.min(1.5, ((ly - padPx) * 2) / state.canvasH));
        }
        renderSelectionInspector();
        requestRender();
      } else if (act.type === 'move-item') {
        act.item.x = act.origX + (pos.nx - act.startNx);
        act.item.y = act.origY + (pos.ny - act.startNy);
        requestRender();
      } else if (act.type === 'rotate-item') {
        const cx = act.item.x * state.canvasW;
        const cy = act.item.y * state.canvasH;
        const ang = (Math.atan2(pos.fy - cy, pos.fx - cx) * 180) / Math.PI + 90;
        act.item.rotation = e.shiftKey ? Math.round(ang / 15) * 15 : Math.round(ang);
        renderSelectionInspector();
        requestRender();
      } else if (act.type === 'resize-frame') {
        const cx = act.frame.x * state.canvasW;
        const cy = act.frame.y * state.canvasH;
        const curDist = Math.max(12, Math.hypot(pos.fx - cx, pos.fy - cy));
        const ratio = curDist / act.startDist;
        act.frame.w = Math.max(0.05, Math.min(2.0, act.startW * ratio));
        act.frame.h = Math.max(0.05, Math.min(2.0, act.startH * ratio));
        requestRender();
      } else if (act.type === 'cut-cp1') {
        act.cut.cp1 = { x: pos.nx, y: pos.ny };
        rebuildTopology();
        requestRender();
      } else if (act.type === 'cut-cp2') {
        act.cut.cp2 = { x: pos.nx, y: pos.ny };
        rebuildTopology();
        requestRender();
      } else if (act.type === 'cut-anchor') {
        act.cut.points[act.idx] = { x: pos.nx, y: pos.ny };
        rebuildTopology();
        requestRender();
      } else if (act.type === 'move-cut') {
        const dx = pos.nx - act.startNx, dy = pos.ny - act.startNy;
        act.cut.points = act.origPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
        if (act.origCp1) act.cut.cp1 = { x: act.origCp1.x + dx, y: act.origCp1.y + dy };
        if (act.origCp2) act.cut.cp2 = { x: act.origCp2.x + dx, y: act.origCp2.y + dy };
        rebuildTopology();
        requestRender();
      } else if (act.type === 'contour-node') {
        // 允许将外框顶点自由拉到原 frameWorld 之外！松手时自动重算包围盒！
        state.contour.customPoints[act.idx].x = pos.nx;
        state.contour.customPoints[act.idx].y = pos.ny;
        rebuildTopology();
        requestRender();
      } else if (act.type === 'swap-cell') {
        const over = hitTestCell(pos.fx, pos.fy);
        state.dragHoverTarget = over && over.id !== act.sourceCell.id ? { type: 'cell', id: over.id } : null;
        requestRender();
      }
      return;
    }

    if (state.draft) {
      if (state.draft.kind === 'contour-world-poly') {
        state.draft.cursorWorld = { x: pos.wx, y: pos.wy };
        requestRender();
      } else if (state.draft.kind === 'contour-world-free') {
        const last = state.draft.worldPoints[state.draft.worldPoints.length - 1];
        if (Math.hypot(pos.wx - last.x, pos.wy - last.y) >= 4 / state.camZoom) {
          state.draft.worldPoints.push({ x: pos.wx, y: pos.wy });
          requestRender();
        }
      } else if (state.draft.kind === 'cut-free') {
        const last = state.draft.points[state.draft.points.length - 1];
        if (Math.hypot((pos.nx - last.x) * state.canvasW, (pos.ny - last.y) * state.canvasH) >= 4) {
          state.draft.points.push({ x: pos.nx, y: pos.ny });
          requestRender();
        }
      } else {
        let cur = { x: pos.nx, y: pos.ny };
        if (e.shiftKey && state.draft.points.length > 0) {
          cur = applyShiftAngleSnapNorm(state.draft.points[state.draft.points.length - 1], cur);
        }
        state.draft.cursor = cur;
        requestRender();
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    const pos = getPointerCoords(e);

    if (state.dragAction) {
      const finishedType = state.dragAction.type;
      if (finishedType === 'swap-cell') {
        const targetCell = hitTestCell(pos.fx, pos.fy);
        const src = state.dragAction.sourceCell;
        if (targetCell && targetCell.id !== src.id) {
          const tmpAsset = src.assetId, tmpTf = src.transform;
          src.assetId = targetCell.assetId; src.transform = targetCell.transform;
          targetCell.assetId = tmpAsset; targetCell.transform = tmpTf;
          showToast('已互换两个格子的图片');
        }
        state.dragHoverTarget = null;
      } else if (
        finishedType === 'move-sticker' ||
        finishedType === 'rotate-sticker' ||
        finishedType === 'resize-sticker-uniform' ||
        finishedType === 'squash-sticker-x' ||
        finishedType === 'squash-sticker-y'
      ) {
        if (state.dragAction.sticker) {
          autoBindStickerToUnderlyingPhoto(state.dragAction.sticker);
        }
      } else if (
        finishedType === 'move-item' ||
        finishedType === 'resize-frame' ||
        finishedType === 'rotate-item'
      ) {
        // 如果移动/缩放/旋转的是开启了「随分镜联动」的自由相框，更新它对当前所处分镜格的相对锚点！
        const targetFf = state.dragAction.frame || (state.selection && state.selection.type === 'frame' ? state.freeFrames.find(f => f.id === state.selection.id) : null);
        if (targetFf && targetFf.followHostCell && window.FxLabEngine) {
          window.FxLabEngine.recordFrameHostAnchor(targetFf, state);
        }
      } else if (finishedType === 'contour-node') {
        // 如果顶点被拖出了原外框边界，自动更新唯一总外框的世界包围盒！
        const fw = state.frameWorld;
        const wPts = state.contour.customPoints.map(p => ({
          x: fw.x + p.x * fw.w,
          y: fw.y + p.y * fw.h,
          smooth: p.smooth
        }));
        applyWorldPointsAsSingleOuterFrame(wPts, false);
      }

      state.dragAction = null;
      updateCursorStyle();
      if (finishedType !== 'pan-camera') {
        pushHistory();
        renderSelectionInspector();
      }
      requestRender();
      return;
    }

    if (!state.draft) return;

    // 1. 无限画布手绘异形总外框松手结算
    if (state.draft.kind === 'contour-world-free') {
      const rawWorld = state.draft.worldPoints;
      state.draft = null;
      if (rawWorld.length >= 6) {
        const tol = Math.max(4, 7 / state.camZoom);
        const simplified = window.SilhouetteEngine.simplifyPolyline(rawWorld, tol).map(p => ({
          x: p.x, y: p.y, smooth: true
        }));
        if (simplified.length >= 3) {
          applyWorldPointsAsSingleOuterFrame(simplified, true);
        }
      }
      requestRender();
      return;
    }

    // 2. 直线/曲线切割刀 & 剑光斩击刀按住拖拽首笔结算
    if ((state.draft.kind === 'cut-line' || state.draft.kind === 'cut-curve') && state.draft.isDraggingStroke) {
      state.draft.isDraggingStroke = false;
      const distScreen = Math.hypot(pos.vx - state.draft.dragStartScreen.x, pos.vy - state.draft.dragStartScreen.y);
      if (state.draft.isSlashShatter) {
        const startNorm = state.draft.points[0];
        const endNorm = distScreen > 20 ? { x: pos.nx, y: pos.ny } : { x: Math.min(0.95, startNorm.x + 0.35), y: Math.max(0.05, startNorm.y - 0.25) };
        const density = parseInt(document.getElementById('rngShatterDensity').value, 10) || 8;
        state.draft = null;
        applyGeneratedShatterCuts(window.FxLabEngine.generateSlashShatterCuts(startNorm, endNorm, density));
        return;
      }
      if (distScreen > 26 && state.draft.points.length === 1) {
        let endNorm = { x: pos.nx, y: pos.ny };
        if (e.shiftKey) endNorm = applyShiftAngleSnapNorm(state.draft.points[0], endNorm);

        const endTouching = isPointTouchingAnyBoundaryOrCut(endNorm.x * state.canvasW, endNorm.y * state.canvasH);
        if (state.autoExtend || endTouching || state.draft.kind === 'cut-curve') {
          commitDraftCut([state.draft.points[0], endNorm], state.draft.kind === 'cut-curve' ? 'curve' : 'line', false);
          state.draft = null;
          requestRender();
          return;
        } else {
          state.draft.points.push(endNorm);
          showToast('刀口停在中间：继续点击可拐弯续画，双击可暂存为悬空刀口(T/Y交汇)');
          requestRender();
          return;
        }
      }
    }

    // 3. 手绘平滑切割刀松手结算
    if (state.draft.kind === 'cut-free') {
      const rawPtsPx = state.draft.points.map(p => ({ x: p.x * state.canvasW, y: p.y * state.canvasH }));
      state.draft = null;
      if (rawPtsPx.length >= 4) {
        const simplifiedPx = window.SilhouetteEngine.simplifyPolyline(rawPtsPx, Math.max(4, Math.min(state.canvasW, state.canvasH) * 0.008));
        const normPts = simplifiedPx.map(p => ({ x: p.x / state.canvasW, y: p.y / state.canvasH }));
        const firstPx = rawPtsPx[0], lastPx = rawPtsPx[rawPtsPx.length - 1];
        const isClosedLoop = rawPtsPx.length >= 10 && Math.hypot(lastPx.x - firstPx.x, lastPx.y - firstPx.y) <= 26 / state.camZoom;
        commitDraftCut(normPts, 'free', isClosedLoop);
      }
      requestRender();
    }
  });

  // 双击交互
  mainCanvas.addEventListener('dblclick', (e) => {
    const pos = getPointerCoords(e);

    if (state.editingContourNodes && state.contour.type === 'custom') {
      const fw = state.frameWorld;
      const pts = state.contour.customPoints;
      for (let i = 0; i < pts.length; i++) {
        if (Math.hypot(pos.wx - (fw.x + pts[i].x * fw.w), pos.wy - (fw.y + pts[i].y * fw.h)) <= 14 / state.camZoom) {
          pts[i].smooth = !pts[i].smooth;
          rebuildTopology();
          pushHistory();
          requestRender();
          showToast(pts[i].smooth ? '该锚点已切换为平滑圆弧' : '该锚点已切换为折线锐角');
          return;
        }
      }
    }

    if (state.draft) {
      if (state.draft.kind === 'contour-world-poly' && state.draft.worldPoints.length >= 3) {
        applyWorldPointsAsSingleOuterFrame(state.draft.worldPoints, true);
        state.draft = null;
        return;
      }
      if ((state.draft.kind === 'cut-line' || state.draft.kind === 'cut-curve') && state.draft.points.length >= 2) {
        commitDraftCut(state.draft.points, state.draft.kind === 'cut-curve' ? 'curve' : 'line', false);
        state.draft = null;
        requestRender();
        return;
      }
    }

    if (state.tool === 'select') {
      const ff = hitTestFreeFrame(pos.nx, pos.ny);
      if (ff && ff.assetId) {
        if (!state.frameEditImageMode) {
          state.frameEditImageMode = true;
          updateFloatingFrameBarPosition();
          requestRender();
          showToast('已进入「调整框内图片区域」模式：直接左键拖拽即可移动照片位置');
        } else {
          openCropForFrame(ff);
        }
        return;
      }
      const cell = hitTestCell(pos.fx, pos.fy);
      if (cell && cell.assetId) {
        openCropForCell(cell);
      }
    }
  });

  // 滚轮缩放：Ctrl+滚轮 (或在无图空白区域滚轮) = 以鼠标指针为中心缩放无限画布；在有图区域直接滚轮 = 缩放框内图片！
  mainCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pos = getPointerCoords(e);

    // 在贴脸装饰防误触模式下（或指针正指着当前选中的小装饰时），滚轮直接平滑缩放该小装饰大小（绝不误缩底下照片）！
    if (!e.ctrlKey && (state.tool === 'sticker' || (state.selection && state.selection.type === 'sticker'))) {
      const hitSt = hitTestStickerBody(pos.fx, pos.fy, 10);
      if (hitSt) {
        selectItem('sticker', hitSt.id);
        const factor = e.deltaY < 0 ? 1.08 : 0.925;
        hitSt.w = Math.max(0.015, Math.min(1.5, hitSt.w * factor));
        hitSt.h = Math.max(0.015, Math.min(1.5, hitSt.h * factor));
        autoBindStickerToUnderlyingPhoto(hitSt);
        renderSelectionInspector();
        requestRender();
        debouncedPushHistory();
        return;
      }
      if (state.tool === 'sticker') {
        // 装饰模式下未指中小装饰时，滚轮缩放无限画布视野，保护底层照片不被误缩放！
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        const nextZoom = Math.max(0.05, Math.min(6.0, state.camZoom * zoomFactor));
        state.camZoom = nextZoom;
        state.camX = pos.wx - (pos.vx - pos.vpW * 0.5) / nextZoom;
        state.camY = pos.wy - (pos.vy - pos.vpH * 0.5) / nextZoom;
        updateZoomHudUI();
        requestRender();
        return;
      }
    }

    if (!e.ctrlKey && state.tool === 'select') {
      const ff = hitTestFreeFrame(pos.nx, pos.ny);
      if (ff && ff.assetId) {
        selectItem('frame', ff.id);
        if (!ff.transform) ff.transform = window.PlanarSlicer.createDefaultImageTransform();
        const factor = e.deltaY < 0 ? 1.08 : 0.925;
        ff.transform.scale = Math.max(0.2, Math.min(8, (ff.transform.scale || 1) * factor));
        renderSelectionInspector();
        requestRender();
        debouncedPushHistory();
        return;
      }

      const cell = hitTestCell(pos.fx, pos.fy);
      if (cell && cell.assetId) {
        selectItem('cell', cell.id);
        if (!cell.transform) cell.transform = window.PlanarSlicer.createDefaultImageTransform();
        const oldScale = cell.transform.scale || 1;
        const factor = e.deltaY < 0 ? 1.08 : 0.925;
        const newScale = Math.max(0.2, Math.min(8, oldScale * factor));
        const actualRatio = newScale / oldScale;

        const b = cell.bounds;
        const relX = (pos.fx - b.cx) / Math.max(1, b.w);
        const relY = (pos.fy - b.cy) / Math.max(1, b.h);
        cell.transform.panX = relX - (relX - (cell.transform.panX || 0)) * actualRatio;
        cell.transform.panY = relY - (relY - (cell.transform.panY || 0)) * actualRatio;
        cell.transform.scale = newScale;

        renderSelectionInspector();
        requestRender();
        debouncedPushHistory();
        return;
      }
    }

    // 无限画布相机围绕鼠标指针缩放！
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.max(0.05, Math.min(6.0, state.camZoom * zoomFactor));
    state.camZoom = nextZoom;
    // 保持鼠标下的世界坐标 (pos.wx, pos.wy) 纹丝不动
    state.camX = pos.wx - (pos.vx - pos.vpW * 0.5) / nextZoom;
    state.camY = pos.wy - (pos.vy - pos.vpH * 0.5) / nextZoom;
    updateZoomHudUI();
    requestRender();
  }, { passive: false });

  let wheelHistTimer = null;
  function debouncedPushHistory() {
    clearTimeout(wheelHistTimer);
    wheelHistTimer = setTimeout(() => pushHistory(), 380);
  }

  // ==================== 将无限画布任意位置画出的点集设为「唯一总外框」 ====================
  function applyWorldPointsAsSingleOuterFrame(worldPoints, isNewReplacement = true) {
    if (!worldPoints || worldPoints.length < 3) return;

    // 采样曲线极值点以求得精确世界坐标包围盒
    const anySmooth = worldPoints.some(p => p.smooth);
    const denseWorld = anySmooth
      ? window.SilhouetteEngine.sampleClosedCatmullRom(worldPoints, 16)
      : worldPoints;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of [...worldPoints, ...denseWorld]) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const newW = Math.max(80, Math.round(maxX - minX));
    const newH = Math.max(80, Math.round(maxY - minY));

    // 保留已有格子的图片以便新唯一外框继续使用
    const prevAssets = state.topology.cells.map(c => c.assetId).filter(Boolean);

    // 将自由相框和文字的归一化坐标保持在它们原本的世界位置上（这样如果新外框框住了某处相框，位置精准对应！）
    const oldFw = { ...state.frameWorld };
    if (isNewReplacement) {
      state.cuts = []; // 新圈定的自定义唯一外框默认作为一整块干净异形区域，方便直接填图或重新切割
      state.hideBaseCells = false;
    } else {
      // 仅微调顶点时，把分割线也按世界坐标保持在原地
      for (const cut of state.cuts) {
        cut.points = cut.points.map(pt => ({
          x: ((oldFw.x + pt.x * oldFw.w) - minX) / newW,
          y: ((oldFw.y + pt.y * oldFw.h) - minY) / newH
        }));
        if (cut.cp1) {
          cut.cp1 = { x: ((oldFw.x + cut.cp1.x * oldFw.w) - minX) / newW, y: ((oldFw.y + cut.cp1.y * oldFw.h) - minY) / newH };
        }
        if (cut.cp2) {
          cut.cp2 = { x: ((oldFw.x + cut.cp2.x * oldFw.w) - minX) / newW, y: ((oldFw.y + cut.cp2.y * oldFw.h) - minY) / newH };
        }
      }
    }

    for (const ff of state.freeFrames) {
      const wx = oldFw.x + ff.x * oldFw.w;
      const wy = oldFw.y + ff.y * oldFw.h;
      ff.x = (wx - minX) / newW;
      ff.y = (wy - minY) / newH;
      ff.w = (ff.w * oldFw.w) / newW;
      ff.h = (ff.h * oldFw.h) / newH;
    }
    for (const st of state.stickers) {
      const wx = oldFw.x + st.x * oldFw.w;
      const wy = oldFw.y + st.y * oldFw.h;
      st.x = (wx - minX) / newW;
      st.y = (wy - minY) / newH;
      st.w = (st.w * oldFw.w) / newW;
      st.h = (st.h * oldFw.h) / newH;
    }
    for (const t of state.texts) {
      t.x = ((oldFw.x + t.x * oldFw.w) - minX) / newW;
      t.y = ((oldFw.y + t.y * oldFw.h) - minY) / newH;
    }

    state.frameWorld = { x: Math.round(minX), y: Math.round(minY), w: newW, h: newH };
    state.canvasW = newW;
    state.canvasH = newH;

    state.contour = {
      type: 'custom',
      keepAspect: false, // 严格匹配用户在无限画布亲手画出的真实形状尺寸！
      baseAspect: newW / newH,
      customPoints: worldPoints.map(p => ({
        x: (p.x - minX) / newW,
        y: (p.y - minY) / newH,
        smooth: p.smooth !== false
      }))
    };

    if (isNewReplacement) {
      state.style.bgMode = 'transparent';
      setActiveTool('select', false);
      state.editingContourNodes = true;
    }

    rebuildTopology(isNewReplacement ? [] : null);
    if (isNewReplacement && prevAssets.length > 0 && state.topology.cells.length > 0) {
      state.topology.cells[0].assetId = prevAssets[0];
      state.topology.cells[0].transform = window.PlanarSlicer.createDefaultImageTransform();
      selectItem('cell', state.topology.cells[0].id);
    }

    syncGlobalControlsFromState();
    updateZoomHudUI();
    pushHistory();
    requestRender();

    if (isNewReplacement) {
      showToast(`已在所绘位置生成新的唯一总外框 (${newW}×${newH}px)，导出时仅保存此外框内容`);
    }
  }

  function commitDraftCut(points, mode, closed) {
    const clean = [];
    for (const p of points) {
      if (!clean.length || Math.hypot(p.x - clean[clean.length - 1].x, p.y - clean[clean.length - 1].y) > 0.003) {
        clean.push({ x: p.x, y: p.y });
      }
    }
    if (clean.length < 2) return;

    const newCut = {
      id: `cut_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      mode,
      points: clean,
      closed: !!closed,
      autoExtend: !!state.autoExtend
    };

    if (mode === 'curve' && clean.length === 2 && !closed) {
      const p0 = clean[0], p1 = clean[1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const nx = -dy * 0.16, ny = dx * 0.16;
      newCut.cp1 = { x: p0.x + dx * 0.33 + nx, y: p0.y + dy * 0.33 + ny };
      newCut.cp2 = { x: p0.x + dx * 0.67 - nx, y: p0.y + dy * 0.67 - ny };
    }

    const prevCellCount = state.topology.cells.length;
    state.cuts.push(newCut);
    state.hideBaseCells = false;
    rebuildTopology();
    pushHistory();

    const newCellCount = state.topology.cells.length;
    if (mode === 'curve' && clean.length === 2 && !closed) {
      selectItem('cut', newCut.id);
      setActiveTool('select', false);
      showToast('曲线分割已创建：拖动青色控制柄可调成 C 型圆弧或 S 型波浪线');
    } else if (closed) {
      showToast('已在内部挖出独立的「画中画内嵌分镜格」');
    } else if (newCellCount === prevCellCount) {
      showToast('已暂存为「悬空半截刀口」：下一刀与它交汇即可拼成 T/Y 型分镜');
    }
    requestRender();
  }

  // ==================== 独立框选裁剪器调用 ====================
  function openCropForCell(cell) {
    const asset = state.assetMap.get(cell.assetId);
    if (!asset) return;
    window.CropModal.open({
      asset,
      transform: cell.transform,
      cellAspect: cell.bounds.w / Math.max(1, cell.bounds.h),
      onApply: (newTf) => {
        cell.transform = newTf;
        pushHistory();
        renderSelectionInspector();
        requestRender();
      }
    });
  }

  function openCropForFrame(ff) {
    const asset = state.assetMap.get(ff.assetId);
    if (!asset) return;
    window.CropModal.open({
      asset,
      transform: ff.transform,
      cellAspect: (ff.w * state.canvasW) / Math.max(1, ff.h * state.canvasH),
      onApply: (newTf) => {
        ff.transform = newTf;
        pushHistory();
        renderSelectionInspector();
        requestRender();
      }
    });
  }

  // ==================== 右侧悬浮坞上半区：选中对象精调属性 ====================
  function renderSelectionInspector() {
    const emptyHintEl = document.getElementById('inspectorEmptyHint');
    if (!state.selection) {
      floatingInspectorEl.classList.remove('visible');
      floatingInspectorEl.innerHTML = '';
      if (emptyHintEl) emptyHintEl.style.display = 'block';
      return;
    }

    const { type, id } = state.selection;
    if (emptyHintEl) emptyHintEl.style.display = 'none';
    floatingInspectorEl.classList.add('visible');

    if (type === 'cell') {
      const idx = state.topology.cells.findIndex(c => c.id === id);
      const cell = state.topology.cells[idx];
      if (!cell) { floatingInspectorEl.classList.remove('visible'); return; }
      const asset = cell.assetId ? state.assetMap.get(cell.assetId) : null;
      const tf = cell.transform || window.PlanarSlicer.createDefaultImageTransform();
      if (!cell.fx) {
        cell.fx = {
          blurPad: false,
          blurAmount: 28,
          blurBrightness: 82,
          colorFilter: 'none',
          mangaLines: 'none',
          mangaColorMode: 'auto',
          mangaCustomColor: '#0f172a',
          mangaOpacity: 0.78,
          mangaFocusX: 0.5,
          mangaFocusY: 0.38,
          mangaSafeR: 0.34,
          popOut: false
        };
      }
      const isBlurContain = !!cell.fx.blurPad;
      const isPickingFocus = state.pickingMangaFocusCellId === cell.id;
      const mColorMode = cell.fx.mangaColorMode || 'auto';

      floatingInspectorEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--accent);">分镜格 #${idx + 1}</strong>
          <button class="drawer-close-btn" id="inspCloseBtn" title="取消选中">✕</button>
        </div>
        ${asset ? `
          <div class="seg-tabs" title="铺满裁切：填满异形格裁去多余边；完整全图·磨砂补边：完整保留原图不裁头脚，四周自动铺满同图高斯模糊磨砂背景">
            <button class="seg-tab ${!isBlurContain ? 'active' : ''}" id="inspModeCover">铺满裁切</button>
            <button class="seg-tab ${isBlurContain ? 'active' : ''}" id="inspModeBlurContain">完整全图 · 磨砂补边</button>
          </div>
          ${isBlurContain ? `
            <div style="background:var(--bg-panel-alt); border:1px solid var(--border-subtle); border-radius:8px; padding:7px 8px; display:flex; flex-direction:column; gap:6px;">
              <div class="form-row">
                <span class="form-label">磨砂模糊度</span>
                <div class="range-wrap">
                  <input type="range" id="inspBlurAmountRng" min="6" max="56" step="2" value="${cell.fx.blurAmount ?? 28}" />
                  <span class="val-tag" id="inspBlurAmountLbl">${cell.fx.blurAmount ?? 28}px</span>
                </div>
              </div>
              <div class="form-row">
                <span class="form-label">背景明暗度</span>
                <div class="range-wrap">
                  <input type="range" id="inspBlurBrightRng" min="45" max="130" step="5" value="${cell.fx.blurBrightness ?? 82}" />
                  <span class="val-tag" id="inspBlurBrightLbl">${cell.fx.blurBrightness ?? 82}%</span>
                </div>
              </div>
            </div>
          ` : ''}
          <div class="form-row">
            <span class="form-label">图片缩放</span>
            <div class="range-wrap">
              <input type="range" id="inspCellScale" min="0.25" max="6" step="0.05" value="${tf.scale || 1}" />
              <span class="val-tag" id="inspCellScaleLbl">${Math.round((tf.scale || 1) * 100)}%</span>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">微调角度</span>
            <div class="range-wrap">
              <input type="range" id="inspCellFineAng" min="-45" max="45" step="1" value="${tf.fineAngle || 0}" />
              <span class="val-tag" id="inspCellFineAngLbl">${tf.fineAngle || 0}°</span>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;">
            <button class="btn btn-sm" id="inspCellRotLeft" title="左转 90°">↺ 左90°</button>
            <button class="btn btn-sm" id="inspCellRotRight" title="右转 90°">↻ 右90°</button>
            <button class="btn btn-sm ${tf.flipX ? 'btn-primary' : ''}" id="inspCellFlipX" title="水平镜像翻转">⇆ 水平</button>
            <button class="btn btn-sm ${tf.flipY ? 'btn-primary' : ''}" id="inspCellFlipY" title="垂直镜像翻转">⇅ 垂直</button>
          </div>
          <button class="btn btn-primary btn-sm" id="inspBtnOpenCrop">✂ 框选裁剪区域 / 精调构图</button>
          <div style="display:flex; gap:5px;">
            <button class="btn btn-sm" id="inspBtnResetTf" style="flex:1;">重置选区</button>
            <button class="btn btn-sm btn-danger" id="inspBtnClearCellImg" style="flex:1;">移除图片</button>
          </div>
        ` : `<div style="font-size:11.5px; color:var(--text-muted);">从左侧素材库拖入图片或双击素材卡片填充</div>`}

        <details class="fold-group" open>
          <summary>单格画面效果</summary>
          <div class="fold-body">
            <div style="display:flex; gap:4px;">
              <button class="btn btn-sm" id="inspEyePopBtn" style="flex:1; border-color:var(--accent-border); color:var(--accent);" title="仅保留当前分镜格为鲜明彩色，其余所有分镜格一键转为黑白反差">局部留色（仅此格彩色）</button>
              <button class="btn btn-sm" id="inspRestoreAllColorBtn" title="恢复全部格子为原色">恢复</button>
            </div>
            <div class="form-row">
              <span class="form-label">单格滤镜</span>
              <select class="select" id="inspCellFilter" style="width:142px;">
                <option value="none" ${cell.fx.colorFilter === 'none' ? 'selected' : ''}>原色无滤镜</option>
                <option value="vivid" ${cell.fx.colorFilter === 'vivid' ? 'selected' : ''}>高饱和鲜明</option>
                <option value="bw" ${cell.fx.colorFilter === 'bw' ? 'selected' : ''}>高反差黑白</option>
                <option value="cold" ${cell.fx.colorFilter === 'cold' ? 'selected' : ''}>清冷低饱和</option>
                <option value="invert" ${cell.fx.colorFilter === 'invert' ? 'selected' : ''}>负片反相</option>
                <option value="sepia" ${cell.fx.colorFilter === 'sepia' ? 'selected' : ''}>复古胶片色</option>
              </select>
            </div>
            <div class="form-row">
              <span class="form-label">氛围线条</span>
              <select class="select" id="inspCellMangaLines" style="width:142px;">
                <option value="none" ${cell.fx.mangaLines === 'none' ? 'selected' : ''}>无</option>
                <option value="focus" ${cell.fx.mangaLines === 'focus' ? 'selected' : ''}>放射集中线</option>
                <option value="speed" ${cell.fx.mangaLines === 'speed' ? 'selected' : ''}>斜向速度线</option>
                <option value="rain" ${cell.fx.mangaLines === 'rain' ? 'selected' : ''}>凄美细雨线</option>
                <option value="sparkle" ${cell.fx.mangaLines === 'sparkle' ? 'selected' : ''}>星芒柔光氛围</option>
              </select>
            </div>
            ${cell.fx.mangaLines && cell.fx.mangaLines !== 'none' ? `
              <div style="background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:8px; padding:7px 8px; display:flex; flex-direction:column; gap:6px;">
                <div class="form-row">
                  <span class="form-label">线条颜色</span>
                  <div style="display:flex; align-items:center; gap:4px;">
                    <select class="select" id="inspMangaColorMode" style="width:108px; padding:3px 5px;">
                      <option value="auto" ${mColorMode === 'auto' ? 'selected' : ''}>智能适配</option>
                      <option value="ink" ${mColorMode === 'ink' ? 'selected' : ''}>墨黑线条</option>
                      <option value="white" ${mColorMode === 'white' ? 'selected' : ''}>纯白高光</option>
                      <option value="theme" ${mColorMode === 'theme' ? 'selected' : ''}>画面主题色</option>
                      <option value="custom" ${mColorMode === 'custom' ? 'selected' : ''}>自选颜色</option>
                    </select>
                    <input type="color" id="inspMangaCustomCol" value="${cell.fx.mangaCustomColor || '#0f172a'}" style="display:${mColorMode === 'custom' ? 'inline-block' : 'none'};" />
                  </div>
                </div>
                <div class="form-row">
                  <span class="form-label">线条透明</span>
                  <div class="range-wrap">
                    <input type="range" id="inspMangaOpacityRng" min="15" max="100" value="${Math.round((cell.fx.mangaOpacity ?? 0.78) * 100)}" />
                    <span class="val-tag" id="inspMangaOpacityLbl">${Math.round((cell.fx.mangaOpacity ?? 0.78) * 100)}%</span>
                  </div>
                </div>
                <div class="form-row">
                  <span class="form-label">留空半径</span>
                  <div class="range-wrap">
                    <input type="range" id="inspMangaSafeRng" min="10" max="65" value="${Math.round((cell.fx.mangaSafeR ?? 0.34) * 100)}" />
                    <span class="val-tag" id="inspMangaSafeLbl">${Math.round((cell.fx.mangaSafeR ?? 0.34) * 100)}%</span>
                  </div>
                </div>
                <button class="btn btn-sm ${isPickingFocus ? 'btn-primary' : ''}" id="inspPickMangaFocusBtn" title="点击此按钮后，直接在画布上点击角色眼睛或视觉中心即可将线条焦点精准移过去！">
                  ${isPickingFocus ? '请在画布上点击目标焦点位置…' : '🎯 点击画面定焦点（对准眼睛）'}
                </button>
              </div>
            ` : ''}
            <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; cursor:pointer;">
              <input type="checkbox" id="inspPopOutChk" ${cell.fx.popOut ? 'checked' : ''} />
              <span>单格立体悬浮阴影</span>
            </label>
          </div>
        </details>

        <details class="fold-group">
          <summary>槽位编号与备注</summary>
          <div class="fold-body">
            <div class="form-row">
              <span class="form-label">槽位备注</span>
              <input type="text" class="input" id="inspSlotLabel" value="${escapeHtml(cell.slotLabel || '')}" placeholder="如：#1 主画面" style="width:135px;" />
            </div>
            <div class="form-row">
              <span class="form-label">填图序号</span>
              <input type="number" class="input input-num" id="inspSlotOrder" value="${cell.slotOrder || (idx + 1)}" min="1" max="99" />
            </div>
          </div>
        </details>
      `;

      document.getElementById('inspCloseBtn').addEventListener('click', () => selectItem(null, null));
      document.getElementById('inspSlotLabel').addEventListener('change', (ev) => { cell.slotLabel = ev.target.value; pushHistory(); requestRender(); });
      document.getElementById('inspSlotOrder').addEventListener('change', (ev) => { cell.slotOrder = parseInt(ev.target.value, 10) || null; pushHistory(); requestRender(); });

      document.getElementById('inspEyePopBtn').addEventListener('click', () => {
        for (const c of state.topology.cells) {
          if (!c.fx) c.fx = { blurPad: false, blurAmount: 28, colorFilter: 'none', mangaLines: 'none', popOut: false };
          c.fx.colorFilter = c.id === cell.id ? 'vivid' : 'bw';
        }
        pushHistory();
        renderSelectionInspector();
        requestRender();
        showToast('已开启局部留色：当前分镜保留鲜明彩色，其余分镜已转为黑白反差');
      });
      document.getElementById('inspRestoreAllColorBtn').addEventListener('click', () => {
        for (const c of state.topology.cells) {
          if (c.fx) c.fx.colorFilter = 'none';
        }
        pushHistory();
        renderSelectionInspector();
        requestRender();
      });
      document.getElementById('inspCellFilter').addEventListener('change', (ev) => {
        cell.fx.colorFilter = ev.target.value;
        pushHistory(); requestRender();
      });
      document.getElementById('inspCellMangaLines').addEventListener('change', (ev) => {
        cell.fx.mangaLines = ev.target.value;
        state.pickingMangaFocusCellId = null;
        updateCursorStyle();
        pushHistory(); renderSelectionInspector(); requestRender();
      });
      if (cell.fx.mangaLines && cell.fx.mangaLines !== 'none') {
        document.getElementById('inspMangaColorMode').addEventListener('change', (ev) => {
          cell.fx.mangaColorMode = ev.target.value;
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        const customColEl = document.getElementById('inspMangaCustomCol');
        if (customColEl) {
          customColEl.addEventListener('input', (ev) => {
            cell.fx.mangaCustomColor = ev.target.value;
            requestRender();
          });
          customColEl.addEventListener('change', () => pushHistory());
        }
        const opRng = document.getElementById('inspMangaOpacityRng');
        opRng.addEventListener('input', (ev) => {
          cell.fx.mangaOpacity = (parseInt(ev.target.value, 10) || 78) / 100;
          document.getElementById('inspMangaOpacityLbl').textContent = `${Math.round(cell.fx.mangaOpacity * 100)}%`;
          requestRender();
        });
        opRng.addEventListener('change', () => pushHistory());

        const safeRng = document.getElementById('inspMangaSafeRng');
        safeRng.addEventListener('input', (ev) => {
          cell.fx.mangaSafeR = (parseInt(ev.target.value, 10) || 34) / 100;
          document.getElementById('inspMangaSafeLbl').textContent = `${Math.round(cell.fx.mangaSafeR * 100)}%`;
          requestRender();
        });
        safeRng.addEventListener('change', () => pushHistory());

        document.getElementById('inspPickMangaFocusBtn').addEventListener('click', () => {
          if (state.pickingMangaFocusCellId === cell.id) {
            state.pickingMangaFocusCellId = null;
            document.getElementById('toolHintText').textContent = TOOL_HINTS[state.tool] || TOOL_HINTS.select;
          } else {
            state.pickingMangaFocusCellId = cell.id;
            document.getElementById('toolHintText').textContent = '🎯 请直接在画布中点击角色眼睛或视觉中心以设定线条焦点';
            showToast('请在画布中单击角色眼睛位置以设定焦点');
          }
          updateCursorStyle();
          renderSelectionInspector();
          requestRender();
        });
      }
      document.getElementById('inspPopOutChk').addEventListener('change', (ev) => {
        cell.fx.popOut = ev.target.checked;
        pushHistory(); requestRender();
      });

      if (asset) {
        document.getElementById('inspModeCover').addEventListener('click', () => {
          if (!cell.fx.blurPad) return;
          cell.fx.blurPad = false;
          if (!cell.transform) cell.transform = window.PlanarSlicer.createDefaultImageTransform();
          cell.transform.fitMode = 'cover';
          cell.transform.scale = 1;
          cell.transform.panX = 0;
          cell.transform.panY = 0;
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        document.getElementById('inspModeBlurContain').addEventListener('click', () => {
          cell.fx.blurPad = true;
          if (cell.fx.blurAmount == null) cell.fx.blurAmount = 28;
          if (cell.fx.blurBrightness == null) cell.fx.blurBrightness = 82;
          if (!cell.transform) cell.transform = window.PlanarSlicer.createDefaultImageTransform();
          cell.transform.fitMode = 'contain';
          cell.transform.scale = 1;
          cell.transform.panX = 0;
          cell.transform.panY = 0;
          pushHistory(); renderSelectionInspector(); requestRender();
          showToast('已切换为「完整全图 · 磨砂补边」：原图已完整居中保留，四周留白由同图磨砂自动补齐');
        });
        if (isBlurContain) {
          const bAmt = document.getElementById('inspBlurAmountRng');
          bAmt.addEventListener('input', (ev) => {
            cell.fx.blurAmount = parseInt(ev.target.value, 10) || 28;
            document.getElementById('inspBlurAmountLbl').textContent = `${cell.fx.blurAmount}px`;
            requestRender();
          });
          bAmt.addEventListener('change', () => pushHistory());

          const bBrt = document.getElementById('inspBlurBrightRng');
          bBrt.addEventListener('input', (ev) => {
            cell.fx.blurBrightness = parseInt(ev.target.value, 10) || 82;
            document.getElementById('inspBlurBrightLbl').textContent = `${cell.fx.blurBrightness}%`;
            requestRender();
          });
          bBrt.addEventListener('change', () => pushHistory());
        }
        document.getElementById('inspCellScale').addEventListener('input', (ev) => {
          cell.transform.scale = parseFloat(ev.target.value) || 1;
          document.getElementById('inspCellScaleLbl').textContent = `${Math.round(cell.transform.scale * 100)}%`;
          requestRender();
        });
        document.getElementById('inspCellScale').addEventListener('change', () => pushHistory());
        document.getElementById('inspCellFineAng').addEventListener('input', (ev) => {
          cell.transform.fineAngle = parseInt(ev.target.value, 10) || 0;
          document.getElementById('inspCellFineAngLbl').textContent = `${cell.transform.fineAngle}°`;
          requestRender();
        });
        document.getElementById('inspCellFineAng').addEventListener('change', () => pushHistory());
        document.getElementById('inspCellRotLeft').addEventListener('click', () => {
          cell.transform.rot90 = ((cell.transform.rot90 || 0) - 90 + 360) % 360;
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        document.getElementById('inspCellRotRight').addEventListener('click', () => {
          cell.transform.rot90 = ((cell.transform.rot90 || 0) + 90) % 360;
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        document.getElementById('inspCellFlipX').addEventListener('click', () => {
          cell.transform.flipX = !cell.transform.flipX;
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        document.getElementById('inspCellFlipY').addEventListener('click', () => {
          cell.transform.flipY = !cell.transform.flipY;
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        document.getElementById('inspBtnOpenCrop').addEventListener('click', () => openCropForCell(cell));
        document.getElementById('inspBtnResetTf').addEventListener('click', () => {
          cell.transform = window.PlanarSlicer.createDefaultImageTransform();
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        document.getElementById('inspBtnClearCellImg').addEventListener('click', () => {
          cell.assetId = null;
          pushHistory(); renderAssetGridUI(); renderSelectionInspector(); requestRender();
        });
      }
      return;
    }

    if (type === 'frame') {
      const ff = state.freeFrames.find(f => f.id === id);
      if (!ff) { floatingInspectorEl.classList.remove('visible'); return; }
      const tf = ff.transform || window.PlanarSlicer.createDefaultImageTransform();

      floatingInspectorEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--accent);">自由相框设定</strong>
          <button class="drawer-close-btn" id="inspCloseBtn">✕</button>
        </div>
        ${ff.assetId ? `
          <details class="fold-group" open>
            <summary>🖼 框内图片显示区域</summary>
            <div class="fold-body">
              <div style="display:flex; gap:4px;">
                <button class="btn btn-sm ${state.frameEditImageMode ? 'btn-primary' : ''}" id="inspModeImg" style="flex:1;">拖动图片选区</button>
                <button class="btn btn-sm ${!state.frameEditImageMode ? 'btn-primary' : ''}" id="inspModeFrame" style="flex:1;">移动相框位置</button>
              </div>
              <div class="form-row">
                <span class="form-label">框内缩放</span>
                <div class="range-wrap">
                  <input type="range" id="ffImgScale" min="0.25" max="6" step="0.05" value="${tf.scale || 1}" />
                  <span class="val-tag" id="ffImgScaleLbl">${Math.round((tf.scale || 1) * 100)}%</span>
                </div>
              </div>
              <button class="btn btn-primary btn-sm" id="ffOpenCrop">✂ 框选裁剪区域 / 旋转翻转</button>
              <div style="display:flex; gap:5px;">
                <button class="btn btn-sm" id="ffResetImgTf" style="flex:1;">居中重置</button>
                <button class="btn btn-sm btn-danger" id="ffClearImg" style="flex:1;">清空图片</button>
              </div>
            </div>
          </details>
        ` : `<div style="font-size:11.5px; color:var(--text-muted);">拖入图片到该相框后即可自由调整图片显示区域</div>`}

        <label style="display:flex; align-items:flex-start; gap:6px; font-size:11.5px; cursor:pointer; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.10); border:1px solid rgba(56,189,248,0.28);">
          <input type="checkbox" id="ffFollowCellChk" ${ff.followHostCell ? 'checked' : ''} style="margin-top:2px;" />
          <span>🔗 <strong>随所属分镜同步缩放与转向</strong><br/><span style="font-size:10.5px; color:var(--text-muted);">开启后：调整底下所属分镜图片大小或方向时，此相框同步跟随变换；关闭则保持独立不动</span></span>
        </label>

        <details class="fold-group" ${ff.assetId ? '' : 'open'}>
          <summary>相框外观与层级</summary>
          <div class="fold-body">
            <div style="display:flex; gap:4px;">
              <button class="btn btn-sm" id="ffBringFront" style="flex:1;">置顶</button>
              <button class="btn btn-sm" id="ffSendBack" style="flex:1;">置底</button>
              <button class="btn btn-sm btn-danger" id="ffDelete">删除相框</button>
            </div>
            <div class="form-row">
              <span class="form-label">不透明度</span>
              <div class="range-wrap">
                <input type="range" id="ffOpacityRng" min="15" max="100" value="${Math.round((ff.opacity ?? 1) * 100)}" />
                <span class="val-tag">${Math.round((ff.opacity ?? 1) * 100)}%</span>
              </div>
            </div>
            <div class="form-row">
              <span class="form-label">旋转角度</span>
              <div class="range-wrap">
                <input type="range" id="ffRot" min="-180" max="180" value="${Math.round(ff.rotation || 0)}" />
                <span class="val-tag">${Math.round(ff.rotation || 0)}°</span>
              </div>
            </div>
            ${ff.shape === 'polaroid' ? `
              <div class="form-row">
                <span class="form-label">底部手账字</span>
                <input type="text" class="input" id="ffCaption" value="${escapeHtml(ff.caption || '')}" style="width:135px;" />
              </div>
            ` : `
              <div class="form-row">
                <span class="form-label">相框描边</span>
                <div class="range-wrap">
                  <input type="color" id="ffBorderCol" value="${ff.borderColor || '#ffffff'}" />
                  <input type="range" id="ffBorderW" min="0" max="24" value="${ff.borderWidth ?? 4}" style="width:70px;" />
                </div>
              </div>
            `}
            <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; cursor:pointer;">
              <input type="checkbox" id="ffShadowChk" ${ff.shadow ? 'checked' : ''} /> 立体投影阴影
            </label>
            ${ff.silhouetteMeta ? `<button class="btn btn-sm" id="ffOpenSilFusionBtn" style="border-color:var(--accent-cyan); color:var(--accent-cyan);">调整剪影融合玩法 / 修补轮廓</button>` : ''}
          </div>
        </details>
      `;

      document.getElementById('inspCloseBtn').addEventListener('click', () => selectItem(null, null));
      const silJumpBtn = document.getElementById('ffOpenSilFusionBtn');
      if (silJumpBtn) {
        silJumpBtn.addEventListener('click', () => {
          openDrawer('creative', false);
          renderCreativePanelUI();
        });
      }
      if (ff.assetId) {
        document.getElementById('inspModeImg').addEventListener('click', () => {
          state.frameEditImageMode = true; renderSelectionInspector(); requestRender();
        });
        document.getElementById('inspModeFrame').addEventListener('click', () => {
          state.frameEditImageMode = false; renderSelectionInspector(); requestRender();
        });
        document.getElementById('ffImgScale').addEventListener('input', (ev) => {
          if (!ff.transform) ff.transform = window.PlanarSlicer.createDefaultImageTransform();
          ff.transform.scale = parseFloat(ev.target.value) || 1;
          document.getElementById('ffImgScaleLbl').textContent = `${Math.round(ff.transform.scale * 100)}%`;
          requestRender();
        });
        document.getElementById('ffImgScale').addEventListener('change', () => pushHistory());
        document.getElementById('ffOpenCrop').addEventListener('click', () => openCropForFrame(ff));
        document.getElementById('ffResetImgTf').addEventListener('click', () => {
          ff.transform = window.PlanarSlicer.createDefaultImageTransform();
          pushHistory(); renderSelectionInspector(); requestRender();
        });
        document.getElementById('ffClearImg').addEventListener('click', () => {
          ff.assetId = null;
          pushHistory(); renderAssetGridUI(); renderSelectionInspector(); requestRender();
        });
      }

      document.getElementById('ffFollowCellChk').addEventListener('change', (ev) => {
        ff.followHostCell = ev.target.checked;
        if (window.FxLabEngine) window.FxLabEngine.recordFrameHostAnchor(ff, state);
        updateFloatingFrameBarPosition();
        pushHistory();
        requestRender();
        showToast(ff.followHostCell ? '🔗 已开启：调整所属分镜图片大小与方向时，该相框将同步跟随调整' : '🔓 已关闭联动：调整底下分镜图片时，该相框保持固定不动');
      });

      document.getElementById('ffBringFront').addEventListener('click', () => {
        ff.zOrder = allocZOrder();
        state.freeFrames = state.freeFrames.filter(f => f.id !== ff.id).concat([ff]);
        pushHistory(); requestRender();
      });
      document.getElementById('ffSendBack').addEventListener('click', () => {
        const all = getAllOverlayEntriesSortedDesc();
        const minZ = all.length > 0 ? all[all.length - 1].z : 1;
        ff.zOrder = minZ - 1;
        state.freeFrames = [ff].concat(state.freeFrames.filter(f => f.id !== ff.id));
        pushHistory(); requestRender();
      });
      document.getElementById('ffDelete').addEventListener('click', () => {
        state.freeFrames = state.freeFrames.filter(f => f.id !== ff.id);
        selectItem(null, null); pushHistory(); renderAssetGridUI(); requestRender();
      });
      document.getElementById('ffOpacityRng').addEventListener('input', (ev) => {
        ff.opacity = (parseInt(ev.target.value, 10) || 100) / 100;
        ev.target.nextElementSibling.textContent = `${Math.round(ff.opacity * 100)}%`;
        requestRender();
      });
      document.getElementById('ffOpacityRng').addEventListener('change', () => pushHistory());
      document.getElementById('ffRot').addEventListener('input', (ev) => {
        ff.rotation = parseInt(ev.target.value, 10) || 0;
        ev.target.nextElementSibling.textContent = `${ff.rotation}°`;
        if (ff.followHostCell && window.FxLabEngine) {
          window.FxLabEngine.recordFrameHostAnchor(ff, state);
        }
        requestRender();
      });
      document.getElementById('ffRot').addEventListener('change', () => pushHistory());
      document.getElementById('ffShadowChk').addEventListener('change', (ev) => {
        ff.shadow = ev.target.checked; pushHistory(); requestRender();
      });
      const capEl = document.getElementById('ffCaption');
      if (capEl) capEl.addEventListener('input', (ev) => { ff.caption = ev.target.value; requestRender(); });
      const bColEl = document.getElementById('ffBorderCol');
      if (bColEl) {
        bColEl.addEventListener('input', (ev) => { ff.borderColor = ev.target.value; requestRender(); });
        document.getElementById('ffBorderW').addEventListener('input', (ev) => { ff.borderWidth = parseInt(ev.target.value, 10) || 0; requestRender(); });
      }
      return;
    }

    if (type === 'cut') {
      const cut = state.cuts.find(c => c.id === id);
      if (!cut) { floatingInspectorEl.classList.remove('visible'); return; }
      floatingInspectorEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--warning);">分割刀口设定</strong>
          <button class="drawer-close-btn" id="inspCloseBtn">✕</button>
        </div>
        <div style="font-size:11px; color:var(--text-secondary);">拖拽画布上的橙色锚点或青色控制柄可实时变形</div>
        ${cut.points.length === 2 && !cut.closed ? `<button class="btn btn-sm" id="inspToggleCutCurve">⇄ 切换为 ${cut.mode === 'curve' ? '直线' : 'C弧/S曲线'}</button>` : ''}
        <button class="btn btn-sm btn-danger" id="inspDeleteCut">🗑 删除此分割线并合并两侧格子</button>
      `;
      document.getElementById('inspCloseBtn').addEventListener('click', () => selectItem(null, null));
      const btnTog = document.getElementById('inspToggleCutCurve');
      if (btnTog) {
        btnTog.addEventListener('click', () => {
          if (cut.mode === 'curve') cut.mode = 'line';
          else {
            cut.mode = 'curve';
            const p0 = cut.points[0], p1 = cut.points[1];
            const dx = p1.x - p0.x, dy = p1.y - p0.y;
            cut.cp1 = { x: p0.x + dx * 0.33 - dy * 0.16, y: p0.y + dy * 0.33 + dx * 0.16 };
            cut.cp2 = { x: p0.x + dx * 0.67 + dy * 0.16, y: p0.y + dy * 0.67 - dx * 0.16 };
          }
          rebuildTopology(); pushHistory(); renderSelectionInspector(); requestRender();
        });
      }
      document.getElementById('inspDeleteCut').addEventListener('click', () => {
        state.cuts = state.cuts.filter(c => c.id !== cut.id);
        selectItem(null, null); rebuildTopology(); pushHistory(); requestRender();
      });
      return;
    }

    if (type === 'text') {
      const txt = state.texts.find(t => t.id === id);
      if (!txt) { floatingInspectorEl.classList.remove('visible'); return; }
      const fontOpts = state.systemFonts
        .map(f => `<option value="${escapeHtml(f)}" ${f === txt.fontFamily ? 'selected' : ''}>${escapeHtml(f)}</option>`)
        .join('');

      floatingInspectorEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--accent);">文字与气泡</strong>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-sm btn-danger" id="txtDelete">删除</button>
            <button class="drawer-close-btn" id="inspCloseBtn">✕</button>
          </div>
        </div>
        <textarea class="input" id="txtContent" rows="2">${escapeHtml(txt.text)}</textarea>
        <div class="form-row">
          <span class="form-label">字体</span>
          <select class="select" id="txtFont" style="width:165px;">${fontOpts}</select>
        </div>
        <div class="form-row">
          <span class="form-label">字号</span>
          <div class="range-wrap">
            <input type="range" id="txtSize" min="14" max="160" value="${txt.fontSize || 36}" />
            <span class="val-tag">${txt.fontSize || 36}px</span>
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">字色/描边</span>
          <div style="display:flex; align-items:center; gap:5px;">
            <input type="color" id="txtColor" value="${txt.color || '#111827'}" />
            <input type="color" id="txtStrokeColor" value="${txt.strokeColor || '#ffffff'}" />
            <input type="number" class="input input-num" id="txtStrokeW" value="${txt.strokeWidth || 0}" min="0" max="20" style="width:48px;" />
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">气泡框</span>
          <select class="select" id="txtBubbleType" style="width:155px;">
            <option value="plain" ${txt.bubbleType === 'plain' ? 'selected' : ''}>纯艺术字</option>
            <option value="tag" ${txt.bubbleType === 'tag' ? 'selected' : ''}>圆角标签框</option>
            <option value="speech" ${txt.bubbleType === 'speech' ? 'selected' : ''}>漫画椭圆台词框</option>
            <option value="narration" ${txt.bubbleType === 'narration' ? 'selected' : ''}>双线矩形旁白框</option>
            <option value="burst" ${txt.bubbleType === 'burst' ? 'selected' : ''}>爆发锯齿气泡</option>
          </select>
        </div>
        ${txt.bubbleType !== 'plain' ? `
          <div class="form-row">
            <span class="form-label">气泡配色</span>
            <div style="display:flex; gap:5px;">
              <input type="color" id="txtBubbleFill" value="${txt.bubbleFill || '#ffffff'}" />
              <input type="color" id="txtBubbleStroke" value="${txt.bubbleStroke || '#111827'}" />
            </div>
          </div>
        ` : ''}
        ${txt.bubbleType === 'speech' ? `
          <div class="form-row">
            <span class="form-label">尾巴方向</span>
            <div class="range-wrap">
              <input type="range" id="txtTailAng" min="0" max="360" value="${txt.tailAngle ?? 125}" />
              <span class="val-tag">${txt.tailAngle ?? 125}°</span>
            </div>
          </div>
        ` : ''}
        <div style="display:flex; gap:5px;">
          <button class="btn btn-sm ${txt.bold ? 'btn-primary' : ''}" id="txtBoldBtn" style="flex:1;">B 粗体</button>
          <button class="btn btn-sm ${txt.italic ? 'btn-primary' : ''}" id="txtItalicBtn" style="flex:1;">I 斜体</button>
        </div>
      `;

      document.getElementById('inspCloseBtn').addEventListener('click', () => selectItem(null, null));
      document.getElementById('txtDelete').addEventListener('click', () => {
        state.texts = state.texts.filter(t => t.id !== txt.id);
        selectItem(null, null); pushHistory(); requestRender();
      });
      document.getElementById('txtContent').addEventListener('input', (ev) => { txt.text = ev.target.value; requestRender(); });
      document.getElementById('txtContent').addEventListener('change', () => pushHistory());
      document.getElementById('txtFont').addEventListener('change', (ev) => { txt.fontFamily = ev.target.value; pushHistory(); requestRender(); });
      document.getElementById('txtSize').addEventListener('input', (ev) => {
        txt.fontSize = parseInt(ev.target.value, 10) || 32;
        ev.target.nextElementSibling.textContent = `${txt.fontSize}px`;
        requestRender();
      });
      document.getElementById('txtColor').addEventListener('input', (ev) => { txt.color = ev.target.value; requestRender(); });
      document.getElementById('txtStrokeColor').addEventListener('input', (ev) => { txt.strokeColor = ev.target.value; requestRender(); });
      document.getElementById('txtStrokeW').addEventListener('input', (ev) => { txt.strokeWidth = parseFloat(ev.target.value) || 0; requestRender(); });
      document.getElementById('txtBubbleType').addEventListener('change', (ev) => {
        txt.bubbleType = ev.target.value; pushHistory(); renderSelectionInspector(); requestRender();
      });
      const bfEl = document.getElementById('txtBubbleFill');
      if (bfEl) {
        bfEl.addEventListener('input', (ev) => { txt.bubbleFill = ev.target.value; requestRender(); });
        document.getElementById('txtBubbleStroke').addEventListener('input', (ev) => { txt.bubbleStroke = ev.target.value; requestRender(); });
      }
      const tailEl = document.getElementById('txtTailAng');
      if (tailEl) {
        tailEl.addEventListener('input', (ev) => {
          txt.tailAngle = parseInt(ev.target.value, 10) || 0;
          ev.target.nextElementSibling.textContent = `${txt.tailAngle}°`;
          requestRender();
        });
      }
      document.getElementById('txtBoldBtn').addEventListener('click', () => { txt.bold = !txt.bold; pushHistory(); renderSelectionInspector(); requestRender(); });
      document.getElementById('txtItalicBtn').addEventListener('click', () => { txt.italic = !txt.italic; pushHistory(); renderSelectionInspector(); requestRender(); });
      return;
    }

    if (type === 'sticker') {
      const st = state.stickers.find(s => s.id === id);
      if (!st) { floatingInspectorEl.classList.remove('visible'); return; }
      const isBound = st.anchorType && st.anchorType !== 'none';

      floatingInspectorEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#f472b6;">🐾 贴脸装饰设定</strong>
          <button class="drawer-close-btn" id="inspCloseBtn">✕</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;">
          <button class="btn btn-sm" id="stFlipH" title="水平镜像翻转（适配左右侧脸）">⇆ 翻转</button>
          <button class="btn btn-sm" id="stDuplicate" title="复制一份相同装饰（方便做双耳）">📋 复制</button>
          <button class="btn btn-sm" id="stBringTop" title="移到最上层">置顶</button>
          <button class="btn btn-sm btn-danger" id="stDelete" title="删除此装饰">删除</button>
        </div>

        ${st.kind === 'builtin' ? `
          <div class="form-row">
            <span class="form-label">毛色/内耳/边</span>
            <div style="display:flex; align-items:center; gap:5px;">
              <button class="btn btn-sm" id="stEyedropperCol1" style="padding:2px 5px;" title="吸取角色头发颜色作为猫耳主色！">💉</button>
              <input type="color" id="stCol1" value="${st.color1 || '#27272a'}" title="主色（如猫耳毛色、眼镜框色）" />
              <input type="color" id="stCol2" value="${st.color2 || '#fda4af'}" title="副色（如内耳粉色、腮红晕色）" />
              <input type="color" id="stStroke" value="${st.strokeColor || '#18181b'}" title="外轮廓描边色" />
            </div>
          </div>
        ` : `
          <button class="btn btn-sm" id="stReChromaBtn">🪄 对此装饰重新一键抠除纯色底</button>
        `}

        <div class="form-row">
          <span class="form-label">横向宽度</span>
          <div class="range-wrap">
            <input type="range" id="stWidthRng" min="2" max="80" step="0.5" value="${Math.round(st.w * 1000) / 10}" />
            <span class="val-tag">${Math.round(st.w * state.canvasW)}px</span>
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">纵向高度</span>
          <div class="range-wrap">
            <input type="range" id="stHeightRng" min="2" max="80" step="0.5" value="${Math.round(st.h * 1000) / 10}" />
            <span class="val-tag">${Math.round(st.h * state.canvasH)}px</span>
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">旋转角度</span>
          <div class="range-wrap">
            <input type="range" id="stRotRng" min="-180" max="180" value="${Math.round(st.rotation || 0)}" />
            <span class="val-tag">${Math.round(st.rotation || 0)}°</span>
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">不透明度</span>
          <div class="range-wrap">
            <input type="range" id="stOpacityRng" min="15" max="100" value="${Math.round((st.opacity ?? 1) * 100)}" />
            <span class="val-tag">${Math.round((st.opacity ?? 1) * 100)}%</span>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:5px; padding-top:3px; border-top:1px solid var(--border-subtle);">
          <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; cursor:pointer;">
            <input type="checkbox" id="stFollowPhotoChk" ${st.followPhoto !== false ? 'checked' : ''} />
            <span>📌 绑定跟随底层角色照片 ${isBound ? '<b style="color:var(--success);">(已绑定)</b>' : ''}</span>
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; cursor:pointer;">
            <input type="checkbox" id="stBreakFrameChk" ${st.breakFrame !== false ? 'checked' : ''} />
            <span>✨ 允许猫耳/特效破框伸出分镜格</span>
          </label>
        </div>
      `;

      document.getElementById('inspCloseBtn').addEventListener('click', () => selectItem(null, null));
      document.getElementById('stFlipH').addEventListener('click', () => {
        st.flipX = !st.flipX; pushHistory(); requestRender();
      });
      document.getElementById('stDuplicate').addEventListener('click', () => {
        const copy = JSON.parse(JSON.stringify(st));
        copy.id = `st_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        copy.x = Math.min(0.96, st.x + 0.04);
        copy.y = Math.min(0.96, st.y + 0.02);
        copy.zOrder = allocZOrder();
        state.stickers.push(copy);
        autoBindStickerToUnderlyingPhoto(copy);
        selectItem('sticker', copy.id);
        pushHistory();
        requestRender();
      });
      document.getElementById('stBringTop').addEventListener('click', () => {
        st.zOrder = allocZOrder();
        state.stickers = state.stickers.filter(x => x.id !== st.id).concat([st]);
        pushHistory(); requestRender();
      });
      document.getElementById('stDelete').addEventListener('click', () => {
        state.stickers = state.stickers.filter(x => x.id !== st.id);
        selectItem(null, null); pushHistory(); requestRender();
      });

      if (st.kind === 'builtin') {
        document.getElementById('stEyedropperCol1').addEventListener('click', async () => {
          const picked = await window.FxLabEngine.pickScreenColorWithEyedropper();
          if (picked) {
            st.color1 = picked;
            document.getElementById('stCol1').value = picked;
            pushHistory();
            requestRender();
          }
        });
        document.getElementById('stCol1').addEventListener('input', (ev) => { st.color1 = ev.target.value; requestRender(); });
        document.getElementById('stCol2').addEventListener('input', (ev) => { st.color2 = ev.target.value; requestRender(); });
        document.getElementById('stStroke').addEventListener('input', (ev) => { st.strokeColor = ev.target.value; requestRender(); });
      } else {
        document.getElementById('stReChromaBtn').addEventListener('click', async () => {
          const cItem = state.customStickerMap.get(st.customId);
          if (!cItem) return;
          const rawImg = await loadImageElement(cItem.rawDataUrl || cItem.dataUrl);
          if (!rawImg) return;
          const tol = parseInt(document.getElementById('rngStickerChromaTol').value, 10) || 38;
          const modeSel = document.getElementById('selStickerBgRemove').value;
          const effMode = modeSel === 'none' ? 'auto' : modeSel;
          const cutUrl = window.StickerEngine.removeSolidBackgroundFromImage(rawImg, effMode, tol);
          const newImg = await loadImageElement(cutUrl);
          if (newImg) {
            cItem.dataUrl = cutUrl;
            cItem.img = newImg;
            const listObj = state.customStickers.find(x => x.id === cItem.id);
            if (listObj) listObj.dataUrl = cutUrl;
            if (window.desktopAPI) await window.desktopAPI.saveCustomStickers(state.customStickers);
            renderCustomStickerGalleryUI();
            requestRender();
            showToast('已完成纯色背景抠除并更新装饰透明通道！');
          }
        });
      }

      document.getElementById('stWidthRng').addEventListener('input', (ev) => {
        st.w = (parseFloat(ev.target.value) || 10) / 100;
        ev.target.nextElementSibling.textContent = `${Math.round(st.w * state.canvasW)}px`;
        autoBindStickerToUnderlyingPhoto(st);
        requestRender();
      });
      document.getElementById('stHeightRng').addEventListener('input', (ev) => {
        st.h = (parseFloat(ev.target.value) || 10) / 100;
        ev.target.nextElementSibling.textContent = `${Math.round(st.h * state.canvasH)}px`;
        autoBindStickerToUnderlyingPhoto(st);
        requestRender();
      });
      document.getElementById('stRotRng').addEventListener('input', (ev) => {
        st.rotation = parseInt(ev.target.value, 10) || 0;
        ev.target.nextElementSibling.textContent = `${st.rotation}°`;
        autoBindStickerToUnderlyingPhoto(st);
        requestRender();
      });
      document.getElementById('stOpacityRng').addEventListener('input', (ev) => {
        st.opacity = (parseInt(ev.target.value, 10) || 100) / 100;
        ev.target.nextElementSibling.textContent = `${Math.round(st.opacity * 100)}%`;
        requestRender();
      });
      document.getElementById('stFollowPhotoChk').addEventListener('change', (ev) => {
        st.followPhoto = ev.target.checked;
        autoBindStickerToUnderlyingPhoto(st);
        pushHistory(); renderSelectionInspector(); requestRender();
      });
      document.getElementById('stBreakFrameChk').addEventListener('change', (ev) => {
        st.breakFrame = ev.target.checked;
        pushHistory(); requestRender();
      });
      return;
    }

    if (type === 'loupe') {
      const lp = state.loupes.find(l => l.id === id);
      if (!lp) { floatingInspectorEl.classList.remove('visible'); return; }

      floatingInspectorEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--accent-cyan);">🔍 连线特写放大镜</strong>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-sm btn-danger" id="lpDelete">删除</button>
            <button class="drawer-close-btn" id="inspCloseBtn">✕</button>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-secondary);">拖动小圆圈对准角色五官/细节，拖动大框调整展示位置</div>
        <div class="form-row">
          <span class="form-label">放大倍率</span>
          <div class="range-wrap">
            <input type="range" id="lpZoom" min="1.5" max="8" step="0.2" value="${lp.zoom || 3.2}" />
            <span class="val-tag">${(lp.zoom || 3.2).toFixed(1)}x</span>
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">大框尺寸</span>
          <div class="range-wrap">
            <input type="range" id="lpSize" min="8" max="34" step="1" value="${Math.round((lp.dstSize || 0.15) * 100)}" />
            <span class="val-tag">${Math.round((lp.dstSize || 0.15) * 100)}%</span>
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">框体形状</span>
          <select class="select" id="lpShape" style="width:140px;">
            <option value="circle" ${lp.shape === 'circle' ? 'selected' : ''}>◯ 圆形放大镜</option>
            <option value="hex" ${lp.shape === 'hex' ? 'selected' : ''}>⬡ 战术六边形</option>
            <option value="rect" ${lp.shape === 'rect' ? 'selected' : ''}>▭ 设定集矩形框</option>
          </select>
        </div>
        <div class="form-row">
          <span class="form-label">引线颜色</span>
          <input type="color" id="lpColor" value="${lp.color || '#38bdf8'}" />
        </div>
        <div class="form-row">
          <span class="form-label">设定批注</span>
          <input type="text" class="input" id="lpLabel" value="${escapeHtml(lp.label || '')}" placeholder="如：EYE DETAIL // 01" style="width:148px;" />
        </div>
      `;

      document.getElementById('inspCloseBtn').addEventListener('click', () => selectItem(null, null));
      document.getElementById('lpDelete').addEventListener('click', () => {
        state.loupes = state.loupes.filter(x => x.id !== lp.id);
        selectItem(null, null); pushHistory(); requestRender();
      });
      document.getElementById('lpZoom').addEventListener('input', (ev) => {
        lp.zoom = parseFloat(ev.target.value) || 3;
        ev.target.nextElementSibling.textContent = `${lp.zoom.toFixed(1)}x`;
        requestRender();
      });
      document.getElementById('lpSize').addEventListener('input', (ev) => {
        lp.dstSize = (parseInt(ev.target.value, 10) || 15) / 100;
        ev.target.nextElementSibling.textContent = `${ev.target.value}%`;
        requestRender();
      });
      document.getElementById('lpShape').addEventListener('change', (ev) => { lp.shape = ev.target.value; pushHistory(); requestRender(); });
      document.getElementById('lpColor').addEventListener('input', (ev) => { lp.color = ev.target.value; requestRender(); });
      document.getElementById('lpLabel').addEventListener('input', (ev) => { lp.label = ev.target.value; requestRender(); });
    }
  }

  function renderCutListUI() {
    const badge = document.getElementById('cutCountBadge');
    const listBox = document.getElementById('cutListBox');
    badge.textContent = String(state.cuts.length);

    if (state.cuts.length === 0) {
      listBox.innerHTML = '当前无分割线（整块唯一外框）';
      return;
    }

    const danglingIds = new Set();
    for (const de of state.topology.danglingEdges) {
      for (const cid of de.cutIds) danglingIds.add(cid);
    }

    listBox.innerHTML = '';
    state.cuts.forEach((cut, idx) => {
      const isDang = danglingIds.has(cut.id);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:4px 7px; border-radius:5px; background:var(--bg-input); cursor:pointer; border:1px solid transparent;';
      if (state.selection && state.selection.type === 'cut' && state.selection.id === cut.id) {
        row.style.borderColor = 'var(--accent)';
      }
      const typeName = cut.closed ? '挖洞框' : cut.mode === 'curve' ? '弧线/S曲线' : cut.mode === 'free' ? '手绘曲线' : '直线/折线';
      row.innerHTML = `
        <span>#${idx + 1} ${typeName} ${isDang ? '<b style="color:var(--accent-cyan);">(待交汇)</b>' : ''}</span>
        <button class="btn btn-sm btn-danger" style="padding:1px 5px;">✕</button>
      `;
      row.addEventListener('click', () => { setActiveTool('select', false); selectItem('cut', cut.id); });
      row.querySelector('button').addEventListener('click', (ev) => {
        ev.stopPropagation();
        state.cuts = state.cuts.filter(c => c.id !== cut.id);
        if (state.selection && state.selection.id === cut.id) selectItem(null, null);
        rebuildTopology();
        pushHistory();
        requestRender();
      });
      listBox.appendChild(row);
    });
  }

  // ==================== 模板套用与无缝长图 ====================
  function applySeamlessLongStrip(direction = 'v-long') {
    const usedAssets = state.assets.length > 0 ? state.assets : [];
    const count = Math.max(2, usedAssets.length);
    state.contour = { type: 'rect', keepAspect: false, customPoints: [] };
    state.hideBaseCells = false;
    state.style.gutter = 0;
    state.style.margin = 0;
    state.style.cellBorder = 0;

    let newW = 1200, newH = 2700;
    if (direction === 'v-long') {
      newW = 1200;
      const heights = usedAssets.length > 0
        ? usedAssets.map(a => Math.round(newW * (a.height / a.width)))
        : Array(count).fill(800);
      newH = Math.min(12000, Math.max(600, heights.reduce((s, v) => s + v, 0)));
      const sumRaw = heights.reduce((s, v) => s + v, 0);
      let acc = 0;
      state.cuts = [];
      for (let i = 0; i < heights.length - 1; i++) {
        acc += heights[i] / sumRaw;
        state.cuts.push({ id: `long_v_${i}`, mode: 'line', points: [{ x: 0, y: acc }, { x: 1, y: acc }], closed: false, autoExtend: true });
      }
    } else {
      newH = 1080;
      const widths = usedAssets.length > 0
        ? usedAssets.map(a => Math.round(newH * (a.width / a.height)))
        : Array(count).fill(1080);
      newW = Math.min(12000, Math.max(600, widths.reduce((s, v) => s + v, 0)));
      const sumRaw = widths.reduce((s, v) => s + v, 0);
      let acc = 0;
      state.cuts = [];
      for (let i = 0; i < widths.length - 1; i++) {
        acc += widths[i] / sumRaw;
        state.cuts.push({ id: `long_h_${i}`, mode: 'line', points: [{ x: acc, y: 0 }, { x: acc, y: 1 }], closed: false, autoExtend: true });
      }
    }

    const cx = state.frameWorld.x + state.frameWorld.w * 0.5;
    const cy = state.frameWorld.y + state.frameWorld.h * 0.5;
    state.frameWorld = { x: Math.round(cx - newW / 2), y: Math.round(cy - newH / 2), w: newW, h: newH };

    rebuildTopology([]);
    if (usedAssets.length > 0) {
      state.topology.cells.forEach((cell, idx) => {
        if (usedAssets[idx]) {
          cell.assetId = usedAssets[idx].id;
          cell.transform = window.PlanarSlicer.createDefaultImageTransform();
        }
      });
    }
    syncGlobalControlsFromState();
    fitCameraToOuterFrame();
    pushHistory();
    renderAssetGridUI();
  }

  function renderTemplateGalleryUI() {
    const grid = document.getElementById('tplGrid');
    grid.innerHTML = '';

    const allTpls = [
      ...window.TemplateLibrary.BUILTIN_TEMPLATES,
      ...state.customTemplates.map(t => ({ ...t, category: 'custom', isCustom: true }))
    ];
    const filtered = state.activeTplCategory === 'all'
      ? allTpls
      : allTpls.filter(t => t.category === state.activeTplCategory);

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:span 2; color:var(--text-muted); font-size:11.5px; text-align:center; padding:16px 6px;">暂无自定义模板</div>`;
      return;
    }

    for (const tpl of filtered) {
      const card = document.createElement('div');
      card.className = 'tpl-card';
      card.innerHTML = `
        <div class="tpl-thumb">${window.TemplateLibrary.generateTemplateThumbSVG(tpl)}</div>
        <div class="tpl-name">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(tpl.name)}</span>
          <span class="tpl-ratio-tag">${escapeHtml(tpl.ratioLabel || '')}</span>
        </div>
        ${tpl.isCustom ? `
          <div style="display:flex; gap:4px;">
            <button class="btn btn-sm btn-export-tpl" style="flex:1; padding:2px 4px; font-size:10px;">导出</button>
            <button class="btn btn-sm btn-danger btn-del-tpl" style="padding:2px 5px; font-size:10px;">删</button>
          </div>
        ` : ''}
      `;
      card.addEventListener('click', () => applyTemplate(tpl));
      if (tpl.isCustom) {
        card.querySelector('.btn-export-tpl').addEventListener('click', async (ev) => {
          ev.stopPropagation();
          if (window.desktopAPI) {
            const res = await window.desktopAPI.exportTemplateFile({ templateData: tpl, name: tpl.name });
            if (res && !res.canceled) showToast('模板文件已导出');
          }
        });
        card.querySelector('.btn-del-tpl').addEventListener('click', async (ev) => {
          ev.stopPropagation();
          state.customTemplates = state.customTemplates.filter(x => x.id !== tpl.id);
          if (window.desktopAPI) await window.desktopAPI.saveCustomTemplates(state.customTemplates);
          renderTemplateGalleryUI();
        });
      }
      grid.appendChild(card);
    }
    renderCreativePanelUI();
  }

  function applyTemplate(tpl) {
    if (tpl.specialMode === 'v-long' || tpl.specialMode === 'h-long') {
      applySeamlessLongStrip(tpl.specialMode);
      return;
    }

    const existingAssignedAssets = [];
    for (const c of state.topology.cells) if (c.assetId) existingAssignedAssets.push(c.assetId);
    for (const f of state.freeFrames) if (f.assetId) existingAssignedAssets.push(f.assetId);

    const followRatio = document.getElementById('chkFollowTplRatio').checked;
    const cx = state.frameWorld.x + state.frameWorld.w * 0.5;
    const cy = state.frameWorld.y + state.frameWorld.h * 0.5;

    const targetW = followRatio ? (tpl.canvasW || 1920) : state.canvasW;
    const targetH = followRatio ? (tpl.canvasH || 1080) : state.canvasH;
    state.frameWorld = { x: Math.round(cx - targetW / 2), y: Math.round(cy - targetH / 2), w: targetW, h: targetH };
    state.canvasW = targetW;
    state.canvasH = targetH;

    const tplAspect = (tpl.canvasW || 1920) / (tpl.canvasH || 1080);
    const curAspect = targetW / targetH;

    state.hideBaseCells = !!tpl.hideBaseCells;
    state.contour = JSON.parse(JSON.stringify(tpl.contour || { type: 'rect', keepAspect: true }));
    if (state.contour.type !== 'custom') {
      state.contour.keepAspect = document.getElementById('chkKeepContourAspect').checked;
    }
    state.style = { ...state.style, ...JSON.parse(JSON.stringify(tpl.style || {})) };
    state.cuts = JSON.parse(JSON.stringify(tpl.cuts || []));

    state.freeFrames = JSON.parse(JSON.stringify(tpl.freeFrames || [])).map(ff => {
      if (!followRatio && Math.abs(curAspect - tplAspect) > 0.05) {
        const pixelOrigW = ff.w * (tpl.canvasW || 1920);
        const pixelOrigH = ff.h * (tpl.canvasH || 1080);
        const frameAspect = pixelOrigW / Math.max(1, pixelOrigH);
        const scaleFit = Math.min(targetW / (tpl.canvasW || 1920), targetH / (tpl.canvasH || 1080));
        ff.w = (pixelOrigW * scaleFit) / targetW;
        ff.h = ((pixelOrigW * scaleFit) / frameAspect) / targetH;
      }
      ff.transform = window.PlanarSlicer.createDefaultImageTransform();
      return ff;
    });

    state.texts = JSON.parse(JSON.stringify(tpl.texts || []));
    rebuildTopology([]);

    const labels = tpl.slotLabels || [];
    const slotOrders = tpl.slotOrders || [];
    state.topology.cells.forEach((cell, idx) => {
      if (labels[idx]) cell.slotLabel = labels[idx];
      if (slotOrders[idx]) cell.slotOrder = slotOrders[idx];
    });

    const poolToAssign = existingAssignedAssets.length > 0 ? existingAssignedAssets : state.assets.map(a => a.id);
    let aIdx = 0;
    if (!state.hideBaseCells) {
      for (const cell of state.topology.cells) {
        if (aIdx < poolToAssign.length) {
          cell.assetId = poolToAssign[aIdx++];
          cell.transform = window.PlanarSlicer.createDefaultImageTransform();
        }
      }
    }
    for (const ff of state.freeFrames) {
      if (aIdx < poolToAssign.length) {
        ff.assetId = poolToAssign[aIdx++];
        ff.transform = window.PlanarSlicer.createDefaultImageTransform();
      }
    }

    setActiveTool('select', false);
    selectItem(null, null);
    syncGlobalControlsFromState();
    fitCameraToOuterFrame();
    pushHistory();
    renderAssetGridUI();
    showToast(`已切换唯一外框为模板「${tpl.name}」`);
  }

  function buildTemplateObjectFromCurrentState(name) {
    return {
      id: `custom_${Date.now()}`,
      name: name || '我的自定义模板',
      category: 'custom',
      isCustom: true,
      ratioLabel: `${state.canvasW}×${state.canvasH}`,
      canvasW: state.canvasW,
      canvasH: state.canvasH,
      hideBaseCells: state.hideBaseCells,
      contour: JSON.parse(JSON.stringify(state.contour)),
      style: JSON.parse(JSON.stringify(state.style)),
      cuts: JSON.parse(JSON.stringify(state.cuts)),
      slotLabels: state.topology.cells.map(c => c.slotLabel || ''),
      slotOrders: state.topology.cells.map(c => c.slotOrder || null),
      freeFrames: state.freeFrames.map(ff => ({ ...JSON.parse(JSON.stringify(ff)), assetId: null, transform: null })),
      texts: JSON.parse(JSON.stringify(state.texts))
    };
  }

  // ==================== 全局控件同步与事件绑定 ====================
  function syncGlobalControlsFromState() {
    document.getElementById('inputCanvasW').value = state.canvasW;
    document.getElementById('inputCanvasH').value = state.canvasH;
    document.getElementById('selBgMode').value = state.style.bgMode;
    document.getElementById('inputBgColor1').value = state.style.bgColor1 || '#ffffff';
    document.getElementById('inputBgColor2').value = state.style.bgColor2 || '#dbeafe';
    document.getElementById('inputBgColor2').style.display = state.style.bgMode === 'gradient' ? 'inline-block' : 'none';
    document.getElementById('selGradAngle').style.display = state.style.bgMode === 'gradient' ? 'inline-block' : 'none';
    document.getElementById('bgColorRow').style.display = state.style.bgMode === 'transparent' ? 'none' : 'flex';

    document.getElementById('rngGutter').value = state.style.gutter;
    document.getElementById('lblGutter').textContent = `${state.style.gutter}px`;
    document.getElementById('rngMargin').value = state.style.margin;
    document.getElementById('lblMargin').textContent = `${state.style.margin}px`;
    document.getElementById('rngCellBorder').value = state.style.cellBorder;
    document.getElementById('lblCellBorder').textContent = `${state.style.cellBorder}px`;
    document.getElementById('inputCellBorderColor').value = state.style.cellBorderColor || '#ffffff';
    document.getElementById('rngOuterStroke').value = state.style.outerStroke || 0;
    document.getElementById('lblOuterStroke').textContent = `${state.style.outerStroke || 0}px`;
    document.getElementById('inputOuterStrokeColor').value = state.style.outerStrokeColor || '#ffffff';

    const selEdge = document.getElementById('selEdgeStyle');
    if (selEdge) selEdge.value = state.style.edgeStyle || 'classic';
    const rngRef = document.getElementById('rngRefractStrength');
    if (rngRef) {
      rngRef.value = state.style.refractStrength || 0;
      document.getElementById('lblRefractStrength').textContent = `${state.style.refractStrength || 0}px`;
    }

    const selTone = document.getElementById('selGlobalTone');
    if (selTone) selTone.value = state.style.globalTone || 'none';
    const rngVig = document.getElementById('rngGlobalVignette');
    if (rngVig) {
      rngVig.value = state.style.vignette || 0;
      document.getElementById('lblGlobalVignette').textContent = `${state.style.vignette || 0}%`;
    }
    const rngGrn = document.getElementById('rngGlobalGrain');
    if (rngGrn) {
      rngGrn.value = state.style.grain || 0;
      document.getElementById('lblGlobalGrain').textContent = `${state.style.grain || 0}%`;
    }

    document.getElementById('chkKeepContourAspect').checked = state.contour.keepAspect !== false;
    document.querySelectorAll('#silhouettePresetGrid .shape-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.shape === state.contour.type);
    });
  }

  function resizeOuterFrameSmart(newW, newH) {
    const oldW = state.canvasW, oldH = state.canvasH;
    if (newW === oldW && newH === oldH) return;

    const prevNormStubs = state.topology.cells.map(c => {
      const nx = c.repPt.x / oldW, ny = c.repPt.y / oldH;
      return {
        ...c,
        outer: [
          { x: nx * newW - 2, y: ny * newH - 2 },
          { x: nx * newW + 2, y: ny * newH - 2 },
          { x: nx * newW + 2, y: ny * newH + 2 },
          { x: nx * newW - 2, y: ny * newH + 2 }
        ],
        holes: [],
        repPt: { x: nx * newW, y: ny * newH }
      };
    });

    for (const ff of state.freeFrames) {
      const pxW = ff.w * oldW, pxH = ff.h * oldH;
      const fitRatio = Math.min(newW / oldW, newH / oldH);
      ff.w = (pxW * fitRatio) / newW;
      ff.h = (pxH * fitRatio) / newH;
    }
    for (const st of state.stickers) {
      if (!st.anchorType || st.anchorType === 'none') {
        const pxW = st.w * oldW, pxH = st.h * oldH;
        const fitRatio = Math.min(newW / oldW, newH / oldH);
        st.w = (pxW * fitRatio) / newW;
        st.h = (pxH * fitRatio) / newH;
      }
    }

    const cx = state.frameWorld.x + oldW * 0.5;
    const cy = state.frameWorld.y + oldH * 0.5;
    state.frameWorld = { x: Math.round(cx - newW / 2), y: Math.round(cy - newH / 2), w: newW, h: newH };
    state.canvasW = newW;
    state.canvasH = newH;

    syncGlobalControlsFromState();
    rebuildTopology(prevNormStubs);
    updateZoomHudUI();
    pushHistory();
    requestRender();
  }

  function initStaticPanels() {
    const silGrid = document.getElementById('silhouettePresetGrid');
    silGrid.innerHTML = '';
    for (const item of window.SilhouetteEngine.SILHOUETTE_PRESETS) {
      const btn = document.createElement('button');
      btn.className = `shape-btn ${item.id === state.contour.type ? 'active' : ''}`;
      btn.dataset.shape = item.id;
      btn.innerHTML = `<svg viewBox="0 0 28 28">${item.icon}</svg><span>${item.name}</span>`;
      btn.addEventListener('click', () => {
        state.contour.type = item.id;
        state.contour.keepAspect = document.getElementById('chkKeepContourAspect').checked;
        state.editingContourNodes = false;
        if (item.id !== 'rect') state.style.bgMode = 'transparent';
        setActiveTool('select', false);
        syncGlobalControlsFromState();
        rebuildTopology();
        pushHistory();
        requestRender();
      });
      silGrid.appendChild(btn);
    }

    const ffGrid = document.getElementById('freeFrameAddGrid');
    ffGrid.innerHTML = '';
    for (const s of FREE_FRAME_SHAPES) {
      const btn = document.createElement('button');
      btn.className = 'shape-btn';
      btn.innerHTML = `<svg viewBox="0 0 28 28">${s.icon}</svg><span>${s.name}</span>`;
      btn.addEventListener('click', () => {
        const aspect = state.canvasW / state.canvasH;
        const baseW = 0.30;
        const baseH = s.id === 'polaroid' ? baseW * aspect * 1.18 : baseW * aspect;
        const defaultFollowEl = document.getElementById('chkDefaultFrameFollowCell');
        const followDefault = defaultFollowEl ? !!defaultFollowEl.checked : false;
        const newFf = {
          id: `ff_${Date.now()}`,
          shape: s.id,
          x: 0.5 + (Math.random() - 0.5) * 0.08,
          y: 0.5 + (Math.random() - 0.5) * 0.08,
          w: baseW,
          h: Math.min(0.78, baseH),
          rotation: s.id === 'polaroid' ? -4 : 0,
          borderWidth: s.id === 'polaroid' ? 0 : 5,
          borderColor: '#ffffff',
          cornerRadius: s.id === 'rect' ? 8 : 4,
          shadow: true,
          shadowBlur: 24,
          shadowColor: 'rgba(0,0,0,0.38)',
          caption: s.id === 'polaroid' ? 'My Moment' : '',
          opacity: 1,
          visible: true,
          locked: false,
          zOrder: allocZOrder(),
          followHostCell: followDefault,
          hostAnchor: null,
          assetId: null,
          transform: window.PlanarSlicer.createDefaultImageTransform()
        };
        state.freeFrames.push(newFf);
        if (newFf.followHostCell && window.FxLabEngine) {
          window.FxLabEngine.recordFrameHostAnchor(newFf, state);
        }
        state.frameEditImageMode = false; // 空相框先方便移动摆放；一旦放入图片自动切为图片选区模式！
        setActiveTool('select', false);
        selectItem('frame', newFf.id);
        pushHistory();
        requestRender();
      });
      ffGrid.appendChild(btn);
    }

    document.querySelectorAll('[data-add-text]').forEach(btn => {
      btn.addEventListener('click', () => {
        const bType = btn.dataset.addText;
        const defaults = {
          plain: { text: 'CHARACTER TITLE', color: '#ffffff', strokeColor: '#0f172a', strokeWidth: 5, fontSize: 46, bold: true },
          tag: { text: 'EPISODE.01 · 记忆碎片', color: '#ffffff', bubbleFill: '#2563eb', bubbleStroke: '#ffffff', strokeWidth: 0, fontSize: 28, bold: true },
          speech: { text: '绝对不会退缩！', color: '#111827', bubbleFill: '#ffffff', bubbleStroke: '#111827', strokeWidth: 0, fontSize: 30, bold: true },
          narration: { text: '那一天，命运的齿轮\n悄然开始转动……', color: '#111827', bubbleFill: '#ffffff', bubbleStroke: '#111827', strokeWidth: 0, fontSize: 26, bold: false },
          burst: { text: '觉醒时刻！！', color: '#dc2626', bubbleFill: '#fef08a', bubbleStroke: '#111827', strokeWidth: 2, strokeColor: '#ffffff', fontSize: 34, bold: true }
        }[bType];

        const newTxt = {
          id: `txt_${Date.now()}`,
          x: 0.5, y: 0.5, rotation: 0,
          fontFamily: 'Microsoft YaHei UI',
          italic: false,
          bubbleType: bType,
          tailAngle: 125,
          visible: true,
          locked: false,
          zOrder: allocZOrder(),
          ...defaults
        };
        state.texts.push(newTxt);
        setActiveTool('select', false);
        selectItem('text', newTxt.id);
        pushHistory();
        requestRender();
      });
    });

    // 初始化内置兽耳猫脸库 & 面部漫符库 & 灵魂拟声词章
    const earsGrid = document.getElementById('stickerEarsGrid');
    const fxGrid = document.getElementById('stickerFxGrid');
    const sfxGrid = document.getElementById('stickerSfxGrid');
    if (earsGrid && fxGrid && window.StickerEngine) {
      earsGrid.innerHTML = '';
      fxGrid.innerHTML = '';
      if (sfxGrid) sfxGrid.innerHTML = '';
      for (const item of window.StickerEngine.BUILTIN_STICKERS) {
        const btn = document.createElement('button');
        btn.className = 'shape-btn';
        const thumbUrl = window.StickerEngine.getBuiltinStickerThumbDataUrl(item);
        btn.innerHTML = `<img src="${thumbUrl}" style="width:44px; height:32px; object-fit:contain; pointer-events:none;" /><span>${item.name}</span>`;
        btn.addEventListener('click', () => spawnBuiltinSticker(item));
        if (item.category === 'ears_face') earsGrid.appendChild(btn);
        else if (item.category === 'manga_sfx' && sfxGrid) sfxGrid.appendChild(btn);
        else fxGrid.appendChild(btn);
      }
    }

    // 添加连线局部特写放大镜按钮
    document.querySelectorAll('[data-add-loupe]').forEach(btn => {
      btn.addEventListener('click', () => {
        const shape = btn.dataset.addLoupe;
        const idx = state.loupes.length + 1;
        const newLp = {
          id: `lp_${Date.now()}`,
          srcX: 0.45,
          srcY: 0.34,
          srcR: 0.045,
          dstX: 0.78,
          dstY: 0.28,
          dstSize: 0.14,
          zoom: 3.2,
          shape,
          color: '#38bdf8',
          label: `DETAIL // 0${idx}`,
          visible: true,
          locked: false,
          zOrder: allocZOrder()
        };
        state.loupes.push(newLp);
        setActiveTool('select', false);
        selectItem('loupe', newLp.id);
        pushHistory();
        requestRender();
        showToast('已添加连线特写放大镜：拖动小瞄准圈对准眼睛/饰品即可实时超清放大！');
      });
    });
  }

  // ==================== 应援色板提取、玻璃碎裂铺满与灵感扭蛋机 ====================
  function getActiveCharacterAsset() {
    if (state.selection && state.selection.type === 'cell') {
      const c = state.topology.cells.find(x => x.id === state.selection.id);
      if (c && c.assetId && state.assetMap.has(c.assetId)) return state.assetMap.get(c.assetId);
    }
    if (state.selection && state.selection.type === 'frame') {
      const ff = state.freeFrames.find(x => x.id === state.selection.id);
      if (ff && ff.assetId && state.assetMap.has(ff.assetId)) return state.assetMap.get(ff.assetId);
    }
    for (const c of state.topology.cells) {
      if (c.assetId && state.assetMap.has(c.assetId)) return state.assetMap.get(c.assetId);
    }
    return state.assets[0] || null;
  }

  function renderOshiPaletteUI() {
    const row = document.getElementById('oshiPaletteRow');
    if (!row || !window.FxLabEngine) return;
    const asset = getActiveCharacterAsset();
    const palette = window.FxLabEngine.extractCharacterOshiPalette(asset);
    syncOshiLiveCssVars(palette[0], palette[1]);
    const titles = ['主应援色', '高光瞳色/撞色', '服饰辅色', '柔和浅底色', '深邃描边/耳色'];

    row.innerHTML = '';
    palette.forEach((hex, idx) => {
      const sw = document.createElement('button');
      sw.style.cssText = `width:28px; height:24px; border-radius:6px; border:1.5px solid var(--border-strong); background:${hex}; cursor:pointer; flex:1;`;
      sw.title = `${titles[idx]} (${hex})\n左键设为画布主底色（痛房模式下同步切换界面氛围色），右键设为漫框描边色`;
      sw.addEventListener('click', () => {
        if (state.style.bgMode === 'transparent') state.style.bgMode = 'solid';
        state.style.bgColor1 = hex;
        syncOshiLiveCssVars(hex, palette[(idx + 1) % palette.length]);
        syncGlobalControlsFromState();
        pushHistory();
        requestRender();
      });
      sw.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        state.style.cellBorderColor = hex;
        syncGlobalControlsFromState();
        pushHistory();
        requestRender();
        showToast(`已将漫框描边色设为 ${hex}`);
      });
      row.appendChild(sw);
    });
  }

  function applyGeneratedShatterCuts(newCuts) {
    const primaryAsset = getActiveCharacterAsset();
    state.cuts = newCuts;
    state.hideBaseCells = false;
    rebuildTopology([]);

    // 若已有角色图，自动开启同图全场贯穿铺满 + 轻微玻璃折射，一键体验碎裂大片效果！
    if (primaryAsset) {
      for (const cell of state.topology.cells) {
        cell.assetId = primaryAsset.id;
        cell.transform = {
          ...window.PlanarSlicer.createDefaultImageTransform(),
          globalSpan: true
        };
      }
      if (!state.style.refractStrength) {
        state.style.refractStrength = 8;
      }
    }

    setActiveTool('select', false);
    syncGlobalControlsFromState();
    pushHistory();
    renderAssetGridUI();
    requestRender();
    showToast(`已生成 ${state.topology.cells.length} 块碎裂分镜，可点选任意碎片开启「局部留色」`);
  }

  function spanSameImageAcrossAllCells() {
    const asset = getActiveCharacterAsset();
    if (!asset) return showToast('请先导入至少一张图片素材');
    for (const cell of state.topology.cells) {
      cell.assetId = asset.id;
      cell.transform = {
        ...window.PlanarSlicer.createDefaultImageTransform(),
        globalSpan: true
      };
    }
    if ((state.style.refractStrength || 0) < 4) {
      state.style.refractStrength = 10;
    }
    syncGlobalControlsFromState();
    pushHistory();
    renderAssetGridUI();
    requestRender();
    showToast('已将同张图片跨分镜无缝铺满，可调节「折射错位」增强层次感');
  }

  // 一键无损应用 6 款整幅画布画风预设（保留已切分镜线与图片构图不动！）
  function applyCanvasStylePreset(presetKey) {
    const isCustomContour = state.contour.type !== 'rect';
    const asset = getActiveCharacterAsset();
    const pal = window.FxLabEngine ? window.FxLabEngine.extractCharacterOshiPalette(asset) : ['#4f8ef7', '#22d3ee', '#64748b', '#f8fafc', '#0f172a'];

    if (presetKey === 'album') {
      if (!isCustomContour) { state.style.bgMode = 'solid'; state.style.bgColor1 = '#f8fafc'; }
      state.style.edgeStyle = 'classic';
      state.style.gutter = 18;
      state.style.margin = 24;
      state.style.cellBorder = 3;
      state.style.cellBorderColor = '#ffffff';
      state.style.globalTone = 'none';
      state.style.vignette = 0;
      state.style.grain = 4;
      state.topology.cells.forEach(c => { if (c.fx && c.fx.colorFilter === 'bw') c.fx.colorFilter = 'none'; });
    } else if (presetKey === 'poster') {
      if (!isCustomContour) { state.style.bgMode = 'solid'; state.style.bgColor1 = '#090b10'; }
      state.style.edgeStyle = 'classic';
      state.style.gutter = 0;
      state.style.margin = 0;
      state.style.cellBorder = 0;
      state.style.globalTone = 'vivid';
      state.style.vignette = 22;
      state.style.grain = 0;
    } else if (presetKey === 'journal') {
      if (!isCustomContour) {
        state.style.bgMode = 'gradient';
        state.style.bgColor1 = '#faf6f0';
        state.style.bgColor2 = '#ede5d8';
      }
      state.style.edgeStyle = 'torn';
      state.style.gutter = 14;
      state.style.margin = 20;
      state.style.cellBorder = 2;
      state.style.cellBorderColor = '#ffffff';
      state.style.globalTone = 'warm';
      state.style.vignette = 10;
      state.style.grain = 16;
    } else if (presetKey === 'cinema') {
      if (!isCustomContour) { state.style.bgMode = 'solid'; state.style.bgColor1 = '#0b0d13'; }
      state.style.edgeStyle = 'film';
      state.style.gutter = 12;
      state.style.margin = 26;
      state.style.cellBorder = 2;
      state.style.cellBorderColor = '#1e293b';
      state.style.globalTone = 'warm';
      state.style.vignette = 34;
      state.style.grain = 20;
    } else if (presetKey === 'jigsaw') {
      if (!isCustomContour) {
        state.style.bgMode = 'gradient';
        state.style.bgColor1 = pal[3];
        state.style.bgColor2 = pal[0];
      }
      state.style.edgeStyle = 'jigsaw';
      state.style.gutter = 10;
      state.style.margin = 18;
      state.style.cellBorder = 3;
      state.style.cellBorderColor = '#ffffff';
      state.style.globalTone = 'none';
      state.style.vignette = 8;
      state.style.grain = 0;
    } else if (presetKey === 'manga_bw') {
      if (!isCustomContour) { state.style.bgMode = 'solid'; state.style.bgColor1 = '#ffffff'; }
      state.style.edgeStyle = 'classic';
      state.style.gutter = 14;
      state.style.margin = 20;
      state.style.cellBorder = 5;
      state.style.cellBorderColor = '#0f172a';
      state.style.globalTone = 'none';
      state.style.vignette = 12;
      state.style.grain = 14;
      // 若没有任何格子处于局部留色 (vivid)，则全场切高反差黑白；若有 vivid 则贴心保留该格彩色！
      const hasHeroVivid = state.topology.cells.some(c => c.fx && c.fx.colorFilter === 'vivid');
      state.topology.cells.forEach(c => {
        if (!c.fx) c.fx = { blurPad: false, blurAmount: 28, colorFilter: 'none', mangaLines: 'none', popOut: false };
        if (hasHeroVivid && c.fx.colorFilter === 'vivid') return;
        c.fx.colorFilter = 'bw';
      });
    }

    document.querySelectorAll('#canvasStylePresetGrid .canvas-preset-card').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cstyle === presetKey);
    });

    syncGlobalControlsFromState();
    renderSelectionInspector();
    pushHistory();
    requestRender();
    const labelMap = {
      album: '现代白框画册', poster: '无框无缝海报', journal: '手撕纸手账',
      cinema: '复古电影胶卷', jigsaw: '立体拼图画报', manga_bw: '黑白反差漫框'
    };
    showToast(`已套用「${labelMap[presetKey] || presetKey}」全局画风（按 Ctrl+Z 可撤回）`);
  }

  // 🎲 分镜灵感扭蛋机：一键随机组合【切法 + 角色应援色 + 特殊边缘/眼神杀】！
  function rollGachaLayout() {
    const rollType = Math.floor(Math.random() * 5);
    state.hideBaseCells = false;
    state.freeFrames = [];

    if (rollType === 0) {
      // 冰晶碎裂 + 同图折射眼神杀
      state.contour.type = 'rect';
      state.cuts = window.FxLabEngine.generateVoronoiCrystalCuts(7 + Math.floor(Math.random() * 5));
      state.style.edgeStyle = 'classic';
      state.style.gutter = 8;
      state.style.cellBorder = 3;
    } else if (rollType === 1) {
      // 蛛网冲击碎裂
      state.contour.type = 'rect';
      state.cuts = window.FxLabEngine.generateImpactShatterCuts({ x: 0.35 + Math.random() * 0.3, y: 0.28 + Math.random() * 0.25 }, 8);
      state.style.edgeStyle = 'classic';
      state.style.gutter = 6;
      state.style.cellBorder = 2;
    } else if (rollType === 2) {
      // 手撕纸双形态或斜切三格
      const animePool = window.TemplateLibrary.BUILTIN_TEMPLATES.filter(t => t.category === 'anime' && t.contour.type === 'rect');
      const pick = animePool[Math.floor(Math.random() * animePool.length)];
      state.contour = JSON.parse(JSON.stringify(pick.contour));
      state.cuts = JSON.parse(JSON.stringify(pick.cuts));
      state.style.edgeStyle = Math.random() < 0.55 ? 'torn' : 'jigsaw';
      state.style.gutter = 14;
    } else if (rollType === 3) {
      // 圆形/爱心异形吧唧谷子模式
      const shapes = ['circle', 'heart', 'sparkle4', 'hexagon'];
      state.contour.type = shapes[Math.floor(Math.random() * shapes.length)];
      state.contour.keepAspect = true;
      state.style.bgMode = 'transparent';
      state.style.outerStroke = 6;
      const a0 = 0.32 + Math.random() * 0.16;
      state.cuts = [{
        id: `gacha_c_${Date.now()}`,
        mode: 'curve',
        points: [{ x: a0 + 0.12, y: 0 }, { x: 1 - a0, y: 1 }],
        cp1: { x: 0.22, y: 0.35 },
        cp2: { x: 0.78, y: 0.65 },
        closed: false,
        autoExtend: true
      }];
      state.style.edgeStyle = 'classic';
      state.style.refractStrength = 0;
    } else {
      // 复古电影胶卷条分镜
      state.contour.type = 'rect';
      state.cuts = [
        { id: 'gf1', mode: 'line', points: [{ x: 0.34, y: 0 }, { x: 0.30, y: 1 }], closed: false, autoExtend: true },
        { id: 'gf2', mode: 'line', points: [{ x: 0.69, y: 0 }, { x: 0.65, y: 1 }], closed: false, autoExtend: true }
      ];
      state.style.edgeStyle = 'film';
      state.style.gutter = 12;
    }

    rebuildTopology([]);

    // 自动配入角色图片与应援色主题！
    const activeAsset = getActiveCharacterAsset();
    if (activeAsset) {
      const pal = window.FxLabEngine.extractCharacterOshiPalette(activeAsset);
      if (state.contour.type === 'rect') {
        state.style.bgMode = 'gradient';
        state.style.bgColor1 = pal[3];
        state.style.bgColor2 = pal[0];
      }
      state.style.cellBorderColor = state.style.edgeStyle === 'jigsaw' ? '#ffffff' : pal[4];

      if (state.assets.length === 1 || rollType <= 1) {
        // 单图或碎裂模式：全场贯穿铺满 + 随机一格高饱和眼神杀反差！
        const heroIdx = Math.floor(Math.random() * state.topology.cells.length);
        state.style.refractStrength = rollType <= 1 ? 9 : 0;
        state.topology.cells.forEach((c, idx) => {
          c.assetId = activeAsset.id;
          c.transform = { ...window.PlanarSlicer.createDefaultImageTransform(), globalSpan: true };
          c.fx = {
            blurPad: false,
            blurAmount: 26,
            colorFilter: rollType <= 1 ? (idx === heroIdx ? 'vivid' : 'bw') : 'none',
            mangaLines: (idx === heroIdx && Math.random() < 0.4) ? 'focus' : 'none',
            popOut: (state.style.edgeStyle === 'jigsaw' && idx === heroIdx)
          };
        });
      } else {
        state.style.refractStrength = 0;
        state.topology.cells.forEach((c, idx) => {
          const ast = state.assets[idx % state.assets.length];
          c.assetId = ast.id;
          c.transform = window.PlanarSlicer.createDefaultImageTransform();
        });
      }
    }

    setActiveTool('select', false);
    syncGlobalControlsFromState();
    pushHistory();
    renderAssetGridUI();
    requestRender();
    showToast('已随机生成新排版方案（再次点击可换一套，按 Ctrl+Z 可退回）');
  }

  function getPreferredStickerSpawnNorm() {
    if (state.selection && state.selection.type === 'cell') {
      const c = state.topology.cells.find(x => x.id === state.selection.id);
      if (c) return { x: c.repPt.x / state.canvasW, y: c.repPt.y / state.canvasH };
    }
    if (state.selection && state.selection.type === 'frame') {
      const ff = state.freeFrames.find(x => x.id === state.selection.id);
      if (ff) return { x: ff.x, y: ff.y };
    }
    // 取当前视野中心落在唯一总外框内的坐标
    const fw = state.frameWorld;
    const nx = Math.max(0.15, Math.min(0.85, (state.camX - fw.x) / Math.max(1, fw.w)));
    const ny = Math.max(0.15, Math.min(0.85, (state.camY - fw.y) / Math.max(1, fw.h)));
    return { x: nx, y: ny };
  }

  function spawnBuiltinSticker(preset) {
    const pos = getPreferredStickerSpawnNorm();
    const aspect = state.canvasW / state.canvasH;
    const newSt = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      kind: 'builtin',
      presetId: preset.id,
      name: preset.name,
      x: pos.x,
      y: pos.y,
      w: preset.defaultW,
      h: preset.defaultH * aspect,
      rotation: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      shadow: true,
      color1: preset.color1,
      color2: preset.color2,
      strokeColor: preset.stroke,
      visible: true,
      locked: false,
      zOrder: allocZOrder(),
      followPhoto: true,
      breakFrame: true,
      anchorType: 'none',
      anchorId: null,
      anchorData: null
    };
    state.stickers.push(newSt);
    autoBindStickerToUnderlyingPhoto(newSt);
    setActiveTool('sticker', false);
    selectItem('sticker', newSt.id);
    pushHistory();
    requestRender();
    showToast(`已贴上「${preset.name}」：底层已锁定防误触，直接拖动它即可贴到角色脸上！`);
  }

  function spawnCustomSticker(cItem) {
    const pos = getPreferredStickerSpawnNorm();
    const imgAspect = (cItem.width || 100) / Math.max(1, cItem.height || 100);
    const canvasAspect = state.canvasW / state.canvasH;
    const baseW = 0.18;
    const baseH = (baseW * canvasAspect) / imgAspect;

    const newSt = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      kind: 'custom',
      customId: cItem.id,
      name: cItem.name,
      x: pos.x,
      y: pos.y,
      w: baseW,
      h: Math.max(0.03, Math.min(0.65, baseH)),
      rotation: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      shadow: false,
      visible: true,
      locked: false,
      zOrder: allocZOrder(),
      followPhoto: true,
      breakFrame: true,
      anchorType: 'none',
      anchorId: null,
      anchorData: null
    };
    state.stickers.push(newSt);
    autoBindStickerToUnderlyingPhoto(newSt);
    setActiveTool('sticker', false);
    selectItem('sticker', newSt.id);
    pushHistory();
    requestRender();
    showToast(`已贴上自定义装饰「${cItem.name}」`);
  }

  function renderCustomStickerGalleryUI() {
    const grid = document.getElementById('customStickerGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (state.customStickers.length === 0) {
      grid.innerHTML = `<div style="grid-column:span 3; font-size:11px; color:var(--text-muted); text-align:center; padding:10px 4px;">点击上方导入你喜欢的猫耳/贴纸图片，永久保存在此处随时取用</div>`;
      return;
    }

    for (const item of state.customStickers) {
      const card = document.createElement('div');
      card.className = 'shape-btn';
      card.style.position = 'relative';
      card.title = `点击将「${item.name}」贴入画布`;
      card.innerHTML = `
        <img src="${item.dataUrl}" style="width:42px; height:36px; object-fit:contain; pointer-events:none;" />
        <span style="max-width:72px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
        <button class="asset-del-btn" style="width:16px; height:16px; top:2px; right:2px; font-size:10px; display:flex;" title="从装饰库删除">✕</button>
      `;
      card.addEventListener('click', () => spawnCustomSticker(item));
      card.querySelector('.asset-del-btn').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        state.customStickers = state.customStickers.filter(x => x.id !== item.id);
        state.customStickerMap.delete(item.id);
        state.stickers = state.stickers.filter(s => s.customId !== item.id);
        if (window.desktopAPI) await window.desktopAPI.saveCustomStickers(state.customStickers);
        renderCustomStickerGalleryUI();
        requestRender();
      });
      grid.appendChild(card);
    }
    renderCreativePanelUI();
  }

  // ==================== 图层管理系统与一键清空画布 ====================
  function clearAllCanvasDesigns() {
    const hasAnything =
      state.cuts.length > 0 ||
      state.freeFrames.length > 0 ||
      state.stickers.length > 0 ||
      state.loupes.length > 0 ||
      state.texts.length > 0 ||
      state.contour.type !== 'rect' ||
      state.topology.cells.some(c => c.assetId);

    if (!hasAnything) {
      showToast('当前画布已经是干净的初始状态');
      return;
    }

    state.cuts = [];
    state.freeFrames = [];
    state.stickers = [];
    state.loupes = [];
    state.texts = [];
    state.draft = null;
    state.editingContourNodes = false;
    state.hideBaseCells = false;
    state.contour = {
      type: 'rect',
      keepAspect: true,
      baseAspect: state.canvasW / Math.max(1, state.canvasH),
      customPoints: []
    };
    state.style.edgeStyle = 'classic';
    state.style.refractStrength = 0;
    state.style.globalTone = 'none';
    state.style.vignette = 0;
    state.style.grain = 0;

    rebuildTopology([]);
    selectItem(null, null);
    syncGlobalControlsFromState();
    pushHistory();
    renderAssetGridUI();
    renderLayerManagerUI();
    requestRender();
    showToast('🗑 已一键清空画布内全部设计（左侧素材库原图已保留，按 Ctrl+Z 可撤回）');
  }

  function renderLayerManagerUI() {
    const overlayListEl = document.getElementById('overlayLayerList');
    const baseCellListEl = document.getElementById('baseCellLayerList');
    const overlayBadgeEl = document.getElementById('overlayCountBadge');
    if (!overlayListEl || !baseCellListEl) return;

    const overlaysDesc = getAllOverlayEntriesSortedDesc();
    if (overlayBadgeEl) overlayBadgeEl.textContent = String(overlaysDesc.length);

    overlayListEl.innerHTML = '';
    if (overlaysDesc.length === 0) {
      overlayListEl.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px 6px;">暂无悬浮相框 / 装饰 / 放大镜 / 文字</div>`;
    } else {
      const shapeNameMap = Object.fromEntries(FREE_FRAME_SHAPES.map(s => [s.id, s.name]));
      overlaysDesc.forEach((entry, idx) => {
        const { kind, item } = entry;
        const isSelected = state.selection && state.selection.type === kind && state.selection.id === item.id;
        const isHidden = item.visible === false;
        const isLocked = !!item.locked;

        const row = document.createElement('div');
        row.className = `layer-row ${isSelected ? 'selected' : ''} ${isHidden ? 'is-hidden' : ''}`;

        let thumbHtml = '📦';
        let titleText = '';
        let subText = '';

        if (kind === 'frame') {
          const ast = item.assetId ? state.assetMap.get(item.assetId) : null;
          thumbHtml = ast ? `<img src="${ast.dataUrl}" alt="" />` : '🖼';
          const sName = item.shape === 'custom' ? '人物剪影' : (shapeNameMap[item.shape] || item.shape);
          titleText = `相框 · ${sName}`;
          subText = `${ast ? ast.name : '空相框'}${item.followHostCell ? ' · 🔗联动分镜' : ''}`;
        } else if (kind === 'sticker') {
          if (item.kind === 'custom') {
            const cs = state.customStickerMap.get(item.customId);
            thumbHtml = cs ? `<img src="${cs.dataUrl}" alt="" />` : '🐾';
          } else if (window.StickerEngine) {
            const preset = window.StickerEngine.BUILTIN_STICKERS.find(p => p.id === item.presetId);
            thumbHtml = preset ? `<img src="${window.StickerEngine.getBuiltinStickerThumbDataUrl(preset)}" alt="" />` : '🐾';
          }
          titleText = `装饰 · ${item.name || '贴纸'}`;
          subText = item.followPhoto ? '随底层照片移动' : '独立固定坐标';
        } else if (kind === 'loupe') {
          thumbHtml = '🔍';
          titleText = `放大镜 · ${(item.zoom || 3.2).toFixed(1)}x`;
          subText = item.label || '局部特写引线';
        } else if (kind === 'text') {
          thumbHtml = '💬';
          const shortTxt = (item.text || '').replace(/\s+/g, ' ').slice(0, 10);
          titleText = `文字 · ${shortTxt || '空白气泡'}`;
          subText = item.bubbleType === 'plain' ? '纯艺术字' : '漫画气泡框';
        }

        row.innerHTML = `
          <div class="layer-thumb">${thumbHtml}</div>
          <div class="layer-title">
            <span class="layer-name">${escapeHtml(titleText)}</span>
            <span class="layer-sub">${escapeHtml(subText)}${isLocked ? ' · 🔒已锁穿透' : ''}</span>
          </div>
          <button class="layer-icon-btn" data-act="up" title="上移一层" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
          <button class="layer-icon-btn" data-act="down" title="下移一层" ${idx === overlaysDesc.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
          <button class="layer-icon-btn ${!isHidden ? 'active' : ''}" data-act="vis" title="${isHidden ? '点击恢复显示' : '点击临时隐藏（透视下层）'}">${isHidden ? '🚫' : '👁'}</button>
          <button class="layer-icon-btn ${isLocked ? 'locked' : ''}" data-act="lock" title="${isLocked ? '点击解锁' : '点击锁定：鼠标点击将直接穿透此层去编辑下层重叠图片！'}">${isLocked ? '🔒' : '🔓'}</button>
          <button class="layer-icon-btn" data-act="del" title="删除该图层" style="color:var(--danger);">✕</button>
        `;

        row.addEventListener('click', () => {
          if (kind === 'sticker') setActiveTool('sticker', false);
          else setActiveTool('select', false);
          selectItem(kind, item.id);
        });

        row.querySelector('[data-act="up"]').addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (idx <= 0) return;
          const upper = overlaysDesc[idx - 1];
          const tmpZ = item.zOrder;
          item.zOrder = upper.item.zOrder;
          upper.item.zOrder = tmpZ;
          if (item.zOrder === upper.item.zOrder) item.zOrder += 1;
          pushHistory();
          renderLayerManagerUI();
          requestRender();
        });

        row.querySelector('[data-act="down"]').addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (idx >= overlaysDesc.length - 1) return;
          const lower = overlaysDesc[idx + 1];
          const tmpZ = item.zOrder;
          item.zOrder = lower.item.zOrder;
          lower.item.zOrder = tmpZ;
          if (item.zOrder === lower.item.zOrder) lower.item.zOrder += 1;
          pushHistory();
          renderLayerManagerUI();
          requestRender();
        });

        row.querySelector('[data-act="vis"]').addEventListener('click', (ev) => {
          ev.stopPropagation();
          item.visible = item.visible === false ? true : false;
          if (item.visible === false && isSelected) selectItem(null, null);
          pushHistory();
          renderLayerManagerUI();
          requestRender();
        });

        row.querySelector('[data-act="lock"]').addEventListener('click', (ev) => {
          ev.stopPropagation();
          item.locked = !item.locked;
          if (item.locked && isSelected) selectItem(null, null);
          pushHistory();
          renderLayerManagerUI();
          requestRender();
          if (item.locked) {
            showToast('🔒 已锁定该层：现在在重叠处直接点击即可穿透编辑下层图片！');
          }
        });

        row.querySelector('[data-act="del"]').addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (kind === 'frame') state.freeFrames = state.freeFrames.filter(x => x.id !== item.id);
          else if (kind === 'sticker') state.stickers = state.stickers.filter(x => x.id !== item.id);
          else if (kind === 'loupe') state.loupes = state.loupes.filter(x => x.id !== item.id);
          else if (kind === 'text') state.texts = state.texts.filter(x => x.id !== item.id);
          if (isSelected) selectItem(null, null);
          pushHistory();
          renderAssetGridUI();
          renderLayerManagerUI();
          requestRender();
        });

        overlayListEl.appendChild(row);
      });
    }

    // 底层切割分镜格列表
    baseCellListEl.innerHTML = '';
    if (state.hideBaseCells) {
      baseCellListEl.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:8px;">当前为纯悬浮相框画板模式（无底层分镜格）</div>`;
      return;
    }

    state.topology.cells.forEach((cell, idx) => {
      const isSelected = state.selection && state.selection.type === 'cell' && state.selection.id === cell.id;
      const isHidden = cell.visible === false;
      const isLocked = !!cell.locked;
      const ast = cell.assetId ? state.assetMap.get(cell.assetId) : null;

      const row = document.createElement('div');
      row.className = `layer-row ${isSelected ? 'selected' : ''} ${isHidden ? 'is-hidden' : ''}`;
      row.innerHTML = `
        <div class="layer-thumb">${ast ? `<img src="${ast.dataUrl}" alt="" />` : `#${idx + 1}`}</div>
        <div class="layer-title">
          <span class="layer-name">分镜格 #${idx + 1} ${cell.slotLabel ? `· ${escapeHtml(cell.slotLabel)}` : ''}</span>
          <span class="layer-sub">${ast ? escapeHtml(ast.name) : '待填图槽位'}${isLocked ? ' · 🔒已锁' : ''}</span>
        </div>
        <button class="layer-icon-btn ${!isHidden ? 'active' : ''}" data-act="vis" title="${isHidden ? '恢复显示该分镜格' : '隐藏该分镜格'}">${isHidden ? '🚫' : '👁'}</button>
        <button class="layer-icon-btn ${isLocked ? 'locked' : ''}" data-act="lock" title="${isLocked ? '解锁该分镜格' : '锁定该分镜格防误动'}">${isLocked ? '🔒' : '🔓'}</button>
      `;

      row.addEventListener('click', () => {
        setActiveTool('select', false);
        selectItem('cell', cell.id);
      });

      row.querySelector('[data-act="vis"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        cell.visible = cell.visible === false ? true : false;
        if (cell.visible === false && isSelected) selectItem(null, null);
        pushHistory();
        renderLayerManagerUI();
        requestRender();
      });

      row.querySelector('[data-act="lock"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        cell.locked = !cell.locked;
        if (cell.locked && isSelected) selectItem(null, null);
        pushHistory();
        renderLayerManagerUI();
        requestRender();
      });

      baseCellListEl.appendChild(row);
    });
  }

  // ==================== 独立创意玩法：人物轮廓剪影容器控制器 ====================
  function getActiveSilhouetteTarget() {
    if (state.selection && state.selection.type === 'frame') {
      const ff = state.freeFrames.find(f => f.id === state.selection.id);
      if (ff && ff.silhouetteMeta) {
        return { kind: 'frame', item: ff, meta: ff.silhouetteMeta };
      }
    }
    if (state.contour && state.contour.type === 'custom' && state.contour.silhouetteMeta) {
      return { kind: 'outer', item: state.contour, meta: state.contour.silhouetteMeta };
    }
    return null;
  }

  function renderCreativePanelUI() {
    const pickGrid = document.getElementById('creativeAssetPickGrid');
    const ctrlCard = document.getElementById('activeSilhouetteControlCard');
    if (!pickGrid || !ctrlCard) return;

    pickGrid.innerHTML = '';
    if (state.assets.length === 0) {
      pickGrid.innerHTML = `<div style="grid-column:span 3; font-size:11px; color:var(--text-muted); text-align:center; padding:12px 4px;">点击上方按钮直接选取一张人物图，即可提取轮廓作为异形分镜外框</div>`;
    } else {
      for (const ast of state.assets) {
        const div = document.createElement('div');
        div.className = 'creative-pick-item';
        div.title = `点击提取「${ast.name}」的人物轮廓`;
        div.innerHTML = `<img src="${ast.dataUrl}" alt="${escapeHtml(ast.name)}" />`;
        div.addEventListener('click', () => openSilhouetteExtractorForAsset(ast));
        pickGrid.appendChild(div);
      }
    }

    const target = getActiveSilhouetteTarget();
    if (!target) {
      ctrlCard.style.display = 'none';
      return;
    }

    ctrlCard.style.display = 'flex';
    const m = target.meta;
    const isOuter = target.kind === 'outer';

    document.getElementById('activeSilTargetLabel').textContent = isOuter
      ? '当前人物剪影总外框'
      : '当前选中：自由剪影相框';
    document.getElementById('outerSilQuickActions').style.display = isOuter ? 'flex' : 'none';

    const selBlend = document.getElementById('selActiveSilBlend');
    const bMode = m.blendMode || 'pure';
    selBlend.value = bMode;

    const detailBox = document.getElementById('activeSilFusionDetailBox');
    detailBox.style.display = bMode === 'pure' ? 'none' : 'flex';

    if (bMode !== 'pure') {
      const opPct = Math.round((m.overlayOpacity ?? 0.48) * 100);
      document.getElementById('rngActiveSilOpacity').value = opPct;
      document.getElementById('lblActiveSilOpacity').textContent = `${opPct}%`;

      document.getElementById('activeSilLineColorRow').style.display = bMode === 'double_lineart' ? 'flex' : 'none';
      if (bMode === 'double_lineart') {
        document.getElementById('inpActiveSilLineCol').value = m.lineartColor || '#fef08a';
      }

      const partialBox = document.getElementById('activeSilPartialRows');
      partialBox.style.display = bMode === 'hero_partial' ? 'flex' : 'none';
      if (bMode === 'hero_partial') {
        // 若用户在提取窗手涂了原貌保留区域，隐藏纵向比例条，仅调羽化柔和度
        document.getElementById('activeSilKeepYRow').style.display = m.heroKeepDataUrl ? 'none' : 'flex';
        const keepPct = Math.round((m.heroKeepRatio ?? 0.34) * 100);
        document.getElementById('rngActiveSilKeepY').value = keepPct;
        document.getElementById('lblActiveSilKeepY').textContent = `${keepPct}%`;

        const fthPct = Math.round((m.heroFeather ?? 0.14) * 100);
        document.getElementById('rngActiveSilFeather').value = fthPct;
        document.getElementById('lblActiveSilFeather').textContent = `${fthPct}%`;
      }
    }
  }

  function openSilhouetteExtractorForAsset(asset) {
    if (!asset || !window.SilhouetteExtractor) return;
    window.SilhouetteExtractor.open(asset, (payload, targetKind) => {
      handleSilhouetteExtracted(payload, targetKind);
    });
  }

  function handleSilhouetteExtracted(payload, targetKind) {
    if (!payload || !payload.customPoints || payload.customPoints.length < 3) return;

    if (targetKind === 'outer') {
      // 设为唯一总外框（内部可自由切多格放其他角色！）
      const aspect = Math.max(0.25, Math.min(4.0, payload.aspect || 0.75));
      const longSide = 1800;
      const newW = aspect >= 1 ? longSide : Math.round(longSide * aspect);
      const newH = aspect >= 1 ? Math.round(longSide / aspect) : longSide;

      const cx = state.frameWorld.x + state.frameWorld.w * 0.5;
      const cy = state.frameWorld.y + state.frameWorld.h * 0.5;
      state.frameWorld = { x: Math.round(cx - newW / 2), y: Math.round(cy - newH / 2), w: newW, h: newH };
      state.canvasW = newW;
      state.canvasH = newH;
      state.hideBaseCells = false;

      state.contour = {
        type: 'custom',
        keepAspect: true,
        baseAspect: aspect,
        customPoints: payload.customPoints,
        silhouetteMeta: payload.silhouetteMeta
      };

      state.style.bgMode = 'transparent';
      state.style.margin = 0;
      if ((state.style.outerStroke || 0) < 3) {
        state.style.outerStroke = 5;
        state.style.outerStrokeColor = '#ffffff';
      }

      // 若当前画布各分镜尚未放入任何其他角色图片，自动预设两条顺应人物身形的优雅斜切分镜线，方便立刻拖入其他角色！
      const anyFilledCell = state.topology.cells.some(c => c.assetId);
      if (!anyFilledCell) {
        if (aspect <= 0.92) {
          state.cuts = [
            { id: `sil_c1_${Date.now()}`, mode: 'line', points: [{ x: 0, y: 0.37 }, { x: 1, y: 0.43 }], closed: false, autoExtend: true },
            { id: `sil_c2_${Date.now()}`, mode: 'line', points: [{ x: 0, y: 0.68 }, { x: 1, y: 0.62 }], closed: false, autoExtend: true }
          ];
        } else {
          state.cuts = [
            { id: `sil_c1_${Date.now()}`, mode: 'line', points: [{ x: 0.36, y: 0 }, { x: 0.30, y: 1 }], closed: false, autoExtend: true },
            { id: `sil_c2_${Date.now()}`, mode: 'line', points: [{ x: 0.68, y: 0 }, { x: 0.62, y: 1 }], closed: false, autoExtend: true }
          ];
        }
      }

      rebuildTopology();
      setActiveTool('select', false);
      openDrawer('creative', false);
      syncGlobalControlsFromState();
      renderCreativePanelUI();
      fitCameraToOuterFrame();
      pushHistory();
      renderAssetGridUI();
      requestRender();
      showToast('已将人物轮廓设为唯一总外框！可直接向轮廓内各分镜格拖入其他角色，或点「在剪影内切分镜」自由切割');
      return;
    }

    // 添加为画布内的自由剪影相框
    const silAspect = Math.max(0.25, Math.min(4.0, payload.aspect || 0.75));
    const canvasAspect = state.canvasW / Math.max(1, state.canvasH);
    let fwNorm = 0.36;
    let fhNorm = (fwNorm * canvasAspect) / silAspect;
    if (fhNorm > 0.72) {
      fhNorm = 0.72;
      fwNorm = (fhNorm * silAspect) / canvasAspect;
    }

    const defaultFollowEl = document.getElementById('chkDefaultFrameFollowCell');
    const newFf = {
      id: `ff_sil_${Date.now()}`,
      shape: 'custom',
      customPoints: payload.customPoints,
      silhouetteMeta: payload.silhouetteMeta,
      x: 0.5,
      y: 0.5,
      w: fwNorm,
      h: fhNorm,
      rotation: 0,
      borderWidth: 5,
      borderColor: '#ffffff',
      cornerRadius: 0,
      shadow: true,
      shadowBlur: 26,
      shadowColor: 'rgba(0,0,0,0.42)',
      caption: '',
      opacity: 1,
      visible: true,
      locked: false,
      zOrder: allocZOrder(),
      followHostCell: defaultFollowEl ? !!defaultFollowEl.checked : false,
      hostCellId: null,
      hostAnchorData: null,
      assetId: null,
      transform: window.PlanarSlicer.createDefaultImageTransform()
    };

    state.freeFrames.push(newFf);
    if (newFf.followHostCell && window.FxLabEngine) {
      window.FxLabEngine.recordFrameHostAnchor(newFf, state);
    }
    state.frameEditImageMode = false;
    setActiveTool('select', false);
    openDrawer('creative', false);
    selectItem('frame', newFf.id);
    renderCreativePanelUI();
    pushHistory();
    requestRender();
    showToast('已添加人物剪影自由相框：从左侧素材库将其他角色拖入该剪影框即可填充！');
  }

  function bindUIEvents() {
    // 顶部主工具条点击（选择工具即自动打开对应分类面板！）
    document.querySelectorAll('#mainToolStrip .tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tool;
        if (t === 'cut-group') {
          setActiveTool(state.lastCutTool || 'cut-line', true);
        } else if (t === 'contour-pen') {
          state.contourSubMode = 'poly';
          setActiveTool('contour-pen', true);
        } else {
          setActiveTool(t, false);
        }
      });
    });

    // 左侧功能分类轨点击（支持二次点击折叠收起抽屉）
    document.querySelectorAll('#leftIconRail .rail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dName = btn.dataset.drawer;
        openDrawer(dName, true);
        if (!state.drawerCollapsed) {
          if (dName === 'slicer') setActiveTool(state.lastCutTool || 'cut-line', false);
          else if (dName === 'stickers') setActiveTool('sticker', false);
          else if (dName !== 'contour' && state.tool !== 'select' && state.tool !== 'hand') {
            setActiveTool('select', false);
          }
        }
      });
    });

    // 左侧各抽屉内部胶囊子页签切换 (Segmented Sub-Tabs)
    document.querySelectorAll('.seg-tabs[data-tab-group]').forEach(tabBar => {
      const groupName = tabBar.dataset.tabGroup;
      tabBar.querySelectorAll('.seg-tab[data-subtab]').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
          switchDrawerSubTab(groupName, tabBtn.dataset.subtab);
        });
      });
    });

    // 左下角「风格设置」面板：三套界面基调、个性化外观细节、推拉动效速度与 6 款无损画布画风预设
    document.querySelectorAll('#uiThemeSwitcher [data-ui-theme]').forEach(chip => {
      chip.addEventListener('click', () => {
        applyUITheme(chip.dataset.uiTheme, false);
      });
    });

    document.querySelectorAll('.accent-preset-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        state.uiPrefs.customAccent = dot.dataset.accent;
        applyUIPrefsToDOM(true);
      });
    });
    document.getElementById('inpCustomAccent').addEventListener('input', (ev) => {
      state.uiPrefs.customAccent = ev.target.value;
      applyUIPrefsToDOM(true);
    });
    document.getElementById('btnResetCustomAccent').addEventListener('click', () => {
      state.uiPrefs.customAccent = null;
      applyUIPrefsToDOM(true);
      showToast('已恢复界面强调色跟随当前主题');
    });

    const rngGlass = document.getElementById('rngGlassAlpha');
    rngGlass.addEventListener('input', () => {
      state.uiPrefs.glassAlpha = parseInt(rngGlass.value, 10) || 80;
      applyUIPrefsToDOM(false);
    });
    rngGlass.addEventListener('change', () => applyUIPrefsToDOM(true));

    document.getElementById('chkShowCanvasGrid').addEventListener('change', (ev) => {
      state.uiPrefs.showCanvasGrid = ev.target.checked;
      applyUIPrefsToDOM(true);
    });
    document.getElementById('chkShowStageAura').addEventListener('change', (ev) => {
      state.uiPrefs.showStageAura = ev.target.checked;
      applyUIPrefsToDOM(true);
    });

    document.querySelectorAll('#motionSpeedGroup [data-motion]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.uiPrefs.motionSpeed = btn.dataset.motion;
        applyUIPrefsToDOM(true);
      });
    });

    document.getElementById('btnResetUISkin').addEventListener('click', () => {
      state.uiPrefs = {
        customAccent: null,
        glassAlpha: 80,
        showCanvasGrid: true,
        showStageAura: true,
        motionSpeed: 'smooth'
      };
      applyUITheme('pro-dark', true);
      applyUIPrefsToDOM(true);
      showToast('已恢复默认界面外观设置');
    });

    document.querySelectorAll('#canvasStylePresetGrid [data-cstyle]').forEach(card => {
      card.addEventListener('click', () => applyCanvasStylePreset(card.dataset.cstyle));
    });

    document.getElementById('selGlobalTone').addEventListener('change', (ev) => {
      state.style.globalTone = ev.target.value;
      pushHistory();
      requestRender();
    });
    const rngVig = document.getElementById('rngGlobalVignette');
    rngVig.addEventListener('input', () => {
      state.style.vignette = parseInt(rngVig.value, 10) || 0;
      document.getElementById('lblGlobalVignette').textContent = `${state.style.vignette}%`;
      requestRender();
    });
    rngVig.addEventListener('change', () => pushHistory());

    const rngGrn = document.getElementById('rngGlobalGrain');
    rngGrn.addEventListener('input', () => {
      state.style.grain = parseInt(rngGrn.value, 10) || 0;
      document.getElementById('lblGlobalGrain').textContent = `${state.style.grain}%`;
      requestRender();
    });
    rngGrn.addEventListener('change', () => pushHistory());

    document.getElementById('btnResetCanvasPostFx').addEventListener('click', () => {
      state.style.globalTone = 'none';
      state.style.vignette = 0;
      state.style.grain = 0;
      document.querySelectorAll('#canvasStylePresetGrid .canvas-preset-card').forEach(b => b.classList.remove('active'));
      syncGlobalControlsFromState();
      pushHistory();
      requestRender();
      showToast('已重置全局色调、暗角与颗粒质感');
    });

    // 右侧悬浮「属性精调 & 图层管理」一体式坞控制
    const rightDockEl = document.getElementById('rightDock');
    document.querySelectorAll('#rightDockTabs [data-right-view]').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const view = tabBtn.dataset.rightView;
        state.rightDockView = view;
        if (rightDockEl) rightDockEl.setAttribute('data-view', view);
        document.querySelectorAll('#rightDockTabs [data-right-view]').forEach(b => {
          b.classList.toggle('active', b === tabBtn);
        });
      });
    });
    document.getElementById('btnCollapseRightDock').addEventListener('click', () => setRightDockCollapsed(true));
    document.getElementById('btnExpandRightDock').addEventListener('click', () => setRightDockCollapsed(false));

    // 自定义装饰上传与一键去白底事件
    const rngStickerTol = document.getElementById('rngStickerChromaTol');
    const selStickerBg = document.getElementById('selStickerBgRemove');
    selStickerBg.addEventListener('change', () => {
      document.getElementById('stickerTolRow').style.display = selStickerBg.value === 'none' ? 'none' : 'flex';
    });
    rngStickerTol.addEventListener('input', () => {
      document.getElementById('lblStickerChromaTol').textContent = rngStickerTol.value;
    });
    document.getElementById('btnUploadCustomSticker').addEventListener('click', async () => {
      if (!window.desktopAPI) return;
      const payloads = await window.desktopAPI.openStickerImages();
      if (!payloads || !payloads.length) return;

      const bgMode = selStickerBg.value;
      const tol = parseInt(rngStickerTol.value, 10) || 38;
      let lastAdded = null;

      for (const p of payloads) {
        const rawImg = await loadImageElement(p.dataUrl);
        if (!rawImg) continue;
        let finalUrl = p.dataUrl;
        if (bgMode !== 'none') {
          finalUrl = window.StickerEngine.removeSolidBackgroundFromImage(rawImg, bgMode, tol);
        }
        const finalImg = await loadImageElement(finalUrl);
        if (!finalImg) continue;

        const cItem = {
          id: `cstk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: (p.name || '自定义装饰').replace(/\.[^.]+$/, ''),
          dataUrl: finalUrl,
          rawDataUrl: p.dataUrl,
          width: finalImg.naturalWidth,
          height: finalImg.naturalHeight
        };
        state.customStickers.unshift(cItem);
        state.customStickerMap.set(cItem.id, { ...cItem, img: finalImg });
        lastAdded = cItem;
      }

      if (lastAdded) {
        await window.desktopAPI.saveCustomStickers(state.customStickers);
        renderCustomStickerGalleryUI();
        spawnCustomSticker(lastAdded);
      }
    });

    // 3D 谷子把玩展台 & 灵感扭蛋机 & 应援色吸管 & 碎裂边缘控件绑定
    document.getElementById('btnOpenGoods3D').addEventListener('click', () => {
      if (window.Goods3DShowcase) window.Goods3DShowcase.open(state);
    });
    document.getElementById('btnGachaRoll').addEventListener('click', rollGachaLayout);

    document.getElementById('btnEyedropperBg').addEventListener('click', async () => {
      const picked = await window.FxLabEngine.pickScreenColorWithEyedropper();
      if (picked) {
        if (state.style.bgMode === 'transparent') state.style.bgMode = 'solid';
        state.style.bgColor1 = picked;
        syncGlobalControlsFromState();
        pushHistory();
        requestRender();
        showToast(`已吸取画面颜色 ${picked} 作为外框底色`);
      }
    });

    document.getElementById('btnEyedropperBorder').addEventListener('click', async () => {
      const picked = await window.FxLabEngine.pickScreenColorWithEyedropper();
      if (picked) {
        state.style.cellBorderColor = picked;
        syncGlobalControlsFromState();
        pushHistory();
        requestRender();
        showToast(`已吸取画面颜色 ${picked} 作为漫框描边`);
      }
    });

    document.getElementById('btnApplyOshiTheme').addEventListener('click', () => {
      const asset = getActiveCharacterAsset();
      const pal = window.FxLabEngine.extractCharacterOshiPalette(asset);
      if (state.contour.type === 'rect') {
        state.style.bgMode = 'gradient';
        state.style.bgColor1 = pal[3];
        state.style.bgColor2 = pal[0];
      }
      state.style.cellBorderColor = pal[4];
      state.style.outerStrokeColor = pal[1];
      if (state.selection && state.selection.type === 'sticker') {
        const st = state.stickers.find(s => s.id === state.selection.id);
        if (st && st.kind === 'builtin') {
          st.color1 = pal[0];
          st.color2 = pal[1];
        }
      }
      syncGlobalControlsFromState();
      renderSelectionInspector();
      pushHistory();
      requestRender();
      showToast('✨ 已一键配齐角色专属应援色主题！');
    });

    const rngShatterDen = document.getElementById('rngShatterDensity');
    rngShatterDen.addEventListener('input', () => {
      document.getElementById('lblShatterDensity').textContent = rngShatterDen.value;
    });
    document.getElementById('btnCrystalVoronoi').addEventListener('click', () => {
      const den = parseInt(rngShatterDen.value, 10) || 9;
      applyGeneratedShatterCuts(window.FxLabEngine.generateVoronoiCrystalCuts(den));
    });
    document.getElementById('btnSpanSameImgAll').addEventListener('click', spanSameImageAcrossAllCells);

    const rngRefract = document.getElementById('rngRefractStrength');
    rngRefract.addEventListener('input', () => {
      state.style.refractStrength = parseInt(rngRefract.value, 10) || 0;
      document.getElementById('lblRefractStrength').textContent = `${state.style.refractStrength}px`;
      requestRender();
    });
    rngRefract.addEventListener('change', () => pushHistory());

    document.getElementById('selEdgeStyle').addEventListener('change', (e) => {
      state.style.edgeStyle = e.target.value;
      pushHistory();
      requestRender();
      const names = { classic: '标准漫框', jigsaw: '真·凹凸拼图卡扣边', torn: '手撕画纸白毛边', film: '复古胶卷齿孔框' };
      showToast(`分镜边缘材质已切换为：${names[state.style.edgeStyle]}`);
    });

    document.getElementById('btnCollapseDrawer').addEventListener('click', () => {
      state.drawerCollapsed = true;
      document.getElementById('contextDrawer').classList.add('collapsed');
      document.querySelectorAll('#leftIconRail .rail-btn').forEach(b => b.classList.remove('active'));
      requestRender();
    });

    // 分镜切割抽屉内的三种刀切换
    document.querySelectorAll('.slice-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setActiveTool(btn.dataset.cutTool, false));
    });

    document.getElementById('btnAutoExtend').addEventListener('click', (e) => {
      state.autoExtend = !state.autoExtend;
      e.currentTarget.classList.toggle('on', state.autoExtend);
      requestRender();
    });

    // 顶部收纳下拉菜单
    const moreBtn = document.getElementById('btnMoreMenu');
    const moreMenu = document.getElementById('moreDropdownMenu');
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moreMenu.classList.toggle('open');
    });
    window.addEventListener('click', () => moreMenu.classList.remove('open'));

    document.getElementById('btnToggleGhostMenu').addEventListener('click', (e) => {
      state.showXRayGhost = !state.showXRayGhost;
      e.currentTarget.textContent = `👁 框外透视预览：${state.showXRayGhost ? '已开启' : '已关闭'}`;
      requestRender();
    });
    document.getElementById('btnToggleSlotsMenu').addEventListener('click', (e) => {
      state.showSlotLabels = !state.showSlotLabels;
      e.currentTarget.textContent = `🏷 显示槽位编号：${state.showSlotLabels ? '已开启' : '已关闭'}`;
      requestRender();
    });
    document.getElementById('btnThemeToggle').addEventListener('click', () => {
      const order = ['pro-dark', 'oshi-neon', 'creamy-light'];
      const next = order[(order.indexOf(state.uiTheme) + 1) % order.length];
      applyUITheme(next, false);
    });

    document.getElementById('btnUndo').addEventListener('click', undo);
    document.getElementById('btnRedo').addEventListener('click', redo);
    document.getElementById('btnClearCanvasAll').addEventListener('click', clearAllCanvasDesigns);

    // 自由相框画布内悬浮操作条绑定
    document.getElementById('btnModeMoveFrame').addEventListener('click', () => {
      state.frameEditImageMode = false;
      renderSelectionInspector();
      updateFloatingFrameBarPosition();
      requestRender();
    });
    document.getElementById('btnModePanFrameImg').addEventListener('click', () => {
      state.frameEditImageMode = true;
      renderSelectionInspector();
      updateFloatingFrameBarPosition();
      requestRender();
      showToast('现在直接在相框内左键拖动即可改变照片选中区域！');
    });
    document.getElementById('btnToggleFrameFollowCell').addEventListener('click', () => {
      if (state.selection && state.selection.type === 'frame') {
        const ff = state.freeFrames.find(f => f.id === state.selection.id);
        if (ff) {
          ff.followHostCell = !ff.followHostCell;
          if (window.FxLabEngine) window.FxLabEngine.recordFrameHostAnchor(ff, state);
          renderSelectionInspector();
          updateFloatingFrameBarPosition();
          pushHistory();
          requestRender();
          showToast(ff.followHostCell ? '🔗 已开启：随所属分镜图片同步缩放与转向' : '🔓 已关闭：相框保持独立不随底下分镜变动');
        }
      }
    });
    document.getElementById('btnQuickCropFrame').addEventListener('click', () => {
      if (state.selection && state.selection.type === 'frame') {
        const ff = state.freeFrames.find(f => f.id === state.selection.id);
        if (ff && ff.assetId) openCropForFrame(ff);
      }
    });

    // 素材导入与管理
    document.getElementById('btnPickImages').addEventListener('click', async () => {
      if (window.desktopAPI) await importImagePayloads(await window.desktopAPI.openImages());
    });
    document.getElementById('btnPickFolder').addEventListener('click', async () => {
      if (window.desktopAPI) await importImagePayloads(await window.desktopAPI.openFolder());
    });
    document.getElementById('btnAutoFillCells').addEventListener('click', () => autoFillEmptySlots());
    document.getElementById('btnShuffleCells').addEventListener('click', () => {
      const filled = state.topology.cells.filter(c => c.assetId);
      if (filled.length < 2) return showToast('需要至少两格有图才能随机换位');
      const ids = filled.map(c => c.assetId);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      filled.forEach((c, idx) => {
        c.assetId = ids[idx];
        c.transform = window.PlanarSlicer.createDefaultImageTransform();
      });
      pushHistory();
      requestRender();
    });
    document.getElementById('btnClearAssets').addEventListener('click', () => {
      const usedSet = new Set();
      state.topology.cells.forEach(c => c.assetId && usedSet.add(c.assetId));
      state.freeFrames.forEach(f => {
        if (f.assetId) usedSet.add(f.assetId);
        if (f.silhouetteMeta && f.silhouetteMeta.assetId) usedSet.add(f.silhouetteMeta.assetId);
      });
      if (state.contour && state.contour.silhouetteMeta && state.contour.silhouetteMeta.assetId) {
        usedSet.add(state.contour.silhouetteMeta.assetId);
      }
      state.assets = state.assets.filter(a => usedSet.has(a.id));
      state.assetMap = new Map(state.assets.map(a => [a.id, a]));
      renderAssetGridUI();
      showToast('已清理未使用的素材');
    });

    // 独立创意玩法：人物剪影容器控制面板事件绑定
    document.getElementById('btnPickImgForSilhouette').addEventListener('click', async () => {
      if (!window.desktopAPI) return;
      const payloads = await window.desktopAPI.openImages();
      if (!payloads || !payloads.length) return;
      const added = await importImagePayloads([payloads[0]]);
      if (added && added[0]) {
        openSilhouetteExtractorForAsset(added[0]);
      }
    });

    document.getElementById('btnSilReExtract').addEventListener('click', () => {
      const t = getActiveSilhouetteTarget();
      if (!t || !t.meta.assetId) return;
      const ast = state.assetMap.get(t.meta.assetId);
      if (!ast) return showToast('原人物素材已移除，请重新选取一张图片提取');
      openSilhouetteExtractorForAsset(ast);
    });

    document.getElementById('btnSilQuickSlice').addEventListener('click', () => {
      setActiveTool(state.lastCutTool || 'cut-line', true);
      showToast('已切换为分镜切割刀：直接在人物剪影轮廓内部拉线即可切出多格放置其他角色！');
    });

    document.getElementById('btnSilEditNodes').addEventListener('click', () => {
      if (state.contour.type === 'custom') {
        state.editingContourNodes = !state.editingContourNodes;
        requestRender();
        showToast(state.editingContourNodes ? '已显示人物轮廓锚点，可拖拽任意锚点精细微调外边缘' : '已关闭锚点微调');
      }
    });

    document.getElementById('selActiveSilBlend').addEventListener('change', (ev) => {
      const t = getActiveSilhouetteTarget();
      if (!t) return;
      t.meta.blendMode = ev.target.value;
      if (t.meta.blendMode === 'hero_partial' && (t.meta.overlayOpacity ?? 0.48) < 0.8) {
        t.meta.overlayOpacity = 0.96;
      } else if ((t.meta.blendMode === 'double_lineart' || t.meta.blendMode === 'double_soft') && (t.meta.overlayOpacity ?? 0.5) > 0.85) {
        t.meta.overlayOpacity = 0.48;
      }
      renderCreativePanelUI();
      pushHistory();
      requestRender();
    });

    const rngSilOp = document.getElementById('rngActiveSilOpacity');
    rngSilOp.addEventListener('input', () => {
      const t = getActiveSilhouetteTarget();
      if (!t) return;
      t.meta.overlayOpacity = (parseInt(rngSilOp.value, 10) || 48) / 100;
      document.getElementById('lblActiveSilOpacity').textContent = `${rngSilOp.value}%`;
      requestRender();
    });
    rngSilOp.addEventListener('change', () => pushHistory());

    document.querySelectorAll('.sil-linecol-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const t = getActiveSilhouetteTarget();
        if (!t) return;
        t.meta.lineartColor = dot.dataset.lcol;
        document.getElementById('inpActiveSilLineCol').value = dot.dataset.lcol;
        pushHistory();
        requestRender();
      });
    });

    const inpSilLineCol = document.getElementById('inpActiveSilLineCol');
    inpSilLineCol.addEventListener('input', () => {
      const t = getActiveSilhouetteTarget();
      if (!t) return;
      t.meta.lineartColor = inpSilLineCol.value;
      requestRender();
    });
    inpSilLineCol.addEventListener('change', () => pushHistory());

    const rngSilKeepY = document.getElementById('rngActiveSilKeepY');
    rngSilKeepY.addEventListener('input', () => {
      const t = getActiveSilhouetteTarget();
      if (!t) return;
      t.meta.heroKeepRatio = (parseInt(rngSilKeepY.value, 10) || 34) / 100;
      document.getElementById('lblActiveSilKeepY').textContent = `${rngSilKeepY.value}%`;
      requestRender();
    });
    rngSilKeepY.addEventListener('change', () => pushHistory());

    const rngSilFth = document.getElementById('rngActiveSilFeather');
    rngSilFth.addEventListener('input', () => {
      const t = getActiveSilhouetteTarget();
      if (!t) return;
      t.meta.heroFeather = (parseInt(rngSilFth.value, 10) || 14) / 100;
      document.getElementById('lblActiveSilFeather').textContent = `${rngSilFth.value}%`;
      requestRender();
    });
    rngSilFth.addEventListener('change', () => pushHistory());

    // 拖拽上传
    const sideDrop = document.getElementById('sidebarDropZone');
    sideDrop.addEventListener('dragover', (e) => { e.preventDefault(); sideDrop.classList.add('dragover'); });
    sideDrop.addEventListener('dragleave', () => sideDrop.classList.remove('dragover'));
    sideDrop.addEventListener('drop', async (e) => {
      e.preventDefault();
      sideDrop.classList.remove('dragover');
      await importImagePayloads(await extractDroppedImagePayloads(e.dataTransfer));
    });

    const dropHint = document.getElementById('viewportDropHint');
    viewportEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const pos = getPointerCoords(e);
      const hitFf = hitTestFreeFrame(pos.nx, pos.ny);
      const hitCl = !hitFf ? hitTestCell(pos.fx, pos.fy) : null;
      state.dragHoverTarget = hitFf ? { type: 'frame', id: hitFf.id } : hitCl ? { type: 'cell', id: hitCl.id } : null;
      if (!e.dataTransfer.types.includes('text/asset-id')) dropHint.classList.add('visible');
      requestRender();
    });
    viewportEl.addEventListener('dragleave', (e) => {
      if (!viewportEl.contains(e.relatedTarget)) {
        dropHint.classList.remove('visible');
        state.dragHoverTarget = null;
        requestRender();
      }
    });
    viewportEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropHint.classList.remove('visible');
      state.dragHoverTarget = null;

      const pos = getPointerCoords(e);
      const hitFf = hitTestFreeFrame(pos.nx, pos.ny);
      const hitCl = !hitFf ? hitTestCell(pos.fx, pos.fy) : null;

      const draggedAssetId = e.dataTransfer.getData('text/asset-id');
      if (draggedAssetId && state.assetMap.has(draggedAssetId)) {
        if (hitFf) fillImageIntoFrame(hitFf, draggedAssetId);
        else if (hitCl) fillImageIntoCell(hitCl, draggedAssetId);
        else assignAssetToSelectedOrFirstEmpty(draggedAssetId);
        pushHistory();
        renderAssetGridUI();
        return;
      }

      const imported = await importImagePayloads(await extractDroppedImagePayloads(e.dataTransfer));
      if (!imported.length) return;

      if (imported.length === 1 && hitFf) {
        fillImageIntoFrame(hitFf, imported[0].id);
      } else if (imported.length === 1 && hitCl) {
        fillImageIntoCell(hitCl, imported[0].id);
      } else {
        let rest = imported;
        if (hitCl) {
          fillImageIntoCell(hitCl, imported[0].id);
          rest = imported.slice(1);
        }
        if (rest.length > 0) autoFillEmptySlots(rest);
      }
      pushHistory();
      renderAssetGridUI();
    });

    window.addEventListener('paste', async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const files = [];
      for (const it of items) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        const imported = await importImagePayloads(await readBrowserFilesAsPayloads(files));
        if (imported.length > 0) assignAssetToSelectedOrFirstEmpty(imported[0].id);
      }
    });

    // 无限画布唯一总外框控件
    document.getElementById('chkKeepContourAspect').addEventListener('change', (e) => {
      state.contour.keepAspect = e.target.checked;
      rebuildTopology(); pushHistory(); requestRender();
    });
    document.getElementById('btnDrawCustomPolyContour').addEventListener('click', () => {
      state.contourSubMode = 'poly';
      setActiveTool('contour-pen', false);
      showToast('现在可在无限画布任意空白位置点击添加锚点，闭合后将替换为唯一总外框！');
    });
    document.getElementById('btnDrawCustomFreeContour').addEventListener('click', () => {
      state.contourSubMode = 'free';
      setActiveTool('contour-pen', false);
      showToast('现在可在无限画布任意位置按住鼠标自由圈出形状，松手即生成唯一总外框！');
    });
    document.getElementById('btnEditContourNodes').addEventListener('click', () => {
      if (state.contour.type !== 'custom') {
        const poly = window.SilhouetteEngine.buildOuterContourPolygon(state.contour, state.canvasW, state.canvasH);
        const simp = window.SilhouetteEngine.simplifyPolyline(poly.concat([poly[0]]), Math.max(8, Math.min(state.canvasW, state.canvasH) * 0.03)).slice(0, -1);
        state.contour = {
          type: 'custom',
          keepAspect: false,
          baseAspect: state.canvasW / state.canvasH,
          customPoints: simp.map(p => ({ x: p.x / state.canvasW, y: p.y / state.canvasH, smooth: false }))
        };
      }
      setActiveTool('select', false);
      state.editingContourNodes = !state.editingContourNodes;
      rebuildTopology();
      requestRender();
      showToast(state.editingContourNodes ? '可任意向无限画布内外拖拽外框顶点，双击顶点切换圆弧/折角' : '已结束顶点微调');
    });
    document.getElementById('btnToggleContourSmooth').addEventListener('click', () => {
      if (state.contour.type !== 'custom' || !state.contour.customPoints.length) {
        return showToast('请先绘制自定义异形外框');
      }
      const nextSmooth = !state.contour.customPoints[0].smooth;
      state.contour.customPoints.forEach(p => { p.smooth = nextSmooth; });
      rebuildTopology(); pushHistory(); requestRender();
    });

    // 外框比例与像素
    document.querySelectorAll('#ratioPresetGrid .ratio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ratioPresetGrid .ratio-btn').forEach(b => b.classList.toggle('active', b === btn));
        const r = btn.dataset.ratio;
        if (r === 'v-long' || r === 'h-long') return applySeamlessLongStrip(r);
        const [rw, rh] = r.split(':').map(Number);
        const longSide = Math.max(state.canvasW, state.canvasH, 1600);
        if (rw >= rh) resizeOuterFrameSmart(longSide, Math.round((longSide * rh) / rw));
        else resizeOuterFrameSmart(Math.round((longSide * rw) / rh), longSide);
      });
    });

    document.querySelectorAll('[data-res-tier]').forEach(btn => {
      btn.addEventListener('click', () => {
        const shortTarget = parseInt(btn.dataset.resTier, 10);
        const aspect = state.canvasW / state.canvasH;
        if (aspect >= 1) resizeOuterFrameSmart(Math.round(shortTarget * aspect), shortTarget);
        else resizeOuterFrameSmart(shortTarget, Math.round(shortTarget / aspect));
        showToast(`外框分辨率已设为 ${state.canvasW}×${state.canvasH}`);
      });
    });

    document.getElementById('inputCanvasW').addEventListener('change', (e) => {
      resizeOuterFrameSmart(Math.max(80, Math.min(12000, parseInt(e.target.value, 10) || 1920)), state.canvasH);
    });
    document.getElementById('inputCanvasH').addEventListener('change', (e) => {
      resizeOuterFrameSmart(state.canvasW, Math.max(80, Math.min(12000, parseInt(e.target.value, 10) || 1080)));
    });

    document.getElementById('selBgMode').addEventListener('change', (e) => {
      state.style.bgMode = e.target.value;
      syncGlobalControlsFromState(); pushHistory(); requestRender();
    });
    document.getElementById('inputBgColor1').addEventListener('input', (e) => { state.style.bgColor1 = e.target.value; requestRender(); });
    document.getElementById('inputBgColor2').addEventListener('input', (e) => { state.style.bgColor2 = e.target.value; requestRender(); });
    document.getElementById('selGradAngle').addEventListener('change', (e) => { state.style.gradAngle = parseInt(e.target.value, 10); requestRender(); });

    bindRangeControl('rngGutter', 'lblGutter', v => { state.style.gutter = v; });
    bindRangeControl('rngMargin', 'lblMargin', v => { state.style.margin = v; });
    bindRangeControl('rngCellBorder', 'lblCellBorder', v => { state.style.cellBorder = v; });
    bindRangeControl('rngOuterStroke', 'lblOuterStroke', v => { state.style.outerStroke = v; });

    document.getElementById('inputCellBorderColor').addEventListener('input', (e) => { state.style.cellBorderColor = e.target.value; requestRender(); });
    document.getElementById('inputOuterStrokeColor').addEventListener('input', (e) => { state.style.outerStrokeColor = e.target.value; requestRender(); });

    document.getElementById('btnClearAllCuts').addEventListener('click', () => {
      state.cuts = [];
      state.hideBaseCells = false;
      selectItem(null, null);
      rebuildTopology(); pushHistory(); requestRender();
    });

    // 底部无限画布相机 HUD
    document.getElementById('btnZoomIn').addEventListener('click', () => {
      state.camZoom = Math.min(6.0, state.camZoom * 1.2);
      updateZoomHudUI(); requestRender();
    });
    document.getElementById('btnZoomOut').addEventListener('click', () => {
      state.camZoom = Math.max(0.05, state.camZoom / 1.2);
      updateZoomHudUI(); requestRender();
    });
    document.getElementById('btnZoomFit').addEventListener('click', () => fitCameraToOuterFrame());
    window.addEventListener('resize', () => requestRender());

    // 模板分类与保存
    document.querySelectorAll('#tplCategoryPills .pill').forEach(p => {
      p.addEventListener('click', () => {
        document.querySelectorAll('#tplCategoryPills .pill').forEach(x => x.classList.toggle('active', x === p));
        state.activeTplCategory = p.dataset.cat;
        renderTemplateGalleryUI();
      });
    });

    const saveTplModal = document.getElementById('saveTplModal');
    document.getElementById('btnSaveAsCustomTpl').addEventListener('click', () => {
      document.getElementById('inputCustomTplName').value = `自定义布局_${state.customTemplates.length + 1}`;
      saveTplModal.classList.add('open');
    });
    document.getElementById('btnCloseSaveTplModal').addEventListener('click', () => saveTplModal.classList.remove('open'));
    document.getElementById('btnConfirmSaveTpl').addEventListener('click', async () => {
      const name = document.getElementById('inputCustomTplName').value.trim() || '我的自定义模板';
      const tpl = buildTemplateObjectFromCurrentState(name);
      state.customTemplates.unshift(tpl);
      if (window.desktopAPI) await window.desktopAPI.saveCustomTemplates(state.customTemplates);
      saveTplModal.classList.remove('open');
      state.activeTplCategory = 'custom';
      document.querySelectorAll('#tplCategoryPills .pill').forEach(x => x.classList.toggle('active', x.dataset.cat === 'custom'));
      renderTemplateGalleryUI();
      showToast(`已保存至「我的模板」：${name}`);
    });
    document.getElementById('btnExportTplDirectly').addEventListener('click', async () => {
      const name = document.getElementById('inputCustomTplName').value.trim() || '自定义模板';
      const tpl = buildTemplateObjectFromCurrentState(name);
      if (window.desktopAPI) {
        const res = await window.desktopAPI.exportTemplateFile({ templateData: tpl, name });
        if (res && !res.canceled) { saveTplModal.classList.remove('open'); showToast('已导出模板文件'); }
      }
    });
    document.getElementById('btnImportTplFile').addEventListener('click', async () => {
      if (!window.desktopAPI) return;
      const res = await window.desktopAPI.importTemplateFile();
      if (res && !res.canceled) {
        if (res.error) return showToast(res.error);
        const tpl = { ...res.data, id: `custom_${Date.now()}`, isCustom: true, category: 'custom' };
        state.customTemplates.unshift(tpl);
        await window.desktopAPI.saveCustomTemplates(state.customTemplates);
        renderTemplateGalleryUI();
        applyTemplate(tpl);
      }
    });

    // 工程保存与打开
    document.getElementById('btnSaveProj').addEventListener('click', async () => {
      if (!window.desktopAPI) return;
      const usedCustomStickerIds = new Set(state.stickers.filter(s => s.kind === 'custom').map(s => s.customId));
      const bundledCustomStickers = state.customStickers.filter(cs => usedCustomStickerIds.has(cs.id));
      const projObj = {
        version: '2.1',
        savedAt: new Date().toISOString(),
        assets: state.assets.map(a => ({ id: a.id, name: a.name, dataUrl: a.dataUrl, width: a.width, height: a.height })),
        customStickers: bundledCustomStickers,
        snapshot: JSON.parse(captureSnapshot())
      };
      const res = await window.desktopAPI.saveProject({
        projectJson: JSON.stringify(projObj),
        defaultName: `拼图工程_${state.canvasW}x${state.canvasH}.collage-proj.json`
      });
      if (res && !res.canceled) showToast('完整拼图工程已保存');
    });

    document.getElementById('btnOpenProj').addEventListener('click', async () => {
      if (!window.desktopAPI) return;
      const res = await window.desktopAPI.openProject();
      if (!res || res.canceled) return;
      if (res.error || !res.data || !res.data.snapshot) return showToast(res.error || '工程文件无效');
      state.assets = [];
      state.assetMap.clear();
      for (const a of (res.data.assets || [])) {
        const img = await loadImageElement(a.dataUrl);
        if (img) {
          const obj = { id: a.id, name: a.name, dataUrl: a.dataUrl, width: img.naturalWidth, height: img.naturalHeight, img };
          state.assets.push(obj);
          state.assetMap.set(obj.id, obj);
        }
      }
      for (const cs of (res.data.customStickers || [])) {
        if (!state.customStickerMap.has(cs.id)) {
          const img = await loadImageElement(cs.dataUrl);
          if (img) {
            state.customStickers.push(cs);
            state.customStickerMap.set(cs.id, { ...cs, img });
          }
        }
      }
      renderCustomStickerGalleryUI();
      restoreSnapshot(JSON.stringify(res.data.snapshot));
      fitCameraToOuterFrame();
      pushHistory();
      renderAssetGridUI();
      showToast('拼图工程已恢复');
    });

    // 严格只导出唯一总外框内部内容的导出逻辑
    const exportModal = document.getElementById('exportModal');
    const selFmt = document.getElementById('selExportFormat');
    const selScale = document.getElementById('selExportScale');
    const rngQual = document.getElementById('rngExportQuality');

    function updateExportPreviewInfo() {
      const fmt = selFmt.value;
      const sc = parseFloat(selScale.value) || 1;
      document.getElementById('exportQualityRow').style.display = fmt === 'png' ? 'none' : 'flex';
      document.getElementById('lblExportEstSize').textContent =
        `${Math.round(state.canvasW * sc)} × ${Math.round(state.canvasH * sc)} px${document.getElementById('chkExportAutoTrim').checked && fmt !== 'jpeg' ? ' (自动裁透明空白)' : ''}`;
    }

    document.getElementById('btnOpenExport').addEventListener('click', () => {
      if (state.contour.type !== 'rect' && selFmt.value === 'jpeg') selFmt.value = 'png';
      updateExportPreviewInfo();
      exportModal.classList.add('open');
    });
    document.getElementById('btnCloseExportModal').addEventListener('click', () => exportModal.classList.remove('open'));
    document.getElementById('btnCancelExport').addEventListener('click', () => exportModal.classList.remove('open'));
    selFmt.addEventListener('change', updateExportPreviewInfo);
    selScale.addEventListener('change', updateExportPreviewInfo);
    document.getElementById('chkExportAutoTrim').addEventListener('change', updateExportPreviewInfo);
    rngQual.addEventListener('input', () => { document.getElementById('lblExportQuality').textContent = `${rngQual.value}%`; });

    document.getElementById('btnConfirmExport').addEventListener('click', async () => {
      const format = selFmt.value;
      const mult = parseFloat(selScale.value) || 1;
      const quality = (parseInt(rngQual.value, 10) || 95) / 100;
      const autoTrim = document.getElementById('chkExportAutoTrim').checked && format !== 'jpeg';

      let offCanvas = document.createElement('canvas');
      window.CollageRenderer.renderOuterFrameBuffer(offCanvas, state, {
        isExport: true,
        renderScale: mult,
        exportFormat: format
      });

      if (autoTrim) {
        offCanvas = window.CollageRenderer.autoTrimTransparentCanvas(offCanvas, Math.round(2 * mult));
      }

      const mime = `image/${format}`;
      const dataUrl = format === 'png' ? offCanvas.toDataURL(mime) : offCanvas.toDataURL(mime, quality);
      const ext = format === 'jpeg' ? 'jpg' : format;
      const defaultName = `拼图_${offCanvas.width}x${offCanvas.height}.${ext}`;

      if (window.desktopAPI) {
        const res = await window.desktopAPI.saveExportImage({ dataUrl, defaultName, format });
        if (res && !res.canceled) {
          exportModal.classList.remove('open');
          showToast(`已成功保存唯一外框成品 (${offCanvas.width}×${offCanvas.height}px)`);
          window.desktopAPI.showItemInFolder(res.filePath);
        }
      }
    });

    // 键盘空格平移画布 & 快捷键
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.modal-backdrop.open')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!state.spacePressed) {
          state.spacePressed = true;
          updateCursorStyle();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        if (state.draft) { state.draft = null; requestRender(); }
        else if (state.editingContourNodes) { state.editingContourNodes = false; requestRender(); }
        else selectItem(null, null);
        return;
      }
      if (e.key === 'Enter' && state.draft) {
        if (state.draft.kind === 'contour-world-poly' && state.draft.worldPoints.length >= 3) {
          applyWorldPointsAsSingleOuterFrame(state.draft.worldPoints, true);
          state.draft = null;
        } else if (state.draft.points && state.draft.points.length >= 2) {
          commitDraftCut(state.draft.points, state.draft.kind === 'cut-curve' ? 'curve' : 'line', false);
          state.draft = null;
          requestRender();
        }
        return;
      }
      // 选中贴脸小装饰时支持键盘 ↑ ↓ ← → 1像素级微调对位（Shift+方向键 = 10px）！
      if (state.selection && state.selection.type === 'sticker' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const st = state.stickers.find(s => s.id === state.selection.id);
        if (st) {
          const stepPx = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowLeft') st.x -= stepPx / state.canvasW;
          else if (e.key === 'ArrowRight') st.x += stepPx / state.canvasW;
          else if (e.key === 'ArrowUp') st.y -= stepPx / state.canvasH;
          else if (e.key === 'ArrowDown') st.y += stepPx / state.canvasH;
          autoBindStickerToUnderlyingPhoto(st);
          debouncedPushHistory();
          requestRender();
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!state.selection) return;
        const { type, id } = state.selection;
        if (type === 'cut') {
          state.cuts = state.cuts.filter(c => c.id !== id);
          selectItem(null, null); rebuildTopology(); pushHistory(); requestRender();
        } else if (type === 'frame') {
          state.freeFrames = state.freeFrames.filter(f => f.id !== id);
          selectItem(null, null); pushHistory(); renderAssetGridUI(); requestRender();
        } else if (type === 'sticker') {
          state.stickers = state.stickers.filter(s => s.id !== id);
          selectItem(null, null); pushHistory(); requestRender();
        } else if (type === 'loupe') {
          state.loupes = state.loupes.filter(l => l.id !== id);
          selectItem(null, null); pushHistory(); requestRender();
        } else if (type === 'text') {
          state.texts = state.texts.filter(t => t.id !== id);
          selectItem(null, null); pushHistory(); requestRender();
        } else if (type === 'cell') {
          const c = state.topology.cells.find(x => x.id === id);
          if (c && c.assetId) {
            c.assetId = null;
            pushHistory(); renderAssetGridUI(); renderSelectionInspector(); requestRender();
          }
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'v') setActiveTool('select', false);
      else if (k === 'h') setActiveTool('hand', false);
      else if (k === 's') setActiveTool('sticker', true);
      else if (k === 'g') rollGachaLayout();
      else if (k === 'l') setActiveTool('cut-line', true);
      else if (k === 'c') setActiveTool('cut-curve', true);
      else if (k === 'p') setActiveTool('cut-free', true);
      else if (k === 'm') { state.contourSubMode = 'poly'; setActiveTool('contour-pen', true); }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        state.spacePressed = false;
        updateCursorStyle();
      }
    });
  }

  function bindRangeControl(sliderId, labelId, setter) {
    const el = document.getElementById(sliderId);
    const lbl = document.getElementById(labelId);
    el.addEventListener('input', () => {
      const val = parseInt(el.value, 10) || 0;
      lbl.textContent = `${val}px`;
      setter(val);
      requestRender();
    });
    el.addEventListener('change', () => pushHistory());
  }

  async function bootstrap() {
    initStaticPanels();
    bindUIEvents();
    try {
      const savedPrefs = localStorage.getItem('prism_ui_prefs_v1');
      if (savedPrefs) {
        state.uiPrefs = { ...state.uiPrefs, ...JSON.parse(savedPrefs) };
      }
      const savedTheme = localStorage.getItem('prism_ui_theme');
      if (savedTheme) applyUITheme(savedTheme, true);
      else applyUITheme('pro-dark', true);
    } catch (e) {
      applyUITheme('pro-dark', true);
    }
    applyUIPrefsToDOM(false);
    if (window.Goods3DShowcase) window.Goods3DShowcase.bindEvents();
    if (window.SilhouetteExtractor) window.SilhouetteExtractor.bindEvents();

    if (window.desktopAPI) {
      try {
        const savedTpls = await window.desktopAPI.loadCustomTemplates();
        if (Array.isArray(savedTpls)) state.customTemplates = savedTpls;
      } catch (e) {}

      try {
        const savedStickers = await window.desktopAPI.loadCustomStickers();
        if (Array.isArray(savedStickers)) {
          for (const cs of savedStickers) {
            const img = await loadImageElement(cs.dataUrl);
            if (img) {
              state.customStickers.push(cs);
              state.customStickerMap.set(cs.id, { ...cs, img });
            }
          }
        }
      } catch (e) {}

      window.desktopAPI.getSystemFonts().then((fonts) => {
        if (Array.isArray(fonts) && fonts.length > 0) {
          state.systemFonts = fonts;
          if (state.selection && state.selection.type === 'text') renderSelectionInspector();
        }
      });
    }

    renderCustomStickerGalleryUI();

    rebuildTopology([]);
    const defaultLabels = ['#1 角色A', '#2 主视觉C位', '#3 角色B'];
    state.topology.cells.forEach((c, i) => { if (defaultLabels[i]) c.slotLabel = defaultLabels[i]; });

    syncGlobalControlsFromState();
    renderOshiPaletteUI();
    renderTemplateGalleryUI();
    renderAssetGridUI();
    renderSelectionInspector();
    requestAnimationFrame(() => {
      fitCameraToOuterFrame();
      pushHistory();
      renderAll();
    });
  }

  bootstrap();
})();
