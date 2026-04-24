// ============================================================
//  GRAD DASH - Graduation Themed Platformer
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---- Responsive canvas ----
function resizeCanvas() {
  const maxW = 900, maxH = 500;
  const ratio = maxW / maxH;
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  let displayW, displayH;
  if (winW / winH > ratio) {
    displayH = Math.min(winH, maxH);
    displayW = displayH * ratio;
  } else {
    displayW = Math.min(winW, maxW);
    displayH = displayW / ratio;
  }

  // Account for device pixel ratio for crisp rendering on mobile
  const dpr = window.devicePixelRatio || 1;

  // Set the canvas CSS size (what you see)
  canvas.style.width  = displayW + 'px';
  canvas.style.height = displayH + 'px';

  // Set the actual canvas buffer size (scaled up by dpr)
  canvas.width  = Math.round(displayW * dpr);
  canvas.height = Math.round(displayH * dpr);

  // Scale all drawing by dpr so logical units stay the same
  SCALE = (displayW / maxW) * dpr;
}

let SCALE = 1;
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
});

// ---- Game constants (logical units, scaled at draw time) ----
const LW = 900, LH = 500;   // logical width/height
const GROUND_Y = 420;
const GRAVITY = 0.35;  // Reduced from 0.4 for easier jumping
const JUMP_FORCE = -11.5;  // Increased from -11 for higher jumps
const GAME_SPEED_INIT = 3.5;  // Reduced from 4 for slower pace
// 4 regular levels × 100m + 1 boss level × 200m = 600m total
const LEVEL_DISTANCE = 100;
const BOSS_DISTANCE = 200;
const WIN_DISTANCE = LEVEL_DISTANCE * 4 + BOSS_DISTANCE; // 600m

// ---- State ----
let state = 'start';  // start | playing | dead | win
let score = 0;
let bestScore = 0;
let gameSpeed = GAME_SPEED_INIT;
let frameCount = 0;
let particles = [];
let stars = [];
let mysterySymbols = [];
let backgroundElements = [];
let currentTheme = 'freshman';
let themeTransition = 0;
let sceneEffects = [];
let isBossLevel = false;
let bossEffects = [];

// ---- Player ----
const player = {
  x: 120, y: GROUND_Y - 54,
  w: 44, h: 54,
  vy: 0,
  onGround: true,
  jumping: false,
  jumpCount: 0,
  maxJumps: 2,   // double jump allowed
  dead: false,
  animFrame: 0,
  animTimer: 0,
  coyoteTime: 0,  // grace period for jumping after leaving ground
  jumpBuffer: 0,  // buffer for early jump inputs
};

// ---- Obstacles ----
let obstacles = [];
let obstacleTimer = 0;
let nextObstacleIn = 90;

// Obstacle pattern groups — picked randomly to create interesting runs
// null = ~80px breathing room between obstacles (enough to land + re-jump)
const OBSTACLE_PATTERNS = {
  freshman: [
    ['spike'],
    ['low_block'],
    ['medium_block'],
    ['spike', null, 'low_block'],
    ['low_block', null, 'spike'],
    ['medium_block', null, 'spike'],
  ],
  sophomore: [
    ['spike'],
    ['medium_block'],
    ['tall_block'],
    ['spike', null, 'medium_block'],
    ['medium_block', null, 'spike'],
    ['spike', null, null, 'spike'],
    ['low_block', null, 'tall_block'],
  ],
  junior: [
    ['tall_block'],
    ['double_spike'],
    ['gap'],
    ['spike', null, 'tall_block'],
    ['medium_block', null, null, 'spike'],
    ['gap', null, null, 'spike'],
    ['tall_block', null, null, 'double_spike'],
  ],
  senior: [
    ['tall_block'],
    ['double_spike'],
    ['gap'],
    ['tall_block', null, null, 'double_spike'],
    ['gap', null, null, 'spike'],
    ['double_spike', null, null, 'tall_block'],
    ['gap', null, null, 'double_spike'],
  ],
  finals: [
    ['dragon_spike'],
    ['magic_barrier'],
    ['void_gap'],
    ['boss_attack'],
    ['dragon_spike', null, null, 'magic_barrier'],
    ['void_gap', null, null, 'dragon_spike'],
    ['boss_attack', null, null, 'dragon_spike'],
    ['dragon_spike', null, null, null, 'dragon_spike'],
    ['void_gap', null, null, 'boss_attack'],
    ['magic_barrier', null, null, null, 'dragon_spike'],
  ]
};

function getPatternKey() {
  if (score < 100) return 'freshman';
  if (score < 200) return 'sophomore';
  if (score < 300) return 'junior';
  if (score < 400) return 'senior';
  return 'finals';
}

function scheduleNextObstacle() {
  const isBoss = score >= 400;
  if (isBoss) {
    nextObstacleIn = Math.floor(Math.random() * 60) + 50; // 50–110 frames for boss
  } else {
    nextObstacleIn = Math.floor(Math.random() * 90) + 70; // 70–160 frames — generous gaps
  }
}

// ---- Background layers ----
const COLLEGE_THEMES = {
  freshman: { 
    name: 'Freshman Year', 
    bg: '#2a1a4a', 
    ground: '#4a3a6a',
    difficulty: 1,
    speed: 1,
    elements: ['🎒', '🍕', '📚', '😅', '🏫'],
    obstacleTypes: ['spike', 'low_block', 'medium_block']
  },
  sophomore: { 
    name: 'Sophomore Year', 
    bg: '#1a3a4a', 
    ground: '#3a5a6a',
    difficulty: 1.3,
    speed: 1.2,
    elements: ['📝', '☕', '🏃‍♂️', '📱', '🎵'],
    obstacleTypes: ['spike', 'low_block', 'medium_block', 'tall_block']
  },
  junior: { 
    name: 'Junior Year', 
    bg: '#4a2a1a', 
    ground: '#6a4a3a',
    difficulty: 1.6,
    speed: 1.4,
    elements: ['📖', '⏰', '😤', '💼', '🔥'],
    obstacleTypes: ['spike', 'medium_block', 'tall_block', 'gap']
  },
  senior: { 
    name: 'Senior Year', 
    bg: '#4a1a2a', 
    ground: '#6a3a4a',
    difficulty: 2,
    speed: 1.6,
    elements: ['🎓', '💸', '😭', '📜', '⚡'],
    obstacleTypes: ['spike', 'tall_block', 'gap', 'double_spike']
  },
  finals: { 
    name: 'GRADUATION FINALS', 
    bg: '#1a1a1a', 
    ground: '#3a1a3a',
    difficulty: 3,
    speed: 2,
    elements: ['🐉', '⚔️', '🔮', '💀', '🌟'],
    obstacleTypes: ['dragon_spike', 'magic_barrier', 'void_gap', 'boss_attack']
  }
};

