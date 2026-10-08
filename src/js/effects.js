// The ten SnowWall effects as the web preview draws them. A 2D-canvas sketch of each, not
// the app's Metal renderer: same names, colours and character, much less of everything.
//
// kind     flake (snow-like sprites), rain (streaks), petal (tumbling sprites), glass (beads)
// sprite   flake look: soft, sparkle, crystal, star
// shape    petal look: petal, leaf, confetti
// tints    'r,g,b' strings; null means the theme's own flake colour
// count, speed, wind, size  multipliers on the base simulation
// settle   whether it piles up on surfaces (snow) / lands (petals) / splashes (rain)

export const EFFECTS = {
  snow:      { kind: 'flake', sprite: 'soft', tints: null, settle: true },
  blizzard:  { kind: 'flake', sprite: 'soft', tints: null, settle: true, count: 1.6, speed: 1.9, wind: 3.4, size: .72 },
  christmas: { kind: 'flake', sprite: 'sparkle', tints: [null, null, null, '255,128,128', '146,226,166'], settle: true, count: .9 },
  frozen:    { kind: 'flake', sprite: 'crystal', tints: ['176,226,255', '150,196,255', '204,186,255'], settle: true, speed: .75, count: .8, size: 1.15 },
  stars:     { kind: 'flake', sprite: 'star', tints: ['255,226,128', '255,244,200'], settle: false, count: .4, speed: .4, wind: .25, size: 2.2, twinkle: true },
  rain:      { kind: 'rain', settle: true },
  glass:     { kind: 'glass' },
  blossom:   { kind: 'petal', shape: 'petal', settle: true, tints: [['#ffe6ee', '#f4a3bd'], ['#fff1f5', '#f7b9cc'], ['#ffd9e5', '#ee8fae']] },
  leaves:    { kind: 'petal', shape: 'leaf', settle: true, size: 1.25, spin: 1.3, tints: [['#ffb347', '#d9661f'], ['#ff8a5c', '#b8361e'], ['#ffd56b', '#d89a1c']] },
  confetti:  { kind: 'petal', shape: 'confetti', settle: true, size: .62, speed: 1.35, spin: 2, flip: 2.2, count: 1.4,
               tints: [['#ff5a6e', '#ff5a6e'], ['#3d8bff', '#3d8bff'], ['#ffd23f', '#ffd23f'], ['#3ddc84', '#3ddc84'], ['#b06cff', '#b06cff']] },
};

for (const fx of Object.values(EFFECTS)) {
  fx.count ??= 1; fx.speed ??= 1; fx.wind ??= 1; fx.size ??= 1; fx.spin ??= 1; fx.flip ??= 1;
}
