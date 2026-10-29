/* =====================================================================
   SPIN MASTER — script.js
   Vanilla JavaScript idle arcade game.

   TABLE OF CONTENTS
     1.  CONFIG ............ every price, reward and balance number
     2.  Utilities ......... formatting, colour and date helpers
     3.  State + Storage ... save data, validation, localStorage
     4.  Calc .............. formulas that turn upgrade levels into effects
     5.  Sound + Haptics ... WebAudio synth (no audio files needed)
     6.  FX ................ particles, floating text, toasts, modals
     7.  Wheel ............. canvas wheel renderer
     8.  Game engine ....... rotation, rounds, rewards, offline earnings
     9.  Progress .......... missions, achievements, themes, daily reward
    10.  UI ................ screens, navigation, settings
    11.  Boot .............. start-up and the requestAnimationFrame loop
   ===================================================================== */
(function () {
'use strict';

/* =====================================================================
   1. CONFIG — change numbers here to rebalance the game
   ===================================================================== */
const CONFIG = {
  SAVE_KEY: 'spinmaster_save_v2',
  SAVE_INTERVAL_MS: 5000,       // autosave period
  UI_INTERVAL_MS: 100,          // how often text/buttons refresh
  OFFLINE_MIN_SECONDS: 15,      // shorter absences earn nothing

  /* ---- Base values at upgrade level 0 ---- */
  BASE_SPEED_RPM: 1,            // wheel revolutions per minute at the start
  SPEED_RPM_PER_LEVEL: 1.5,     // Speed Boost: + RPM per level
  COIN_BOOST_PER_LEVEL: 1,      // Coin Boost: + coins added to every round
  MULT_PER_LEVEL: 0.25,         // Round Multiplier: + 0.25x per level
  LUCKY_BASE: 0.05,             // Lucky Bonus: base chance of a x2 round
  LUCKY_PER_LEVEL: 0.02,
  LUCKY_MAX: 0.75,
  JACKPOT_CHANCE_BASE: 0.01,    // Jackpot: base chance per round
  JACKPOT_CHANCE_PER_LEVEL: 0.004,
  JACKPOT_CHANCE_MAX: 0.25,
  JACKPOT_MULT_BASE: 20,        // Jackpot pays (round reward x this)
  JACKPOT_MULT_PER_LEVEL: 3,
  OFFLINE_EFF_BASE: 0.25,       // Offline: share of normal income earned while away
  OFFLINE_EFF_PER_LEVEL: 0.035,
  OFFLINE_HOURS_BASE: 2,        // Offline: max hours that count
  OFFLINE_HOURS_PER_LEVEL: 0.5,

  /* ---- Wheel segments: v = base coins per round (1 at the start), w = landing weight. Numbers are not drawn on the wheel. ---- */
  SEGMENTS: [
    { v: 1, w: 1 }, { v: 1, w: 1 }, { v: 1, w: 1 }, { v: 1, w: 1 }, { v: 1, w: 1 },
    { v: 1, w: 1 }, { v: 1, w: 1 }, { v: 1, w: 1 }, { v: 1, w: 1 }, { v: 1, w: 1 }
  ],

  /* ---- Upgrades: cost = floor(baseCost * growth ^ currentLevel) ---- */
  UPGRADES: [
    { id: 'coin',       name: 'Coin Boost',       icon: '🪙', max: 50, baseCost: 5,   growth: 1.21, desc: 'Adds bonus coins to every round.' },
    { id: 'speed',      name: 'Speed Boost',      icon: '⚡', max: 30, baseCost: 3,   growth: 1.31, desc: 'The wheel spins faster, so rounds finish sooner.' },
    { id: 'lucky',      name: 'Lucky Bonus',      icon: '🍀', max: 25, baseCost: 23,  growth: 1.31, desc: 'Higher chance to double a round reward.' },
    { id: 'multiplier', name: 'Round Multiplier', icon: '✖️', max: 30, baseCost: 45,  growth: 1.39, desc: 'Multiplies everything you earn per round.' },
    { id: 'jackpot',    name: 'Jackpot Upgrade',  icon: '💎', max: 25, baseCost: 75,  growth: 1.36, desc: 'Better jackpot odds and a bigger payout.' },
    { id: 'offline',    name: 'Offline Earnings', icon: '🌙', max: 20, baseCost: 30,  growth: 1.36, desc: 'Earn more coins, for longer, while you are away.' }
  ],

  /* ---- Rebirth: reset coins + upgrades for a permanent income bonus ---- */
  REBIRTH_BASE_REQ: 1000000,    // coins earned in one run needed for the 1st rebirth
  REBIRTH_REQ_GROWTH: 2,        // each further rebirth needs x2 more
  REBIRTH_BONUS: 0.25,          // +25% income per rebirth (permanent)

  /* ---- Dimensions: unlocked once every upgrade is maxed ---- */
  DIM_BASE_COST: 5000000,       // coins for Dimension 2 (first jump)
  DIM_COST_GROWTH: 6,           // each further dimension costs x6
  DIM_MULT_BASE: 2,             // income x2 for every dimension reached
  DIM_EXTRA_LEVELS: 10,         // every upgrade can go +10 levels higher per dimension
  DIM_MAX: 8,
  DIM_NAMES: ['Prime Realm', 'Nebula Rift', 'Void Realm', 'Aurora Realm', 'Quantum Realm', 'Solar Realm', 'Crystal Realm', 'Eclipse Realm', 'Infinity Realm'],

  /* ---- Daily login rewards for Day 1..7 ---- */
  DAILY_REWARDS: [10, 25, 50, 100, 250, 500, 1500],

  /* ---- Missions: progress reads a lifetime statistic ---- */
  MISSIONS: [
    { id: 'r1', cat: 'Rounds',   stat: 'rounds',   target: 10, reward: 5, text: 'Complete 10 rounds' },
    { id: 'r2', cat: 'Rounds',   stat: 'rounds',   target: 100, reward: 25, text: 'Complete 100 rounds' },
    { id: 'r3', cat: 'Rounds',   stat: 'rounds',   target: 500, reward: 150, text: 'Complete 500 rounds' },
    { id: 'r4', cat: 'Rounds',   stat: 'rounds',   target: 2500, reward: 800, text: 'Complete 2,500 rounds' },
    { id: 'e1', cat: 'Earnings', stat: 'earned',   target: 250, reward: 10, text: 'Earn 250 coins in total' },
    { id: 'e2', cat: 'Earnings', stat: 'earned',   target: 2500, reward: 50, text: 'Earn 2,500 coins in total' },
    { id: 'e3', cat: 'Earnings', stat: 'earned',   target: 25000, reward: 400, text: 'Earn 25,000 coins in total' },
    { id: 'e4', cat: 'Earnings', stat: 'earned',   target: 250000, reward: 4000, text: 'Earn 250,000 coins in total' },
    { id: 'u1', cat: 'Upgrades', stat: 'upgrades', target: 5, reward: 10, text: 'Buy 5 upgrade levels' },
    { id: 'u2', cat: 'Upgrades', stat: 'upgrades', target: 25, reward: 100, text: 'Buy 25 upgrade levels' },
    { id: 'u3', cat: 'Upgrades', stat: 'upgrades', target: 75, reward: 1000, text: 'Buy 75 upgrade levels' },
    { id: 's1', cat: 'Speed',    stat: 'rpm',      target: 5, reward: 10, text: 'Reach 5 RPM' },
    { id: 's2', cat: 'Speed',    stat: 'rpm',      target: 15, reward: 150, text: 'Reach 15 RPM' },
    { id: 's3', cat: 'Speed',    stat: 'rpm',      target: 30, reward: 1500, text: 'Reach 30 RPM' },
    { id: 'j1', cat: 'Jackpots', stat: 'jackpots', target: 1, reward: 50, text: 'Win 1 jackpot' },
    { id: 'j2', cat: 'Jackpots', stat: 'jackpots', target: 5, reward: 500, text: 'Win 5 jackpots' },
    { id: 'j3', cat: 'Jackpots', stat: 'jackpots', target: 20, reward: 4000, text: 'Win 20 jackpots' }
  ],

  /* ---- Achievements: unlock automatically and pay out once ---- */
  ACHIEVEMENTS: [
    { id: 'first_spin',  icon: '🎡', name: 'First Spin',     stat: 'rounds',   target: 1,       reward: 5,     text: 'Complete your first round' },
    { id: 'collector',   icon: '💰', name: 'Coin Collector', stat: 'earned',   target: 1000,    reward: 50,    text: 'Earn 1,000 coins in total' },
    { id: 'speed',       icon: '🚀', name: 'Speed Master',   stat: 'rpm',      target: 30,      reward: 500,   text: 'Reach 30 RPM' },
    { id: 'lucky',       icon: '🍀', name: 'Lucky Player',   stat: 'lucky',    target: 25,      reward: 100,   text: 'Trigger 25 lucky bonuses' },
    { id: 'millionaire', icon: '👑', name: 'Millionaire',    stat: 'earned',   target: 1000000, reward: 10000, text: 'Earn 1,000,000 coins in total' },
    { id: 'jackpot',     icon: '💎', name: 'Jackpot Hunter', stat: 'jackpots', target: 3,       reward: 300,  text: 'Win 3 jackpots' },
    { id: 'upgrader',    icon: '🔧', name: 'Tinkerer',       stat: 'upgrades', target: 30,      reward: 200,   text: 'Buy 30 upgrade levels' },
    { id: 'dedicated',   icon: '⏱️', name: 'Dedicated',      stat: 'play',     target: 3600,    reward: 500,  text: 'Play for one hour' }
  ],

  /* ---- Themes: unlock = total coins earned needed. wheel = 10 segment colours ---- */
  THEMES: [
    { id: 'neon',      name: 'Neon',       unlock: 0,      a1: '#00f0ff', a2: '#b400ff', bg0: '#07070f', bg1: '#14102e',
      wheel: ['#ff2d95','#00d9ff','#8a4dff','#00e68a','#ff6a00','#12c2ff','#ffd400','#ff2d6b','#b44dff','#2bff88'] },
    { id: 'galaxy',    name: 'Galaxy',     unlock: 500,   a1: '#8b5cff', a2: '#ff5ccf', bg0: '#070514', bg1: '#1a0f3c',
      wheel: ['#6a3dff','#b84dff','#ff5ccf','#3d5bff','#8b5cff','#ff7ad9','#ffe27a','#4d3bd6','#c44dff','#5c7dff'] },
    { id: 'ocean',     name: 'Ocean Blue', unlock: 2500,  a1: '#00c2ff', a2: '#00ffd0', bg0: '#03101c', bg1: '#06324d',
      wheel: ['#0077b6','#00b4d8','#0096c7','#48cae4','#023e8a','#00c2a8','#ffd166','#1d9bf0','#0ea5a4','#3a86ff'] },
    { id: 'golden',    name: 'Golden',     unlock: 10000, a1: '#ffd24a', a2: '#ff8a00', bg0: '#100b02', bg1: '#2a1c05',
      wheel: ['#b8860b','#e6a817','#d99a00','#c8791a','#f2b705','#c98f12','#fff1a8','#a86a12','#e89b1c','#d4a017'] },
    { id: 'cyberpunk', name: 'Cyberpunk',  unlock: 50000, a1: '#fcee0a', a2: '#ff003c', bg0: '#0b0412', bg1: '#240a2e',
      wheel: ['#ff003c','#00a8d6','#b8ab00','#d6209f','#00a870','#ff6a00','#fcee0a','#7a00ff','#e60073','#00a6a6'] }
  ]
};

/* =====================================================================
   2. UTILITIES
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mod = (a, n) => ((a % n) + n) % n;
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

/** Big-number formatter: 1250 -> 1.25K, 3400000 -> 3.4M */
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
function fmt(n) {
  n = Math.floor(Math.max(0, Number(n) || 0));
  if (n < 1000) return String(n);
  let i = Math.min(UNITS.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / Math.pow(1000, i);
  let s = v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (parseFloat(s) >= 1000 && i < UNITS.length - 1) { i++; s = '1'; }
  return s + UNITS[i];
}
/** Full number with separators: 1234567 -> 1,234,567 */
const fmtFull = (n) => Math.floor(n).toLocaleString('en-US');
/** Percent, trimming trailing zeros: 0.05 -> "5%", 0.075 -> "7.5%" */
const pct = (x) => (Math.round(x * 1000) / 10) + '%';
/** Seconds -> "1h 12m", "3m 05s", "42s" */
function fmtDuration(sec) {
  sec = Math.floor(Math.max(0, sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm';
  if (m > 0) return m + 'm ' + String(s).padStart(2, '0') + 's';
  return s + 's';
}
const pad2 = (n) => String(n).padStart(2, '0');

/** Colour helpers for canvas gradients */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixColor(hex, toWhite, amt) {
  const [r, g, b] = hexToRgb(hex), t = toWhite ? 255 : 0;
  const f = (v) => Math.round(v + (t - v) * amt);
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}

/** Local-date helpers for the daily reward (uses the device calendar day) */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function dayNumber(str) {
  const p = String(str).split('-').map(Number);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
}
function msUntilMidnight() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime();
}

/* =====================================================================
   3. STATE + STORAGE
   ===================================================================== */
const SEG_COUNT = CONFIG.SEGMENTS.length;
const SEG_DEG = 360 / SEG_COUNT;
const SEG_WEIGHT_SUM = CONFIG.SEGMENTS.reduce((s, g) => s + g.w, 0);

function defaultState() {
  const up = {};
  CONFIG.UPGRADES.forEach((u) => { up[u.id] = 0; });
  return {
    v: 1,
    coins: 0,
    totalEarned: 0,
    runEarned: 0,       // coins earned since the last rebirth
    dimension: 0,       // 0 = Prime Realm
    rebirths: 0,
    roundDeg: 0,        // progress through the current 360° round (0..360)
    offStart: 0,        // visual alignment at the start of the round (degrees)
    offDelta: 0,        // extra visual drift so the pointer ends on `target`
    target: 0,          // index of the segment that will pay out this round
    upgrades: up,
    stats: { rounds: 0, upgradesBought: 0, maxRpm: CONFIG.BASE_SPEED_RPM, jackpots: 0,
             luckyHits: 0, bestReward: 0, playSeconds: 0, offlineEarned: 0 },
    missions: { claimed: {} },
    achievements: { unlocked: {} },
    daily: { streak: 0, lastClaim: '' },
    themes: { unlocked: { neon: true }, selected: 'neon' },
    settings: { music: true, spinSound: true, rewardSound: true, musicVol: 0.4, sfxVol: 0.7, vibration: true },
    lastSeen: Date.now(),
    created: Date.now()
  };
}

/** Copy only known keys from `src` into a clone of `def`, checking types. */
function mergeKnown(def, src) {
  const out = Array.isArray(def) ? def.slice() : {};
  Object.keys(def).forEach((k) => {
    const d = def[k], s = src ? src[k] : undefined;
    if (d && typeof d === 'object' && !Array.isArray(d)) out[k] = mergeKnown(d, s && typeof s === 'object' ? s : {});
    else if (typeof d === 'number') out[k] = (typeof s === 'number' && isFinite(s) && s >= 0) ? s : d;
    else if (typeof d === typeof s) out[k] = s;
    else out[k] = d;
  });
  return out;
}
const boolMap = (m) => {
  const o = {};
  if (m && typeof m === 'object') Object.keys(m).forEach((k) => { if (m[k] === true) o[k] = true; });
  return o;
};

let state = defaultState();

/** Validate raw saved JSON and return a safe state object. */
function sanitizeState(raw) {
  const s = mergeKnown(defaultState(), raw && typeof raw === 'object' ? raw : {});
  const r = raw && typeof raw === 'object' ? raw : {};
  s.missions.claimed = boolMap(r.missions && r.missions.claimed);
  s.achievements.unlocked = boolMap(r.achievements && r.achievements.unlocked);
  s.themes.unlocked = boolMap(r.themes && r.themes.unlocked);
  s.themes.unlocked.neon = true;
  s.dimension = clamp(Math.floor(s.dimension) || 0, 0, CONFIG.DIM_MAX);
  s.rebirths = Math.floor(s.rebirths) || 0;
  if (typeof r.runEarned !== 'number') s.runEarned = s.totalEarned;      // saves from before rebirths existed
  CONFIG.UPGRADES.forEach((u) => { s.upgrades[u.id] = clamp(Math.floor(s.upgrades[u.id]) || 0, 0, u.max + CONFIG.DIM_EXTRA_LEVELS * s.dimension); });
  s.offDelta = (typeof r.offDelta === 'number' && isFinite(r.offDelta)) ? r.offDelta : 0;   // may be negative
  s.target = clamp(Math.floor(s.target) || 0, 0, SEG_COUNT - 1);
  s.roundDeg = clamp(s.roundDeg, 0, 359.999);
  s.daily.streak = clamp(Math.floor(s.daily.streak) || 0, 0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.daily.lastClaim)) s.daily.lastClaim = '';
  const t = CONFIG.THEMES.find((x) => x.id === s.themes.selected);
  if (!t || !s.themes.unlocked[t.id]) s.themes.selected = 'neon';
  s.settings.musicVol = clamp(s.settings.musicVol, 0, 1);
  s.settings.sfxVol = clamp(s.settings.sfxVol, 0, 1);
  if (!(s.lastSeen > 0) || s.lastSeen > Date.now() + 60000) s.lastSeen = Date.now();
  s.stats.maxRpm = Math.max(s.stats.maxRpm, Calc.speedRpm(s.upgrades.speed));
  // Make sure the wheel geometry is consistent (pointer must land on `target`)
  const err = mod(s.offStart + s.offDelta - thetaFor(s.target) + 180, 360) - 180;
  if (Math.abs(err) > 0.05) { s.target = pickTarget(); beginRound(s); }
  return s;
}

let saveFailedWarned = false;
function saveGame() {
  try {
    state.lastSeen = Date.now();
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    if (!saveFailedWarned) { saveFailedWarned = true; console.warn('Spin Master: could not save progress', e); }
  }
}
function loadGame() {
  try {
    const txt = localStorage.getItem(CONFIG.SAVE_KEY);
    if (txt) return sanitizeState(JSON.parse(txt));
  } catch (e) { console.warn('Spin Master: save data was unreadable, starting fresh', e); }
  const fresh = defaultState();
  fresh.target = pickTarget(); beginRound(fresh);
  return fresh;
}

/* =====================================================================
   4. CALC — upgrade level -> gameplay effect
   ===================================================================== */
const Calc = {
  coinBonus:     (l) => l * CONFIG.COIN_BOOST_PER_LEVEL,
  speedRpm:      (l) => CONFIG.BASE_SPEED_RPM + l * CONFIG.SPEED_RPM_PER_LEVEL,
  luckyChance:   (l) => Math.min(CONFIG.LUCKY_MAX, CONFIG.LUCKY_BASE + l * CONFIG.LUCKY_PER_LEVEL),
  multiplier:    (l) => 1 + l * CONFIG.MULT_PER_LEVEL,
  jackpotChance: (l) => Math.min(CONFIG.JACKPOT_CHANCE_MAX, CONFIG.JACKPOT_CHANCE_BASE + l * CONFIG.JACKPOT_CHANCE_PER_LEVEL),
  jackpotMult:   (l) => CONFIG.JACKPOT_MULT_BASE + l * CONFIG.JACKPOT_MULT_PER_LEVEL,
  offlineEff:    (l) => Math.min(1, CONFIG.OFFLINE_EFF_BASE + l * CONFIG.OFFLINE_EFF_PER_LEVEL),
  offlineHours:  (l) => CONFIG.OFFLINE_HOURS_BASE + l * CONFIG.OFFLINE_HOURS_PER_LEVEL,
  upgradeCost:   (def, lvl) => Math.floor(def.baseCost * Math.pow(def.growth, lvl)),
  maxLevel:      (def) => def.max + CONFIG.DIM_EXTRA_LEVELS * state.dimension,
  rebirthMult:   () => 1 + CONFIG.REBIRTH_BONUS * state.rebirths,
  dimMult:       () => Math.pow(CONFIG.DIM_MULT_BASE, state.dimension),
  bonusMult:     () => Calc.rebirthMult() * Calc.dimMult(),     // permanent income multiplier
  rebirthReq:    () => Math.floor(CONFIG.REBIRTH_BASE_REQ * Math.pow(CONFIG.REBIRTH_REQ_GROWTH, state.rebirths)),
  dimCost:       () => Math.floor(CONFIG.DIM_BASE_COST * Math.pow(CONFIG.DIM_COST_GROWTH, state.dimension)),

  /** Weighted average segment value */
  avgSegment() {
    return CONFIG.SEGMENTS.reduce((s, g) => s + g.v * g.w, 0) / SEG_WEIGHT_SUM;
  },
  /** Expected coins per round including lucky + jackpot odds */
  expectedRound() {
    const u = state.upgrades;
    const base = (Calc.avgSegment() + Calc.coinBonus(u.coin)) * Calc.multiplier(u.multiplier) * Calc.bonusMult();
    return base * (1 + Calc.luckyChance(u.lucky)) + base * Calc.jackpotChance(u.jackpot) * Calc.jackpotMult(u.jackpot);
  },
  roundsPerSec: () => Calc.speedRpm(state.upgrades.speed) / 60
};

/** Text shown on each upgrade card for a given level */
const EFFECT_TEXT = {
  coin:       (l) => '+' + Calc.coinBonus(l) + ' coins per round',
  speed:      (l) => (Math.round(Calc.speedRpm(l) * 10) / 10) + ' RPM',
  lucky:      (l) => pct(Calc.luckyChance(l)) + ' chance to double',
  multiplier: (l) => 'x' + Calc.multiplier(l).toFixed(2) + ' round earnings',
  jackpot:    (l) => pct(Calc.jackpotChance(l)) + ' chance · pays x' + Calc.jackpotMult(l),
  offline:    (l) => pct(Calc.offlineEff(l)) + ' income · ' + (Math.round(Calc.offlineHours(l) * 10) / 10) + 'h cap'
};

/** Lifetime statistic lookups used by missions and achievements */
const STAT_GETTERS = {
  rounds:   () => state.stats.rounds,
  earned:   () => state.totalEarned,
  upgrades: () => state.stats.upgradesBought,
  rpm:      () => state.stats.maxRpm,
  jackpots: () => state.stats.jackpots,
  lucky:    () => state.stats.luckyHits,
  play:     () => state.stats.playSeconds
};

/* =====================================================================
   5. SOUND + HAPTICS — everything is synthesised with WebAudio
   ===================================================================== */
const Sound = (function () {
  let ctx = null, musicGain = null, sfxGain = null;
  let musicTimer = null, step = 0, nextTime = 0, lastTick = 0;

  const CHORDS = [[220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [261.63, 329.63, 392, 523.25], [196, 246.94, 293.66, 392]];
  const BASS = [110, 87.31, 130.81, 98];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3];

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      const master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.connect(master);
      applyVolumes();
    } catch (e) { ctx = null; }
    return ctx;
  }
  /** Browsers only allow audio after a user gesture. Called on the first tap. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    syncMusic();
  }
  function applyVolumes() {
    if (!ctx) return;
    musicGain.gain.value = state.settings.musicVol * 0.3;
    sfxGain.gain.value = state.settings.sfxVol;
  }
  function tone(freq, t0, dur, type, vol, dest, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function canSfx() { return ctx && ctx.state === 'running' && state.settings.rewardSound; }

  /* --- background music: soft looping arpeggio --- */
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.35) {
      const ci = Math.floor(step / 8) % 4;
      tone(CHORDS[ci][ARP[step % 8]], nextTime, 0.4, 'triangle', 0.55, musicGain);
      if (step % 8 === 0) tone(BASS[ci], nextTime, 1.7, 'sine', 0.8, musicGain);
      step++; nextTime += 0.24;
    }
  }
  function syncMusic() {
    if (!ctx) return;
    if (state.settings.music && !musicTimer) { nextTime = ctx.currentTime + 0.05; musicTimer = setInterval(schedule, 100); }
    if (!state.settings.music && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  return {
    unlock: unlock,
    applyVolumes: applyVolumes,
    syncMusic: syncMusic,
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

    /** Wheel tick: throttled so very fast wheels do not machine-gun */
    tick() {
      if (!ctx || ctx.state !== 'running' || !state.settings.spinSound) return;
      const t = ctx.currentTime;
      if (t - lastTick < 0.07) return;
      lastTick = t;
      tone(1100 + Math.random() * 120, t, 0.04, 'square', 0.07, sfxGain);
    },
    reward() { if (!canSfx()) return; const t = ctx.currentTime; tone(660, t, 0.12, 'triangle', 0.35, sfxGain); tone(990, t + 0.07, 0.18, 'triangle', 0.35, sfxGain); },
    lucky() { if (!canSfx()) return; const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.2, 'sine', 0.35, sfxGain)); },
    jackpot() {
      if (!canSfx()) return; const t = ctx.currentTime;
      [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.09, 0.35, 'triangle', 0.4, sfxGain));
      tone(130, t, 0.9, 'sawtooth', 0.15, sfxGain);
    },
    buy() { if (!canSfx()) return; const t = ctx.currentTime; tone(440, t, 0.08, 'square', 0.18, sfxGain); tone(880, t + 0.06, 0.14, 'square', 0.18, sfxGain); },
    error() { if (!canSfx()) return; tone(180, ctx.currentTime, 0.22, 'sawtooth', 0.22, sfxGain, 90); },
    claim() { if (!canSfx()) return; const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.22, 'triangle', 0.35, sfxGain)); },
    click() { if (!canSfx()) return; tone(700, ctx.currentTime, 0.04, 'sine', 0.12, sfxGain); }
  };
})();

