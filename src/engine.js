import {
    SPRITE_INFO, FRAME_DUR, GRAVITY, MOVE_SPEED, MAX_CHARGE,
    MIN_VY, MAX_VY, MAX_VX, CELL, CHAR_SCALE, HITBOX_W_RATIO, HITBOX_H_RATIO,
} from './constants.js';

// ── 스테이지별 배경 그라디언트 색상 ─────────────────────────────────────────────
export function getStageBg(worldY) {
    if (worldY > 6700) return ['#120800', '#1a0e00'];
    if (worldY > 5900) return ['#050814', '#100f1a']; // S1: 무대 단상 (어두운 조명 배경)
    if (worldY > 5100) return ['#200808', '#300a0a']; // S2: 붉은 천막
    if (worldY > 4300) return ['#0f1218', '#1c222c']; // S3: 직원 사무실 (회청색)
    if (worldY > 3500) return ['#1a0505', '#280808']; // S4: 서커스
    if (worldY > 2700) return ['#071407', '#0d200d']; // S5: 숲 하층
    if (worldY > 1900) return ['#1e3b52', '#3d6c82']; // S6: 숲 정상 + 하늘 (푸른빛이 감도는 상층)
    if (worldY > 1100) return ['#4a90e2', '#87cefa']; // S7: 완전한 하늘 (밝은 낮 하늘)
    return               ['#050510', '#0a0a1a']; // S8: 우주 밤하늘
}

