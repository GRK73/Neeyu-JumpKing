import { CELL }                                    from './constants.js';
import { GameEngine }                               from './engine.js';
import { Renderer }                                 from './renderer.js';
import { PLATFORMS_DEF, FANS_DEF, TRAPS_DEF,
         scalePlatforms, scaleFans, scaleTraps }    from './map_data.js';

// ── Canvas ───────────────────────────────────────────────────────────────────
const canvas  = document.getElementById('gameCanvas');
const loading = document.getElementById('loading');

const CANVAS_W = window.innerWidth;
const CANVAS_H = window.innerHeight;
canvas.width   = CANVAS_W;
canvas.height  = CANVAS_H;

// ── 맵 크기 / 스케일 ──────────────────────────────────────────────────────────
const MAP_SCALE       = CANVAS_W / 960;
const MAP_H           = Math.round(CANVAS_H * 13 / CELL) * CELL;
const SAVE_PLATFORM_Y = 2695; // 세이브포인트 y 기준 (원본 960px 좌표)

// ── 플랫폼 · 선풍기 · 함정 스케일 적용 ──────────────────────────────────────
const platforms = scalePlatforms(PLATFORMS_DEF, MAP_SCALE);
const fans      = scaleFans(FANS_DEF, MAP_SCALE);
const traps     = scaleTraps(TRAPS_DEF, MAP_SCALE);

// ── 게임 엔진 / 렌더러 생성 ──────────────────────────────────────────────────
const engine = new GameEngine({
    canvasW: CANVAS_W, canvasH: CANVAS_H,
    platforms, fans, traps,
    mapH: MAP_H,
    savePlatformY: SAVE_PLATFORM_Y,
});

const renderer = new Renderer({
    canvas,
    engine,
    spritesBasePath: 'assets/sprites/',
    mode: 'game',
});

// 초기 스폰 위치 설정
engine.spawn(
    CANVAS_W / 2 - engine.HITBOX_W / 2,
    platforms[0].y - engine.HITBOX_H,
);

// ── 입력 ─────────────────────────────────────────────────────────────────────
const keys = {};

window.addEventListener('keydown', e => {
    if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyH') { engine.debugHitbox = !engine.debugHitbox; return; }
    if (keys[e.code]) return;
    keys[e.code] = true;
    engine.onKeydown(e.code);
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
    engine.onKeyup(e.code, keys);
});

// ── 게임 루프 ─────────────────────────────────────────────────────────────────
let lastTime = 0;

function loop(ts) {
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;
    engine.tick(dt, keys);
    renderer.render();
    requestAnimationFrame(loop);
}

// ── 에셋 로딩 ─────────────────────────────────────────────────────────────────
async function loadAll() {
    await renderer.loadSprites();
    await renderer.preWarm();
    loading.classList.add('hidden');
    requestAnimationFrame(ts => { lastTime = ts; loop(ts); });
}

loadAll();
