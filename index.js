import { registerTtsProvider, getPreviewString, initVoiceMap } from '../../tts/index.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const extensionName = 'mimo-tts-sillytavern';
const providerName = 'MiMo Advanced';

class MimoTtsProvider {
    settings;
    voices = [];
    separator = '。';
    audioElement = document.createElement('audio');
    independentAudioElement = document.createElement('audio');
    independentObjectUrl = null;
    activeIndependentButton = null;
    independentPlaybackToken = 0;
    independentPlaybackStopResolver = null;
    messageObserver = null;
    cacheDbPromise = null;
    lastPreprocessWarningAt = 0;

    defaultSettings = {
        apiKey: '',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        presetModel: 'mimo-v2.5-tts',
        voiceCloneModel: 'mimo-v2.5-tts-voiceclone',
        format: 'wav',
        optimizeTextPreview: false,
        instruction: '自然、清晰、口语化，情绪贴合文本内容。',
        independentMessageButtons: true,
        independentVoiceId: 'preset:冰糖',
        independentCacheEnabled: true,
        independentCacheLimit: 5,
        debugLogEnabled: true,
        previewText: '你好，这是 MiMo Advanced 的音色试听。今天也辛苦了，先放松一下吧。',
        preprocessEnabled: false,
        preprocessApiKey: '',
        preprocessBaseUrl: 'https://api.deepseek.com',
        preprocessModel: 'deepseek-chat',
        preprocessTemperature: 0.2,
        preprocessFallbackToOriginal: true,
        preprocessKeepInnerMonologue: true,
        preprocessControlMode: 'audio-tags',
        preprocessStyle: 'natural-dialogue',
        preprocessCustomStyle: '',
        preprocessPrompt: `你是 SillyTavern 角色对白的 TTS 表演脚本整理器。你的任务是把输入段落整理成适合 MiMo TTS 朗读的中文表演文本。

规则：
1. 只输出当前控制模式要求的结果，不要解释，不要 Markdown；只有“自然语言控制”模式允许输出指定 JSON。
2. 绝对不能改写、润色、扩写、删改或替换原对白文字本身；对白内容必须从输入里原样截取。
3. 你只允许做当前模式要求的处理：裁掉非对话内容；或为 MiMo 生成自然语言控制说明；或在对白前/对白间添加中文全角括号里的表演控制标注，例如：（紧张，深呼吸）（小声）（压低声音）（轻笑）（大笑）（冷笑）（抽泣）（呜咽）（哽咽）（嚎啕大哭）（咳嗽）（长叹一口气）（停顿片刻）（语速加快）（语速放慢）（提高音量喊话）。
4. 去除非对话内容：旁白、动作描写、场景描写、系统提示、玩家指令、表情包、URL、代码块、角色名标签、楼层信息、括号里的纯动作说明。
5. 保留真正应该被听见的对白、内心独白、喊话、低语、吐槽和拟声词；保留原来的称呼、语气词、口癖、错字和标点风格。
6. 细粒度控制语气、情绪、音量、语速、停顿和呼吸，但不要每句话都堆满标注。每 1 到 3 句最多插入 1 个关键标注。
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
        clonedVoices: [],
        preprocessStylePresets: [
            {
                id: 'natural-dialogue',
                name: '自然对白',
                prompt: '像真人聊天一样自然，标注从少但精准。优先保留角色原本语气，让停顿和轻微情绪自然出现。可用（笑）（轻笑）（叹气）（停顿片刻）。',
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
        <div id="mimo_tts_provider_notice" class="mimo-tts-provider-settings">
            <p>MiMo Advanced 的独立播放按钮、API Key、DeepSeek 预处理和缓存设置在普通扩展设置页中，不受系统 TTS 设置影响。</p>
        </div>
        `;
    }

