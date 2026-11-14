# Focus Grove · 专注种树 PWA

Forest 核心机制的原创复刻（Web 版）：**计时器、种树动画、应用限制名单、专注统计、专注期拦截**。
全部代码与美术为原创实现，机制规则参考自逆向分析（见 `../research/` 与 `SPEC.md`），未复制 Forest 任何资源。

## 运行（本地）

```bash
cd clone
python -m http.server 8788 --bind 127.0.0.1
# 浏览器打开 http://127.0.0.1:8788/
```

## 装到 iPhone 17 Pro（PWA 安装三步）

1. **HTTPS 托管**（必须，iOS 不允许非 https 安装）。最简单两种：
   - GitHub Pages：把 `clone/` 内容推到仓库 → Settings → Pages → 得到 `https://<user>.github.io/<repo>/`
   - Vercel/Netlify：拖目录上传即可
2. iPhone Safari 打开该网址 → 底部「分享」→ **添加到主屏幕**
3. 从主屏幕图标打开（此时才是 standalone 模式）→ 点「种下这棵树」时**允许通知**

> ⚠️ 通知需要 iOS 16.4+ 且必须从主屏幕图标打开后才可授权；Safari 直接打开不行。
> ⚠️ 添加到主屏幕还能豁免 iOS 对网页存储的 7 天清除策略，专注记录才长期可靠。

## 专注期拦截怎么用（iOS 现实约束）

PWA 无法真拦截其他 App，App 内做了三层替代（对应 Forest 的 ShieldPlan 机制）：

1. **系统专注模式**：在「名单」页维护想屏蔽的 App → 按 5 步引导在 iOS 设置里创建「种树中」专注模式 → 种树前从控制中心开启
2. **页内遮罩**：种树时切到本页面之外的标签页，回来会看到「深度专注中」全屏遮罩，一键返回
3. **离开宽限**：深度专注开启时离开本页面，10 秒（可设置 0-120s）内不回来，树就枯萎（对应 Forest 的 KILL_APP 死因）

## 功能地图

| 视图 | 内容 |
|---|---|
| 🌱 种树 | 倒计时（15/25/30/45/60/自定义）+ 正计时（上限 180min，**<10min 得枯树**——Forest 真实规则）、5 种原创树种（Canvas 分形程序化生成，同种子同一棵树）、标签、深度专注开关 |
| 🌳 森林 | 完成的树按时间排列，枯树呈枯萎态 |
| 📊 统计 | 今日/累计/棵数、近 7 天柱状图、6 个成就（4h/3d/7d/15d/30d 里程碑）、今日标签分布 |
| ⚙️ 名单 | 屏蔽名单管理、iOS 专注模式引导、离开宽限设置、标签管理 |

金币经济：15min 内=1 枚，15-30=2，30-45=3，45-60=4，1h+ 每小时 +1（对标 Forest coin_rewards 分档思想）。

## 文件结构

```
clone/
├── index.html            # 单页壳（含开发用错误横幅钩子，发布可移除）
├── manifest.webmanifest  # PWA 清单
├── sw.js                 # Service Worker（cache-first；改代码后记得 bump 版本号！）
├── css/styles.css        # iPhone 竖屏 + safe-area 适配
├── js/
│   ├── storage.js        # localStorage 持久层
│   ├── timer.js          # 会话状态机（时间戳驱动，死因枚举 GIVE_UP/KILL_APP/TOO_SHORT）
│   ├── tree.js           # Canvas 程序化树（生长/枯死动画）
│   ├── stats.js          # 统计聚合/成就/金币
│   ├── blocklist.js      # 名单 + iOS 专注模式引导文案
│   └── app.js            # 主逻辑/路由/拦截监控/通知
├── assets/               # 原创图标 192/512/180
├── SPEC.md               # 逆向机制规格 → 实现映射
└── DEVLOG.md             # 开发日志：5 个 bug + 平台坑全记录
```

## 已知边界

- 拦截是「引导+提示」而非系统级强制（iOS 平台约束，原生版可用 Screen Time API 真拦截，见 SPEC.md）
- 树动画为 Canvas 2D，DPR 上限 3（防低端机过载）
- 数据仅存本机（后续可加导出/云同步）
