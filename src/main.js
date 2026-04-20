import { CELL, CHAR_SCALE, SPRITE_INFO } from './constants.js';
import { GameEngine }                from './engine.js';
import { Renderer }                  from './renderer.js';
import { THEME_ORDER }               from './stage_themes.js';
import { buildGameDataFromCells, loadMapJson } from './map_loader.js';

// ── Canvas ───────────────────────────────────────────────────────────────────
const canvas   = document.getElementById('gameCanvas');
const loading  = document.getElementById('loading');
const menuEl   = document.getElementById('mainMenu');
const endEl    = document.getElementById('endText');
const playMsgEl = document.getElementById('playMsg');
const pauseEl   = document.getElementById('pauseMenu');
const songPickerEl = document.getElementById('songPicker');
const songTitleEl  = document.getElementById('songTitle');
const bgmEl        = document.getElementById('bgm');
const timerEl      = document.getElementById('gameTimer');
const endTimeEl    = document.getElementById('endTime');
const endSubmitBox = document.getElementById('endSubmitBox');
const endNicknameEl = document.getElementById('endNickname');
const endNoticeEl  = document.getElementById('endNotice');
const rankingListEl = document.getElementById('rankingList');

const MAIN_MAP_KEY = '__NEEYU_MAIN_2f91a__';

const SONG_FILES = [
    'Beyond_The_Starting_Gate.mp3',
    'Last_Life_Standing.mp3',
    'Midnight_at_the_Gates.mp3',
    'One_Heart_Left.mp3',
];
const SONGS = [
    { title: 'No Song', file: null },
    ...SONG_FILES.map(f => ({ title: f.replace(/\.mp3$/, '').replace(/_/g, ' '), file: 'assets/audio/' + f })),
];
let songIdx = 0;

function applySong() {
    const s = SONGS[songIdx];
    songTitleEl.textContent = s.title;
    if (!s.file) {
        bgmEl.pause();
        bgmEl.removeAttribute('src');
        bgmEl.load();
        return;
    }
    const target = new URL(s.file, window.location.href).href;
    if (bgmEl.src !== target) {
        bgmEl.src = s.file;
    }
    const p = bgmEl.play();
    if (p && p.catch) p.catch(() => {});
}
function cycleSong(delta) {
    songIdx = (songIdx + delta + SONGS.length) % SONGS.length;
    applySong();
}

let CANVAS_W = window.innerWidth;
let CANVAS_H = window.innerHeight;
function resizeCanvas() {
    CANVAS_W = window.innerWidth;
    CANVAS_H = window.innerHeight;
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
}
resizeCanvas();
window.addEventListener('resize', () => {
    if (!engine) resizeCanvas();
});
window.addEventListener('orientationchange', () => {
    if (!engine) resizeCanvas();
});

// ── 상태 ─────────────────────────────────────────────────────────────────────
let engine = null;
let renderer = null;
let keys = {};
let rafId = null;
let lastTime = 0;
let msgTimer = 0;

let ending = null;   // { t0, phase, startCamY }
let paused = false;

// ── 타이머/랭킹 상태 ────────────────────────────────────────────────────────
let runStartTs = 0;
let pausedAccumMs = 0;
let pauseStartTs = 0;
let finalTimeMs = 0;
let currentMapKey = null;   // 랭킹 등록 가능한 맵은 문자열, 불가면 null
let currentMapName = '';

