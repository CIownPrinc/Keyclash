let audio = null;
let enabled = true;

export function setSoundEnabled(value) { enabled = value; }

function context() {
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function tone({ type = 'sine', from, to = from, length = .18, volume = .06, delay = 0 }) {
  const ctx = context();
  const t = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length * .8);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + .01);
  gain.gain.exponentialRampToValueAtTime(.0008, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + .02);
}

function noise({ length = .2, volume = .08, delay = 0, cutoff = 900 }) {
  const ctx = context();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = step => 392 * 2 ** (SCALE[Math.min(step, SCALE.length - 1)] / 12);

const SOUNDS = {
  key: () => tone({ type: 'triangle', from: 1400, to: 1300, length: .03, volume: .012 }),
  typo: () => tone({ type: 'sawtooth', from: 150, to: 110, length: .12, volume: .03 }),
  hit: chain => { noise({ length: .12, volume: .07, cutoff: 600 }); tone({ type: 'triangle', from: note(chain), to: note(chain) * .8, length: .12, volume: .04 }); },
  capture: chain => { tone({ from: note(chain), to: note(chain) * 1.01, length: .14, volume: .06 }); tone({ from: note(chain + 2), length: .2, volume: .05, delay: .07 }); },
  reinforce: () => { tone({ type: 'triangle', from: 660, to: 990, length: .22, volume: .04 }); },
  steal: chain => { noise({ length: .25, volume: .09, cutoff: 1400 }); tone({ type: 'square', from: note(chain + 1), length: .16, volume: .03, delay: .04 }); },
  lost: () => { noise({ length: .3, volume: .1, cutoff: 400 }); tone({ type: 'sawtooth', from: 220, to: 130, length: .3, volume: .035 }); },
  enemy: () => tone({ type: 'triangle', from: 260, to: 210, length: .12, volume: .03 }),
  blitz: () => [0, 1, 2, 3].forEach(i => tone({ type: 'square', from: note(4 + i * 2), length: .12, volume: .035, delay: i * .06 })),
  bounty: () => [0, 1, 2].forEach(i => tone({ from: 1046 * 2 ** (i * 4 / 12), length: .12, volume: .03, delay: i * .07 })),
  airdrop: () => tone({ from: 300, to: 900, length: .35, volume: .04 }),
  count: () => { noise({ length: .1, volume: .1, cutoff: 200 }); tone({ from: 110, to: 70, length: .2, volume: .08 }); },
  clash: () => { noise({ length: .5, volume: .12, cutoff: 2500 }); tone({ type: 'sawtooth', from: 220, to: 440, length: .4, volume: .05 }); },
  tick: () => tone({ type: 'square', from: 880, length: .05, volume: .025 }),
  win: () => [0, 2, 4, 7].forEach((s, i) => tone({ type: 'triangle', from: note(s), length: .35, volume: .06, delay: i * .12 })),
  lose: () => [4, 2, 0].forEach((s, i) => tone({ type: 'triangle', from: note(s) / 2, length: .4, volume: .05, delay: i * .16 })),
  rankup: () => [0, 4, 7, 12].forEach((s, i) => tone({ from: note(s) * 2, length: .25, volume: .04, delay: i * .08 }))
};

export function play(kind, chain = 0) {
  if (!enabled) return;
  try { SOUNDS[kind](chain); } catch { /* audio is optional */ }
}