function getCurrentTheme() {
  if (score < 100) return COLLEGE_THEMES.freshman;
  if (score < 200) return COLLEGE_THEMES.sophomore;
  if (score < 300) return COLLEGE_THEMES.junior;
  if (score < 400) return COLLEGE_THEMES.senior;
  return COLLEGE_THEMES.finals;
}

function createSceneTransition(newTheme) {
  // Create dramatic transition effects
  for (let i = 0; i < 30; i++) {
    sceneEffects.push({
      type: 'transition',
      x: Math.random() * LW,
      y: Math.random() * LH,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 1,
      decay: 0.02,
      color: newTheme.bg,
      size: Math.random() * 20 + 10
    });
  }
  
  // Boss level special effects
  if (newTheme === COLLEGE_THEMES.finals) {
    isBossLevel = true;
    // Lightning effects
    for (let i = 0; i < 10; i++) {
      bossEffects.push({
        type: 'lightning',
        x: Math.random() * LW,
        y: 0,
        life: 1,
        decay: 0.05,
        width: Math.random() * 5 + 2
      });
    }
  }
}

function initBackgroundElements() {
  backgroundElements = [];
  const theme = getCurrentTheme();
  const count = isBossLevel ? 25 : 15;
  
  for (let i = 0; i < count; i++) {
    backgroundElements.push({
      x: Math.random() * LW * 2,
      y: Math.random() * (GROUND_Y - 100) + 50,
      element: theme.elements[Math.floor(Math.random() * theme.elements.length)],
      speed: Math.random() * 0.4 + 0.2,
      scale: Math.random() * 0.6 + 0.4,
      alpha: isBossLevel ? Math.random() * 0.8 + 0.4 : Math.random() * 0.4 + 0.3,
      rotation: isBossLevel ? Math.random() * Math.PI * 2 : 0,
      rotSpeed: isBossLevel ? (Math.random() - 0.5) * 0.1 : 0
    });
  }
}

function initStars() {
  stars = [];
  const count = isBossLevel ? 60 : 30;
  
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * LW,
      y: Math.random() * (GROUND_Y - 60),
      r: Math.random() * (isBossLevel ? 2 : 1.2) + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random() * (isBossLevel ? 0.8 : 0.4) + 0.2,
      twinkle: isBossLevel ? Math.random() * 0.02 + 0.01 : 0
    });
  }
}

function initMysterySymbols() {
  mysterySymbols = [];
  const syms = ['?', '8', '?', '?', '??', '??', '??', '?'];
  for (let i = 0; i < 12; i++) {
    mysterySymbols.push({
      x: Math.random() * LW,
      y: Math.random() * (GROUND_Y - 80) + 20,
      sym: syms[Math.floor(Math.random() * syms.length)],
      alpha: Math.random() * 0.18 + 0.05,
      speed: Math.random() * 0.3 + 0.05,
    });
  }
}

initStars();
initBackgroundElements();

// ---- Obstacle templates ----
// Max jumpable height with single jump: ~130px (conservative, JUMP_FORCE=-11, GRAVITY=0.4)
// Double jump adds ~100px more but only from air — ground obstacles must stay under ~120px
const OBSTACLE_TYPES = {
  // Basic obstacles (Freshman/Sophomore)
  spike:        { w: 28, h: 38,  color: '#ff4444' },
  low_block:    { w: 38, h: 28,  color: '#666666' },
  medium_block: { w: 40, h: 48,  color: '#555555' },

  // Advanced obstacles (Junior/Senior) — still jumpable with single jump
  tall_block:   { w: 35, h: 65,  color: '#444444' },
  double_spike: { w: 52, h: 38,  color: '#ff3333' },
  gap:          { w: 65, h: 0,   isGap: true },

  // Boss level — ground obstacles capped at 70px; floating attack has 180px clearance
  dragon_spike: { w: 32, h: 50,  color: '#8b0000', boss: true },
  magic_barrier:{ w: 45, h: 70,  color: '#4b0082', boss: true },
  void_gap:     { w: 85, h: 0,   isGap: true, boss: true },
  // floatY: player needs to duck under — gap between ground and bottom = 180px, very passable
  boss_attack:  { w: 95, h: 22,  floatY: GROUND_Y - 180, color: '#ff0000', boss: true }
};

function spawnObstacleByType(typeName, xOffset) {
  const tmpl = OBSTACLE_TYPES[typeName];
  if (!tmpl) return;

  const obs = Object.assign({ type: typeName }, tmpl);
  obs.x = LW + 20 + xOffset;

  if (obs.isGap) {
    obs.y = GROUND_Y;
    obs.h = LH - GROUND_Y;
  } else {
    obs.y = (obs.floatY !== undefined) ? obs.floatY : GROUND_Y - obs.h;
  }

  if (obs.boss) {
    obs.glowIntensity = Math.random() * 0.5 + 0.5;
    obs.pulseSpeed = Math.random() * 0.05 + 0.02;
  }

  obstacles.push(obs);
}

function spawnObstacle() {
  const key = getPatternKey();
  const patterns = OBSTACLE_PATTERNS[key];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  // Each null in pattern = ~80px gap before next obstacle
  let xOffset = 0;
  pattern.forEach(item => {
    if (item === null) {
      xOffset += 80;
    } else {
      spawnObstacleByType(item, xOffset);
      const tmpl = OBSTACLE_TYPES[item];
      xOffset += (tmpl ? tmpl.w : 40) + 20;
    }
  });
}

// ---- Characters ----
const CHARACTERS = {
  treyvon: {
    skinColor: '#5c3317',
    gownColor: '#1a1a2e',
    gownAlt: '#2a2a4e',
    hairColor: '#1a0a00',
    accentColor: '#ffd700',  // gold chain
    hasAfro: true,
    hasBuzzcut: false,
    hasCurlyLong: false,
  },
  brad: {
    skinColor: '#f5c89a',
    gownColor: '#1e4d8c',
    gownAlt: '#2a5fa0',
    hairColor: '#c8a060',
    accentColor: '#7ec8e3',  // surfer blue
    hasAfro: false,
    hasBuzzcut: true,
    hasCurlyLong: false,
  },
  taki: {
    skinColor: '#e8c090',
    gownColor: '#2d2d2d',
    gownAlt: '#3d3d3d',
    hairColor: '#d4b84a',
    accentColor: '#ff6b35',  // skater orange
    hasAfro: false,
    hasBuzzcut: false,
    hasCurlyLong: true,
  }
};

let selectedChar = 'treyvon';

