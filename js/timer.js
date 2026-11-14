// timer.js — 种植会话状态机（逆向规格 1:1 对应）
//
// 状态: idle → growing → done | dead
// 死因（对应 Forest DieReason）: GIVE_UP | KILL_APP(=离开超宽限/页面被关) | TOO_SHORT(正计时<10min)
//
// 计时原则: 剩余/已用时间一律用 Date.now() 时间戳差计算，绝不累加 interval 次数。
// 原因: 浏览器对后台标签页的 setInterval 节流到 ≥1s/次（iOS 更激进），累加会漂移。
// 挂起会话: sessionStorage 保存活跃会话，页面重开可恢复（对应 Forest 的 checkAndClearOngoingPlant）。

import { Storage } from './storage.js';

export const DIE = {
  GIVE_UP: 'GIVE_UP',         // 主动放弃
  KILL_APP: 'KILL_APP',       // 离开页面超过宽限（Web 版对 KILL_APP 的等效映射）
  TOO_SHORT: 'TOO_SHORT',     // 正计时未满 10 分钟
};

const MIN_COUNTUP_SEC = 10 * 60; // 正计时低于 10 分钟 → 枯树（Forest 真实规则）
const SESSION_KEY = 'fk.activeSession';

export class PlantSession {
  constructor({ mode, plannedSec, treeType, tag, deepFocus }) {
    this.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.mode = mode;                     // countdown | countup
    this.plannedSec = plannedSec;         // countdown 为目标秒数; countup 为上限
    this.treeType = treeType;
    this.tag = tag;
    this.deepFocus = deepFocus;
    this.startedAt = Date.now();
    this.status = 'growing';
    this.dieReason = null;
    this.graceDeadline = null;            // 离开宽限期截止时间戳（null=未在宽限中）
    this.graceSeconds = Storage.getSettings().graceSeconds;
  }

  elapsedSec() {
    // 已专注秒数（含宽限期内的离开时间——回到页面才结算）
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  remainingSec() {
    if (this.mode !== 'countdown') return null;
    return Math.max(0, this.plannedSec - this.elapsedSec());
  }

  progress() {
    if (this.mode === 'countdown') return Math.min(1, this.elapsedSec() / this.plannedSec);
    return Math.min(1, this.elapsedSec() / this.plannedSec); // countup 上限同 plannedSec
  }

  finish(status, dieReason = null) {
    if (this.status !== 'growing') return null; // 幂等
    this.status = status;
    this.dieReason = dieReason;
    this.endedAt = Date.now();
    return this.toRecord();
  }

  toRecord() {
    return {
      id: this.id, mode: this.mode, plannedSec: this.plannedSec,
      startedAt: this.startedAt, endedAt: this.endedAt ?? Date.now(),
      status: this.status, dieReason: this.dieReason,
      treeType: this.treeType, tag: this.tag, deepFocus: this.deepFocus,
      coins: 0,
    };
  }

  persist() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.toRecord())); }
    catch (e) { console.warn('[timer] 会话持久化失败', e); }
  }
}

export const TimerEngine = {
  current: null,
  _tickHandle: null,
  _onTick: null,      // (session) => void，每秒
  _onEnded: null,     // (record) => void，倒计时自然结束

  active() { return this.current?.status === 'growing'; },

  start(opts, { onTick, onEnded } = {}) {
    if (this.active()) throw new Error('已有进行中的种植');
    this.current = new PlantSession(opts);
    this.current.persist();
    this._onTick = onTick; this._onEnded = onEnded;
    this._startTick();
    return this.current;
  },

  // 从 sessionStorage 恢复（页面被杀/重启后）
  resume({ onTick, onEnded } = {}) {
    let raw = null;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch (e) { /* 忽略 */ }
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (rec.status !== 'growing') { sessionStorage.removeItem(SESSION_KEY); return null; }
    const s = Object.assign(new PlantSession({ mode: rec.mode, plannedSec: rec.plannedSec, treeType: rec.treeType, tag: rec.tag, deepFocus: rec.deepFocus }), rec);
    this.current = s;
    this._onTick = onTick; this._onEnded = onEnded;
    this._startTick();
    return s;
  },

  _startTick() {
    clearInterval(this._tickHandle);
    this._tickHandle = setInterval(() => {
      const s = this.current;
      if (!s || s.status !== 'growing') return clearInterval(this._tickHandle);
      // 宽限中不推进“结束判定”（时间仍按 startedAt 连续计算）
      if (s.graceDeadline) {
        if (Date.now() >= s.graceDeadline) {
          this._end(s.finish('dead', DIE.KILL_APP));
        }
        return this._onTick?.(s);
      }
      if (s.mode === 'countdown' && s.remainingSec() <= 0) {
        this._end(s.finish('done'));
      }
      this._onTick?.(s);
    }, 1000);
  },

  _end(record) {
    clearInterval(this._tickHandle);
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* 忽略 */ }
    this._onEnded?.(record);
    this.current = null;
  },

  giveUp() {
    if (!this.active()) return null;
    return this._end(this.current.finish('dead', DIE.GIVE_UP));
  },

  // 正计时模式手动结束（countup 完成）
  finishCountup() {
    const s = this.current;
    if (!s || s.mode !== 'countup') return null;
    if (s.elapsedSec() < MIN_COUNTUP_SEC) return this._end(s.finish('dead', DIE.TOO_SHORT));
    return this._end(s.finish('done'));
  },

  enterGrace() {
    if (!this.active() || this.current.graceDeadline) return;
    this.current.graceDeadline = Date.now() + this.current.graceSeconds * 1000;
    this.current.persist();
    this._onTick?.(this.current);
  },

  exitGrace() {
    if (!this.active()) return;
    this.current.graceDeadline = null;
    this.current.persist();
    this._onTick?.(this.current);
  },

  graceRemainSec() {
    const s = this.current;
    if (!s?.graceDeadline) return null;
    return Math.max(0, Math.ceil((s.graceDeadline - Date.now()) / 1000));
  },
};