const Haptics = {
  last: 0,
  vibrate(pattern, minGap) {
    if (!state.settings.vibration || !navigator.vibrate) return;
    const now = performance.now();
    if (now - this.last < (minGap || 0)) return;
    this.last = now;
    try { navigator.vibrate(pattern); } catch (e) { /* ignored */ }
  }
};

/* =====================================================================
   6. FX — particles, floating text, toasts, modals
   ===================================================================== */
const FX = (function () {
  const canvas = $('fxCanvas'), cx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const parts = [];
  const MAX_PARTS = 260;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  }

  function wheelCenter() {
    const r = $('wheelWrap').getBoundingClientRect();
    if (r.width === 0) return { x: W / 2, y: H * 0.3 };   // home screen hidden
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
  }

  /** Spray `n` particles from a point. */
  function burst(x, y, n, colors, o) {
    o = o || {};
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) {
      const a = (o.angle !== undefined ? o.angle : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * (o.spread || Math.PI * 2);
      const sp = (o.speed || 240) * (0.4 + Math.random() * 0.8);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
        g: o.gravity === undefined ? 520 : o.gravity,
        life: 0, max: (o.life || 0.9) * (0.7 + Math.random() * 0.6),
        size: (o.size || 5) * (0.6 + Math.random() * 0.8),
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, square: !!o.square
      });
    }
  }

  function update(dt) {
    if (!parts.length) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      cx.globalAlpha = clamp(1 - p.life / p.max, 0, 1);
      cx.fillStyle = p.color;
      if (p.square) {
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); cx.restore();
      } else {
        cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, 6.2832); cx.fill();
      }
    }
    cx.globalAlpha = 1;
    if (!parts.length) cx.clearRect(0, 0, W, H);
  }

  const GOLD = ['#ffd24a', '#ffec99', '#ff9d00', '#fff7d6'];
  const CONFETTI = ['#ff2d95', '#00e5ff', '#ffd400', '#7c4dff', '#00ff9d', '#ff6a00', '#ffffff'];

  function coinBurst(big) {
    const c = wheelCenter();
    burst(c.x, c.y - (c.r || 0) * 0.55, big ? 28 : 9, GOLD, { angle: -Math.PI / 2, spread: Math.PI * 0.9, speed: 320, lift: 80, size: 4.5 });
  }
  function jackpotBurst() {
    const c = wheelCenter();
    burst(c.x, c.y, 70, GOLD, { speed: 520, size: 6, life: 1.3 });
    for (let i = 0; i < 4; i++) burst(Math.random() * W, -10, 28, CONFETTI, { angle: Math.PI / 2, spread: 1.2, speed: 260, gravity: 380, life: 2.4, size: 6, square: true });
  }
  function confetti() {
    burst(W / 2, H * 0.35, 60, CONFETTI, { speed: 480, size: 6, life: 1.6, square: true, lift: 140 });
  }

  /** Floating "+120" text over the wheel */
  function floatText(text, cls) {
    const layer = $('floatLayer');
    if (!layer.offsetParent) return;                      // home screen not visible
    while (layer.childElementCount > 7) layer.removeChild(layer.firstChild);
    const d = el('div', 'float' + (cls ? ' ' + cls : ''), text);
    d.style.marginLeft = ((Math.random() - 0.5) * 70) + 'px';
    d.addEventListener('animationend', () => d.remove());
    layer.appendChild(d);
  }

  let bannerTimer = null;
  function jackpotBanner(amount) {
    const b = $('jackpotBanner');
    $('jackpotAmount').textContent = '+' + fmtFull(amount);
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 2700);
  }

  function toast(msg, kind) {
    const root = $('toasts');
    while (root.childElementCount >= 3) root.removeChild(root.firstChild);
    const t = el('div', 'toast ' + (kind || ''), msg);
    root.appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }

  /** Generic popup. The game keeps running underneath it. */
  function modal(opts) {
    const back = el('div', 'modal-backdrop');
    back.innerHTML = '<div class="modal glass" role="dialog" aria-modal="true"><div class="modal-icon"></div><h3></h3><div class="modal-body"></div><div class="modal-actions"></div></div>';
    back.querySelector('.modal-icon').textContent = opts.icon || '';
    back.querySelector('h3').textContent = opts.title || '';
    back.querySelector('.modal-body').innerHTML = opts.body || '';
    const actions = back.querySelector('.modal-actions');
    function close() {
      if (back.classList.contains('closing')) return;
      back.classList.add('closing');
      setTimeout(() => back.remove(), 180);
    }
    (opts.buttons || [{ label: 'OK', cls: 'primary' }]).forEach((b) => {
      const btn = el('button', 'btn ' + (b.cls || ''), b.label);
      btn.addEventListener('click', () => { Sound.click(); close(); if (b.onClick) b.onClick(); });
      actions.appendChild(btn);
    });
    if (opts.dismissible !== false) back.addEventListener('click', (e) => { if (e.target === back) close(); });
    $('modalRoot').appendChild(back);
    return close;
  }

  window.addEventListener('resize', resize);
  resize();
  return { update, burst, coinBurst, jackpotBurst, confetti, floatText, jackpotBanner, toast, modal, resize };
})();