function drawCharacter(ctx2, char, x, y, w, h, animFrame, onGround, scale) {
  const c = CHARACTERS[char];
  const s = scale || 1;
  const px = x, py = y, pw = w * s, ph = h * s;

  // --- Afro (Treyvon) — drawn behind head ---
  if (c.hasAfro) {
    ctx2.fillStyle = c.hairColor;
    ctx2.beginPath();
    ctx2.arc(px + pw * 0.5, py + ph * 0.18, pw * 0.38, 0, Math.PI * 2);
    ctx2.fill();
    // afro texture bumps
    ctx2.fillStyle = '#2a1200';
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx2.beginPath();
      ctx2.arc(
        px + pw * 0.5 + Math.cos(angle) * pw * 0.28,
        py + ph * 0.18 + Math.sin(angle) * pw * 0.28,
        pw * 0.09, 0, Math.PI * 2
      );
      ctx2.fill();
    }
  }

  // --- Long curly hair (Taki) — behind head ---
  if (c.hasCurlyLong) {
    ctx2.fillStyle = c.hairColor;
    // flowing hair down sides
    ctx2.beginPath();
    ctx2.ellipse(px + pw * 0.18, py + ph * 0.35, pw * 0.14, ph * 0.28, -0.3, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.ellipse(px + pw * 0.82, py + ph * 0.35, pw * 0.14, ph * 0.28, 0.3, 0, Math.PI * 2);
    ctx2.fill();
    // top hair
    ctx2.beginPath();
    ctx2.arc(px + pw * 0.5, py + ph * 0.12, pw * 0.28, Math.PI, 0);
    ctx2.fill();
    // curly highlights
    ctx2.strokeStyle = '#b8960a';
    ctx2.lineWidth = 1.5 * s;
    for (let i = 0; i < 4; i++) {
      ctx2.beginPath();
      ctx2.arc(px + pw * (0.15 + i * 0.22), py + ph * (0.28 + (i % 2) * 0.1), pw * 0.06, 0, Math.PI * 2);
      ctx2.stroke();
    }
  }

  // --- Graduation cap ---
  ctx2.fillStyle = '#1a1a1a';
  ctx2.fillRect(px + pw * 0.1, py + ph * 0.05, pw * 0.8, ph * 0.14);
  ctx2.fillRect(px + pw * 0.25, py, pw * 0.5, ph * 0.07);
  // Tassel
  ctx2.fillStyle = c.accentColor;
  ctx2.fillRect(px + pw * 0.82, py + ph * 0.04, pw * 0.06, ph * 0.18);

  // --- Face ---
  ctx2.fillStyle = c.skinColor;
  ctx2.fillRect(px + pw * 0.28, py + ph * 0.16, pw * 0.44, ph * 0.26);

  // Eyes
  ctx2.fillStyle = '#111';
  if (animFrame < 3) {
    ctx2.fillRect(px + pw * 0.34, py + ph * 0.22, pw * 0.09, ph * 0.08);
    ctx2.fillRect(px + pw * 0.57, py + ph * 0.22, pw * 0.09, ph * 0.08);
  } else {
    ctx2.fillRect(px + pw * 0.34, py + ph * 0.26, pw * 0.09, ph * 0.02);
    ctx2.fillRect(px + pw * 0.57, py + ph * 0.26, pw * 0.09, ph * 0.02);
  }

  // Buzz cut (Brad) — flat top strip
  if (c.hasBuzzcut) {
    ctx2.fillStyle = c.hairColor;
    ctx2.fillRect(px + pw * 0.2, py + ph * 0.1, pw * 0.6, ph * 0.08);
  }

  // --- Chain (Treyvon) ---
  if (c.hasAfro) {
    ctx2.strokeStyle = c.accentColor;
    ctx2.lineWidth = 2 * s;
    ctx2.beginPath();
    ctx2.arc(px + pw * 0.5, py + ph * 0.52, pw * 0.18, 0.2, Math.PI - 0.2);
    ctx2.stroke();
    // pendant
    ctx2.fillStyle = c.accentColor;
    ctx2.beginPath();
    ctx2.arc(px + pw * 0.5, py + ph * 0.54, pw * 0.05, 0, Math.PI * 2);
    ctx2.fill();
  }

  // --- Skater chain/belt (Taki) ---
  if (c.hasCurlyLong) {
    ctx2.strokeStyle = '#888';
    ctx2.lineWidth = 1.5 * s;
    ctx2.setLineDash([3 * s, 3 * s]);
    ctx2.beginPath();
    ctx2.moveTo(px + pw * 0.2, py + ph * 0.62);
    ctx2.lineTo(px + pw * 0.8, py + ph * 0.62);
    ctx2.stroke();
    ctx2.setLineDash([]);
  }

  // --- Gown body ---
  ctx2.fillStyle = onGround ? c.gownColor : c.gownAlt;
  ctx2.fillRect(px + pw * 0.18, py + ph * 0.38, pw * 0.64, ph * 0.62);

  // Gown stripe / accent
  ctx2.fillStyle = c.accentColor + '99';
  ctx2.fillRect(px + pw * 0.46, py + ph * 0.38, pw * 0.08, ph * 0.62);

  // --- Diploma when jumping ---
  if (!onGround) {
    ctx2.fillStyle = '#f5f5dc';
    ctx2.fillRect(px + pw * 0.82, py + ph * 0.42, pw * 0.14, ph * 0.28);
    ctx2.fillStyle = '#d4af37';
    ctx2.fillRect(px + pw * 0.83, py + ph * 0.44, pw * 0.12, ph * 0.04);
  }
}

// Draw character previews on the start screen mini-canvases
function drawPreviews() {
  ['treyvon', 'brad', 'taki'].forEach(id => {
    const c = document.getElementById('preview-' + id);
    if (!c) return;
    const cx = c.getContext('2d');
    cx.clearRect(0, 0, c.width, c.height);
    drawCharacter(cx, id, 8, 8, 44, 54, 0, true, c.width / 60);
  });
}

function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 1.5) * 4,
      life: 1,
      decay: Math.random() * 0.04 + 0.02,
      r: Math.random() * 5 + 2,
      color,
    });
  }
}

// ---- Input ----
function doJump() {
  if (state === 'playing') {
    if (player.onGround || player.coyoteTime > 0) {
      player.vy = JUMP_FORCE;
      player.onGround = false;
      player.jumpCount = 1;
      player.coyoteTime = 0;
      spawnParticles(player.x + player.w / 2, player.y + player.h, '#f0c040', 6);
    } else if (player.jumpCount < player.maxJumps) {
      player.vy = JUMP_FORCE * 0.85;
      player.jumpCount++;
      spawnParticles(player.x + player.w / 2, player.y + player.h, '#7b2fff', 8);
    } else {
      player.jumpBuffer = 8;
    }
  } else if (state === 'start') {
    startGame();
  } else if (state === 'dead') {
    restartGame();
  } else if (state === 'win') {
    restartGame();
  }
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    document.getElementById('pause-screen').classList.remove('hidden');
  } else if (state === 'paused') {
    state = 'playing';
    document.getElementById('pause-screen').classList.add('hidden');
  }
}

