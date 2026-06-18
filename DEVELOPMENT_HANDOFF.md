# MiMo Advanced TTS 开发交接记录

更新时间：2026-06-19

## 项目位置

- 本地仓库：`E:\voice\mimo-tts-sillytavern`
- GitHub：`https://github.com/hui455/mimo-tts-sillytavern.git`
- SillyTavern 安装目录通常应放到：`SillyTavern/public/scripts/extensions/third-party/mimo-tts-sillytavern`

## 当前目标

这是一个 SillyTavern 第三方扩展，把小米 MiMo V2.5 TTS 作为独立扩展使用，显示名为 `MiMo Advanced TTS`，避免和 SillyTavern 内置官方 `MiMo` Provider 冲突。

核心需求：

- 给每条非 user 消息添加独立播放按钮。
- 不依赖 SillyTavern 系统 TTS 设置，系统 TTS Provider/语速/队列设置不应影响独立播放。
- DeepSeek 可在朗读前预处理整条消息，一次处理完整文本，不按人物/段落拆分。
- DeepSeek 预处理只临时用于本次 TTS，不修改原聊天消息。
- 生成音频由插件浏览器 IndexedDB 缓存，默认最近 20 条。
- 当前只保留 MiMo 预置音色和声音克隆，已移除文本设计音色。

## 主要文件

- `index.js`：插件全部主要逻辑。
- `style.css`：独立按钮、下载按钮、列表、上传控件样式。
- `README.md`：安装和使用说明。
- `manifest.json`：SillyTavern 扩展 manifest。

## MiMo v2.5 文档要点

官方文档已完整核对：

- 文档 URL：`https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5`
- 静态 Markdown 源：`https://mimo.mi.com/static/docs/quick-start/usage-guide/audio/speech-synthesis-v2.5.md`

关键规则：

- 目标合成文本必须放在 `messages` 中 `role: assistant` 的 `content`。
- `role: user` 的 `content` 可放自然语言控制说明，不会被合成为语音。
- 自然语言控制：放在 `role: user.content`。
- 音频标签控制：直接嵌入 `role: assistant.content`。
- `mimo-v2.5-tts` 支持内置音色和唱歌模式。
- `mimo-v2.5-tts-voiceclone` 支持声音克隆和风格控制，但官方文档说明不支持唱歌模式。
- `mimo-v2.5-tts-voicedesign` 是文本设计音色模型，但本插件已移除该支持，因为实际使用中容易影响朗读内容。

## 当前功能状态

### 独立消息播放

- 只给 assistant/非 user 消息加播放按钮。
- 按钮状态：
  - 初始：喇叭图标。
  - 生成中：旋转加载图标。
  - 生成成功：播放图标。
  - 播放中：暂停图标。
  - 暂停后：继续播放图标。
- 生成成功后，主按钮左侧会出现下载按钮。
- 同一条消息生成后再次点击会复用按钮内存里的音频，不重新请求 DeepSeek/MiMo。
- 刷新页面后靠 IndexedDB 缓存命中。

### DeepSeek 预处理

- 设置项：`DeepSeek 朗读前预处理`。
- 会先过滤常见 reasoning/thinking 块，再把完整消息交给 DeepSeek。
- 不再进行“疑似改写对白”校验；DeepSeek 非空输出会直接放行。
- 预处理结果不写回聊天记录，只用于本次 MiMo 请求。
- 调试日志会显示：
  - 原文
  - 控制模式
  - MiMo `user` 控制内容
  - MiMo `assistant` 文本
  - 缓存命中
  - 音色信息

### MiMo 控制模式

设置项：`MiMo 控制模式`

- `音频标签控制`
  - DeepSeek 输出最终 `assistant.content`。
  - 标签直接写入朗读文本，如 `（小声）`、`（轻笑）`、`（语速放慢）`。
- `自然语言控制`
  - DeepSeek 输出 JSON：
    - `instruction`：放入 MiMo `role:user.content`
    - `text`：放入 MiMo `role:assistant.content`
  - 适合不希望朗读文本里有大量括号标签的情况。