function formatTimeMs(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    const total = Math.floor(ms);
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const d = Math.floor((total % 1000) / 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
}
function currentElapsedMs() {
    if (!runStartTs) return 0;
    const now = paused && pauseStartTs ? pauseStartTs : performance.now();
    return now - runStartTs - pausedAccumMs;
}

// ── 메시지 헬퍼 ──────────────────────────────────────────────────────────────
function showPlayMsg(txt, ms = 0) {
    playMsgEl.textContent = txt;
    if (msgTimer) { clearTimeout(msgTimer); msgTimer = 0; }
    if (ms > 0) msgTimer = setTimeout(() => { playMsgEl.textContent = ''; msgTimer = 0; }, ms);
}

// ── 게임 시작 (맵 데이터 주입) ───────────────────────────────────────────────
async function startGame(mapJson, opts = {}) {
    stopMenuScene();
    resizeCanvas();
    currentMapKey = opts.mapKey ?? null;
    currentMapName = opts.mapName ?? '';
    const cellsArr = Array.isArray(mapJson.cells) ? mapJson.cells : [];
    const rows = mapJson.rows || 594;
    const mapH = rows * CELL;

    const { platforms, fans, traps, signs } = buildGameDataFromCells(cellsArr, CELL);

    let stages = mapJson.stages && mapJson.stages.length > 0
        ? mapJson.stages.map(s => ({ ...s }))
        : null;
    if (stages) {
        const reversedThemes = [...THEME_ORDER].reverse();
        stages.forEach((s, i) => { if (!s.theme) s.theme = reversedThemes[i % reversedThemes.length]; });
    }

    engine = new GameEngine({
        canvasW: CANVAS_W, canvasH: CANVAS_H,
        platforms, fans, traps, signs,
        mapH, stages,
    });

    renderer = new Renderer({
        canvas,
        engine,
        spritesBasePath: 'assets/sprites/',
        mode: 'game',
    });

    let spawnPx, spawnPy;
    if (mapJson.startPoint) {
        spawnPx = mapJson.startPoint.c * CELL;
        spawnPy = mapJson.startPoint.r * CELL - engine.HITBOX_H;
    } else {
        const ground = platforms.reduce((a, b) => (b.y > (a?.y ?? -Infinity) ? b : a), null);
        spawnPx = CANVAS_W / 2 - engine.HITBOX_W / 2;
        spawnPy = (ground ? ground.y : mapH - CELL * 2) - engine.HITBOX_H;
    }
    engine.spawn(spawnPx, spawnPy);

    menuEl.classList.add('hidden');
    endEl.classList.remove('show');
    pauseEl.classList.add('hidden');
    paused = false;
    ending = null;
    keys = {};

    runStartTs = 0;
    pausedAccumMs = 0;
    pauseStartTs = 0;
    finalTimeMs = 0;
    timerEl.textContent = '00:00.0';
    timerEl.classList.remove('hidden');
    rankingListEl.classList.add('hidden');
    rankingListEl.innerHTML = '';
    endNoticeEl.textContent = '';
    endNoticeEl.classList.remove('err', 'ok');
    endNicknameEl.value = '';
    if (currentMapKey) {
        endSubmitBox.classList.remove('hidden');
    } else {
        endSubmitBox.classList.add('hidden');
    }

    // pick a random song (including No Song? task says 아무 노래나 = any song → actual song)
    songIdx = 1 + Math.floor(Math.random() * (SONGS.length - 1));
    songPickerEl.classList.remove('hidden');
    applySong();

    loading.classList.remove('hidden');
    await renderer.loadSprites();
    await renderer.preWarm();
    loading.classList.add('hidden');

    runStartTs = performance.now();
    showMobileUI();

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(ts => { lastTime = ts; loop(ts); });
}

// ── 입력 ─────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    if (!engine) return;
    if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') {
        if (!ending) togglePause();
        return;
    }
    if (paused) return;
    if (e.code === 'KeyH') { engine.debugHitbox = !engine.debugHitbox; return; }
    if (keys[e.code]) return;
    keys[e.code] = true;
    engine.onKeydown(e.code);
});
window.addEventListener('keyup', e => {
    if (!engine) return;
    if (paused) { keys[e.code] = false; return; }
    keys[e.code] = false;
    engine.onKeyup(e.code, keys);
});

function togglePause() {
    paused = !paused;
    if (paused) {
        keys = {};
        document.querySelectorAll('.padBtn.pressed, #padJump.pressed').forEach(el => el.classList.remove('pressed'));
        pauseStartTs = performance.now();
        pauseEl.classList.remove('hidden');
        hideMobileUI();
    } else {
        showMobileUI();
        if (pauseStartTs) {
            pausedAccumMs += performance.now() - pauseStartTs;
            pauseStartTs = 0;
        }
        pauseEl.classList.add('hidden');
        lastTime = performance.now();
    }
}

function quitToMenu() {
    paused = false;
    pauseEl.classList.add('hidden');
    hideMobileUI();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    engine = null;
    renderer = null;
    ending = null;
    keys = {};
    endEl.classList.remove('show');
    showPlayMsg('');
    menuEl.classList.remove('hidden');
    songPickerEl.classList.add('hidden');
    timerEl.classList.add('hidden');
    rankingListEl.classList.add('hidden');
    rankingListEl.innerHTML = '';
    currentMapKey = null;
    currentMapName = '';
    bgmEl.pause();
    startMenuScene();
}

