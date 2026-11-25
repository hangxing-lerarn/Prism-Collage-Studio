(function (global) {
  // =========================================================================
  // StickerEngine: 角色贴脸装饰特效库 (猫耳/猫须/腮红/眼镜/漫符 + 自定义装饰去底 + 贴脸跟随绑定)
  // =========================================================================

  const BUILTIN_STICKERS = [
    // -------- 1. 兽耳与猫脸套装 (ears_face) --------
    {
      id: 'cat_ears_pair',
      name: '萌猫立耳(成对)',
      category: 'ears_face',
      defaultW: 0.22,
      defaultH: 0.11,
      color1: '#27272a',
      color2: '#fda4af',
      stroke: '#18181b'
    },
    {
      id: 'cat_ear_left',
      name: '单只左猫耳',
      category: 'ears_face',
      defaultW: 0.09,
      defaultH: 0.10,
      color1: '#27272a',
      color2: '#fda4af',
      stroke: '#18181b'
    },
    {
      id: 'cat_ear_right',
      name: '单只右猫耳',
      category: 'ears_face',
      defaultW: 0.09,
      defaultH: 0.10,
      color1: '#27272a',
      color2: '#fda4af',
      stroke: '#18181b'
    },
    {
      id: 'cat_face_full',
      name: '猫鼻+猫嘴+胡须',
      category: 'ears_face',
      defaultW: 0.18,
      defaultH: 0.08,
      color1: '#1f2937',
      color2: '#fb7185',
      stroke: '#ffffff'
    },
    {
      id: 'cat_whiskers',
      name: '俏皮六根猫须',
      category: 'ears_face',
      defaultW: 0.20,
      defaultH: 0.065,
      color1: '#1f2937',
      color2: '#fda4af',
      stroke: '#ffffff'
    },
    {
      id: 'cat_mouth_omega',
      name: 'ω 猫嘴与粉鼻',
      category: 'ears_face',
      defaultW: 0.075,
      defaultH: 0.05,
      color1: '#1f2937',
      color2: '#fb7185',
      stroke: '#ffffff'
    },
    {
      id: 'bunny_ears',
      name: '软萌折耳兔耳',
      category: 'ears_face',
      defaultW: 0.22,
      defaultH: 0.17,
      color1: '#f8fafc',
      color2: '#fbcfe8',
      stroke: '#334155'
    },
    {
      id: 'fox_ears',
      name: '蓬松狐狸大耳',
      category: 'ears_face',
      defaultW: 0.25,
      defaultH: 0.13,
      color1: '#f97316',
      color2: '#fef3c7',
      stroke: '#431407'
    },
    {
      id: 'dog_ears',
      name: '小狗垂耳(成对)',
      category: 'ears_face',
      defaultW: 0.24,
      defaultH: 0.12,
      color1: '#b45309',
      color2: '#fde68a',
      stroke: '#451a03'
    },
    {
      id: 'devil_horns',
      name: '小恶魔弯角',
      category: 'ears_face',
      defaultW: 0.19,
      defaultH: 0.10,
      color1: '#dc2626',
      color2: '#7f1d1d',
      stroke: '#111827'
    },
    {
      id: 'angel_halo',
      name: '悬浮天使光环',
      category: 'ears_face',
      defaultW: 0.18,
      defaultH: 0.055,
      color1: '#fde047',
      color2: '#fef9c3',
      stroke: '#ca8a04'
    },

    // -------- 2. 面部配饰与漫符 (face_fx) --------
    {
      id: 'blush_slash',
      name: '漫画斜线腮红',
      category: 'face_fx',
      defaultW: 0.18,
      defaultH: 0.045,
      color1: '#fb7185',
      color2: '#fda4af',
      stroke: '#e11d48'
    },
    {
      id: 'blush_soft',
      name: '柔光粉嫩红晕',
      category: 'face_fx',
      defaultW: 0.20,
      defaultH: 0.055,
      color1: '#fb7185',
      color2: '#fda4af',
      stroke: '#fb7185'
    },
    {
      id: 'glasses_round',
      name: '文艺金丝圆镜',
      category: 'face_fx',
      defaultW: 0.17,
      defaultH: 0.062,
      color1: '#fbbf24',
      color2: '#bae6fd',
      stroke: '#78350f'
    },
    {
      id: 'sunglasses_cool',
      name: '装酷黑超墨镜',
      category: 'face_fx',
      defaultW: 0.18,
      defaultH: 0.058,
      color1: '#111827',
      color2: '#38bdf8',
      stroke: '#f8fafc'
    },
    {
      id: 'bandaid',
      name: '鼻梁/脸颊创可贴',
      category: 'face_fx',
      defaultW: 0.075,
      defaultH: 0.032,
      color1: '#fed7aa',
      color2: '#fdba74',
      stroke: '#9a3412'
    },
    {
      id: 'bow_ribbon',
      name: '甜美蝴蝶结发饰',
      category: 'face_fx',
      defaultW: 0.11,
      defaultH: 0.075,
      color1: '#f43f5e',
      color2: '#fda4af',
      stroke: '#881337'
    },
    {
      id: 'crown_mini',
      name: '迷你黄金皇冠',
      category: 'face_fx',
      defaultW: 0.10,
      defaultH: 0.08,
      color1: '#facc15',
      color2: '#ef4444',
      stroke: '#854d0e'
    },
    {
      id: 'manga_sweat',
      name: '二次元流汗水滴',
      category: 'face_fx',
      defaultW: 0.045,
      defaultH: 0.07,
      color1: '#38bdf8',
      color2: '#e0f2fe',
      stroke: '#0369a1'
    },
    {
      id: 'manga_anger',
      name: '暴怒十字青筋💢',
      category: 'face_fx',
      defaultW: 0.065,
      defaultH: 0.065,
      color1: '#ef4444',
      color2: '#fee2e2',
      stroke: '#7f1d1d'
    },
    {
      id: 'manga_hearts',
      name: '心动双爱心特效',
      category: 'face_fx',
      defaultW: 0.09,
      defaultH: 0.08,
      color1: '#fb7185',
      color2: '#f43f5e',
      stroke: '#ffffff'
    },
    {
      id: 'manga_sparkle',
      name: '闪耀高光星芒✨',
      category: 'face_fx',
      defaultW: 0.085,
      defaultH: 0.085,
      color1: '#fde047',
      color2: '#ffffff',
      stroke: '#f59e0b'
    },

    // -------- 3. 灵魂漫画拟声词特效章 (manga_sfx) --------
    {
      id: 'sfx_gogogo',
      name: 'ゴゴゴ 威压章',
      category: 'manga_sfx',
      defaultW: 0.19,
      defaultH: 0.11,
      color1: '#7e22ce',
      color2: '#f0abfc',
      stroke: '#09090b'
    },
    {
      id: 'sfx_dododo',
      name: 'ドドド 轰鸣章',
      category: 'manga_sfx',
      defaultW: 0.19,
      defaultH: 0.10,
      color1: '#dc2626',
      color2: '#fde047',
      stroke: '#09090b'
    },
    {
      id: 'sfx_stare',
      name: '盯—— 凝视章',
      category: 'manga_sfx',
      defaultW: 0.16,
      defaultH: 0.075,
      color1: '#111827',
      color2: '#38bdf8',
      stroke: '#ffffff'
    },
    {
      id: 'sfx_tietie',
      name: '贴贴♥ 甜度章',
      category: 'manga_sfx',
      defaultW: 0.16,
      defaultH: 0.085,
      color1: '#fb7185',
      color2: '#ffe4e6',
      stroke: '#ffffff'
    },
    {
      id: 'sfx_danger',
      name: '危！！ 警报章',
      category: 'manga_sfx',
      defaultW: 0.13,
      defaultH: 0.12,
      color1: '#dc2626',
      color2: '#fef08a',
      stroke: '#111827'
    },
    {
      id: 'sfx_shock',
      name: '？！ 震惊感叹章',
      category: 'manga_sfx',
      defaultW: 0.11,
      defaultH: 0.11,
      color1: '#facc15',
      color2: '#ef4444',
      stroke: '#09090b'
    }
  ];

  // 在局部中心 (0,0)、尺寸 (w, h) 内高清绘制任意内置矢量装饰贴纸
  function drawBuiltinVectorSticker(ctx, presetId, w, h, c1, c2, strokeCol) {
    const hw = w / 2;
    const hh = h / 2;
    const lw = Math.max(1.4, Math.min(w, h) * 0.045);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    function drawSingleCatEar(cx, cy, ew, eh, tiltRad) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tiltRad);
      // 外耳廓
      ctx.fillStyle = c1;
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(-ew * 0.48, eh * 0.46);
      ctx.quadraticCurveTo(-ew * 0.42, -eh * 0.25, 0, -eh * 0.5);
      ctx.quadraticCurveTo(ew * 0.42, -eh * 0.25, ew * 0.48, eh * 0.46);
      ctx.quadraticCurveTo(0, eh * 0.34, -ew * 0.48, eh * 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 内耳粉色绒毛
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(-ew * 0.28, eh * 0.36);
      ctx.quadraticCurveTo(-ew * 0.22, -eh * 0.12, 0, -eh * 0.31);
      ctx.quadraticCurveTo(ew * 0.22, -eh * 0.12, ew * 0.28, eh * 0.36);
      ctx.quadraticCurveTo(0, eh * 0.22, -ew * 0.28, eh * 0.36);
      ctx.closePath();
      ctx.fill();

      // 耳内白色绒毛小锯齿细节
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = lw * 0.7;
      ctx.beginPath();
      ctx.moveTo(-ew * 0.16, eh * 0.32);
      ctx.lineTo(-ew * 0.05, eh * 0.18);
      ctx.lineTo(0, eh * 0.30);
      ctx.lineTo(ew * 0.08, eh * 0.17);
      ctx.lineTo(ew * 0.17, eh * 0.32);
      ctx.stroke();
      ctx.restore();
    }

    switch (presetId) {
      case 'cat_ears_pair': {
        drawSingleCatEar(-w * 0.29, 0, w * 0.40, h * 0.94, -0.22);
        drawSingleCatEar(w * 0.29, 0, w * 0.40, h * 0.94, 0.22);
        break;
      }
      case 'cat_ear_left': {
        drawSingleCatEar(0, 0, w * 0.9, h * 0.92, -0.18);
        break;
      }
      case 'cat_ear_right': {
        drawSingleCatEar(0, 0, w * 0.9, h * 0.92, 0.18);
        break;
      }
      case 'cat_whiskers':
      case 'cat_face_full': {
        // 先画两侧三根胡须 (带外描边保证在深色或浅色头发/皮肤上都清晰可见！)
        const lines = [
          [-w * 0.18, -h * 0.12, -w * 0.48, -h * 0.30],
          [-w * 0.19, h * 0.05, -w * 0.49, h * 0.06],
          [-w * 0.17, h * 0.22, -w * 0.46, h * 0.38],
          [w * 0.18, -h * 0.12, w * 0.48, -h * 0.30],
          [w * 0.19, h * 0.05, w * 0.49, h * 0.06],
          [w * 0.17, h * 0.22, w * 0.46, h * 0.38]
        ];
        for (const [x1, y1, x2, y2] of lines) {
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = lw * 2.1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo((x1 + x2) * 0.5, y1 - h * 0.06, x2, y2);
          ctx.stroke();

          ctx.strokeStyle = c1;
          ctx.lineWidth = lw * 1.15;
          ctx.stroke();
        }
        if (presetId === 'cat_face_full') {
          drawNoseAndOmegaMouth(ctx, w * 0.32, h * 0.68, c1, c2, strokeCol, lw);
        }
        break;
      }
      case 'cat_mouth_omega': {
        drawNoseAndOmegaMouth(ctx, w * 0.88, h * 0.88, c1, c2, strokeCol, lw);
        break;
      }
      case 'bunny_ears': {
        ctx.fillStyle = c1;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw;
        // 左直立兔耳
        ctx.save();
        ctx.translate(-w * 0.22, 0);
        ctx.rotate(-0.12);
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.12, h * 0.46, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(0, h * 0.04, w * 0.065, h * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 右微折兔耳
        ctx.save();
        ctx.translate(w * 0.20, h * 0.04);
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(-w * 0.09, h * 0.42);
        ctx.quadraticCurveTo(-w * 0.11, -h * 0.35, w * 0.08, -h * 0.38);
        ctx.quadraticCurveTo(w * 0.28, -h * 0.35, w * 0.26, -h * 0.02);
        ctx.quadraticCurveTo(w * 0.14, -h * 0.16, w * 0.06, h * 0.42);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'fox_ears': {
        drawSingleCatEar(-w * 0.31, h * 0.03, w * 0.42, h * 0.96, -0.34);
        drawSingleCatEar(w * 0.31, h * 0.03, w * 0.42, h * 0.96, 0.34);
        break;
      }
      case 'dog_ears': {
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.translate(dir * w * 0.31, -h * 0.05);
          ctx.rotate(dir * 0.35);
          ctx.fillStyle = c1;
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.1, w * 0.15, h * 0.38, 0, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'devil_horns': {
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.scale(dir, 1);
          ctx.fillStyle = c1;
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(w * 0.16, h * 0.42);
          ctx.quadraticCurveTo(w * 0.46, h * 0.15, w * 0.36, -h * 0.45);
          ctx.quadraticCurveTo(w * 0.22, -h * 0.05, w * 0.06, h * 0.26);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'angel_halo': {
        ctx.save();
        ctx.shadowColor = c1;
        ctx.shadowBlur = Math.max(6, h * 0.4);
        ctx.strokeStyle = c1;
        ctx.lineWidth = Math.max(3, h * 0.26);
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.45, h * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = c2;
        ctx.lineWidth = Math.max(1.2, h * 0.1);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'blush_slash': {
        for (const side of [-1, 1]) {
          const bx = side * w * 0.32;
          ctx.fillStyle = c2;
          ctx.globalAlpha = 0.42;
          ctx.beginPath();
          ctx.ellipse(bx, 0, w * 0.16, h * 0.44, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.92;
          ctx.strokeStyle = c1;
          ctx.lineWidth = Math.max(1.6, h * 0.09);
          for (let k = -1.5; k <= 1.5; k += 1) {
            ctx.beginPath();
            ctx.moveTo(bx + k * w * 0.045 + w * 0.02, -h * 0.26);
            ctx.lineTo(bx + k * w * 0.045 - w * 0.02, h * 0.26);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'blush_soft': {
        for (const side of [-1, 1]) {
          const bx = side * w * 0.32;
          const r = Math.max(8, w * 0.17);
          const grad = ctx.createRadialGradient(bx, 0, 0, bx, 0, r);
          grad.addColorStop(0, hexWithAlpha(c1, 0.72));
          grad.addColorStop(0.6, hexWithAlpha(c2, 0.35));
          grad.addColorStop(1, hexWithAlpha(c2, 0));
          ctx.save();
          ctx.scale(1, (h * 0.95) / (r * 2));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(bx, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'glasses_round': {
        const r = Math.min(w * 0.19, h * 0.44);
        const lx = -w * 0.25, rx = w * 0.25;
        ctx.fillStyle = hexWithAlpha(c2, 0.28);
        ctx.strokeStyle = c1;
        ctx.lineWidth = Math.max(2, h * 0.08);
        for (const gx of [lx, rx]) {
          ctx.beginPath();
          ctx.arc(gx, 0, r, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          // 镜片反光斜白条
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = Math.max(1.5, r * 0.16);
          ctx.beginPath();
          ctx.moveTo(gx - r * 0.45, -r * 0.35);
          ctx.lineTo(gx - r * 0.05, r * 0.35);
          ctx.stroke();
          ctx.restore();
        }
        // 鼻托桥架
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.25 - r, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        break;
      }
      case 'sunglasses_cool': {
        ctx.fillStyle = c1;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw;
        // 左镜片 + 右镜片 + 横梁
        ctx.beginPath();
        ctx.roundRect(-w * 0.47, -h * 0.38, w * 0.41, h * 0.76, h * 0.16);
        ctx.roundRect(w * 0.06, -h * 0.38, w * 0.41, h * 0.76, h * 0.16);
        ctx.fill(); ctx.stroke();
        ctx.lineWidth = Math.max(2.5, h * 0.12);
        ctx.strokeStyle = c1;
        ctx.beginPath();
        ctx.moveTo(-w * 0.49, -h * 0.22);
        ctx.lineTo(w * 0.49, -h * 0.22);
        ctx.stroke();
        // 高光斜纹
        ctx.strokeStyle = c2;
        ctx.lineWidth = Math.max(2, h * 0.1);
        for (const ox of [-w * 0.32, w * 0.21]) {
          ctx.beginPath();
          ctx.moveTo(ox, -h * 0.22);
          ctx.lineTo(ox + w * 0.09, h * 0.22);
          ctx.stroke();
        }
        break;
      }
      case 'bandaid': {
        ctx.fillStyle = c1;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.roundRect(-hw * 0.94, -hh * 0.86, w * 0.94, h * 0.86, Math.min(hw, hh) * 0.7);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.roundRect(-w * 0.16, -hh * 0.76, w * 0.32, h * 0.76, 3);
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'bow_ribbon': {
        ctx.fillStyle = c1;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw;
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(dir * w * 0.48, -h * 0.56, dir * w * 0.52, h * 0.52, 0, h * 0.06);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, h) * 0.18, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'crown_mini': {
        ctx.fillStyle = c1;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(-w * 0.40, h * 0.42);
        ctx.lineTo(-w * 0.46, -h * 0.25);
        ctx.lineTo(-w * 0.18, h * 0.08);
        ctx.lineTo(0, -h * 0.44);
        ctx.lineTo(w * 0.18, h * 0.08);
        ctx.lineTo(w * 0.46, -h * 0.25);
        ctx.lineTo(w * 0.40, h * 0.42);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = c2;
        for (const [jx, jy] of [[-w * 0.46, -h * 0.28], [0, -h * 0.46], [w * 0.46, -h * 0.28]]) {
          ctx.beginPath();
          ctx.arc(jx, jy, Math.min(w, h) * 0.08, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
        break;
      }
      case 'manga_sweat': {
        ctx.fillStyle = c1;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(0, -hh * 0.9);
        ctx.bezierCurveTo(hw * 0.9, hh * 0.05, hw * 0.85, hh * 0.9, 0, hh * 0.9);
        ctx.bezierCurveTo(-hw * 0.85, hh * 0.9, -hw * 0.9, hh * 0.05, 0, -hh * 0.9);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(-hw * 0.22, hh * 0.22, hw * 0.16, hh * 0.28, -0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'manga_anger': {
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw * 2.2;
        const rIn = Math.min(w, h) * 0.12;
        const rOut = Math.min(w, h) * 0.44;
        function strokeAngerTicks() {
          for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(rIn, rOut);
            ctx.quadraticCurveTo(rIn, rIn, rOut, rIn);
            ctx.stroke();
            ctx.restore();
          }
        }
        strokeAngerTicks();
        ctx.strokeStyle = c1;
        ctx.lineWidth = lw * 1.3;
        strokeAngerTicks();
        break;
      }
      case 'manga_hearts': {
        drawSmallHeart(ctx, -w * 0.18, h * 0.08, w * 0.52, -0.22, c1, strokeCol, lw);
        drawSmallHeart(ctx, w * 0.24, -h * 0.18, w * 0.36, 0.25, c2, strokeCol, lw);
        break;
      }
      case 'sfx_gogogo': {
        drawMangaSfxGlyphs(ctx, ['ゴ', 'ゴ', 'ゴ', 'ゴ'], w, h, c1, c2, strokeCol, -0.18, true);
        break;
      }
      case 'sfx_dododo': {
        drawMangaSfxGlyphs(ctx, ['ド', 'ド', 'ド'], w, h, c1, c2, strokeCol, -0.14, true);
        break;
      }
      case 'sfx_stare': {
        drawMangaSfxTextBanner(ctx, '盯———', w, h, c1, c2, strokeCol, -0.05);
        break;
      }
      case 'sfx_tietie': {
        drawMangaSfxTextBanner(ctx, '贴贴 ♥', w, h, c1, c2, strokeCol, -0.08);
        break;
      }
      case 'sfx_danger': {
        drawMangaSfxTextBanner(ctx, '危！！', w, h, c1, c2, strokeCol, -0.12);
        break;
      }
      case 'sfx_shock': {
        drawMangaSfxTextBanner(ctx, '？！', w, h, c1, c2, strokeCol, 0.10);
        break;
      }
      case 'manga_sparkle':
      default: {
        ctx.fillStyle = c1;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw * 0.8;
        drawFourStar(ctx, -w * 0.12, h * 0.08, w * 0.68, h * 0.68);
        ctx.fillStyle = c2;
        drawFourStar(ctx, w * 0.26, -h * 0.24, w * 0.34, h * 0.34);
        break;
      }
    }
    ctx.restore();
  }

  function drawNoseAndOmegaMouth(ctx, mw, mh, c1, c2, strokeCol, lw) {
    // 小倒三角粉鼻
    ctx.fillStyle = c2;
    ctx.strokeStyle = c1;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(-mw * 0.15, -mh * 0.28);
    ctx.lineTo(mw * 0.15, -mh * 0.28);
    ctx.lineTo(0, -mh * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ω 猫猫嘴双弧线
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lw * 1.9;
    function traceOmega() {
      ctx.beginPath();
      ctx.moveTo(-mw * 0.44, mh * 0.08);
      ctx.quadraticCurveTo(-mw * 0.22, mh * 0.44, 0, mh * 0.06);
      ctx.quadraticCurveTo(mw * 0.22, mh * 0.44, mw * 0.44, mh * 0.08);
      ctx.stroke();
    }
    traceOmega();
    ctx.strokeStyle = c1;
    ctx.lineWidth = lw * 1.1;
    traceOmega();
  }

  function drawSmallHeart(ctx, x, y, size, rot, fillCol, strokeCol, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = fillCol;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lw;
    ctx.beginPath();
    const s = size * 0.5;
    ctx.moveTo(0, s * 0.7);
    ctx.bezierCurveTo(-s, s * 0.1, -s, -s * 0.7, 0, -s * 0.25);
    ctx.bezierCurveTo(s, -s * 0.7, s, s * 0.1, 0, s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawFourStar(ctx, x, y, sw, sh) {
    const rx = sw * 0.5, ry = sh * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.quadraticCurveTo(x, y, x + rx, y);
    ctx.quadraticCurveTo(x, y, x, y + ry);
    ctx.quadraticCurveTo(x, y, x - rx, y);
    ctx.quadraticCurveTo(x, y, x, y - ry);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawMangaSfxGlyphs(ctx, chars, w, h, c1, c2, strokeCol, slantRad, stagger) {
    const n = chars.length;
    const baseSize = Math.min(h * 0.76, (w / n) * 1.25);
    ctx.save();
    ctx.font = `900 italic ${Math.max(10, Math.round(baseSize))}px "Microsoft YaHei UI", "SimHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < n; i++) {
      const gx = -w * 0.36 + (i / Math.max(1, n - 1)) * (w * 0.72);
      const gy = stagger ? ((i % 2 === 0 ? -1 : 1) * h * 0.12 - (i * h * 0.04)) : 0;
      const sc = 0.85 + (i / n) * 0.28;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(slantRad);
      ctx.scale(sc, sc);

      // 漫画立体厚黑投影底层
      ctx.fillStyle = strokeCol;
      ctx.fillText(chars[i], baseSize * 0.09, baseSize * 0.09);

      ctx.strokeStyle = c2;
      ctx.lineWidth = Math.max(2.5, baseSize * 0.16);
      ctx.strokeText(chars[i], 0, 0);

      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = Math.max(1.5, baseSize * 0.08);
      ctx.strokeText(chars[i], 0, 0);

      ctx.fillStyle = c1;
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMangaSfxTextBanner(ctx, text, w, h, c1, c2, strokeCol, rotRad) {
    const fSize = Math.min(h * 0.74, (w / Math.max(2, text.length * 0.75)));
    ctx.save();
    ctx.rotate(rotRad);
    ctx.font = `900 ${Math.max(11, Math.round(fSize))}px "Microsoft YaHei UI", "Impact", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = Math.max(3.5, fSize * 0.24);
    ctx.strokeText(text, 0, 0);

    ctx.strokeStyle = c2;
    ctx.lineWidth = Math.max(2, fSize * 0.12);
    ctx.strokeText(text, 0, 0);

    ctx.fillStyle = c1;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function hexWithAlpha(hex, alpha) {
    const clean = String(hex || '#fb7185').replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(251,113,133,${alpha})`;
  }

  // 生成内置装饰卡片的缩略图 DataURL
  const thumbCache = new Map();
  function getBuiltinStickerThumbDataUrl(item) {
    if (thumbCache.has(item.id)) return thumbCache.get(item.id);
    const cvs = document.createElement('canvas');
    cvs.width = 96;
    cvs.height = 68;
    const c = cvs.getContext('2d');
    c.translate(48, 34);
    const ratio = item.defaultW / item.defaultH;
    let dw = 76, dh = 76 / ratio;
    if (dh > 52) { dh = 52; dw = dh * ratio; }
    drawBuiltinVectorSticker(c, item.id, dw, dh, item.color1, item.color2, item.stroke);
    const url = cvs.toDataURL('image/png');
    thumbCache.set(item.id, url);
    return url;
  }

  // =========================================================================
  // 自定义装饰一键去白底 / 去黑底 / 自动采样四角去纯色背景算法 (带柔和抗锯齿羽化)
  // =========================================================================
  function removeSolidBackgroundFromImage(imgElement, mode = 'auto', tolerance = 38) {
    const w = imgElement.naturalWidth || imgElement.width;
    const h = imgElement.naturalHeight || imgElement.height;
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let keyR = 255, keyG = 255, keyB = 255;
    if (mode === 'black') {
      keyR = 0; keyG = 0; keyB = 0;
    } else if (mode === 'auto') {
      // 采样四角像素平均值自动识别背景底色
      const corners = [
        0,
        (w - 1) * 4,
        (h - 1) * w * 4,
        ((h - 1) * w + (w - 1)) * 4
      ];
      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (const idx of corners) {
        if (data[idx + 3] > 20) {
          sr += data[idx]; sg += data[idx + 1]; sb += data[idx + 2];
          cnt++;
        }
      }
      if (cnt > 0) {
        keyR = Math.round(sr / cnt);
        keyG = Math.round(sg / cnt);
        keyB = Math.round(sb / cnt);
      }
    } else if (mode.startsWith('#') && mode.length === 7) {
      keyR = parseInt(mode.slice(1, 3), 16);
      keyG = parseInt(mode.slice(3, 5), 16);
      keyB = parseInt(mode.slice(5, 7), 16);
    }

    const tol = Math.max(5, tolerance);
    const feather = Math.max(12, tol * 0.45);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const dr = data[i] - keyR;
      const dg = data[i + 1] - keyG;
      const db = data[i + 2] - keyB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= tol) {
        data[i + 3] = 0;
      } else if (dist < tol + feather) {
        const ramp = (dist - tol) / feather;
        data[i + 3] = Math.round(data[i + 3] * ramp);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    // 顺带自动紧缩裁去透明边缘，让小装饰包围盒精准贴合！
    const trimmed = global.CollageRenderer
      ? global.CollageRenderer.autoTrimTransparentCanvas(cvs, 2)
      : cvs;
    return trimmed.toDataURL('image/png');
  }

  // =========================================================================
  // 贴脸跟随绑定坐标换算 (Sticker <-> Cell/Frame Photo Anchor Sync)
  // =========================================================================
  function getAnchorPhotoDrawParams(sticker, state) {
    if (!sticker.anchorType || sticker.anchorType === 'none') return null;
    if (sticker.anchorType === 'cell') {
      const cell = state.topology.cells.find(c => c.id === sticker.anchorId);
      const asset = cell && cell.assetId ? state.assetMap.get(cell.assetId) : null;
      if (!cell || !asset) return null;
      const b = cell.bounds;
      const params = global.CollageRenderer.computeImageDrawParams(
        asset, cell.transform, b.minX, b.minY, Math.max(1, b.w), Math.max(1, b.h), 1
      );
      return params ? { params, targetCell: cell } : null;
    }
    if (sticker.anchorType === 'frame') {
      const ff = state.freeFrames.find(f => f.id === sticker.anchorId);
      const asset = ff && ff.assetId ? state.assetMap.get(ff.assetId) : null;
      if (!ff || !asset) return null;
      const fw = ff.w * state.canvasW, fh = ff.h * state.canvasH;
      let innerX = -fw / 2, innerY = -fh / 2, innerW = fw, innerH = fh;
      if (ff.shape === 'polaroid') {
        const pr = global.CollageRenderer.getPolaroidInnerRect(fw, fh);
        innerX = pr.innerX; innerY = pr.innerY; innerW = pr.innerW; innerH = pr.innerH;
      }
      const localParams = global.CollageRenderer.computeImageDrawParams(
        asset, ff.transform, innerX, innerY, innerW, innerH, 1
      );
      if (!localParams) return null;
      const fRot = ((ff.rotation || 0) * Math.PI) / 180;
      const fcx = ff.x * state.canvasW, fcy = ff.y * state.canvasH;
      const rotCx = fcx + localParams.centerX * Math.cos(fRot) - localParams.centerY * Math.sin(fRot);
      const rotCy = fcy + localParams.centerX * Math.sin(fRot) + localParams.centerY * Math.cos(fRot);
      return {
        params: {
          ...localParams,
          centerX: rotCx,
          centerY: rotCy,
          totalRad: localParams.totalRad + fRot
        },
        targetFrame: ff
      };
    }
    return null;
  }

  // 当装饰位置/尺寸/角度被用户手动修改后，反算并记录它相对于底层角色照片的局部锚点参数！
  function recordStickerAnchorFromCanvas(sticker, state) {
    const info = getAnchorPhotoDrawParams(sticker, state);
    if (!info) {
      sticker.anchorData = null;
      return;
    }
    const p = info.params;
    const sx = sticker.x * state.canvasW;
    const sy = sticker.y * state.canvasH;
    const sw = sticker.w * state.canvasW;
    const sh = sticker.h * state.canvasH;

    const dx = sx - p.centerX;
    const dy = sy - p.centerY;
    const unrotX = dx * Math.cos(-p.totalRad) - dy * Math.sin(-p.totalRad);
    const unrotY = dx * Math.sin(-p.totalRad) + dy * Math.cos(-p.totalRad);

    sticker.anchorData = {
      u: unrotX / Math.max(1, p.drawW),
      v: unrotY / Math.max(1, p.drawH),
      relW: sw / Math.max(1, p.drawW),
      relH: sh / Math.max(1, p.drawH),
      relRot: (sticker.rotation || 0) - (p.totalRad * 180) / Math.PI
    };
  }

  // 当底层角色照片缩放/平移/旋转时，自动实时同步已绑定贴脸装饰的画布坐标！
  function syncStickerCanvasFromAnchor(sticker, state) {
    if (!sticker.anchorType || sticker.anchorType === 'none' || !sticker.anchorData) return;
    const info = getAnchorPhotoDrawParams(sticker, state);
    if (!info) return;
    const p = info.params;
    const ad = sticker.anchorData;

    const lx = ad.u * p.drawW;
    const ly = ad.v * p.drawH;
    const sx = p.centerX + lx * Math.cos(p.totalRad) - ly * Math.sin(p.totalRad);
    const sy = p.centerY + lx * Math.sin(p.totalRad) + ly * Math.cos(p.totalRad);

    sticker.x = sx / Math.max(1, state.canvasW);
    sticker.y = sy / Math.max(1, state.canvasH);
    sticker.w = (ad.relW * p.drawW) / Math.max(1, state.canvasW);
    sticker.h = (ad.relH * p.drawH) / Math.max(1, state.canvasH);
    sticker.rotation = Math.round(((p.totalRad * 180) / Math.PI + ad.relRot) * 10) / 10;
  }

  global.StickerEngine = {
    BUILTIN_STICKERS,
    drawBuiltinVectorSticker,
    getBuiltinStickerThumbDataUrl,
    removeSolidBackgroundFromImage,
    getAnchorPhotoDrawParams,
    recordStickerAnchorFromCanvas,
    syncStickerCanvasFromAnchor
  };
})(window);
