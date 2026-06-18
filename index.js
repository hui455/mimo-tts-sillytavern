import { registerTtsProvider, saveTtsProviderSettings, getPreviewString, initVoiceMap } from '../tts/index.js';

class MimoTtsProvider {
    settings;
    voices = [];
    separator = '。';
    audioElement = document.createElement('audio');

    defaultSettings = {
        apiKey: '',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        presetModel: 'mimo-v2.5-tts',
        voiceDesignModel: 'mimo-v2.5-tts-voicedesign',
        format: 'wav',
        optimizeTextPreview: true,
        instruction: '自然、清晰、口语化，情绪贴合文本内容。',
        preprocessEnabled: false,
        preprocessApiKey: '',
        preprocessBaseUrl: 'https://api.deepseek.com',
        preprocessModel: 'deepseek-chat',
        preprocessTemperature: 0.2,
        preprocessFallbackToOriginal: true,
        preprocessStyle: 'natural-dialogue',
        preprocessCustomStyle: '',
        preprocessPrompt: `你是 SillyTavern 角色对白的 TTS 表演脚本整理器。你的任务是把输入段落改写成适合 MiMo TTS 朗读的中文表演文本。

规则：
1. 只输出最终要朗读的文本，不要解释，不要 Markdown，不要 JSON。
2. 去除非对话内容：旁白、动作描写、场景描写、系统提示、玩家指令、表情包、URL、代码块、角色名标签、楼层信息、括号里的纯动作说明。
3. 保留真正应该被听见的对白、内心独白、喊话、低语、吐槽和拟声词。
4. 可以把必要的表演指导改写成中文括号标注，放在对应句子前，例如：（紧张，深呼吸）（小声）（压低声音）（放声大笑）（苦笑）（咳嗽）（长叹一口气）（停顿片刻）（语速加快）（语速放慢）（提高音量喊话）。
5. 细粒度控制语气、情绪、音量、语速、停顿和呼吸，但不要每句话都堆满标注。每 1 到 3 句最多插入 1 个关键标注。
6. 对省略号、破折号、短句和换行做节奏处理，让文本自然可念。不要改变角色本意，不要扩写剧情。
7. 如果没有任何可朗读对白，只输出：<EMPTY>。

风格样例：
（紧张，深呼吸）呼……冷静，冷静。不就是一个面试吗……（语速加快，碎碎念）自我介绍已经背了五十遍了，应该没问题的。加油，你可以的……（小声）哎呀，领带歪没歪？
（极其疲惫，有气无力）师傅……到地方了叫我一声……（长叹一口气）我先眯一会儿，这班加得我魂儿都要散了。
如果我当时……（沉默片刻）哪怕再坚持一秒钟，结果是不是就不一样了？（苦笑）呵，没如果了。
（寒冷导致的急促呼吸）呼——呼——这、这大兴安岭的雪……（咳嗽）简直能把人骨头冻透了……别、别停下，走，快走。
（提高音量喊话）大姐！这鱼新鲜着呢！早上刚捞上来的！哎！那个谁，别乱翻，压坏了你赔啊？！`,
        voiceMap: {},
        presetVoices: [
            { name: '冰糖', voice_id: 'preset:冰糖', lang: 'zh-CN' },
            { name: '茉莉', voice_id: 'preset:茉莉', lang: 'zh-CN' },
            { name: '苏打', voice_id: 'preset:苏打', lang: 'zh-CN' },
            { name: 'Chloe', voice_id: 'preset:Chloe', lang: 'zh-CN' },
        ],
        designedVoices: [
            {
                name: '设计音色-温柔女声',
                voice_id: 'design:soft-female',
                lang: 'zh-CN',
                prompt: '一位二十多岁的中文女声，声音清亮但不尖，语气温柔自然，像深夜电台主持人。语速稍慢，咬字清晰，带一点治愈感和亲近感。',
            },
        ],
        preprocessStylePresets: [
            {
                id: 'natural-dialogue',
                name: '自然对白',
                prompt: '像真人聊天一样自然，标注从少但精准。优先保留角色原本语气，让停顿和轻微情绪自然出现。',
            },
            {
                id: 'intimate-whisper',
                name: '亲密耳语',
                prompt: '整体压低音量，贴近耳边说话，语速偏慢，气息感明显。适合温柔、暧昧、安抚或秘密交流，常用（小声）（压低声音）（轻声）（停顿片刻）（浅浅吸气）。',
            },
            {
                id: 'comic-snark',
                name: '喜剧吐槽',
                prompt: '节奏灵活，吐槽感强，适当加入短促停顿、无奈笑、阴阳怪气的小情绪。常用（小声吐槽）（憋笑）（无奈）（语速加快）（夸张地停顿）。',
            },
            {
                id: 'exhausted-low',
                name: '疲惫低气压',
                prompt: '声音有气无力，语速偏慢，句尾下坠，呼吸拖长。适合加班、受伤、困倦或情绪耗尽。常用（极其疲惫）（有气无力）（长叹一口气）（低声）（停顿片刻）。',
            },
            {
                id: 'nervous-mutter',
                name: '紧张碎碎念',
                prompt: '紧张、呼吸明显、话语变碎，语速会在自我安慰或慌乱处加快。常用（紧张，深呼吸）（语速加快，碎碎念）（小声）（咽了咽口水）（停顿片刻）。',
            },
            {
                id: 'restrained-sad',
                name: '悲伤克制',
                prompt: '情绪压住不爆发，停顿长，苦笑和轻声自嘲可以出现。避免哭腔过度。常用（沉默片刻）（苦笑）（声音发紧）（轻声）（停顿很久）。',
            },
            {
                id: 'cold-breathless',
                name: '寒冷急促',
                prompt: '寒冷导致呼吸急促，句子断裂，偶尔咳嗽或牙关打颤。常用（寒冷导致的急促呼吸）（咳嗽）（牙关打颤）（呼——呼——）（别停下）。',
            },
            {
                id: 'market-shout',
                name: '街头叫卖',
                prompt: '音量高，节奏快，有现场感和招呼人的劲儿。适合吆喝、喊话、争执。常用（提高音量喊话）（语速加快）（招呼客人）（不耐烦）（拉长尾音）。',
            },
            {
                id: 'combat-urgent',
                name: '战斗急促',
                prompt: '短句、命令式、呼吸急，重点字更用力。适合追逐、战斗、危险提醒。常用（急促）（压低声音）（提高音量）（喘息）（立刻打断）。',
            },
            {
                id: 'asmr-soft',
                name: 'ASMR 轻声',
                prompt: '声音很轻、贴近、慢速，停顿细腻，避免突然大音量。适合睡前、照顾、耳语。常用（轻声）（放慢语速）（浅浅呼吸）（停顿片刻）（温柔地）。',
            },
        ],
    };