document.getElementById('songPrev').addEventListener('click', () => cycleSong(-1));
document.getElementById('songNext').addEventListener('click', () => cycleSong(1));

// ── 엔딩 시퀀스 ──────────────────────────────────────────────────────────────
function beginEnding() {
    finalTimeMs = currentElapsedMs();
    timerEl.classList.add('hidden');
    hideMobileUI();
    ending = { phase: 3 };
    keys = {};
    engine.vx = 0; engine.vy = 0;
    engine.state = 'stand';
    showPlayMsg('');
    showResult();
}

function showResult() {
    endTimeEl.textContent = formatTimeMs(finalTimeMs);
    endNoticeEl.textContent = '';
    endNoticeEl.classList.remove('err', 'ok');
    endNicknameEl.value = '';
    rankingListEl.classList.add('hidden');
    rankingListEl.innerHTML = '';
    if (currentMapKey) endSubmitBox.classList.remove('hidden');
    else endSubmitBox.classList.add('hidden');
    endEl.classList.add('show');
}

function tickEnding() {
    const t = performance.now() - ending.t0;
    const riseSpeed = 3.5; // px per frame

    if (ending.phase === 1) {
        // 3초간 카메라와 캐릭터가 함께 상승
        engine.py -= riseSpeed;
        engine.cameraY -= riseSpeed;
        if (t >= 3000) ending.phase = 2;
    } else {
        // 카메라 고정, 캐릭터만 상승 → 화면 위로 빠져나가면 결과창
        engine.py -= riseSpeed;
        if (engine.py + engine.HITBOX_H < engine.cameraY - 20 && ending.phase === 2) {
            ending.phase = 3;
            setTimeout(() => showResult(), 600);
        }
    }
}

// ── 게임 루프 ─────────────────────────────────────────────────────────────────
function loop(ts) {
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;

    if (paused) {
        renderer.render();
        rafId = requestAnimationFrame(loop);
        return;
    }

    if (ending) {
        // 애니메이션 없음 — 결과창이 떠 있는 동안 씬 정지
    } else {
        engine.tick(dt, keys);

        if (engine.lastEvent === 'goal') {
            beginEnding();
        } else if (engine.lastEvent === 'respawn') {
            showPlayMsg('리스폰', 1500);
        }
        engine.lastEvent = null;

        timerEl.textContent = formatTimeMs(currentElapsedMs());
    }

    renderer.render();
    rafId = requestAnimationFrame(loop);
}

// ── 메인 메뉴 버튼 ────────────────────────────────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVb0d9UDThS7cJp6gKlsAu9aHwNvAgzreEGncXJbeUuCq7kMAMtpVSBK8G8qvRHW5snQ/exec';

document.querySelectorAll('.menuBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'main') {
            try {
                const mapJson = await loadMapJson('assets/maps/njk_map.json');
                await startGame(mapJson, { mapKey: MAIN_MAP_KEY, mapName: 'Neeyu Main' });
            } catch (e) {
                console.error(e);
                alert('맵을 불러오지 못했습니다: ' + e.message);
            }
        } else if (action === 'custom') {
            document.getElementById('customMapListOverlay').classList.remove('hidden');
            fetchCustomMaps();
        } else if (action === 'editor') {
            window.location.href = 'map_editor.html';
        }
    });
});

