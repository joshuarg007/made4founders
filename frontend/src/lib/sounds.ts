// Sound effects using Web Audio API
// No external audio files needed - generates sounds programmatically

const SOUND_MUTE_KEY = 'made4founders_sound_muted';
const SOUND_VOLUME_KEY = 'made4founders_sound_volume';
const DEFAULT_VOLUME = 0.35; // 35% - non-intrusive default (range: 30-45%)
const MIN_VOLUME = 0;
const MAX_VOLUME = 0.45; // Cap at 45% for non-intrusive sounds

let audioContext: AudioContext | null = null;

// Check if sounds are muted
export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Set sound mute state
export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(SOUND_MUTE_KEY, muted ? 'true' : 'false');
  } catch {
    // localStorage not available
  }
}

// Toggle sound mute state
export function toggleSoundMute(): boolean {
  const newState = !isSoundMuted();
  setSoundMuted(newState);
  return newState;
}

// Get current volume (0-1 range, but capped at MAX_VOLUME)
export function getSoundVolume(): number {
  try {
    const stored = localStorage.getItem(SOUND_VOLUME_KEY);
    if (stored !== null) {
      const vol = parseFloat(stored);
      if (!isNaN(vol)) {
        return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, vol));
      }
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_VOLUME;
}

// Set volume (0-1 range, will be capped at MAX_VOLUME)
export function setSoundVolume(volume: number): void {
  try {
    const capped = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume));
    localStorage.setItem(SOUND_VOLUME_KEY, capped.toString());
  } catch {
    // localStorage not available
  }
}

// Get volume as percentage (0-100 for UI display, but max is 45)
export function getSoundVolumePercent(): number {
  return Math.round(getSoundVolume() * 100);
}

// Set volume from percentage (0-45 range for UI)
export function setSoundVolumePercent(percent: number): void {
  setSoundVolume(percent / 100);
}

// Get the volume multiplier for internal use
function getVolumeMultiplier(): number {
  if (isSoundMuted()) return 0;
  return getSoundVolume() / DEFAULT_VOLUME; // Normalize relative to default
}

function getAudioContext(): AudioContext | null {
  // Return null if muted - sounds won't play
  if (isSoundMuted()) {
    return null;
  }

  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browsers require user interaction)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// Play a note with given frequency and duration
function playNote(
  frequency: number,
  startTime: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = 'sine'
) {
  const ctx = getAudioContext();
  if (!ctx) return; // Muted or unavailable

  // Apply volume multiplier
  const adjustedVolume = volume * getVolumeMultiplier();
  if (adjustedVolume <= 0) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // ADSR envelope for smoother sound
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(adjustedVolume, startTime + 0.02); // Attack
  gainNode.gain.linearRampToValueAtTime(adjustedVolume * 0.7, startTime + duration * 0.3); // Decay
  gainNode.gain.linearRampToValueAtTime(adjustedVolume * 0.5, startTime + duration * 0.8); // Sustain
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration); // Release

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Play a chord (multiple notes)
function playChord(
  frequencies: number[],
  startTime: number,
  duration: number,
  volume: number = 0.2,
  type: OscillatorType = 'sine'
) {
  frequencies.forEach(freq => {
    playNote(freq, startTime, duration, volume / frequencies.length, type);
  });
}

// Victory fanfare - triumphant ascending melody
export function playVictorySound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Triumphant fanfare melody (C major -> E major -> G major -> High C)
    const notes = [
      { freq: 523.25, time: 0, duration: 0.15 },     // C5
      { freq: 659.25, time: 0.12, duration: 0.15 },  // E5
      { freq: 783.99, time: 0.24, duration: 0.15 },  // G5
      { freq: 1046.50, time: 0.36, duration: 0.4 },  // C6 (hold)
    ];

    notes.forEach(note => {
      playNote(note.freq, now + note.time, note.duration, 0.25, 'triangle');
    });

    // Add triumphant chord at the end
    setTimeout(() => {
      const chordTime = ctx.currentTime;
      // C major chord
      playChord([523.25, 659.25, 783.99, 1046.50], chordTime, 0.5, 0.3, 'sine');
    }, 400);

    // Sparkle effect
    setTimeout(() => {
      const sparkleTime = ctx.currentTime;
      for (let i = 0; i < 5; i++) {
        const freq = 2000 + Math.random() * 2000;
        playNote(freq, sparkleTime + i * 0.05, 0.1, 0.08, 'sine');
      }
    }, 600);

  } catch (e) {
    console.warn('Could not play victory sound:', e);
  }
}