    get settingsFormHtml() {
        return `
        <div id="mimo_tts_extension_settings" class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>MiMo Advanced TTS</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display: none;">
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
                        <label for="mimo_tts_voice_clone_model">声音克隆模型</label>
                        <input id="mimo_tts_voice_clone_model" type="text" class="text_pole">
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
                            启用 MiMo 文本优化
                        </label>
                    </div>
                    <hr>
                    <div class="tts_block flexFlowColumn">
                        <h4>独立消息播放按钮</h4>
                        <label>
                            <input id="mimo_tts_independent_buttons" type="checkbox">
                            给每条助手消息添加独立播放按钮
                        </label>
                        <label for="mimo_tts_independent_voice">独立播放音色</label>
                        <select id="mimo_tts_independent_voice" class="text_pole"></select>
                        <label for="mimo_tts_preview_text">试音文本</label>
                        <textarea id="mimo_tts_preview_text" class="text_pole" rows="3"></textarea>
                        <input id="mimo_tts_preview_selected_voice" type="button" class="menu_button" value="试听当前独立播放音色">
                        <label>
                            <input id="mimo_tts_independent_cache" type="checkbox">
                            自动缓存最近 5 条语音
                        </label>
                        <input id="mimo_tts_clear_cache" type="button" class="menu_button" value="清空插件语音缓存">
                        <input id="mimo_tts_independent_stop" type="button" class="menu_button" value="停止独立播放">
                    </div>
                    <hr>
                    <div class="tts_block flexFlowColumn">
                        <h4>调试日志</h4>
                        <label>
                            <input id="mimo_tts_debug_log_enabled" type="checkbox">
                            记录 DeepSeek 处理文本和播放信息
                        </label>
                        <textarea id="mimo_tts_debug_log" class="text_pole" rows="10" readonly placeholder="点击独立播放或试听后，这里会显示原文、DeepSeek 处理结果、缓存命中和音色信息。"></textarea>
                        <input id="mimo_tts_clear_debug_log" type="button" class="menu_button" value="清空调试日志">
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
                        <label for="mimo_tts_preprocess_control_mode">MiMo 控制模式</label>
                        <select id="mimo_tts_preprocess_control_mode" class="text_pole">
                            <option value="audio-tags">音频标签控制（写入 assistant 文本）</option>
                            <option value="natural-language">自然语言控制（写入 user 指令）</option>
                        </select>
                        <label for="mimo_tts_preprocess_style">表演风格预设</label>
                        <select id="mimo_tts_preprocess_style" class="text_pole"></select>
                        <label>
                            <input id="mimo_tts_preprocess_keep_inner_monologue" type="checkbox">
                            保留心理活动和内心独白
                        </label>
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
                        <h4>新增声音克隆</h4>
                        <input id="mimo_tts_clone_voice_name" type="text" class="text_pole" placeholder="显示名，例如：我的声音">
                        <textarea id="mimo_tts_clone_voice_prompt" class="text_pole" rows="3" placeholder="可选朗读风格，例如：自然清晰"></textarea>
                        <div class="mimo-tts-file-row">
                            <input id="mimo_tts_clone_voice_file" type="file" accept="audio/*,.wav,.mp3">
                            <input id="mimo_tts_choose_clone_voice_file" type="button" class="menu_button" value="选择音频样本">
                            <span id="mimo_tts_clone_voice_file_name">未选择文件</span>
                        </div>
                        <input id="mimo_tts_add_clone_voice" type="button" class="menu_button" value="添加声音克隆">
                        <input id="mimo_tts_clear_clone_voice_form" type="button" class="menu_button" value="清空编辑">
                        <input id="mimo_tts_editing_clone_voice_id" type="hidden">
                        <div id="mimo_tts_clone_voice_list" class="mimo-tts-list"></div>
                    </div>
                    <hr>
                    <div class="tts_block flexFlowColumn">
                        <h4>新增预置音色</h4>
                        <input id="mimo_tts_preset_voice_name" type="text" class="text_pole" placeholder="显示名，例如：冰糖">
                        <input id="mimo_tts_preset_voice_id" type="text" class="text_pole" placeholder="MiMo voice，例如：冰糖">
                        <input id="mimo_tts_add_preset_voice" type="button" class="menu_button" value="添加预置音色">
                        <div id="mimo_tts_preset_voice_list" class="mimo-tts-list"></div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    ensureExtensionSettings(providerSettings = {}) {
        const legacySettings = extension_settings.tts?.[providerName] || {};
        const existingSettings = extension_settings[extensionName] || {};
        const mergedSettings = {
            ...structuredClone(this.defaultSettings),
            ...legacySettings,
            ...providerSettings,
            ...existingSettings,
        };

        if (!extension_settings[extensionName]) {
            extension_settings[extensionName] = mergedSettings;
        } else {
            Object.assign(extension_settings[extensionName], mergedSettings);
        }

        this.settings = extension_settings[extensionName];
        this.mergeDefaultVoiceCatalogs();
        this.migrateToPresetCloneVoices();
        this.normalizeVoiceIds();
        return this.settings;
    }

    mergeDefaultVoiceCatalogs() {
        this.settings.presetVoices = this.mergeVoiceCatalog(this.settings.presetVoices, this.defaultSettings.presetVoices);
        this.settings.clonedVoices = Array.isArray(this.settings.clonedVoices) ? this.settings.clonedVoices : [];
    }

    mergeVoiceCatalog(savedVoices, defaultVoices) {
        const merged = Array.isArray(savedVoices) ? [...savedVoices] : [];
        const existingIds = new Set(merged.map((voice) => voice.voice_id));
        const existingNames = new Set(merged.map((voice) => voice.name));

        for (const defaultVoice of defaultVoices) {
            if (!existingIds.has(defaultVoice.voice_id) && !existingNames.has(defaultVoice.name)) {
                merged.push(structuredClone(defaultVoice));
            }
        }

        return merged;
    }

    migrateToPresetCloneVoices() {
        if (this.settings.voiceCatalogMode === 'preset-clone-only-v1') {
            return;
        }

        if (String(this.settings.independentVoiceId || '').startsWith('design:')) {
            this.settings.independentVoiceId = this.defaultSettings.independentVoiceId;
        }

        delete this.settings.designedVoices;
        delete this.settings.voiceDesignModel;
        this.settings.voiceCatalogMode = 'preset-clone-only-v1';
    }

    async loadSettings(settings) {
        this.ensureExtensionSettings(settings);

        try {
            await this.checkReady();
        } catch (error) {
            console.debug('MiMo TTS provider loaded, provider not ready yet', error);
        }
    }

    async initStandaloneSettings() {
        this.ensureExtensionSettings();

        if (!document.querySelector('#mimo_tts_extension_settings')) {
            const settingsRoot = document.querySelector('#extensions_settings');
            if (!settingsRoot) {
                setTimeout(() => this.initStandaloneSettings(), 500);
                return;
            }
            settingsRoot.insertAdjacentHTML('beforeend', this.settingsFormHtml);
        }

        this.populateSettingsForm();
        this.bindSettingsEvents();
        this.bindDrawerFallback();
        this.renderVoiceLists();
        this.setupIndependentButtons();

        try {
            await this.checkReady();
        } catch (error) {
            console.debug('MiMo Advanced standalone settings loaded, provider not ready yet', error);
        }
    }

    populateSettingsForm() {
        if (!document.querySelector('#mimo_tts_api_key')) {
            return;
        }

        $('#mimo_tts_api_key').val(this.settings.apiKey);
        $('#mimo_tts_base_url').val(this.settings.baseUrl);
        $('#mimo_tts_preset_model').val(this.settings.presetModel);
        $('#mimo_tts_voice_clone_model').val(this.settings.voiceCloneModel);
        $('#mimo_tts_instruction').val(this.settings.instruction);
        $('#mimo_tts_format').val(this.settings.format);
        $('#mimo_tts_optimize_text_preview').prop('checked', Boolean(this.settings.optimizeTextPreview));
        $('#mimo_tts_independent_buttons').prop('checked', Boolean(this.settings.independentMessageButtons));
        this.renderIndependentVoiceSelect();
        $('#mimo_tts_independent_voice').val(this.settings.independentVoiceId);
        $('#mimo_tts_preview_text').val(this.settings.previewText);
        $('#mimo_tts_debug_log_enabled').prop('checked', Boolean(this.settings.debugLogEnabled));
        $('#mimo_tts_independent_cache').prop('checked', Boolean(this.settings.independentCacheEnabled));
        $('#mimo_tts_preprocess_enabled').prop('checked', Boolean(this.settings.preprocessEnabled));
        $('#mimo_tts_preprocess_api_key').val(this.settings.preprocessApiKey);
        $('#mimo_tts_preprocess_base_url').val(this.settings.preprocessBaseUrl);
        $('#mimo_tts_preprocess_model').val(this.settings.preprocessModel);
        $('#mimo_tts_preprocess_temperature').val(this.settings.preprocessTemperature);
        $('#mimo_tts_preprocess_temperature_output').text(Number(this.settings.preprocessTemperature).toFixed(2));
        $('#mimo_tts_preprocess_control_mode').val(this.getPreprocessControlMode());
        this.renderStylePresetSelect();
        $('#mimo_tts_preprocess_style').val(this.settings.preprocessStyle);
        $('#mimo_tts_preprocess_keep_inner_monologue').prop('checked', Boolean(this.settings.preprocessKeepInnerMonologue));
        $('#mimo_tts_preprocess_custom_style').val(this.settings.preprocessCustomStyle);
        $('#mimo_tts_preprocess_fallback').prop('checked', Boolean(this.settings.preprocessFallbackToOriginal));
        $('#mimo_tts_preprocess_prompt').val(this.settings.preprocessPrompt);
    }

    bindSettingsEvents() {
        $('#mimo_tts_api_key, #mimo_tts_base_url, #mimo_tts_preset_model, #mimo_tts_voice_clone_model, #mimo_tts_instruction, #mimo_tts_preview_text').off('.mimoAdvanced').on('input.mimoAdvanced', () => this.onSettingsChange());
        $('#mimo_tts_preprocess_api_key, #mimo_tts_preprocess_base_url, #mimo_tts_preprocess_model, #mimo_tts_preprocess_prompt').off('.mimoAdvanced').on('input.mimoAdvanced', () => this.onSettingsChange());
        $('#mimo_tts_preprocess_custom_style').off('.mimoAdvanced').on('input.mimoAdvanced', () => this.onSettingsChange());
        $('#mimo_tts_preprocess_temperature').off('.mimoAdvanced').on('input.mimoAdvanced', () => this.onSettingsChange());
        $('#mimo_tts_format, #mimo_tts_optimize_text_preview, #mimo_tts_independent_buttons, #mimo_tts_independent_voice, #mimo_tts_independent_cache, #mimo_tts_debug_log_enabled, #mimo_tts_preprocess_enabled, #mimo_tts_preprocess_fallback, #mimo_tts_preprocess_control_mode, #mimo_tts_preprocess_style, #mimo_tts_preprocess_keep_inner_monologue').off('.mimoAdvanced').on('change.mimoAdvanced', () => this.onSettingsChange());
        $('#mimo_tts_independent_stop').off('.mimoAdvanced').on('click.mimoAdvanced', () => this.stopIndependentAudio());
        $('#mimo_tts_clear_cache').off('.mimoAdvanced').on('click.mimoAdvanced', () => this.clearAudioCacheWithToast());
        $('#mimo_tts_clear_debug_log').off('.mimoAdvanced').on('click.mimoAdvanced', () => this.clearDebugLog());
        $('#mimo_tts_preview_selected_voice').off('.mimoAdvanced').on('click.mimoAdvanced', () => this.previewSelectedIndependentVoice().catch((error) => {
            console.error('MiMo Advanced preview failed', error);
            toastr.error(error.message || String(error), 'MiMo Advanced');
        }));
        $('#mimo_tts_add_preset_voice').off('.mimoAdvanced').on('click.mimoAdvanced', () => this.addPresetVoice());
        $('#mimo_tts_add_clone_voice').off('.mimoAdvanced').on('click.mimoAdvanced', () => this.addClonedVoice().catch((error) => {
            console.error('MiMo Advanced clone voice add failed', error);
            toastr.error(error.message || String(error), providerName);
        }));
        $('#mimo_tts_clear_clone_voice_form').off('.mimoAdvanced').on('click.mimoAdvanced', () => this.clearClonedVoiceForm());
        $('#mimo_tts_choose_clone_voice_file').off('.mimoAdvanced').on('click.mimoAdvanced', () => $('#mimo_tts_clone_voice_file').trigger('click'));
        $('#mimo_tts_clone_voice_file').off('.mimoAdvanced').on('change.mimoAdvanced', () => this.updateCloneFileName());
    }

    bindDrawerFallback() {
        $('#mimo_tts_extension_settings .inline-drawer-toggle').off('click.mimoAdvancedDrawer').on('click.mimoAdvancedDrawer', () => {
            const content = $('#mimo_tts_extension_settings .inline-drawer-content');
            const icon = $('#mimo_tts_extension_settings .inline-drawer-icon');
            content.slideToggle(120);
            icon.toggleClass('down up');
        });
    }

    dispose() {
        this.audioElement.pause();
        this.stopIndependentAudio();
        this.messageObserver?.disconnect();
        this.removeIndependentButtons();
    }

    onSettingsChange() {
        this.settings.apiKey = String($('#mimo_tts_api_key').val() || '').trim();
        this.settings.baseUrl = String($('#mimo_tts_base_url').val() || '').trim();
        this.settings.presetModel = String($('#mimo_tts_preset_model').val() || '').trim();
        this.settings.voiceCloneModel = String($('#mimo_tts_voice_clone_model').val() || '').trim();
        this.settings.instruction = String($('#mimo_tts_instruction').val() || '').trim();
        this.settings.format = String($('#mimo_tts_format').val() || 'wav');
        this.settings.optimizeTextPreview = Boolean($('#mimo_tts_optimize_text_preview').is(':checked'));
        this.settings.independentMessageButtons = Boolean($('#mimo_tts_independent_buttons').is(':checked'));
        this.settings.independentVoiceId = String($('#mimo_tts_independent_voice').val() || this.settings.independentVoiceId || 'preset:冰糖');
        this.settings.independentCacheEnabled = Boolean($('#mimo_tts_independent_cache').is(':checked'));
        this.settings.debugLogEnabled = Boolean($('#mimo_tts_debug_log_enabled').is(':checked'));
        this.settings.previewText = String($('#mimo_tts_preview_text').val() || '').trim() || this.defaultSettings.previewText;
        this.settings.preprocessEnabled = Boolean($('#mimo_tts_preprocess_enabled').is(':checked'));
        this.settings.preprocessApiKey = String($('#mimo_tts_preprocess_api_key').val() || '').trim();
        this.settings.preprocessBaseUrl = String($('#mimo_tts_preprocess_base_url').val() || '').trim();
        this.settings.preprocessModel = String($('#mimo_tts_preprocess_model').val() || '').trim();
        this.settings.preprocessTemperature = Number($('#mimo_tts_preprocess_temperature').val() || 0.2);
        this.settings.preprocessControlMode = String($('#mimo_tts_preprocess_control_mode').val() || 'audio-tags');
        this.settings.preprocessStyle = String($('#mimo_tts_preprocess_style').val() || 'natural-dialogue');
        this.settings.preprocessKeepInnerMonologue = Boolean($('#mimo_tts_preprocess_keep_inner_monologue').is(':checked'));
        this.settings.preprocessCustomStyle = String($('#mimo_tts_preprocess_custom_style').val() || '').trim();
        this.settings.preprocessFallbackToOriginal = Boolean($('#mimo_tts_preprocess_fallback').is(':checked'));
        this.settings.preprocessPrompt = String($('#mimo_tts_preprocess_prompt').val() || '').trim();
        $('#mimo_tts_preprocess_temperature_output').text(Number(this.settings.preprocessTemperature).toFixed(2));
        this.setupIndependentButtons();
        saveSettingsDebounced();
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
        return [...this.settings.presetVoices, ...this.settings.clonedVoices];
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
        const result = await this.getOrCreateAudioBlob(text, voice);
        return this.createAudioResponse(result.blob);
    }

    async previewTtsVoice(voiceId) {
        const voice = await this.getVoice(voiceId);
        const previewText = document.querySelector('#mimo_tts_preview_text')
            ? this.getPreviewText()
            : getPreviewString(voice.lang || 'zh-CN');
        const response = await this.fetchTtsGeneration(previewText, voice);
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

    setupIndependentButtons() {
        if (!this.settings?.independentMessageButtons) {
            this.removeIndependentButtons();
            return;
        }

        this.decorateIndependentButtons();

        if (!this.messageObserver) {
            const chat = document.querySelector('#chat');
            if (!chat) {
                setTimeout(() => this.setupIndependentButtons(), 500);
                return;
            }

            this.messageObserver = new MutationObserver(() => this.decorateIndependentButtons());
            this.messageObserver.observe(chat, { childList: true, subtree: true });
        }
    }

    removeIndependentButtons() {
        document.querySelectorAll('.mimo-tts-independent-button').forEach((button) => button.remove());
        document.querySelectorAll('.mimo-tts-download-button').forEach((button) => button.remove());
    }

    decorateIndependentButtons() {
        if (!this.settings?.independentMessageButtons) {
            return;
        }

        document.querySelectorAll('#chat .mes').forEach((messageElement) => {
            if (!this.isAssistantMessageElement(messageElement)) {
                messageElement.querySelectorAll('.mimo-tts-independent-button').forEach((button) => button.remove());
                return;
            }

            if (messageElement.querySelector('.mimo-tts-independent-button')) {
                return;
            }

            const host = messageElement.querySelector('.mes_buttons, .extraMesButtons, .mes_block') || messageElement;
            const button = document.createElement('div');
            button.className = 'mes_button mimo-tts-independent-button fa-solid fa-volume-high';
            button.title = 'MiMo Advanced 独立朗读此消息';
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', () => {
                this.playIndependentMessage(messageElement, button).catch((error) => {
                    console.error('MiMo independent playback failed', error);
                    toastr.error(error.message || String(error), 'MiMo Advanced');
                });
            });
            button.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    button.click();
                }
            });
            host.append(button);
        });
    }

    isAssistantMessageElement(messageElement) {
        const id = Number(messageElement.getAttribute('mesid'));
        const message = Number.isFinite(id) ? getContext()?.chat?.[id] : null;

        if (message) {
            return !message.is_user && !message.is_system;
        }

        return !messageElement.classList.contains('is_user') && !messageElement.classList.contains('user_mes');
    }

    async playIndependentMessage(messageElement, button) {
        if (button.classList.contains('mimo-tts-loading')) {
            return;
        }

        if (button === this.activeIndependentButton) {
            if (button.classList.contains('mimo-tts-playing')) {
                this.pauseIndependentPlayback(button);
                return;
            }

            if (button.classList.contains('mimo-tts-paused')) {
                await this.resumeIndependentPlayback(button);
                return;
            }
        }

        if (button.mimoAudioBlobs?.length) {
            await this.startIndependentPlayback(button, button.mimoAudioBlobs, button.mimoSourceText || this.getMessageSpeakText(messageElement));
            return;
        }

        const text = this.getMessageSpeakText(messageElement);

        if (!text) {
            throw new Error('这条消息没有可朗读文本。');
        }

        this.setButtonState(button, 'loading');

        try {
            const voice = await this.getIndependentVoice();
            const preparedSpeech = await this.preprocessSpeech(text, voice);
            if (!preparedSpeech?.text) {
                throw new Error('DeepSeek 预处理后没有可朗读对白。');
            }

            const results = [await this.getOrCreateAudioBlob(text, voice, preparedSpeech)];
            const cacheHit = results.every((result) => result.cacheHit);
            const blobs = results.map((result) => result.blob);

            this.writeDebugLog({
                title: '独立播放',
                originalText: text,
                processedText: this.formatPreparedSpeechForLog(preparedSpeech),
                cacheHit,
                voiceName: voice.name,
                voiceId: voice.voice_id,
            });
            button.mimoAudioBlobs = blobs;
            button.mimoSourceText = text;
            button.dataset.mimoAudioReadyState = cacheHit ? 'cached' : 'generated';
            this.ensureDownloadButton(button, blobs, text);
            this.setButtonState(button, cacheHit ? 'cached' : 'generated');
            await this.startIndependentPlayback(button, blobs, text);
        } finally {
            if (button.classList.contains('mimo-tts-loading')) {
                this.setButtonState(button, 'ready');
            }
        }
    }

    setButtonState(button, state) {
        button.classList.remove(
            'mimo-tts-loading',
            'mimo-tts-cached',
            'mimo-tts-generated',
            'mimo-tts-playing',
            'mimo-tts-paused',
            'fa-volume-high',
            'fa-spinner',
            'fa-spin',
            'fa-rotate',
            'fa-box-archive',
            'fa-circle-play',
            'fa-pause',
            'fa-play',
        );

        if (!['cached', 'generated', 'playing', 'paused'].includes(state)) {
            this.removeDownloadButton(button);
            delete button.dataset.mimoAudioReadyState;
        }

        if (state === 'loading') {
            button.classList.add('mimo-tts-loading', 'fa-spinner', 'fa-spin');
            button.title = 'MiMo Advanced 正在生成语音';
            return;
        }

        if (state === 'cached') {
            button.dataset.mimoAudioReadyState = 'cached';
            button.classList.add('mimo-tts-cached', 'fa-box-archive');
            button.title = 'MiMo Advanced 已命中缓存，点击播放';
            return;
        }

        if (state === 'generated') {
            button.dataset.mimoAudioReadyState = 'generated';
            button.classList.add('mimo-tts-generated', 'fa-circle-play');
            button.title = 'MiMo Advanced 已生成语音，点击播放';
            return;
        }

        if (state === 'playing') {
            button.classList.add('mimo-tts-playing', 'fa-pause');
            button.title = 'MiMo Advanced 正在播放，点击暂停';
            return;
        }

        if (state === 'paused') {
            button.classList.add('mimo-tts-paused', 'fa-play');
            button.title = 'MiMo Advanced 已暂停，点击继续播放';
            return;
        }

        button.classList.add('fa-volume-high');
        button.title = 'MiMo Advanced 独立朗读此消息';
    }

    getMessageSpeakText(messageElement) {
        const textElement = messageElement.querySelector('.mes_text');

        if (!textElement) {
            return '';
        }

        const clone = textElement.cloneNode(true);
        clone.querySelectorAll([
            '.mes_reasoning',
            '.reasoning',
            '.thinking',
            '.thoughts',
            '.reasoning_details',
            '.reasoning-content',
            '[data-reasoning]',
            '[data-thinking]',
        ].join(',')).forEach((element) => element.remove());

        return this.cleanMessageText(clone.innerText || clone.textContent || '');
    }

    async getOrCreateAudioBlob(inputText, voice, preparedSpeechOverride = null) {
        const cleanInputText = this.cleanMessageText(inputText);

        if (!cleanInputText) {
            throw new Error('没有可朗读文本。');
        }

        const preparedSpeech = preparedSpeechOverride
            ? this.normalizePreparedSpeech(preparedSpeechOverride, cleanInputText)
            : await this.preprocessSpeech(cleanInputText, voice);
        const cacheKey = await this.buildAudioCacheKey(cleanInputText, voice, preparedSpeech);

        if (this.settings.independentCacheEnabled) {
            const cachedEntry = await this.readAudioCache(cacheKey);

            if (cachedEntry?.blob) {
                return {
                    blob: cachedEntry.blob,
                    cacheHit: true,
                    processedText: cachedEntry.processedText || '[缓存命中，未重新请求 DeepSeek]',
                };
            }
        }

        if (!preparedSpeech?.text) {
            throw new Error('DeepSeek 预处理后没有可朗读对白。');
        }

        const response = await this.fetchTtsGeneration(preparedSpeech.text, voice, preparedSpeech);
        const audioBlob = await response.blob();

        if (this.settings.independentCacheEnabled) {
            await this.writeAudioCache(cacheKey, audioBlob, cleanInputText, this.formatPreparedSpeechForLog(preparedSpeech), voice);
        }

        return {
            blob: audioBlob,
            cacheHit: false,
            processedText: this.formatPreparedSpeechForLog(preparedSpeech),
        };
    }

    createAudioResponse(audioBlob) {
        return new Response(audioBlob, {
            status: 200,
            headers: {
                'Content-Type': this.getAudioMimeType(this.settings.format),
            },
        });
    }

    async getIndependentVoice() {
        const voices = await this.fetchTtsVoiceObjects();
        const selected = voices.find((voice) => voice.voice_id === this.settings.independentVoiceId || voice.name === this.settings.independentVoiceId);

        if (selected) {
            return selected;
        }

        if (voices[0]) {
            this.settings.independentVoiceId = voices[0].voice_id;
            return voices[0];
        }

        throw new Error('没有可用的 MiMo 音色。');
    }

    async previewSelectedIndependentVoice() {
        const voice = await this.getIndependentVoice();
        await this.previewVoiceObject(voice);
    }

    async previewVoiceObject(voice) {
        const text = this.getPreviewText();
        const response = await this.fetchTtsGeneration(text, voice);
        const audioBlob = await response.blob();
        this.writeDebugLog({
            title: '音色试听',
            originalText: text,
            processedText: text,
            cacheHit: false,
            voiceName: voice.name,
            voiceId: voice.voice_id,
        });
        await this.playIndependentBlob(audioBlob);
    }

    getPreviewText() {
        const inputValue = String($('#mimo_tts_preview_text').val() || '').trim();
        const text = this.cleanMessageText(inputValue || this.settings.previewText || this.defaultSettings.previewText);
        this.settings.previewText = text;
        return text;
    }

    async playIndependentBlob(audioBlob) {
        this.stopIndependentAudio();
        this.independentObjectUrl = URL.createObjectURL(audioBlob);
        this.independentAudioElement.src = this.independentObjectUrl;
        this.independentAudioElement.onended = () => this.releaseIndependentObjectUrl();
        this.independentAudioElement.onerror = () => {
            this.releaseIndependentObjectUrl();
            toastr.error('独立音频播放失败。', 'MiMo Advanced');
        };
        await this.independentAudioElement.play();
    }

    async playIndependentBlobs(audioBlobs) {
        await this.startIndependentPlayback(null, audioBlobs, '');
    }

    async startIndependentPlayback(button, audioBlobs, sourceText) {
        if (!audioBlobs?.length) {
            return;
        }

        this.stopIndependentAudio();
        const playbackToken = ++this.independentPlaybackToken;

        if (button) {
            button.mimoAudioBlobs = audioBlobs;
            button.mimoSourceText = sourceText;
            if (!button.dataset.mimoAudioReadyState) {
                button.dataset.mimoAudioReadyState = 'generated';
            }
            this.ensureDownloadButton(button, audioBlobs, sourceText);
            this.activeIndependentButton = button;
            this.setButtonState(button, 'playing');
        }

        try {
            for (const audioBlob of audioBlobs) {
                if (playbackToken !== this.independentPlaybackToken) {
                    return;
                }

                const result = await new Promise((resolve, reject) => {
                    this.independentPlaybackStopResolver = () => resolve('stopped');
                    this.releaseIndependentObjectUrl();
                    this.independentObjectUrl = URL.createObjectURL(audioBlob);
                    this.independentAudioElement.src = this.independentObjectUrl;
                    this.independentAudioElement.onended = () => {
                        this.independentPlaybackStopResolver = null;
                        this.releaseIndependentObjectUrl();
                        resolve('ended');
                    };
                    this.independentAudioElement.onerror = () => {
                        this.independentPlaybackStopResolver = null;
                        this.releaseIndependentObjectUrl();
                        reject(new Error('独立音频播放失败。'));
                    };
                    this.independentAudioElement.play().catch((error) => {
                        this.independentPlaybackStopResolver = null;
                        this.releaseIndependentObjectUrl();
                        reject(error);
                    });
                });

                if (result === 'stopped') {
                    return;
                }
            }
        } finally {
            if (playbackToken === this.independentPlaybackToken) {
                this.releaseIndependentObjectUrl();
                this.independentPlaybackStopResolver = null;
                if (button && this.activeIndependentButton === button) {
                    this.setButtonState(button, button.dataset.mimoAudioReadyState || 'generated');
                    this.activeIndependentButton = null;
                }
            }
        }
    }

    pauseIndependentPlayback(button) {
        if (button !== this.activeIndependentButton || this.independentAudioElement.paused) {
            return;
        }

        this.independentAudioElement.pause();
        this.setButtonState(button, 'paused');
    }

    async resumeIndependentPlayback(button) {
        if (button !== this.activeIndependentButton || !this.independentAudioElement.paused) {
            return;
        }

        await this.independentAudioElement.play();
        this.setButtonState(button, 'playing');
    }

    writeDebugLog(entry) {
        if (!this.settings.debugLogEnabled) {
            return;
        }

        const textarea = document.querySelector('#mimo_tts_debug_log');
        if (!textarea) {
            return;
        }

        const lines = [
            `时间：${new Date().toLocaleString()}`,
            `类型：${entry.title || '播放'}`,
            `音色：${entry.voiceName || ''} (${entry.voiceId || ''})`,
            `缓存：${entry.cacheHit ? '命中' : '未命中'}`,
            '原文：',
            entry.originalText || '',
            '处理后：',
            entry.processedText || '',
            '---',
        ];

        textarea.value = `${textarea.value ? `${textarea.value}\n` : ''}${lines.join('\n')}`.slice(-50000);
        textarea.scrollTop = textarea.scrollHeight;
    }

    clearDebugLog() {
        const textarea = document.querySelector('#mimo_tts_debug_log');
        if (textarea) {
            textarea.value = '';
        }
    }

    ensureDownloadButton(button, audioBlobs, sourceText) {
        if (!button.dataset.mimoButtonId) {
            button.dataset.mimoButtonId = `mimo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        const selector = `[data-mimo-download-for="${button.dataset.mimoButtonId}"]`;
        let downloadButton = button.parentElement?.querySelector(selector);

        if (!downloadButton) {
            downloadButton = document.createElement('div');
            downloadButton.className = 'mes_button mimo-tts-download-button fa-solid fa-download';
            downloadButton.title = '下载生成语音';
            downloadButton.setAttribute('role', 'button');
            downloadButton.setAttribute('tabindex', '0');
            downloadButton.dataset.mimoDownloadFor = button.dataset.mimoButtonId;
            button.before(downloadButton);
        }

        downloadButton.onclick = (event) => {
            event.stopPropagation();
            this.downloadAudioBlobs(audioBlobs, sourceText);
        };
        downloadButton.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                downloadButton.click();
            }
        };
    }

    removeDownloadButton(button) {
        const id = button.dataset.mimoButtonId;
        const selector = id ? `[data-mimo-download-for="${id}"]` : '.mimo-tts-download-button';
        button.parentElement?.querySelector(selector)?.remove();
    }

    downloadAudioBlobs(audioBlobs, sourceText) {
        const extension = this.settings.format === 'mp3' ? 'mp3' : 'wav';
        const baseName = this.buildDownloadBaseName(sourceText);

        audioBlobs.forEach((audioBlob, index) => {
            const suffix = audioBlobs.length > 1 ? `-${String(index + 1).padStart(2, '0')}` : '';
            this.downloadBlob(audioBlob, `${baseName}${suffix}.${extension}`);
        });
    }

    buildDownloadBaseName(sourceText) {
        const text = String(sourceText || '')
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 32)
            .replace(/^-|-$/g, '');
        return `mimo-advanced-tts${text ? `-${text}` : ''}`;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    stopIndependentAudio() {
        this.independentPlaybackToken += 1;
        if (this.independentPlaybackStopResolver) {
            this.independentPlaybackStopResolver();
            this.independentPlaybackStopResolver = null;
        }
        this.independentAudioElement.pause();
        this.independentAudioElement.currentTime = 0;
        this.releaseIndependentObjectUrl();

        if (this.activeIndependentButton) {
            const button = this.activeIndependentButton;
            this.activeIndependentButton = null;
            this.setButtonState(button, button.mimoAudioBlobs?.length ? (button.dataset.mimoAudioReadyState || 'generated') : 'ready');
        }
    }

    releaseIndependentObjectUrl() {
        if (this.independentObjectUrl) {
            URL.revokeObjectURL(this.independentObjectUrl);
            this.independentObjectUrl = null;
        }
    }

    cleanMessageText(text) {
        return this.removeThinkingText(String(text || ''))
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\[[^\]]*?]\([^)]*?\)/g, '$1')
            .replace(/\{\{.*?\}\}/g, '')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t\f\v]+/g, ' ')
            .replace(/ *\n */g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    removeThinkingText(text) {
        return String(text || '')
            .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
            .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
            .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
            .replace(/<analysis\b[^>]*>[\s\S]*?<\/analysis>/gi, '')
            .replace(/\[think\][\s\S]*?\[\/think\]/gi, '')
            .replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '')
            .replace(/\[reasoning\][\s\S]*?\[\/reasoning\]/gi, '')
            .replace(/(?:^|\n)\s*(?:思考|思考过程|推理过程|内心推理|thinking|reasoning)\s*[:：][\s\S]*?(?=\n\s*(?:正文|回复|最终回复|assistant|角色回复)\s*[:：]|\n{2,}|$)/gi, '\n');
    }

    async buildAudioCacheKey(inputText, voice, preparedText = null) {
        const material = JSON.stringify({
            version: 13,
            inputText,
            preparedText,
            voice,
            baseUrl: this.normalizeBaseUrl(this.settings.baseUrl),
            presetModel: this.settings.presetModel,
            voiceCloneModel: this.settings.voiceCloneModel,
            format: this.settings.format,
            optimizeTextPreview: this.settings.optimizeTextPreview,
            instruction: this.settings.instruction,
            preprocessEnabled: this.settings.preprocessEnabled,
            preprocessModel: this.settings.preprocessModel,
            preprocessTemperature: this.settings.preprocessTemperature,
            preprocessControlMode: this.getPreprocessControlMode(),
            preprocessStyle: this.settings.preprocessStyle,
            preprocessKeepInnerMonologue: this.settings.preprocessKeepInnerMonologue,
            preprocessCustomStyle: this.settings.preprocessCustomStyle,
            preprocessPrompt: this.settings.preprocessPrompt,
        });

        return `mimo-audio:${await this.sha256(material)}`;
    }

    async sha256(value) {
        if (window.crypto?.subtle) {
            const data = new TextEncoder().encode(value);
            const hash = await window.crypto.subtle.digest('SHA-256', data);
            return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        }

        let hash = 0;
        for (let index = 0; index < value.length; index += 1) {
            hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
        }
        return String(hash);
    }

    async openAudioCacheDb() {
        if (!window.indexedDB) {
            return null;
        }

        if (this.cacheDbPromise) {
            return this.cacheDbPromise;
        }

        this.cacheDbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open('mimo-advanced-tts-cache', 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                const store = db.createObjectStore('audio', { keyPath: 'key' });
                store.createIndex('createdAt', 'createdAt');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }).catch((error) => {
            console.warn('MiMo Advanced cache open failed', error);
            this.cacheDbPromise = null;
            return null;
        });

        return this.cacheDbPromise;
    }

    async readAudioCache(key) {
        try {
            const db = await this.openAudioCacheDb();
            if (!db) {
                return null;
            }

            const transaction = db.transaction('audio', 'readwrite');
            const store = transaction.objectStore('audio');
            const entry = await this.idbRequest(store.get(key));

            if (!entry?.blob) {
                return null;
            }

            entry.createdAt = Date.now();
            store.put(entry);
            await this.idbTransactionDone(transaction);
            await this.pruneAudioCache();
            return entry;
        } catch (error) {
            console.warn('MiMo Advanced cache read failed', error);
            return null;
        }
    }

    async writeAudioCache(key, blob, inputText, processedText, voice) {
        try {
            const db = await this.openAudioCacheDb();
            if (!db) {
                return;
            }

            const transaction = db.transaction('audio', 'readwrite');
            const done = this.idbTransactionDone(transaction);
            const store = transaction.objectStore('audio');
            await this.idbRequest(store.put({
                key,
                blob,
                createdAt: Date.now(),
                format: this.settings.format,
                voiceId: voice.voice_id,
                voiceName: voice.name,
                textPreview: inputText.slice(0, 80),
                processedText,
            }));
            await done;
            await this.pruneAudioCache();
        } catch (error) {
            console.warn('MiMo Advanced cache write failed', error);
        }
    }

    async pruneAudioCache() {
        const db = await this.openAudioCacheDb();
        if (!db) {
            return;
        }

        const entries = await this.getAudioCacheEntries();
        const overflow = entries
            .sort((left, right) => right.createdAt - left.createdAt)
            .slice(Number(this.settings.independentCacheLimit) || 5);

        if (!overflow.length) {
            return;
        }

        const transaction = db.transaction('audio', 'readwrite');
        const done = this.idbTransactionDone(transaction);
        const store = transaction.objectStore('audio');
        for (const entry of overflow) {
            store.delete(entry.key);
        }
        await done;
    }

    async getAudioCacheEntries() {
        const db = await this.openAudioCacheDb();
        if (!db) {
            return [];
        }

        const store = db.transaction('audio', 'readonly').objectStore('audio');
        return await this.idbRequest(store.getAll());
    }

    async clearAudioCacheWithToast() {
        try {
            await this.clearAudioCache();
            toastr.success('已清空 MiMo Advanced 语音缓存。', 'MiMo Advanced');
        } catch (error) {
            console.warn('MiMo Advanced cache clear failed', error);
            toastr.error('清空语音缓存失败。', 'MiMo Advanced');
        }
    }

    async clearAudioCache() {
        const db = await this.openAudioCacheDb();
        if (!db) {
            return;
        }

        const transaction = db.transaction('audio', 'readwrite');
        const done = this.idbTransactionDone(transaction);
        transaction.objectStore('audio').clear();
        await done;
    }

    idbRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    idbTransactionDone(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    async fetchTtsGeneration(inputText, voice, preparedSpeech = null) {
        if (!this.settings.apiKey) {
            throw new Error('MiMo API Key is required.');
        }

        const response = await this.fetchWithTimeout(`${this.normalizeBaseUrl(this.settings.baseUrl)}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.settings.apiKey,
            },
            body: JSON.stringify(this.buildRequestBody(inputText, voice, preparedSpeech)),
        }, 90000);

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
        const preparedSpeech = await this.preprocessSpeech(inputText, voice);
        return preparedSpeech?.text || '';
    }

    async preprocessSpeech(inputText, voice) {
        if (!this.settings.preprocessEnabled) {
            return this.normalizePreparedSpeech(inputText, inputText);
        }

        try {
            const output = await this.fetchPreprocessedText(inputText, voice);
            const cleaned = this.cleanPreprocessorOutput(output);

            if (!cleaned || cleaned === '<EMPTY>') {
                return this.normalizePreparedSpeech('', inputText);
            }

            if (this.getPreprocessControlMode() === 'natural-language') {
                return this.parseNaturalLanguagePreprocessOutput(cleaned, inputText);
            }

            return this.normalizePreparedSpeech({
                mode: 'audio-tags',
                text: cleaned,
                instruction: '',
            }, inputText);
        } catch (error) {
            console.warn('MiMo TTS preprocessing failed', error);

            if (this.settings.preprocessFallbackToOriginal) {
                this.showThrottledPreprocessWarning('DeepSeek 预处理失败，已使用原文继续合成。');
                return this.normalizePreparedSpeech(inputText, inputText);
            }

            throw error;
        }
    }

    async fetchPreprocessedText(inputText, voice) {
        const response = await this.fetchWithTimeout(`${this.normalizeBaseUrl(this.settings.preprocessBaseUrl)}/chat/completions`, {
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
                            this.buildPreprocessControlModeInstruction(),
                            this.buildStyleInstruction(),
                            this.buildInnerMonologueInstruction(),
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
        }, 45000);

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
            .replace(/^```(?:text|txt|markdown|json)?/i, '')
            .replace(/```$/i, '')
            .replace(/^\s*(?:处理后文本|处理结果|最终文本|输出|朗读文本|TTS文本)\s*[:：]\s*/i, '')
            .replace(/^\s*[-*]\s+/gm, '')
            .replace(/^["'“”]+|["'“”]+$/g, '')
            .trim();
    }

    parseNaturalLanguagePreprocessOutput(output, fallbackText) {
        const parsed = this.tryParseJsonObject(output);

        if (parsed) {
            const text = String(parsed.text || parsed.assistant || parsed.assistantContent || fallbackText || '').trim();
            const instruction = String(parsed.instruction || parsed.user || parsed.userContent || '').trim();
            if (text === '<EMPTY>') {
                return this.normalizePreparedSpeech('', fallbackText);
            }
            return this.normalizePreparedSpeech({
                mode: 'natural-language',
                text,
                instruction,
            }, fallbackText);
        }

        return this.normalizePreparedSpeech({
            mode: 'natural-language',
            text: fallbackText,
            instruction: output,
        }, fallbackText);
    }

    tryParseJsonObject(value) {
        const text = String(value || '').trim();
        const candidates = [
            text,
            text.match(/\{[\s\S]*\}/)?.[0] || '',
        ].filter(Boolean);

        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {
                // Continue to the next candidate.
            }
        }

        return null;
    }

    normalizePreparedSpeech(value, fallbackText = '') {
        if (value && typeof value === 'object') {
            return {
                mode: value.mode || this.getPreprocessControlMode(),
                text: String(value.text ?? fallbackText ?? '').trim(),
                instruction: String(value.instruction || '').trim(),
            };
        }

        return {
            mode: this.settings.preprocessEnabled ? this.getPreprocessControlMode() : 'none',
            text: String(value ?? fallbackText ?? '').trim(),
            instruction: '',
        };
    }

    formatPreparedSpeechForLog(preparedSpeech) {
        const prepared = this.normalizePreparedSpeech(preparedSpeech);
        const lines = [
            `控制模式：${this.getPreprocessControlModeLabel(prepared.mode)}`,
        ];

        if (prepared.instruction) {
            lines.push('MiMo user 控制：', prepared.instruction);
        }

        lines.push('MiMo assistant 文本：', prepared.text || '');
        return lines.join('\n');
    }

    showThrottledPreprocessWarning(message) {
        const now = Date.now();
        if (now - this.lastPreprocessWarningAt < 10000) {
            return;
        }

        this.lastPreprocessWarningAt = now;
        toastr.warning(message, 'MiMo TTS');
    }

    async fetchWithTimeout(url, options, timeoutMs) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal,
            });
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error(`请求超时：${Math.round(timeoutMs / 1000)} 秒内没有响应。`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
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

    getPreprocessControlMode() {
        return this.settings.preprocessControlMode === 'natural-language'
            ? 'natural-language'
            : 'audio-tags';
    }

    getPreprocessControlModeLabel(mode) {
        return mode === 'natural-language' ? '自然语言控制' : mode === 'audio-tags' ? '音频标签控制' : '无预处理';
    }

    buildPreprocessControlModeInstruction() {
        const shared = `MiMo v2.5 控制能力要求：
1. 先判断这段文本是否需要多风格切换、多情绪混合、多粒度控制；需要时按段落、句子或短语细分控制，不需要时保持自然克制。
2. 可控制语气、情绪、语速、音量、停顿、呼吸、笑哭、咳嗽、方言、角色化表达和唱歌；不要为了炫技过度堆叠。
3. 保留原对白内容，不要为了风格控制改写对白本身。`;

        if (this.getPreprocessControlMode() === 'natural-language') {
            return `${shared}

当前模式：自然语言控制。
1. MiMo 请求中，风格控制会放在 role:user 的 content；目标合成文本会放在 role:assistant 的 content。
2. 你必须输出一个 JSON 对象，不要 Markdown，不要解释。格式：{"instruction":"放进 role:user 的自然语言控制说明","text":"放进 role:assistant 的朗读文本"}。
3. instruction 用自然语言描述整体和局部表演方式，例如“前半段压低声音、紧张急促，后半段放慢语速、带克制的苦笑”。可以描述多风格切换、多情绪混合和细粒度控制。
4. text 只放要朗读的文本，不要插入（小声）（笑）这类音频标签；只裁掉非朗读内容。
5. 如果没有任何可朗读内容，输出：{"instruction":"","text":"<EMPTY>"}。`;
        }

        return `${shared}

当前模式：音频标签控制。
1. MiMo 请求中，控制标签必须直接放在 role:assistant 的 content；role:user 只保留基础朗读说明。
2. 只输出最终 assistant 文本，不要 Markdown，不要 JSON，不要解释。
3. 可以在完整朗读文本开头或句间插入括号标签，优先使用中文全角括号，例如：（东北话）（四川话）（河南话）（粤语）（孙悟空）（林黛玉）（唱歌）（小声）（轻声）（提高音量喊话）（语速加快）（语速放慢）（笑）（轻笑）（大笑）（冷笑）（苦笑）（抽泣）（呜咽）（哽咽）（嚎啕大哭）（深呼吸）（急促呼吸）（咳嗽）（长叹一口气）（沉默片刻）。
4. 方言、角色、唱歌这类整体风格标签应放在最开头；唱歌必须用（唱歌）开头。
5. 情绪、呼吸、停顿、笑哭和语速标签可以插在对应句子前，但不要过度堆叠。`;
    }

    buildInnerMonologueInstruction() {
        if (this.settings.preprocessKeepInnerMonologue) {
            return '保留心理活动、内心独白和角色心声；可以把它们整理成可朗读文本，并用括号标注情绪或小声独白。不要把 <think>、reasoning、系统推理内容当成角色心理活动。';
        }

        return '去除心理活动和内心独白，只保留真正说出口的对白、喊话、低语、吐槽和拟声词。';
    }

    getStylePreset(id) {
        return this.settings.preprocessStylePresets.find((preset) => preset.id === id)
            || this.defaultSettings.preprocessStylePresets.find((preset) => preset.id === id)
            || null;
    }

    buildRequestBody(inputText, voice, preparedSpeech = null) {
        const voiceKind = this.getVoiceKind(voice);
        const prepared = this.normalizePreparedSpeech(preparedSpeech || inputText, inputText);
        const model = {
            preset: this.settings.presetModel,
            clone: this.settings.voiceCloneModel,
        }[voiceKind] || this.settings.presetModel;
        const baseUserPrompt = {
            preset: this.settings.instruction,
            clone: voice.prompt || this.settings.instruction,
        }[voiceKind] || this.settings.instruction;
        const userPrompt = [
            baseUserPrompt || this.defaultSettings.instruction,
            prepared.mode === 'natural-language' ? prepared.instruction : '',
        ].filter(Boolean).join('\n\n');

        const body = {
            model,
            messages: [
                {
                    role: 'user',
                    content: userPrompt || this.defaultSettings.instruction,
                },
                {
                    role: 'assistant',
                    content: prepared.text || inputText,
                },
            ],
            audio: {
                format: this.settings.format || 'wav',
                optimize_text_preview: Boolean(this.settings.optimizeTextPreview),
            },
        };

        if (voiceKind === 'preset') {
            body.audio.voice = this.presetVoiceValue(voice);
        }

        if (voiceKind === 'clone') {
            if (!voice.audioDataUrl) {
                throw new Error(`声音克隆音色缺少音频样本：${voice.name}`);
            }
            body.audio.voice = voice.audioDataUrl;
        }

        return body;
    }

    getVoiceKind(voice) {
        const voiceId = String(voice?.voice_id || '');
        if (voiceId.startsWith('clone:')) {
            return 'clone';
        }
        return 'preset';
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

        this.settings.clonedVoices = this.settings.clonedVoices.map((voice, index) => ({
            ...voice,
            voice_id: String(voice.voice_id || '').startsWith('clone:')
                ? String(voice.voice_id)
                : `clone:${this.slugify(voice.voice_id || voice.name || `clone-${index + 1}`)}`,
            lang: voice.lang || 'zh-CN',
            prompt: voice.prompt || '',
            fileName: voice.fileName || '',
            mimeType: voice.mimeType || '',
            audioDataUrl: voice.audioDataUrl || '',
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

    async addClonedVoice() {
        const name = String($('#mimo_tts_clone_voice_name').val() || '').trim();
        const prompt = String($('#mimo_tts_clone_voice_prompt').val() || '').trim();
        const editingVoiceId = String($('#mimo_tts_editing_clone_voice_id').val() || '').trim();
        const existingVoice = editingVoiceId
            ? this.settings.clonedVoices.find((voice) => voice.voice_id === editingVoiceId)
            : null;
        const file = document.querySelector('#mimo_tts_clone_voice_file')?.files?.[0] || null;

        if (!name) {
            toastr.error('请填写声音克隆显示名。');
            return;
        }

        if (!file && !existingVoice?.audioDataUrl) {
            toastr.error('请选择声音克隆音频样本。');
            return;
        }

        const audio = file ? await this.readCloneAudioFile(file) : {
            audioDataUrl: existingVoice.audioDataUrl,
            fileName: existingVoice.fileName,
            mimeType: existingVoice.mimeType,
        };
        const entry = {
            name,
            voice_id: editingVoiceId || `clone:${this.slugify(name)}`,
            lang: 'zh-CN',
            prompt,
            ...audio,
        };

        if (editingVoiceId) {
            this.settings.clonedVoices = this.settings.clonedVoices.map((voice) => voice.voice_id === editingVoiceId ? entry : voice);
            toastr.success('声音克隆已保存。', providerName);
        } else {
            this.settings.clonedVoices = this.upsertVoice(this.settings.clonedVoices, entry);
            toastr.success('声音克隆已添加。', providerName);
        }

        this.clearClonedVoiceForm();
        this.afterVoiceListChange();
    }

    async readCloneAudioFile(file) {
        const mimeType = this.normalizeCloneAudioMimeType(file.type, file.name);

        if (!mimeType) {
            throw new Error('声音克隆只支持 wav 或 mp3 音频。');
        }

        const audioDataUrl = await this.readFileAsDataUrl(file, mimeType);
        const base64 = audioDataUrl.split(',').pop() || '';
        if (base64.length > 10 * 1024 * 1024) {
            throw new Error('声音克隆音频 base64 超过 10MB，请换更短的样本。');
        }

        return {
            audioDataUrl,
            fileName: file.name,
            mimeType,
        };
    }

    normalizeCloneAudioMimeType(fileType, fileName) {
        const lowerName = String(fileName || '').toLowerCase();
        const type = String(fileType || '').toLowerCase();

        if (type.includes('wav') || lowerName.endsWith('.wav')) {
            return 'audio/wav';
        }

        if (type.includes('mpeg') || type.includes('mp3') || lowerName.endsWith('.mp3')) {
            return 'audio/mpeg';
        }

        return '';
    }

    readFileAsDataUrl(file, mimeType) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.includes(',') ? result.split(',').pop() : result;
                resolve(`data:${mimeType};base64,${base64}`);
            };
            reader.onerror = () => reject(reader.error || new Error('读取声音克隆音频失败。'));
            reader.readAsDataURL(file);
        });
    }

    editClonedVoice(voice) {
        $('#mimo_tts_clone_voice_name').val(voice.name || '');
        $('#mimo_tts_clone_voice_prompt').val(voice.prompt || '');
        $('#mimo_tts_editing_clone_voice_id').val(voice.voice_id || '');
        $('#mimo_tts_add_clone_voice').val('保存声音克隆');
        $('#mimo_tts_clone_voice_file').val('');
        this.updateCloneFileName(voice.fileName ? `保留原样本：${voice.fileName}` : '保留原音频样本');
    }

    clearClonedVoiceForm() {
        $('#mimo_tts_clone_voice_name, #mimo_tts_clone_voice_prompt, #mimo_tts_editing_clone_voice_id, #mimo_tts_clone_voice_file').val('');
        $('#mimo_tts_add_clone_voice').val('添加声音克隆');
        this.updateCloneFileName();
    }

    updateCloneFileName(fallbackText = '未选择文件') {
        const file = document.querySelector('#mimo_tts_clone_voice_file')?.files?.[0] || null;
        $('#mimo_tts_clone_voice_file_name').text(file?.name || fallbackText);
    }

    removeVoice(listName, voiceId) {
        this.settings[listName] = this.settings[listName].filter((voice) => voice.voice_id !== voiceId);
        this.afterVoiceListChange();
    }

    afterVoiceListChange() {
        this.renderVoiceLists();
        saveSettingsDebounced();
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
        this.renderVoiceList('#mimo_tts_clone_voice_list', 'clonedVoices');
        this.renderIndependentVoiceSelect();
    }

    renderStylePresetSelect() {
        const select = $('#mimo_tts_preprocess_style');
        select.empty();

        for (const preset of this.settings.preprocessStylePresets) {
            select.append($('<option></option>').val(preset.id).text(preset.name));
        }
    }

    renderIndependentVoiceSelect() {
        const select = $('#mimo_tts_independent_voice');

        if (!select.length) {
            return;
        }

        const currentValue = this.settings.independentVoiceId;
        const voices = this.getAllConfiguredVoices();
        select.empty();

        for (const voice of voices) {
            select.append($('<option></option>').val(voice.voice_id).text(voice.name));
        }

        if (voices.some((voice) => voice.voice_id === currentValue)) {
            select.val(currentValue);
        } else if (voices[0]) {
            this.settings.independentVoiceId = voices[0].voice_id;
            select.val(voices[0].voice_id);
        }
    }

    renderVoiceList(selector, listName) {
        const container = $(selector);
        container.empty();

        for (const voice of this.settings[listName]) {
            const row = $('<div></div>').addClass('mimo-tts-list-item');
            const detail = listName === 'clonedVoices' && voice.fileName ? `，${voice.fileName}` : '';
            const label = $('<span></span>').text(`${voice.name} (${voice.voice_id}${detail})`);
            const previewButton = $('<button></button>')
                .addClass('menu_button')
                .attr('type', 'button')
                .text('试听')
                .on('click', () => this.previewVoiceObject(voice).catch((error) => {
                    console.error('MiMo Advanced voice preview failed', error);
                    toastr.error(error.message || String(error), providerName);
                }));
            const editButton = listName === 'clonedVoices'
                ? $('<button></button>')
                    .addClass('menu_button')
                    .attr('type', 'button')
                    .text('编辑')
                    .on('click', () => {
                        this.editClonedVoice(voice);
                    })
                : null;
            const removeButton = $('<button></button>')
                .addClass('menu_button')
                .attr('type', 'button')
                .text('删除')
                .on('click', () => this.removeVoice(listName, voice.voice_id));

            row.append(label, previewButton);
            if (editButton) {
                row.append(editButton);
            }
            row.append(removeButton);
            container.append(row);
        }
    }

    getAllConfiguredVoices() {
        return [...this.settings.presetVoices, ...this.settings.clonedVoices];
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

const standaloneMimoAdvanced = new MimoTtsProvider();

jQuery(() => {
    standaloneMimoAdvanced.initStandaloneSettings().catch((error) => {
        console.error('MiMo Advanced standalone init failed', error);
        toastr.error(error.message || String(error), providerName);
    });
});

registerTtsProvider(providerName, MimoTtsProvider);
