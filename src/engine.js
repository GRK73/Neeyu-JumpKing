import {
    SPRITE_INFO, FRAME_DUR, GRAVITY, MOVE_SPEED, MAX_CHARGE,
    MIN_VY, MAX_VY, MAX_VX, CELL, CHAR_SCALE, HITBOX_W_RATIO, HITBOX_H_RATIO,
    TERMINAL_VY, END_PREDICT_FRAMES, BREAKABLE_LIFETIME, BREAKABLE_RESPAWN,
} from './constants.js';

// ── 플랫폼 시각적 병합 (Greedy Meshing): 인접한 동일 블록들을 하나의 큰 덩어리로 융합 ──
export function mergeVisualPlatforms(platforms) {
    const isMergeable = p => {
        if (p.type === 'diag_r' || p.type === 'diag_l' || p.type === 'goal') return false;
        if (p.gimmick === 'moving' || p.gimmick === 'breakable') return false;
        return true; // wall, floor, 일반 지형 등 모두 포함
    };

    let mergeable = [];
    let others = [];
    for (const p of platforms) {
        if (isMergeable(p)) mergeable.push({ ...p });
        else others.push(p);
    }

    const isSameStyle = (a, b) => a.type === b.type && a.gimmick === b.gimmick;

    // 가로 병합
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < mergeable.length; i++) {
            const p1 = mergeable[i];
            if (!p1) continue;
            for (let j = i + 1; j < mergeable.length; j++) {
                const p2 = mergeable[j];
                if (!p2) continue;

                if (isSameStyle(p1, p2) && p1.y === p2.y && p1.h === p2.h) {
                    if (p1.x + p1.w === p2.x) { p1.w += p2.w; mergeable[j] = null; changed = true; }
                    else if (p2.x + p2.w === p1.x) { p1.x = p2.x; p1.w += p2.w; mergeable[j] = null; changed = true; }
                }
            }
        }
        mergeable = mergeable.filter(Boolean);
    }

    // 세로 병합
    changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < mergeable.length; i++) {
            const p1 = mergeable[i];
            if (!p1) continue;
            for (let j = i + 1; j < mergeable.length; j++) {
                const p2 = mergeable[j];
                if (!p2) continue;

                if (isSameStyle(p1, p2) && p1.x === p2.x && p1.w === p2.w) {
                    if (p1.y + p1.h === p2.y) { p1.h += p2.h; mergeable[j] = null; changed = true; }
                    else if (p2.y + p2.h === p1.y) { p1.y = p2.y; p1.h += p2.h; mergeable[j] = null; changed = true; }
                }
            }
        }
        mergeable = mergeable.filter(Boolean);
    }

    return [...others, ...mergeable];
}

// ── 인접 wall 병합: 같은 (x,w) 컬럼의 연속 블록을 하나의 큰 직사각형으로 합침 ──
export function buildPhysPlatforms(platforms) {
    const isMergeable = p =>
        p.type === 'wall' && p.gimmick !== 'moving' && p.gimmick !== 'breakable';

    const colMap = new Map();
    for (const p of platforms) {
        if (!isMergeable(p)) continue;
        const key = `${p.x},${p.w}`;
        if (!colMap.has(key)) colMap.set(key, []);
        colMap.get(key).push(p);
    }

    const mergedWalls = [];
    for (const col of colMap.values()) {
        col.sort((a, b) => a.y - b.y);
        let cur = { ...col[0] };
        for (let i = 1; i < col.length; i++) {
            const p = col[i];
            if (p.y <= cur.y + cur.h + 1) {
                cur.h = Math.max(cur.y + cur.h, p.y + p.h) - cur.y;
            } else {
                mergedWalls.push(cur);
                cur = { ...p };
            }
        }
        mergedWalls.push(cur);
    }

    return [...platforms.filter(p => !isMergeable(p)), ...mergedWalls];
}

