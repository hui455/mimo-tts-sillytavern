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

1. 打开 SillyTavern 的扩展面板，找到 `MiMo Advanced TTS`。
2. 填写 `MiMo API Key`。
3. 保持默认 Base URL：`https://api.xiaomimimo.com/v1`。
4. 按需设置独立播放音色、试音文本、DeepSeek 预处理和缓存。

独立消息播放按钮不依赖 SillyTavern 内置 `TTS` 扩展是否启用，也不受系统 TTS Provider、播放速率、队列等设置影响。`MiMo Advanced` 仍会注册成一个可选 TTS Provider，只有你想用酒馆原生 TTS 队列、voice map、`/speak` 时才需要在内置 TTS 里选择它。

## 使用

- 预置音色走 `mimo-v2.5-tts`，插件会把音色作为 `audio.voice` 传给 MiMo。
- 声音克隆走 `mimo-v2.5-tts-voiceclone`，插件会把上传的 wav/mp3 样本转成 `data:audio/...;base64,...` 后放进 `audio.voice`。
- 可选启用 `DeepSeek 朗读前预处理`：整条消息会完整交给 DeepSeek 处理一次，再把 DeepSeek 返回的完整文本直接交给 MiMo 合成。插件不会校验或拦截 DeepSeek 输出。
- DeepSeek 预处理支持两种 MiMo v2.5 控制模式：`音频标签控制` 会把标签写进 `assistant.content`；`自然语言控制` 会把表演说明写进 `user.content`，把朗读文本写进 `assistant.content`。
- 角色音色映射、单条消息朗读、自动朗读和 `/speak` 都使用 SillyTavern 内置 TTS 功能。
- 可选启用 `给每条助手消息添加独立播放按钮`：只给非用户消息加一个独立播放按钮，点击后临时预处理并播放该条消息，不进入 SillyTavern 内置 TTS 队列。
- 独立播放会自动缓存最近 5 条语音。缓存保存在浏览器 IndexedDB，命中缓存时不会重复请求 DeepSeek 或 MiMo；超过 5 条会自动删除最旧缓存。生成中显示旋转图标，生成成功后主按钮变成播放状态并在左侧显示下载按钮；播放中主按钮会变成暂停按钮。
- 朗读前会先过滤常见思考/推理内容，例如 `<think>...</think>`、`<thinking>...</thinking>`、`<reasoning>...</reasoning>`、`思考：...`、`推理过程：...`，再进入 DeepSeek 预处理或 MiMo 合成。
- 可以用 `试听当前独立播放音色` 测试当前音色，也可以在音色列表里点击单个音色旁边的 `试听`。试听会直接朗读当前 `试音文本`，不会走 DeepSeek 预处理，也不会复用消息缓存。
如果你的 SillyTavern 已经内置官方 `MiMo` Provider，可以继续保留它；本插件会显示为 `MiMo Advanced`，主要用于 DeepSeek 表演预处理和自定义风格预设。

## DeepSeek 预处理风格

预处理可以选择内置风格，也可以在 `自定义风格补充` 里继续追加要求。当前内置预设已特化为“女生对男生说话”的情侣语气，并会尽量减少干巴巴念台词的感觉，加入轻微停顿、笑意、呼吸、迟疑、尾音和潜台词情绪。内置预设包括：

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

自定义风格示例：

```text
女生对男朋友说话，不要像念台词；多一点临场感、轻微停顿、笑意和欲言又止的情绪，别太书面。
```

## 音频标签控制 / 风格示例

DeepSeek 预处理会把整条消息完整处理一次，可以在文本开头或句间插入括号标签，然后把完整结果直接交给 MiMo。常用标签示例：

```text
（笑）（轻笑）（大笑）（冷笑）（苦笑）
（抽泣）（呜咽）（哽咽）（嚎啕大哭）
（深呼吸）（急促呼吸）（咳嗽）（长叹一口气）（沉默片刻）
（小声）（轻声）（提高音量喊话）（语速加快）（语速放慢）
（东北话）（四川话）（河南话）（粤语）
（孙悟空）（林黛玉）（唱歌）
```

