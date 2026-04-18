import { SPRITE_INFO } from './constants.js';
import { themeAt } from './stage_themes.js';
import { initTextures } from './texture_builder.js';
import { drawBackground } from './background.js';
import { drawHUD } from './hud.js';

// 플랫폼 렌더링 분기 판정용 상수 (매 프레임 재할당 방지)
const STRAIGHT_TEX = new Set(['wood', 'cloth', 'metal']);
const SKIP_BORDER_TEX = new Set(['goal', 'save', 'ice', 'breakable']);
const SKIP_BORDER_TYPE = new Set(['goal', 'save']);

// ── 렌더러 ────────────────────────────────────────────────────────────────────
export class Renderer {
    /**
     * @param {{
     *   canvas: HTMLCanvasElement,
     *   engine: import('./engine.js').GameEngine,
     *   spritesBasePath?: string,
     *   mode?: 'game' | 'editor'
     * }} opts
     */
    constructor({ canvas, engine, spritesBasePath = 'assets/sprites/', mode = 'game' }) {
        this.canvas   = canvas;
        this.ctx      = canvas.getContext('2d');
        this.engine   = engine;
        this.basePath = spritesBasePath;
        this.mode     = mode;
        this.bitmaps  = {};
        this._textures = {};
        this._wallTextures = {};

        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this._texturesReady = false;
    }

    // ── 텍스처·파티클 초기화 ─────────────────────────────────────────────────
    _initTextures() {
        const bundle = initTextures(this.ctx, this.canvas.width);
        this._textures     = bundle.textures;
        this._wallTextures = bundle.wallTextures;
        this._stars        = bundle.stars;
        this._clouds       = bundle.clouds;
        this._trees        = bundle.trees;
        this._leaves       = bundle.leaves;
    }