function goToMenu() {
  state = 'start';
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('pause-btn').classList.add('hidden');
  document.getElementById('game-hud').classList.add('hidden');
  showScreen('diploma-screen');
  drawPreviews();
  playMenuMusic();
}

document.addEventListener('keydown', e => {
  // Don't trigger game actions if user is typing in a form field
  const isTyping = e.target.tagName === 'INPUT' || 
                   e.target.tagName === 'TEXTAREA' || 
                   e.target.tagName === 'SELECT';
  
  if (e.code === 'Space' && !isTyping) { 
    e.preventDefault(); 
    doJump(); 
  }
  if (e.code === 'Escape' || e.code === 'KeyP') { 
    e.preventDefault(); 
    if (state === 'playing' || state === 'paused') togglePause(); 
  }
});

canvas.addEventListener('pointerdown', e => { e.preventDefault(); doJump(); });

// Prevent touch events from triggering jump when interacting with forms
document.addEventListener('touchstart', e => { 
  // Only trigger jump if not touching a form element or overlay content
  const isFormElement = e.target.closest('input, textarea, select, button, .overlay-box');
  if (!isFormElement) {
    e.preventDefault(); 
    doJump(); 
  }
}, { passive: false });

// ---- UI buttons ----
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', restartGame);
document.getElementById('play-again-btn').addEventListener('click', restartGame);
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('menu-btn').addEventListener('click', goToMenu);

// Onboarding flow buttons
document.getElementById('continue-to-application-btn').addEventListener('click', () => {
  showScreen('application-screen');
});

document.getElementById('start-college-btn').addEventListener('click', () => {
  showScreen('start-screen');
});

// College application form
document.getElementById('college-application-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = document.getElementById('app-name').value;
  const major = document.getElementById('app-major').value;
  
  // Fill in acceptance letter with user data
  document.getElementById('accepted-name').textContent = name;
  document.getElementById('accepted-major').textContent = major;
  
  // Show acceptance letter
  showScreen('acceptance-screen');
});

// Character card selection
document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedChar = card.dataset.char;
  });
});

function showScreen(id) {
  ['start-screen','game-over-screen','win-screen','pause-screen','diploma-screen','application-screen','acceptance-screen'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  if (id) document.getElementById(id).classList.remove('hidden');
}

function startGame() {
  showScreen(null);
  document.getElementById('pause-btn').classList.remove('hidden');
  document.getElementById('game-hud').classList.remove('hidden');
  resetGame();
  state = 'playing';
  playGameMusic();
}

function restartGame() {
  showScreen(null);
  document.getElementById('pause-btn').classList.remove('hidden');
  document.getElementById('game-hud').classList.remove('hidden');
  resetGame();
  state = 'playing';
  playGameMusic();
}

function resetGame() {
  player.x = 120; player.y = GROUND_Y - 54;
  player.vy = 0; player.onGround = true;
  player.jumpCount = 0; player.dead = false;
  player.animFrame = 0; player.animTimer = 0;
  player.coyoteTime = 0; player.jumpBuffer = 0;
  obstacles = [];
  particles = [];
  sceneEffects = [];
  bossEffects = [];
  obstacleTimer = 0;
  scheduleNextObstacle();
  score = 0;
  frameCount = 0;
  gameSpeed = GAME_SPEED_INIT;
  currentTheme = 'freshman';
  themeTransition = 0;
  isBossLevel = false;
  initStars();
  initBackgroundElements();
}


// ---- Update ----
function update() {
  if (state !== 'playing') return;
  frameCount++;

  const theme = getCurrentTheme();
  
  // Theme transitions with effects
  if (theme !== currentTheme) {
    createSceneTransition(theme);
    currentTheme = theme;
    initBackgroundElements();
    initStars();
    if (theme === COLLEGE_THEMES.finals) isBossLevel = true;
  }

  // Speed increases each level — easier progression
  // freshman=3.5, sophomore=4.2, junior=4.9, senior=5.6, finals=7
  const speedByLevel = [3.5, 4.2, 4.9, 5.6, 7];
  const levelIndex = score < 100 ? 0 : score < 200 ? 1 : score < 300 ? 2 : score < 400 ? 3 : 4;
  gameSpeed = speedByLevel[levelIndex];

  // Player physics (same as before)
  player.vy += GRAVITY;
  player.y += player.vy;

  if (player.coyoteTime > 0) player.coyoteTime--;
  if (player.jumpBuffer > 0) {
    player.jumpBuffer--;
    if (player.onGround && player.jumpBuffer > 0) {
      doJump();
      player.jumpBuffer = 0;
    }
  }

  const groundLevel = GROUND_Y - player.h;
  if (player.y >= groundLevel) {
    player.y = groundLevel;
    player.vy = 0;
    if (!player.onGround) {
      player.onGround = true;
      player.jumpCount = 0;
      spawnParticles(player.x + player.w / 2, player.y + player.h, '#8a6a3a', 4);
    }
  } else {
    if (player.onGround) {
      player.coyoteTime = 6;
    }
    player.onGround = false;
  }

  player.animTimer++;
  if (player.animTimer > 12) { 
    player.animTimer = 0; 
    player.animFrame = (player.animFrame + 1) % 4; 
  }

  // Update stars with boss effects
  stars.forEach(s => {
    s.x -= s.speed * gameSpeed * 0.2;
    if (s.x < -10) s.x = LW + 10;
    
    if (s.twinkle > 0) {
      s.alpha += Math.sin(frameCount * s.twinkle) * 0.3;
      s.alpha = Math.max(0.1, Math.min(1, s.alpha));
    }
  });

  // Update background elements with rotation for boss level
  backgroundElements.forEach(elem => {
    elem.x -= elem.speed * gameSpeed * 0.6;
    if (elem.x < -50) {
      elem.x = LW + Math.random() * 200;
      elem.element = theme.elements[Math.floor(Math.random() * theme.elements.length)];
    }
    
    if (elem.rotSpeed > 0) {
      elem.rotation += elem.rotSpeed;
    }
  });

  // Obstacle spawning with random spacing
  obstacleTimer++;
  if (obstacleTimer >= nextObstacleIn) {
    spawnObstacle();
    obstacleTimer = 0;
    scheduleNextObstacle();
  }

  // Update obstacles with boss effects
  obstacles.forEach(obs => { 
    obs.x -= gameSpeed; 
    
    if (obs.boss) {
      obs.glowIntensity += Math.sin(frameCount * obs.pulseSpeed) * 0.1;
      obs.glowIntensity = Math.max(0.3, Math.min(1, obs.glowIntensity));
    }
  });
  obstacles = obstacles.filter(obs => obs.x + obs.w > -20);

  // Update scene effects
  sceneEffects.forEach(effect => {
    effect.x += effect.vx;
    effect.y += effect.vy;
    effect.life -= effect.decay;
  });
  sceneEffects = sceneEffects.filter(e => e.life > 0);

  // Update boss effects
  if (isBossLevel) {
    bossEffects.forEach(effect => {
      effect.life -= effect.decay;
      if (effect.type === 'lightning' && Math.random() < 0.1) {
        effect.x = Math.random() * LW;
        effect.life = 1;
      }
    });
    bossEffects = bossEffects.filter(e => e.life > 0);
    
    // Spawn new boss effects
    if (Math.random() < 0.05) {
      bossEffects.push({
        type: 'lightning',
        x: Math.random() * LW,
        y: 0,
        life: 1,
        decay: 0.05,
        width: Math.random() * 5 + 2
      });
    }
  }

  // Collision detection (even more forgiving hitbox for easier gameplay)
  const px = player.x + 10, py = player.y + 8;
  const pw = player.w - 20, ph = player.h - 12;

  for (const obs of obstacles) {
    if (obs.isGap) {
      // Gap collision - check if player falls into gap
      if (px + pw > obs.x && px < obs.x + obs.w && player.y >= GROUND_Y - player.h) {
        killPlayer();
        return;
      }
    } else {
      // Normal obstacle collision
      if (px < obs.x + obs.w && px + pw > obs.x &&
          py < obs.y + obs.h && py + ph > obs.y) {
        killPlayer();
        return;
      }
    }
  }

  // Particles
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay;
  });
  particles = particles.filter(p => p.life > 0);

  // Score
  score += gameSpeed * 0.04;
  
  // Update HUD
  document.getElementById('hud-score-value').textContent = Math.floor(score) + 'm';

  // Win condition
  if (score >= WIN_DISTANCE) {
    state = 'win';
    if (score > bestScore) bestScore = score;
    document.getElementById('win-score').textContent = Math.floor(score);
    showScreen('win-screen');
    stopMusic();
    setTimeout(() => playMenuMusic(), 500);
    spawnParticles(LW / 2, LH / 2, '#f0c040', 40);
    spawnParticles(LW / 2, LH / 2, '#7b2fff', 40);
  }
}