    get settingsHtml() {
        return `
        <div class="mimo-tts-provider-settings">
            <div class="tts_block">
                <label for="mimo_tts_api_key">MiMo API Key</label>
                <input id="mimo_tts_api_key" type="password" class="text_pole" autocomplete="off" placeholder="从 MiMo Console 获取">
            </div>
            <div class="tts_block">
                <label for="mimo_tts_base_url">Base URL</label>
                <input id="mimo_tts_base_url" type="text" class="text_pole" maxlength="500">
            </div>
            <div class="tts_block">
                <label for="mimo_tts_preset_model">预置音色模型</label>
                <input id="mimo_tts_preset_model" type="text" class="text_pole">
            </div>
            <div class="tts_block">
                <label for="mimo_tts_voice_design_model">音色设计模型</label>
                <input id="mimo_tts_voice_design_model" type="text" class="text_pole">
            </div>
            <div class="tts_block">
                <label for="mimo_tts_instruction">朗读控制提示词</label>
                <textarea id="mimo_tts_instruction" class="text_pole" rows="3"></textarea>
            </div>
            <div class="tts_block">
                <label for="mimo_tts_format">音频格式</label>
                <select id="mimo_tts_format" class="text_pole">
                    <option value="wav">wav</option>
                    <option value="mp3">mp3</option>
                </select>
            </div>
            <div class="tts_block">
                <label>
                    <input id="mimo_tts_optimize_text_preview" type="checkbox">
                    optimize_text_preview
                </label>
            </div>
            <hr>
            <div class="tts_block flexFlowColumn">
                <h4>DeepSeek 朗读前预处理</h4>
                <label>
                    <input id="mimo_tts_preprocess_enabled" type="checkbox">
                    启用 DeepSeek 预处理
                </label>
                <label for="mimo_tts_preprocess_api_key">DeepSeek API Key</label>
                <input id="mimo_tts_preprocess_api_key" type="password" class="text_pole" autocomplete="off" placeholder="用于改写朗读文本">
                <label for="mimo_tts_preprocess_base_url">DeepSeek Base URL</label>
                <input id="mimo_tts_preprocess_base_url" type="text" class="text_pole" maxlength="500">
                <label for="mimo_tts_preprocess_model">DeepSeek 模型</label>
                <input id="mimo_tts_preprocess_model" type="text" class="text_pole">
                <label for="mimo_tts_preprocess_temperature">Temperature: <span id="mimo_tts_preprocess_temperature_output"></span></label>
                <input id="mimo_tts_preprocess_temperature" type="range" min="0" max="1" step="0.05">
                <label for="mimo_tts_preprocess_style">表演风格预设</label>
                <select id="mimo_tts_preprocess_style" class="text_pole"></select>
                <label for="mimo_tts_preprocess_custom_style">自定义风格补充</label>
                <textarea id="mimo_tts_preprocess_custom_style" class="text_pole" rows="4" placeholder="例如：更傲娇一点，句尾带一点不服气；亲密场景用更轻的气声；战斗场景不要夸张喊叫。"></textarea>
                <label>
                    <input id="mimo_tts_preprocess_fallback" type="checkbox">
                    预处理失败时回退原文
                </label>
                <label for="mimo_tts_preprocess_prompt">预处理提示词</label>
                <textarea id="mimo_tts_preprocess_prompt" class="text_pole" rows="12"></textarea>
            </div>
            <hr>
            <div class="tts_block flexFlowColumn">
                <h4>新增预置音色</h4>
                <input id="mimo_tts_preset_voice_name" type="text" class="text_pole" placeholder="显示名，例如：冰糖">
                <input id="mimo_tts_preset_voice_id" type="text" class="text_pole" placeholder="MiMo voice，例如：冰糖">
                <input id="mimo_tts_add_preset_voice" type="button" class="menu_button" value="添加预置音色">
                <div id="mimo_tts_preset_voice_list" class="mimo-tts-list"></div>
            </div>
            <hr>
            <div class="tts_block flexFlowColumn">
                <h4>新增音色设计</h4>
                <input id="mimo_tts_design_voice_name" type="text" class="text_pole" placeholder="显示名，例如：温柔姐姐">
                <textarea id="mimo_tts_design_voice_prompt" class="text_pole" rows="4" placeholder="描述性别年龄、声音质感、情绪语气、语速节奏、场景人设"></textarea>
                <input id="mimo_tts_add_design_voice" type="button" class="menu_button" value="添加设计音色">
                <div id="mimo_tts_design_voice_list" class="mimo-tts-list"></div>
            </div>
        </div>
        `;
    }

