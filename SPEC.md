# Forest 机制规格（逆向结论 → 复刻蓝本）

来源：Forest Play 国际版 5.16.5（versionCode 51605000，Seekrtech 官方签名 `8f637a2a...`，未加固，jadx 全量反编译 60,452 个类）+ 中国版 5.3.2 明文资源 + 官网代码。
用途：**机制参考**。所有代码与美术均为原创实现，不复制 Forest 的资源、文案与代码。

## 1. 专注会话（种树计时器）

- 会话状态：`idle → growing → done | dead`；死因枚举 `DieReason = GIVE_UP | KILL_APP | OTHERS_GIVE_UP_IN_TOGETHER_MODE`
- **切走应用本身不杀死树**——树死只来自：用户按"放弃"(GIVE_UP)、进程被系统杀掉(KILL_APP)、组队中他人放弃
- 两种模式：倒计时（15/25/30/45/60min+自定义）；正计时（上限 180min，**正计时未满 10 分钟结束得枯树**，中国版 strings 证实）
- 计时驱动：前台 Compose 界面 + 后台持久化会话（`checkAndClearOngoingPlant` 恢复未决会话），`AlarmScheduler`（exact alarm）到点唤醒
- 完成结算：种树入森林 + 金币（coin_rewards 9 档 / gem_rewards 23 档，products.json 261 个商品，含花金币删除种树记录）

## 2. 拦截引擎（Deep Focus + Time Guard 同一套）

组件链：`BaseAccessibilityMonitoringService`（AccessibilityEvent 捕获前台包名）
→ `ForestAccessibilityService.checkingCurrentState(currentPackageName)`
→ `shouldShowOverlayForApp(pkg)` → `showOverlay` / `hideOverlay`（300ms 防抖）

决策核心 `MonitoringEngine.evaluateOverlay`：
1. `currentForeground` 为空 → 不处理
2. 计划目标集 `getTargets(plan)` 包含前台包名 → 进入判定
3. 存在该应用的 `UnblockSession`（临时解锁）→ 放行
4. 否则 → `showOverlay(pkg)`（SYSTEM_ALERT_WINDOW 全屏悬浮："深度专注中"+返回引导）

- 计划模型 `ShieldPlan { isActive, ShieldSettings = Allowlist | Blocklist, Schedule }`
  - **Allowlist 模式**：名单内可用（Forest 自己+白名单），种植期模式
  - **Blocklist 模式**：名单内屏蔽，Time Guard 模式
- 双数据源：`UsageStatsMonitor`（UsageStatsManager，PACKAGE_USAGE_STATS 权限）+ 无障碍事件，AlarmScheduler 定时 tick 校正
- ServiceLevel 体系：监测服务有可降级层级（无障碍不可用时退到 usagestats）

## 3. iOS（iPhone 17 Pro）对应的实现边界

- iOS 无等效无障碍事件 → PWA 首版拦截 = **引导用户开系统专注模式**（名单生成成可照配清单）+ Web 端 `visibilitychange` 监控 + 本地通知
- 未来原生版：Screen Time API（FamilyControls + DeviceActivityShieldConfiguration），申请 Family Controls 权限

## 4. 统计

- 时间线（TimelineActivity）、新统计页（NewStatisticsActivity）、标签（tag_colors 15 色）、成就（4h/3d/7d/15d/30d 总时长里程碑）、桌面 Widget ×4
- 区域对比数据 focus_info_2022.csv（"战胜全国 x% 专注者"类功能的数据源）

## 5. 后端

- API 网关：`https://c88fef96.forestapp.cc/api/v1`（与官网 real_trees 同 host）
- 认证：`https://auth.seekrtech.com`（seekrauth，含 web cookie 流程）
- FAQ/实验配置：faq.seekrtech.com、experiment-r2.seekrtech.com

## 复刻映射（PWA 先行版）

| Forest 机制 | PWA 实现 |
|---|---|
| 倒计时/正计时 + 10 分钟枯树规则 | `js/timer.js` 状态机，同规则 |
| 树生长/枯死动画 | `js/tree.js` Canvas 程序化分形树（原创美术） |
| ShieldPlan Allowlist | 名单编辑器 + iOS 专注模式引导卡片 |
| Overlay "深度专注中" | 全屏遮罩页（visibilitychange 触发） |
| 死因 GIVE_UP/KILL_APP | 离开超宽限=枯死；主动放弃=枯死 |
| 统计/标签/成就/森林 | `js/stats.js` + localStorage 日聚合 |
| 本地通知 | Notification API（iOS 16.4+ 需安装到主屏幕） |