// Achievement unlock sound - magical ascending arpeggio
export function playAchievementSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Magical arpeggio (pentatonic scale for pleasant sound)
    const notes = [
      { freq: 392.00, time: 0, duration: 0.12 },     // G4
      { freq: 493.88, time: 0.08, duration: 0.12 },  // B4
      { freq: 587.33, time: 0.16, duration: 0.12 },  // D5
      { freq: 739.99, time: 0.24, duration: 0.12 },  // F#5
      { freq: 880.00, time: 0.32, duration: 0.25 },  // A5 (hold)
    ];

    notes.forEach(note => {
      playNote(note.freq, now + note.time, note.duration, 0.2, 'triangle');
    });

    // Shimmer effect at the end
    setTimeout(() => {
      const shimmerTime = ctx.currentTime;
      playChord([880, 1108.73, 1318.51], shimmerTime, 0.3, 0.15, 'sine');
    }, 350);

  } catch (e) {
    console.warn('Could not play achievement sound:', e);
  }
}

// Level up sound - powerful ascending with bass
export function playLevelUpSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return; // Muted or unavailable

    const volMult = getVolumeMultiplier();
    if (volMult <= 0) return;

    const now = ctx.currentTime;

    // Bass drum hit
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(150, now);
    bassOsc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    bassGain.gain.setValueAtTime(0.5 * volMult, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassOsc.start(now);
    bassOsc.stop(now + 0.3);

    // Rising synth
    const notes = [
      { freq: 261.63, time: 0.05, duration: 0.15 },  // C4
      { freq: 329.63, time: 0.15, duration: 0.15 },  // E4
      { freq: 392.00, time: 0.25, duration: 0.15 },  // G4
      { freq: 523.25, time: 0.35, duration: 0.3 },   // C5
    ];

    notes.forEach(note => {
      playNote(note.freq, now + note.time, note.duration, 0.25, 'sawtooth');
    });

    // Final chord
    setTimeout(() => {
      const chordTime = ctx.currentTime;
      playChord([523.25, 659.25, 783.99], chordTime, 0.4, 0.25, 'triangle');
    }, 450);

  } catch (e) {
    console.warn('Could not play level up sound:', e);
  }
}

// Quest complete sound - satisfying completion chime
export function playQuestCompleteSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two-note completion chime
    playNote(783.99, now, 0.15, 0.25, 'triangle');       // G5
    playNote(1046.50, now + 0.12, 0.25, 0.3, 'triangle'); // C6

    // Soft sparkle
    setTimeout(() => {
      const t = ctx.currentTime;
      playNote(2093, t, 0.1, 0.1, 'sine');
      playNote(2637, t + 0.05, 0.1, 0.08, 'sine');
    }, 200);

  } catch (e) {
    console.warn('Could not play quest complete sound:', e);
  }
}

// XP gain sound - quick positive blip
export function playXPSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Quick ascending blip
    playNote(880, now, 0.08, 0.15, 'sine');
    playNote(1108.73, now + 0.05, 0.1, 0.12, 'sine');

  } catch (e) {
    console.warn('Could not play XP sound:', e);
  }
}

// Defeat sound - descending disappointed tone
export function playDefeatSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Descending minor notes
    const notes = [
      { freq: 392.00, time: 0, duration: 0.2 },     // G4
      { freq: 349.23, time: 0.15, duration: 0.2 },  // F4
      { freq: 311.13, time: 0.30, duration: 0.35 }, // Eb4 (minor feel)
    ];

    notes.forEach(note => {
      playNote(note.freq, now + note.time, note.duration, 0.2, 'triangle');
    });

  } catch (e) {
    console.warn('Could not play defeat sound:', e);
  }
}

// Button click sound - subtle feedback
export function playClickSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    playNote(800, now, 0.05, 0.1, 'sine');

  } catch (e) {
    console.warn('Could not play click sound:', e);
  }
}

// Notification sound - gentle attention getter
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    playNote(659.25, now, 0.1, 0.15, 'sine');        // E5
    playNote(783.99, now + 0.1, 0.15, 0.15, 'sine'); // G5

  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}