/* =====================================================================
   7. WHEEL — canvas renderer
   The wheel face is pre-rendered once (per size/theme) and rotated each
   frame with drawImage, so drawing stays cheap at any speed.
   ===================================================================== */
const Wheel = (function () {
  const canvas = $('wheelCanvas'), ctx = canvas.getContext('2d');
  let S = 0, dpr = 1, face = null, rim = null;
  let pulseIdx = -1, pulseT0 = 0, kick = 0;

  const theme = () => CONFIG.THEMES.find((t) => t.id === state.themes.selected) || CONFIG.THEMES[0];

  function offscreen() {
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(2, Math.floor(S * dpr));
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    return { c: c, g: g };
  }

  function buildFace() {
    const o = offscreen(), g = o.g, half = S / 2, Rf = half * 0.84, pal = theme().wheel;
    for (let i = 0; i < SEG_COUNT; i++) {
      const a0 = (-90 + i * SEG_DEG) * Math.PI / 180, a1 = a0 + SEG_DEG * Math.PI / 180;
      const col = pal[i % pal.length];
      const grad = g.createRadialGradient(half, half, Rf * 0.12, half, half, Rf);
      grad.addColorStop(0, mixColor(col, false, 0.55));
      grad.addColorStop(0.7, col);
      grad.addColorStop(1, mixColor(col, true, 0.18));
      g.beginPath(); g.moveTo(half, half); g.arc(half, half, Rf, a0, a1); g.closePath();
      g.fillStyle = grad; g.fill();
      g.lineWidth = Math.max(1, S * 0.004); g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
    }
    // Decorative studs only: no numbers are drawn on the wheel
    for (let i = 0; i < SEG_COUNT; i++) {
      const mid = (-90 + (i + 0.5) * SEG_DEG) * Math.PI / 180;
      g.save(); g.translate(half, half); g.rotate(mid + Math.PI / 2);
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.arc(0, -Rf * 0.93, S * 0.009, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.arc(0, -Rf * 0.55, S * 0.022, 0, 6.2832); g.fill();
      g.restore();
    }
    face = o.c;
  }

  function buildRim() {
    const o = offscreen(), g = o.g, half = S / 2, Rf = half * 0.84, th = theme();
    const mid = half * 0.915, w = half * 0.15;
    const grad = g.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, th.a1); grad.addColorStop(1, th.a2);
    g.beginPath(); g.arc(half, half, mid, 0, 6.2832);
    g.lineWidth = w; g.strokeStyle = grad; g.stroke();
    g.lineWidth = Math.max(1, S * 0.006); g.strokeStyle = 'rgba(0,0,0,.45)';
    g.beginPath(); g.arc(half, half, Rf + 1, 0, 6.2832); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.arc(half, half, half * 0.985, 0, 6.2832); g.stroke();
    // Hub
    const hr = half * 0.14, hg = g.createRadialGradient(half, half, 0, half, half, hr);
    hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.35, th.a1); hg.addColorStop(1, th.a2);
    g.beginPath(); g.arc(half, half, hr, 0, 6.2832); g.fillStyle = hg; g.fill();
    g.lineWidth = S * 0.01; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke();
    g.fillStyle = '#07070f'; g.font = '900 ' + Math.round(hr * 0.9) + 'px "Trebuchet MS", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SM', half, half + hr * 0.04);
    rim = o.c;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 10) return;                               // hidden screen: keep old size
    const newS = Math.floor(r.width);
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (newS === S && canvas.width === Math.floor(S * dpr)) return;
    S = newS;
    canvas.width = canvas.height = Math.floor(S * dpr);
    rebuild();
  }
  function rebuild() { if (S > 0) { buildFace(); buildRim(); } }

  /** Draw one frame. theta = wheel rotation in degrees, t = ms timestamp. */
  function draw(theta, t) {
    if (!face) return;
    const half = S / 2, Rf = half * 0.84, th = theme();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);

    ctx.save();
    ctx.translate(half, half); ctx.rotate(theta * Math.PI / 180);
    ctx.drawImage(face, -half, -half, S, S);
    if (pulseIdx >= 0) {                                    // paid-out segment flashes
      const age = (t - pulseT0) / 700;
      if (age < 1) {
        const a0 = (-90 + pulseIdx * SEG_DEG) * Math.PI / 180, a1 = a0 + SEG_DEG * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Rf, a0, a1); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - age)).toFixed(3) + ')'; ctx.fill();
      } else pulseIdx = -1;
    }
    ctx.restore();

    ctx.drawImage(rim, 0, 0, S, S);

    // Chasing rim bulbs
    const bulbs = 24, mid = half * 0.915;
    for (let i = 0; i < bulbs; i++) {
      const a = (i / bulbs) * 6.2832, on = ((i + Math.floor(t / 140)) % 3) === 0;
      const x = half + Math.cos(a) * mid, y = half + Math.sin(a) * mid;
      ctx.fillStyle = on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.3)';
      ctx.beginPath(); ctx.arc(x, y, S * (on ? 0.0145 : 0.01), 0, 6.2832); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x, y, S * 0.028, 0, 6.2832); ctx.fill(); }
    }

    // Pointer (flicks when a segment passes)
    kick *= 0.82;
    ctx.save();
    ctx.translate(half, S * 0.012); ctx.rotate(kick * 0.35);
    const pw = half * 0.09, ph = half * 0.2;
    ctx.beginPath(); ctx.moveTo(-pw, 0); ctx.lineTo(pw, 0); ctx.lineTo(0, ph); ctx.closePath();
    const pg = ctx.createLinearGradient(0, 0, 0, ph);
    pg.addColorStop(0, '#fff6c2'); pg.addColorStop(1, th.a1 === '#fcee0a' ? '#ff003c' : '#ff9d00');
    ctx.fillStyle = pg; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = S * 0.007; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }

  return {
    resize, rebuild, draw,
    pulse(idx, t) { pulseIdx = idx; pulseT0 = t; },
    kick() { kick = 1; }
  };
})();

