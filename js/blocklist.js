// blocklist.js — 应用限制名单 + iOS 专注模式引导
// PWA 无法真拦截其他 App（浏览器沙箱），对应的落地方式：
//   1) 维护名单（Forest Allowlist/Blocklist 双模式的 UI 对应物）
//   2) 开始专注前引导用户开启 iOS「专注模式」（阻止通知/可选屏蔽 App）
//   3) 专注中本 App 内全屏遮罩 + 离开宽限（timer.js 的 grace 机制）

import { Storage } from './storage.js';

export const Blocklist = {
  list() { return Storage.getSettings().blocklist; },
  add(name) {
    const n = name.trim();
    if (!n) return;
    const l = this.list();
    if (l.some(x => x.toLowerCase() === n.toLowerCase())) return;
    Storage.setSettings({ blocklist: [...l, n] });
  },
  remove(name) { Storage.setSettings({ blocklist: this.list().filter(x => x !== name) }); },

  // iOS 专注模式开启引导（原创文案，机制对应 Forest 的屏蔽引导页）
  focusGuideSteps() {
    const apps = this.list().map(x => `“${x}”`).join('、');
    return [
      { step: '1', text: '打开 设置 → 专注模式（Focus）→ 点右上角 + 新建，命名为「种树中」' },
      { step: '2', text: '在「允许的通知」里选择 仅限联系人，或按需放行家人' },
      { step: '3', text: '在「App」里允许的 App 留空（或只留你信任的工具），不在名单里的 App 的通知将被静默' },
      { step: '4', text: `回到 设置 → 专注模式 → 「种树中」→ 可选「锁定屏幕变暗」；名单参考：${apps || '（暂无，可在下方添加）'}` },
      { step: '5', text: '开始种树前，从控制中心点一下「专注模式」选择「种树中」即可' },
    ];
  },
};