    // ── 스프라이트 및 배경 로딩 ──────────────────────────────────────────────
    async loadSprites() {
        const names = Object.keys(SPRITE_INFO);
        const imgs  = await Promise.all(names.map(name => new Promise(resolve => {
            const img = new Image();
            img.onload  = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = `${this.basePath}${name}.png`;
        })));
        await Promise.all(names.map(async (name, i) => {
            if (imgs[i]) this.bitmaps[name] = await createImageBitmap(imgs[i]);
        }));

        this.bgImages = [];
        const bgPromises = [];
        for (let i = 1; i <= 8; i++) {
            bgPromises.push(new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = `assets/bg/bg_stage_${i}.png`;
            }));
        }
        this.bgImages = await Promise.all(bgPromises);
    }

    // ── GPU 워밍 ──────────────────────────────────────────────────────────────
    async preWarm() {
        const { ctx, engine } = this;
        for (const name of Object.keys(SPRITE_INFO)) {
            const { frames, fw, fh } = SPRITE_INFO[name];
            if (!this.bitmaps[name]) continue;
            for (let f = 0; f < frames; f++) {
                ctx.drawImage(this.bitmaps[name], f * fw, 0, fw, fh, 0, 0, engine.CHAR_W, engine.CHAR_H);
            }
        }
        await new Promise(resolve => requestAnimationFrame(resolve));
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ── 전체 렌더 ─────────────────────────────────────────────────────────────
    render() {
        if (!this._texturesReady) {
            try {
                this._initTextures();
                this._texturesReady = true;
            } catch (e) {
                console.error('[Renderer] texture init failed:', e);
                this._texturesReady = true;
            }
        }
        drawBackground(this);
        this._drawPlatforms();
        this._drawFans();
        this._drawTraps();
        this._drawCharacter();
        drawHUD(this);
    }

    _getStageTex(worldY) {
        const { stages } = this.engine;
        if (stages && stages.length > 0) return themeAt(worldY, stages).tex;
        if (worldY > 5900) return 'wood';
        if (worldY > 5100) return 'cloth';
        if (worldY > 4300) return 'metal';
        if (worldY > 3500) return 'circus';
        if (worldY > 2700) return 'dirt';
        if (worldY > 1900) return 'branch';
        if (worldY > 1100) return 'cloud';
        return 'meteor';
    }

    _getPlatTexKey(p) {
        if (p.gimmick === 'ice')       return 'ice';
        if (p.gimmick === 'breakable') return 'breakable';
        return this._getStageTex(p.y);
    }

    // ── 플랫폼 색상 (특수 타입·기믹용) ────────────────────────────────────────
    _getPlatColors(p) {
        const { engine } = this;
        if (p.type === 'floor') return { base: '#663300', top: '#885522', edge: '#cc9944' };
        if (p.type === 'goal')  return { base: '#ccaa00', top: '#ffdd44', edge: '#ffffff' };
        if (p.type === 'save')  return {
            base: engine.savepointUnlocked ? '#006633' : '#004422',
            top:  engine.savepointUnlocked ? '#00cc66' : '#007744',
            edge: '#aaffcc',
        };
        if (p.gimmick === 'breakable') {
            const r = Math.min(p.standTimer / 5000, 1);
            if (r < 0.33) return { base: '#556677', top: '#7799aa', edge: '#aabbcc' };
            if (r < 0.66) return { base: '#886600', top: '#ccaa00', edge: '#ffdd66' };
            return               { base: '#882200', top: '#cc4400', edge: '#ff8844' };
        }
        const { stages } = engine;
        if (stages && stages.length > 0) return themeAt(p.y, stages).plat;
        const y = p.y;
        if (y > 5900) return { base: '#554433', top: '#776655', edge: '#998877' };
        if (y > 5100) return { base: '#770011', top: '#aa0022', edge: '#dd4455' };
        if (y > 4300) return { base: '#334455', top: '#556677', edge: '#99aabb' };
        if (y > 3500) return { base: '#881100', top: '#cc2200', edge: '#ffcc44' };
        if (y > 2700) return { base: '#225511', top: '#337722', edge: '#77cc55' };
        if (y > 1900) return { base: '#1a4410', top: '#2a6618', edge: '#66aa44' };
        if (y > 1100) return { base: '#99bbcc', top: '#bbddee', edge: '#eef6ff' };
        return               { base: '#112233', top: '#223355', edge: '#6688bb' };
    }

    _getAdjacency(p) {
        const { platforms } = this.engine;
        return {
            hasTop:   platforms.some(o => o !== p && !o.broken && o.x < p.x + p.w && o.x + o.w > p.x && Math.abs(o.y + o.h - p.y) <= 2),
            hasBottom:platforms.some(o => o !== p && !o.broken && o.x < p.x + p.w && o.x + o.w > p.x && Math.abs(o.y - (p.y + p.h)) <= 2),
            hasLeft:  platforms.some(o => o !== p && !o.broken && o.y < p.y + p.h && o.y + o.h > p.y && Math.abs(o.x + o.w - p.x) <= 2 && o.type !== 'diag_l'),
            hasRight: platforms.some(o => o !== p && !o.broken && o.y < p.y + p.h && o.y + o.h > p.y && Math.abs(o.x - (p.x + p.w)) <= 2 && o.type !== 'diag_r')
        };
    }

    // ── 플랫폼 ────────────────────────────────────────────────────────────────
    _drawPlatforms() {
        const { ctx, engine } = this;
        const { platforms, cameraY, CANVAS_H } = engine;
        const visiblePlats = [];

        for (const p of platforms) {
            if (p.broken) continue;
            const sy = p.y - cameraY;
            if (sy + p.h < 0 || sy > CANVAS_H) continue;
            p._adj = this._getAdjacency(p);
            visiblePlats.push(p);
        }

        // ── 이동 발판 경로 ──
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.setLineDash([6, 6]);
        for (const p of visiblePlats) {
            if (p.gimmick === 'moving') {
                ctx.beginPath();
                if (p.startX !== undefined && p.endX !== undefined) {
                    ctx.moveTo(p.startX + p.w / 2, p.startY - cameraY + p.h / 2);
                    ctx.lineTo(p.endX + p.w / 2, p.endY - cameraY + p.h / 2);
                } else if (p.moveAxis === 'x') {
                    const sy = p.y - cameraY;
                    const pathY = sy + p.h / 2;
                    const startX = p.moveMin + p.w / 2;
                    const endX = p.moveMax + p.w / 2;
                    ctx.moveTo(startX, pathY);
                    ctx.lineTo(endX, pathY);
                } else if (p.moveAxis === 'y') {
                    const pathX = p.x + p.w / 2;
                    const startY = p.moveMin - cameraY + p.h / 2;
                    const endY = p.moveMax - cameraY + p.h / 2;
                    ctx.moveTo(pathX, startY);
                    ctx.lineTo(pathX, endY);
                }
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';

        // ── 불규칙 외곽선 헬퍼 ──
        const jaggedLineTo = (x1, y1, x2, y2, wx1, wy1, wx2, wy2, isExposed, isStraight = false) => {
            if (!isExposed || isStraight) {
                ctx.lineTo(x2, y2);
                return;
            }
            const dist = Math.hypot(x2 - x1, y2 - y1);
            if (dist < 1) { ctx.lineTo(x2, y2); return; }

            const steps = Math.max(1, Math.floor(dist / 8));
            const nx = -(y2 - y1) / dist, ny = (x2 - x1) / dist;

            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const cx = x1 + (x2 - x1) * t;
                const cy = y1 + (y2 - y1) * t;
                const cwx = wx1 + (wx2 - wx1) * t;
                const cwy = wy1 + (wy2 - wy1) * t;

                let noise = Math.sin(cwx * 0.08) * 4 + Math.sin(cwy * 0.08) * 4 + Math.sin((cwx - cwy) * 0.15) * 3;

                const edgeWeight = Math.sin(t * Math.PI);
                noise *= edgeWeight;

                ctx.lineTo(cx + nx * noise, cy + Math.abs(ny * noise));
            }
        };

        const tracePath = (p, px, py, sx, sy, adj, texKey) => {
            ctx.beginPath();
            const w = p.w, h = p.h;
            const L = sx - 0.5, R = sx + w + 0.5, T = sy - 0.5, B = sy + h + 0.5;
            const isStraight = STRAIGHT_TEX.has(texKey);

            if (p.type === 'diag_r') {
                ctx.moveTo(L, B);
                ctx.lineTo(sx, sy + h);
                ctx.lineTo(sx + w, sy);
                ctx.lineTo(R, T);
                jaggedLineTo(R, T, R, B, px + w, py, px + w, py + h, !adj.hasRight, isStraight);
                jaggedLineTo(R, B, L, B, px + w, py + h, px, py + h, !adj.hasBottom, isStraight);
            } else if (p.type === 'diag_l') {
                ctx.moveTo(L, T);
                ctx.lineTo(sx, sy);
                ctx.lineTo(sx + w, sy + h);
                ctx.lineTo(R, B);
                jaggedLineTo(R, B, L, B, px + w, py + h, px, py + h, !adj.hasBottom, isStraight);
                jaggedLineTo(L, B, L, T, px, py + h, px, py, !adj.hasLeft, isStraight);
            } else {
                ctx.moveTo(L, T);
                ctx.lineTo(R, T);
                jaggedLineTo(R, T, R, B, px + w, py, px + w, py + h, !adj.hasRight, isStraight);
                jaggedLineTo(R, B, L, B, px + w, py + h, px, py + h, !adj.hasBottom, isStraight);
                jaggedLineTo(L, B, L, T, px, py + h, px, py, !adj.hasLeft, isStraight);
            }
            ctx.closePath();
        };

        // ── 1. 내부 텍스처 채우기 패스 ──
        for (const p of visiblePlats) {
            const isMoving = p.gimmick === 'moving' && p.startX !== undefined;
            const px = isMoving ? p.startX : p.x;
            const py = isMoving ? p.startY : p.y;
            const sx = px, sy = py - cameraY;
            const fillSx = sx - 0.5, fillSy = sy - 0.5, fillW = p.w + 1, fillH = p.h + 1;

            ctx.save();
            if (isMoving) ctx.translate(p.x - p.startX, p.y - p.startY);

            if (p.type === 'goal' || p.type === 'save') {
                this._drawSpecialPlatform(p, sx, sy, p._adj, fillSx, fillSy, fillW, fillH);
                ctx.restore();
                continue;
            }

            const texKey = this._getPlatTexKey(p);
            const c = this._getPlatColors(p);

            if (p.type === 'wall' || p.type === 'floor' || p.type === 'normal' || p.type === 'diag_r' || p.type === 'diag_l') {
                if (['ice', 'breakable'].includes(texKey)) {
                   this._drawSpecialType(ctx, p, sx, sy, fillSx, fillSy, fillW, fillH, texKey, p._adj, c);
                } else {
                   tracePath(p, px, py, sx, sy, p._adj, texKey);
                   ctx.clip();
                   this._drawThemedWall(ctx, fillSx - 20, fillSy - 20, fillW + 40, fillH + 40, cameraY, texKey, c.base);
                }
            }
            ctx.restore();
        }

        // ── 1.5 측면/하단 테두리 패스 ──
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = 4;

        for (const p of visiblePlats) {
            const isMoving = p.gimmick === 'moving' && p.startX !== undefined;
            const px = isMoving ? p.startX : p.x;
            const py = isMoving ? p.startY : p.y;
            const sx = px, sy = py - cameraY;

            ctx.save();
            if (isMoving) ctx.translate(p.x - p.startX, p.y - p.startY);

            const adj = p._adj;
            const texKey = this._getPlatTexKey(p);

            if (SKIP_BORDER_TEX.has(texKey) || SKIP_BORDER_TYPE.has(p.type)) {
                ctx.restore();
                continue;
            }

            const w = p.w, h = p.h;
            const L = sx - 0.5, R = sx + w + 0.5, T = sy - 0.5, B = sy + h + 0.5;
            const isStraight = STRAIGHT_TEX.has(texKey);

            ctx.beginPath();
            let hasDrawn = false;
            let connected = false;

            if (!adj.hasRight && p.type !== 'diag_l') {
                ctx.moveTo(R, T);
                jaggedLineTo(R, T, R, B, px + w, py, px + w, py + h, true, isStraight);
                hasDrawn = true;
                connected = true;
            } else {
                connected = false;
            }

            if (!adj.hasBottom) {
                if (!connected) ctx.moveTo(R, B);
                jaggedLineTo(R, B, L, B, px + w, py + h, px, py + h, true, isStraight);
                hasDrawn = true;
                connected = true;
            } else {
                connected = false;
            }

            if (!adj.hasLeft && p.type !== 'diag_r') {
                if (!connected) ctx.moveTo(L, B);
                jaggedLineTo(L, B, L, T, px, py + h, px, py, true, isStraight);
                hasDrawn = true;
            }

            if (hasDrawn) ctx.stroke();
            ctx.restore();
        }

        // ── 2. 유기적인 둥근 상단 아웃라인 패스 ──
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const p of visiblePlats) {
            const sx = p.x, sy = p.y - cameraY;
            const texKey = this._getPlatTexKey(p);

            if (SKIP_BORDER_TEX.has(texKey) || SKIP_BORDER_TYPE.has(p.type)) continue;

            const c = this._getPlatColors(p);
            const tex = this._textures[texKey];

            const T = sy - 0.5;
            const pw = p.w, ph = p.h;

            const strokeLine = (x1, y1, x2, y2) => {
                ctx.beginPath(); ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);

                if (tex) {
                    const matrix = new DOMMatrix();
                    matrix.translateSelf(0, -cameraY);

                    const isMoving = p.gimmick === 'moving' && p.startX !== undefined;
                    if (isMoving) {
                        matrix.translateSelf(p.x - p.startX, p.y - p.startY);
                    }

                    if (y1 !== y2) {
                        const rot = (x1 < x2 && y1 > y2) ? -45 : 45;
                        matrix.translateSelf(p.x, p.y);
                        matrix.rotateSelf(rot);
                        matrix.translateSelf(-p.x, -p.y);
                    }
                    tex.setTransform(matrix);

                    ctx.filter = 'brightness(1.5)';
                    ctx.strokeStyle = tex; ctx.lineWidth = 10; ctx.stroke();
                    ctx.filter = 'none';
                } else {
                    ctx.strokeStyle = c.top; ctx.lineWidth = 10; ctx.stroke();
                }
            };

            if (p.type === 'diag_r') {
                strokeLine(sx, sy + ph, sx + pw, sy);
            } else if (p.type === 'diag_l') {
                strokeLine(sx, sy, sx + pw, sy + ph);
            } else {
                const topL = p.x, topR = p.x + p.w;
                const coveredRanges = [];
                for (const o of platforms) {
                    if (o === p || o.broken) continue;
                    if (Math.abs(o.y + o.h - p.y) > 2) continue;
                    if (o.x >= topR || o.x + o.w <= topL) continue;
                    coveredRanges.push([Math.max(topL, o.x), Math.min(topR, o.x + o.w)]);
                }
                coveredRanges.sort((a, b) => a[0] - b[0]);
                const merged = [];
                for (const r of coveredRanges) {
                    if (merged.length > 0 && r[0] <= merged[merged.length - 1][1]) {
                        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
                    } else {
                        merged.push([...r]);
                    }
                }
                const exposed = [];
                let cursor = topL;
                for (const [cl, cr] of merged) {
                    if (cl > cursor) exposed.push([cursor, cl]);
                    cursor = Math.max(cursor, cr);
                }
                if (cursor < topR) exposed.push([cursor, topR]);

                for (const [el, er] of exposed) {
                    strokeLine(el - 0.5, T, er + 0.5, T);
                }
            }
        }
    }

    _drawSpecialType(ctx, p, sx, sy, fillSx, fillSy, fillW, fillH, texKey, adj, c) {
        if (texKey === 'ice') {
            ctx.fillStyle = '#4499cc'; ctx.fillRect(fillSx, fillSy, fillW, fillH);
            ctx.fillStyle = '#88ccee';
            if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 3);
            ctx.fillStyle = '#ddf0ff';
            if (!adj.hasLeft)  ctx.fillRect(sx, sy, 3, p.h);
            if (!adj.hasRight) ctx.fillRect(sx + p.w - 3, sy, 3, p.h);
            this._drawIceCrystals(sx, sy, p.w, p.h);
        } else if (texKey === 'breakable') {
            ctx.fillStyle = c.base; ctx.fillRect(fillSx, fillSy, fillW, fillH);
            ctx.fillStyle = c.top;
            if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 4);
            ctx.fillStyle = c.edge;
            if (!adj.hasLeft)  ctx.fillRect(sx, sy, 4, p.h);
            if (!adj.hasRight) ctx.fillRect(sx + p.w - 4, sy, 4, p.h);
            this._drawBreakOverlay(p, sx, sy);
        }
    }

    _drawSpecialPlatform(p, sx, sy, adj, fillSx, fillSy, fillW, fillH) {
        const { ctx, engine } = this;
        const c = this._getPlatColors(p);

        if (p.type === 'goal') {
            ctx.fillStyle = c.base; ctx.fillRect(fillSx, fillSy, fillW, fillH);
            ctx.fillStyle = c.top;  ctx.fillRect(sx + 2, sy + 2, p.w - 4, 5);
            ctx.fillStyle = c.edge;
            ctx.font = 'bold 10px monospace';
            ctx.fillText('★ GOAL ★', sx + p.w / 2 - 30, sy + 11);

        } else if (p.type === 'save') {
            ctx.fillStyle = c.base; ctx.fillRect(fillSx, fillSy, fillW, fillH);
            ctx.fillStyle = c.top;
            if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 4);

            const fx = sx + p.w - 14, fy = sy + 2;
            ctx.fillStyle = engine.savepointUnlocked ? '#00ff88' : '#dddddd';
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + 8, fy + 4);
            ctx.lineTo(fx, fy + 8);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = c.edge;
            ctx.font = 'bold 10px monospace';
            ctx.fillText(engine.savepointUnlocked ? '✔ SAVE' : 'SAVE', sx + p.w / 2 - 20, sy + 11);
        }
    }

    _drawThemedWall(ctx, sx, sy, w, h, cameraY, texKey) {
        let wallTex = this._wallTextures[texKey];
        if (!wallTex) wallTex = this._wallTextures['wood'];

        const matrix = new DOMMatrix();
        matrix.translateSelf(0, -cameraY);
        wallTex.setTransform(matrix);

        ctx.fillStyle = wallTex;
        ctx.fillRect(sx, sy, w, h);
    }

    _drawIceCrystals(sx, sy, pw, ph) {
        const ctx = this.ctx;
        for (let ix = sx + 10; ix < sx + pw - 8; ix += 16) {
            const cx = ix + 3, cy = sy + ph / 2;
            ctx.strokeStyle = 'rgba(220,240,255,0.55)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
            ctx.moveTo(cx - 4, cy - 3); ctx.lineTo(cx + 4, cy + 3);
            ctx.moveTo(cx + 4, cy - 3); ctx.lineTo(cx - 4, cy + 3);
            ctx.stroke();
        }
    }

    _drawBreakOverlay(p, sx, sy) {
        if (p.standTimer <= 0) return;
        const ctx = this.ctx;
        const ratio = Math.min(p.standTimer / 5000, 1);
        ctx.strokeStyle = `rgba(255,80,0,${ratio})`;
        ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        ctx.strokeRect(sx + 2, sy + 2, p.w - 4, p.h - 4);
        ctx.setLineDash([]);
    }

    // ── 선풍기 ────────────────────────────────────────────────────────────────
    _drawFans() {
        const { ctx, engine } = this;
        const { fans, cameraY, CANVAS_H } = engine;
        for (const f of fans) {
            const sx = f.x, sy = f.y - cameraY;
            if (sy + f.h < 0 || sy > CANVAS_H) continue;
            ctx.fillStyle = '#222233'; ctx.fillRect(sx, sy, f.w, f.h);
            ctx.strokeStyle = '#6699bb'; ctx.lineWidth = 2;
            ctx.strokeRect(sx, sy, f.w, f.h);
            const cx2 = sx + f.w / 2, cy2 = sy + f.h / 2;
            ctx.strokeStyle = 'rgba(120,200,255,0.7)'; ctx.lineWidth = 1.5;
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(cx2 + f.windX * (i - 1) * 7, cy2 + f.windY * (i - 1) * 7);
                ctx.lineTo(cx2 + f.windX * i * 7,       cy2 + f.windY * i * 7);
                ctx.stroke();
            }
        }
    }

    // ── 함정 ─────────────────────────────────────────────────────────────────
    _drawTraps() {
        const { ctx, engine } = this;
        const { traps, cameraY, CANVAS_H } = engine;
        for (const t of traps) {
            const sx = t.x, sy = t.y - cameraY;
            if (sy + t.h < 0 || sy > CANVAS_H) continue;
            const cx2 = sx + t.w / 2, cy2 = sy + t.h / 2, r = t.w / 2;
            ctx.fillStyle = '#bb0000';
            ctx.beginPath();
            ctx.moveTo(cx2, cy2 - r); ctx.lineTo(cx2 + r, cy2);
            ctx.lineTo(cx2, cy2 + r); ctx.lineTo(cx2 - r, cy2);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ff5555'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#ff3333';
            const spike = r * 0.5;
            [
                [cx2, cy2 - r - spike, cx2 - 3, cy2 - r + 3, cx2 + 3, cy2 - r + 3],
                [cx2, cy2 + r + spike, cx2 - 3, cy2 + r - 3, cx2 + 3, cy2 + r - 3],
                [cx2 - r - spike, cy2, cx2 - r + 3, cy2 - 3, cx2 - r + 3, cy2 + 3],
                [cx2 + r + spike, cy2, cx2 + r - 3, cy2 - 3, cx2 + r - 3, cy2 + 3],
            ].forEach(([ax, ay, bx, by, ccx, ccy]) => {
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
                ctx.lineTo(ccx, ccy); ctx.closePath(); ctx.fill();
            });
            ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace';
            ctx.fillText('!', cx2 - 4, cy2 + 5);
        }
    }

    // ── 캐릭터 ────────────────────────────────────────────────────────────────
    _drawCharacter() {
        const { ctx, engine } = this;
        const { px, py, cameraY, state, animFrame, facingRight, debugHitbox } = engine;
        const { CHAR_W, CHAR_H, HITBOX_W, HITBOX_H, SPRITE_OX, SPRITE_OY } = engine;

        const bitmap = this.bitmaps[state];
        const scx    = px - SPRITE_OX;
        const scy    = py - SPRITE_OY - cameraY;

        if (bitmap) {
            const { fw, fh } = SPRITE_INFO[state];
            ctx.save();
            if (!facingRight) {
                ctx.translate(scx + CHAR_W, scy); ctx.scale(-1, 1);
                ctx.drawImage(bitmap, animFrame * fw, 0, fw, fh, 0, 0, CHAR_W, CHAR_H);
            } else {
                ctx.drawImage(bitmap, animFrame * fw, 0, fw, fh, scx, scy, CHAR_W, CHAR_H);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#ff8844';
            ctx.beginPath();
            ctx.moveTo(px, py - cameraY);
            ctx.lineTo(px + HITBOX_W, py - cameraY);
            ctx.lineTo(px + HITBOX_W - engine.FOOT_OFFSET, py - cameraY + HITBOX_H);
            ctx.lineTo(px + engine.FOOT_OFFSET, py - cameraY + HITBOX_H);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
            ctx.fillText(state, px + 2, py - cameraY + 14);
        }

        if (debugHitbox) {
            ctx.strokeStyle = 'rgba(255,80,80,0.85)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px, py - cameraY);
            ctx.lineTo(px + HITBOX_W, py - cameraY);
            ctx.lineTo(px + HITBOX_W - engine.FOOT_OFFSET, py - cameraY + HITBOX_H);
            ctx.lineTo(px + engine.FOOT_OFFSET, py - cameraY + HITBOX_H);
            ctx.closePath(); ctx.stroke();
        }
    }
}