### 情侣语气特化

当前 DeepSeek 预处理已特化为“女生对男朋友说话”的情侣语气。

包括两层：

- 下拉预设已改为情侣场景：
  - 恋人日常
  - 贴近耳语
  - 傲娇嘴硬
  - 疲惫依赖
  - 害羞碎碎念
  - 委屈吃醋
  - 撒娇求哄
  - 调皮撩拨
  - 认真告白
  - 和好安慰
- DeepSeek 系统提示里额外追加 `关系语气特化`，即使用户本地保存了旧预处理提示词，也会强制追加：
  - 女生对男朋友说话
  - 亲近、自然、有生活感
  - 减少干巴巴念台词
  - 加轻微停顿、笑意、呼吸、迟疑、尾音变化、欲言又止、潜台词情绪
  - 不改变原对白内容，不把男生口吻硬改成女生口吻

### 音色

当前保留：

- 预置音色：`mimo-v2.5-tts`
- 声音克隆：`mimo-v2.5-tts-voiceclone`

已移除：

- 文本设计音色 UI
- `mimo-v2.5-tts-voicedesign`
- `design:` 音色分支
- 设计音色默认列表

声音克隆：

- 支持 wav/mp3 上传。
- 音频保存为 `data:{MIME_TYPE};base64,...`。
- base64 超过 10MB 会拒绝。
- 克隆音色列表支持 `试听`、`编辑`、`删除`。
- 克隆不支持唱歌模式，DeepSeek 会被提示不要给克隆音色添加 `（唱歌）` / `sing` / `singing`。

## 缓存

- 使用浏览器 IndexedDB：`mimo-advanced-tts-cache`
- object store：`audio`
- 默认缓存最近 20 条，由 `independentCacheLimit` 控制。
- 缓存 key 当前版本：`version: 16`
- 缓存 key 包含：
  - 输入文本
  - 预处理后的 speech 对象
  - 音色
  - Base URL
  - 模型
  - 格式
  - MiMo 文本优化
  - DeepSeek 模型/温度/控制模式/风格等

## 重要行为约束

- 不要恢复 dual-speaker/第二人音色逻辑；已经明确删除。
- 不要把 DeepSeek 预处理按段落或按人物拆分；应整条消息完整处理一次。
- 不要让 DeepSeek 预处理写回原消息。
- 不要让系统 TTS 设置影响独立播放。
- 不要重新加入文本设计音色，除非用户明确改变需求。
- 如果改动会影响生成音频，记得升级 `buildAudioCacheKey()` 里的 `version`。
- UI 文案尽量中文。

## 最近关键提交

- `1389444 Fix extension drawer toggle race`
  - 修复扩展面板第一次点击立刻折叠的问题。
- `7dc7826 Specialize DeepSeek romance presets`
  - DeepSeek 预设特化为女生对男朋友的情侣语气。
- `7b68305 Respect MiMo clone singing limitations`
  - 按官方文档限制克隆音色不能唱歌。
- `0537458 Add MiMo v2.5 control mode switching`
  - 增加自然语言控制/音频标签控制切换。
- `7217d29 Remove voice design support`
  - 移除文本设计音色，只保留预置和克隆。
- `97f7910 Improve independent playback controls`
  - 播放/暂停/下载按钮状态优化。

## 验证命令

常用本地检查：

```powershell
cd E:\voice\mimo-tts-sillytavern
node --check index.js
Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null; 'manifest ok'
git diff --check
```

推送：

```powershell
git status --short
git add index.js style.css README.md DEVELOPMENT_HANDOFF.md
git commit -m "..."
git push origin main
```

## 后续可能继续做的点

- 给 DeepSeek 预处理增加“测试预处理”按钮，只调用 DeepSeek 不调用 MiMo。
- 给调试日志增加复制按钮。
- 给每条消息的下载文件名加入角色名/时间。
- 给缓存列表做可视化管理，而不只是清空全部缓存。
- 为自然语言控制模式增加更明确的 JSON 解析错误提示。