async function fetchCustomMaps() {
    const listDiv = document.getElementById('customMapList');
    listDiv.innerHTML = '<div class="list-msg">불러오는 중...</div>';
    try {
        const res = await fetch(SCRIPT_URL);
        const result = await res.json();
        if (result.success) {
            listDiv.innerHTML = '';
            if (result.data.length === 0) {
                listDiv.innerHTML = '<div class="list-msg">등록된 맵이 없습니다.</div>';
            } else {
                result.data.forEach(map => {
                    const item = document.createElement('div');
                    item.className = 'map-item';
                    const textDiv = document.createElement('div');
                    textDiv.className = 'map-item-text';
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'map-item-title';
                    titleDiv.textContent = map.mapName;
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'map-item-info';
                    infoDiv.textContent = `제작자: ${map.creator} | 등록일: ${map.date}`;
                    textDiv.appendChild(titleDiv);
                    textDiv.appendChild(infoDiv);
                    const rankBtn = document.createElement('button');
                    rankBtn.className = 'rank-btn';
                    rankBtn.textContent = '🏆';
                    rankBtn.title = '랭킹 보기';
                    rankBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        showRankingModal(map.fileId, map.mapName);
                    });
                    item.appendChild(textDiv);
                    item.appendChild(rankBtn);
                    item.addEventListener('click', async () => {
                        document.getElementById('customMapListOverlay').classList.add('hidden');
                        menuEl.classList.add('hidden');
                        loading.classList.remove('hidden');
                        try {
                            const mapRes = await fetch(SCRIPT_URL + '?fileId=' + encodeURIComponent(map.fileId));
                            if (!mapRes.ok) throw new Error('맵 다운로드 실패');
                            const mapJson = await mapRes.json();
                            await startGame(mapJson, { mapKey: map.fileId, mapName: map.mapName });
                        } catch (e) {
                            console.error(e);
                            alert('맵 데이터를 가져오지 못했습니다: ' + e.message);
                            menuEl.classList.remove('hidden');
                            loading.classList.add('hidden');
                        }
                    });
                    listDiv.appendChild(item);
                });
            }
        } else {
            listDiv.innerHTML = '오류: ' + result.error;
        }
    } catch (e) {
        listDiv.innerHTML = '통신 오류가 발생했습니다.';
        console.error(e);
    }
}

document.getElementById('btnCloseCustomMaps').addEventListener('click', () => {
    document.getElementById('customMapListOverlay').classList.add('hidden');
});

let selectedMapData = null;
document.getElementById('btnOpenUpload').addEventListener('click', () => {
    document.getElementById('uploadMapOverlay').classList.remove('hidden');
    document.getElementById('uploadMapTitle').value = '';
    document.getElementById('uploadMapCreator').value = '';
    document.getElementById('selectedFileName').textContent = '파일이 선택되지 않았습니다';
    document.getElementById('uploadMapFile').value = '';
    selectedMapData = null;
});

document.getElementById('btnCancelUpload').addEventListener('click', () => {
    document.getElementById('uploadMapOverlay').classList.add('hidden');
});

document.getElementById('btnSelectFile').addEventListener('click', () => {
    document.getElementById('uploadMapFile').click();
});

document.getElementById('uploadMapFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('selectedFileName').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            selectedMapData = JSON.parse(ev.target.result);
        } catch (err) {
            alert('유효하지 않은 JSON 파일입니다.');
            selectedMapData = null;
            document.getElementById('selectedFileName').textContent = '파일이 선택되지 않았습니다';
            e.target.value = '';
        }
    };
    reader.readAsText(file);
});

document.getElementById('btnSubmitUpload').addEventListener('click', async () => {
    const title = document.getElementById('uploadMapTitle').value.trim();
    const creator = document.getElementById('uploadMapCreator').value.trim();
    
    if (!title || !creator) {
        alert('맵 제목과 제작자명을 입력해주세요.');
        return;
    }
    if (!selectedMapData) {
        alert('맵 파일을 선택해주세요.');
        return;
    }

    const btn = document.getElementById('btnSubmitUpload');
    btn.disabled = true;
    btn.textContent = '업로드 중...';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                mapName: title,
                creator: creator,
                mapData: selectedMapData
            })
        });
        
        const result = await res.json();
        
        if (result.success) {
            document.getElementById('uploadMapOverlay').classList.add('hidden');
            document.getElementById('uploadSuccessOverlay').classList.remove('hidden');
            fetchCustomMaps(); // 리스트 새로고침
        } else {
            alert('업로드 실패: ' + result.error);
        }
    } catch (e) {
        console.error(e);
        alert('업로드 중 오류가 발생했습니다.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
    }
});

document.querySelectorAll('[data-paction]').forEach(btn => {
    btn.addEventListener('click', () => {
        const a = btn.dataset.paction;
        if (a === 'resume') togglePause();
        else if (a === 'quit') quitToMenu();
    });
});

