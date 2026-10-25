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

`index.html` 就是插件面板本身的可交互演示（与抖音内打开的面板同一套 UI 与样式）。
页面按钮组里新增了一个 **越狱源** 按钮，它是一条真实链接，指向
`sileo://source/https://h7ang0.github.io/taozi/`，
iPhone 上点一下就会打开 Sileo 并预填源地址。

页面已做手机端适配：一屏内显示标题、按钮组与手机模型，插件面板内部自行滚动，
不需要缩放浏览器。

## 目录结构

```
index.html          首页（插件面板演示，含「添加越狱源」一键跳转）
Packages            apt 索引，每个环境一段
Packages.gz         索引压缩包
Release             扁平源元数据
debs/               三个 deb 包
```

这是一个扁平源（flat repo），`Release` 与 `Packages` 都在仓库根目录，Sileo 添加
普通 URL 时正是按 `Suites: ./` 来取这两个文件。

## 本地校验

```sh
sha256sum debs/*.deb          # 与 Packages 中的 SHA256 对照
gzip -dc Packages.gz | diff - Packages
```

## ©小桃子 2026