    async loadSettings(settings) {
        this.settings = structuredClone(this.defaultSettings);

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            }
        }

        this.normalizeVoiceIds();

        $('#mimo_tts_api_key').val(this.settings.apiKey);
        $('#mimo_tts_base_url').val(this.settings.baseUrl);
        $('#mimo_tts_preset_model').val(this.settings.presetModel);
        $('#mimo_tts_voice_design_model').val(this.settings.voiceDesignModel);
        $('#mimo_tts_instruction').val(this.settings.instruction);
        $('#mimo_tts_format').val(this.settings.format);
        $('#mimo_tts_optimize_text_preview').prop('checked', Boolean(this.settings.optimizeTextPreview));
        $('#mimo_tts_preprocess_enabled').prop('checked', Boolean(this.settings.preprocessEnabled));
        $('#mimo_tts_preprocess_api_key').val(this.settings.preprocessApiKey);
        $('#mimo_tts_preprocess_base_url').val(this.settings.preprocessBaseUrl);
        $('#mimo_tts_preprocess_model').val(this.settings.preprocessModel);
        $('#mimo_tts_preprocess_temperature').val(this.settings.preprocessTemperature);
        $('#mimo_tts_preprocess_temperature_output').text(Number(this.settings.preprocessTemperature).toFixed(2));
        this.renderStylePresetSelect();
        $('#mimo_tts_preprocess_style').val(this.settings.preprocessStyle);
        $('#mimo_tts_preprocess_custom_style').val(this.settings.preprocessCustomStyle);
        $('#mimo_tts_preprocess_fallback').prop('checked', Boolean(this.settings.preprocessFallbackToOriginal));
        $('#mimo_tts_preprocess_prompt').val(this.settings.preprocessPrompt);

        $('#mimo_tts_api_key, #mimo_tts_base_url, #mimo_tts_preset_model, #mimo_tts_voice_design_model, #mimo_tts_instruction').on('input', () => this.onSettingsChange());
        $('#mimo_tts_preprocess_api_key, #mimo_tts_preprocess_base_url, #mimo_tts_preprocess_model, #mimo_tts_preprocess_prompt').on('input', () => this.onSettingsChange());
        $('#mimo_tts_preprocess_custom_style').on('input', () => this.onSettingsChange());
        $('#mimo_tts_preprocess_temperature').on('input', () => this.onSettingsChange());
        $('#mimo_tts_format, #mimo_tts_optimize_text_preview, #mimo_tts_preprocess_enabled, #mimo_tts_preprocess_fallback, #mimo_tts_preprocess_style').on('change', () => this.onSettingsChange());
        $('#mimo_tts_add_preset_voice').on('click', () => this.addPresetVoice());
        $('#mimo_tts_add_design_voice').on('click', () => this.addDesignedVoice());

        this.renderVoiceLists();
        await this.checkReady();
        console.debug('MiMo TTS: settings loaded');
    }

    dispose() {
        this.audioElement.pause();
    }

    onSettingsChange() {
        this.settings.apiKey = String($('#mimo_tts_api_key').val() || '').trim();
        this.settings.baseUrl = String($('#mimo_tts_base_url').val() || '').trim();
        this.settings.presetModel = String($('#mimo_tts_preset_model').val() || '').trim();
        this.settings.voiceDesignModel = String($('#mimo_tts_voice_design_model').val() || '').trim();
        this.settings.instruction = String($('#mimo_tts_instruction').val() || '').trim();
        this.settings.format = String($('#mimo_tts_format').val() || 'wav');
        this.settings.optimizeTextPreview = Boolean($('#mimo_tts_optimize_text_preview').is(':checked'));
        this.settings.preprocessEnabled = Boolean($('#mimo_tts_preprocess_enabled').is(':checked'));
        this.settings.preprocessApiKey = String($('#mimo_tts_preprocess_api_key').val() || '').trim();
        this.settings.preprocessBaseUrl = String($('#mimo_tts_preprocess_base_url').val() || '').trim();
        this.settings.preprocessModel = String($('#mimo_tts_preprocess_model').val() || '').trim();
        this.settings.preprocessTemperature = Number($('#mimo_tts_preprocess_temperature').val() || 0.2);
        this.settings.preprocessStyle = String($('#mimo_tts_preprocess_style').val() || 'natural-dialogue');
        this.settings.preprocessCustomStyle = String($('#mimo_tts_preprocess_custom_style').val() || '').trim();
        this.settings.preprocessFallbackToOriginal = Boolean($('#mimo_tts_preprocess_fallback').is(':checked'));
        this.settings.preprocessPrompt = String($('#mimo_tts_preprocess_prompt').val() || '').trim();
        $('#mimo_tts_preprocess_temperature_output').text(Number(this.settings.preprocessTemperature).toFixed(2));
        saveTtsProviderSettings();
    }

    async checkReady() {
        if (!this.settings.apiKey) {
            throw new Error('MiMo API Key is required.');
        }

        if (this.settings.preprocessEnabled && !this.settings.preprocessApiKey) {
            throw new Error('DeepSeek API Key is required when preprocessing is enabled.');
        }

        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        this.voices = await this.fetchTtsVoiceObjects();
        await initVoiceMap();
        toastr.success('MiMo TTS voices refreshed');
    }

    async fetchTtsVoiceObjects() {
        this.normalizeVoiceIds();
        return [...this.settings.presetVoices, ...this.settings.designedVoices];
    }

    async getVoice(voiceName) {
        const voices = await this.fetchTtsVoiceObjects();
        const match = voices.find((voice) => voice.name === voiceName || voice.voice_id === voiceName);

        if (!match) {
            throw new Error(`MiMo TTS voice not found: ${voiceName}`);
        }

        return match;
    }

    async generateTts(text, voiceId) {
        const voice = await this.getVoice(voiceId);
        const preparedText = await this.preprocessText(text, voice);
        return this.fetchTtsGeneration(preparedText, voice);
    }

    async previewTtsVoice(voiceId) {
        const voice = await this.getVoice(voiceId);
        const response = await this.fetchTtsGeneration(getPreviewString(voice.lang || 'zh-CN'), voice);
        const audio = await response.blob();
        const url = URL.createObjectURL(audio);

        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.src = url;
        this.audioElement.onended = () => URL.revokeObjectURL(url);
        this.audioElement.onerror = () => {
            URL.revokeObjectURL(url);
            toastr.error('MiMo TTS preview playback failed');
        };
        await this.audioElement.play();
    }

    async fetchTtsGeneration(inputText, voice) {
        if (!this.settings.apiKey) {
            throw new Error('MiMo API Key is required.');
        }

        const response = await fetch(`${this.normalizeBaseUrl(this.settings.baseUrl)}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.settings.apiKey,
            },
            body: JSON.stringify(this.buildRequestBody(inputText, voice)),
        });

        const raw = await response.text();
        let payload = {};

        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch {
            payload = { raw };
        }

        if (!response.ok) {
            const detail = payload?.error?.message || payload?.message || raw || response.statusText;
            throw new Error(`MiMo TTS HTTP ${response.status}: ${detail}`);
        }

        const audio = this.extractAudio(payload);
        return new Response(this.audioToBlob(audio), {
            status: 200,
            headers: {
                'Content-Type': this.getAudioMimeType(this.settings.format),
            },
        });
    }

    async preprocessText(inputText, voice) {
        if (!this.settings.preprocessEnabled) {
            return inputText;
        }

        try {
            const output = await this.fetchPreprocessedText(inputText, voice);
            const cleaned = this.cleanPreprocessorOutput(output);

            if (!cleaned || cleaned === '<EMPTY>') {
                throw new Error('DeepSeek preprocessing returned no speakable dialogue.');
            }

            return cleaned;
        } catch (error) {
            console.warn('MiMo TTS preprocessing failed', error);

            if (this.settings.preprocessFallbackToOriginal) {
                toastr.warning('DeepSeek 预处理失败，已回退原文。', 'MiMo TTS');
                return inputText;
            }

            throw error;
        }
    }

    async fetchPreprocessedText(inputText, voice) {
        const response = await fetch(`${this.normalizeBaseUrl(this.settings.preprocessBaseUrl)}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.settings.preprocessApiKey}`,
            },
            body: JSON.stringify({
                model: this.settings.preprocessModel || this.defaultSettings.preprocessModel,
                temperature: this.settings.preprocessTemperature,
                messages: [
                    {
                        role: 'system',
                        content: [
                            this.settings.preprocessPrompt || this.defaultSettings.preprocessPrompt,
                            this.buildStyleInstruction(),
                        ].filter(Boolean).join('\n\n'),
                    },
                    {
                        role: 'user',
                        content: [
                            `当前 TTS 音色：${voice.name}`,
                            `当前音色 ID：${voice.voice_id}`,
                            '请处理下面这段即将朗读的文本：',
                            inputText,
                        ].join('\n'),
                    },
                ],
            }),
        });

        const raw = await response.text();
        let payload = {};

        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch {
            payload = { raw };
        }

        if (!response.ok) {
            const detail = payload?.error?.message || payload?.message || raw || response.statusText;
            throw new Error(`DeepSeek preprocessing HTTP ${response.status}: ${detail}`);
        }

        const content = payload?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('DeepSeek preprocessing response did not contain content.');
        }

        return content;
    }

    cleanPreprocessorOutput(output) {
        return String(output || '')
            .replace(/^```(?:text|txt|markdown)?/i, '')
            .replace(/```$/i, '')
            .replace(/^["'“”]+|["'“”]+$/g, '')
            .trim();
    }

    buildStyleInstruction() {
        const preset = this.getStylePreset(this.settings.preprocessStyle);
        const lines = [];

        if (preset) {
            lines.push(`本次表演风格预设：${preset.name}`);
            lines.push(preset.prompt);
        }

        if (this.settings.preprocessCustomStyle) {
            lines.push(`用户自定义风格补充：${this.settings.preprocessCustomStyle}`);
        }

        return lines.join('\n');
    }

    getStylePreset(id) {
        return this.settings.preprocessStylePresets.find((preset) => preset.id === id)
            || this.defaultSettings.preprocessStylePresets.find((preset) => preset.id === id)
            || null;
    }

    buildRequestBody(inputText, voice) {
        const isDesignedVoice = String(voice.voice_id).startsWith('design:');
        const userPrompt = isDesignedVoice
            ? `${voice.prompt}\n\n朗读控制：${this.settings.instruction}`
            : this.settings.instruction;

        const body = {
            model: isDesignedVoice ? this.settings.voiceDesignModel : this.settings.presetModel,
            messages: [
                {
                    role: 'user',
                    content: userPrompt || this.defaultSettings.instruction,
                },
                {
                    role: 'assistant',
                    content: inputText,
                },
            ],
            audio: {
                format: this.settings.format || 'wav',
                optimize_text_preview: Boolean(this.settings.optimizeTextPreview),
            },
        };

        if (!isDesignedVoice) {
            body.audio.voice = this.presetVoiceValue(voice);
        }

        return body;
    }

    extractAudio(payload) {
        const audio = payload?.choices?.[0]?.message?.audio || payload?.audio || {};
        const data = audio.data || audio.b64_json || payload?.data;
        const url = audio.url || payload?.url;

        if (data) {
            return { kind: 'base64', value: data };
        }

        if (url) {
            return { kind: 'url', value: url };
        }

        throw new Error('MiMo TTS response did not contain audio data.');
    }

    audioToBlob(audio) {
        if (audio.kind === 'base64') {
            const base64 = String(audio.value).includes(',')
                ? String(audio.value).split(',').pop()
                : String(audio.value);
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);

            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }

            return new Blob([bytes], { type: this.getAudioMimeType(this.settings.format) });
        }

        throw new Error('MiMo TTS returned a URL, but this provider expects inline audio data.');
    }

    getAudioMimeType(format) {
        return format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    }

    normalizeBaseUrl(baseUrl) {
        return String(baseUrl || this.defaultSettings.baseUrl).replace(/\/+$/, '');
    }

    presetVoiceValue(voice) {
        return String(voice.voice_id).replace(/^preset:/, '');
    }

    normalizeVoiceIds() {
        this.settings.presetVoices = this.settings.presetVoices.map((voice) => ({
            ...voice,
            voice_id: String(voice.voice_id || voice.name).startsWith('preset:')
                ? String(voice.voice_id || voice.name)
                : `preset:${voice.voice_id || voice.name}`,
            lang: voice.lang || 'zh-CN',
        }));

        this.settings.designedVoices = this.settings.designedVoices.map((voice, index) => ({
            ...voice,
            voice_id: String(voice.voice_id || '').startsWith('design:')
                ? String(voice.voice_id)
                : `design:${this.slugify(voice.voice_id || voice.name || `voice-${index + 1}`)}`,
            lang: voice.lang || 'zh-CN',
            prompt: voice.prompt || '',
        }));
    }

    addPresetVoice() {
        const name = String($('#mimo_tts_preset_voice_name').val() || '').trim();
        const voiceId = String($('#mimo_tts_preset_voice_id').val() || name).trim();

        if (!name || !voiceId) {
            toastr.error('请填写预置音色显示名和 voice。');
            return;
        }

        const entry = { name, voice_id: `preset:${voiceId}`, lang: 'zh-CN' };
        this.settings.presetVoices = this.upsertVoice(this.settings.presetVoices, entry);
        $('#mimo_tts_preset_voice_name, #mimo_tts_preset_voice_id').val('');
        this.afterVoiceListChange();
    }

    addDesignedVoice() {
        const name = String($('#mimo_tts_design_voice_name').val() || '').trim();
        const prompt = String($('#mimo_tts_design_voice_prompt').val() || '').trim();

        if (!name || !prompt) {
            toastr.error('请填写音色设计显示名和提示词。');
            return;
        }

        const entry = {
            name,
            voice_id: `design:${this.slugify(name)}`,
            lang: 'zh-CN',
            prompt,
        };

        this.settings.designedVoices = this.upsertVoice(this.settings.designedVoices, entry);
        $('#mimo_tts_design_voice_name, #mimo_tts_design_voice_prompt').val('');
        this.afterVoiceListChange();
    }

    removeVoice(listName, voiceId) {
        this.settings[listName] = this.settings[listName].filter((voice) => voice.voice_id !== voiceId);
        this.afterVoiceListChange();
    }

    afterVoiceListChange() {
        this.renderVoiceLists();
        saveTtsProviderSettings();
        initVoiceMap().catch((error) => console.warn('MiMo TTS voice map refresh failed', error));
    }

    upsertVoice(list, entry) {
        return [
            ...list.filter((voice) => voice.voice_id !== entry.voice_id && voice.name !== entry.name),
            entry,
        ];
    }

    renderVoiceLists() {
        this.renderVoiceList('#mimo_tts_preset_voice_list', 'presetVoices');
        this.renderVoiceList('#mimo_tts_design_voice_list', 'designedVoices');
    }

    renderStylePresetSelect() {
        const select = $('#mimo_tts_preprocess_style');
        select.empty();

        for (const preset of this.settings.preprocessStylePresets) {
            select.append($('<option></option>').val(preset.id).text(preset.name));
        }
    }

    renderVoiceList(selector, listName) {
        const container = $(selector);
        container.empty();

        for (const voice of this.settings[listName]) {
            const row = $('<div></div>').addClass('mimo-tts-list-item');
            const label = $('<span></span>').text(`${voice.name} (${voice.voice_id})`);
            const removeButton = $('<button></button>')
                .addClass('menu_button')
                .attr('type', 'button')
                .text('删除')
                .on('click', () => this.removeVoice(listName, voice.voice_id));

            row.append(label, removeButton);
            container.append(row);
        }
    }

    slugify(value) {
        const slug = encodeURIComponent(String(value).trim())
            .replace(/%/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();

        return slug || `voice-${Date.now()}`;
    }
}

registerTtsProvider('MiMo Advanced', MimoTtsProvider);
