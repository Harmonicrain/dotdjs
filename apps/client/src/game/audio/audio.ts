import type { Vec3, WeaponId } from '@dotd/sim';

interface GunVoice {
  /** Centre frequency of the noise body. */
  body: number;
  /** Length of the report in seconds. */
  tail: number;
  thump: number;
  level: number;
}

const GUNS: Record<WeaponId, GunVoice> = {
  m1911: { body: 1700, tail: 0.18, thump: 140, level: 0.7 },
  olympia: { body: 700, tail: 0.45, thump: 90, level: 1.0 },
  stg44: { body: 1250, tail: 0.22, thump: 120, level: 0.75 },
  famas: { body: 1500, tail: 0.18, thump: 130, level: 0.7 },
  fnfal: { body: 1050, tail: 0.3, thump: 105, level: 0.85 },
  garand: { body: 950, tail: 0.32, thump: 100, level: 0.9 },
};

/**
 * Synthesised game audio. Everything is generated with WebAudio so the greybox build ships
 * without sound files; recorded assets can replace individual voices later.
 */
export class GameAudio {
  private readonly ctx = new AudioContext();
  private readonly master: GainNode;
  private readonly noise: AudioBuffer;
  private volume: number;

  constructor(volume: number) {
    this.volume = volume;
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(compressor).connect(this.ctx.destination);

    const length = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const listener = this.ctx.listener;
    if (listener.upX) listener.upX.value = 0;
    if (listener.upY) listener.upY.value = 1;
    if (listener.upZ) listener.upZ.value = 0;
  }

