// app.js — 主逻辑：视图路由、种植流程、拦截监控、通知、统计渲染
import { Storage } from './storage.js';
import { TimerEngine, DIE } from './timer.js';
import { TREE_TYPES, treeSrc, treeName } from './tree.js';
import { Stats } from './stats.js';
import { Blocklist, BLOCKLIST_PRESETS } from './blocklist.js';

const $ = (id) => document.getElementById(id);

/* ---------- 视图路由 ---------- */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(`view-${name}`)?.classList.add('active');
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('sel', b.dataset.view === name));
  if (name === 'forest') renderForest();
  if (name === 'stats') renderStats();
  if (name === 'settings') renderSettings();
}
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

/* ---------- 种植设置 ---------- */
const setup = {
  seconds: 1500,
  mode: 'countdown',
  treeType: TREE_TYPES[0].id,
  tag: null,
  deepFocus: true,
};

function renderSetup() {
  document.querySelectorAll('#duration-options button').forEach(b => {
    b.classList.toggle('sel', Number(b.dataset.sec) === setup.seconds);
  });
  document.querySelectorAll('#mode-options button').forEach(b =>
    b.classList.toggle('sel', b.dataset.mode === setup.mode));
  $('custom-duration-row').classList.toggle('hidden', setup.seconds !== 0);

  const sp = $('species-options');
  if (!sp.children.length) {
    TREE_TYPES.forEach(t => {
      const b = document.createElement('button');
      b.textContent = t.name; b.dataset.id = t.id;
      b.addEventListener('click', () => { setup.treeType = t.id; renderSetup(); });
      sp.appendChild(b);
    });
    // 标签按钮由 rebuildTagButtons() 统一构建，这里只更新选中态，避免重复渲染
  }
  sp.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.id === setup.treeType));
  const tg = $('tag-options');
  [...tg.children].forEach(b => b.classList.toggle('sel', b.dataset.tag === setup.tag));
  $('deep-focus-toggle').classList.toggle('on', setup.deepFocus);
  $('deep-focus-toggle').setAttribute('aria-pressed', String(setup.deepFocus));
}

document.querySelectorAll('#duration-options button').forEach(b =>
  b.addEventListener('click', () => { setup.seconds = Number(b.dataset.sec); renderSetup(); }));
document.querySelectorAll('#mode-options button').forEach(b =>
  b.addEventListener('click', () => { setup.mode = b.dataset.mode; renderSetup(); }));
$('deep-focus-toggle').addEventListener('click', () => { setup.deepFocus = !setup.deepFocus; renderSetup(); });
$('custom-minutes').addEventListener('input', (e) => {
  const v = Math.max(1, Math.min(180, Number(e.target.value) || 0));
  setup.seconds = v * 60;
});