/* =====================================================================
   8. GAME ENGINE — rotation, rounds, rewards, offline earnings

   How a round works
   -----------------
   * state.roundDeg counts base rotation from 0 to 360. When it passes 360
     the round is complete: `while (roundDeg >= 360)` subtracts exactly 360
     and pays exactly once per crossing, so no reward is skipped or doubled
     even if a frame is slow and several rounds pass at once.
   * The pointer always ends a round centred on `state.target` (a weighted
     random segment chosen when the round begins). The wheel drifts slightly
     ahead/behind during the round (smooth-stepped, so speed never jumps) to
     make that true. The segment under the pointer at the finish line is the
     segment that pays.
   ===================================================================== */
const Game = {
  lastReward: 0,
  lastPointerIdx: -1,
  dirty: true                       // UI needs a refresh
};

/** Weighted random segment index */
function pickTarget() {
  let r = Math.random() * SEG_WEIGHT_SUM;
  for (let i = 0; i < SEG_COUNT; i++) { r -= CONFIG.SEGMENTS[i].w; if (r < 0) return i; }
  return SEG_COUNT - 1;
}
/** Wheel rotation (deg) that puts the pointer in the middle of segment idx */
function thetaFor(idx) { return mod(-(idx + 0.5) * SEG_DEG, 360); }

/** Finish the current round's alignment and choose the next target (works on any state object). */
function beginRound(s) {
  s.offStart = thetaFor(s.target);                 // where the wheel sits right now
  const next = pickTarget();
  s.offDelta = mod(thetaFor(next) - s.offStart + 180, 360) - 180;   // shortest signed drift
  s.target = next;
}

/** Visual rotation of the wheel in degrees */
function visualAngle() {
  const p = state.roundDeg / 360, ease = p * p * (3 - 2 * p);
  return state.roundDeg + state.offStart + state.offDelta * ease;
}
const pointerIndex = (theta) => Math.floor(mod(-theta, 360) / SEG_DEG) % SEG_COUNT;

function addCoins(n) {
  n = Math.max(0, Math.floor(n));
  state.coins += n; state.totalEarned += n; state.runEarned += n; Game.dirty = true;
}

/** Roll the payout for a segment value. */
function rollReward(segValue) {
  const u = state.upgrades;
  const base = (segValue + Calc.coinBonus(u.coin)) * Calc.multiplier(u.multiplier) * Calc.bonusMult();
  const lucky = Math.random() < Calc.luckyChance(u.lucky);
  const jackpot = Math.random() < Calc.jackpotChance(u.jackpot);
  // Random rounding keeps small bonuses (e.g. +25%) fair: 1.25 pays 1 or 2, averaging 1.25
  const pay = (x) => Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  const normal = pay(base * (lucky ? 2 : 1));
  const jackpotAmt = jackpot ? pay(base * Calc.jackpotMult(u.jackpot)) : 0;
  return { normal: normal, lucky: lucky, jackpot: jackpot, jackpotAmt: jackpotAmt, total: normal + jackpotAmt };
}

