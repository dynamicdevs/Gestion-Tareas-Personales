// Reproduce una "campanita" sintetizada con Web Audio API.
// No necesita ningún archivo de audio externo y funciona offline.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

// Un golpe de campana: dos tonos (quinta) con caída exponencial.
function ringOnce(audio: AudioContext, startAt: number) {
  const freqs = [880, 1320]; // La5 + Mi6
  freqs.forEach((f, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const vol = i === 0 ? 0.25 : 0.12;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(vol, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.1);
    osc.connect(gain).connect(audio.destination);
    osc.start(startAt);
    osc.stop(startAt + 1.2);
  });
}

export function playChime() {
  const audio = getCtx();
  if (!audio) return;
  // Algunos navegadores suspenden el contexto hasta una interacción del usuario.
  if (audio.state === "suspended") audio.resume().catch(() => {});
  const now = audio.currentTime;
  ringOnce(audio, now);
  ringOnce(audio, now + 0.18); // segundo toque -> "ding-dong"
}
