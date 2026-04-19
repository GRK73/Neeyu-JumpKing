import { CELL }                     from './constants.js';
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

const CANVAS_W = window.innerWidth;
const CANVAS_H = window.innerHeight;
canvas.width   = CANVAS_W;
canvas.height  = CANVAS_H;

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

    runStartTs = performance.now();
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
        pauseStartTs = performance.now();
        pauseEl.classList.remove('hidden');
    } else {
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
}

document.getElementById('songPrev').addEventListener('click', () => cycleSong(-1));
document.getElementById('songNext').addEventListener('click', () => cycleSong(1));

// ── 엔딩 시퀀스 ──────────────────────────────────────────────────────────────
function beginEnding() {
    finalTimeMs = currentElapsedMs();
    timerEl.classList.add('hidden');
    // 배경을 Stage 8 (space) 테마로 고정
    engine.stages = [{ name: 'Stage 8', topRow: 0, theme: 'space' }];
    renderer._sortedStages = null;
    renderer._sortedStagesSrc = null;
    ending = { t0: performance.now(), phase: 1, startCamY: engine.cameraY };
    // 입력 무시 + 상태 고정
    keys = {};
    engine.vx = 0; engine.vy = 0;
    engine.state = 'stand';
    showPlayMsg('');
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
        engine.py -= riseSpeed;
        engine.cameraY = Math.max(0, engine.cameraY - riseSpeed);
        if (t >= 3000) ending.phase = 2;
    } else {
        // 카메라 고정, 캐릭터만 상승
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
        tickEnding();
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
                const mapJson = await loadMapJson('assets/maps/testmap.json');
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
    listDiv.innerHTML = '불러오는 중...';
    try {
        const res = await fetch(SCRIPT_URL);
        const result = await res.json();
        if (result.success) {
            listDiv.innerHTML = '';
            if (result.data.length === 0) {
                listDiv.innerHTML = '등록된 맵이 없습니다.';
            } else {
                result.data.forEach(map => {
                    const item = document.createElement('div');
                    item.className = 'map-item';
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'map-item-title';
                    titleDiv.textContent = map.mapName;
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'map-item-info';
                    infoDiv.textContent = `제작자: ${map.creator} | 등록일: ${map.date}`;
                    item.appendChild(titleDiv);
                    item.appendChild(infoDiv);
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
            alert('업로드 완료!');
            document.getElementById('uploadMapOverlay').classList.add('hidden');
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
