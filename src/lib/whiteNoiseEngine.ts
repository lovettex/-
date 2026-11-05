// Procedural Ambient & White Noise Audio Engine using Web Audio API
// High quality, 100% offline, zero external dependencies, infinite seamless playback.

export interface AmbientTrack {
  id: string;
  name: string;
  nameEn: string;
  category: 'noise' | 'nature' | 'meditation' | 'ambience' | 'music';
  icon: string;
  description: string;
  color: string;
}

export const AMBIENT_TRACKS: AmbientTrack[] = [
  // =========================================================================
  // CALM & LIGHT MUSIC (平靜輕音樂 / 療癒旋律)
  // =========================================================================
  {
    id: 'calm-piano',
    name: '平靜夜曲鋼琴',
    nameEn: 'Tranquil Nocturne Piano',
    category: 'music',
    icon: 'Music',
    description: '療癒溫暖的降E大調鋼琴和弦與靜心旋律，舒緩思緒',
    color: '#38bdf8',
  },
  {
    id: 'lofi-chill',
    name: 'Lo-Fi 沉靜晨光',
    nameEn: 'Chill Lo-Fi Melodies',
    category: 'music',
    icon: 'Coffee',
    description: '復古 Lo-Fi 電鋼琴暖調和弦與輕柔微醺放鬆旋律',
    color: '#fb923c',
  },
  {
    id: 'zen-harp',
    name: '水月空靈豎琴',
    nameEn: 'Ethereal Serene Harp',
    category: 'music',
    icon: 'Sparkles',
    description: '清泉流淌般的五聲階梯豎琴琶音，身心全然放鬆',
    color: '#a78bfa',
  },
  {
    id: 'morning-strings',
    name: '晨曦微光弦樂',
    nameEn: 'Soft Dawn Ambient Strings',
    category: 'music',
    icon: 'SunDim',
    description: '宛如晨曦穿透林間的溫暖大提琴與空靈弦樂重奏',
    color: '#34d399',
  },
  {
    id: 'crystal-musicbox',
    name: '星夜水晶八音盒',
    nameEn: 'Starlight Music Box',
    category: 'music',
    icon: 'Disc',
    description: '清脆純淨的水晶八音琴，撫平緊繃與焦慮情緒',
    color: '#f472b6',
  },
  {
    id: 'meditation-flute',
    name: '靜心竹笛與音磐',
    nameEn: 'Zen Meditation Flute',
    category: 'music',
    icon: 'Compass',
    description: '悠揚空靈的東方竹笛氣鳴與溫暖和聲音墊',
    color: '#2dd4bf',
  },
  // =========================================================================
  // CLASSIC WHITE NOISE & SOUNDSCAPES
  // =========================================================================
  {
    id: 'white-noise',
    name: '經典白噪音',
    nameEn: 'Pure White Noise',
    category: 'noise',
    icon: 'Radio',
    description: '全頻段平衡白噪音，有效遮蔽周遭雜音',
    color: '#94a3b8',
  },
  {
    id: 'pink-noise',
    name: '柔和粉紅噪音',
    nameEn: 'Pink Noise',
    category: 'noise',
    icon: 'Activity',
    description: '1/f 頻率曲線，低頻溫暖柔和，深度專注必備',
    color: '#f472b6',
  },
  {
    id: 'brown-noise',
    name: '深沉棕色噪音',
    nameEn: 'Brown Noise',
    category: 'noise',
    icon: 'Waves',
    description: '渾厚低沉的瀑布般轟鳴，放鬆緊繃神經',
    color: '#d97706',
  },
  {
    id: 'gentle-rain',
    name: '綿綿細雨',
    nameEn: 'Gentle Rain',
    category: 'nature',
    icon: 'CloudRain',
    description: '屋簷下的溫柔落雨聲，靜心安神',
    color: '#38bdf8',
  },
  {
    id: 'thunderstorm',
    name: '雷雨之夜',
    nameEn: 'Thunderstorm',
    category: 'nature',
    icon: 'CloudLightning',
    description: '連綿大雨伴隨遠方陣陣低沉雷鳴',
    color: '#818cf8',
  },
  {
    id: 'ocean-waves',
    name: '深海潮汐',
    nameEn: 'Ocean Waves',
    category: 'nature',
    icon: 'Waves',
    description: '浪潮拍岸的規律呼吸感，撫平焦慮',
    color: '#0ea5e9',
  },
  {
    id: 'mountain-stream',
    name: '山間溪流',
    nameEn: 'Mountain Stream',
    category: 'nature',
    icon: 'Droplets',
    description: '清脆潺潺的溪水流動與石間水花',
    color: '#14b8a6',
  },
  {
    id: 'night-crickets',
    name: '夏夜蟲鳴',
    nameEn: 'Night Crickets',
    category: 'nature',
    icon: 'Moon',
    description: '寧靜田野間的促織輕唱與夜風',
    color: '#a855f7',
  },
  {
    id: 'forest-birds',
    name: '森林鳥語',
    nameEn: 'Forest & Birds',
    category: 'nature',
    icon: 'Trees',
    description: '樹影婆娑的微風與偶發空靈鳥啼',
    color: '#22c55e',
  },
  {
    id: 'campfire',
    name: '營火木炭',
    nameEn: 'Campfire & Crackle',
    category: 'nature',
    icon: 'Flame',
    description: '溫暖柴火燃燒與劈啪作響的炭火微粒',
    color: '#f97316',
  },
  {
    id: 'gentle-wind',
    name: '微風徐徐',
    nameEn: 'Gentle Breeze',
    category: 'nature',
    icon: 'Wind',
    description: '穿過原野的柔和風聲，開闊心境',
    color: '#2dd4bf',
  },
  {
    id: 'cosmic-drone',
    name: '宇宙冥想',
    nameEn: 'Cosmic Drone',
    category: 'meditation',
    icon: 'Sparkles',
    description: '108Hz 諧波共鳴星際音場，引導深層放鬆',
    color: '#c084fc',
  },
  {
    id: 'tibetan-bowl',
    name: '頌缽靜心',
    nameEn: 'Singing Bowl',
    category: 'meditation',
    icon: 'Bell',
    description: '西藏頌缽持久綿長的純淨泛音共振',
    color: '#fbbf24',
  },
  {
    id: 'alpha-432hz',
    name: '432Hz 阿爾法波',
    nameEn: '432Hz Alpha Wave',
    category: 'meditation',
    icon: 'Zap',
    description: '宇宙自然調律與 10Hz 雙耳阿爾法專注腦波',
    color: '#10b981',
  },
  {
    id: 'focus-528hz',
    name: '528Hz 奇蹟專注',
    nameEn: '528Hz Miracle Tone',
    category: 'meditation',
    icon: 'Compass',
    description: '修復頻率結合空靈氛圍音墊',
    color: '#06b6d4',
  },
  {
    id: 'vinyl-crackle',
    name: '復古黑膠',
    nameEn: 'Vinyl Crackle',
    category: 'ambience',
    icon: 'Disc',
    description: '溫暖留聲機轉動雜音與Lo-Fi懷舊底噪',
    color: '#eab308',
  },
  {
    id: 'cozy-cafe',
    name: '午後咖啡館',
    nameEn: 'Cozy Cafe',
    category: 'ambience',
    icon: 'Coffee',
    description: '隱約輕聲呢喃與陶瓷杯匙輕碰的沉浸感',
    color: '#b45309',
  },
  {
    id: 'clock-tick',
    name: '極簡鐘擺',
    nameEn: 'Clock Ticking',
    category: 'ambience',
    icon: 'Clock',
    description: '穩定 60 BPM 滴答節奏，番茄工作法最佳拍檔',
    color: '#64748b',
  },
  {
    id: 'library-silence',
    name: '圖書館靜讀',
    nameEn: 'Library Ambience',
    category: 'ambience',
    icon: 'BookOpen',
    description: '空調微流與深邃沉靜的閱讀空間感',
    color: '#6b7280',
  },
  {
    id: 'night-train',
    name: '夜行鐵道',
    nameEn: 'Night Train',
    category: 'ambience',
    icon: 'TrainTrack',
    description: '車輪過軌的催眠律動與穩定行駛聲',
    color: '#475569',
  },
  {
    id: 'starlight-pad',
    name: '微光星空',
    nameEn: 'Starlight Ambient',
    category: 'meditation',
    icon: 'SunDim',
    description: '緩慢流動的空靈大九和弦音景',
    color: '#6366f1',
  },
  {
    id: 'zen-droplets',
    name: '禪宗水滴',
    nameEn: 'Zen Water Droplets',
    category: 'nature',
    icon: 'CircleDot',
    description: '靜水微瀾的清脆水滴與空靈回音',
    color: '#0284c7',
  },
  {
    id: 'aurora-glow',
    name: '極光音場',
    nameEn: 'Aurora Glow',
    category: 'meditation',
    icon: 'Eye',
    description: '宛如歐若拉光帶流動的超低頻調制音',
    color: '#4ade80',
  },
  {
    id: 'whale-song',
    name: '深海鯨鳴',
    nameEn: 'Deep Ocean Whale',
    category: 'nature',
    icon: 'Fish',
    description: '深海長波共振與悠遠悠揚的鯨魚呼喚',
    color: '#3b82f6',
  }
];

