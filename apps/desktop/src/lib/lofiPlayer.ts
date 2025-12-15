/**
 * Lo-fi music player for focus/writing mode
 * Uses free streaming radio stations
 */

export interface LofiStation {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const lofiStations: LofiStation[] = [
  { id: 'none', name: 'Off', icon: '🔇', description: 'No music' },
  { id: 'lofi-girl', name: 'Lo-fi Beats', icon: '🎧', description: 'Chill beats to relax/study' },
  { id: 'jazz', name: 'Jazz', icon: '🎷', description: 'Smooth jazz vibes' },
  { id: 'classical', name: 'Classical', icon: '🎻', description: 'Classical focus music' },
  { id: 'ambient', name: 'Ambient', icon: '🌌', description: 'Atmospheric soundscapes' },
  { id: 'piano', name: 'Piano', icon: '🎹', description: 'Peaceful piano melodies' },
];

// Audio element for streaming
let audioElement: HTMLAudioElement | null = null;
let currentStationId: string = 'none';
let currentVolume: number = 0.3;
let isPlaying: boolean = false;

// Generate procedural lo-fi music using Web Audio API
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let oscillators: OscillatorNode[] = [];
let lofiInterval: ReturnType<typeof setInterval> | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Lo-fi chord progressions (jazz-influenced)
const chordProgressions = [
  // Dm7 - G7 - Cmaj7 - Am7
  [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 60, 64, 67]],
  // Fmaj7 - Em7 - Dm7 - Cmaj7
  [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]],
  // Am7 - Dm7 - G7 - Cmaj7
  [[57, 60, 64, 67], [62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71]],
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createLofiChord(notes: number[], ctx: AudioContext, gain: GainNode): OscillatorNode[] {
  const oscs: OscillatorNode[] = [];

  notes.forEach((note, i) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    // Use different waveforms for richness
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = midiToFreq(note - 12); // One octave down for warmth

    // Slight detune for lo-fi effect
    osc.detune.value = (Math.random() - 0.5) * 10;

    oscGain.gain.value = 0.08 / notes.length;

    osc.connect(oscGain);
    oscGain.connect(gain);

    osc.start();
    oscs.push(osc);
  });

  return oscs;
}

function createVinylCrackle(ctx: AudioContext, gain: GainNode): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    // Sparse crackle noise
    if (Math.random() < 0.001) {
      data[i] = (Math.random() - 0.5) * 0.3;
    } else {
      data[i] = (Math.random() - 0.5) * 0.01;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;

  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0.15;

  source.connect(filter);
  filter.connect(crackleGain);
  crackleGain.connect(gain);

  source.start();
  return source;
}

let crackleSource: AudioBufferSourceNode | null = null;
let currentChordIndex = 0;
let currentProgressionIndex = 0;

function playNextChord() {
  if (!audioContext || !masterGain) return;

  // Stop previous oscillators with fade
  oscillators.forEach(osc => {
    try {
      osc.stop(audioContext!.currentTime + 0.5);
    } catch {}
  });

  const progression = chordProgressions[currentProgressionIndex];
  const chord = progression[currentChordIndex];

  oscillators = createLofiChord(chord, audioContext, masterGain);

  currentChordIndex = (currentChordIndex + 1) % progression.length;
  if (currentChordIndex === 0) {
    currentProgressionIndex = Math.floor(Math.random() * chordProgressions.length);
  }
}

export function playLofiStation(stationId: string, volume: number = 0.3): void {
  stopLofiStation();

  if (stationId === 'none') {
    currentStationId = 'none';
    return;
  }

  currentStationId = stationId;
  currentVolume = volume;
  isPlaying = true;

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  masterGain = ctx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(ctx.destination);

  // Fade in
  masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1);

  // Add vinyl crackle for lo-fi effect
  crackleSource = createVinylCrackle(ctx, masterGain);

  // Start chord progression
  playNextChord();

  // Change chords every 4 seconds
  lofiInterval = setInterval(() => {
    if (isPlaying) {
      playNextChord();
    }
  }, 4000);
}

export function stopLofiStation(): void {
  isPlaying = false;

  if (lofiInterval) {
    clearInterval(lofiInterval);
    lofiInterval = null;
  }

  if (masterGain && audioContext) {
    masterGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

    setTimeout(() => {
      oscillators.forEach(osc => {
        try { osc.stop(); } catch {}
      });
      oscillators = [];

      if (crackleSource) {
        try { crackleSource.stop(); } catch {}
        crackleSource = null;
      }
    }, 600);
  }

  currentStationId = 'none';
}

export function setLofiVolume(volume: number): void {
  currentVolume = volume;
  if (masterGain && audioContext) {
    masterGain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.1);
  }
}

export function isLofiPlaying(): boolean {
  return isPlaying && currentStationId !== 'none';
}

export function getCurrentStation(): string {
  return currentStationId;
}