/* ---------- 主界面渲染 ---------- */
function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec) {
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60) ? ` ${Math.floor((sec % 3600) / 60)}m` : ''}`;
}

function refreshTopChips() {
  const sum = Stats.summary();
  $('chip-today').textContent = `今日 ${Math.floor(sum.todaySec / 60)} 分钟`;
  $('chip-coins').textContent = `🪙 ${Storage.getCoins()}`;
}

/* ---------- 树贴图渲染（静态，无成长动画） ---------- */
// state: 'idle'（种植前预览，半透明）| 'growing'（专注中完整显示）| 'dead'（枯树滤镜）
function renderTree(session, state) {
  const img = $('tree-img');
  const type = session?.treeType ?? setup.treeType;
  img.src = treeSrc(type);
  img.alt = `${treeName(type)}（原创贴图）`;
  img.classList.toggle('idle', state === 'idle');
  img.classList.toggle('tree-dead', state === 'dead');
}

/* ---------- 种植流程 ---------- */
$('plant-btn').addEventListener('click', async () => {
  let sec = setup.seconds;
  if (setup.mode === 'countdown') {
    if (setup.seconds === 0) {
      const v = Number($('custom-minutes').value);
      if (!v) { $('custom-minutes').focus(); return; }
      sec = v * 60;
    }
  } else {
    sec = 180 * 60; // 正计时上限 180 分钟
  }
  // 深度专注 → 名单引导（一次性可跳过：本会话已看过则直接开始）
  if (setup.deepFocus && !sessionStorage.getItem('fk.guideSeen')) {
    showConfirm('深度专注引导', Blocklist.focusGuideSteps().map(s => `${s.step}. ${s.text}`).join('\n') + '\n\n（引导可在「名单」页随时回看）', '我知道了', startPlanting, true);
    sessionStorage.setItem('fk.guideSeen', '1');
    return;
  }
  startPlanting();
});

async function startPlanting() {
  // 通知授权（iOS 16.4+ 需已添加到主屏幕）
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) { /* 忽略 */ }
  }
  const session = TimerEngine.start(
    { mode: setup.mode, plannedSec: setup.seconds || 180 * 60, treeType: setup.treeType, tag: setup.tag, deepFocus: setup.deepFocus },
    { onTick: onTick, onEnded: onEnded },
  );
  session.persist();
  enterGrowingUI(session);
  notify('🌱 种树开始', `这棵${treeName(session.treeType)}正在生长，加油！`, 'start');
  renderTree(session, 'growing');
}

function enterGrowingUI(session) {
  $('setup-panel').classList.add('hidden');
  $('growing-panel').classList.remove('hidden');
  $('finish-countup-btn').classList.toggle('hidden', session.mode !== 'countup');
  $('giveup-btn').classList.toggle('hidden', session.mode === 'countup');
  $('growing-tip').textContent = session.mode === 'countdown'
    ? `专注 ${Math.round(session.plannedSec / 60)} 分钟后小树将长成`
    : `正计时中，满 10 分钟才能种成（上限 180 分钟）`;
}

$('giveup-btn').addEventListener('click', () => {
  showConfirm('放弃这棵树？', '树会立刻枯萎，不能恢复。\n种下不易，再坚持一下？', '放弃并枯萎', () => TimerEngine.giveUp());
});

$('finish-countup-btn').addEventListener('click', () => TimerEngine.finishCountup());

/* ---------- 拦截监控（对应 Forest 的离开检测） ---------- */
document.addEventListener('visibilitychange', () => {
  const s = TimerEngine.current;
  if (!s || s.status !== 'growing') return;
  if (document.hidden) {
    if (s.deepFocus) TimerEngine.enterGrace();
    // 深度专注时切走：宽限倒计时开始；非深度专注模式不打扰（切走不杀树——Forest 真实规则）
  } else {
    if (TimerEngine.current?.graceDeadline) {
      TimerEngine.exitGrace();
      $('grace-banner').classList.add('hidden');
    }
  }
});
window.addEventListener('pagehide', () => {
  TimerEngine.current?.persist(); // 页面被杀前保存（用户可能回不来 → 相当于 KILL_APP 路径）
});

function onTick(session) {
  const remain = session.remainingSec();
  const elapsed = session.elapsedSec();
  $('timer-display').textContent = session.mode === 'countdown'
    ? fmt(remain ?? 0)
    : fmt(elapsed);
  const grace = TimerEngine.graceRemainSec();
  const banner = $('grace-banner');
  if (grace !== null) {
    banner.classList.remove('hidden');
    $('grace-count').textContent = grace;
    document.body.classList.add('focus-mode-away');
  } else {
    banner.classList.add('hidden');
    document.body.classList.remove('focus-mode-away');
  }
  refreshTopChips();
}

function onEnded(record) {
  $('grace-banner').classList.add('hidden');

  let coins = 0;
  if (record.status === 'done') {
    // endedAt/startedAt 是毫秒时间戳，coinsFor 以秒为单位
    coins = Stats.coinsFor(Math.floor((record.endedAt - record.startedAt) / 1000));
    record.coins = coins;
    Storage.addCoins(coins);
  }
  Storage.addSession(record);
  const newAch = Stats.checkAchievements();

  // UI 复位
  $('setup-panel').classList.remove('hidden');
  $('growing-panel').classList.add('hidden');
  $('progress-ring-label').textContent = '准备好了就种下这棵树';
  renderTree(null, 'idle');
  refreshTopChips();

  const tName = TREE_TYPES.find(t => t.id === record.treeType)?.name ?? '树';
  if (record.status === 'done') {
    const mins = Math.round((record.endedAt - record.startedAt) / 60000);
    showResult('🌳', '种树成功！', `这棵${tName}加入了你的森林。\n专注 ${mins} 分钟，获得 ${coins} 金币 🪙`
      + (newAch.length ? `\n\n解锁成就：${newAch.map(a => a.title).join('、')} 🏅` : ''));
    notify('🌳 种树成功', `专注 ${mins} 分钟，+${coins} 金币`, 'done');
  } else {
    const reasonText = {
      [DIE.GIVE_UP]: '你选择了放弃',
      [DIE.KILL_APP]: '离开页面太久，小树枯萎了',
      [DIE.TOO_SHORT]: '正计时未满 10 分钟，得到一棵枯树',
    }[record.dieReason] ?? '树枯萎了';
    showResult('🥀', '小树枯萎了', `${reasonText}。\n下次试试再坚持一会儿？`);
    notify('🥀 小树枯萎', reasonText, 'dead');
  }
}

/* ---------- 通知 ---------- */
function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: `fg-${tag ?? 'misc' }` });
    n.addEventListener('click', () => { window.focus(); n.close(); });
  } catch (e) { /* iOS 版本不支持时静默 */ }
}

/* ---------- 全屏遮罩（返回种树） ---------- */
$('overlay-back').addEventListener('click', () => $('focus-overlay').classList.add('hidden'));

/* ---------- 确认/结果弹窗 ---------- */
let confirmOk = null;
function showConfirm(title, text, okLabel, onOk, infoOnly = false) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('confirm-ok').textContent = okLabel;
  $('confirm-ok').classList.toggle('danger-btn', !infoOnly);
  $('confirm-ok').classList.toggle('primary-btn', infoOnly);
  $('confirm-cancel').textContent = infoOnly ? '关闭' : '继续专注';
  confirmOk = onOk;
  $('confirm-dialog').classList.remove('hidden');
}
$('confirm-ok').addEventListener('click', () => {
  $('confirm-dialog').classList.add('hidden');
  confirmOk?.();
  confirmOk = null;
});
$('confirm-cancel').addEventListener('click', () => $('confirm-dialog').classList.add('hidden'));

function showResult(emoji, title, text) {
  $('result-emoji').textContent = emoji;
  $('result-title').textContent = title;
  $('result-text').textContent = text;
  $('result-dialog').classList.remove('hidden');
}
$('result-ok').addEventListener('click', () => $('result-dialog').classList.add('hidden'));

/* ---------- 森林视图 ---------- */
function renderForest() {
  const sessions = Storage.getSessions();
  const grid = $('forest-grid');
  grid.innerHTML = '';
  $('forest-count').textContent = `${sessions.length} 棵`;
  $('forest-empty').classList.toggle('hidden', sessions.length > 0);
  for (const s of [...sessions].reverse().slice(0, 60)) {
    const div = document.createElement('div');
    div.className = 'forest-item';
    const img = document.createElement('img');
    img.src = treeSrc(s.treeType);
    img.alt = treeName(s.treeType);
    img.draggable = false;
    if (s.status !== 'done') img.classList.add('tree-dead');
    div.appendChild(img);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const d = new Date(s.endedAt);
    meta.textContent = `${treeName(s.treeType)} · ${d.getMonth() + 1}/${d.getDate()}${s.status !== 'done' ? ' · 枯' : ''}`;
    div.appendChild(meta);
    grid.appendChild(div);
  }
}

/* ---------- 统计视图 ---------- */
function renderStats() {
  const sum = Stats.summary();
  $('stat-today').textContent = fmtDuration(sum.todaySec);
  $('stat-total').textContent = fmtDuration(sum.totalSec);
  $('stat-count').textContent = String(sum.totalCount);

  // 7 天柱状图（Canvas 原生绘制）
  const chart = $('week-chart');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = chart.clientWidth, h = 140;
  chart.width = w * dpr; chart.height = h * dpr;
  const ctx = chart.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...sum.days.map(d => d.sec), 1);
  const bw = (w - 30) / 7;
  sum.days.forEach((d, i) => {
    const bh = (d.sec / max) * (h - 34);
    const x = 15 + i * bw;
    ctx.fillStyle = i === 6 ? '#3a7d56' : '#a9c9b3';
    ctx.beginPath();
    ctx.roundRect(x + 4, h - 22 - bh, bw - 10, Math.max(bh, 2), 4);
    ctx.fill();
    ctx.fillStyle = '#77857c'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.key.slice(5), x + (bw - 6) / 2 + 2, h - 8);
    if (d.sec > 0) ctx.fillText(Math.round(d.sec / 60) + 'm', x + (bw - 6) / 2 + 2, h - 26 - bh);
  });

  // 成就
  const list = $('achievement-list');
  list.innerHTML = '';
  Stats.achievementList().forEach(a => {
    const div = document.createElement('div');
    div.className = 'ach' + (a.unlocked ? '' : ' locked');
    div.innerHTML = `<span class="icon">${a.unlocked ? '🏅' : '🔒'}</span>
      <span class="name">${a.title}</span>
      <span class="bar"><i style="width:${Math.round(a.progress * 100)}%"></i></span>`;
    list.appendChild(div);
  });

  // 标签分布（今日）
  const tb = $('tag-breakdown');
  tb.innerHTML = '';
  const today = Stats.dayKey();
  const byTag = {};
  Storage.getSessions()
    .filter(s => s.status === 'done' && Stats.dayKey(s.endedAt) === today)
    .forEach(s => { const k = s.tag ?? '未分类'; byTag[k] = (byTag[k] ?? 0) + Math.floor((s.endedAt - s.startedAt) / 60000); });
  const entries = Object.entries(byTag);
  if (!entries.length) { tb.innerHTML = '<span class="hint">今天还没有专注记录</span>'; }
  entries.forEach(([tag, mins]) => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.style.background = Stats.tagColor(tag);
    pill.textContent = `${tag} ${mins}m`;
    tb.appendChild(pill);
  });
}

/* ---------- 名单/设置视图 ---------- */
function renderSettings() {
  // 预设应用勾选网格（点选即加入/移出名单）
  const groups = $('preset-groups');
  groups.innerHTML = '';
  for (const [groupName, apps] of Object.entries(BLOCKLIST_PRESETS)) {
    const g = document.createElement('div');
    g.className = 'preset-group';
    const h = document.createElement('h4');
    h.textContent = groupName;
    g.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'preset-grid';
    apps.forEach(name => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'preset-chip' + (Blocklist.has(name) ? ' sel' : '');
      chip.textContent = name;
      chip.setAttribute('aria-pressed', String(Blocklist.has(name)));
      chip.addEventListener('click', () => { Blocklist.toggle(name); renderSettings(); });
      grid.appendChild(chip);
    });
    g.appendChild(grid);
    groups.appendChild(g);
  }
  // 清单外的自定义应用 chips（可删除）
  const wrap = $('blocklist-items');
  wrap.innerHTML = '';
  const customs = Blocklist.customItems();
  if (customs.length) {
    customs.forEach(name => {
      const item = document.createElement('span');
      item.className = 'chip-item';
      item.innerHTML = `${name}<button aria-label="移除">✕</button>`;
      item.querySelector('button').addEventListener('click', () => { Blocklist.remove(name); renderSettings(); });
      wrap.appendChild(item);
    });
  }
  // 引导
  const guide = $('focus-guide');
  guide.innerHTML = '';
  Blocklist.focusGuideSteps().forEach(s => {
    const li = document.createElement('li');
    li.textContent = s.text;
    guide.appendChild(li);
  });
  // 宽限
  $('grace-input').value = String(Storage.getSettings().graceSeconds);
  // 标签管理
  const tm = $('tag-manage-list');
  tm.innerHTML = '';
  Storage.getSettings().tags.forEach(t => {
    const item = document.createElement('span');
    item.className = 'chip-item';
    item.innerHTML = `${t}<button aria-label="移除">✕</button>`;
    item.querySelector('button').addEventListener('click', () => {
      const tags = Storage.getSettings().tags.filter(x => x !== t);
      Storage.setSettings({ tags });
      rebuildTagButtons();
      renderSettings();
    });
    tm.appendChild(item);
  });
}

function rebuildTagButtons() {
  const tg = $('tag-options');
  tg.innerHTML = '';
  Storage.getSettings().tags.forEach(t => {
    const b = document.createElement('button');
    b.textContent = t; b.dataset.tag = t;
    b.addEventListener('click', () => { setup.tag = setup.tag === t ? null : t; renderSetup(); });
    tg.appendChild(b);
  });
}

$('blocklist-add').addEventListener('click', () => {
  const v = $('blocklist-input').value.trim();
  if (v) { Blocklist.add(v); $('blocklist-input').value = ''; renderSettings(); }
});
$('tag-add').addEventListener('click', () => {
  const v = $('tag-input').value.trim();
  if (v) {
    const s = Storage.getSettings();
    if (!s.tags.includes(v)) Storage.setSettings({ tags: [...s.tags, v] });
    $('tag-input').value = '';
    rebuildTagButtons();
    renderSettings();
  }
});
$('grace-save').addEventListener('click', () => {
  const v = Math.max(0, Math.min(120, Number($('grace-input').value) || 10));
  Storage.setSettings({ graceSeconds: v });
  renderSettings();
});

/* ---------- 启动 ---------- */
// PWA 装配：注册 Service Worker（iOS 添加到主屏幕 + 离线 + 通知能力的前提）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('[sw] 注册失败', e));
}

function init() {
  rebuildTagButtons();
  renderSetup();
  refreshTopChips();
  renderTree(null, 'idle');

  // 恢复进行中的会话（页面刷新/被杀后重开）
  const resumed = TimerEngine.resume({ onTick, onEnded });
  if (resumed) {
    enterGrowingUI(resumed);
    renderTree(resumed, 'growing');
  }
  // 静态贴图随 object-fit 自适应，无需 resize 重绘
}
init();