// ── 플랫폼 시각적 병합 (Greedy Meshing): 인접한 동일 블록들을 하나의 큰 덩어리로 융합 ──
export function mergeVisualPlatforms(platforms) {
    const isMergeable = p => {
        if (p.type === 'diag_r' || p.type === 'diag_l' || p.type === 'goal' || p.type === 'save') return false;
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
     *   mapH: number,
     *   savePlatformY?: number|null
     * }} opts
     */
    constructor({ canvasW, canvasH, platforms, fans, traps, mapH, savePlatformY = null }) {
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
        this.savePlatformY = savePlatformY;

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

        // 스폰 / 세이브
        this.spawnPx = this.px;
        this.spawnPy = this.py;
        this.savepointUnlocked = false;
        this.saveX = this.px;
        this.saveY = this.py;

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
        const { HITBOX_W, HITBOX_H } = this;
        let x = sx, y = sy, lvx = svx, lvy = svy;
        for (let f = 1; f <= max; f++) {
            const prevBot = y + HITBOX_H;
            lvy += GRAVITY; x += lvx; y += lvy;
            x = this.wrapX(x);
            if (lvy > 0) {
                for (const p of this.platforms) {
                    if (p.broken) continue;
                    if (x + HITBOX_W <= p.x || x >= p.x + p.w) continue;
                    if (prevBot <= p.y && y + HITBOX_H >= p.y) return f;
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
        const avail  = Math.max(total - 18, 1);
        this.startFrameDur = Math.max((avail * (1000 / 60)) / SPRITE_INFO.start.frames, 8);
        this.standingOn    = null;
        this._changeState('start');
    }

    _handleMovement(keys) {
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

        if (Math.abs(this.px - prevX) < this.MAP_W / 2) {
            this._resolveWallCollisions(prevX, keys);
        }
        this._checkFallOff();
    }

    _checkFallOff() {
        const foot = this.py + this.HITBOX_H;
        for (const p of this.physPlatforms) {
            if (p.broken) continue;
            if (p.type === 'diag_r' || p.type === 'diag_l') continue;
            if (this.px + this.HITBOX_W <= p.x || this.px >= p.x + p.w) continue;
            if (Math.abs(foot - p.y) <= 4) return;
        }
        this.standingOn = null;
        this._changeState('start');
    }

    _resolveWallCollisions(prevX, keys) {
        const { HITBOX_W, HITBOX_H } = this;
        for (const p of this.physPlatforms) {
            if (p.broken) continue;
            if (p.type === 'diag_r' || p.type === 'diag_l') continue;
            if (this.py + HITBOX_H <= p.y || this.py >= p.y + p.h) continue;
            if (prevX + HITBOX_W <= p.x && this.px + HITBOX_W > p.x) {
                this.px = p.x - HITBOX_W; if (!keys['ArrowLeft']) this.vx = 0; break;
            }
            if (prevX >= p.x + p.w && this.px < p.x + p.w) {
                this.px = p.x + p.w; if (!keys['ArrowRight']) this.vx = 0; break;
            }
        }
    }

    _updatePhysics() {
        if (this.state !== 'start' && this.state !== 'end') return;

        this._applyFanForce();

        const prevX = this.px, prevY = this.py;
        this.vy += GRAVITY;
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

        for (const p of this.physPlatforms) {
            if (p.broken) continue;
            if (p.type === 'diag_r' || p.type === 'diag_l') continue;
            if (this.px + HITBOX_W <= p.x || this.px >= p.x + p.w) continue;
            if (this.py + HITBOX_H <= p.y || this.py >= p.y + p.h) continue;

            const prevBot = prevY + HITBOX_H;

            // 착지
            if (this.vy > 0 && prevBot <= p.y) {
                if (this.px + HITBOX_W - FOOT_OFFSET <= p.x || this.px + FOOT_OFFSET >= p.x + p.w) continue;
                this.py = p.y - HITBOX_H;
                if (p.gimmick !== 'ice') this.vx = 0;
                this.vy = 0;
                this.standingOn = p;
                if (this.state === 'start') this._changeState('end');
                if (this.savePlatformY !== null) {
                    if (p.type === 'save' || this.py + HITBOX_H < this.savePlatformY) {
                        this.savepointUnlocked = true;
                        this.saveX = this.px; this.saveY = this.py;
                    }
                }
                if (p.gimmick === 'breakable') p.standTimer = 0;
                if (p.type === 'goal') this.lastEvent = 'goal';
                return;
            }
            // 머리 박기
            if (this.vy < 0 && prevY >= p.y + p.h) {
                // 수평 겹침이 코너 마진 이내 → 옆으로 밀어서 코너 통과
                const hOvlp = Math.min(this.px + HITBOX_W - p.x, p.x + p.w - this.px);
                if (hOvlp > 0 && hOvlp <= this.CORNER_M) {
                    this.px += (this.px + HITBOX_W / 2 < p.x + p.w / 2)
                        ? -(hOvlp + 1) : (hOvlp + 1);
                    continue;
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
            if (this.vx > 0 && prevX + HITBOX_W - prevWOffset <= p.x) {
                // 수직 겹침이 코너 마진 이내 → 위/아래로 밀어서 코너 통과
                const vOvlp = Math.min(this.py + HITBOX_H - p.y, p.y + p.h - this.py);
                if (vOvlp > 0 && vOvlp <= this.CORNER_M) {
                    this.py += (this.py + HITBOX_H / 2 < p.y + p.h / 2)
                        ? -(vOvlp + 1) : (vOvlp + 1);
                    continue;
                }
                this.px = p.x - HITBOX_W + wOffset; this.vx = -Math.abs(this.vx) * 0.5; continue;
            }
            // 왼쪽 벽
            if (this.vx < 0 && prevX + prevWOffset >= p.x + p.w) {
                const vOvlp = Math.min(this.py + HITBOX_H - p.y, p.y + p.h - this.py);
                if (vOvlp > 0 && vOvlp <= this.CORNER_M) {
                    this.py += (this.py + HITBOX_H / 2 < p.y + p.h / 2)
                        ? -(vOvlp + 1) : (vOvlp + 1);
                    continue;
                }
                this.px = p.x + p.w - wOffset; this.vx = Math.abs(this.vx) * 0.5; continue;
            }
        }

        this._checkTrapCollision();

        if (this.py > this.MAP_H) this._respawn();
    }

    _checkTrapCollision() {
        const { HITBOX_W, HITBOX_H } = this;
        for (const t of this.traps) {
            if (this.px + HITBOX_W <= t.x || this.px >= t.x + t.w) continue;
            if (this.py + HITBOX_H <= t.y || this.py >= t.y + t.h) continue;
            this.vx = t.bounceVX; this.vy = t.bounceVY;
            if (this.state !== 'start') this._changeState('start');
            return;
        }
    }

    _applyFanForce() {
        const cx = this.px + this.HITBOX_W / 2;
        const cy = this.py + this.HITBOX_H / 2;
        for (const f of this.fans) {
            const fx = f.x + f.w / 2, fy = f.y + f.h / 2;
            const dist = Math.sqrt((cx - fx) ** 2 + (cy - fy) ** 2);
            if (dist < f.range) {
                const k = 1 - dist / f.range;
                this.vx += f.windX * k;
                this.vy += f.windY * k;
            }
        }
    }

    _respawn() {
        if (this.savepointUnlocked) {
            this.px = this.saveX; this.py = this.saveY;
        } else {
            this.px = this.spawnPx; this.py = this.spawnPy;
        }
        this.vx = 0; this.vy = 0;
        this.standingOn = null;
        this._changeState('stand');
        this.lastEvent = 'respawn';
    }

    _checkEndTransition() {
        if (this.state !== 'start' || this.vy < 0) return;
        if (this._framesUntilLanding(this.px, this.py, this.vx, this.vy, 18) <= 18) {
            this._changeState('end');
        }
    }

    _updateGimmicks(dt) {
        this.onMovingDelta.x = 0;
        this.onMovingDelta.y = 0;

        for (const p of this.platforms) {
            if (p.gimmick === 'breakable') {
                if (p.broken) {
                    p.respawnTimer += dt;
                    if (p.respawnTimer >= 10000) {
                        p.broken = false; p.respawnTimer = 0; p.standTimer = 0;
                    }
                } else if (this.standingOn === p) {
                    p.standTimer += dt;
                    if (p.standTimer >= 5000) {
                        p.broken = true; p.respawnTimer = 0;
                        this.standingOn = null;
                        if (this.state === 'stand' || this.state === 'run') {
                            this.vx = 0; this.vy = 0; this._changeState('start');
                        }
                    }
                } else {
                    p.standTimer = Math.max(0, p.standTimer - dt * 0.3);
                }
            }

            if (p.gimmick === 'moving') {
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
                else this._changeState('stand');
                break;
        }
    }

    _updateCamera() {
        const target = this.py - this.CANVAS_H / 2 + this.HITBOX_H / 2;
        this.cameraY += (target - this.cameraY) * 0.12;
        this.cameraY  = Math.max(0, Math.min(this.MAP_H - this.CANVAS_H, this.cameraY));
    }
}