/** Called exactly once per completed 360° rotation. */
function completeRound(now) {
  const idx = state.target;                       // the segment under the pointer
  const r = rollReward(CONFIG.SEGMENTS[idx].v);
  const st = state.stats;

  addCoins(r.total);
  st.rounds++;
  if (r.total > st.bestReward) st.bestReward = r.total;
  if (r.lucky) st.luckyHits++;
  if (r.jackpot) st.jackpots++;
  Game.lastReward = r.total;

  // Feedback
  Wheel.pulse(idx, now);
  FX.floatText('+' + fmt(r.normal));
  if (UI.current === 'home') FX.coinBurst(false);
  Sound.reward();
  Haptics.vibrate(12, 250);
  if (r.lucky) {
    FX.floatText('LUCKY x2!', 'lucky');
    Sound.lucky(); Haptics.vibrate([30, 40, 30], 400);
  }
  if (r.jackpot) {
    FX.jackpotBanner(r.jackpotAmt); FX.jackpotBurst();
    Sound.jackpot(); Haptics.vibrate([90, 50, 90, 50, 220], 0);
  }

  beginRound(state);                              // choose the next target
  checkProgress();
}

/** Advance the wheel by dt seconds. */
function advance(dt, now) {
  if (dt <= 0) return;
  const rpm = Calc.speedRpm(state.upgrades.speed);
  state.roundDeg += rpm * 6 * dt;                 // 1 RPM = 6 degrees per second
  let guard = 0;
  while (state.roundDeg >= 360 && guard++ < 200) {
    state.roundDeg -= 360;
    completeRound(now);
  }
  if (state.roundDeg >= 360) state.roundDeg = 0;  // safety net, never expected
}

/** Coins earned while the page was closed or hidden. Returns null if nothing earned. */
function calcOffline(awaySec) {
  const lvl = state.upgrades.offline;
  const capSec = Calc.offlineHours(lvl) * 3600;
  const used = Math.min(awaySec, capSec);
  const eff = Calc.offlineEff(lvl);
  const rounds = used * Calc.roundsPerSec() * eff;
  const coins = Math.floor(rounds * Calc.expectedRound());
  if (coins < 1) return null;
  return { away: awaySec, used: used, capped: awaySec > capSec, eff: eff, rounds: Math.floor(rounds), coins: coins, capSec: capSec };
}

/** Compare now with lastSeen and pay offline earnings once. */
function applyAwayEarnings() {
  const now = Date.now();
  const away = (now - state.lastSeen) / 1000;
  state.lastSeen = now;                           // consume the interval immediately (no double pay)
  if (!(away >= CONFIG.OFFLINE_MIN_SECONDS)) return;
  const res = calcOffline(away);
  if (!res) return;
  addCoins(res.coins);
  state.stats.rounds += res.rounds;
  state.stats.offlineEarned += res.coins;
  checkProgress();
  saveGame();
  Sound.claim();
  FX.confetti();
  FX.modal({
    icon: '🌙', title: 'Welcome back!',
    body: 'You were away for <b>' + fmtDuration(away) + '</b>.<br>Your wheel kept earning at <b>' + pct(res.eff) + '</b> efficiency' +
          (res.capped ? ' (capped at ' + (Math.round(res.capSec / 360) / 10) + 'h)' : '') +
          '.<br><br>Offline earnings<br><b style="font-size:26px">🪙 ' + fmtFull(res.coins) + '</b>',
    buttons: [{ label: 'Collect', cls: 'primary' }]
  });
}

/* ---------------- Upgrades ---------------- */
function upgradeDef(id) { return CONFIG.UPGRADES.find((u) => u.id === id); }

function buyUpgrade(id) {
  const def = upgradeDef(id);
  if (!def) return false;
  const lvl = state.upgrades[id];
  if (lvl >= Calc.maxLevel(def)) { FX.toast(def.name + ' is already at max level', 'gold'); return false; }
  const cost = Calc.upgradeCost(def, lvl);
  if (state.coins < cost) {                       // insufficient funds feedback
    FX.toast('Need ' + fmt(cost - state.coins) + ' more coins for ' + def.name, 'bad');
    Sound.error(); Haptics.vibrate([40, 30, 40], 0);
    UI.flashUpgrade(id, 'deny');
    return false;
  }
  state.coins -= cost;
  state.upgrades[id] = lvl + 1;
  state.stats.upgradesBought++;
  state.stats.maxRpm = Math.max(state.stats.maxRpm, Calc.speedRpm(state.upgrades.speed));
  Sound.buy(); Haptics.vibrate(20, 0);
  FX.toast(def.name + ' → Level ' + (lvl + 1), 'good');
  UI.flashUpgrade(id, 'flash');
  Game.dirty = true;
  checkProgress();
  saveGame();
  return true;
}

/* ---------------- Dimensions + Rebirth ---------------- */
const allMaxed = () => CONFIG.UPGRADES.every((u) => state.upgrades[u.id] >= Calc.maxLevel(u));
const dimName = (d) => CONFIG.DIM_NAMES[Math.min(d, CONFIG.DIM_NAMES.length - 1)];

function enterDimension() {
  if (!allMaxed() || state.dimension >= CONFIG.DIM_MAX) return false;
  const cost = Calc.dimCost();
  if (state.coins < cost) {
    FX.toast('Need ' + fmt(cost - state.coins) + ' more coins to open the gate', 'bad');
    Sound.error(); Haptics.vibrate([40, 30, 40], 0);
    return false;
  }
  state.coins -= cost;
  state.dimension++;
  Game.dirty = true;
  applyTheme();                                   // new dimension look
  Sound.jackpot(); Haptics.vibrate([60, 40, 60, 40, 200], 0); FX.confetti(); FX.jackpotBurst();
  FX.modal({
    icon: '🌌', title: 'Welcome to ' + dimName(state.dimension) + '!',
    body: 'You entered <b>Dimension ' + (state.dimension + 1) + '</b>.<br><br>' +
          '💰 All income is now <b>x' + Calc.dimMult() + '</b><br>' +
          '⬆️ Every upgrade can go <b>+' + CONFIG.DIM_EXTRA_LEVELS + ' levels</b> higher',
    buttons: [{ label: 'Let\'s go!', cls: 'primary' }]
  });
  checkProgress(); saveGame(); UI.refresh(true);
  return true;
}

const canRebirth = () => state.runEarned >= Calc.rebirthReq();

function confirmRebirth() {
  if (!canRebirth()) {
    FX.toast('Earn ' + fmt(Calc.rebirthReq() - state.runEarned) + ' more coins this run to rebirth', 'bad');
    Sound.error(); return;
  }
  const next = 1 + CONFIG.REBIRTH_BONUS * (state.rebirths + 1);
  FX.modal({
    icon: '🔁', title: 'Rebirth?',
    body: 'Your coins and all upgrade levels reset to zero.<br>You keep dimensions, themes, missions, achievements and the daily streak.<br><br>' +
          'Permanent income bonus: <b>x' + Calc.rebirthMult().toFixed(2) + ' → x' + next.toFixed(2) + '</b>',
    buttons: [{ label: 'Not now', cls: '' }, { label: 'Rebirth', cls: 'primary', onClick: doRebirth }]
  });
}
function doRebirth() {
  if (!canRebirth()) return;
  state.rebirths++;
  state.coins = 0; state.runEarned = 0;
  CONFIG.UPGRADES.forEach((u) => { state.upgrades[u.id] = 0; });
  Game.dirty = true;
  Sound.claim(); Haptics.vibrate([40, 40, 80], 0); FX.confetti();
  FX.toast('Reborn! Income now x' + Calc.rebirthMult().toFixed(2), 'gold');
  saveGame(); UI.refresh(true);
}

/* =====================================================================
   9. PROGRESS — missions, achievements, themes, daily rewards
   ===================================================================== */
function missionClaimable(m) { return !state.missions.claimed[m.id] && STAT_GETTERS[m.stat]() >= m.target; }

/** Re-check everything that unlocks automatically. Cheap; runs after each round. */
function checkProgress() {
  CONFIG.ACHIEVEMENTS.forEach((a) => {
    if (!state.achievements.unlocked[a.id] && STAT_GETTERS[a.stat]() >= a.target) {
      state.achievements.unlocked[a.id] = true;    // flag first: no duplicate payout
      addCoins(a.reward);
      FX.toast('🏆 ' + a.name + ' unlocked! +' + fmt(a.reward) + ' coins', 'gold');
      Sound.claim(); Haptics.vibrate([40, 40, 80], 0);
      saveGame();
    }
  });
  CONFIG.THEMES.forEach((t) => {
    if (!state.themes.unlocked[t.id] && state.totalEarned >= t.unlock) {
      state.themes.unlocked[t.id] = true;
      FX.toast('🎨 Theme unlocked: ' + t.name, 'gold');
      UI.markThemesDirty();
      saveGame();
    }
  });
}

function claimMission(id) {
  const m = CONFIG.MISSIONS.find((x) => x.id === id);
  if (!m || !missionClaimable(m)) return;
  state.missions.claimed[id] = true;              // flag first: no duplicate payout
  addCoins(m.reward);
  Sound.claim(); Haptics.vibrate(30, 0); FX.confetti();
  FX.toast('Mission complete! +' + fmt(m.reward) + ' coins', 'good');
  checkProgress(); saveGame();
}

