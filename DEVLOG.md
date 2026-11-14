# DEVLOG — Focus Grove 开发日志（错误与坑的沉淀）

> 一边写一边记。每条含：现象 → 原因 → 修复 → 规则沉淀。
> 测试环境：Windows + headless Edge 157（CDP 9223）+ python http.server:8788，驱动脚本 `research/tools/cdp_test*.py`。

## 2026-11-14

### BUG-01 标签按钮重复渲染（已修复 ✅）
- **现象**：冒烟测试 DOM 中 `#tag-options` 出现 8 个按钮（默认 4 个标签 ×2）。
- **原因**：`renderSetup()` 与 `rebuildTagButtons()` 都在首次渲染时构建标签按钮；`renderSetup` 的 `if (!sp.children.length)` 守卫只罩住 species-options，tag-options 被两边各建一份。
- **修复**：标签按钮只由 `rebuildTagButtons()` 构建，`renderSetup()` 只刷选中态。
- **规则沉淀**：同一批 DOM 按钮**只允许一个构建者**；渲染函数只负责「按状态刷 selected 类」。

### BUG-02 ReferenceError: maxDepth is not defined（已修复 ✅）
- **现象**：首页树不画。页面挂上错误可视化钩子后截图直接看到 `tree.js:85 ReferenceError`。
- **原因**：`maxDepth` 是 `buildTree()` 的局部变量，`drawTree()` 里也引用了它。
- **修复**：提升为模块级常量 `MAX_DEPTH`。
- **规则沉淀**：**把 JS 错误画在页面上**（error → 固定定位横幅）是无 console 权限的 headless/真机排查利器；截图即诊断。

### BUG-03 遗漏 Service Worker 注册（已修复 ✅）
- **现象**：写了 `sw.js` 但没有任何地方调用 `navigator.serviceWorker.register()`，SW 从未生效。
- **修复**：`app.js` 启动时注册。
- **规则沉淀**：装配类文件（manifest/sw/图标）要有**装配检查清单**；「文件存在」≠「已接线」。

### BUG-04 金币结算把毫秒当秒（已修复 ✅，测试发现）
- **现象**：25 分钟完成结算得 **421/423 金币**（应为 2）。
- **原因**：`record.endedAt - record.startedAt` 是毫秒，直接传给了以秒为单位的 `coinsFor()` → 落入 `5 + floor(ms/3600)` 分支。
- **修复**：`Math.floor(diff/1000)` 后再传。
- **规则沉淀**：跨函数传「时长」必须**显式命名单位**（`seconds`/`ms`），或统一在边界换算。端到端测试+断言档位值才能抓到这种「能跑但离谱」的 bug。

### BUG-05 SW cache-first 缓存了旧代码，修复看起来"不生效"（已修复 ✅，必记）
- **现象**：修好 BUG-04 后重测，金币**仍是 421**——修复没生效！
- **原因**：上一步注册的 SW 以 cache-first 缓存了旧 `app.js`，`sw.js` 内容没变 → 浏览器 byte-diff 认为无更新 → 永远命中 v1 旧缓存。
- **修复**：bump 缓存版本 `focus-grove-v1 → v2`（activate 清旧缓存 + skipWaiting + clients.claim），第一次加载触发更新、第二次加载拿新代码，金币=2 ✅。
- **规则沉淀**：**「改了代码但行为没变」时先怀疑 SW/HTTP 缓存**，再怀疑逻辑。迭代期可给静态资源 URL 加版本参数；发布期 bump SW 版本号是必须动作。

### 坑-01 浏览器后台节流 → 计时绝不能累加（设计时规避 ✅，测试证实）
- 对策生效：测试中模拟拨回 `startedAt` 25 分钟，下一 tick 立即到期结算；前台每秒 tick 只读时间戳差（25:00→24:56 精确走动）。
- **规则沉淀**：跨前后台的计时，**状态是时间戳，不是计数器**。

### 坑-02 PWA 平台边界（设计时明确）
- iOS 通知需 **16.4+ 且已添加到主屏幕**；`requestPermission()` 放在「种下这棵树」点击流内 ✅。
- PWA 无法拦截其他 App → 三层替代：系统专注模式引导（`blocklist.js`）+ 页内遮罩（`focus-overlay`）+ 离开宽限（`timer.js` grace）。
- localStorage：iOS 7 天清除策略对**添加到主屏幕的 PWA 豁免**——必须引导用户安装。

### 坑-03 工具链
- REA `capture.at_end` 无 console 项 → console 用 `inspect_web_page(include_console_text)`，但 attach 时机常拿不到历史错误 → 错误画页面（BUG-02）最稳。
- 本 REPL 内核无 `WebSocket` 全局 → python `websockets` 直连 CDP 驱动交互（`research/tools/cdp_test*.py`），比截图猜坐标可靠得多。
- 截图证据提取链：`capture_browser_scenario(at_end:[screenshot])` → `export_evidence_bundle` → python 解 base64 → Read 查看。**export 必须在截图之后**（bundle 是导出时刻的快照）。
- Windows GBK 控制台打 emoji 会 UnicodeEncodeError → `sys.stdout.reconfigure(encoding='utf-8')`。

### 测试结论（cdp_test.py / cdp_test2.py）
| 路径 | 结果 |
|---|---|
| 初始渲染 + 树苗绘制 | ✅ |
| 引导弹窗 → 开始种植 | ✅ |
| 倒计时走动（时间戳驱动） | ✅ 25:00→24:56 |
| 离开宽限 banner 出现/清除 | ✅ |
| 放弃 → GIVE_UP 枯树、0 金币 | ✅ |
| 倒计时到期 → done + 金币(2) + 成就 | ✅ |
| 正计时 <10min 结束 → TOO_SHORT | ✅ |
| 森林/统计/成就渲染 | ✅ |
| SW 注册 + 版本更新 | ✅ v2 |
| 全程 JS 错误 | 0 |

### 待办（下轮）
- [ ] iPhone 真机验证（HTTPS 托管 → 安装 → 通知）
- [ ] 深色模式适配
- [ ] 树生长 rAF 动画在低端机的性能采样