function killPlayer() {
  state = 'dead';
  if (score > bestScore) bestScore = score;
  document.getElementById('game-hud').classList.add('hidden');
  stopMusic();
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4466', 20);
  document.getElementById('final-score').textContent = Math.floor(score);
  
  // Set character name on exam
  const charNames = {
    'treyvon': 'Treyvon "The Grad"',
    'brad': 'Brad',
    'taki': 'Taki'
  };
  document.getElementById('exam-name').textContent = charNames[selectedChar] || 'Student';
  
  // Hilarious fail messages based on how far you got
  const msgs = [
    "You tripped over your own shoelaces! 👟",
    "Did you even study for this?! 📚❌",
    "Your GPA just dropped to 0.0! 💀",
    "Professor said 'See me after class' 😬",
    "You're gonna need summer school! ☀️📖",
    "Mom's gonna be SO disappointed... 😭",
    "That's not how you jump, chief! 🤦",
    "Better luck next semester! 📅",
    "You got EXPELLED! 🚪➡️",
    "Academic probation incoming! ⚠️",
    "The dean wants a word with you... 👔",
    "You failed harder than my WiFi! 📡❌",
    "Even the janitor passed this! 🧹",
    "Your scholarship just got revoked! 💸",
    "Time to change your major to 'Failure Studies'! 📊"
  ];
  
  document.getElementById('fail-message').textContent = msgs[Math.floor(Math.random() * msgs.length)];
  setTimeout(() => showScreen('game-over-screen'), 600);
}


