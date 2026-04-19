// ── 맵 데이터 (원본 960px 기준 좌표) ─────────────────────────────────────────

// 맵 기준 해상도 및 규격
export const MAP_BASE_WIDTH    = 960;  // 좌표계 기준 폭 (실제 캔버스 폭에 맞춰 스케일)
export const MAP_HEIGHT_SCREENS = 13;  // 세로 = 캔버스 높이 × 이 값

export const PLATFORMS_DEF = [
    { x: 0, y: 6940, w: 960, h: 60, type: 'wall' }
];

// 테마 구경용 쉬운 맵 생성
const stageY = [6700, 5900, 5100, 4300, 3500, 2700, 1900, 1100];
for (let y = 6800; y > 200; y -= 160) {
    // 800px 마다 거대한 안전 바닥을 깔되, 우측 260px은 올라갈 구멍으로 비워둠
    let isSafeFloor = false;
    for (const sy of stageY) {
        if (Math.abs(sy - y) < 80) {
            isSafeFloor = true;
            break;
        }
    }
    
    if (isSafeFloor) {
        PLATFORMS_DEF.push({ x: 0, y: y, w: 700, h: 40, type: 'wall' });
    } else {
        // 시각적 텍스처 감상용 다채로운 블록 (좌측에 큼지막하게 배치)
        let type = 'wall';
        if (y % 480 === 0) type = 'diag_r';
        else if (y % 480 === 160) type = 'diag_l';
        
        PLATFORMS_DEF.push({
            x: 50, y: y, w: 450, h: type.startsWith('diag') ? 100 : 80, type: type
        });
    }

    // 우측 점프 전용 계단 (지그재그)
    const isRightAlt = (Math.floor(y / 160) % 2 === 0);
    PLATFORMS_DEF.push({
        x: isRightAlt ? 650 : 800,
        y: y,
        w: 120,
        h: 20,
        type: 'normal'
    });
}
PLATFORMS_DEF.push({ x: 380, y: 155, w: 200, h: 14, type: 'goal' });

export const FANS_DEF = [];
export const TRAPS_DEF = [];

// 스테이지 경계 (topRow*CELL = worldY)
// 위(낮은 worldY) → 아래(높은 worldY) 순. CELL=40 기준.
// 기존 하드코딩 임계값(5900, 5100, ...)에 가장 가까운 정수 row로 매칭.
export const STAGES_DEF = [
    { name: 'Space',   theme: 'space',   topRow: 0,   color: '#aa66ff' },
    { name: 'Sky',     theme: 'sky',     topRow: 28,  color: '#44aaff' }, // ~1100
    { name: 'Canopy',  theme: 'canopy',  topRow: 48,  color: '#44ffcc' }, // ~1900
    { name: 'Forest',  theme: 'forest',  topRow: 68,  color: '#88ff66' }, // ~2700
    { name: 'Circus',  theme: 'circus',  topRow: 88,  color: '#ffee44' }, // ~3500
    { name: 'Office',  theme: 'office',  topRow: 108, color: '#ffaa44' }, // ~4300
    { name: 'Curtain', theme: 'curtain', topRow: 128, color: '#ff6655' }, // ~5100
    { name: 'Stage',   theme: 'stage',   topRow: 148, color: '#ff3344' }, // ~5900
];

// ── MAP_SCALE 적용 스케일 함수 ────────────────────────────────────────────────
export function scalePlatforms(defs, scale) {
    return defs.map(p => {
        const s = {
            ...p,
            x: Math.round(p.x * scale),
            w: Math.round(p.w * scale),
            broken: false, standTimer: 0, respawnTimer: 0,
        };
        if (p.moveMin !== undefined) s.moveMin = Math.round(p.moveMin * scale);
        if (p.moveMax !== undefined) s.moveMax = Math.round(p.moveMax * scale);
        return s;
    });
}

export function scaleFans(defs, scale) {
    return defs.map(f => ({
        ...f,
        x:     Math.round(f.x     * scale),
        w:     Math.round(f.w     * scale),
        range: f.range != null ? Math.round(f.range * scale) : undefined,
        zoneX: f.zoneX != null ? Math.round(f.zoneX * scale) : undefined,
        zoneW: f.zoneW != null ? Math.round(f.zoneW * scale) : undefined,
    }));
}

export function scaleTraps(defs, scale) {
    return defs.map(t => ({
        ...t,
        x: Math.round(t.x * scale),
        w: Math.round(t.w * scale),
    }));
}
