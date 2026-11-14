// storage.js — 本地持久化层
// 用 localStorage（数据量小、同步、简单）。键统一前缀避免冲突。
// 会话记录 schema:
//   { id, mode:'countdown'|'countup', plannedSec, startedAt, endedAt,
//     status:'done'|'dead'|'quit', dieReason, treeType, tag, coins }

const KEYS = {
  sessions: 'fk.sessions',      // 完成的会话数组（含枯树）
  settings: 'fk.settings',      // { blocklist, tags, deepFocus,宽限等 }
  coins: 'fk.coins',            // 当前金币余额
  achievements: 'fk.ach',       // { id: unlockedAt }
};

const DEFAULT_SETTINGS = {
  blocklist: ['微信', '抖音', '小红书', '微博', '哔哩哔哩'], // 预设勾选的默认名单
  tags: ['专注', '学习', '工作', '阅读'],
  graceSeconds: 10,             // 专注中离开页面的宽限秒数
  deepFocusDefault: true,       // 开启种树时默认进入深度专注
};

export const Storage = {
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[storage] 读取失败', key, e);
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // iOS Safari 隐私模式下 setItem 会抛 QuotaExceededError
      console.warn('[storage] 写入失败', key, e);
      return false;
    }
  },
  getSettings() {
    const s = this.load(KEYS.settings, null);
    return s ? { ...DEFAULT_SETTINGS, ...s } : { ...DEFAULT_SETTINGS };
  },
  setSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    this.save(KEYS.settings, next);
    return next;
  },
  getSessions() { return this.load(KEYS.sessions, []); },
  addSession(session) {
    const all = this.getSessions();
    all.push(session);
    this.save(KEYS.sessions, all);
    return all;
  },
  removeSession(id) {
    this.save(KEYS.sessions, this.getSessions().filter(s => s.id !== id));
  },
  getCoins() { return this.load(KEYS.coins, 0); },
  addCoins(delta) {
    const c = this.getCoins() + delta;
    this.save(KEYS.coins, Math.max(0, c));
    return c;
  },
  getAchievements() { return this.load(KEYS.achievements, {}); },
  unlockAchievement(id) {
    const a = this.getAchievements();
    if (a[id]) return false;
    a[id] = Date.now();
    this.save(KEYS.achievements, a);
    return true;
  },
};
