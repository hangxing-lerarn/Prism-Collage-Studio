(function (global) {
  const BUILTIN_TEMPLATES = [
    // ==================== 1. 动漫 / 壁纸分镜 ====================
    {
      id: 'anime_16_9_slash3',
      name: '斜切三分镜壁纸',
      category: 'anime',
      ratioLabel: '16:9',
      canvasW: 1920,
      canvasH: 1080,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#0f172a', bgColor2: '#1e293b', gradAngle: 135, gutter: 14, margin: 18, cellBorder: 4, cellBorderColor: '#ffffff', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.38, y: 0 }, { x: 0.27, y: 1 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0.73, y: 0 }, { x: 0.62, y: 1 }], closed: false, autoExtend: true }
      ],
      slotLabels: ['#1 角色A', '#2 主视觉C位', '#3 角色B'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_16_9_char_closeup',
      name: '立绘 + 右侧三连特写',
      category: 'anime',
      ratioLabel: '16:9',
      canvasW: 1920,
      canvasH: 1080,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#f1f5f9', gradAngle: 135, gutter: 12, margin: 16, cellBorder: 3, cellBorderColor: '#111827', outerStroke: 0, outerStrokeColor: '#111827' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.56, y: 0 }, { x: 0.44, y: 1 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0.52, y: 0.34 }, { x: 1.0, y: 0.26 }], closed: false, autoExtend: false },
        { id: 'c3', mode: 'line', points: [{ x: 0.48, y: 0.68 }, { x: 1.0, y: 0.60 }], closed: false, autoExtend: false }
      ],
      slotLabels: ['#1 全身主立绘', '#2 眼神特写', '#3 表情/手部细节', '#4 武器/饰品特写'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_16_9_scurve',
      name: '双生 S 曲线流线壁纸',
      category: 'anime',
      ratioLabel: '16:9',
      canvasW: 1920,
      canvasH: 1080,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#e2e8f0', gradAngle: 135, gutter: 16, margin: 16, cellBorder: 3, cellBorderColor: '#0f172a', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        {
          id: 'c1',
          mode: 'curve',
          points: [{ x: 0.54, y: 0 }, { x: 0.46, y: 1 }],
          cp1: { x: 0.28, y: 0.33 },
          cp2: { x: 0.72, y: 0.67 },
          closed: false,
          autoExtend: false
        }
      ],
      slotLabels: ['#1 左翼角色', '#2 右翼角色'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_16_9_lightning',
      name: '闪电折线对决分镜',
      category: 'anime',
      ratioLabel: '16:9',
      canvasW: 1920,
      canvasH: 1080,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#111827', bgColor2: '#1f2937', gradAngle: 135, gutter: 14, margin: 14, cellBorder: 4, cellBorderColor: '#f8fafc', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        {
          id: 'c1',
          mode: 'line',
          points: [
            { x: 0.56, y: 0 },
            { x: 0.44, y: 0.38 },
            { x: 0.57, y: 0.48 },
            { x: 0.42, y: 1 }
          ],
          closed: false,
          autoExtend: false
        }
      ],
      slotLabels: ['#1 对决方A', '#2 对决方B'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_16_9_pip_eye',
      name: '全景 + 挖洞内嵌眼神框',
      category: 'anime',
      ratioLabel: '16:9',
      canvasW: 1920,
      canvasH: 1080,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 135, gutter: 12, margin: 14, cellBorder: 4, cellBorderColor: '#0f172a', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        {
          id: 'c_island',
          mode: 'line',
          points: [
            { x: 0.56, y: 0.14 },
            { x: 0.94, y: 0.10 },
            { x: 0.91, y: 0.38 },
            { x: 0.53, y: 0.42 }
          ],
          closed: true,
          autoExtend: false
        }
      ],
      slotLabels: ['#1 全景大图', '#2 挖洞眼神特写'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_9_16_mobile4',
      name: '手机锁屏四格漫画分镜',
      category: 'anime',
      ratioLabel: '9:16',
      canvasW: 1080,
      canvasH: 1920,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 90, gutter: 14, margin: 20, cellBorder: 4, cellBorderColor: '#111827', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0, y: 0.28 }, { x: 1, y: 0.21 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0, y: 0.62 }, { x: 1, y: 0.70 }], closed: false, autoExtend: true },
        { id: 'c3', mode: 'line', points: [{ x: 0.52, y: 0.24 }, { x: 0.45, y: 0.66 }], closed: false, autoExtend: false }
      ],
      slotLabels: ['#1 顶部远景', '#2 左中特写', '#3 右中特写', '#4 底部主图'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_9_16_y3',
      name: '手机壁纸 Y 型三分镜',
      category: 'anime',
      ratioLabel: '9:16',
      canvasW: 1080,
      canvasH: 1920,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#0f172a', bgColor2: '#0f172a', gradAngle: 90, gutter: 14, margin: 18, cellBorder: 3, cellBorderColor: '#f8fafc', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0, y: 0.30 }, { x: 0.5, y: 0.50 }, { x: 1, y: 0.30 }], closed: false, autoExtend: false },
        { id: 'c2', mode: 'line', points: [{ x: 0.5, y: 0.50 }, { x: 0.5, y: 1.0 }], closed: false, autoExtend: false }
      ],
      slotLabels: ['#1 上方主视觉', '#2 左下分镜', '#3 右下分镜'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_badge_circle2',
      name: '圆形吧唧徽章·弧线双拼',
      category: 'anime',
      ratioLabel: '1:1 异形',
      canvasW: 1200,
      canvasH: 1200,
      contour: { type: 'circle', keepAspect: true },
      style: { bgMode: 'transparent', bgColor1: '#ffffff', bgColor2: '#dbeafe', gradAngle: 135, gutter: 14, margin: 14, cellBorder: 4, cellBorderColor: '#ffffff', outerStroke: 6, outerStrokeColor: '#ffffff' },
      cuts: [
        {
          id: 'c1',
          mode: 'curve',
          points: [{ x: 0.55, y: 0 }, { x: 0.45, y: 1 }],
          cp1: { x: 0.25, y: 0.32 },
          cp2: { x: 0.75, y: 0.68 },
          closed: false,
          autoExtend: true
        }
      ],
      slotLabels: ['#1 吧唧左半', '#2 吧唧右半'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_badge_circle3',
      name: '圆形吧唧·Y型三分镜',
      category: 'anime',
      ratioLabel: '1:1 异形',
      canvasW: 1200,
      canvasH: 1200,
      contour: { type: 'circle', keepAspect: true },
      style: { bgMode: 'transparent', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 135, gutter: 12, margin: 12, cellBorder: 4, cellBorderColor: '#1e293b', outerStroke: 8, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.05, y: 0.28 }, { x: 0.5, y: 0.52 }, { x: 0.95, y: 0.28 }], closed: false, autoExtend: false },
        { id: 'c2', mode: 'line', points: [{ x: 0.5, y: 0.52 }, { x: 0.5, y: 0.99 }], closed: false, autoExtend: false }
      ],
      slotLabels: ['#1 上弧格', '#2 左下扇格', '#3 右下扇格'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'anime_heart_duo',
      name: '爱心谷子·异形双拼',
      category: 'anime',
      ratioLabel: '1:1 异形',
      canvasW: 1200,
      canvasH: 1200,
      contour: { type: 'heart', keepAspect: true },
      style: { bgMode: 'transparent', bgColor1: '#ffffff', bgColor2: '#ffe4e6', gradAngle: 135, gutter: 12, margin: 10, cellBorder: 4, cellBorderColor: '#ffffff', outerStroke: 6, outerStrokeColor: '#fda4af' },
      cuts: [
        {
          id: 'c1',
          mode: 'curve',
          points: [{ x: 0.5, y: 0.05 }, { x: 0.5, y: 0.98 }],
          cp1: { x: 0.36, y: 0.40 },
          cp2: { x: 0.64, y: 0.68 },
          closed: false,
          autoExtend: true
        }
      ],
      slotLabels: ['#1 左半心', '#2 右半心'],
      freeFrames: [],
      texts: []
    },

    // ==================== 2. 经典网格与长图 ====================
    {
      id: 'grid_4_square',
      name: '经典对称四宫格',
      category: 'grid',
      ratioLabel: '1:1',
      canvasW: 1600,
      canvasH: 1600,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 135, gutter: 16, margin: 20, cellBorder: 0, cellBorderColor: '#000000', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }], closed: false, autoExtend: true }
      ],
      slotLabels: [],
      freeFrames: [],
      texts: []
    },
    {
      id: 'grid_6_classic',
      name: '经典六宫格排版',
      category: 'grid',
      ratioLabel: '4:3',
      canvasW: 1800,
      canvasH: 1350,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 135, gutter: 14, margin: 18, cellBorder: 0, cellBorderColor: '#000000', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.3333, y: 0 }, { x: 0.3333, y: 1 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0.6667, y: 0 }, { x: 0.6667, y: 1 }], closed: false, autoExtend: true },
        { id: 'c3', mode: 'line', points: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }], closed: false, autoExtend: true }
      ],
      slotLabels: [],
      freeFrames: [],
      texts: []
    },
    {
      id: 'grid_9_square',
      name: '九宫格全展示',
      category: 'grid',
      ratioLabel: '1:1',
      canvasW: 1800,
      canvasH: 1800,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 135, gutter: 12, margin: 16, cellBorder: 0, cellBorderColor: '#000000', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.3333, y: 0 }, { x: 0.3333, y: 1 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0.6667, y: 0 }, { x: 0.6667, y: 1 }], closed: false, autoExtend: true },
        { id: 'c3', mode: 'line', points: [{ x: 0, y: 0.3333 }, { x: 1, y: 0.3333 }], closed: false, autoExtend: true },
        { id: 'c4', mode: 'line', points: [{ x: 0, y: 0.6667 }, { x: 1, y: 0.6667 }], closed: false, autoExtend: true }
      ],
      slotLabels: [],
      freeFrames: [],
      texts: []
    },
    {
      id: 'grid_t_hero3',
      name: '主次 T 型三格海报',
      category: 'grid',
      ratioLabel: '3:4',
      canvasW: 1350,
      canvasH: 1800,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#f8fafc', bgColor2: '#f8fafc', gradAngle: 135, gutter: 16, margin: 24, cellBorder: 2, cellBorderColor: '#1e293b', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0, y: 0.58 }, { x: 1, y: 0.58 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0.5, y: 0.58 }, { x: 0.5, y: 1 }], closed: false, autoExtend: false }
      ],
      slotLabels: ['#1 主图', '#2 副图A', '#3 副图B'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'grid_v_long_strip',
      name: '纵向无缝拼接长图 (自适应)',
      category: 'grid',
      ratioLabel: '长图',
      specialMode: 'v-long',
      canvasW: 1200,
      canvasH: 2700,
      contour: { type: 'rect', keepAspect: false },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 90, gutter: 0, margin: 0, cellBorder: 0, cellBorderColor: '#000000', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0, y: 0.3333 }, { x: 1, y: 0.3333 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0, y: 0.6667 }, { x: 1, y: 0.6667 }], closed: false, autoExtend: true }
      ],
      slotLabels: ['#1 第一帧', '#2 第二帧', '#3 第三帧'],
      freeFrames: [],
      texts: []
    },
    {
      id: 'grid_h_long_strip',
      name: '横向无缝画卷长图 (自适应)',
      category: 'grid',
      ratioLabel: '横卷',
      specialMode: 'h-long',
      canvasW: 2700,
      canvasH: 1080,
      contour: { type: 'rect', keepAspect: false },
      style: { bgMode: 'solid', bgColor1: '#ffffff', bgColor2: '#ffffff', gradAngle: 0, gutter: 0, margin: 0, cellBorder: 0, cellBorderColor: '#000000', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.3333, y: 0 }, { x: 0.3333, y: 1 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0.6667, y: 0 }, { x: 0.6667, y: 1 }], closed: false, autoExtend: true }
      ],
      slotLabels: ['#1 左卷', '#2 中卷', '#3 右卷'],
      freeFrames: [],
      texts: []
    },

    // ==================== 3. 海报 / 拍立得叠放 ====================
    {
      id: 'poster_polaroid3',
      name: '拍立得三连错落手账',
      category: 'poster',
      ratioLabel: '4:3',
      canvasW: 1600,
      canvasH: 1200,
      hideBaseCells: true,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'gradient', bgColor1: '#fdfbfb', bgColor2: '#ebedee', gradAngle: 135, gutter: 0, margin: 0, cellBorder: 0, cellBorderColor: '#000000', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [],
      slotLabels: [],
      freeFrames: [
        {
          id: 'ff_p1', shape: 'polaroid', x: 0.26, y: 0.50, w: 0.32, h: 0.56, rotation: -8,
          borderWidth: 0, borderColor: '#ffffff', cornerRadius: 6, shadow: true, shadowBlur: 28, shadowColor: 'rgba(15,23,42,0.28)',
          caption: 'Memory #01', assetId: null, transform: null
        },
        {
          id: 'ff_p2', shape: 'polaroid', x: 0.73, y: 0.48, w: 0.32, h: 0.56, rotation: 7,
          borderWidth: 0, borderColor: '#ffffff', cornerRadius: 6, shadow: true, shadowBlur: 28, shadowColor: 'rgba(15,23,42,0.28)',
          caption: 'Memory #02', assetId: null, transform: null
        },
        {
          id: 'ff_p3', shape: 'polaroid', x: 0.50, y: 0.52, w: 0.35, h: 0.62, rotation: -1.5,
          borderWidth: 0, borderColor: '#ffffff', cornerRadius: 6, shadow: true, shadowBlur: 36, shadowColor: 'rgba(15,23,42,0.34)',
          caption: 'Best Moment', assetId: null, transform: null
        }
      ],
      texts: [
        {
          id: 'txt_p1', text: 'COLLECTION DIARY', x: 0.50, y: 0.10, fontSize: 38,
          fontFamily: 'Georgia', bold: true, italic: false, color: '#1e293b',
          strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, bubbleType: 'plain',
          bubbleFill: '#ffffff', bubbleStroke: '#1e293b', tailAngle: 120
        }
      ]
    },
    {
      id: 'poster_hero_slant',
      name: '全屏主图 + 双斜切特写卡',
      category: 'poster',
      ratioLabel: '16:9',
      canvasW: 1920,
      canvasH: 1080,
      contour: { type: 'rect', keepAspect: true },
      style: { bgMode: 'solid', bgColor1: '#0f172a', bgColor2: '#1e293b', gradAngle: 135, gutter: 0, margin: 0, cellBorder: 0, cellBorderColor: '#ffffff', outerStroke: 0, outerStrokeColor: '#ffffff' },
      cuts: [],
      slotLabels: ['#1 全屏背景主立绘'],
      freeFrames: [
        {
          id: 'ff_s1', shape: 'slant-left', x: 0.77, y: 0.30, w: 0.34, h: 0.34, rotation: 0,
          borderWidth: 5, borderColor: '#ffffff', cornerRadius: 0, shadow: true, shadowBlur: 26, shadowColor: 'rgba(0,0,0,0.5)',
          caption: '', assetId: null, transform: null
        },
        {
          id: 'ff_s2', shape: 'slant-left', x: 0.72, y: 0.70, w: 0.34, h: 0.34, rotation: 0,
          borderWidth: 5, borderColor: '#ffffff', cornerRadius: 0, shadow: true, shadowBlur: 26, shadowColor: 'rgba(0,0,0,0.5)',
          caption: '', assetId: null, transform: null
        }
      ],
      texts: [
        {
          id: 'txt_s1', text: 'CHARACTER ARCHIVE', x: 0.22, y: 0.88, fontSize: 36,
          fontFamily: 'Impact', bold: true, italic: true, color: '#ffffff',
          strokeColor: '#0f172a', strokeWidth: 6, rotation: 0, bubbleType: 'tag',
          bubbleFill: '#2563eb', bubbleStroke: '#ffffff', tailAngle: 120
        }
      ]
    },
    {
      id: 'poster_stamp_collage',
      name: '复古邮票异形纪念卡',
      category: 'poster',
      ratioLabel: '4:3 邮票',
      canvasW: 1600,
      canvasH: 1200,
      contour: { type: 'stamp', keepAspect: false },
      style: { bgMode: 'transparent', bgColor1: '#fffbeb', bgColor2: '#fef3c7', gradAngle: 135, gutter: 14, margin: 42, cellBorder: 3, cellBorderColor: '#ffffff', outerStroke: 4, outerStrokeColor: '#f8fafc' },
      cuts: [
        { id: 'c1', mode: 'line', points: [{ x: 0.60, y: 0 }, { x: 0.52, y: 1 }], closed: false, autoExtend: true },
        { id: 'c2', mode: 'line', points: [{ x: 0.55, y: 0.5 }, { x: 1, y: 0.5 }], closed: false, autoExtend: false }
      ],
      slotLabels: ['#1 邮票主景', '#2 右上副图', '#3 右下副图'],
      freeFrames: [],
      texts: []
    }
  ];

  // 生成模板卡片的微型矢量 SVG 缩略图
  function generateTemplateThumbSVG(tpl) {
    const w = 120;
    const h = Math.round(120 * Math.min(1.2, Math.max(0.62, tpl.canvasH / tpl.canvasW)));
    const outer = global.SilhouetteEngine.buildOuterContourPolygon(tpl.contour || { type: 'rect' }, w, h);
    const outerPtsStr = outer.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    let innerSvg = '';
    if (!tpl.hideBaseCells) {
      for (const cut of (tpl.cuts || [])) {
        const sampled = global.PlanarSlicer.sampleCutPointsPx(cut, w, h);
        if (sampled.length >= 2) {
          const d = sampled.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + (cut.closed ? ' Z' : '');
          innerSvg += `<path d="${d}" fill="none" stroke="var(--bg-input)" stroke-width="3.2" stroke-linecap="round"/>`;
        }
      }
    }

    for (const ff of (tpl.freeFrames || [])) {
      const fx = ff.x * w;
      const fy = ff.y * h;
      const fw = ff.w * w;
      const fh = ff.h * h;
      const rot = ff.rotation || 0;
      innerSvg += `<rect x="${(fx - fw / 2).toFixed(1)}" y="${(fy - fh / 2).toFixed(1)}" width="${fw.toFixed(1)}" height="${fh.toFixed(1)}" rx="2" transform="rotate(${rot} ${fx.toFixed(1)} ${fy.toFixed(1)})" fill="var(--accent)" fill-opacity="0.32" stroke="var(--accent)" stroke-width="1.5"/>`;
    }

    const clipId = `clip_${tpl.id}_${Math.random().toString(36).slice(2, 6)}`;
    return `
      <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <clipPath id="${clipId}">
            <polygon points="${outerPtsStr}" />
          </clipPath>
        </defs>
        <g clip-path="url(#${clipId})">
          <polygon points="${outerPtsStr}" fill="${tpl.hideBaseCells ? 'rgba(148,163,184,0.14)' : 'rgba(76,139,245,0.22)'}" />
          ${innerSvg}
        </g>
        <polygon points="${outerPtsStr}" fill="none" stroke="var(--accent)" stroke-width="1.6" />
      </svg>
    `;
  }

  global.TemplateLibrary = {
    BUILTIN_TEMPLATES,
    generateTemplateThumbSVG
  };
})(window);
