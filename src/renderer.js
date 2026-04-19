import { SPRITE_INFO, BREAKABLE_LIFETIME } from './constants.js';
import { themeAt, THEME_ORDER } from './stage_themes.js';
import { initTextures } from './texture_builder.js';
import { drawBackground } from './background.js';
import { drawHUD } from './hud.js';

// 플랫폼 렌더링 분기 판정용 상수 (매 프레임 재할당 방지)
const STRAIGHT_TEX = new Set(['wood', 'cloth', 'metal']);
const SKIP_BORDER_TEX = new Set(['goal', 'ice']);
const SKIP_BORDER_TYPE = new Set(['goal']);

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

        // 배경 이미지는 테마명으로 매핑 (bg_stage_1 = 바닥 테마, bg_stage_8 = 하늘 테마)
        this.bgImages = {};
        const themesBottomUp = [...THEME_ORDER].reverse(); // [stage, curtain, office, circus, forest, canopy, sky, space]
        const bgResults = await Promise.all(themesBottomUp.map((theme, i) => new Promise(resolve => {
            const img = new Image();
            img.onload  = () => resolve({ theme, img });
            img.onerror = () => resolve({ theme, img: null });
            img.src = `assets/bg/bg_stage_${i + 1}.png`;
        })));
        for (const { theme, img } of bgResults) {
            if (img) this.bgImages[theme] = img;
        }
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

    _updateBgSnapshot() {
        const W = this.canvas.width, H = this.canvas.height;
        if (!this._bgCanvas || this._bgCanvas.width !== W || this._bgCanvas.height !== H) {
            this._bgCanvas = document.createElement('canvas');
            this._bgCanvas.width = W;
            this._bgCanvas.height = H;
            this._bgCtx = this._bgCanvas.getContext('2d');
        }
        this._bgCtx.clearRect(0, 0, W, H);
        const savedCtx = this.ctx;
        this.ctx = this._bgCtx;
        try { drawBackground(this); } finally { this.ctx = savedCtx; }
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
        this._updateBgSnapshot();
        this.ctx.drawImage(this._bgCanvas, 0, 0);
        this._drawPlatforms();
        this._drawFans();
        this._drawTraps();
        this._drawSigns();
        this._drawCharacter();
        drawHUD(this);
    }

    _getStageTex(worldY) {
        return themeAt(worldY, this.engine.stages).tex;
    }

    _getPlatTexKey(p) {
        if (p.gimmick === 'ice')       return 'ice';
        return this._getStageTex(p.y);
    }

    // ── 플랫폼 색상 (특수 타입·기믹용) ────────────────────────────────────────
    _getPlatColors(p) {
        const { engine } = this;
        if (p.type === 'floor') return { base: '#663300', top: '#885522', edge: '#cc9944' };
        if (p.type === 'goal')  return { base: '#ccaa00', top: '#ffdd44', edge: '#ffffff' };
        if (p.gimmick === 'breakable') {
            const r = Math.min(p.standTimer / BREAKABLE_LIFETIME, 1);
            if (r < 0.33) return { base: '#556677', top: '#7799aa', edge: '#aabbcc' };
            if (r < 0.66) return { base: '#886600', top: '#ccaa00', edge: '#ffdd66' };
            return               { base: '#882200', top: '#cc4400', edge: '#ff8844' };
        }
        return themeAt(p.y, engine.stages).plat;
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

        // ── 이동 발판 경로 ── (발판 본체가 화면 밖이어도 경로가 걸치면 그린다)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.setLineDash([6, 6]);
        for (const p of platforms) {
            if (p.broken || p.gimmick !== 'moving') continue;
            let x1, y1, x2, y2;
            if (p.startX !== undefined && p.endX !== undefined) {
                x1 = p.startX + p.w / 2; y1 = p.startY + p.h / 2;
                x2 = p.endX   + p.w / 2; y2 = p.endY   + p.h / 2;
            } else if (p.moveAxis === 'x') {
                x1 = p.moveMin + p.w / 2; x2 = p.moveMax + p.w / 2;
                y1 = y2 = p.y + p.h / 2;
            } else if (p.moveAxis === 'y') {
                x1 = x2 = p.x + p.w / 2;
                y1 = p.moveMin + p.h / 2; y2 = p.moveMax + p.h / 2;
            } else continue;

            const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
            if (maxY - cameraY < 0 || minY - cameraY > CANVAS_H) continue;

            ctx.beginPath();
            ctx.moveTo(x1, y1 - cameraY);
            ctx.lineTo(x2, y2 - cameraY);
            ctx.stroke();
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

            if (p.type === 'goal') {
                this._drawSpecialPlatform(p, sx, sy, p._adj, fillSx, fillSy, fillW, fillH);
                ctx.restore();
                continue;
            }

            const texKey = this._getPlatTexKey(p);
            const c = this._getPlatColors(p);

            if (p.type === 'wall' || p.type === 'floor' || p.type === 'normal' || p.type === 'diag_r' || p.type === 'diag_l') {
                if (texKey === 'ice') {
                   this._drawSpecialType(ctx, p, sx, sy, fillSx, fillSy, fillW, fillH, texKey, p._adj);
                } else {
                   tracePath(p, px, py, sx, sy, p._adj, texKey);
                   ctx.clip();
                   this._drawThemedWall(ctx, fillSx - 20, fillSy - 20, fillW + 40, fillH + 40, cameraY, texKey, c.base);
                   if (p.gimmick === 'breakable') {
                       ctx.fillStyle = 'rgba(90, 20, 15, 0.35)';
                       ctx.fillRect(fillSx, fillSy, fillW, fillH);
                   }
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

        // ── Break 그룹 균열 오버레이 ──
        const processed = new Set();
        for (const p of platforms) {
            if (p.gimmick !== 'breakable' || !p.breakGroup) continue;
            if (processed.has(p.breakGroup)) continue;
            processed.add(p.breakGroup);

            let onScreen = false;
            for (const b of p.breakGroup) {
                if (b.broken) continue;
                const sy = b.y - cameraY;
                if (sy + b.h >= 0 && sy <= CANVAS_H) { onScreen = true; break; }
            }
            if (!onScreen) continue;
            this._drawBreakOverlay(p.breakGroup, cameraY);
        }
    }

    _drawSpecialType(ctx, p, sx, sy, fillSx, fillSy, fillW, fillH, texKey, adj) {
        if (texKey === 'ice') {
            ctx.fillStyle = '#4499cc'; ctx.fillRect(fillSx, fillSy, fillW, fillH);
            ctx.fillStyle = '#88ccee';
            if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 3);
            ctx.fillStyle = '#ddf0ff';
            if (!adj.hasLeft)  ctx.fillRect(sx, sy, 3, p.h);
            if (!adj.hasRight) ctx.fillRect(sx + p.w - 3, sy, 3, p.h);
            this._drawIceCrystals(sx, sy, p.w, p.h);
        }
    }

    _drawSpecialPlatform(p, sx, sy, adj, fillSx, fillSy, fillW, fillH) {
        const { ctx } = this;
        if (p.type === 'goal') {
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
            const grad = ctx.createLinearGradient(sx, sy, sx, sy + p.h);
            grad.addColorStop(0,    '#fff6b3');
            grad.addColorStop(0.45, '#ffd84a');
            grad.addColorStop(1,    '#b57a00');
            ctx.fillStyle = grad;
            ctx.fillRect(fillSx, fillSy, fillW, fillH);

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255, 240, 160, ${0.18 + pulse * 0.32})`;
            ctx.fillRect(fillSx, fillSy, fillW, fillH);
            ctx.restore();

            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillRect(sx + 2, sy + 2, p.w - 4, 3);

            ctx.strokeStyle = `rgba(255, 220, 120, ${0.4 + pulse * 0.5})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(fillSx + 1, fillSy + 1, fillW - 2, fillH - 2);
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

    _getBreakCracks(group) {
        if (!this._breakCracks) this._breakCracks = new Map();
        const id = group[0].breakId;
        if (this._breakCracks.has(id)) return this._breakCracks.get(id);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of group) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + p.w);
            maxY = Math.max(maxY, p.y + p.h);
        }
        const w = maxX - minX, h = maxY - minY;
        let s = (id + 1) * 9301 + 49297;
        const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

        const cracks = [];
        const nCracks = 12 + Math.floor(Math.max(w, h) / 20);
        for (let i = 0; i < nCracks; i++) {
            const sx = minX + rand() * w;
            const sy = minY + rand() * h;
            const baseAng = rand() * Math.PI * 2;
            const segs = 4 + Math.floor(rand() * 5);
            const segLen = 6 + rand() * 12;
            const pts = [{ x: sx, y: sy }];
            let a = baseAng, x = sx, y = sy;
            for (let j = 0; j < segs; j++) {
                a += (rand() - 0.5) * 1.0;
                x += Math.cos(a) * segLen;
                y += Math.sin(a) * segLen;
                pts.push({ x, y });
            }
            cracks.push(pts);
        }
        this._breakCracks.set(id, cracks);
        return cracks;
    }

    _drawBreakOverlay(group, cameraY) {
        const ctx = this.ctx;
        const active = group.filter(b => !b.broken);
        if (!active.length) return;
        const r = Math.min((active[0].standTimer || 0) / BREAKABLE_LIFETIME, 1);
        const cracks = this._getBreakCracks(group);

        ctx.save();
        ctx.beginPath();
        for (const b of active) {
            ctx.rect(b.x - 0.5, b.y - cameraY - 0.5, b.w + 1, b.h + 1);
        }
        ctx.clip();

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = 0.8;
        for (const pts of cracks) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y - cameraY);
            for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y - cameraY);
            ctx.stroke();
        }

        if (r > 0) {
            ctx.lineWidth = 1.2 + r * 2.5;
            const nActive = Math.ceil(cracks.length * r);
            for (let i = 0; i < nActive; i++) {
                const pts = cracks[i];
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y - cameraY);
                for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y - cameraY);
                ctx.stroke();
            }
        }

        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(this._bgCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';

        ctx.restore();
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

    // ── 선풍기 ────────────────────────────────────────────────────────────────
    // ── 화살표 안내판 (충돌 없음) ─────────────────────────────────────────────
    _drawSigns() {
        const { ctx, engine } = this;
        const { signs, cameraY, CANVAS_H } = engine;
        if (!signs || !signs.length) return;

        const DIR_ANG = {
            right: 0, down_right: Math.PI / 4, down: Math.PI / 2, down_left: Math.PI * 3 / 4,
            left: Math.PI, up_left: -Math.PI * 3 / 4, up: -Math.PI / 2, up_right: -Math.PI / 4,
        };

        for (const s of signs) {
            const sx = s.x, sy = s.y - cameraY;
            if (sy + s.h < 0 || sy > CANVAS_H) continue;
            const cx = sx + s.w / 2;
            const pad = 4;
            const bw = s.w - pad * 2, bh = s.h - pad * 2;

            // 기둥
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(cx - 2, sy + s.h * 0.55, 4, s.h * 0.45);

            // 판자
            ctx.fillStyle = '#c89a56';
            ctx.fillRect(sx + pad, sy + pad, bw, bh * 0.6);
            ctx.strokeStyle = '#6a4418'; ctx.lineWidth = 2;
            ctx.strokeRect(sx + pad, sy + pad, bw, bh * 0.6);

            // 화살표
            const ang = DIR_ANG[s.dir] ?? 0;
            const r = Math.min(bw, bh * 0.6) * 0.38;
            const acx = cx, acy = sy + pad + bh * 0.3;
            ctx.save();
            ctx.translate(acx, acy);
            ctx.rotate(ang);
            ctx.fillStyle = '#3a1a00';
            ctx.beginPath();
            ctx.moveTo(-r, -r * 0.28);
            ctx.lineTo( r * 0.35, -r * 0.28);
            ctx.lineTo( r * 0.35, -r * 0.55);
            ctx.lineTo( r,        0);
            ctx.lineTo( r * 0.35,  r * 0.55);
            ctx.lineTo( r * 0.35,  r * 0.28);
            ctx.lineTo(-r,         r * 0.28);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    _drawFans() {
        const { ctx, engine } = this;
        const { fans, cameraY, CANVAS_H } = engine;
        const now = performance.now();

        for (const f of fans) {
            const sx = f.x, sy = f.y - cameraY;

            const zx = f.zoneX ?? f.x, zy = f.zoneY ?? f.y;
            const zw = f.zoneW ?? f.w, zh = f.zoneH ?? f.h;
            const zsy = zy - cameraY;

            const dx = Math.sign(f.windX || 0);
            const dy = Math.sign(f.windY || 0);

            // ── 바람 영향 구역: 물결 애니메이션 ──
            if ((zsy + zh >= 0 && zsy <= CANVAS_H)) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(zx, zsy, zw, zh);
                ctx.clip();

                ctx.lineWidth = 2;
                ctx.lineCap = 'round';

                const alongX = dx !== 0;
                const L = alongX ? zw : zh;
                const W = alongX ? zh : zw;

                ctx.lineWidth = 2.5;

                const hash = (a, b) => {
                    let h = (a * 2654435761 + b * 1597334677) >>> 0;
                    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
                    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
                    h ^= h >>> 16;
                    return (h >>> 0) / 4294967296;
                };

                const nWaves = Math.max(6, Math.round(L / 30));
                const baseDashLen = Math.min(24, L * 0.18);
                const travelSpeed = 0.0011;
                const rawPhase = now * travelSpeed;
                const fanSeed = ((f.x * 73856093) ^ (f.y * 19349663)) >>> 0;

                for (let i = 0; i < nWaves; i++) {
                    const phaseOffset = hash(fanSeed + i, 0);
                    const phase_i = rawPhase + phaseOffset;
                    const cycleIdx = Math.floor(phase_i);
                    const prog = phase_i - cycleIdx;

                    let alpha;
                    if (prog < 0.1)       alpha = prog / 0.1;
                    else if (prog < 0.75) alpha = 1;
                    else                  alpha = (1 - prog) / 0.25;
                    if (alpha <= 0) continue;

                    const laneRand = hash(fanSeed + i, cycleIdx + 1);
                    const lenRand  = 0.45 + hash(fanSeed + i, cycleIdx + 2) * 0.85;
                    const dashLen  = baseDashLen * lenRand;

                    const alongStart = alongX
                        ? (dx > 0 ? zx + prog * L : zx + (1 - prog) * L)
                        : (dy > 0 ? zsy + prog * L : zsy + (1 - prog) * L);
                    const perpPos = (alongX ? zsy : zx) + (0.1 + laneRand * 0.8) * W;

                    ctx.strokeStyle = `rgba(170,225,255,${0.85 * alpha})`;
                    ctx.beginPath();
                    if (alongX) {
                        ctx.moveTo(alongStart, perpPos);
                        ctx.lineTo(alongStart + dx * dashLen, perpPos);
                    } else {
                        ctx.moveTo(perpPos, alongStart);
                        ctx.lineTo(perpPos, alongStart + dy * dashLen);
                    }
                    ctx.stroke();
                }

                ctx.restore();
            }

            // ── 대포 본체 ──
            if (sy + f.h < 0 || sy > CANVAS_H) continue;
            const cx = sx + f.w / 2, cy = sy + f.h / 2;
            const ang = Math.atan2(dy, dx);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang);

            const bodyW = f.w * 0.95, bodyH = f.h * 0.55;
            ctx.fillStyle = '#2a2a36';
            ctx.beginPath();
            ctx.ellipse(0, 0, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0a0a12';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 포신 하이라이트 띠
            ctx.strokeStyle = 'rgba(120,140,160,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-bodyW / 2 + 4, -bodyH / 2 + 3);
            ctx.lineTo(bodyW / 2 - 4, -bodyH / 2 + 3);
            ctx.stroke();

            // 총구 (앞쪽)
            const muzzleR = bodyH / 2 * 0.9;
            ctx.fillStyle = '#050508';
            ctx.beginPath();
            ctx.ellipse(bodyW / 2 - 2, 0, muzzleR * 0.5, muzzleR, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#6a6a80';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 총구 링
            ctx.strokeStyle = '#aaaabb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(bodyW / 2 - 1, 0, muzzleR * 0.55, muzzleR * 1.05, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();

            // 바퀴 (회전과 무관하게 아래쪽)
            ctx.fillStyle = '#1a1a22';
            ctx.beginPath();
            ctx.arc(cx - f.w * 0.25, cy + f.h * 0.3, f.h * 0.22, 0, Math.PI * 2);
            ctx.arc(cx + f.w * 0.25, cy + f.h * 0.3, f.h * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#55556a';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    }

    // ── 함정 (회전 톱날) ─────────────────────────────────────────────────────
    _drawTraps() {
        const { ctx, engine } = this;
        const { traps, cameraY, CANVAS_H } = engine;
        const rot = performance.now() * 0.012; // 회전 각속도

        for (const t of traps) {
            const sx = t.x, sy = t.y - cameraY;
            if (sy + t.h < 0 || sy > CANVAS_H) continue;
            const cx = sx + t.w / 2, cy = sy + t.h / 2;
            const r = Math.min(t.w, t.h) / 2;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rot);

            // 톱니 실루엣 (삼각 톱니 16개)
            const teeth = 16;
            const step = (Math.PI * 2) / teeth;
            const rIn = r * 0.78;
            ctx.beginPath();
            for (let i = 0; i < teeth; i++) {
                const a0 = i * step;
                const a1 = a0 + step * 0.4; // 톱니 끝 (뾰족)
                const a2 = a0 + step;
                const p0x = Math.cos(a0) * rIn,  p0y = Math.sin(a0) * rIn;
                const p1x = Math.cos(a1) * r,    p1y = Math.sin(a1) * r;
                const p2x = Math.cos(a2) * rIn,  p2y = Math.sin(a2) * rIn;
                if (i === 0) ctx.moveTo(p0x, p0y);
                ctx.lineTo(p1x, p1y);
                ctx.lineTo(p2x, p2y);
            }
            ctx.closePath();
            ctx.fillStyle = '#d8d8e0';
            ctx.fill();
            ctx.strokeStyle = '#20202a';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // 원반 본체
            const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, rIn);
            bodyGrad.addColorStop(0, '#aaaab4');
            bodyGrad.addColorStop(1, '#55555e');
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.arc(0, 0, rIn, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 방사형 스포크 (회전감)
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28);
                ctx.lineTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
                ctx.stroke();
            }

            // 중심 허브
            ctx.fillStyle = '#2a2a32';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6a6a78';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // 피 튀김 얼룩 (톱니 끝부분, 회전과 무관)
            ctx.fillStyle = 'rgba(180,20,20,0.55)';
            for (let i = 0; i < 3; i++) {
                const sa = (i * 2.1) + (performance.now() * 0.0003); // 살짝 느린 움직임
                const sr = r * (0.92 + (i % 2) * 0.06);
                ctx.beginPath();
                ctx.arc(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
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
