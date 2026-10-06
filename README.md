# KiteMC

KiteMC 官网与双语文档，使用 Mintlify。中文为默认语言，英文内容位于 `en/`。

[官网](https://www.kitemc.com) · [English](https://www.kitemc.com/en) · [许可证中心](https://license.kitemc.com/) · [GitHub](https://github.com/KiteMC/)

## 内容

- **ArcPass**：通行证、任务、奖励、赛季与开发接口。
- **KiteMarket**：交易、钱包、配置、运维、ItemsAdder 接入和公开 SDK。
- **VerifyMC**：已停止维护的历史文档及已有版本下载。

运行 JAR、SDK、示例和语言／配置包由各产品的 GitHub Releases 承载。SDK 的 GitHub Packages 认证与坐标见对应开发文档；浏览器下载组件只读取公开 Releases，不使用访问令牌。

## 本地开发

使用 Node.js 20.17 或更高版本及 Mintlify CLI：

```sh
npm install -g mint
mint dev --no-open
```

在包含 `docs.json` 的仓库根目录执行命令。默认预览地址为 `http://localhost:3000`。

提交前执行：

```sh
mint validate
node tools/check-site.mjs
node tools/generate-sitemap.mjs --check
node tools/test-downloads.mjs
mint broken-links --check-anchors --check-redirects
```

CI 在 Linux 上执行上述检查。固定的 CLI 版本在 Windows 下可能把路径分隔符差异误报为破链；请结合静态检查与浏览器结果判断，不要将站内 URL 改成反斜杠路径。

## 文件结构

| 路径 | 用途 |
| --- | --- |
| `docs.json` | 语言、导航、外观和逐页重定向 |
| `index.mdx`、`en.mdx` | 两种语言的团队首页 |
| `arcpass/`、`kitemarket/` | 当前产品文档 |
| `archive/verifymc/` | VerifyMC 历史文档 |
| `snippets/` | 共用组件，包括下载和截图占位 |
| `images/` | 产品图标与实际引用的媒体 |
| `migration/routes.json`、`migration/anchors.json` | 旧路径和标题 ID 的兼容清单 |
| `content-pages.json` | 新增专题页与中英文对应清单 |
| `sitemap.xml` | 规范地址及中英文页面的语言关联 |
| `styles.css` | 正文留白、首页和共享组件的补充样式 |
| `tools/` | 内容、链接与下载行为检查工具 |

产品首页为同名 MDX 文件，例如 `arcpass.mdx`；目录入口使用扁平路由，例如 `arcpass/guide.mdx` 对应 `/arcpass/guide`。

## 内容维护

中文和英文页面使用相同目录结构。更新页面时同步另一语言，保留既有标题 ID，并更新站内链接。`docs.json` 中的旧地址重定向指向对应页面，不统一跳到首页。

KiteMarket 的交易、配置与开发内容按专题分开，原有入口页提供导读卡片。新增页面登记到 `content-pages.json`，并加入 `docs.json` 的对应语言导航；既有迁移映射继续保留。

调整 `migration/routes.json` 或 `content-pages.json` 后运行 `node tools/generate-sitemap.mjs`，更新中英文规范地址及互相对应的 `hreflang`。媒体按原始字节保留；替换图片后同步 `migration/media.json` 中的大小和 SHA-256。

KiteMarket 中英文页面共用 `images/kitemarket/screenshot-*.png`。已有首页、竞拍市场、高级条件、供货、钱包、发布条款、领取入口、待领物品及交易收据九张实机截图；竞拍最终确认仍使用 `screenshot-auction-confirm.png` 空位。按实际页面内容命名，不把市场列表的物品提示当作确认页。添加或替换截图时同步媒体摘要，缺图时保留带说明的空框。

VerifyMC 页面应保留停止维护提示。只陈述实际功能及验证范围，不把版本目标或启动检查写成完整兼容认证。

## 发布

`main` 是 Mintlify 部署分支。通过分支和 Pull Request 完成修改，检查通过后合并；合并会触发站点部署。项目记忆、凭据及 `codex-work/` 中的本地工作产物不进入公开仓库。

---

## English

This repository publishes the KiteMC website and bilingual documentation with Mintlify. Chinese is the default language; translated pages live in `en/`. ArcPass and KiteMarket are current products. VerifyMC documentation is retained as a discontinued archive.

Install Node.js 20.17 or later and the `mint` CLI, then run `mint dev --no-open` from the repository root. Before submitting a pull request, run the validation commands above. `main` deploys through Mintlify.

Keep translated pages paired, preserve heading IDs, and maintain exact redirects for published URLs. Runtime plugins, SDKs, examples and configuration packs are hosted on GitHub. Download components use public Releases without browser tokens.

KiteMarket trading, configuration and developer guides are organized into focused pages. Overview pages link to each topic. Register new pages in `content-pages.json` and the matching language navigation, then regenerate `sitemap.xml`. Keep existing migration routes and heading IDs intact.

Chinese and English KiteMarket pages share nine real screenshots for home, auction listings, advanced conditions, fulfillment, wallet, sale terms, the claims entrance, claimable items and receipts. Final bid confirmation remains a labeled placeholder. Name screenshots for the actual screen they show, update media digests when adding or replacing files, and preserve placeholders for missing images. Do not substitute artificial gameplay images or broaden compatibility claims beyond their evidence.