// ---- Drawing ----
function drawBackground() {
  const theme = getCurrentTheme();
  
  const grad = ctx.createLinearGradient(0, 0, 0, LH);
  if (isBossLevel) {
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.3, '#1a0a1a');
    grad.addColorStop(0.7, theme.bg);
    grad.addColorStop(1, '#2a1a2a');
  } else {
    grad.addColorStop(0, theme.bg);
    grad.addColorStop(0.6, theme.bg + '88');
    grad.addColorStop(1, theme.ground);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LW, LH);

  if (isBossLevel) {
    bossEffects.forEach(effect => {
      if (effect.type === 'lightning') {
        ctx.globalAlpha = effect.life * 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = effect.width;
        ctx.beginPath();
        ctx.moveTo(effect.x, 0);
        ctx.lineTo(effect.x + Math.sin(frameCount * 0.1) * 20, LH);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }

  stars.forEach(s => {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = isBossLevel ? '#ff88ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  backgroundElements.forEach(elem => {
    ctx.globalAlpha = elem.alpha;
    ctx.font = `${24 * elem.scale}px serif`;
    ctx.textAlign = 'center';
    if (elem.rotation > 0) {
      ctx.save();
      ctx.translate(elem.x, elem.y);
      ctx.rotate(elem.rotation);
      ctx.fillText(elem.element, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(elem.element, elem.x, elem.y);
    }
  });
  ctx.globalAlpha = 1;

  sceneEffects.forEach(effect => {
    if (effect.type === 'transition') {
      ctx.globalAlpha = effect.life;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;

  const groundY = GROUND_Y;
  const groundH = LH - GROUND_Y;

  if (isBossLevel) {
    const glowGrad = ctx.createLinearGradient(0, groundY, 0, groundY + groundH);
    glowGrad.addColorStop(0, theme.ground + 'ff');
    glowGrad.addColorStop(0.3, '#4a0a4a');
    glowGrad.addColorStop(1, '#2a0a2a');
    ctx.fillStyle = glowGrad;
  } else {
    ctx.fillStyle = theme.ground;
  }
  ctx.fillRect(0, groundY, LW, groundH);

  ctx.fillStyle = isBossLevel ? '#8a4a8a' : theme.ground + 'aa';
  ctx.fillRect(0, groundY, LW, 8);

  ctx.lineWidth = isBossLevel ? 3 : 2;
  if (isBossLevel) {
    for (let x = 0; x < LW; x += 80) {
      ctx.strokeStyle = `hsl(${(frameCount + x) % 360}, 70%, 50%)`;
      ctx.beginPath();
      ctx.arc(x, groundY + 20, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = theme.ground + '66';
    for (let x = 0; x < LW; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, groundY + groundH);
      ctx.stroke();
    }
  }

  ctx.fillStyle = isBossLevel ? '#ff4444' : '#ffffff88';
  ctx.font = `${isBossLevel ? 20 : 16}px ${isBossLevel ? 'serif' : 'sans-serif'}`;
  ctx.textAlign = 'right';
  if (isBossLevel) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
  }
  ctx.fillText(theme.name, LW - 20, 30);
  ctx.shadowBlur = 0;
}

function drawPlayer() {
  drawCharacter(ctx, selectedChar, player.x, player.y, player.w, player.h, player.animFrame, player.onGround, 1);
}

function drawObstacles() {
  obstacles.forEach(obs => {
    const ox = obs.x;
    const oy = obs.y;
    const ow = obs.w;
    const oh = obs.h;

    if (obs.boss) {
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = obs.glowIntensity * 20;
    }

    if (obs.isGap) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox, oy, ow, LH - oy);
      if (obs.boss) {
        ctx.fillStyle = '#4b0082';
        for (let i = 0; i < 5; i++) {
          const swirl = Math.sin(frameCount * 0.05 + i) * 10;
          ctx.fillRect(ox + swirl, oy + i * 15, ow - swirl * 2, 10);
        }
      }
    } else {
      switch (obs.type) {
        case 'spike':
        case 'dragon_spike':
          ctx.fillStyle = obs.color;
          ctx.beginPath();
          ctx.moveTo(ox + ow / 2, oy);
          ctx.lineTo(ox, oy + oh);
          ctx.lineTo(ox + ow, oy + oh);
          ctx.closePath();
          ctx.fill();
          if (obs.boss) {
            ctx.fillStyle = '#ff4444';
            for (let i = 0; i < 3; i++) {
              ctx.fillRect(ox + ow * 0.2 + i * ow * 0.2, oy + oh * 0.7, ow * 0.1, oh * 0.1);
            }
          }
          break;

        case 'low_block':
        case 'medium_block':
        case 'tall_block':
          ctx.fillStyle = obs.color;
          ctx.fillRect(ox, oy, ow, oh);
          ctx.fillStyle = obs.color + '66';
          ctx.fillRect(ox, oy, ow, oh * 0.2);
          ctx.strokeStyle = obs.color + 'aa';
          ctx.lineWidth = 2;
          ctx.strokeRect(ox, oy, ow, oh);
          break;

        case 'double_spike':
          ctx.fillStyle = obs.color;
          ctx.beginPath();
          ctx.moveTo(ox + ow * 0.25, oy);
          ctx.lineTo(ox, oy + oh);
          ctx.lineTo(ox + ow * 0.5, oy + oh);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(ox + ow * 0.75, oy);
          ctx.lineTo(ox + ow * 0.5, oy + oh);
          ctx.lineTo(ox + ow, oy + oh);
          ctx.closePath();
          ctx.fill();
          break;

        case 'magic_barrier':
          ctx.fillStyle = obs.color;
          ctx.fillRect(ox, oy, ow, oh);
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 8; i++) {
            const sparkleX = ox + (i % 4) * ow * 0.25 + Math.sin(frameCount * 0.1 + i) * 5;
            const sparkleY = oy + Math.floor(i / 4) * oh * 0.5 + Math.cos(frameCount * 0.1 + i) * 5;
            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'boss_attack':
          ctx.fillStyle = obs.color;
          ctx.fillRect(ox, oy, ow, oh);
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 3;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(ox, oy + i * oh * 0.33);
            ctx.lineTo(ox + ow, oy + i * oh * 0.33);
            ctx.stroke();
          }
          break;
      }
    }
    ctx.shadowBlur = 0;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawUI() {
  const theme = getCurrentTheme();
  
  ctx.fillStyle = isBossLevel ? '#ff4444' : '#f0c040';
  ctx.font = `bold ${isBossLevel ? 28 : 24}px ${isBossLevel ? 'serif' : 'sans-serif'}`;
  ctx.textAlign = 'left';
  if (isBossLevel) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
  }
  ctx.fillText(`${Math.floor(score)}m`, 20, 40);
  ctx.shadowBlur = 0;

  ctx.fillStyle = isBossLevel ? '#ffaa44' : '#ffffff';
  ctx.font = `${isBossLevel ? 20 : 18}px ${isBossLevel ? 'serif' : 'sans-serif'}`;
  ctx.fillText(`📍 ${theme.name}`, 20, 70);

  const progress = Math.min(score / WIN_DISTANCE, 1);
  const barW = 200;
  const barH = 10;
  const barX = 20;
  const barY = 90;

  ctx.fillStyle = isBossLevel ? '#440044' : '#333366';
  ctx.fillRect(barX, barY, barW, barH);

  if (isBossLevel) {
    const grad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.5, '#ff4444');
    grad.addColorStop(1, '#ffaa44');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = '#f0c040';
  }
  ctx.fillRect(barX, barY, barW * progress, barH);

  ctx.fillStyle = isBossLevel ? '#ffaa44' : '#ffffff';
  ctx.font = `14px ${isBossLevel ? 'serif' : 'sans-serif'}`;
  ctx.fillText('🎓 Graduation Progress', barX, barY - 8);

  const milestones = [
    { score: 100, name: 'Sophomore Year', emoji: '📚' },
    { score: 200, name: 'Junior Year', emoji: '💼' },
    { score: 300, name: 'Senior Year', emoji: '🎓' },
    { score: 400, name: 'GRADUATION FINALS', emoji: '🐉' }
  ];
  
  const nextMilestone = milestones.find(m => score < m.score);
  if (nextMilestone) {
    ctx.fillStyle = isBossLevel ? '#ccaacc' : '#cccccc';
    ctx.font = `12px ${isBossLevel ? 'serif' : 'sans-serif'}`;
    ctx.fillText(`Next: ${nextMilestone.emoji} ${nextMilestone.name} (${nextMilestone.score}m)`, 20, 120);
  }

  if (isBossLevel) {
    ctx.fillStyle = '#ff0000';
    ctx.font = `16px serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 5;
    const warningAlpha = Math.sin(frameCount * 0.1) * 0.3 + 0.7;
    ctx.globalAlpha = warningAlpha;
    ctx.fillText('⚠️ FINAL BOSS LEVEL ⚠️', LW / 2, 150);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }
}


// ---- Main game loop ----
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (state === 'playing') {
    update();
  }

  // Draw everything in logical space — SCALE handles DPR + display sizing
  ctx.save();
  ctx.scale(SCALE, SCALE);

  drawBackground();
  drawObstacles();
  drawPlayer();
  drawParticles();
  
  if (state === 'playing' || state === 'paused') {
    drawUI();
  }

  if (state === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, LW, LH);
  }

  ctx.restore();
  
  requestAnimationFrame(gameLoop);
}

// ---- Initialize ----
function init() {
  const saved = localStorage.getItem('gradDashBest');
  if (saved) bestScore = parseFloat(saved);

  const defaultCard = document.querySelector('.char-card[data-char="treyvon"]');
  if (defaultCard) defaultCard.classList.add('selected');

  drawPreviews();
  gameLoop();
}

// Save best score
function saveBestScore() {
  localStorage.setItem('gradDashBest', bestScore.toString());
}

let lastSavedBest = bestScore;
setInterval(() => {
  if (bestScore > lastSavedBest) {
    saveBestScore();
    lastSavedBest = bestScore;
  }
}, 1000);

// ============================================================
//  AUDIO ENGINE
// ============================================================

let audioCtx = null;
let currentMusic = null; // 'menu' | 'game' | null
let musicNodes = [];     // all active oscillators/intervals to stop

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function stopMusic() {
  musicNodes.forEach(n => {
    try {
      if (n.stop) n.stop();
      if (n.disconnect) n.disconnect();
      if (typeof n === 'number') clearInterval(n);
    } catch(e) {}
  });
  musicNodes = [];
  currentMusic = null;
}

// ---- Graduation / Menu Music ----
// Pomp and Circumstance-inspired: slow, majestic, ceremonial
function playMenuMusic() {
  if (currentMusic === 'menu') return;
  stopMusic();
  currentMusic = 'menu';
  const ac = getAudioCtx();

  const master = ac.createGain();
  master.gain.setValueAtTime(0.15, ac.currentTime);
  master.connect(ac.destination);
  musicNodes.push(master);

  const delay = ac.createDelay(0.5);
  delay.delayTime.value = 0.4;
  const feedback = ac.createGain();
  feedback.gain.value = 0.25;
  const delayGain = ac.createGain();
  delayGain.gain.value = 0.2;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(master);
  musicNodes.push(delay, feedback, delayGain);

  const N = {
    G3:196.0, C4:261.6, D4:293.7, E4:329.6, F4:349.2, G4:392.0,
    A4:440.0, B4:493.9, C5:523.3, D5:587.3, E5:659.3, G5:784.0,
    A5:880.0, REST:0
  };

  // Full Pomp & Circumstance A section + B section for variety
  const melodyA = [
    [N.G4,0.4],[N.G4,0.4],[N.G4,0.4],[N.C5,1.2],
    [N.E5,0.4],[N.D5,0.4],[N.C5,0.4],[N.E5,1.2],
    [N.D5,0.4],[N.C5,0.4],[N.D5,0.4],[N.G4,1.2],
    [N.REST,0.4],[N.G4,0.4],[N.G4,0.4],[N.C5,1.2],
    [N.E5,0.4],[N.D5,0.4],[N.C5,0.4],[N.G5,1.6],
    [N.E5,0.4],[N.D5,0.4],[N.C5,0.4],[N.E5,1.2],
    [N.D5,0.4],[N.C5,0.4],[N.B4,0.4],[N.C5,1.6],
  ];

  // B section — higher, more triumphant
  const melodyB = [
    [N.E5,0.4],[N.E5,0.4],[N.E5,0.4],[N.A5,1.2],
    [N.G5,0.4],[N.E5,0.4],[N.D5,0.4],[N.E5,1.2],
    [N.G5,0.4],[N.E5,0.4],[N.D5,0.4],[N.C5,1.6],
    [N.REST,0.4],[N.E5,0.4],[N.E5,0.4],[N.A5,1.2],
    [N.G5,0.4],[N.E5,0.4],[N.D5,0.4],[N.G5,1.6],
    [N.E5,0.4],[N.D5,0.4],[N.C5,0.4],[N.D5,1.2],
    [N.C5,0.4],[N.B4,0.4],[N.A4,0.4],[N.G4,1.6],
  ];

  // Alternate A and B sections so it never feels like a short loop
  const sections = [melodyA, melodyB, melodyA, melodyB];
  let sectionIndex = 0;

  function playSection(startTime) {
    if (currentMusic !== 'menu') return;
    const section = sections[sectionIndex % sections.length];
    sectionIndex++;

    const osc = ac.createOscillator();
    const oscGain = ac.createGain();
    osc.type = 'triangle';
    osc.connect(oscGain);
    oscGain.connect(master);
    oscGain.connect(delay);
    oscGain.gain.setValueAtTime(0, startTime);
    osc.start(startTime);
    musicNodes.push(osc, oscGain);

    let t = startTime;
    let totalDur = 0;
    section.forEach(([freq, dur]) => {
      if (freq === 0) {
        oscGain.gain.setValueAtTime(0, t);
      } else {
        osc.frequency.setValueAtTime(freq, t);
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(0.65, t + 0.03);
        oscGain.gain.setValueAtTime(0.65, t + dur * 0.75);
        oscGain.gain.linearRampToValueAtTime(0, t + dur * 0.95);
      }
      t += dur;
      totalDur += dur;
    });
    osc.stop(t + 0.1);

    // Small pause between sections for breathing room
    const pauseMs = (totalDur + 0.6) * 1000;
    const id = setTimeout(() => playSection(ac.currentTime), pauseMs);
    musicNodes.push({ stop: () => clearTimeout(id), disconnect: () => {} });
  }

  // Bass — changes note per section
  const bassPatterns = [
    [N.C4, N.G3, N.C4, N.G3],
    [N.A4, N.E4, N.A4, N.E4],
  ];
  let bassSection = 0;

  function playBass(startTime) {
    if (currentMusic !== 'menu') return;
    const pattern = bassPatterns[bassSection % bassPatterns.length];
    bassSection++;
    let t = startTime;
    let totalDur = 0;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.connect(g); g.connect(master);
    osc.start(t);
    musicNodes.push(osc, g);

    for (let rep = 0; rep < 7; rep++) {
      pattern.forEach(freq => {
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.45, t);
        g.gain.linearRampToValueAtTime(0, t + 0.35);
        t += 0.4;
        totalDur += 0.4;
      });
    }
    osc.stop(t);
    const id = setTimeout(() => playBass(ac.currentTime), (totalDur + 0.6) * 1000);
    musicNodes.push({ stop: () => clearTimeout(id), disconnect: () => {} });
  }

  playSection(ac.currentTime + 0.1);
  playBass(ac.currentTime + 0.1);
}

// ---- EDM Game Music ----
function playGameMusic() {
  if (currentMusic === 'game') return;
  stopMusic();
  currentMusic = 'game';
  const ac = getAudioCtx();

  const master = ac.createGain();
  master.gain.setValueAtTime(0.2, ac.currentTime);
  master.connect(ac.destination);
  musicNodes.push(master);

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  comp.connect(master);
  musicNodes.push(comp);

  const BPM = 128;
  const beat = 60 / BPM;

  function kick(time) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, time);
    o.frequency.exponentialRampToValueAtTime(40, time + 0.08);
    g.gain.setValueAtTime(1.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    o.connect(g); g.connect(comp);
    o.start(time); o.stop(time + 0.3);
  }

  function hihat(time, vol = 0.12) {
    const buf = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 9000;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    src.connect(f); f.connect(g); g.connect(comp);
    src.start(time); src.stop(time + 0.05);
  }

  function snare(time) {
    const buf = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.45, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    src.connect(f); f.connect(g); g.connect(comp);
    src.start(time); src.stop(time + 0.15);
  }

  function bass(time, freq, dur) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, time);
    f.frequency.linearRampToValueAtTime(150, time + dur);
    g.gain.setValueAtTime(0.45, time);
    g.gain.linearRampToValueAtTime(0, time + dur);
    o.connect(f); f.connect(g); g.connect(comp);
    o.start(time); o.stop(time + dur + 0.05);
  }

  function lead(time, freq, dur, vol = 0.25) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.value = freq; o2.frequency.value = freq * 1.006;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.02);
    g.gain.setValueAtTime(vol, time + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, time + dur);
    o.connect(g); o2.connect(g); g.connect(comp);
    o.start(time); o2.start(time);
    o.stop(time + dur + 0.05); o2.stop(time + dur + 0.05);
  }

  // 4 distinct chord progressions that rotate every 2 bars
  const progressions = [
    // Am - F - C - G (classic)
    [{b:55.0, l:[220.0,261.6,329.6]},{b:43.65,l:[174.6,220.0,261.6]},{b:65.41,l:[261.6,329.6,392.0]},{b:49.0,l:[196.0,246.9,293.7]}],
    // Dm - Bb - F - C (darker)
    [{b:36.7, l:[146.8,174.6,220.0]},{b:58.27,l:[233.1,293.7,349.2]},{b:43.65,l:[174.6,220.0,261.6]},{b:65.41,l:[261.6,329.6,392.0]}],
    // Em - C - G - D (energetic)
    [{b:41.2, l:[164.8,196.0,246.9]},{b:65.41,l:[261.6,329.6,392.0]},{b:49.0, l:[196.0,246.9,293.7]},{b:36.7, l:[146.8,174.6,220.0]}],
    // Am - G - F - E (descending)
    [{b:55.0, l:[220.0,261.6,329.6]},{b:49.0, l:[196.0,246.9,293.7]},{b:43.65,l:[174.6,220.0,261.6]},{b:41.2, l:[164.8,196.0,246.9]}],
  ];

  let loopCount = 0;

  function scheduleLoop(startTime) {
    if (currentMusic !== 'game') return;

    // Switch progression every 2 loops for variety
    const prog = progressions[Math.floor(loopCount / 2) % progressions.length];
    const isFillBar = (loopCount % 4 === 3); // every 4th loop add a fill
    loopCount++;

    let t = startTime;

    for (let b = 0; b < 4; b++) {
      const bt = t + b * beat * 4;
      const chord = prog[b];

      // Kick pattern — vary slightly on fill bar
      kick(bt);
      kick(bt + beat * 2);
      if (isFillBar) {
        kick(bt + beat * 3);
        kick(bt + beat * 3.5);
      }

      // Snare: 2 and 4
      snare(bt + beat);
      snare(bt + beat * 3);

      // Hi-hats: 8th notes, open on offbeats
      for (let h = 0; h < 8; h++) {
        hihat(bt + h * beat * 0.5, h % 2 === 0 ? 0.14 : 0.08);
      }
      // 16th note hi-hat run on fill bar
      if (isFillBar && b === 3) {
        for (let h = 0; h < 16; h++) hihat(bt + h * beat * 0.25, 0.06);
      }

      // Bass
      bass(bt, chord.b, beat * 4 - 0.05);

      // Lead — arpeggiate differently each bar
      if (b % 2 === 0) {
        chord.l.forEach((freq, i) => lead(bt + i * beat, freq, beat * 0.8));
        chord.l.forEach((freq, i) => lead(bt + beat * 2 + i * (beat/3), freq * 2, (beat/3) * 0.75, 0.18));
      } else {
        // Reverse arpeggio on odd bars
        [...chord.l].reverse().forEach((freq, i) => lead(bt + i * beat, freq, beat * 0.8));
        chord.l.forEach((freq, i) => lead(bt + beat * 2.5 + i * (beat/4), freq * 2, (beat/4) * 0.75, 0.15));
      }
    }

    const loopDur = beat * 16 * 1000 - 30;
    const id = setTimeout(() => scheduleLoop(ac.currentTime), loopDur);
    musicNodes.push({ stop: () => clearTimeout(id), disconnect: () => {} });
  }

  scheduleLoop(ac.currentTime + 0.05);
}

// ---- Audio Unlock (iOS Safari requires a direct button tap) ----
let audioStarted = false;
let isMuted = false;

function unlockAudio() {
  if (audioStarted) return;
  audioStarted = true;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
    const go = () => playMenuMusic();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(go);
    } else {
      go();
    }
  } catch(e) {
    console.warn('Audio init failed:', e);
  }
}

// Unlock audio on the very first button tap (works on iOS)
document.getElementById('continue-to-application-btn').addEventListener('touchend', unlockAudio);
document.getElementById('continue-to-application-btn').addEventListener('click', unlockAudio);

// Desktop fallback
document.addEventListener('pointerdown', function onFirstClick() {
  if (!audioStarted) unlockAudio();
  document.removeEventListener('pointerdown', onFirstClick, true);
}, true);

// Resume if iOS suspends audio when switching apps
document.addEventListener('visibilitychange', () => {
  if (!isMuted && audioCtx && document.visibilityState === 'visible') {
    audioCtx.resume();
  }
});

// Mute button
document.getElementById('mute-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  isMuted = !isMuted;
  const btn = document.getElementById('mute-btn');
  if (isMuted) {
    if (audioCtx) audioCtx.suspend();
    btn.textContent = '🔇';
  } else {
    if (audioCtx) audioCtx.resume();
    btn.textContent = '🔊';
  }
});

// Start the game
init();