document.getElementById('localMapInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const mapJson = JSON.parse(reader.result);
            // 구버전(배열) 호환
            if (Array.isArray(mapJson)) {
                await startGame({ cells: mapJson });
            } else {
                await startGame(mapJson);
            }
        } catch (err) {
            console.error(err);
            alert('맵 파일 파싱 실패: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// ── 결과창 랭킹 ──────────────────────────────────────────────────────────────
function setNotice(msg, kind) {
    endNoticeEl.textContent = msg || '';
    endNoticeEl.classList.remove('err', 'ok');
    if (kind === 'err') endNoticeEl.classList.add('err');
    else if (kind === 'ok') endNoticeEl.classList.add('ok');
}

async function submitRanking() {
    if (!currentMapKey) return;
    const user = endNicknameEl.value.trim();
    if (user.length < 2 || user.length > 12) {
        setNotice('닉네임은 2~12자여야 합니다.', 'err');
        return;
    }
    const btn = document.getElementById('btnSubmitRanking');
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = '등록 중...';
    setNotice('등록 중...', null);
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'submitRanking',
                mapKey: currentMapKey,
                mapName: currentMapName,
                user,
                timeMs: Math.round(finalTimeMs),
            }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || '등록 실패');
        setNotice('등록 완료!', 'ok');
        endSubmitBox.classList.add('hidden');
        await loadRanking();
    } catch (e) {
        console.error(e);
        setNotice('등록 실패: ' + e.message, 'err');
    } finally {
        btn.disabled = false;
        btn.textContent = prev;
    }
}

async function loadRanking() {
    if (!currentMapKey) return;
    rankingListEl.classList.remove('hidden');
    rankingListEl.textContent = '불러오는 중...';
    try {
        const url = SCRIPT_URL + '?action=ranking&mapKey=' + encodeURIComponent(currentMapKey);
        const res = await fetch(url);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || '조회 실패');
        renderRanking(result.data || []);
    } catch (e) {
        console.error(e);
        rankingListEl.textContent = '랭킹 로드 실패: ' + e.message;
    }
}

function renderRanking(list) {
    rankingListEl.innerHTML = '';
    if (!list.length) {
        rankingListEl.textContent = '아직 기록이 없습니다.';
        return;
    }
    list.forEach((row, i) => {
        const div = document.createElement('div');
        div.className = 'rank-row';
        const pos = document.createElement('span');
        pos.className = 'rank-pos';
        pos.textContent = `#${i + 1}`;
        const usr = document.createElement('span');
        usr.className = 'rank-user';
        usr.textContent = row.user;
        const tim = document.createElement('span');
        tim.className = 'rank-time';
        tim.textContent = formatTimeMs(Number(row.timeMs));
        div.appendChild(pos);
        div.appendChild(usr);
        div.appendChild(tim);
        rankingListEl.appendChild(div);
    });
}

document.getElementById('btnSubmitRanking').addEventListener('click', submitRanking);
document.getElementById('btnViewRanking').addEventListener('click', loadRanking);
document.getElementById('btnEndMenu').addEventListener('click', () => {
    endEl.classList.remove('show');
    quitToMenu();
});
endNicknameEl.addEventListener('keydown', e => {
    if (e.code === 'Enter') { e.preventDefault(); submitRanking(); }
});

// ── 메인 메뉴 배경 씬 ────────────────────────────────────────────────────────
const menuSprites = {};
let menuRafId = null;
let menuState = null;

function loadMenuAssets() {
    const load = (src) => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
    return Promise.all([
        load('assets/bg/bg_stage_2.png'),
        load('assets/sprites/ready.png'),
        load('assets/sprites/start.png'),
        load('assets/sprites/end.png'),
    ]).then(([bg, ready, start, end]) => {
        menuSprites.bg = bg;
        menuSprites.ready = ready;
        menuSprites.start = start;
        menuSprites.end = end;
    });
}

function startMenuScene() {
    if (menuRafId) return;
    const charW = Math.round(canvas.width * CHAR_SCALE);
    menuState = {
        x: -charW,
        phase: 'ready',
        phaseStart: performance.now(),
        jumpStartX: 0,
    };
    const loop = (ts) => {
        drawMenuFrame(ts);
        menuRafId = requestAnimationFrame(loop);
    };
    menuRafId = requestAnimationFrame(loop);
}

function stopMenuScene() {
    if (menuRafId) { cancelAnimationFrame(menuRafId); menuRafId = null; }
}