/* ---- Daily reward: calendar-day based, with consecutive-day tracking ---- */
function dailyStatus() {
  const today = todayStr(), last = state.daily.lastClaim;
  if (!last) return { canClaim: true, day: 1, broken: false };
  const diff = dayNumber(today) - dayNumber(last);
  if (diff <= 0) return { canClaim: false, day: state.daily.streak, broken: false };   // claimed today (or clock set back)
  if (diff === 1) return { canClaim: true, day: state.daily.streak >= 7 ? 1 : state.daily.streak + 1, broken: false };
  return { canClaim: true, day: 1, broken: true };                                      // missed a day: restart
}
function readSavedDaily() {                       // read what other tabs may have saved
  try { const o = JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY)); return o && o.daily; } catch (e) { return null; }
}
let dailyLock = false;
function claimDaily() {
  if (dailyLock) return;
  dailyLock = true;
  try {
    const info = dailyStatus();
    if (!info.canClaim) { FX.toast('Already claimed today. Come back tomorrow!', 'bad'); Sound.error(); return; }
    const saved = readSavedDaily();               // duplicate guard across tabs/windows
    if (saved && saved.lastClaim === todayStr()) {
      state.daily.lastClaim = saved.lastClaim; state.daily.streak = clamp(Math.floor(saved.streak) || 0, 0, 7);
      FX.toast('Already claimed today. Come back tomorrow!', 'bad'); UI.updateDaily(); return;
    }
    const amount = CONFIG.DAILY_REWARDS[info.day - 1];
    state.daily.lastClaim = todayStr();           // flag first, then pay
    state.daily.streak = info.day;
    addCoins(amount);
    saveGame();
    Sound.claim(); Haptics.vibrate([30, 30, 60], 0); FX.confetti();
    FX.toast('Day ' + info.day + ' reward: +' + fmt(amount) + ' coins', 'gold');
    checkProgress();
    UI.updateDaily();
  } finally { dailyLock = false; }
}

/* =====================================================================
   10. UI
   ===================================================================== */
