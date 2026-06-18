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

        $('#mimo_tts_api_key, #mimo_tts_base_url, #mimo_tts_preset_model, #mimo_tts_voice_design_model, #mimo_tts_instruction').on('input', () => this.onSettingsChange());
        $('#mimo_tts_format, #mimo_tts_optimize_text_preview').on('change', () => this.onSettingsChange());
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
        saveTtsProviderSettings();
    }

    async checkReady() {
        if (!this.settings.apiKey) {
            throw new Error('MiMo API Key is required.');
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
        return this.fetchTtsGeneration(text, voice);
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

registerTtsProvider('MiMo', MimoTtsProvider);

