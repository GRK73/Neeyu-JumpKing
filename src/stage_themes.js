import { CELL } from './constants.js';

// ── 테마 레지스트리 ───────────────────────────────────────────────────────────
// 각 테마는 배경 그라디언트(bg), 벽 텍스처 키(tex), 플랫폼 색상(plat)을 정의
export const STAGE_THEMES = {
    stage:   { tex: 'wood',   bg: ['#050814', '#100f1a'], plat: { base: '#554433', top: '#776655', edge: '#998877' } },
    curtain: { tex: 'cloth',  bg: ['#200808', '#300a0a'], plat: { base: '#770011', top: '#aa0022', edge: '#dd4455' } },
    office:  { tex: 'metal',  bg: ['#0f1218', '#1c222c'], plat: { base: '#334455', top: '#556677', edge: '#99aabb' } },
    circus:  { tex: 'circus', bg: ['#1a0505', '#280808'], plat: { base: '#881100', top: '#cc2200', edge: '#ffcc44' } },
    forest:  { tex: 'dirt',   bg: ['#071407', '#0d200d'], plat: { base: '#225511', top: '#337722', edge: '#77cc55' } },
    canopy:  { tex: 'branch', bg: ['#1e3b52', '#3d6c82'], plat: { base: '#1a4410', top: '#2a6618', edge: '#66aa44' } },
    sky:     { tex: 'cloud',  bg: ['#4a90e2', '#87cefa'], plat: { base: '#99bbcc', top: '#bbddee', edge: '#eef6ff' } },
    space:   { tex: 'meteor', bg: ['#050510', '#0a0a1a'], plat: { base: '#112233', top: '#223355', edge: '#6688bb' } },
};

// 기본 정렬: 위(하늘) → 아래(지상)
export const THEME_ORDER = ['space', 'sky', 'canopy', 'forest', 'circus', 'office', 'curtain', 'stage'];

const DEFAULT_THEME = STAGE_THEMES.stage;

// stages: [{ topRow, theme, ... }]  topRow는 해당 스테이지의 상단 경계 (작은 worldY 쪽)
// worldY가 속한 스테이지를 반환 (topRow*CELL <= worldY 중 가장 큰 것)
export function stageAt(worldY, stages) {
    if (!stages || stages.length === 0) return null;
    const sorted = stages.slice().sort((a, b) => a.topRow - b.topRow);
    let found = null;
    for (const s of sorted) {
        if (worldY >= s.topRow * CELL) found = s;
        else break;
    }
    return found || sorted[0]; // worldY가 모든 stages보다 위쪽이면 최상단 stage
}

export function themeAt(worldY, stages) {
    const s = stageAt(worldY, stages);
    if (!s) return DEFAULT_THEME;
    return STAGE_THEMES[s.theme] || DEFAULT_THEME;
}

// ── 스테이지별 배경 그라디언트 색상 ───────────────────────────────────────
export function getStageBg(worldY, stages = null) {
    return themeAt(worldY, stages).bg;
}