function drawMenuFrame(ts) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // 배경
    const bg = menuSprites.bg;
    if (bg && bg.complete && bg.naturalWidth > 0) {
        const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
        const dw = bg.naturalWidth * scale;
        const dh = bg.naturalHeight * scale;
        ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);
    }

    // 바닥 (curtain 테마 색상 = bg_stage_2)
    const FLOOR_ROWS = 2;
    const floorH = CELL * FLOOR_ROWS;
    const floorTopY = H - floorH;
    ctx.fillStyle = '#770011';
    ctx.fillRect(0, floorTopY, W, floorH);
    ctx.fillStyle = '#aa0022';
    ctx.fillRect(0, floorTopY, W, 6);
    ctx.strokeStyle = 'rgba(221, 68, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += CELL) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, floorTopY);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
    }

    // 캐릭터 상태 기계
    const t = ts - menuState.phaseStart;
    const readyDur = 16 * 70;
    const startFrameMs = 55;
    const endFrameMs   = 40;
    const startDur = 23 * startFrameMs;                  // start 애니 전체 재생
    const endLeadFrames = 6;                             // 착지 시 end 7번째 프레임이 뜨도록
    const endLeadMs = endLeadFrames * endFrameMs;
    const airborneDur = startDur + endLeadMs;            // 공중 체공 총 시간
    const charW = Math.round(W * CHAR_SCALE);
    const charH = charW;

    let drawState = 'ready';
    let frame = 0;
    let yOffset = 0;

    if (menuState.phase === 'ready') {
        drawState = 'ready';
        frame = Math.min(15, Math.floor(t / 70));
        if (t >= readyDur) {
            menuState.phase = 'start';
            menuState.phaseStart = ts;
            menuState.jumpStartX = menuState.x;
        }
    } else if (menuState.phase === 'start') {
        const prog = Math.min(1, t / airborneDur);
        yOffset = -4 * prog * (1 - prog) * 140;
        menuState.x = menuState.jumpStartX + prog * 220;

        if (t < startDur) {
            drawState = 'start';
            frame = Math.min(22, Math.floor(t / startFrameMs));
        } else {
            drawState = 'end';
            frame = Math.min(endLeadFrames - 1, Math.floor((t - startDur) / endFrameMs));
        }

        if (t >= airborneDur) {
            menuState.x = menuState.jumpStartX + 220;
            menuState.phase = 'end';
            menuState.phaseStart = ts;
        }
    } else {
        // 착지 후 end 애니 나머지 (frame 6 ~ 19)
        const tailStartFrame = 6;
        const tailFrames = 20 - tailStartFrame;
        drawState = 'end';
        frame = Math.min(19, tailStartFrame + Math.floor(t / endFrameMs));
        const tailDur = tailFrames * endFrameMs;
        if (t >= tailDur) {
            if (menuState.x > W + charW) menuState.x = -charW;
            menuState.phase = 'ready';
            menuState.phaseStart = ts;
        }
    }

    const img = menuSprites[drawState];
    if (img && img.complete && img.naturalWidth > 0) {
        const { fw, fh } = SPRITE_INFO[drawState];
        const drawX = menuState.x;
        const drawY = floorTopY - charH + yOffset;
        ctx.drawImage(img, frame * fw, 0, fw, fh, drawX, drawY, charW, charH);
    }
}

loadMenuAssets().then(() => startMenuScene());

// ── PWA: 서비스 워커 등록 ────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW 등록 실패', err));
    });
}

// ── 랭킹 모달 (메뉴에서 진입) ────────────────────────────────────────────────
const rankingOverlayEl = document.getElementById('rankingOverlay');
const rankingTitleEl   = document.getElementById('rankingTitle');
const rankingModalListEl = document.getElementById('rankingModalList');

function renderRankingInto(targetEl, list) {
    targetEl.innerHTML = '';
    if (!list.length) {
        targetEl.textContent = '아직 기록이 없습니다.';
        return;
    }
    list.forEach((row, i) => {
        const div = document.createElement('div');
        div.className = 'rank-row';
        const pos = document.createElement('span');
        pos.className = 'rank-pos';
        pos.textContent = `#${i + 1}`;
        const usr = document.createElement('span');
        usr.className = 'rank-user';
        usr.textContent = row.user;
        const tim = document.createElement('span');
        tim.className = 'rank-time';
        tim.textContent = formatTimeMs(Number(row.timeMs));
        div.appendChild(pos);
        div.appendChild(usr);
        div.appendChild(tim);
        targetEl.appendChild(div);
    });
}