const UI = (function () {
  const refs = { up: {}, mission: {}, ach: {}, day: [], stat: {}, dim: null, reb: null };
  let current = 'home';
  let themesDirty = true;

  /* ---------- Navigation ---------- */
  function show(name) {
    current = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
    $('screens').scrollTop = 0;
    $('screens').classList.toggle('home-mode', name === 'home');
    if (name === 'home') requestAnimationFrame(() => { Wheel.resize(); });
    if (name === 'settings' && themesDirty) renderThemes();
    refresh(true);
  }

  /* ---------- Upgrades ---------- */
  function buildUpgrades() {
    const list = $('upgradeList'); list.innerHTML = '';
    CONFIG.UPGRADES.forEach((def) => {
      const card = el('div', 'card glass upgrade');
      card.innerHTML =
        '<div class="u-icon">' + def.icon + '</div>' +
        '<div class="u-info"><div class="u-top"><b>' + def.name + '</b><span class="lvl" data-r="lvl"></span></div>' +
        '<div class="u-desc">' + def.desc + '</div><div class="u-eff" data-r="eff"></div>' +
        '<div class="bar"><i data-r="bar"></i></div></div>' +
        '<button class="buy" data-buy="' + def.id + '"><span class="cost" data-r="cost"></span></button>';
      list.appendChild(card);
      const q = (r) => card.querySelector('[data-r="' + r + '"]');
      refs.up[def.id] = { card: card, lvl: q('lvl'), eff: q('eff'), bar: q('bar'), cost: q('cost'), btn: card.querySelector('.buy') };
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (b) buyUpgrade(b.dataset.buy);
    });
    buildDimRebirth();
  }

  /** Dimension gate (appears when every upgrade is maxed) + Rebirth card */
  function buildDimRebirth() {
    const gate = $('dimGate'); gate.innerHTML = '';
    const g = el('div', 'meta-card dim-card');
    g.hidden = true;
    g.innerHTML =
      '<div class="u-icon">🌌</div>' +
      '<div class="u-info"><div class="u-top"><b data-r="title"></b></div>' +
      '<div class="u-desc">Every upgrade is maxed! Open the gate to a new dimension.</div>' +
      '<div class="u-eff" data-r="eff"></div></div>' +
      '<button class="buy gate-btn" data-r="btn"><span data-r="cost"></span></button>';
    gate.appendChild(g);
    const gq = (r) => g.querySelector('[data-r="' + r + '"]');
    refs.dim = { card: g, title: gq('title'), eff: gq('eff'), cost: gq('cost'), btn: gq('btn') };
    refs.dim.btn.addEventListener('click', () => {
      if (!enterDimension()) { g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); }
    });

    const rb = $('rebirthCard'); rb.innerHTML = '';
    const c = el('div', 'meta-card rebirth-card');
    c.innerHTML =
      '<div class="u-icon">🔁</div>' +
      '<div class="u-info"><div class="u-top"><b>Rebirth</b><span class="lvl" data-r="count"></span></div>' +
      '<div class="u-desc">Reset coins and upgrades for a permanent income bonus.</div>' +
      '<div class="u-eff" data-r="eff"></div>' +
      '<div class="bar"><i data-r="bar"></i></div></div>' +
      '<button class="buy reb-btn" data-r="btn"><span data-r="cost"></span></button>';
    rb.appendChild(c);
    const cq = (r) => c.querySelector('[data-r="' + r + '"]');
    refs.reb = { card: c, count: cq('count'), eff: cq('eff'), bar: cq('bar'), cost: cq('cost'), btn: cq('btn') };
    refs.reb.btn.addEventListener('click', confirmRebirth);
  }
  function updateDimRebirth() {
    // Dimension gate
    const d = refs.dim, show = allMaxed() && state.dimension < CONFIG.DIM_MAX;
    d.card.hidden = !show;
    if (show) {
      const cost = Calc.dimCost();
      d.title.textContent = 'Dimension Gate → ' + dimName(state.dimension + 1);
      d.eff.textContent = 'Income x' + Calc.dimMult() + ' → x' + (Calc.dimMult() * CONFIG.DIM_MULT_BASE) + '  ·  upgrades +' + CONFIG.DIM_EXTRA_LEVELS + ' levels';
      d.cost.textContent = '🪙 ' + fmt(cost);
      d.btn.classList.toggle('cant', state.coins < cost);
    }
    // Rebirth
    const r = refs.reb, req = Calc.rebirthReq(), ready = canRebirth();
    r.count.textContent = state.rebirths + ' done';
    r.bar.style.width = (clamp(state.runEarned / req, 0, 1) * 100) + '%';
    const next = 1 + CONFIG.REBIRTH_BONUS * (state.rebirths + 1);
    r.eff.textContent = 'Now x' + Calc.rebirthMult().toFixed(2) + ' → x' + next.toFixed(2) + '  ·  ' + fmt(Math.min(state.runEarned, req)) + ' / ' + fmt(req) + ' coins this run';
    r.cost.textContent = ready ? 'REBIRTH' : '🔒 ' + fmt(req);
    r.btn.classList.toggle('cant', !ready);
    r.btn.classList.toggle('ready', ready);
  }
  function updateUpgrades() {
    updateDimRebirth();
    CONFIG.UPGRADES.forEach((def) => {
      const r = refs.up[def.id], lvl = state.upgrades[def.id], maxLvl = Calc.maxLevel(def), maxed = lvl >= maxLvl;
      r.lvl.textContent = 'Lv ' + lvl + '/' + maxLvl;
      r.eff.textContent = maxed ? 'Now: ' + EFFECT_TEXT[def.id](lvl) + ' (MAX)'
                                : 'Now: ' + EFFECT_TEXT[def.id](lvl) + '  →  Next: ' + EFFECT_TEXT[def.id](lvl + 1);
      r.bar.style.width = (lvl / maxLvl * 100) + '%';
      r.btn.classList.toggle('max', maxed);
      if (maxed) { r.cost.textContent = 'MAX'; r.btn.classList.remove('cant'); }
      else {
        const cost = Calc.upgradeCost(def, lvl);
        r.cost.textContent = '🪙 ' + fmt(cost);
        r.btn.classList.toggle('cant', state.coins < cost);
      }
    });
  }
  function flashUpgrade(id, cls) {
    const r = refs.up[id];
    if (!r) return;
    [r.card, r.btn].forEach((n) => { n.classList.remove(cls, 'shake'); void n.offsetWidth; });
    r.card.classList.add(cls);
    if (cls === 'deny') r.btn.classList.add('shake');
    setTimeout(() => r.card.classList.remove(cls), 700);
  }

  /* ---------- Home ---------- */
  function updateHome() {
    const u = state.upgrades;
    $('chipSpeed').textContent = (Math.round(Calc.speedRpm(u.speed) * 10) / 10) + ' RPM';
    $('chipAvg').textContent = '🪙 ' + fmt(Calc.expectedRound());
    $('chipLucky').textContent = pct(Calc.luckyChance(u.lucky));
    $('chipJackpot').textContent = pct(Calc.jackpotChance(u.jackpot));
    const bm = Calc.bonusMult();
    $('panelSub').textContent = (state.dimension > 0 || state.rebirths > 0)
      ? dimName(state.dimension) + ' · income x' + (Math.round(bm * 100) / 100)
      : 'Spend coins to spin faster';
  }

  /* ---------- Missions ---------- */
  function buildMissions() {
    const list = $('missionList'); list.innerHTML = '';
    CONFIG.MISSIONS.forEach((m) => {
      const card = el('div', 'card glass task');
      card.innerHTML =
        '<div class="t-info"><small class="cat">' + m.cat + '</small><b>' + m.text + '</b><div class="bar"><i data-r="bar"></i></div>' +
        '<div class="t-prog"><span data-r="prog"></span><span>Reward 🪙 ' + fmt(m.reward) + '</span></div></div>' +
        '<button class="claim" data-claim="' + m.id + '"></button>';
      list.appendChild(card);
      refs.mission[m.id] = { card: card, list: list, bar: card.querySelector('[data-r="bar"]'), prog: card.querySelector('[data-r="prog"]'), btn: card.querySelector('.claim') };
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-claim]');
      if (b) claimMission(b.dataset.claim);
    });
  }
  /** Re-orders cards only when the order really changes (so taps are never interrupted). */
  const lastOrder = { mission: '', ach: '' };
  function reorder(kind, ids, rankOf, refMap, list) {
    const sorted = ids.map((id, i) => ({ id: id, i: i, r: rankOf(id) }))
      .sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.id);
    const key = sorted.join(',');
    if (key === lastOrder[kind]) return;
    lastOrder[kind] = key;
    sorted.forEach((id) => list.appendChild(refMap[id].card));
  }

  function updateMissions() {
    // Ready-to-claim missions first, then in progress, then already claimed
    reorder('mission', CONFIG.MISSIONS.map((m) => m.id), (id) => {
      const m = CONFIG.MISSIONS.find((x) => x.id === id);
      return state.missions.claimed[id] ? 2 : (STAT_GETTERS[m.stat]() >= m.target ? 0 : 1);
    }, refs.mission, $('missionList'));
    CONFIG.MISSIONS.forEach((m) => {
      const r = refs.mission[m.id], val = STAT_GETTERS[m.stat](), claimed = !!state.missions.claimed[m.id], done = val >= m.target;
      r.bar.style.width = (clamp(val / m.target, 0, 1) * 100) + '%';
      r.prog.textContent = fmt(Math.min(val, m.target)) + ' / ' + fmt(m.target);
      r.card.classList.toggle('done', done && !claimed);
      if (claimed) { r.btn.className = 'claim claimed'; r.btn.textContent = 'Claimed ✓'; }
      else if (done) { r.btn.className = 'claim ready'; r.btn.textContent = 'Claim'; }
      else { r.btn.className = 'claim'; r.btn.textContent = 'In progress'; }
    });
  }

  /* ---------- Achievements ---------- */
  function buildAchievements() {
    const list = $('achievementList'); list.innerHTML = '';
    CONFIG.ACHIEVEMENTS.forEach((a) => {
      const card = el('div', 'card glass task locked-ach');
      card.innerHTML =
        '<div class="a-ico">' + a.icon + '</div>' +
        '<div class="t-info"><b>' + a.name + '</b><small>' + a.text + '</small><div class="bar"><i data-r="bar"></i></div>' +
        '<div class="t-prog"><span data-r="prog"></span><span>Bonus 🪙 ' + fmt(a.reward) + '</span></div></div>' +
        '<div class="claim" data-r="state"></div>';
      list.appendChild(card);
      refs.ach[a.id] = { card: card, bar: card.querySelector('[data-r="bar"]'), prog: card.querySelector('[data-r="prog"]'), st: card.querySelector('[data-r="state"]') };
    });
  }
  function updateAchievements() {
    // Unlocked achievements first, then locked ones
    reorder('ach', CONFIG.ACHIEVEMENTS.map((a) => a.id),
      (id) => (state.achievements.unlocked[id] ? 0 : 1), refs.ach, $('achievementList'));
    CONFIG.ACHIEVEMENTS.forEach((a) => {
      const r = refs.ach[a.id], val = STAT_GETTERS[a.stat](), got = !!state.achievements.unlocked[a.id];
      r.bar.style.width = (clamp(val / a.target, 0, 1) * 100) + '%';
      r.prog.textContent = a.stat === 'play' ? fmtDuration(Math.min(val, a.target)) + ' / ' + fmtDuration(a.target)
                                             : fmt(Math.min(val, a.target)) + ' / ' + fmt(a.target);
      r.card.classList.toggle('done', got);
      r.card.classList.toggle('locked-ach', !got);
      r.st.className = 'claim' + (got ? ' claimed' : '');
      r.st.textContent = got ? 'Unlocked ✓' : 'Locked';
    });
  }

  /* ---------- Daily ---------- */
  function buildDaily() {
    const grid = $('dailyGrid'); grid.innerHTML = '';
    refs.day = [];
    CONFIG.DAILY_REWARDS.forEach((amt, i) => {
      const d = el('div', 'day glass' + (i === 6 ? ' big' : ''));
      d.innerHTML = '<span class="d-n">Day ' + (i + 1) + '</span><span class="d-ico">' + (i === 6 ? '👑' : '🎁') + '</span><b>🪙 ' + fmt(amt) + '</b><span class="d-state"></span>';
      grid.appendChild(d);
      refs.day.push({ card: d, st: d.querySelector('.d-state') });
    });
    $('dailyClaim').addEventListener('click', claimDaily);
  }
  function updateDaily() {
    const info = dailyStatus();
    const claimedUpTo = info.canClaim ? (info.broken || info.day === 1 ? 0 : info.day - 1) : state.daily.streak;
    refs.day.forEach((r, i) => {
      const n = i + 1, claimed = n <= claimedUpTo, current = info.canClaim && n === info.day;
      r.card.classList.toggle('claimed', claimed);
      r.card.classList.toggle('current', current);
      r.st.textContent = claimed ? 'Claimed ✓' : current ? 'Today' : '';
    });
    $('dailyStreak').textContent = (info.canClaim && info.broken ? 0 : claimedUpTo) + ' day' + ((claimedUpTo === 1) ? '' : 's');
    const btn = $('dailyClaim');
    btn.disabled = !info.canClaim;
    if (info.canClaim) {
      btn.textContent = 'Claim Day ' + info.day + ' · 🪙 ' + fmt(CONFIG.DAILY_REWARDS[info.day - 1]);
      $('dailyTimer').textContent = info.broken ? 'Streak reset — start again!' : 'Reward ready!';
    } else {
      btn.textContent = 'Come back tomorrow';
      const ms = msUntilMidnight(), s = Math.floor(ms / 1000);
      $('dailyTimer').textContent = 'Next reward in ' + pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s % 3600 / 60)) + ':' + pad2(s % 60);
    }
  }

  /* ---------- Stats ---------- */
  function buildStats() {
    const grid = $('statsGrid'); grid.innerHTML = '';
    const defs = [
      ['earned', '💰', 'Total coins earned'], ['balance', '🪙', 'Current balance'],
      ['rounds', '🎡', 'Rounds completed'], ['upgrades', '⚡', 'Upgrades bought'],
      ['rpm', '🚀', 'Highest speed'], ['jackpots', '💎', 'Jackpots won'],
      ['lucky', '🍀', 'Lucky bonuses'], ['best', '⭐', 'Best single reward'],
      ['offline', '🌙', 'Offline earnings'], ['play', '⏱️', 'Play time'],
      ['dimension', '🌌', 'Dimension'], ['rebirths', '🔁', 'Rebirths']
    ];
    defs.forEach((d) => {
      const c = el('div', 'stat glass', '<span class="ico">' + d[1] + '</span><small>' + d[2] + '</small><b data-r="v">0</b>');
      grid.appendChild(c); refs.stat[d[0]] = c.querySelector('[data-r="v"]');
    });
  }
  function updateStats() {
    const s = state.stats, r = refs.stat;
    r.earned.textContent = fmtFull(state.totalEarned);
    r.balance.textContent = fmtFull(state.coins);
    r.rounds.textContent = fmtFull(s.rounds);
    r.upgrades.textContent = fmtFull(s.upgradesBought);
    r.rpm.textContent = (Math.round(s.maxRpm * 10) / 10) + ' RPM';
    r.jackpots.textContent = fmtFull(s.jackpots);
    r.lucky.textContent = fmtFull(s.luckyHits);
    r.best.textContent = fmtFull(s.bestReward);
    r.offline.textContent = fmtFull(s.offlineEarned);
    r.play.textContent = fmtDuration(s.playSeconds);
    r.dimension.textContent = (state.dimension + 1) + ' · ' + dimName(state.dimension);
    r.rebirths.textContent = fmtFull(state.rebirths);
  }

  /* ---------- Settings ---------- */
  function syncSettings() {
    const s = state.settings;
    $('setMusic').checked = s.music; $('setSpin').checked = s.spinSound; $('setReward').checked = s.rewardSound;
    $('setVibe').checked = s.vibration;
    $('setMusicVol').value = Math.round(s.musicVol * 100); $('setSfxVol').value = Math.round(s.sfxVol * 100);
  }
  function bindSettings() {
    $('setMusic').addEventListener('change', (e) => { state.settings.music = e.target.checked; Sound.unlock(); Sound.syncMusic(); saveGame(); });
    $('setSpin').addEventListener('change', (e) => { state.settings.spinSound = e.target.checked; saveGame(); });
    $('setReward').addEventListener('change', (e) => { state.settings.rewardSound = e.target.checked; saveGame(); if (e.target.checked) { Sound.unlock(); Sound.reward(); } });
    $('setVibe').addEventListener('change', (e) => { state.settings.vibration = e.target.checked; saveGame(); if (e.target.checked) Haptics.vibrate(40, 0); });
    $('setMusicVol').addEventListener('input', (e) => { state.settings.musicVol = e.target.value / 100; Sound.applyVolumes(); });
    $('setSfxVol').addEventListener('input', (e) => { state.settings.sfxVol = e.target.value / 100; Sound.applyVolumes(); });
    $('setMusicVol').addEventListener('change', saveGame);
    $('setSfxVol').addEventListener('change', () => { saveGame(); Sound.reward(); });
    $('resetBtn').addEventListener('click', confirmReset);
  }

  function renderThemes() {
    themesDirty = false;
    const grid = $('themeGrid'); grid.innerHTML = '';
    CONFIG.THEMES.forEach((t) => {
      const unlocked = !!state.themes.unlocked[t.id], sel = state.themes.selected === t.id;
      const b = el('button', 'theme' + (sel ? ' selected' : '') + (unlocked ? '' : ' locked'));
      b.innerHTML = '<div class="sw" style="background:linear-gradient(135deg,' + t.a1 + ',' + t.a2 + ')"></div><b>' + t.name + '</b><small>' +
        (sel ? 'Selected' : unlocked ? 'Tap to use' : 'Earn ' + fmt(t.unlock) + ' total coins') + '</small>';
      b.addEventListener('click', () => {
        if (!unlocked) { FX.toast('Earn ' + fmtFull(t.unlock) + ' total coins to unlock ' + t.name, 'bad'); Sound.error(); return; }
        state.themes.selected = t.id; applyTheme(); saveGame(); renderThemes(); Sound.click();
      });
      grid.appendChild(b);
    });
  }

  function confirmReset() {
    FX.modal({
      icon: '⚠️', title: 'Reset all progress?',
      body: 'This permanently deletes your coins, upgrades, dimensions, rebirths, missions, achievements, daily streak and unlocked themes. <b>It cannot be undone.</b>',
      buttons: [
        { label: 'Keep playing', cls: '' },
        { label: 'Reset everything', cls: 'danger solid', onClick: resetProgress }
      ]
    });
  }
  function resetProgress() {
    try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) { /* ignored */ }
    state = defaultState();
    state.target = pickTarget(); beginRound(state);
    Game.lastReward = 0; Game.lastPointerIdx = -1; Game.dirty = true;
    applyTheme(); syncSettings(); Sound.applyVolumes(); Sound.syncMusic();
    themesDirty = true; renderThemes();
    lastOrder.mission = ''; lastOrder.ach = '';
    saveGame();
    show('home');
    FX.toast('Progress reset. Fresh start!', 'good');
  }

  /* ---------- Periodic refresh ---------- */
  function refresh(force) {
    $('balance').textContent = fmt(state.coins);
    $('cps').textContent = '+' + fmt(Calc.expectedRound() * Calc.roundsPerSec()) + '/s';
    const claimable = CONFIG.MISSIONS.filter(missionClaimable).length;
    const bm = $('badgeMissions'); bm.hidden = claimable === 0; bm.textContent = claimable;
    const bd = $('badgeDaily'); const canDaily = dailyStatus().canClaim; bd.hidden = !canDaily; bd.textContent = '!';

    if (current === 'home') { updateHome(); updateUpgrades(); }
    else if (current === 'missions') updateMissions();
    else if (current === 'achievements') updateAchievements();
    else if (current === 'daily') updateDaily();
    else if (current === 'stats') updateStats();
  }
  let lastBalance = -1;
  function bumpWallet() {
    if (state.coins > lastBalance && lastBalance >= 0) {
      const w = $('walletPill'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump');
    }
    lastBalance = state.coins;
  }

  function init() {
    buildUpgrades(); buildMissions(); buildAchievements(); buildDaily(); buildStats();
    bindSettings(); syncSettings(); renderThemes();
    $('bottomNav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-nav]');
      if (b) { Sound.click(); show(b.dataset.nav); }
    });
    refresh(true);
  }

  return {
    init, refresh, show, flashUpgrade, updateDaily, bumpWallet,
    markThemesDirty() { themesDirty = true; if (current === 'settings') renderThemes(); },
    get current() { return current; }
  };
})();

