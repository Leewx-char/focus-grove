// stats.js — 专注统计：日聚合 / 标签 / 成就 / 金币结算
// 成就里程碑对标逆向发现的总时长档位（4h/3d/7d/15d/30d），命名原创。

import { Storage } from './storage.js';

const ACHIEVEMENTS = [
  { id: 'first_tree', title: '第一棵树', need: { count: 1 } },
  { id: 'focus_4h',   title: '小树成荫', need: { seconds: 4 * 3600 } },
  { id: 'focus_3d',   title: '拾光成瓶', need: { seconds: 3 * 86400 } },
  { id: 'focus_7d',   title: '一木成林', need: { seconds: 7 * 86400 } },
  { id: 'focus_15d',  title: '浇浇水人', need: { seconds: 15 * 86400 } },
  { id: 'focus_30d',  title: '植木成海', need: { seconds: 30 * 86400 } },
];

const TAG_COLORS = ['#4a9e57','#d9772f','#a37fd6','#e05d6f','#3d8ec9','#c9a23d',
  '#5cb85c','#8a6dd1','#2e9e8f','#d16a3d','#4a789e','#b25d9e','#7d9e4a','#9e4a4a','#4a5e9e'];

export const Stats = {
  dayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // 金币结算表：完成时长 → 金币（原创档位）
  coinsFor(seconds) {
    if (seconds < 15 * 60) return 1;
    if (seconds < 30 * 60) return 2;
    if (seconds < 45 * 60) return 3;
    if (seconds < 60 * 60) return 4;
    return 5 + Math.floor(seconds / 3600); // 1h+ 每小时 +1
  },

  tagColor(tag) {
    const tags = Storage.getSettings().tags;
    const i = Math.max(0, tags.indexOf(tag));
    return TAG_COLORS[i % TAG_COLORS.length];
  },

  summary() {
    const sessions = Storage.getSessions().filter(s => s.status === 'done');
    const totalSec = sessions.reduce((a, s) => a + Math.floor((s.endedAt - s.startedAt) / 1000), 0);
    const today = this.dayKey();
    const todaySec = sessions
      .filter(s => this.dayKey(s.endedAt) === today)
      .reduce((a, s) => a + Math.floor((s.endedAt - s.startedAt) / 1000), 0);
    // 最近 7 天（含今日）
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = this.dayKey(Date.now() - i * 86400_000);
      const sec = sessions.filter(s => this.dayKey(s.endedAt) === key)
        .reduce((a, s) => a + Math.floor((s.endedAt - s.startedAt) / 1000), 0);
      days.push({ key, sec });
    }
    return { totalSec, todaySec, todayCount: sessions.filter(s => this.dayKey(s.endedAt) === today).length, days, totalCount: sessions.length };
  },

  checkAchievements() {
    const sum = this.summary();
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      const ok = a.need.count ? sum.totalCount >= a.need.count : sum.totalSec >= a.need.seconds;
      if (ok && Storage.unlockAchievement(a.id)) newly.push(a);
    }
    return newly;
  },

  achievementList() {
    const sum = this.summary();
    const got = Storage.getAchievements();
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: !!got[a.id],
      progress: a.need.count
        ? Math.min(1, sum.totalCount / a.need.count)
        : Math.min(1, sum.totalSec / a.need.seconds),
    }));
  },
};