  /** Browsers start audio suspended until a user gesture. */
  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  setListener(pos: Vec3, yaw: number): void {
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(-Math.sin(yaw), t);
      l.forwardY.setValueAtTime(0, t);
      l.forwardZ.setValueAtTime(-Math.cos(yaw), t);
    }
  }

  gunshot(weaponId: WeaponId, at: Vec3 | null): void {
    const voice = GUNS[weaponId];
    const t = this.ctx.currentTime;
    const out = this.output(at, voice.level);

    const body = this.noiseSource();
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(voice.body * 1.6, t);
    band.frequency.exponentialRampToValueAtTime(voice.body * 0.5, t + voice.tail);
    band.Q.value = 0.7;
    const bodyGain = this.envelope(t, 0.001, voice.tail, 1);
    body.connect(band).connect(bodyGain).connect(out);
    body.start(t, Math.random());
    body.stop(t + voice.tail + 0.05);

    const crack = this.noiseSource();
    const high = this.ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 3000;
    crack
      .connect(high)
      .connect(this.envelope(t, 0.0005, 0.035, 0.8))
      .connect(out);
    crack.start(t, Math.random());
    crack.stop(t + 0.06);

    const thump = this.ctx.createOscillator();
    thump.frequency.setValueAtTime(voice.thump, t);
    thump.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    thump.connect(this.envelope(t, 0.001, 0.16, 1.1)).connect(out);
    thump.start(t);
    thump.stop(t + 0.2);
  }

  dryFire(): void {
    this.click(0, 2600, 0.25);
  }

  /** Magazine out, magazine in, and a final rack, spread over the reload. */
  reload(duration: number): void {
    this.click(duration * 0.2, 1800, 0.35);
    this.click(duration * 0.62, 1400, 0.45);
    this.click(duration * 0.85, 2400, 0.4);
    this.click(duration * 0.88, 1900, 0.35);
  }

  hitmarker(kind: 'hit' | 'kill' | 'headshot'): void {
    const t = this.ctx.currentTime;
    const tone = (at: number, frequency: number, level: number) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      osc.connect(this.envelope(t + at, 0.001, 0.05, level)).connect(this.master);
      osc.start(t + at);
      osc.stop(t + at + 0.08);
    };
    tone(0, kind === 'headshot' ? 3200 : 2300, 0.18);
    if (kind !== 'hit') tone(0.045, kind === 'headshot' ? 4200 : 1700, 0.16);
  }

  zombieGroan(at: Vec3): void {
    const t = this.ctx.currentTime;
    const duration = 0.7 + Math.random() * 0.8;
    const out = this.output(at, 0.55);

    const voice = this.ctx.createOscillator();
    voice.type = 'sawtooth';
    const pitch = 70 + Math.random() * 60;
    voice.frequency.setValueAtTime(pitch * 1.25, t);
    voice.frequency.exponentialRampToValueAtTime(pitch * 0.8, t + duration);
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.value = 5 + Math.random() * 4;
    const vibratoDepth = this.ctx.createGain();
    vibratoDepth.gain.value = pitch * 0.08;
    vibrato.connect(vibratoDepth).connect(voice.frequency);

    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(450 + Math.random() * 300, t);
    formant.frequency.linearRampToValueAtTime(300, t + duration);
    formant.Q.value = 3;
    voice
      .connect(formant)
      .connect(this.envelope(t, 0.12, duration, 0.9))
      .connect(out);

    const breath = this.noiseSource();
    const breathFilter = this.ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 900;
    breathFilter.Q.value = 1.2;
    breath
      .connect(breathFilter)
      .connect(this.envelope(t, 0.1, duration, 0.25))
      .connect(out);

    for (const node of [voice, vibrato]) {
      node.start(t);
      node.stop(t + duration + 0.1);
    }
    breath.start(t, Math.random());
    breath.stop(t + duration + 0.1);
  }

  zombieSwipe(at: Vec3): void {
    const t = this.ctx.currentTime;
    const whoosh = this.noiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.18);
    whoosh
      .connect(filter)
      .connect(this.envelope(t, 0.05, 0.2, 0.6))
      .connect(this.output(at, 0.6));
    whoosh.start(t, Math.random());
    whoosh.stop(t + 0.3);
  }

  hurt(): void {
    const t = this.ctx.currentTime;
    const hit = this.noiseSource();
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 350;
    hit
      .connect(low)
      .connect(this.envelope(t, 0.002, 0.2, 1.4))
      .connect(this.master);
    hit.start(t, Math.random());
    hit.stop(t + 0.25);
    const thud = this.ctx.createOscillator();
    thud.frequency.setValueAtTime(90, t);
    thud.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    thud.connect(this.envelope(t, 0.002, 0.22, 0.9)).connect(this.master);
    thud.start(t);
    thud.stop(t + 0.25);
  }

  footstep(): void {
    const t = this.ctx.currentTime;
    const step = this.noiseSource();
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 500 + Math.random() * 250;
    step
      .connect(low)
      .connect(this.envelope(t, 0.004, 0.09, 0.22))
      .connect(this.master);
    step.start(t, Math.random());
    step.stop(t + 0.12);
  }

  /** An ominous swell of detuned bass and a bell as each round begins. */
  roundStart(): void {
    const t = this.ctx.currentTime;
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(150, t);
    low.frequency.linearRampToValueAtTime(900, t + 1.5);
    low.frequency.linearRampToValueAtTime(150, t + 3.5);
    const swell = this.envelope(t, 1.2, 3.5, 0.35);
    low.connect(swell).connect(this.master);
    for (const f of [55, 55.6, 82.4]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(low);
      osc.start(t);
      osc.stop(t + 3.8);
    }
    for (const [f, at] of [
      [220, 0.2],
      [207.7, 1.2],
      [164.8, 2.2],
    ] as const) {
      const bell = this.ctx.createOscillator();
      bell.frequency.value = f;
      bell.connect(this.envelope(t + at, 0.005, 1.6, 0.25)).connect(this.master);
      bell.start(t + at);
      bell.stop(t + at + 1.7);
    }
  }

  roundEnd(): void {
    const t = this.ctx.currentTime;
    [329.6, 293.7, 246.9, 220].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.connect(this.envelope(t + i * 0.28, 0.01, 0.9, 0.22)).connect(this.master);
      osc.start(t + i * 0.28);
      osc.stop(t + i * 0.28 + 1);
    });
  }

  gameOver(): void {
    const t = this.ctx.currentTime;
    [196, 185, 174.6, 164.8, 98].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      osc
        .connect(filter)
        .connect(this.envelope(t + i * 0.45, 0.05, 1.4, 0.2))
        .connect(this.master);
      osc.start(t + i * 0.45);
      osc.stop(t + i * 0.45 + 1.5);
    });
  }

  dispose(): void {
    void this.ctx.close();
  }

  get level(): number {
    return this.volume;
  }

  private click(delay: number, frequency: number, level: number): void {
    const t = this.ctx.currentTime + delay;
    const src = this.noiseSource();
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = frequency;
    band.Q.value = 4;
    src
      .connect(band)
      .connect(this.envelope(t, 0.001, 0.04, level))
      .connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    return src;
  }

  /** Gain node that rises to `peak` over `attack` then decays to silence by `end`. */
  private envelope(start: number, attack: number, end: number, peak: number): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.01, end));
    return gain;
  }

  /** Destination for a sound: spatialised at `at`, or straight to the listener if null. */
  private output(at: Vec3 | null, level: number): AudioNode {
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    if (!at) {
      gain.connect(this.master);
      return gain;
    }
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.5;
    panner.rolloffFactor = 1.3;
    panner.maxDistance = 70;
    panner.positionX.value = at.x;
    panner.positionY.value = at.y;
    panner.positionZ.value = at.z;
    gain.connect(panner).connect(this.master);
    return gain;
  }
}