// ── 게임 엔진 ─────────────────────────────────────────────────────────────────
export class GameEngine {
    /**
     * @param {{
     *   canvasW: number, canvasH: number,
     *   platforms: object[], fans: object[], traps: object[],
     *   signs?: object[],
     *   mapH: number,
     *   stages?: object[]|null
     * }} opts
     */
    constructor({ canvasW, canvasH, platforms, fans, traps, signs = [], mapH, stages = null }) {
        this.CANVAS_W = canvasW;
        this.CANVAS_H = canvasH;
        this.MAP_W    = Math.floor(canvasW / CELL) * CELL;
        this.MAP_H    = mapH;

        const charW   = Math.round(canvasW * CHAR_SCALE);
        this.CHAR_W   = charW;
        this.CHAR_H   = charW;
        this.HITBOX_W = Math.round(charW * HITBOX_W_RATIO);
        this.HITBOX_H = Math.round(charW * HITBOX_H_RATIO);
        this.FOOT_OFFSET = Math.round(this.HITBOX_W * 0.15); // 역사다리꼴 깎임 마진 부여
        this.SPRITE_OX = (charW - this.HITBOX_W) / 2;
        this.SPRITE_OY = charW - this.HITBOX_H;

        this.platforms     = mergeVisualPlatforms(platforms);
        this.physPlatforms = buildPhysPlatforms(this.platforms);
        this.fans          = fans;
        this.traps         = traps;
        this.signs         = signs;
        this.stages        = stages;

        // 게임 상태
        this.state        = 'stand';
        this.px           = canvasW / 2 - this.HITBOX_W / 2;
        this.py           = (platforms[0]?.y ?? 0) - this.HITBOX_H;
        this.vx           = 0;
        this.vy           = 0;
        this.facingRight  = true;
        this.cameraY      = mapH - canvasH;
        this.standingOn   = null;
        this.onMovingDelta = { x: 0, y: 0 };
        this.animFrame    = 0;
        this.animTimer    = 0;
        this.chargeStart  = 0;
        this.startFrameDur = 50;
        this.debugHitbox  = false;
        // 모서리 뭉툭 처리 마진: 이 픽셀 이내의 겹침은 코너로 판정해 밀어냄
        this.CORNER_M = Math.round(this.HITBOX_H * 0.15);

        // 부서지는 블록 그룹화 (Flood-fill)
        const breakables = this.platforms.filter(p => p.gimmick === 'breakable');
        let breakGroupId = 0;
        for (const p of breakables) {
            if (p.breakGroup) continue;
            const group = [];
            const queue = [p];
            p.breakGroup = group;
            p.breakId = breakGroupId++;
            
            while (queue.length > 0) {
                const curr = queue.shift();
                group.push(curr);
                for (const o of breakables) {
                    if (!o.breakGroup) {
                        const adjX = (o.x < curr.x + curr.w && o.x + o.w > curr.x);
                        const adjY = (o.y < curr.y + curr.h && o.y + o.h > curr.y);
                        if ((adjX && Math.abs(o.y - (curr.y + curr.h)) <= 2) ||
                            (adjX && Math.abs(curr.y - (o.y + o.h)) <= 2) ||
                            (adjY && Math.abs(o.x - (curr.x + curr.w)) <= 2) ||
                            (adjY && Math.abs(curr.x - (o.x + o.w)) <= 2)) {
                            o.breakGroup = group;
                            o.breakId = p.breakId;
                            queue.push(o);
                        }
                    }
                }
            }
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const b of group) {
                minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
            }
            for (const b of group) {
                b.groupBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
            }
        }

        // 스폰
        this.spawnPx = this.px;
        this.spawnPy = this.py;

