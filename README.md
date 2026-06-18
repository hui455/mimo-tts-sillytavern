# MiMo Advanced TTS for SillyTavern

这是一个 SillyTavern 第三方扩展，把小米 MiMo V2.5 TTS 注册为独立的 `MiMo Advanced` TTS Provider，避免和 SillyTavern 内置 `MiMo` Provider 同名冲突。

## 安装

推荐用 Git 安装，后续更新方便：

```powershell
cd path\to\SillyTavern\public\scripts\extensions\third-party
git clone <你的仓库地址> mimo-tts-sillytavern
```

本地测试时，也可以直接把整个 `mimo-tts-sillytavern` 文件夹复制到：

```text
SillyTavern/public/scripts/extensions/third-party/mimo-tts-sillytavern
```

然后重启 SillyTavern 或刷新浏览器页面。

## 配置

1. 打开 SillyTavern 的扩展面板，启用内置 `TTS` 扩展。
2. 在 TTS Provider 下拉里选择 `MiMo Advanced`。
3. 填写 `MiMo API Key`。
4. 保持默认 Base URL：`https://api.xiaomimimo.com/v1`。
5. 点击 TTS 的刷新按钮，让酒馆重新加载音色列表。

## 使用

- 预置音色走 `mimo-v2.5-tts`，插件会把音色作为 `audio.voice` 传给 MiMo。
- 音色设计走 `mimo-v2.5-tts-voicedesign`，插件会把设计提示词放在 `user` 消息里，把朗读文本放在 `assistant` 消息里。
- 可选启用 `DeepSeek 朗读前预处理`：先用 DeepSeek 去掉非对话内容，再把对白整理成带情绪、语速、停顿、呼吸、咳嗽、笑声等细粒度标注的 MiMo 朗读文本。
- 角色音色映射、单条消息朗读、自动朗读和 `/speak` 都使用 SillyTavern 内置 TTS 功能。
- 可选启用 `给每条助手消息添加独立播放按钮`：只给非用户消息加一个独立播放按钮，点击后临时预处理并播放该条消息，不进入 SillyTavern 内置 TTS 队列。

如果你的 SillyTavern 已经内置官方 `MiMo` Provider，可以继续保留它；本插件会显示为 `MiMo Advanced`，主要用于 DeepSeek 表演预处理和自定义风格预设。

## DeepSeek 预处理风格

预处理可以选择内置风格，也可以在 `自定义风格补充` 里继续追加要求。内置预设包括：

- 自然对白
- 亲密耳语
- 喜剧吐槽
- 疲惫低气压
- 紧张碎碎念
- 悲伤克制
- 寒冷急促
- 街头叫卖
- 战斗急促
- ASMR 轻声

自定义风格示例：

```text
更傲娇一点，句尾带一点不服气；亲密场景用更轻的气声；战斗场景不要夸张喊叫。
```

预处理输出示例：

```text
（紧张，深呼吸）呼……冷静，冷静。不就是一个面试吗……（语速加快，碎碎念）自我介绍已经背了五十遍了，应该没问题的。加油，你可以的……（小声）哎呀，领带歪没歪？
```

预处理结果只用于当前这次 TTS 请求，不会写回聊天记录，也不会修改页面上的原消息。

## 音色设计示例

```text
一位二十多岁的中文女声，声音清亮但不尖，语气温柔自然，像深夜电台主持人。语速稍慢，咬字清晰，带一点治愈感和亲近感。
```

```text
三十岁左右的男性中文旁白，声音低沉、有磁性但不夸张。语气沉稳可信，适合纪录片和科幻旁白，停顿自然。
```

添加后在酒馆的 TTS voice map 里把角色映射到这个设计音色即可。

## 注意

- API Key 会保存在 SillyTavern 的扩展设置里。只在你信任的本地环境使用，不要把带有 key 的设置分享给别人。
- 如果浏览器直接请求 MiMo 时遇到 CORS 错误，把 `Base URL` 改成你自己的本地代理地址，并让代理转发到 `https://api.xiaomimimo.com/v1`。
- 插件当前实现的是文本转语音和文字音色设计；音频样本克隆没有接入。

## 参考

- SillyTavern 官方扩展开发文档：<https://docs.sillytavern.app/for-contributors/writing-extensions/>
- SillyTavern 内置 TTS Provider：`public/scripts/extensions/tts`
- 示例第三方扩展：<https://github.com/city-unit/st-extension-example>
- MiMo V2.5 TTS 文档：<https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5>
