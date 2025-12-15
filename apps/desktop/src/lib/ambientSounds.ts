/**
 * Ambient sounds for Zen mode
 * Using free ambient sound URLs
 */

export interface AmbientSound {
  id: string;
  name: string;
  icon: string;
  // Using data URLs for simple tones, or could be replaced with actual audio files
}

export const ambientSounds: AmbientSound[] = [
  { id: 'none', name: 'None', icon: '🔇' },
  { id: 'rain', name: 'Rain', icon: '🌧️' },
  { id: 'forest', name: 'Forest', icon: '🌲' },
  { id: 'cafe', name: 'Café', icon: '☕' },
  { id: 'ocean', name: 'Ocean', icon: '🌊' },
  { id: 'fireplace', name: 'Fireplace', icon: '🔥' },
  { id: 'whitenoise', name: 'White Noise', icon: '📻' },
];

// Audio context for generating ambient sounds
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Generate white/pink noise buffer
function generateNoiseBuffer(type: 'white' | 'pink' | 'brown' = 'pink'): AudioBuffer {
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      if (type === 'white') {
        data[i] = white * 0.5;
      } else if (type === 'pink') {
        // Pink noise algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        // Brown noise
        data[i] = (b0 + white * 0.02) * 0.5;
        b0 = data[i];
        if (b0 > 1) b0 = 1;
        if (b0 < -1) b0 = -1;
      }
    }
  }

  return buffer;
}

// Create filtered noise for different ambient effects
function createFilteredNoise(
  lowFreq: number,
  highFreq: number,
  noiseType: 'white' | 'pink' | 'brown' = 'pink'
): { source: AudioBufferSourceNode; gain: GainNode } {
  const ctx = getAudioContext();

  if (!noiseBuffer) {
    noiseBuffer = generateNoiseBuffer(noiseType);
  }

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  // Create filters
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = highFreq;

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = lowFreq;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(ctx.destination);

  return { source, gain };
}

export function playAmbientSound(soundId: string, volume: number = 0.3): void {
  stopAmbientSound();

  if (soundId === 'none') return;

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  let source: AudioBufferSourceNode | OscillatorNode;
  let gain: GainNode;

  switch (soundId) {
    case 'rain':
      // Rain: filtered pink noise with low frequencies
      ({ source, gain } = createFilteredNoise(100, 2000, 'pink') as { source: AudioBufferSourceNode; gain: GainNode });
      break;

    case 'forest':
      // Forest: higher pitched pink noise
      ({ source, gain } = createFilteredNoise(500, 4000, 'pink') as { source: AudioBufferSourceNode; gain: GainNode });
      break;

    case 'cafe':
      // Café: mid-range brown noise
      ({ source, gain } = createFilteredNoise(200, 3000, 'brown') as { source: AudioBufferSourceNode; gain: GainNode });
      break;

    case 'ocean':
      // Ocean: low frequency noise with modulation
      ({ source, gain } = createFilteredNoise(50, 500, 'brown') as { source: AudioBufferSourceNode; gain: GainNode });
      // Add slow volume modulation for wave effect
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.1; // Very slow modulation
      lfoGain.gain.value = volume * 0.3;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      break;

    case 'fireplace':
      // Fireplace: crackling low noise
      ({ source, gain } = createFilteredNoise(100, 1500, 'brown') as { source: AudioBufferSourceNode; gain: GainNode });
      break;

    case 'whitenoise':
      // Pure white noise
      noiseBuffer = generateNoiseBuffer('white');
      ({ source, gain } = createFilteredNoise(20, 20000, 'white') as { source: AudioBufferSourceNode; gain: GainNode });
      noiseBuffer = null; // Reset for other sounds
      break;

    default:
      return;
  }

  // Fade in
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1);

  source.start();
  currentSource = source;
  gainNode = gain;
}

export function stopAmbientSound(): void {
  if (currentSource) {
    try {
      if (gainNode && audioContext) {
        // Fade out
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        setTimeout(() => {
          try {
            currentSource?.stop();
          } catch (e) {
            // Ignore if already stopped
          }
          currentSource = null;
          gainNode = null;
        }, 600);
      } else {
        currentSource.stop();
        currentSource = null;
      }
    } catch (e) {
      currentSource = null;
    }
  }
}

export function setAmbientVolume(volume: number): void {
  if (gainNode && audioContext) {
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.1);
  }
}

export function isPlaying(): boolean {
  return currentSource !== null;
}
