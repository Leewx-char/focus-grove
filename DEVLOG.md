# DEVLOG — Focus Grove 开发日志（错误与坑的沉淀）

> 一边写一边记。每条含：现象 → 原因 → 修复 → 规则沉淀。
> 测试环境：Windows + headless Edge 157（CDP 9223）+ python http.server:8788，驱动脚本 `research/tools/cdp_test*.py`。

## 2026-11-15

### 美术改造：程序化分形树 → Forest 风格原创 SVG 静态贴图（用户反馈驱动）
- **需求**：程序化树太简陋；参考 Forest 树木风格；计时中不需要成长动画，只要静态贴图。
- **素材搜索结论**（先搜后画）：免费素材库与 Forest 插画风不匹配——SVG Repo 的树是 16×16 单色剪影图标（单 path，无分层无色彩），Openclipart/图库站要么风格不符要么许可受限（Freepik 需署名且条件多、iStock/Dreamstime 付费）。Forest 官方贴图是版权资产，**绝不能 rip**。
- **决策**：参考搜索确认的风格特征（层叠圆冠、径向渐变、短粗树干、高光斑、地面阴影），**自绘 5 张原创 SVG**（`assets/tree-{oak,sakura,pine,maple,wisteria}.svg`，200×240）。松树用「同色粗描边 + round join」技巧做圆角三层锥；樱花加花点、紫藤加垂挂花串、枫树加飘叶。
- **架构简化**：`tree.js` 从 200 行 Canvas 分形引擎缩成 15 行贴图模块（`treeSrc/treeName`）；删除 rAF 动画循环与 resize 重绘；`canvas → <img object-fit:contain>`；枯树 = 同一张贴图 + CSS `filter: grayscale(.85) brightness(.72) sepia(.4)`（绿转灰褐，一张图两种状态）。
- **状态机**：`idle`（种植前预览，opacity .55 + saturate .55）→ `growing`（全彩静态）→ `dead`（枯树滤镜）。
- **验证**：回归测试全绿（滚动布局/种植交互不受影响）；430×932 截图确认橡树贴图形态与配色到位；SW bump `v4→v5` 并把 5 个 SVG 加入预缓存列表（SVG 也是静态资源，漏加会导致离线首访 404）。
- **规则沉淀**：**「搜索素材」的正确产出往往不是素材本身，而是风格的精确参数化描述**——拿到风格特征后自绘 SVG 比强行套用不匹配的图标库素材更快更贴。SVG 手写扁平插画是低成本高可控的美术方案。

### 名单交互升级：手动输入 → 预设应用勾选式选择器（用户反馈驱动）
- **用户疑问**：为什么 Forest 能在应用内直接选应用，我们却要手动打字再去系统设置？
- **平台解释（如实）**：Forest Android 用 `QUERY_ALL_PACKAGES` 枚举已装应用 + 无障碍服务监测前台——都是**只有原生 App 能拿的系统级权限**。网页沙箱在 iOS 上**没有任何 API 能枚举已安装应用**，更无法真拦截。PWA 名单的唯一作用 = 生成 iOS 专注模式配置指引。
- **PWA 能做到的上限**：预设清单勾选式选择器——`BLOCKLIST_PRESETS`（国内常用 14 个 + 国际常用 10 个，名字与 iOS 专注模式 App 列表显示名一致），点选 chip 即加入/移出名单（`✓` 前缀标识选中态），清单外仍可手动添加并归入自定义分区（可删）。引导文案自动跟随名单变化。
- **测试**：24 chips 渲染/分组/默认选中 ✓；toggle 抖音/Netflix 后 localStorage 与 UI 同步 ✓；自定义"Keep"入自定义区 ✓；`guideHasNetflix=true` ✓；0 JS 错误。SW bump `v5→v6`。
- **真拦截的升级路径**（要"像 Forest 一样在应用内勾选 + 系统级屏蔽"只能做原生）：iOS 用 Screen Time API（FamilyControls + DeviceActivityShieldConfiguration），免费开发者账号可在 Xcode 启用 **Family Controls (Development) entitlement** 真机调试（分发才需付费申请）——即"有 Mac 无开发者账号"也能做出来，只是 7 天重签。列为后续选项。
- **规则沉淀**：平台能力受限时，把「受限的能力」做成该平台下体验最好的形态（勾选代替打字），并明确告诉用户边界在哪、原生升级路径是什么——比静默降级或过度承诺都好。