        // 이벤트 (매 tick 후 한 번 읽고 null로 리셋)
        this.lastEvent = null; // 'goal' | 'respawn' | null
    }

    // ── 스폰 위치 설정 ────────────────────────────────────────────────────────
    spawn(x, y) {
        this.spawnPx = x;
        this.spawnPy = y;
        this.px = x; this.py = y;
        this.vx = 0; this.vy = 0;
        this.standingOn = null;
        this.cameraY = Math.max(0, Math.min(
            this.MAP_H - this.CANVAS_H,
            y - this.CANVAS_H / 2 + this.HITBOX_H / 2,
        ));
        this._changeState('stand');
    }

    // ── 키 입력 ───────────────────────────────────────────────────────────────
    onKeydown(code) {
        if (code === 'Space' &&
            (this.state === 'stand' || this.state === 'run' || this.state === 'end')) {
            if (this.state === 'end' && !this.standingOn) return;
            this.chargeStart = performance.now();
            this._changeState('ready');
        }
    }

    onKeyup(code, keys) {
        if (code === 'Space' && this.state === 'ready') {
            this._doJump(keys);
        }
    }

    // ── 프레임 업데이트 ───────────────────────────────────────────────────────
    tick(dt, keys) {
        this._updateGimmicks(dt);
        this._handleMovement(keys);
        this._updatePhysics();
        this._checkTrapCollision();
        this._checkEndTransition();
        this._updateAnimation(dt);
        this._updateCamera();
    }

    // ── 좌우 랩어라운드 ───────────────────────────────────────────────────────
    wrapX(x) {
        if (x < 0)                       return this.MAP_W - this.HITBOX_W;
        if (x > this.MAP_W - this.HITBOX_W) return 0;
        return x;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  내부 메서드
    // ─────────────────────────────────────────────────────────────────────────

    _changeState(next) {
        this.state     = next;
        this.animFrame = 0;
        this.animTimer = 0;
    }

    _framesUntilLanding(sx, sy, svx, svy, max = 300) {
        const { HITBOX_W, HITBOX_H, FOOT_OFFSET } = this;
        let x = sx, y = sy, lvx = svx, lvy = svy;
        for (let f = 1; f <= max; f++) {
            const prevX = x, prevY = y;
            const prevBot = y + HITBOX_H;
            lvy += GRAVITY;
            if (lvy > TERMINAL_VY) lvy = TERMINAL_VY; // 터미널 벨로시티 동기화
            x += lvx; y += lvy;
            x = this.wrapX(x);

            for (const p of this.physPlatforms) {
                if (p.broken) continue;
                if (p.type === 'diag_r' || p.type === 'diag_l') continue;
                if (x + HITBOX_W <= p.x || x >= p.x + p.w) continue;
                if (y + HITBOX_H <= p.y || y >= p.y + p.h) continue;

                // 착지 판정 (실제 물리와 동일한 FOOT_OFFSET 적용)
                if (lvy > 0 && prevBot <= p.y) {
                    if (x + HITBOX_W - FOOT_OFFSET <= p.x || x + FOOT_OFFSET >= p.x + p.w) continue;
                    return f;
                }
                // 머리 박기 시뮬레이션
                if (lvy < 0 && prevY >= p.y + p.h) {
                    y = p.y + p.h; lvy = Math.abs(lvy) * 0.5;
                    break;
                }
                // 오른쪽 벽 충돌 시뮬레이션
                if (lvx > 0 && prevX + HITBOX_W <= p.x) {
                    x = p.x - HITBOX_W; lvx = -Math.abs(lvx) * 0.5;
                    break;
                }
                // 왼쪽 벽 충돌 시뮬레이션
                if (lvx < 0 && prevX >= p.x + p.w) {
                    x = p.x + p.w; lvx = Math.abs(lvx) * 0.5;
                    break;
                }
            }
        }
        return max;
    }

    _doJump(keys) {
        const charge = Math.min((performance.now() - this.chargeStart) / MAX_CHARGE, 1.0);
        const dir    = keys['ArrowLeft'] ? -1 : keys['ArrowRight'] ? 1 : 0;
        if (dir !== 0) this.facingRight = (dir > 0);
        this.vx = dir * MAX_VX * Math.pow(charge, 0.55);
        this.vy = MIN_VY + (MAX_VY - MIN_VY) * charge;
        const total  = this._framesUntilLanding(this.px, this.py, this.vx, this.vy);
        const avail  = Math.max(total - END_PREDICT_FRAMES, 1);
        this.startFrameDur = Math.max((avail * (1000 / 60)) / SPRITE_INFO.start.frames, 8);
        this.standingOn    = null;
        this._endPredicted  = false;
        this._changeState('start');
    }

    _handleMovement(keys) {
        if (this.state === 'ready') {
            this.px += this.onMovingDelta.x;
            this.py += this.onMovingDelta.y;
            if (this.standingOn?.gimmick === 'ice') {
                this.vx *= 0.97;
                this.px += this.vx;
            }
            this.px = this.wrapX(this.px);
            return;
        }
        if (this.state !== 'stand' && this.state !== 'run' && this.state !== 'end') return;

        if (this.state === 'end') {
            if (!this.standingOn) return;
            if (keys['ArrowLeft'] || keys['ArrowRight']) {
                this._changeState('stand');
            } else {
                this.px += this.onMovingDelta.x;
                this.py += this.onMovingDelta.y;
                return;
            }
        }

        this.px += this.onMovingDelta.x;
        this.py += this.onMovingDelta.y;
        this.px  = this.wrapX(this.px);

        const isIce = this.standingOn?.gimmick === 'ice';
        const prevX = this.px;

        if (keys['ArrowLeft']) {
            this.facingRight = false;
            if (isIce) { this.vx = Math.max(this.vx - 0.4, -MOVE_SPEED); this.px = this.wrapX(this.px + this.vx); }
            else        { this.px = this.wrapX(this.px - MOVE_SPEED); }
            if (this.state !== 'run') this._changeState('run');
        } else if (keys['ArrowRight']) {
            this.facingRight = true;
            if (isIce) { this.vx = Math.min(this.vx + 0.4, MOVE_SPEED); this.px = this.wrapX(this.px + this.vx); }
            else        { this.px = this.wrapX(this.px + MOVE_SPEED); }
            if (this.state !== 'run') this._changeState('run');
        } else {
            if (isIce) { this.vx *= 0.97; this.px = this.wrapX(this.px + this.vx); }
            else        { this.vx = 0; }
            if (this.state === 'run') this._changeState('stand');
        }

        this._resolveWallCollisions(prevX, keys);
        this._checkFallOff();
    }

    _checkFallOff() {
        const foot = this.py + this.HITBOX_H;
        for (const p of this.physPlatforms) {
            if (p.broken) continue;
            if (p.type === 'diag_r' || p.type === 'diag_l') continue;
            if (Math.abs(foot - p.y) > 4) continue;

            let p_x = p.x;
            const playerCenter = this.px + this.HITBOX_W / 2;
            const pCenter = p.x + p.w / 2;
            if (playerCenter - pCenter > this.MAP_W / 2) p_x += this.MAP_W;
            else if (pCenter - playerCenter > this.MAP_W / 2) p_x -= this.MAP_W;

            if (this.px + this.HITBOX_W <= p_x || this.px >= p_x + p.w) continue;
            return;
        }
        this.standingOn = null;
        this._changeState('start');
    }

    _resolveWallCollisions(prevX, keys) {
        const { HITBOX_W, HITBOX_H, FOOT_OFFSET } = this;
        let effPx = this.px;
        if (prevX - this.px > this.MAP_W / 2) effPx += this.MAP_W;
        else if (this.px - prevX > this.MAP_W / 2) effPx -= this.MAP_W;

        for (const p of this.physPlatforms) {
            if (p.broken) continue;
            if (this.py + HITBOX_H <= p.y || this.py >= p.y + p.h) continue;

            let p_x = p.x;
            const playerCenter = effPx + HITBOX_W / 2;
            const pCenter = p.x + p.w / 2;
            if (playerCenter - pCenter > this.MAP_W / 2) p_x += this.MAP_W;
            else if (pCenter - playerCenter > this.MAP_W / 2) p_x -= this.MAP_W;

            if (p.type === 'diag_r') {
                if (prevX >= p_x + p.w && effPx < p_x + p.w) {
                    effPx = p_x + p.w; if (!keys['ArrowRight']) this.vx = 0; break;
                }
                const minFootY = Math.min(p.y + p.h, this.py + HITBOX_H);
                const maxFootR = p_x + p.w * Math.max(0, 1 - (minFootY - p.y) / p.h);
                if (effPx + HITBOX_W - FOOT_OFFSET > maxFootR && prevX + HITBOX_W - FOOT_OFFSET <= maxFootR) {
                    effPx = maxFootR - HITBOX_W + FOOT_OFFSET; if (!keys['ArrowLeft']) this.vx = 0; break;
                }
            } else if (p.type === 'diag_l') {
                if (prevX + HITBOX_W <= p_x && effPx + HITBOX_W > p_x) {
                    effPx = p_x - HITBOX_W; if (!keys['ArrowLeft']) this.vx = 0; break;
                }
                const minFootY = Math.min(p.y + p.h, this.py + HITBOX_H);
                const minFootL = p_x + p.w * Math.min(1, (minFootY - p.y) / p.h);
                if (effPx + FOOT_OFFSET < minFootL && prevX + FOOT_OFFSET >= minFootL) {
                    effPx = minFootL - FOOT_OFFSET; if (!keys['ArrowRight']) this.vx = 0; break;
                }
            } else {
                if (prevX + HITBOX_W <= p_x && effPx + HITBOX_W > p_x) {
                    effPx = p_x - HITBOX_W; if (!keys['ArrowLeft']) this.vx = 0; break;
                }
                if (prevX >= p_x + p.w && effPx < p_x + p.w) {
                    effPx = p_x + p.w; if (!keys['ArrowRight']) this.vx = 0; break;
                }
            }
        }
        this.px = this.wrapX(effPx);
    }

    _updatePhysics() {
        if (this.state !== 'start' && this.state !== 'end') return;

        this._applyFanForce();

        const prevX = this.px, prevY = this.py;
        this.vy += GRAVITY;
        if (this.vy > TERMINAL_VY) this.vy = TERMINAL_VY; // 최대 낙하 속도(Terminal Velocity) 제한
        this.px += this.vx;
        this.py += this.vy;
        this.px  = this.wrapX(this.px);

        const { HITBOX_W, HITBOX_H, FOOT_OFFSET } = this;

        // ── 경사 바닥 충돌 ───────────────────────────────────────────────────
        {
            const footL    = this.px + FOOT_OFFSET;
            const footR    = this.px + HITBOX_W - FOOT_OFFSET;
            const foot     = this.py + HITBOX_H;
            const prevFoot = prevY + HITBOX_H;
            for (const p of this.platforms) {
                if (p.type !== 'diag_r' && p.type !== 'diag_l') continue;
                if (footR < p.x || footL > p.x + p.w) continue;
                
                const checkX = p.type === 'diag_r' ? footR : footL;
                const boundedX = Math.max(p.x, Math.min(p.x + p.w, checkX));
                const t     = (boundedX - p.x) / p.w;
                const surfY = p.type === 'diag_r' ? p.y + p.h * (1 - t) : p.y + p.h * t;
                if (foot >= surfY - 1 && prevFoot <= surfY + Math.abs(this.vy) + 2) {
                    this.py = surfY - HITBOX_H;
                    this.vy = 0;
                    this.vx = (p.type === 'diag_r') ? -3 : 3;
                    this.standingOn = null;
                    if (this.state === 'start') this._changeState('end');
                    break;
                }
            }
        }

        let effPx = this.px;
        if (prevX - this.px > this.MAP_W / 2) effPx += this.MAP_W;
        else if (this.px - prevX > this.MAP_W / 2) effPx -= this.MAP_W;

        for (const p of this.physPlatforms) {
            if (p.broken) continue;
            if (p.type === 'diag_r' || p.type === 'diag_l') continue;

            let p_x = p.x;
            const playerCenter = effPx + HITBOX_W / 2;
            const pCenter = p.x + p.w / 2;
            if (playerCenter - pCenter > this.MAP_W / 2) p_x += this.MAP_W;
            else if (pCenter - playerCenter > this.MAP_W / 2) p_x -= this.MAP_W;

            if (effPx + HITBOX_W <= p_x || effPx >= p_x + p.w) continue;
            if (this.py + HITBOX_H <= p.y || this.py >= p.y + p.h) continue;

            const prevBot = prevY + HITBOX_H;

            // 착지
            if (this.vy > 0 && prevBot <= p.y) {
                if (effPx + HITBOX_W - FOOT_OFFSET <= p_x || effPx + FOOT_OFFSET >= p_x + p.w) continue;
                this.px = this.wrapX(effPx);
                this.py = p.y - HITBOX_H;
                if (p.gimmick !== 'ice') this.vx = 0;
                this.vy = 0;
                this.standingOn = p;
                if (this.state === 'start') this._changeState('end');
                if (p.gimmick === 'breakable') p.standTimer = 0;
                if (p.type === 'goal') this.lastEvent = 'goal';
                return;
            }
            // 머리 박기
            if (this.vy < 0 && prevY >= p.y + p.h) {
                // 수평 겹침이 코너 마진 이내 → 옆으로 밀어서 코너 통과
                const hOvlp = Math.min(effPx + HITBOX_W - p_x, p_x + p.w - effPx);
                if (hOvlp > 0 && hOvlp <= this.CORNER_M) {
                    effPx += (effPx + HITBOX_W / 2 < p_x + p.w / 2)
                        ? -(hOvlp + 1) : (hOvlp + 1);
                    break;
                }
                this.py = p.y + p.h; this.vy = Math.abs(this.vy) * 0.5; continue;
            }
            
            const topY = Math.max(this.py, p.y);
            const ratio = (topY - this.py) / HITBOX_H;
            const wOffset = FOOT_OFFSET * ratio;
            
            const prevTopY = Math.max(prevY, p.y);
            const prevRatio = (prevTopY - prevY) / HITBOX_H;
            const prevWOffset = FOOT_OFFSET * prevRatio;
            
            // 오른쪽 벽
            if (this.vx > 0 && prevX + HITBOX_W - prevWOffset <= p_x) {
                // 수직 겹침이 코너 마진 이내 → 위/아래로 밀어서 코너 통과
                const vOvlp = Math.min(this.py + HITBOX_H - p.y, p.y + p.h - this.py);
                if (vOvlp > 0 && vOvlp <= this.CORNER_M) {
                    this.py += (this.py + HITBOX_H / 2 < p.y + p.h / 2)
                        ? -(vOvlp + 1) : (vOvlp + 1);
                    break;
                }
                effPx = p_x - HITBOX_W + wOffset; this.vx = -Math.abs(this.vx) * 0.5; continue;
            }
            // 왼쪽 벽
            if (this.vx < 0 && prevX + prevWOffset >= p_x + p.w) {
                const vOvlp = Math.min(this.py + HITBOX_H - p.y, p.y + p.h - this.py);
                if (vOvlp > 0 && vOvlp <= this.CORNER_M) {
                    this.py += (this.py + HITBOX_H / 2 < p.y + p.h / 2)
                        ? -(vOvlp + 1) : (vOvlp + 1);
                    break;
                }
                effPx = p_x + p.w - wOffset; this.vx = Math.abs(this.vx) * 0.5; continue;
            }
        }

        this.px = this.wrapX(effPx);

        if (this.py > this.MAP_H) this._respawn();
    }

    _checkTrapCollision() {
        const { HITBOX_W, HITBOX_H } = this;
        for (const t of this.traps) {
            if (this.px + HITBOX_W <= t.x || this.px >= t.x + t.w) continue;
            if (this.py + HITBOX_H <= t.y || this.py >= t.y + t.h) continue;
            const mag = Math.abs(t.bounceVX);
            let dir;
            if (this.vx > 0.01)       dir = -1;
            else if (this.vx < -0.01) dir =  1;
            else                      dir = this.facingRight ? -1 : 1;
            this.vx = mag * dir; this.vy = t.bounceVY;
            if (this.state !== 'start') this._changeState('start');
            this._endPredicted = false;
            return;
        }
    }

    _applyFanForce() {
        const plx = this.px, ply = this.py;
        const phw = this.HITBOX_W, phh = this.HITBOX_H;
        let anyFan = false;
        for (const f of this.fans) {
            const zx = f.zoneX ?? f.x, zy = f.zoneY ?? f.y;
            const zw = f.zoneW ?? f.w, zh = f.zoneH ?? f.h;
            if (plx + phw <= zx || plx >= zx + zw) continue;
            if (ply + phh <= zy || ply >= zy + zh) continue;

            let t = 1;
            if (f.windX > 0)       t = 1 - (plx - zx) / Math.max(1, zw);
            else if (f.windX < 0)  t = 1 - ((zx + zw) - (plx + phw)) / Math.max(1, zw);
            else if (f.windY > 0)  t = 1 - (ply - zy) / Math.max(1, zh);
            else if (f.windY < 0)  t = 1 - ((zy + zh) - (ply + phh)) / Math.max(1, zh);
            t = Math.max(0.15, Math.min(1, t));

            this.vx += f.windX * t;
            this.vy += f.windY * t;
            anyFan = true;
        }
        if (anyFan) {
            const cap = MAX_VX * 2;
            if (this.vx > cap) this.vx = cap;
            else if (this.vx < -cap) this.vx = -cap;
        }
    }

    _respawn() {
        this.px = this.spawnPx; this.py = this.spawnPy;
        this.vx = 0; this.vy = 0;
        this.standingOn = null;
        this._changeState('stand');
        this.lastEvent = 'respawn';
    }

    _checkEndTransition() {
        if (this.state !== 'start' || this.vy < 0 || this._endPredicted) return;
        if (this._framesUntilLanding(this.px, this.py, this.vx, this.vy, END_PREDICT_FRAMES) <= END_PREDICT_FRAMES) {
            this._endPredicted = true;
            this._changeState('end');
        }
    }

    _updateGimmicks(dt) {
        this.onMovingDelta.x = 0;
        this.onMovingDelta.y = 0;

        const processedGroups = new Set();

        for (const p of this.platforms) {
            if (p.gimmick === 'breakable') {
                if (!p.breakGroup) continue; // Safety check
                if (processedGroups.has(p.breakGroup)) continue;
                processedGroups.add(p.breakGroup);
                
                let groupStoodOn = false;
                for (const b of p.breakGroup) {
                    if (this.standingOn === b) { groupStoodOn = true; break; }
                }
                
                if (p.broken) {
                    p.respawnTimer += dt;
                    if (p.respawnTimer >= BREAKABLE_RESPAWN) {
                        for (const b of p.breakGroup) { b.broken = false; b.respawnTimer = 0; b.standTimer = 0; }
                    } else {
                        for (const b of p.breakGroup) b.respawnTimer = p.respawnTimer;
                    }
                } else if (groupStoodOn) {
                    p.standTimer += dt;
                    if (p.standTimer >= BREAKABLE_LIFETIME) {
                        for (const b of p.breakGroup) { b.broken = true; b.respawnTimer = 0; }
                        this.standingOn = null;
                        if (this.state === 'stand' || this.state === 'run' || this.state === 'ready') {
                            this.vx = 0; this.vy = 0; this._changeState('start');
                        }
                    } else {
                        for (const b of p.breakGroup) b.standTimer = p.standTimer;
                    }
                } else {
                    p.standTimer = Math.max(0, p.standTimer - dt * 0.3);
                    for (const b of p.breakGroup) b.standTimer = p.standTimer;
                }
            }

            if (p.gimmick === 'moving') {
                if (p.startX !== undefined && p.endX !== undefined) {
                    const dist = Math.hypot(p.endX - p.startX, p.endY - p.startY);
                    if (dist > 0) {
                        if (p.moveProgress === undefined) p.moveProgress = 0;
                        const progressSpeed = p.moveSpeed / dist;
                        p.moveProgress += progressSpeed * p.moveDir;
                        if (p.moveProgress >= 1) {
                            p.moveProgress = 1;
                            p.moveDir = -1;
                        } else if (p.moveProgress <= 0) {
                            p.moveProgress = 0;
                            p.moveDir = 1;
                        }
                        const prevX = p.x;
                        const prevY = p.y;
                        p.x = p.startX + (p.endX - p.startX) * p.moveProgress;
                        p.y = p.startY + (p.endY - p.startY) * p.moveProgress;

                        if (this.standingOn === p) {
                            this.onMovingDelta.x = p.x - prevX;
                            this.onMovingDelta.y = p.y - prevY;
                        }
                    }
                } else if (p.moveAxis) {
                    // Fallback for old map format
                    const axis = p.moveAxis;
                    const prev = p[axis];
                    p[axis] += p.moveSpeed * p.moveDir;
                    if (p[axis] >= p.moveMax || p[axis] <= p.moveMin) {
                        p.moveDir *= -1;
                        p[axis] = Math.max(p.moveMin, Math.min(p.moveMax, p[axis]));
                    }
                    if (this.standingOn === p) {
                        if (axis === 'x') this.onMovingDelta.x = p[axis] - prev;
                        else              this.onMovingDelta.y = p[axis] - prev;
                    }
                }
            }
        }
    }

    _updateAnimation(dt) {
        if (this.state === 'stand') return;
        const info = SPRITE_INFO[this.state];
        const dur  = this.state === 'start' ? this.startFrameDur : FRAME_DUR[this.state];
        const last = info.frames - 1;
        this.animTimer += dt;
        if (this.animTimer < dur) return;
        this.animTimer -= dur;
        switch (this.state) {
            case 'run':
                this.animFrame = (this.animFrame + 1) % info.frames; break;
            case 'ready':
            case 'start':
                if (this.animFrame < last) this.animFrame++; break;
            case 'end':
                if (this.animFrame < last) this.animFrame++;
                else if (this.standingOn) this._changeState('stand');
                else {
                    // 예측이 빗나가 공중에서 end가 끝남 → start 마지막 프레임으로 복귀
                    this.state = 'start';
                    this.animFrame = SPRITE_INFO.start.frames - 1;
                }
                break;
        }
    }

    _updateCamera() {
        const target = this.py - this.CANVAS_H / 2 + this.HITBOX_H / 2;
        this.cameraY += (target - this.cameraY) * 0.12;
        this.cameraY  = Math.max(0, Math.min(this.MAP_H - this.CANVAS_H, this.cameraY));
    }
}
