# ThemeDuo 越狱源

抖音主题插件 ThemeDuo 的官方 APT 源，通过 GitHub Pages 发布。

**源地址：`https://h7ang0.github.io/taozi/`**

## 添加方法

### 插件内一键添加

ThemeDuo 0.0.2-beta 的面板里新增了「越狱源」分区，点击「添加越狱源」会直接打开 Sileo
的「添加源」弹窗并把源地址预填好，确认即可。

### 手动添加

1. 打开 Sileo →「软件源」→ 右上角 **+**
2. 粘贴 `https://h7ang0.github.io/taozi/`
3. 点「添加源」
4. 切到「搜索」，搜 `ThemeDuo`，按自己的越狱环境选对应版本安装

源未做 GPG 签名，Sileo 首次添加会提示一次「未签名」，选择继续即可。

## 源内三个包

三个包功能完全一致，只按越狱环境区分注入目录与架构标签。

| 包名 | 显示名 | 架构 | 注入目录 |
|---|---|---|---|
| `com.xiaotaozi.themeduo` | ThemeDuo | `iphoneos-arm64` | `/var/jb/Library/MobileSubstrate/DynamicLibraries` |
| `com.xiaotaozi.themeduo.rootful` | ThemeDuo 有根版 | `iphoneos-arm` | `/Library/MobileSubstrate/DynamicLibraries` |
| `com.xiaotaozi.themeduo.roothide` | ThemeDuo 隐根版 | `iphoneos-arm64e` | bootstrap 相对根 `/Library/MobileSubstrate/DynamicLibraries` |

全部只注入抖音 `com.ss.iphone.ugc.Aweme`，依赖 `firmware (>= 15.0)` 与
`mobilesubstrate (>= 0.9.5000)`。

### 从 0.0.1-beta 升级

0.0.1-beta 三个包用的是同一个 Debian 包名 `com.xiaotaozi.themeduo`。0.0.2-beta 起
无根版保留原包名（可原地升级），有根版与隐根版改用带后缀的包名。

已经手动装过 0.0.1-beta **有根／隐根**包的用户，请先在包管理器里移除旧的
`com.xiaotaozi.themeduo`，再从本源安装对应版本，避免两套同时注入。

## 首页

`index.html` 就是越狱源页：**头像 · 名称 · 一键添加到 Sileo · 插件列表 · 更新日志**。
：**头像 · 名称 · 一键添加到 Sileo · 插件列表 · 更新日志**。
「一键添加到 Sileo」是一条真实链接，指向
`sileo://source/https://h7ang0.github.io/taozi/`，
iPhone 上点一下就会打开 Sileo 并预填源地址。
插件列表直接从已发布的 `Packages` 索引生成，和 Sileo 实际能装到的包一致。

页面已做手机端适配：一屏内显示标题、按钮组与手机模型，插件面板内部自行滚动，
不需要缩放浏览器。

## 目录结构

```
index.html          首页（越狱源页：头像/名称/一键跳转/插件列表/更新日志）
Packages            apt 索引，每个环境一段
Packages.gz         索引压缩包
Release             扁平源元数据
debs/               三个 deb 包
dylib/              手动安装用的 ThemeDuo.dylib（index.json 为清单）
```

这是一个扁平源（flat repo），`Release` 与 `Packages` 都在仓库根目录，Sileo 添加
普通 URL 时正是按 `Suites: ./` 来取这两个文件。

## 本地校验

```sh
sha256sum debs/*.deb          # 与 Packages 中的 SHA256 对照
gzip -dc Packages.gz | diff - Packages
```

## ©小桃子 2026

## 更新日志

`changelog.json` 是更新日志的唯一数据源，首页的「更新日志」区块会直接读它。
本机上的发布台（`ni/release-console/index.html`，不入库）提交时会自动带上这个文件。

## 本地发布台

`ni/release-console/index.html` 是放在本机、**不入仓库**的发布台：填 PAT → 选 .deb → 写更新日志 → 一次提交。
它直接从 .deb 里读出包名 / 版本 / 架构 / 依赖，生成 `Packages`、`Packages.gz`、`Release`
和 `changelog.json`；还能上传 `.dylib` 到 `dylib/`（同时写 `dylib/index.json` 供首页列出来）。
最后通过 Git Data API 做成一个提交，旧版本 deb 与旧动态库会被自动移除。
Bootstrap 与图标都在本地，离线也能打开。