这些只是写法教程，不是音色；插件当前只保留预置音色和声音克隆。

整体风格标签建议放在最开头；唱歌用 `（唱歌）` 开头。方言和角色风格只作为 MiMo 的表达控制，不建议让 DeepSeek 大幅改写原对白。按官方文档，唱歌模式只适用于内置预置音色；声音克隆不支持唱歌模式，插件会提醒 DeepSeek 不要给克隆音色添加唱歌控制。

如果切换到 `自然语言控制`，DeepSeek 会输出给 MiMo 的 `user` 控制说明和 `assistant` 朗读文本。适合不想在朗读文本里出现大量括号标签时使用；它会用自然语言描述多风格切换、多情绪混合和细粒度节奏控制。

```text
（东北话）哎呀妈呀，这天儿也太冷了！
（四川话）莫慌嘛，慢慢说，事情总有办法噻。
（河南话）中，咱就这么办，别再磨叽了。
（粤语）呢件事真系唔简单，不过我撑你。
（孙悟空）呔！妖怪，哪里走！
（林黛玉）早知他来，我便不来了。
（唱歌）啦啦啦，今晚月色轻轻落下……
```

预处理输出示例：

```text
（紧张，深呼吸）呼……冷静，冷静。不就是一个面试吗……（语速加快，碎碎念）自我介绍已经背了五十遍了，应该没问题的。加油，你可以的……（小声）哎呀，领带歪没歪？
（极其疲惫，有气无力）师傅……到地方了叫我一声……（长叹一口气）我先眯一会儿，这班加得我魂儿都要散了。
如果我当时……（沉默片刻）哪怕再坚持一秒钟，结果是不是就不一样了？（苦笑）呵，没如果了。
（寒冷导致的急促呼吸）呼——呼——这、这大兴安岭的雪……（咳嗽）简直能把人骨头冻透了……别、别停下，走，快走。
（提高音量喊话）大姐！这鱼新鲜着呢！早上刚捞上来的！哎！那个谁，别乱翻，压坏了你赔啊？！
```

预处理结果只用于当前这次 TTS 请求，不会写回聊天记录，也不会修改页面上的原消息。调试日志里可以查看原文、DeepSeek 处理后的临时文本、缓存命中状态和使用的音色，方便调整预处理提示词。`保留心理活动和内心独白` 开启时，正文中的心理活动也会交给 DeepSeek 保留；`<think>`、reasoning 等系统推理块仍会先过滤。

独立播放缓存只保存生成后的音频，不保存到聊天记录或插件目录。清空浏览器站点数据、换浏览器、换设备或点击插件里的 `清空插件语音缓存` 都会移除这些缓存。

## 声音克隆

在 `新增声音克隆` 里填写显示名，上传 wav 或 mp3 样本后点击 `添加声音克隆`。添加后会出现在独立播放音色和 SillyTavern voice map 可选列表里，并支持列表内 `试听`、`编辑`、`删除`。样本会随扩展设置保存在浏览器/SillyTavern 设置中，建议使用较短音频；插件会拒绝 base64 超过 10MB 的样本。

本插件已移除文本设计音色，避免 voicedesign 模型影响朗读内容。升级后旧的设计音色会从可选列表移除；如果独立播放曾选中设计音色，会自动切回默认预置音色。已添加的声音克隆会保留。

## 注意

- API Key 会保存在 SillyTavern 的扩展设置里。只在你信任的本地环境使用，不要把带有 key 的设置分享给别人。
- 如果浏览器直接请求 MiMo 时遇到 CORS 错误，把 `Base URL` 改成你自己的本地代理地址，并让代理转发到 `https://api.xiaomimimo.com/v1`。
- `启用 MiMo 文本优化` 默认关闭。调试读法时建议先保持关闭，避免 MiMo 在合成前二次优化文本。

## 参考

- SillyTavern 官方扩展开发文档：<https://docs.sillytavern.app/for-contributors/writing-extensions/>
- SillyTavern 内置 TTS Provider：`public/scripts/extensions/tts`
- 示例第三方扩展：<https://github.com/city-unit/st-extension-example>
- MiMo V2.5 TTS 文档：<https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5>