/** Apply the selected theme's colours to CSS variables and the wheel. */
function applyTheme() {
  const t = CONFIG.THEMES.find((x) => x.id === state.themes.selected) || CONFIG.THEMES[0];
  const root = document.documentElement.style;
  root.setProperty('--a1', t.a1); root.setProperty('--a1rgb', hexToRgb(t.a1).join(','));
  root.setProperty('--a2', t.a2); root.setProperty('--a2rgb', hexToRgb(t.a2).join(','));
  root.setProperty('--bg0', t.bg0); root.setProperty('--bg1', t.bg1);
  root.setProperty('--dimhue', (state.dimension * 47) + 'deg');
  document.documentElement.classList.toggle('dim-on', state.dimension > 0);
  const m = $('metaTheme'); if (m) m.setAttribute('content', t.bg0);
  if (typeof Backdrop !== 'undefined') Backdrop.refresh();
  Wheel.rebuild();
}

/* =====================================================================
   10b. BACKDROP — animated stars, particles and moving glow
   Own canvas (#bgCanvas) behind the whole game. Colours follow the theme.
   Pauses when the tab is hidden; slow/static when "reduce motion" is on.
   ===================================================================== */
const Backdrop = (() => {
  const cv = document.getElementById('bgCanvas');
  if (!cv) return { refresh() {} };
  const g = cv.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, stars = [], motes = [], orbs = [];
  let c1 = [0, 240, 255], c2 = [180, 0, 255], last = 0, raf = 0;

  function refresh() {
    const cs = getComputedStyle(document.documentElement);
    const p = (v, d) => (cs.getPropertyValue(v).trim() || d).split(',').map(Number);
    c1 = p('--a1rgb', '0,240,255'); c2 = p('--a2rgb', '180,0,255');
  }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const area = W * H, n = Math.max(60, Math.min(170, Math.round(area / 7000)));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.3 + 0.3, tw: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.8,
      v: 2 + Math.random() * 7                       // slow downward drift (px/s)
    }));
    motes = Array.from({ length: Math.round(n / 4) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2.2 + 1, v: 12 + Math.random() * 22,
      ph: Math.random() * 6.28, sw: 8 + Math.random() * 16, k: Math.random() < 0.5 ? 0 : 1
    }));
    orbs = [
      { x: 0.2, y: 0.18, r: 0.55, sx: 0.07, sy: 0.05, ph: 0,   k: 1 },
      { x: 0.85, y: 0.5, r: 0.50, sx: 0.06, sy: 0.08, ph: 2.1, k: 0 },
      { x: 0.4, y: 0.9,  r: 0.45, sx: 0.09, sy: 0.05, ph: 4.2, k: 1 }
    ];
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((ts - last) / 1000 || 0.016, 0.05); last = ts;
    const t = ts / 1000, m = reduce ? 0.15 : 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // moving glow orbs
    g.globalCompositeOperation = 'lighter';
    for (const o of orbs) {
      const cx = W * (o.x + Math.sin(t * o.sx * m + o.ph) * 0.18);
      const cy = H * (o.y + Math.cos(t * o.sy * m + o.ph) * 0.12);
      const rad = Math.max(W, H) * o.r, c = o.k ? c2 : c1;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, `rgba(${c},0.20)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }

    // twinkling stars
    g.globalCompositeOperation = 'source-over';
    for (const s of stars) {
      s.y += s.v * dt * m; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.tw));
      g.globalAlpha = a; g.fillStyle = '#fff';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.2832); g.fill();
    }

    // rising glowing particles
    g.globalCompositeOperation = 'lighter';
    for (const p of motes) {
      p.y -= p.v * dt * m; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      const x = p.x + Math.sin(t * 0.8 + p.ph) * p.sw;
      const c = p.k ? c2 : c1, fade = Math.min(1, Math.min(p.y, H - p.y) / 120 + 0.25);
      const gr = g.createRadialGradient(x, p.y, 0, x, p.y, p.r * 5);
      gr.addColorStop(0, `rgba(${c},${0.55 * fade})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.globalAlpha = 1; g.fillStyle = gr;
      g.fillRect(x - p.r * 5, p.y - p.r * 5, p.r * 10, p.r * 10);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  build(); refresh(); start();
  addEventListener('resize', build);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  return { refresh };
})();

/* =====================================================================
   11. BOOT — start-up + the requestAnimationFrame loop
   ===================================================================== */
let lastFrame = 0, uiAcc = 0, saveAcc = 0;

/** The one and only game loop. It never stops for navigation or popups. */
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = now;
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (dt < 0) dt = 0;
  // A gap this long means the device slept or the tab was frozen. Offline
  // earnings (visibilitychange / resume) pay for that time, so skip it here.
  if (dt > 5) dt = 0;

  advance(dt, now);
  state.stats.playSeconds += dt;

  const theta = visualAngle();
  const idx = pointerIndex(theta);
  if (idx !== Game.lastPointerIdx) {
    if (Game.lastPointerIdx !== -1) { Sound.tick(); Wheel.kick(); }
    Game.lastPointerIdx = idx;
  }
  if (UI.current === 'home') Wheel.draw(theta, now);     // skip drawing while another screen is open
  FX.update(dt);

  if (UI.current === 'home') {
    const p = state.roundDeg / 360 * 100;
    $('roundBar').style.width = p.toFixed(1) + '%';
    $('roundPct').textContent = Math.floor(p) + '%';
  }

  uiAcc += dt * 1000; saveAcc += dt * 1000;
  if (uiAcc >= CONFIG.UI_INTERVAL_MS) { uiAcc = 0; UI.bumpWallet(); UI.refresh(false); Game.dirty = false; }
  if (saveAcc >= CONFIG.SAVE_INTERVAL_MS) { saveAcc = 0; saveGame(); }
}

function boot() {
  state = loadGame();
  applyTheme();
  UI.init();
  Wheel.resize();
  window.addEventListener('resize', () => { Wheel.resize(); FX.resize(); });
  if (window.ResizeObserver) new ResizeObserver(() => Wheel.resize()).observe($('wheelWrap'));

  // First tap/click unlocks audio (browser autoplay policy)
  const unlockOnce = () => { Sound.unlock(); window.removeEventListener('pointerdown', unlockOnce); window.removeEventListener('keydown', unlockOnce); };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('keydown', unlockOnce);

  // Tab inactivity: save + silence when hidden, pay offline earnings on return
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveGame(); Sound.suspend(); }
    else { lastFrame = 0; Sound.resume(); applyAwayEarnings(); Game.dirty = true; }
  });
  window.addEventListener('pagehide', saveGame);
  window.addEventListener('pageshow', (e) => { if (e.persisted) { lastFrame = 0; applyAwayEarnings(); } });

  // PWA: install button + service worker
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(() => { deferredPrompt = null; $('installBtn').hidden = true; });
  });
  window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; FX.toast('Spin Master installed!', 'good'); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('service-worker.js').catch((err) => console.warn('Service worker failed', err));
  }

  checkProgress();
  applyAwayEarnings();          // pay for time spent with the page closed
  saveGame();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