export interface WhiteNoiseState {
  isPlaying: boolean;
  currentTrackIndex: number;
  volume: number; // 0 to 1
  isMuted: boolean;
  randomMode: boolean;
  bgEnabled: boolean;
  bgThemeId: string;
  bgSpeed: number; // 0.2 to 2.0, default 0.5 (slower & calmer)
}

type StateListener = (state: WhiteNoiseState) => void;

class WhiteNoiseEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: Array<{ stop?: () => void; disconnect?: () => void }> = [];
  private activeIntervals: number[] = [];
  
  private state: WhiteNoiseState = {
    isPlaying: false,
    currentTrackIndex: 0,
    volume: 0.5,
    isMuted: false,
    randomMode: true,
    bgEnabled: true,
    bgThemeId: 'texture-overlay-video',
    bgSpeed: 0.5,
  };

  private listeners: Set<StateListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedVol = localStorage.getItem('ambient_sound_volume');
        if (savedVol !== null) {
          const v = parseFloat(savedVol);
          if (!isNaN(v) && v >= 0 && v <= 1) {
            this.state.volume = v;
          }
        }
        const savedIdx = localStorage.getItem('ambient_sound_index');
        if (savedIdx !== null) {
          const idx = parseInt(savedIdx, 10);
          if (!isNaN(idx) && idx >= 0 && idx < AMBIENT_TRACKS.length) {
            this.state.currentTrackIndex = idx;
          }
        }
        const savedBgTheme = localStorage.getItem('ambient_bg_theme_v3');
        if (
          savedBgTheme === 'texture-overlay-video' ||
          savedBgTheme === 'anton-cinematic-video' ||
          savedBgTheme === 'fullpage-loop-video' ||
          savedBgTheme === 'native-scrub-video' ||
          savedBgTheme === 'lavender-gaze-heart'
        ) {
          this.state.bgThemeId = savedBgTheme;
        }
        const savedBgEnabled = localStorage.getItem('ambient_bg_enabled');
        if (savedBgEnabled !== null) {
          this.state.bgEnabled = savedBgEnabled === 'true';
        }
        const savedBgSpeed = localStorage.getItem('ambient_bg_speed');
        if (savedBgSpeed !== null) {
          const spd = parseFloat(savedBgSpeed);
          if (!isNaN(spd) && spd >= 0.1 && spd <= 3.0) {
            this.state.bgSpeed = spd;
          }
        }
      } catch {}
    }
  }

  public setBgSpeed(speed: number) {
    const clamped = Math.max(0.15, Math.min(2.0, speed));
    this.state.bgSpeed = clamped;
    try {
      localStorage.setItem('ambient_bg_speed', clamped.toString());
    } catch {}
    this.notify();
  }

  public setBgTheme(themeId: string) {
    this.state.bgThemeId = themeId;
    try {
      localStorage.setItem('ambient_bg_theme_v3', themeId);
    } catch {}
    this.notify();
  }

  public toggleBgEnabled() {
    this.state.bgEnabled = !this.state.bgEnabled;
    try {
      localStorage.setItem('ambient_bg_enabled', this.state.bgEnabled.toString());
    } catch {}
    this.notify();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = { ...this.state };
    this.listeners.forEach(fn => fn(s));
  }

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getState(): WhiteNoiseState {
    return { ...this.state };
  }

  public getCurrentTrack(): AmbientTrack {
    return AMBIENT_TRACKS[this.state.currentTrackIndex] || AMBIENT_TRACKS[0];
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.state.volume = clamped;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      const effective = this.state.isMuted ? 0 : clamped;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(effective, now + 0.05);
    }
    try {
      localStorage.setItem('ambient_sound_volume', clamped.toString());
    } catch {}
    this.notify();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      const effective = this.state.isMuted ? 0 : this.state.volume;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(effective, now + 0.05);
    }
    this.notify();
  }

  public async togglePlay() {
    if (this.state.isPlaying) {
      this.stop();
    } else {
      await this.play();
    }
  }

  public async play(trackIndex?: number) {
    if (typeof trackIndex === 'number') {
      this.state.currentTrackIndex = (trackIndex + AMBIENT_TRACKS.length) % AMBIENT_TRACKS.length;
      try {
        localStorage.setItem('ambient_sound_index', this.state.currentTrackIndex.toString());
      } catch {}
    }

    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Stop current track nodes with short crossfade
    this.stopNodes();

    // Create fresh Master Gain
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.connect(ctx.destination);
    }

    const now = ctx.currentTime;
    const targetVol = this.state.isMuted ? 0 : this.state.volume;
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVol), now + 0.35);

    // Build the specific synthesis pipeline
    const track = AMBIENT_TRACKS[this.state.currentTrackIndex];
    this.synthesizeTrack(track.id, ctx, this.masterGain);

    this.state.isPlaying = true;
    this.notify();
  }

  public stop() {
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      setTimeout(() => {
        this.stopNodes();
      }, 320);
    } else {
      this.stopNodes();
    }

    this.state.isPlaying = false;
    this.notify();
  }

  public nextTrack() {
    const nextIdx = (this.state.currentTrackIndex + 1) % AMBIENT_TRACKS.length;
    if (this.state.isPlaying) {
      this.play(nextIdx);
    } else {
      this.state.currentTrackIndex = nextIdx;
      try {
        localStorage.setItem('ambient_sound_index', nextIdx.toString());
      } catch {}
      this.notify();
    }
  }

  public prevTrack() {
    const prevIdx = (this.state.currentTrackIndex - 1 + AMBIENT_TRACKS.length) % AMBIENT_TRACKS.length;
    if (this.state.isPlaying) {
      this.play(prevIdx);
    } else {
      this.state.currentTrackIndex = prevIdx;
      try {
        localStorage.setItem('ambient_sound_index', prevIdx.toString());
      } catch {}
      this.notify();
    }
  }

  /**
   * Randomly switch to a different track (out of 20+ tracks)
   */
  public shuffleRandom() {
    const total = AMBIENT_TRACKS.length;
    if (total <= 1) return;

    let nextIdx = Math.floor(Math.random() * total);
    // Ensure we don't pick the exact same index if multiple exist
    if (nextIdx === this.state.currentTrackIndex) {
      nextIdx = (nextIdx + 1) % total;
    }

    if (this.state.isPlaying) {
      this.play(nextIdx);
    } else {
      // If not currently playing, start playing the randomly picked track
      this.play(nextIdx);
    }
  }

  public selectTrack(index: number) {
    if (index < 0 || index >= AMBIENT_TRACKS.length) return;
    if (this.state.isPlaying) {
      this.play(index);
    } else {
      this.state.currentTrackIndex = index;
      try {
        localStorage.setItem('ambient_sound_index', index.toString());
      } catch {}
      this.notify();
    }
  }

  private stopNodes() {
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals = [];

    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch {}
    });
    this.activeNodes = [];
  }

  // --- AUDIO SYNTHESIS GENERATORS ---

  private createNoiseBuffer(ctx: AudioContext, seconds: number = 5): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return buffer;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds: number = 5): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  private createBrownNoiseBuffer(ctx: AudioContext, seconds: number = 5): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain compensation
      }
    }
    return buffer;
  }

  private startLoopingSource(buffer: AudioBuffer, ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0);
    this.activeNodes.push(src);
    return src;
  }

  private synthesizeTrack(trackId: string, ctx: AudioContext, destination: GainNode) {
    switch (trackId) {
      case 'white-noise': {
        const noise = this.startLoopingSource(this.createNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(6000, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(filter, gain);
        break;
      }

      case 'pink-noise': {
        const noise = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.26, ctx.currentTime);
        noise.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(gain);
        break;
      }

      case 'brown-noise': {
        const noise = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.32, ctx.currentTime);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(filter, gain);
        break;
      }

      case 'gentle-rain': {
        // Rain is filtered pink noise with subtle high-frequency sizzle and low drops
        const pink = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, ctx.currentTime);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.24, ctx.currentTime);
        pink.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(filter, gain);

        // High frequency droplets layer
        const white = this.startLoopingSource(this.createNoiseBuffer(ctx), ctx);
        const highPass = ctx.createBiquadFilter();
        highPass.type = 'bandpass';
        highPass.frequency.setValueAtTime(4500, ctx.currentTime);
        highPass.Q.setValueAtTime(1.5, ctx.currentTime);
        const highGain = ctx.createGain();
        highGain.gain.setValueAtTime(0.04, ctx.currentTime);
        white.connect(highPass);
        highPass.connect(highGain);
        highGain.connect(destination);
        this.activeNodes.push(highPass, highGain);
        break;
      }

      case 'thunderstorm': {
        // Continuous rain background
        const rain = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const rainFilter = ctx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.setValueAtTime(2200, ctx.currentTime);
        const rainGain = ctx.createGain();
        rainGain.gain.setValueAtTime(0.22, ctx.currentTime);
        rain.connect(rainFilter);
        rainFilter.connect(rainGain);
        rainGain.connect(destination);
        this.activeNodes.push(rainFilter, rainGain);

        // Periodic thunder simulation
        const triggerThunder = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const thunderOsc = ctx.createOscillator();
          const thunderGain = ctx.createGain();
          const thunderFilter = ctx.createBiquadFilter();

          thunderOsc.type = 'triangle';
          thunderOsc.frequency.setValueAtTime(90, now);
          thunderOsc.frequency.exponentialRampToValueAtTime(32, now + 2.5);

          thunderFilter.type = 'lowpass';
          thunderFilter.frequency.setValueAtTime(160, now);

          thunderGain.gain.setValueAtTime(0.001, now);
          thunderGain.gain.linearRampToValueAtTime(0.25, now + 0.4);
          thunderGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

          thunderOsc.connect(thunderFilter);
          thunderFilter.connect(thunderGain);
          thunderGain.connect(destination);

          thunderOsc.start(now);
          thunderOsc.stop(now + 3.3);
          this.activeNodes.push(thunderOsc, thunderGain, thunderFilter);
        };

        triggerThunder();
        const interval = window.setInterval(() => {
          triggerThunder();
        }, 11000 + Math.random() * 8000);
        this.activeIntervals.push(interval);
        break;
      }

      case 'ocean-waves': {
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, ctx.currentTime);

        // Slow LFO for ebb & flow (period ~8 seconds)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.125, ctx.currentTime); // ~8s cycle

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.18, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        // Filter modulation
        const lfoFilterGain = ctx.createGain();
        lfoFilterGain.gain.setValueAtTime(450, ctx.currentTime);
        lfo.connect(lfoFilterGain);
        lfoFilterGain.connect(filter.frequency);

        brown.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        lfo.start(0);
        this.activeNodes.push(brown, filter, gain, lfo, lfoGain, lfoFilterGain);
        break;
      }

      case 'mountain-stream': {
        const pink = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, ctx.currentTime);
        filter.Q.setValueAtTime(0.8, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.24, ctx.currentTime);

        // Fast subtle bubbling modulation
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(3.5, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(200, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        pink.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        lfo.start(0);
        this.activeNodes.push(pink, filter, gain, lfo, lfoGain);
        break;
      }

      case 'night-crickets': {
        // Calm nighttime background breeze
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const bFilter = ctx.createBiquadFilter();
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(250, ctx.currentTime);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0.08, ctx.currentTime);
        brown.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(destination);
        this.activeNodes.push(bFilter, bGain);

        // Cricket oscillator cluster with rapid amplitude modulation
        const cricketOsc = ctx.createOscillator();
        cricketOsc.type = 'sine';
        cricketOsc.frequency.setValueAtTime(4600, ctx.currentTime);

        const cricketMod = ctx.createOscillator();
        cricketMod.type = 'square';
        cricketMod.frequency.setValueAtTime(14, ctx.currentTime); // 14Hz chirp pulses

        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(0.03, ctx.currentTime);

        const cricketGain = ctx.createGain();
        cricketGain.gain.setValueAtTime(0.04, ctx.currentTime);

        cricketMod.connect(modGain);
        modGain.connect(cricketGain.gain);

        cricketOsc.connect(cricketGain);
        cricketGain.connect(destination);

        cricketOsc.start(0);
        cricketMod.start(0);
        this.activeNodes.push(cricketOsc, cricketMod, modGain, cricketGain);
        break;
      }

      case 'forest-birds': {
        // Forest breeze
        const pink = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.Q.setValueAtTime(0.5, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        pink.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(filter, gain);

        // Generative bird chirps
        const triggerBirdChirp = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const baseFreq = 2200 + Math.random() * 1200;
          const osc = ctx.createOscillator();
          const bGain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.08);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.18);

          bGain.gain.setValueAtTime(0.001, now);
          bGain.gain.linearRampToValueAtTime(0.06, now + 0.04);
          bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

          osc.connect(bGain);
          bGain.connect(destination);
          osc.start(now);
          osc.stop(now + 0.25);
          this.activeNodes.push(osc, bGain);
        };

        const interval = window.setInterval(() => {
          if (Math.random() > 0.3) {
            triggerBirdChirp();
            setTimeout(triggerBirdChirp, 180);
          }
        }, 3200);
        this.activeIntervals.push(interval);
        break;
      }

      case 'campfire': {
        // Low warm fire rumble
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.24, ctx.currentTime);
        brown.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(filter, gain);

        // Crackle / Wood pops
        const triggerPop = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const pGain = ctx.createGain();
          const pFilter = ctx.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800 + Math.random() * 1500, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.02);

          pFilter.type = 'highpass';
          pFilter.frequency.setValueAtTime(600, now);

          pGain.gain.setValueAtTime(0.08 + Math.random() * 0.07, now);
          pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

          osc.connect(pFilter);
          pFilter.connect(pGain);
          pGain.connect(destination);

          osc.start(now);
          osc.stop(now + 0.04);
          this.activeNodes.push(osc, pGain, pFilter);
        };

        const interval = window.setInterval(() => {
          if (Math.random() > 0.25) triggerPop();
        }, 120);
        this.activeIntervals.push(interval);
        break;
      }

      case 'gentle-wind': {
        const pink = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, ctx.currentTime);
        filter.Q.setValueAtTime(1.8, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.22, ctx.currentTime);

        // Slow swaying modulation (wind gusts)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // 5s cycle
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(320, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        pink.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        lfo.start(0);
        this.activeNodes.push(pink, filter, gain, lfo, lfoGain);
        break;
      }

      case 'cosmic-drone': {
        // Deep cosmic harmonic series (108Hz, 216Hz, 324Hz, 432Hz)
        const freqs = [108, 216, 324, 432];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(f + (Math.random() * 0.4 - 0.2), ctx.currentTime);

          gain.gain.setValueAtTime(0.08 / (idx + 1), ctx.currentTime);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(0);
          this.activeNodes.push(osc, gain);
        });
        break;
      }

      case 'tibetan-bowl': {
        // Tibetan singing bowl physical harmonic synthesis
        const bowlFreq = 261.63; // C4
        const partials = [
          { mult: 1.0, gain: 0.12 },
          { mult: 2.76, gain: 0.08 },
          { mult: 4.76, gain: 0.05 },
          { mult: 5.4, gain: 0.03 },
        ];

        partials.forEach(p => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(bowlFreq * p.mult, ctx.currentTime);

          // Subtle tremolo
          const tremolo = ctx.createOscillator();
          tremolo.type = 'sine';
          tremolo.frequency.setValueAtTime(0.5, ctx.currentTime);
          const tremoloGain = ctx.createGain();
          tremoloGain.gain.setValueAtTime(p.gain * 0.3, ctx.currentTime);
          tremolo.connect(tremoloGain);
          tremoloGain.connect(g.gain);

          g.gain.setValueAtTime(p.gain, ctx.currentTime);

          osc.connect(g);
          g.connect(destination);
          osc.start(0);
          tremolo.start(0);
          this.activeNodes.push(osc, g, tremolo, tremoloGain);
        });
        break;
      }

      case 'alpha-432hz': {
        // 432Hz carrier with 10Hz binaural delta/alpha frequency
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        const gainL = ctx.createGain();
        const gainR = ctx.createGain();

        oscL.type = 'sine';
        oscL.frequency.setValueAtTime(432, ctx.currentTime);
        oscR.type = 'sine';
        oscR.frequency.setValueAtTime(442, ctx.currentTime); // 10Hz Alpha difference

        gainL.gain.setValueAtTime(0.07, ctx.currentTime);
        gainR.gain.setValueAtTime(0.07, ctx.currentTime);

        oscL.connect(gainL);
        gainL.connect(destination);
        oscR.connect(gainR);
        gainR.connect(destination);

        oscL.start(0);
        oscR.start(0);
        this.activeNodes.push(oscL, oscR, gainL, gainR);
        break;
      }

      case 'focus-528hz': {
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();
        const subGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(528, ctx.currentTime); // Solfeggio 528Hz
        gain.gain.setValueAtTime(0.06, ctx.currentTime);

        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(132, ctx.currentTime);
        subGain.gain.setValueAtTime(0.08, ctx.currentTime);

        osc.connect(gain);
        gain.connect(destination);
        subOsc.connect(subGain);
        subGain.connect(destination);

        osc.start(0);
        subOsc.start(0);
        this.activeNodes.push(osc, subOsc, gain, subGain);
        break;
      }

      case 'vinyl-crackle': {
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const bFilter = ctx.createBiquadFilter();
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(300, ctx.currentTime);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0.1, ctx.currentTime);
        brown.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(destination);
        this.activeNodes.push(bFilter, bGain);

        // Periodic turntable dust pops
        const triggerCrackle = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const cGain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(2800 + Math.random() * 2000, now);
          cGain.gain.setValueAtTime(0.04 + Math.random() * 0.05, now);
          cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
          osc.connect(cGain);
          cGain.connect(destination);
          osc.start(now);
          osc.stop(now + 0.015);
          this.activeNodes.push(osc, cGain);
        };

        const interval = window.setInterval(() => {
          if (Math.random() > 0.4) triggerCrackle();
        }, 60);
        this.activeIntervals.push(interval);
        break;
      }

      case 'cozy-cafe': {
        // Cafe low murmur simulation
        const pink = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const f1 = ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.frequency.setValueAtTime(450, ctx.currentTime);
        f1.Q.setValueAtTime(2.0, ctx.currentTime);

        const f2 = ctx.createBiquadFilter();
        f2.type = 'bandpass';
        f2.frequency.setValueAtTime(1400, ctx.currentTime);
        f2.Q.setValueAtTime(1.5, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.16, ctx.currentTime);

        pink.connect(f1);
        pink.connect(f2);
        f1.connect(gain);
        f2.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(f1, f2, gain);

        // Cup / Spoon delicate high clink
        const triggerCupClink = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const clinkGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(3200 + Math.random() * 800, now);
          clinkGain.gain.setValueAtTime(0.03, now);
          clinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(clinkGain);
          clinkGain.connect(destination);
          osc.start(now);
          osc.stop(now + 0.15);
          this.activeNodes.push(osc, clinkGain);
        };

        const interval = window.setInterval(() => {
          if (Math.random() > 0.6) triggerCupClink();
        }, 5000);
        this.activeIntervals.push(interval);
        break;
      }

      case 'clock-tick': {
        // Precise 60 BPM acoustic clock tick
        let tickCount = 0;
        const triggerTick = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const isTock = (tickCount % 2 === 1);
          tickCount++;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(isTock ? 1200 : 1600, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.015);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(now);
          osc.stop(now + 0.025);
          this.activeNodes.push(osc, gain);
        };

        triggerTick();
        const interval = window.setInterval(triggerTick, 1000);
        this.activeIntervals.push(interval);
        break;
      }

      case 'library-silence': {
        // Deep library air circulation tone
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        brown.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(filter, gain);
        break;
      }

      case 'night-train': {
        // Rhythm of wheels on track (ta-ta-tum ... ta-ta-tum)
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        brown.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(filter, gain);

        const triggerRailBeat = () => {
          if (!this.state.isPlaying) return;
          const pattern = [0, 0.16, 0.32];
          pattern.forEach(offset => {
            const now = ctx.currentTime + offset;
            const osc = ctx.createOscillator();
            const rGain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

            rGain.gain.setValueAtTime(0.09, now);
            rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(rGain);
            rGain.connect(destination);
            osc.start(now);
            osc.stop(now + 0.1);
            this.activeNodes.push(osc, rGain);
          });
        };

        triggerRailBeat();
        const interval = window.setInterval(triggerRailBeat, 1350);
        this.activeIntervals.push(interval);
        break;
      }

      case 'starlight-pad': {
        // Ethereal chord pad: Fmaj9 / Cmaj9 ambient harmony
        const chord = [174.61, 220.00, 261.63, 329.63, 392.00]; // F3, A3, C4, E4, G4
        chord.forEach(f => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, ctx.currentTime);

          // Gentle slow breathing envelope
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.setValueAtTime(0.15 + Math.random() * 0.05, ctx.currentTime);
          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);
          lfo.connect(lfoGain);
          lfoGain.connect(g.gain);

          g.gain.setValueAtTime(0.04, ctx.currentTime);

          osc.connect(g);
          g.connect(destination);
          osc.start(0);
          lfo.start(0);
          this.activeNodes.push(osc, g, lfo, lfoGain);
        });
        break;
      }

      case 'zen-droplets': {
        const triggerDrop = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const base = 800 + Math.random() * 600;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(base, now);
          osc.frequency.exponentialRampToValueAtTime(base * 1.8, now + 0.04);
          osc.frequency.exponentialRampToValueAtTime(base * 0.6, now + 0.16);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(now);
          osc.stop(now + 0.4);
          this.activeNodes.push(osc, gain);
        };

        const interval = window.setInterval(() => {
          if (Math.random() > 0.4) triggerDrop();
        }, 1800);
        this.activeIntervals.push(interval);
        break;
      }

      case 'aurora-glow': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g1 = ctx.createGain();
        const g2 = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(216, ctx.currentTime);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(432.5, ctx.currentTime);

        g1.gain.setValueAtTime(0.06, ctx.currentTime);
        g2.gain.setValueAtTime(0.04, ctx.currentTime);

        osc1.connect(g1);
        g1.connect(destination);
        osc2.connect(g2);
        g2.connect(destination);

        osc1.start(0);
        osc2.start(0);
        this.activeNodes.push(osc1, osc2, g1, g2);
        break;
      }

      case 'whale-song': {
        // Deep water rumble
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const bFilter = ctx.createBiquadFilter();
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(140, ctx.currentTime);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0.18, ctx.currentTime);
        brown.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(destination);
        this.activeNodes.push(bFilter, bGain);

        // Whale melodic gliding tone
        const triggerWhale = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const wGain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(320, now + 1.2);
          osc.frequency.exponentialRampToValueAtTime(110, now + 2.8);

          wGain.gain.setValueAtTime(0.001, now);
          wGain.gain.linearRampToValueAtTime(0.08, now + 0.6);
          wGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

          osc.connect(wGain);
          wGain.connect(destination);
          osc.start(now);
          osc.stop(now + 3.1);
          this.activeNodes.push(osc, wGain);
        };

        const interval = window.setInterval(() => {
          if (Math.random() > 0.4) triggerWhale();
        }, 7000);
        this.activeIntervals.push(interval);
        break;
      }

      case 'calm-piano': {
        // Tranquil Nocturne Piano (降E大調溫暖鋼琴和弦與靜心旋律)
        const chords = [
          [155.56, 196.0, 233.08, 293.66, 349.23], // Ebmaj9
          [130.81, 155.56, 196.0, 233.08, 293.66], // Cm9
          [103.83, 155.56, 207.65, 261.63, 349.23, 392.0], // Abmaj9
          [116.54, 174.61, 233.08, 261.63, 311.13, 349.23], // Bb7sus4
          [98.0, 146.83, 196.0, 233.08, 293.66, 349.23], // Gm7
        ];
        let chordIdx = 0;

        // Background gentle ambient warm pad
        const padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(420, ctx.currentTime);
        const padGain = ctx.createGain();
        padGain.gain.setValueAtTime(0.06, ctx.currentTime);
        padFilter.connect(padGain);
        padGain.connect(destination);
        this.activeNodes.push(padFilter, padGain);

        // Soft Piano Note Generator
        const triggerPianoNote = (freq: number, velocity: number = 0.08, duration: number = 2.4) => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;

          // Fundamental + 2nd Harmonic for piano richness
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(freq, now);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(freq * 2.0, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(Math.min(1800, freq * 3.2), now);
          filter.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.1), now + duration * 0.8);

          // Piano envelope: sharp 12ms attack, exponential decay
          noteGain.gain.setValueAtTime(0.0001, now);
          noteGain.gain.linearRampToValueAtTime(velocity, now + 0.015);
          noteGain.gain.exponentialRampToValueAtTime(velocity * 0.45, now + 0.35);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

          osc1.connect(noteGain);
          osc2.connect(noteGain);
          noteGain.connect(filter);
          filter.connect(destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + duration + 0.05);
          osc2.stop(now + duration + 0.05);

          this.activeNodes.push(osc1, osc2, noteGain, filter);
        };

        // Arpeggiated chord and gentle melody loop
        const playPianoBar = () => {
          if (!this.state.isPlaying) return;
          const currentChord = chords[chordIdx % chords.length];
          chordIdx++;

          // Play bass root note
          triggerPianoNote(currentChord[0], 0.09, 3.8);

          // Gentle staggered chord notes
          currentChord.slice(1).forEach((freq, idx) => {
            setTimeout(() => {
              if (this.state.isPlaying) {
                triggerPianoNote(freq, 0.05 + Math.random() * 0.02, 3.2);
              }
            }, (idx + 1) * 380);
          });

          // Randomized peaceful top melody notes
          const melodyNotes = [311.13, 349.23, 392.0, 466.16, 523.25, 587.33, 622.25];
          const melCount = 2 + Math.floor(Math.random() * 3);
          for (let m = 0; m < melCount; m++) {
            const delay = 1800 + m * (600 + Math.random() * 400);
            const melFreq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
            setTimeout(() => {
              if (this.state.isPlaying) {
                triggerPianoNote(melFreq, 0.045 + Math.random() * 0.02, 2.0);
              }
            }, delay);
          }
        };

        playPianoBar();
        const interval = window.setInterval(playPianoBar, 4800);
        this.activeIntervals.push(interval);
        break;
      }

      case 'lofi-chill': {
        // Lo-Fi 沉靜晨光 (Warm Electric Piano Chords + Vinyl & Calming Melodies)
        const brown = this.startLoopingSource(this.createBrownNoiseBuffer(ctx), ctx);
        const vinylFilter = ctx.createBiquadFilter();
        vinylFilter.type = 'bandpass';
        vinylFilter.frequency.setValueAtTime(320, ctx.currentTime);
        const vinylGain = ctx.createGain();
        vinylGain.gain.setValueAtTime(0.06, ctx.currentTime);
        brown.connect(vinylFilter);
        vinylFilter.connect(vinylGain);
        vinylGain.connect(destination);
        this.activeNodes.push(vinylFilter, vinylGain);

        // Electric piano Rhodes chords
        const lofiChords = [
          [174.61, 220.0, 261.63, 329.63], // Fmaj7
          [164.81, 196.0, 246.94, 293.66], // Em7
          [146.83, 174.61, 220.0, 261.63], // Dm7
          [130.81, 164.81, 196.0, 246.94], // Cmaj7
        ];
        let lofiIdx = 0;

        const triggerLofiChord = () => {
          if (!this.state.isPlaying) return;
          const chord = lofiChords[lofiIdx % lofiChords.length];
          lofiIdx++;
          const now = ctx.currentTime;

          chord.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            // Subtle vintage pitch vibrato
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(4.2, now);
            lfoGain.gain.setValueAtTime(1.8, now);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.045, now + 0.08 + i * 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);

            osc.connect(gain);
            gain.connect(destination);

            osc.start(now);
            lfo.start(now);
            osc.stop(now + 3.5);
            lfo.stop(now + 3.5);

            this.activeNodes.push(osc, gain, lfo, lfoGain);
          });
        };

        triggerLofiChord();
        const interval = window.setInterval(triggerLofiChord, 3600);
        this.activeIntervals.push(interval);
        break;
      }

      case 'zen-harp': {
        // 水月空靈豎琴 (Cascading D Major Pentatonic Harp Glissandos)
        const harpScale = [
          146.83, 164.81, 185.0, 220.0, 246.94,
          293.66, 329.63, 369.99, 440.0, 493.88,
          587.33, 659.25, 739.99, 880.0
        ];

        const triggerHarpPluck = (freq: number, delayMs: number = 0, vel: number = 0.07) => {
          setTimeout(() => {
            if (!this.state.isPlaying) return;
            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(freq, now);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 2.0, now);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(vel, now + 0.008);
            gain.gain.exponentialRampToValueAtTime(vel * 0.3, now + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 2.9);
            osc2.stop(now + 2.9);

            this.activeNodes.push(osc1, osc2, gain);
          }, delayMs);
        };

        const playHarpSequence = () => {
          if (!this.state.isPlaying) return;
          const startIdx = Math.floor(Math.random() * 5);
          const noteCount = 4 + Math.floor(Math.random() * 4);
          const isUp = Math.random() > 0.3;

          for (let i = 0; i < noteCount; i++) {
            const scaleIdx = isUp ? startIdx + i : startIdx + noteCount - i;
            const safeIdx = Math.max(0, Math.min(harpScale.length - 1, scaleIdx));
            triggerHarpPluck(harpScale[safeIdx], i * 160, 0.065 + Math.random() * 0.02);
          }
        };

        playHarpSequence();
        const interval = window.setInterval(playHarpSequence, 3200);
        this.activeIntervals.push(interval);
        break;
      }

      case 'morning-strings': {
        // 晨曦微光弦樂 (Warm Ambient Orchestral Strings & Cello Swells)
        const chordProgressions = [
          [73.42, 146.83, 220.0, 277.18, 369.99], // Dmaj9 (D2, D3, A3, C#4, F#4)
          [98.0, 146.83, 196.0, 246.94, 329.63],  // Gmaj9 (G2, D3, G3, B3, E4)
          [123.47, 185.0, 220.0, 293.66, 369.99], // Bm9   (B2, F#3, A3, D4, F#4)
          [110.0, 164.81, 220.0, 293.66, 329.63], // Asus4 (A2, E3, A3, D4, E4)
        ];
        let stringChordIdx = 0;

        const playStringSwell = () => {
          if (!this.state.isPlaying) return;
          const chord = chordProgressions[stringChordIdx % chordProgressions.length];
          stringChordIdx++;
          const now = ctx.currentTime;
          const swellDuration = 5.2;

          chord.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = idx === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(idx === 0 ? 220 : 600, now);
            filter.frequency.linearRampToValueAtTime(idx === 0 ? 340 : 900, now + swellDuration * 0.4);
            filter.frequency.linearRampToValueAtTime(idx === 0 ? 180 : 400, now + swellDuration);

            const vol = idx === 0 ? 0.05 : 0.035;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(vol, now + 1.8);
            gain.gain.linearRampToValueAtTime(vol * 0.8, now + 3.5);
            gain.gain.linearRampToValueAtTime(0.0001, now + swellDuration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(destination);

            osc.start(now);
            osc.stop(now + swellDuration + 0.1);

            this.activeNodes.push(osc, filter, gain);
          });
        };

        playStringSwell();
        const interval = window.setInterval(playStringSwell, 5000);
        this.activeIntervals.push(interval);
        break;
      }

      case 'crystal-musicbox': {
        // 星夜水晶八音盒 (Pure Crystal Celesta & Music Box Chimes)
        const musicBoxScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
        
        const triggerMusicBoxNote = (freq: number, delayMs: number = 0) => {
          setTimeout(() => {
            if (!this.state.isPlaying) return;
            const now = ctx.currentTime;

            // Dual crystal inharmonic frequencies
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(freq, now);

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 2.756, now); // Metallic overtone

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.07, now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.015, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 2.5);
            osc2.stop(now + 2.5);

            this.activeNodes.push(osc1, osc2, gain);
          }, delayMs);
        };

        const playMusicBoxMelody = () => {
          if (!this.state.isPlaying) return;
          const melodyPatterns = [
            [0, 2, 4, 7, 4, 2],
            [4, 2, 0, 3, 2, 0],
            [2, 4, 7, 5, 4, 0],
            [7, 5, 4, 2, 0, 2]
          ];
          const pattern = melodyPatterns[Math.floor(Math.random() * melodyPatterns.length)];
          pattern.forEach((noteIdx, i) => {
            triggerMusicBoxNote(musicBoxScale[noteIdx], i * 360);
          });
        };

        playMusicBoxMelody();
        const interval = window.setInterval(playMusicBoxMelody, 3400);
        this.activeIntervals.push(interval);
        break;
      }

      case 'meditation-flute': {
        // 靜心竹笛與音磐 (Zen Meditation Flute with Tibetan Drone)
        const droneOsc = ctx.createOscillator();
        const droneGain = ctx.createGain();
        droneOsc.type = 'sine';
        droneOsc.frequency.setValueAtTime(136.1, ctx.currentTime); // 136.1 Hz Om frequency
        droneGain.gain.setValueAtTime(0.06, ctx.currentTime);
        droneOsc.connect(droneGain);
        droneGain.connect(destination);
        droneOsc.start(0);
        this.activeNodes.push(droneOsc, droneGain);

        // Bamboo flute pentatonic notes
        const fluteScale = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33];

        const triggerFluteNote = () => {
          if (!this.state.isPlaying) return;
          const now = ctx.currentTime;
          const freq = fluteScale[Math.floor(Math.random() * fluteScale.length)];
          const dur = 2.8 + Math.random() * 1.5;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const vibrato = ctx.createOscillator();
          const vibratoGain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          // Gentle vibrato swell
          vibrato.type = 'sine';
          vibrato.frequency.setValueAtTime(4.8, now);
          vibratoGain.gain.setValueAtTime(0.001, now);
          vibratoGain.gain.linearRampToValueAtTime(3.5, now + 1.2);
          vibrato.connect(vibratoGain);
          vibratoGain.connect(osc.frequency);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.065, now + 0.4);
          gain.gain.linearRampToValueAtTime(0.05, now + dur - 0.8);
          gain.gain.linearRampToValueAtTime(0.0001, now + dur);

          osc.connect(gain);
          gain.connect(destination);

          osc.start(now);
          vibrato.start(now);
          osc.stop(now + dur + 0.1);
          vibrato.stop(now + dur + 0.1);

          this.activeNodes.push(osc, gain, vibrato, vibratoGain);
        };

        triggerFluteNote();
        const interval = window.setInterval(triggerFluteNote, 4200);
        this.activeIntervals.push(interval);
        break;
      }

      default: {
        // Fallback pink noise
        const pink = this.startLoopingSource(this.createPinkNoiseBuffer(ctx), ctx);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        pink.connect(gain);
        gain.connect(destination);
        this.activeNodes.push(gain);
        break;
      }
    }
  }
}

// Global Singleton Engine
export const whiteNoiseEngine = new WhiteNoiseEngine();
