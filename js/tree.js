// tree.js — Canvas 程序化树（原创美术：参数化分形树，不复制 Forest 任何资产）
// 同一种子永远长同一棵树（mulberry32 确定性伪随机），会话内种子固定。
// 生长进度 progress: 0→1 控制枝干展开层级与长度；死亡时叶色转褐 + 透明度衰减。

export const TREE_TYPES = [
  { id: 'oak',      name: '橡树',   hue: 110, leaf: '#4a9e57', trunk: '#6e4830', flower: null },
  { id: 'sakura',   name: '樱花',   hue: 340, leaf: '#f2a0bd', trunk: '#6b4a3e', flower: '#ffd3e0' },
  { id: 'pine',     name: '松树',   hue: 160, leaf: '#2e7d5b', trunk: '#5d4433', flower: null },
  { id: 'maple',    name: '枫树',   hue: 25,  leaf: '#d9772f', trunk: '#6a4230', flower: null },
  { id: 'wisteria', name: '紫藤',   hue: 275, leaf: '#a37fd6', trunk: '#5f4a3c', flower: '#cdb4f0' },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 分形最大深度（buildTree 与 drawTree 共用，必须模块级）
const MAX_DEPTH = 7;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 生成整棵树的静态结构（骨架+叶簇），绘制时按 progress 揭示
function buildTree(seed, type) {
  const rnd = mulberry32(hashStr(String(seed)));
  const branches = [];
  const leaves = [];

  function branch(x, y, angle, len, width, depth) {
    if (depth > MAX_DEPTH) return;
    const bx = x + Math.cos(angle) * len;
    const by = y + Math.sin(angle) * len;
    branches.push({ x1: x, y1: y, x2: bx, y2: by, w: width, depth });
    if (depth >= 3) {
      leaves.push({ x: bx, y: by, r: Math.max(2.5, 9 - depth) * (0.7 + rnd() * 0.6), depth });
      if (type.flower && rnd() < 0.35) {
        leaves.push({ x: bx + (rnd() - 0.5) * 6, y: by + (rnd() - 0.5) * 6, r: 2.4, depth: 99, flower: true });
      }
    }
    if (depth < MAX_DEPTH) {
      const spread = 0.5 + rnd() * 0.45;
      const shrink = 0.68 + rnd() * 0.1;
      const n = depth < 2 ? 2 : (rnd() < 0.85 ? 2 : 3);
      for (let i = 0; i < n; i++) {
        const a = angle + spread * (i === 0 ? -1 : 1) * (0.75 + rnd() * 0.5);
        branch(bx, by, a, len * shrink, width * 0.68, depth + 1);
      }
    }
  }
  // 主干：略带弯曲
  const trunkLen = 1;
  branch(0, 0, -Math.PI / 2 + (rnd() - 0.5) * 0.15, trunkLen, 9, 0);
  return { branches, leaves };
}

// tree.js — 绘制函数：progress 0..1（生长），dead=true 时枯萎
export function drawTree(canvas, { seed, type, progress, dead }) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 3); // 上限 3，防止低端机过载
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const t = TREE_TYPES.find(x => x.id === type) || TREE_TYPES[0];
  const tree = buildTree(seed ?? 'seed', t);

  const scale = (h * 0.82); // 树总高约占画布 82%
  const ox = w / 2, oy = h * 0.94;
  const p = Math.max(0.04, Math.min(1, progress));

  // 枝干按 depth 阈值随 progress 逐级显现
  ctx.lineCap = 'round';
  const trunkColor = dead ? '#8a7461' : t.trunk;
  for (const b of tree.branches) {
    const reveal = Math.min(1, Math.max(0, p * (MAX_DEPTH + 1) - b.depth));
    if (reveal <= 0) continue;
    const segX = b.x1 + (b.x2 - b.x1) * reveal;
    const segY = b.y1 + (b.y2 - b.y1) * reveal;
    ctx.strokeStyle = trunkColor;
    ctx.globalAlpha = dead ? 0.85 : 1;
    ctx.lineWidth = Math.max(0.8, b.w * (1 - b.depth * 0.09));
    ctx.beginPath();
    ctx.moveTo(ox + b.x1 * scale * 0.62, oy + b.y1 * scale * 0.62);
    ctx.lineTo(ox + segX * scale * 0.62, oy + segY * scale * 0.62);
    ctx.stroke();
  }

  // 叶簇：progress 后半段逐渐出现，死亡时变褐且掉透明度
  const leafReveal = Math.min(1, Math.max(0, (p - 0.35) / 0.55));
  ctx.globalAlpha = dead ? 0.45 : 1;
  for (const lf of tree.leaves) {
    if (lf.depth > MAX_DEPTH && lf.flower) {
      if (leafReveal < 0.85) continue;
      ctx.fillStyle = dead ? '#b8a68a' : t.flower;
    } else {
      const dTh = lf.depth / MAX_DEPTH;
      if (leafReveal < dTh) continue;
      ctx.fillStyle = dead ? (lf.depth > 4 ? '#9c8a70' : '#7e8a6a') : t.leaf;
    }
    ctx.beginPath();
    ctx.arc(ox + lf.x * scale * 0.62, oy + lf.y * scale * 0.62, lf.r * (0.8 + leafReveal * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 地面小影
  ctx.fillStyle = dead ? 'rgba(90,80,60,0.18)' : 'rgba(40,90,55,0.22)';
  ctx.beginPath();
  ctx.ellipse(ox, oy + 2, scale * 0.13 * p, scale * 0.035 * p, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 森林视图里的迷你树
export function drawMiniTree(canvas, { seed, type, dead }) {
  drawTree(canvas, { seed, type, progress: 1, dead });
}