- **现象**：冒烟测试 DOM 中 `#tag-options` 出现 8 个按钮（默认 4 个标签 ×2）。
- **原因**：`renderSetup()` 与 `rebuildTagButtons()` 都在首次渲染时构建标签按钮；`renderSetup` 的 `if (!sp.children.length)` 守卫只罩住 species-options，tag-options 被两边各建一份。
- **修复**：标签按钮只由 `rebuildTagButtons()` 构建，`renderSetup()` 只刷选中态。
- **规则沉淀**：同一批 DOM 按钮**只允许一个构建者**；渲染函数只负责「按状态刷 selected 类」。

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

### BUG-06 iPhone 上最底部按钮被挡住（真机反馈，已修复 ✅）
- **现象**：用户真机反馈种树页最底部按钮被挡。
- **原因**：① `.stage` `min-height: 46vh` + topbar + 六行设置面板 > iPhone 可视高度 → 设置面板整体溢出，按钮被 tabbar 挤出屏幕；② iOS Safari 的 `100vh` 包含工具栏区域（比可视高度大），`min-height: calc(100vh - …)` 在非 standalone 模式下进一步放大溢出。
- **修复**：① `.stage` 改 `min-height: clamp(200px, 38vh, 480px)`——空间不足时先压缩树区而不是把按钮挤出去；② `.view` 双写 `100vh` → `100dvh` fallback（动态视口高度，Safari 工具栏收展自动适配）；③ 按坑-05 规则 bump SW `v2→v3`。
- **规则沉淀**：移动端「底部元素被挡」三板斧：`100dvh` fallback、关键底部元素上方留 `padding-bottom: calc(tabbar + safe-area)`、用 `clamp()` 让弹性区（画布/地图）先收缩。**凡改了被 SW 缓存的资源，必须 bump 缓存版本号**。


### BUG-07 自定义时长展开后底部又挡住了 → 布局架构改造（真机反馈，已修复 ✅）
- **现象**：BUG-06 修好后，用户点「自定义」展开输入框行，内容总高再次超过视口，开关/按钮又被挡。逐项打补丁（压缩 stage）治标不治本——**任何可展开的内容都会复发**。
- **根治**：按用户建议改为标准移动端布局——**tabbar 不再 fixed 悬浮，而是 body 纵向 flex 的底部成员；`.view` 成为独立滚动容器**：
  ```css
  body { display: flex; flex-direction: column; height: 100dvh; overflow: hidden; }
  .view { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .tabbar { flex-shrink: 0; }  /* 移除 position: fixed */
  ```
- **关键陷阱**：`.view` 必须 `min-height: 0`——flex 子项默认 `min-height: auto`，会拒绝收缩到内容以下，`overflow-y: auto` 完全失效（内容撑破容器而不是出现滚动条）。这是 flex 布局最高频的坑之一。
- **验证**：DOM 断言（`research/tools/cdp_test3.py`）：展开自定义后 `viewScrollable=true`、`tabbarTop == innerHeight - tabbarHeight`（精确占住底部）、滚动到底后 `fullyVisible=true`（按钮 bottom ≤ tabbar 顶）、自定义 1 分钟正常种植、0 JS 错误。430×932 截图确认展开态一屏完整呈现。**注意测试脚本不能盲选第一个 page target**——Edge 里残留 about:blank 时会连错页面（表现为所有元素 null；错误页标题是主机名也是线索：`document.title === "127.0.0.1"` 即 ERR_CONNECTION_REFUSED，那次其实是本地 http.server 挂了）。
- **规则沉淀**：**「fixed 底栏 + body padding 预留」是脆弱模式**——任何动态内容增长都要逐个补丁；「flex 骨架 + 内容区独立滚动」一次到位。flex 子项要滚动必须 `min-height: 0`（纵向）/`min-width: 0`（横向）。


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