async function showRankingModal(mapKey, mapName) {
    rankingTitleEl.textContent = `${mapName} 랭킹`;
    rankingModalListEl.textContent = '불러오는 중...';
    rankingOverlayEl.classList.remove('hidden');
    try {
        const url = SCRIPT_URL + '?action=ranking&mapKey=' + encodeURIComponent(mapKey);
        const res = await fetch(url);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || '조회 실패');
        renderRankingInto(rankingModalListEl, result.data || []);
    } catch (e) {
        console.error(e);
        rankingModalListEl.textContent = '랭킹 로드 실패: ' + e.message;
    }
}

document.getElementById('mainRankingBtn').addEventListener('click', () => {
    showRankingModal(MAIN_MAP_KEY, '메인 맵');
});
document.getElementById('btnCloseRanking').addEventListener('click', () => {
    rankingOverlayEl.classList.add('hidden');
});
document.getElementById('btnCloseUploadSuccess').addEventListener('click', () => {
    document.getElementById('uploadSuccessOverlay').classList.add('hidden');
});

// ── 모바일 지원 ──────────────────────────────────────────────────────────────
const isMobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

if (isMobile) {
    document.body.classList.add('mobile');
}

const mobileControlsEl = document.getElementById('mobileControls');
const mobilePauseBtnEl = document.getElementById('mobilePauseBtn');

function showMobileUI() {
    if (!isMobile) return;
    mobileControlsEl.classList.remove('hidden');
    mobilePauseBtnEl.classList.remove('hidden');
}
function hideMobileUI() {
    mobileControlsEl.classList.add('hidden');
    mobilePauseBtnEl.classList.add('hidden');
}

function bindPad(el, keyCode) {
    const activeIds = new Set();
    const press = (ev) => {
        ev.preventDefault();
        if (!engine || paused || ending) return;
        activeIds.add(ev.pointerId);
        if (keys[keyCode]) return;
        keys[keyCode] = true;
        el.classList.add('pressed');
        engine.onKeydown(keyCode);
    };
    const release = (ev) => {
        ev.preventDefault();
        activeIds.delete(ev.pointerId);
        if (activeIds.size > 0) return;
        if (!keys[keyCode]) return;
        keys[keyCode] = false;
        el.classList.remove('pressed');
        if (engine) engine.onKeyup(keyCode, keys);
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('contextmenu', e => e.preventDefault());
}

if (isMobile) {
    bindPad(document.getElementById('padLeft'), 'ArrowLeft');
    bindPad(document.getElementById('padRight'), 'ArrowRight');
    bindPad(document.getElementById('padJump'), 'Space');
    mobilePauseBtnEl.addEventListener('click', () => {
        if (engine && !ending) togglePause();
    });
}

// ── 회전 안내 ────────────────────────────────────────────────────────────────
const rotateOverlayEl = document.getElementById('rotateOverlay');
function updateOrientation() {
    if (!isMobile) return;
    const portrait = window.innerHeight > window.innerWidth;
    rotateOverlayEl.classList.toggle('hidden', !portrait);
}
if (isMobile) {
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    updateOrientation();
}

// ── PWA 설치 유도 ────────────────────────────────────────────────────────────
let deferredInstallPrompt = null;
const installBtnEl = document.getElementById('btnInstallApp');
const iosHintEl = document.getElementById('iosInstallHint');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (isMobile && !isStandalone) {
        installBtnEl.classList.remove('hidden');
    }
});

installBtnEl.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
        await deferredInstallPrompt.userChoice;
    } catch { /* user dismissed */ }
    deferredInstallPrompt = null;
    installBtnEl.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
    installBtnEl.classList.add('hidden');
    iosHintEl.classList.add('hidden');
    deferredInstallPrompt = null;
});

if (isIOS && !isStandalone) {
    iosHintEl.classList.remove('hidden');
}

// ── 오디오 언락 (iOS Safari) ─────────────────────────────────────────────────
let audioUnlocked = false;
function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const p = bgmEl.play();
    if (p && p.catch) p.catch(() => {});
    bgmEl.pause();
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

