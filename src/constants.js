// ── 공유 상수 ─────────────────────────────────────────────────────────────────

export const SPRITE_INFO = {
    stand: { frames: 1,  fw: 2048, fh: 2048 },
    run:   { frames: 28, fw: 960,  fh: 960  },
    ready: { frames: 16, fw: 960,  fh: 960  },
    start: { frames: 23, fw: 960,  fh: 960  },
    end:   { frames: 20, fw: 960,  fh: 960  },
};
export const FRAME_DUR = { run: 42, ready: 70, end: 40 };

export const GRAVITY    = 0.55;
export const MOVE_SPEED = 4;
export const MAX_CHARGE = 1000;
export const MIN_VY     = -5;
export const MAX_VY     = -20;
export const MAX_VX     = 10;

export const CELL           = 40;
export const CHAR_SCALE     = 0.052;
export const HITBOX_W_RATIO = 0.50;
export const HITBOX_H_RATIO = 0.82;

export const TERMINAL_VY         = 16;    // 최대 낙하 속도
export const END_PREDICT_FRAMES  = 18;    // 착지 예측/전환용 프레임 수
export const BREAKABLE_LIFETIME  = 3000;  // 부서지는 발판 버티는 시간(ms)
export const BREAKABLE_RESPAWN   = 3000; // 부서진 발판 재생성 시간(ms)
