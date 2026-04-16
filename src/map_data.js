// ── 맵 데이터 (원본 960px 기준 좌표) ─────────────────────────────────────────

export const PLATFORMS_DEF = [

    // ── 바닥 ─────────────────────────────────────────────────────────────────
    { x: 0, y: 6940, w: 960, h: 60, type: 'floor' },

    // ════════════════════════════════════════════
    //  STAGE 1  y=5900~6700  돌 바닥 / 무대 단상
    // ════════════════════════════════════════════
    { x: 50,  y: 6760, w: 200, h: 14, type: 'normal' },
    { x: 700, y: 6600, w: 200, h: 14, type: 'normal' },
    { x: 80,  y: 6450, w: 195, h: 14, type: 'normal' },
    { x: 680, y: 6290, w: 195, h: 14, type: 'normal' },
    { x: 60,  y: 6140, w: 190, h: 14, type: 'normal' },
    { x: 710, y: 5990, w: 190, h: 14, type: 'normal' },
    { x: 380, y: 5910, w: 200, h: 14, type: 'normal' },

    // ════════════════════════════════════════════
    //  STAGE 2  y=5100~5900  빨간 천 / 커튼
    // ════════════════════════════════════════════
    { x: 60,  y: 5760, w: 185, h: 14, type: 'normal' },
    { x: 720, y: 5600, w: 185, h: 14, type: 'normal' },
    { x: 90,  y: 5440, w: 180, h: 14, type: 'normal' },
    { x: 700, y: 5280, w: 180, h: 14, type: 'normal' },
    { x: 70,  y: 5130, w: 175, h: 14, type: 'normal' },
    { x: 390, y: 5100, w: 180, h: 14, type: 'normal' },

    // ════════════════════════════════════════════
    //  STAGE 3  y=4300~5100  철 바닥 / 사무실
    // ════════════════════════════════════════════
    { x: 690, y: 4960, w: 175, h: 14, type: 'normal' },
    { x: 70,  y: 4800, w: 170, h: 14, type: 'normal', gimmick: 'breakable' },
    { x: 710, y: 4640, w: 165, h: 14, type: 'normal' },
    { x: 80,  y: 4480, w: 165, h: 14, type: 'normal', gimmick: 'breakable' },
    { x: 720, y: 4330, w: 160, h: 14, type: 'normal', gimmick: 'breakable' },
    { x: 385, y: 4300, w: 190, h: 14, type: 'normal' },

    // ════════════════════════════════════════════
    //  STAGE 4  y=3500~4300  서커스 천막
    // ════════════════════════════════════════════
    { x: 60,  y: 4160, w: 165, h: 14, type: 'normal' },
    { x: 740, y: 4000, w: 160, h: 14, type: 'normal' },
    { x: 70,  y: 3840, w: 160, h: 14, type: 'normal' },
    { x: 730, y: 3680, w: 158, h: 14, type: 'normal' },
    { x: 80,  y: 3540, w: 155, h: 14, type: 'normal' },
    { x: 390, y: 3505, w: 180, h: 14, type: 'normal' },

    // ════════════════════════════════════════════
    //  STAGE 5  y=2700~3500  숲  [세이브포인트]
    // ════════════════════════════════════════════
    { x: 720, y: 3360, w: 170, h: 14, type: 'normal' },
    { x: 70,  y: 3200, w: 168, h: 14, type: 'normal' },
    { x: 730, y: 3040, w: 165, h: 14, type: 'normal' },
    { x: 60,  y: 2880, w: 165, h: 14, type: 'normal' },
    { x: 740, y: 2730, w: 160, h: 14, type: 'normal' },
    { x: 355, y: 2695, w: 250, h: 14, type: 'save'   },

    // ════════════════════════════════════════════
    //  STAGE 6  y=1900~2700  나뭇가지 / 숲 상층
    // ════════════════════════════════════════════
    { x: 60,  y: 2550, w: 160, h: 14, type: 'normal' },
    { x: 740, y: 2390, w: 155, h: 14, type: 'normal' },
    { x: 70,  y: 2230, w: 155, h: 14, type: 'normal' },
    { x: 730, y: 2070, w: 152, h: 14, type: 'normal' },
    { x: 65,  y: 1940, w: 150, h: 14, type: 'normal' },
    { x: 390, y: 1910, w: 180, h: 14, type: 'normal' },

    // ════════════════════════════════════════════
    //  STAGE 7  y=1100~1900  구름 / 하늘 (얼음)
    // ════════════════════════════════════════════
    { x: 720, y: 1765, w: 150, h: 14, type: 'normal', gimmick: 'ice' },
    { x: 65,  y: 1615, w: 148, h: 14, type: 'normal', gimmick: 'ice' },
    { x: 745, y: 1465, w: 145, h: 14, type: 'normal', gimmick: 'ice' },
    { x: 70,  y: 1320, w: 145, h: 14, type: 'normal', gimmick: 'ice' },
    { x: 750, y: 1170, w: 142, h: 14, type: 'normal', gimmick: 'ice' },
    { x: 393, y: 1110, w: 174, h: 14, type: 'normal' },

    // ════════════════════════════════════════════
    //  STAGE 8  y=200~1100  운석 / 밤하늘 (이동)
    // ════════════════════════════════════════════
    { x: 80,  y: 970, w: 140, h: 14, type: 'normal', gimmick: 'moving', moveAxis:'x', moveMin:40,  moveMax:320, moveSpeed:1.3, moveDir:1  },
    { x: 720, y: 820, w: 135, h: 14, type: 'normal', gimmick: 'moving', moveAxis:'x', moveMin:620, moveMax:900, moveSpeed:1.5, moveDir:-1 },
    { x: 80,  y: 670, w: 132, h: 14, type: 'normal', gimmick: 'moving', moveAxis:'y', moveMin:630, moveMax:710, moveSpeed:1.0, moveDir:1  },
    { x: 700, y: 520, w: 130, h: 14, type: 'normal', gimmick: 'moving', moveAxis:'x', moveMin:600, moveMax:870, moveSpeed:1.6, moveDir:1  },
    { x: 80,  y: 370, w: 130, h: 14, type: 'normal', gimmick: 'moving', moveAxis:'x', moveMin:50,  moveMax:310, moveSpeed:1.4, moveDir:-1 },
    { x: 390, y: 250, w: 180, h: 14, type: 'normal' },

    // ── 골 ─────────────────────────────────────────────────────────────────
    { x: 380, y: 155, w: 200, h: 14, type: 'goal' },
];

export const FANS_DEF = [
    { x: 450, y: 4070, w: 50, h: 55, windX: -3.2, windY:  0,   range: 300 },
    { x: 455, y: 3760, w: 50, h: 55, windX:  3.2, windY:  0,   range: 300 },
    { x: 450, y: 3600, w: 50, h: 55, windX:  0,   windY: -1.8, range: 220 },
];

export const TRAPS_DEF = [
    { x: 385, y: 2468, w: 42, h: 42, bounceVX:  9, bounceVY: -15 },
    { x: 385, y: 2308, w: 42, h: 42, bounceVX: -9, bounceVY: -15 },
    { x: 388, y: 2150, w: 42, h: 42, bounceVX:  7, bounceVY: -17 },
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
        range: Math.round(f.range * scale),
    }));
}

export function scaleTraps(defs, scale) {
    return defs.map(t => ({
        ...t,
        x: Math.round(t.x * scale),
        w: Math.round(t.w * scale),
    }));
}
