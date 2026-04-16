import { SPRITE_INFO, MAX_CHARGE } from './constants.js';
import { getStageBg } from './engine.js';

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

        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this._texturesReady = false;
    }

    // ── 텍스처·파티클 초기화 ─────────────────────────────────────────────────
    _initTextures() {
        // 결정론적 파티클 (황금각·소수 분포)
        this._stars = Array.from({ length: 120 }, (_, i) => ({
            x: (i * 137.508) % 960,
            y: (i * 97.3) % 700,
            r: (i % 3) * 0.5 + 0.5,
        }));
        this._clouds = Array.from({ length: 18 }, (_, i) => ({
            x: (i * 211) % 960,
            y: 1100 + (i * 173) % 800,
            w: 60 + (i * 37) % 80,
            h: 20 + (i * 23) % 20,
        }));
        this._trees = [80, 220, 450, 680, 850].map((tx, i) => ({
            x: tx,
            h: 120 + (i * 37) % 80,
            trunk: 10 + (i * 13) % 8,
        }));
        this._leaves = Array.from({ length: 40 }, (_, i) => ({
            x: (i * 173) % 960,
            y: (i * 113) % 700,
        }));

        // 텍스처 패턴 빌드
        this._buildWoodTexture();
        this._buildClothTexture();
        this._buildMetalTexture();
        this._buildCircusTexture();
        this._buildCircusBgPattern();
        this._buildDirtTexture();
        this._buildBranchTexture();
        this._buildCloudTexture();
        this._buildMeteorTexture();
    }

    _offscreen(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return [c, c.getContext('2d')];
    }

    _buildWoodTexture() {
        const [c, x] = this._offscreen(40, 14);
        x.fillStyle = '#4a2f1c'; x.fillRect(0, 0, 40, 14); 
        x.fillStyle = '#6b4226'; x.fillRect(0, 0, 40, 3); 
        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(0, 6); x.lineTo(40, 6); x.stroke();
        x.beginPath(); x.moveTo(0, 11); x.lineTo(40, 11); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(0, 7); x.lineTo(40, 7); x.stroke();
        this._textures.wood = this.ctx.createPattern(c, 'repeat');
    }

    _buildClothTexture() {
        const [c, x] = this._offscreen(40, 14);
        x.fillStyle = '#880011'; x.fillRect(0, 0, 40, 14);
        for (let i = 2; i < 40; i += 8) {
            x.fillStyle = 'rgba(0,0,0,0.3)';
            x.fillRect(i, 0, 3, 14);
            x.fillStyle = 'rgba(255,255,255,0.15)';
            x.fillRect(i+4, 0, 2, 14);
        }
        x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(0, 0, 40, 2);
        this._textures.cloth = this.ctx.createPattern(c, 'repeat');
    }

    _buildMetalTexture() {
        const [c, x] = this._offscreen(40, 14);
        x.fillStyle = '#334455'; x.fillRect(0, 0, 40, 14);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, 0, 40, 2);
        [[4, 4], [36, 4], [4, 10], [36, 10]].forEach(([bx, by]) => {
            x.fillStyle = '#556677';
            x.beginPath(); x.arc(bx, by, 2, 0, Math.PI * 2); x.fill();
            x.strokeStyle = '#7799aa'; x.lineWidth = 0.5; x.stroke();
        });
        this._textures.metal = this.ctx.createPattern(c, 'repeat');
    }

    _buildCircusTexture() {
        const [c, x] = this._offscreen(40, 14);
        const g = x.createLinearGradient(0, 0, 14, 0);
        g.addColorStop(0,     '#cc2200');
        g.addColorStop(0.499, '#cc2200');
        g.addColorStop(0.5,   '#aa8800');
        g.addColorStop(1,     '#aa8800');
        x.fillStyle = g; x.fillRect(0, 0, 40, 14);
        x.fillStyle = '#ccaa00'; x.fillRect(0, 0, 40, 2);
        this._textures.circus = this.ctx.createPattern(c, 'repeat');
    }

    _buildCircusBgPattern() {
        const [c, x] = this._offscreen(16, 16);
        x.fillStyle = '#cc2200'; x.fillRect(0, 0, 16, 16);
        x.fillStyle = '#880000'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
        this._textures.circusBg = this.ctx.createPattern(c, 'repeat');
    }

    _buildDirtTexture() {
        const [c, x] = this._offscreen(40, 14);
        x.fillStyle = '#3d2210'; x.fillRect(0, 0, 40, 14);
        x.fillStyle = '#337722'; x.fillRect(0, 0, 40, 4);
        [[8, 8], [22, 10], [34, 7]].forEach(([dx, dy]) => {
            x.fillStyle = 'rgba(0,0,0,0.3)';
            x.beginPath(); x.ellipse(dx, dy, 3, 2, 0, 0, Math.PI * 2); x.fill();
        });
        this._textures.dirt = this.ctx.createPattern(c, 'repeat');
    }

    _buildBranchTexture() {
        const [c, x] = this._offscreen(40, 14);
        x.fillStyle = '#5c3a1e'; x.fillRect(0, 0, 40, 14);
        [3, 7, 11].forEach(ly => {
            x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 1;
            x.beginPath(); x.moveTo(0, ly); x.lineTo(40, ly); x.stroke();
        });
        x.fillStyle = 'rgba(40,100,20,0.5)';
        [2, 8, 15, 24, 31, 38].forEach(mx => x.fillRect(mx, 0, 3, 2));
        this._textures.branch = this.ctx.createPattern(c, 'repeat');
    }

    _buildCloudTexture() {
        const [c, x] = this._offscreen(40, 14);
        x.fillStyle = '#eaf2f8'; x.fillRect(0, 0, 40, 14);
        x.fillStyle = '#ffffff';
        x.beginPath(); x.arc(10, 2, 8, 0, Math.PI*2); x.fill();
        x.beginPath(); x.arc(28, 0, 12, 0, Math.PI*2); x.fill();
        x.beginPath(); x.arc(44, 4, 10, 0, Math.PI*2); x.fill();
        x.fillStyle = 'rgba(100,150,200,0.25)';
        x.fillRect(0, 11, 40, 3);
        this._textures.cloud = this.ctx.createPattern(c, 'repeat');
    }

    _buildMeteorTexture() {
        const [c, x] = this._offscreen(40, 14);
        x.fillStyle = '#1a1829'; x.fillRect(0, 0, 40, 14);
        x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(0,0,40,2);
        [[10,6,3], [30,8,4], [22,3,2]].forEach(([cx,cy,r]) => {
            x.fillStyle = '#0a0912'; x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.fill();
            x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth=1; x.beginPath(); x.arc(cx+0.5,cy+0.5,r,0,Math.PI*2); x.stroke();
        });
        this._textures.meteor = this.ctx.createPattern(c, 'repeat');
    }

    // ── 스프라이트 로딩 ───────────────────────────────────────────────────────
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
                this._texturesReady = true; // 텍스처 없이 계속 진행
            }
        }
        this._drawBackground();
        this._drawPlatforms();
        this._drawFans();
        this._drawTraps();
        this._drawCharacter();
        this._drawHUD();
    }

    // ── 배경 ─────────────────────────────────────────────────────────────────
    _drawBackground() {
        const { ctx, canvas, engine, mode } = this;
        const W = canvas.width, H = canvas.height;
        const cameraY = engine.cameraY;
        const midWorld = cameraY + H / 2;

        if (mode === 'game') {
            const [c1, c2] = getStageBg(midWorld);
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, c1);
            grad.addColorStop(1, c2);
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = '#0d0d18';
        }
        ctx.fillRect(0, 0, W, H);

        if (mode === 'game') {
            this._drawStageDecorations(midWorld, cameraY, W, H);
        }
    }

    _drawStageDecorations(midWorld, cameraY, W, H) {
        const ctx = this.ctx;

        if (midWorld > 5900) {
            // Stage 1: 무대 단상 (스포트라이트와 기둥 실루엣)
            const g = ctx.createRadialGradient(W/2, -50, 10, W/2, -50, 600);
            g.addColorStop(0, 'rgba(255,255,200,0.12)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0,0,W,H);
            
            // 기둥 (시차 스크롤)
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            const off = (cameraY * 0.15) % 150;
            for(let x = -(off % 150); x < W + 150; x += 150) {
                ctx.fillRect(x, 0, 40, H);
                // 기둥 하이라이트
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(x + 4, 0, 5, H);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
            }


        } else if (midWorld > 5100) {
            // Stage 2: 커튼 실루엣
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, 32, H);
            ctx.fillRect(W - 32, 0, 32, H);
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            for (let cx = 6; cx <= 26; cx += 10) {
                ctx.beginPath(); ctx.arc(cx, H, 10, Math.PI, 0); ctx.fill();
            }
            for (let cx = W - 26; cx <= W - 6; cx += 10) {
                ctx.beginPath(); ctx.arc(cx, H, 10, Math.PI, 0); ctx.fill();
            }

        } else if (midWorld > 4300) {
            // Stage 3: 직원 사무실 테마 (블라인드 창틀 및 천장 형광등)
            const py = (cameraY * 0.15) % 200;
            
            // 거대 사무실 유리창(블라인드 느낌)
            ctx.fillStyle = 'rgba(120, 160, 200, 0.04)';
            for(let x = 60; x < W - 60; x += 180) {
                ctx.fillRect(x, 0, 140, H);
            }
            
            // 주기적인 가로선 (형광등/구조물 실루엣)
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            for(let y = -(py % 200); y < H + 200; y += 200) {
                ctx.fillRect(0, y, W, 8); // 빛 번짐
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(0, y + 2, W, 4); // 코어 빛
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(0, y - 20, W, 20); // 구조물 파이프 실루엣
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
            }

        } else if (midWorld > 3500) {
            // Stage 4: 사선 줄무늬 + 천막 봉우리
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = this._textures.circusBg;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
            // 천막 봉우리
            ctx.fillStyle = '#220000';
            const pitchW = W / 4;
            ctx.beginPath(); ctx.moveTo(0, 0);
            for (let i = 0; i < 4; i++) {
                ctx.lineTo(i * pitchW, 55);
                ctx.lineTo((i + 0.5) * pitchW, 0);
            }
            ctx.lineTo(W, 55); ctx.lineTo(W, 0);
            ctx.closePath(); ctx.fill();

        } else if (midWorld > 2700) {
            // Stage 5: 나무 실루엣 (화면 하단 고정)
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            const baseY = H + 10;
            for (const t of this._trees) {
                const topY = baseY - t.h;
                // 수관 (삼각형)
                ctx.beginPath();
                ctx.moveTo(t.x, topY);
                ctx.lineTo(t.x + t.trunk * 3.5, topY + t.h * 0.65);
                ctx.lineTo(t.x - t.trunk * 3.5, topY + t.h * 0.65);
                ctx.closePath(); ctx.fill();
                // 줄기
                ctx.fillRect(t.x - t.trunk / 2, topY + t.h * 0.65, t.trunk, t.h * 0.35);
            }

        } else if (midWorld > 1900) {
            // Stage 6: 잎사귀 파티클
            ctx.fillStyle = 'rgba(50,140,30,0.55)';
            const drift = (cameraY * 0.35) % H;
            for (const lf of this._leaves) {
                const sy = ((lf.y - drift) % H + H) % H;
                ctx.beginPath();
                ctx.ellipse(lf.x, sy, 3, 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }

        } else if (midWorld > 1100) {
            // Stage 7: 구름
            const parallax = cameraY * 0.4;
            ctx.fillStyle = 'rgba(200,220,255,0.14)';
            for (const cl of this._clouds) {
                const sy = cl.y - parallax;
                if (sy < -60 || sy > H + 60) continue;
                ctx.beginPath();
                ctx.ellipse(cl.x, sy, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }

        } else {
            // Stage 8: 별 (화면 고정) + 운석
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            for (const s of this._stars) {
                ctx.fillRect(s.x, s.y, s.r, s.r);
            }
            // 운석 꼬리 (시차 0.15x)
            const mParallax = (cameraY * 0.15) % (H + 200);
            const meteors = [
                { x: 720, y: 90,  ex: 420, ey: 240 },
                { x: 860, y: 195, ex: 660, ey: 295 },
            ];
            for (const m of meteors) {
                const sy  = m.y  - mParallax;
                const sey = m.ey - mParallax;
                if (sey < -10 && sy < -10) continue;
                const grad = ctx.createLinearGradient(m.x, sy, m.ex, sey);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,0.4)');
                ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(m.x, sy); ctx.lineTo(m.ex, sey); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.beginPath(); ctx.arc(m.ex, sey, 1.5, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    _getStageTex(worldY) {
        if (worldY > 5900) return 'wood';     // S1: 나무바닥
        if (worldY > 5100) return 'cloth';    // S2: 빨간천
        if (worldY > 4300) return 'metal';    // S3: 철제
        if (worldY > 3500) return 'circus';   // S4: 빨강금색
        if (worldY > 2700) return 'dirt';     // S5: 흙
        if (worldY > 1900) return 'branch';   // S6: 나뭇가지
        if (worldY > 1100) return 'cloud';    // S7: 구름
        return 'meteor';                      // S8: 운석
    }

    _getPlatTexKey(p) {
        if (p.gimmick === 'ice')       return 'ice';
        if (p.gimmick === 'moving')    return 'moving';
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
            hasLeft:  platforms.some(o => o !== p && !o.broken && o.y < p.y + p.h && o.y + o.h > p.y && Math.abs(o.x + o.w - p.x) <= 2 && o.type !== 'diag_l'),
            hasRight: platforms.some(o => o !== p && !o.broken && o.y < p.y + p.h && o.y + o.h > p.y && Math.abs(o.x - (p.x + p.w)) <= 2 && o.type !== 'diag_r')
        };
    }

    // ── 플랫폼 ────────────────────────────────────────────────────────────────
    _drawPlatforms() {
        const { ctx, engine } = this;
        const { platforms, cameraY, CANVAS_H } = engine;

        for (const p of platforms) {
            if (p.broken) continue;
            const sx = p.x, sy = p.y - cameraY;
            if (sy + p.h < 0 || sy > CANVAS_H) continue;

            const adj = this._getAdjacency(p);
            // 안티앨리어싱 틈새(실선) 방지를 위한 미세 오버랩 (+0.5px 팽창)
            const fillSx = sx - 0.5, fillSy = sy - 0.5, fillW = p.w + 1, fillH = p.h + 1;

            // 특수 타입
            if (p.type === 'goal' || p.type === 'save') {
                this._drawSpecialPlatform(p, sx, sy, adj, fillSx, fillSy, fillW, fillH);
                continue;
            }
            if (p.type === 'diag_r' || p.type === 'diag_l') {
                this._drawDiagPlatform(p, sx, sy);
                continue;
            }
            // Floor와 Wall 단일화 프로세스 (구버전 normal 포함)
            if (p.type === 'wall' || p.type === 'floor' || p.type === 'normal') {
                const texKey = this._getPlatTexKey(p);
                const tex = this._textures[texKey];
                const c = this._getPlatColors(p);

                // 1. 스테이지 식별자를 넘겨 8가지 개별 테마의 베이스 Wall 렌더링
                this._drawThemedWall(ctx, fillSx, fillSy, fillW, fillH, cameraY, texKey, c.base);

                // 2. 가장자리 음영
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                if (!adj.hasLeft)  ctx.fillRect(sx, sy, 3, p.h);
                if (!adj.hasRight) ctx.fillRect(sx + p.w - 3, sy, 3, p.h);

                // 3. 상단(허공과 닿은 면)에 무조건 Floor 패턴 렌더링
                if (!adj.hasTop) {
                    if (tex) {
                        // 텍스처 패턴일 때의 밝은 상단 표면층 (14px 두께)
                        tex.setTransform(new DOMMatrix().translate(0, -cameraY));
                        ctx.fillStyle = tex;
                        ctx.fillRect(fillSx, fillSy, fillW, 14); // 다크 오버레이를 가리고 밝은 텍스처로 덮기
                        
                        ctx.fillStyle = 'rgba(255,255,255,0.15)';
                        ctx.fillRect(sx, sy, p.w, 4); // 최상단 빛 반사
                        ctx.fillStyle = 'rgba(0,0,0,0.4)';
                        ctx.fillRect(sx, sy + 14, p.w, 1.5); // 지층 분리 그림자 선
                    } else {
                        // 색상 패턴일 때의 Floor
                        const c = this._getPlatColors(p);
                        ctx.fillStyle = c.base; ctx.fillRect(fillSx, fillSy, fillW, 14);
                        ctx.fillStyle = c.top;  ctx.fillRect(fillSx, fillSy, fillW, 4);
                        ctx.fillStyle = c.edge; 
                        ctx.fillRect(fillSx, fillSy, 3, 14); 
                        ctx.fillRect(sx + p.w - 3, fillSy, 3, 14);
                    }
                }
                continue;
            }

            // 일반 플랫폼: 스테이지 텍스처 또는 기믹 색상
            const texKey = this._getPlatTexKey(p);

            if (texKey === 'ice') {
                ctx.fillStyle = '#4499cc'; ctx.fillRect(fillSx, fillSy, fillW, fillH);
                ctx.fillStyle = '#88ccee';
                if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 3);
                ctx.fillStyle = '#ddf0ff';
                if (!adj.hasLeft)  ctx.fillRect(sx, sy, 3, p.h);
                if (!adj.hasRight) ctx.fillRect(sx + p.w - 3, sy, 3, p.h);
                this._drawIceCrystals(sx, sy, p.w, p.h);

            } else if (texKey === 'moving') {
                ctx.fillStyle = '#224488'; ctx.fillRect(fillSx, fillSy, fillW, fillH);
                ctx.fillStyle = '#3366aa'; ctx.fillRect(sx, sy, p.w, 4);
                ctx.fillStyle = '#88bbff';
                ctx.fillRect(sx, sy, 4, p.h); ctx.fillRect(sx + p.w - 4, sy, 4, p.h);
                this._drawMovingArrow(p, sx, sy);

            } else if (texKey === 'breakable') {
                const c = this._getPlatColors(p);
                ctx.fillStyle = c.base; ctx.fillRect(fillSx, fillSy, fillW, fillH);
                ctx.fillStyle = c.top;  
                if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 4);
                ctx.fillStyle = c.edge;
                if (!adj.hasLeft)  ctx.fillRect(sx, sy, 4, p.h);
                if (!adj.hasRight) ctx.fillRect(sx + p.w - 4, sy, 4, p.h);
                this._drawBreakOverlay(p, sx, sy);

            } else if (this._textures[texKey]) {
                const tex = this._textures[texKey];
                tex.setTransform(new DOMMatrix().translate(0, -cameraY));
                ctx.fillStyle = tex;
                ctx.fillRect(fillSx, fillSy, fillW, fillH);
                
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 2);
                
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                if (!adj.hasLeft)  ctx.fillRect(sx, sy, 3, p.h);
                if (!adj.hasRight) ctx.fillRect(sx + p.w - 3, sy, 3, p.h);

            } else {
                const c = this._getPlatColors(p);
                ctx.fillStyle = c.base; ctx.fillRect(fillSx, fillSy, fillW, fillH);
                ctx.fillStyle = c.top;
                if (!adj.hasTop) ctx.fillRect(sx, sy, p.w, 4);
                ctx.fillStyle = c.edge;
                if (!adj.hasLeft)  ctx.fillRect(sx, sy, 4, p.h);
                if (!adj.hasRight) ctx.fillRect(sx + p.w - 4, sy, 4, p.h);
            }
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
            
            // 깃발 아이콘
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

    _drawDiagPlatform(p, sx, sy) {
        const { ctx, engine } = this;
        const texKey = this._getPlatTexKey(p);
        const tex = this._textures[texKey];
        const c = this._getPlatColors(p);

        ctx.save();
        ctx.beginPath();
        if (p.type === 'diag_r') {
            ctx.moveTo(sx - 0.5, sy + p.h + 0.5); 
            ctx.lineTo(sx, sy + p.h); 
            ctx.lineTo(sx + p.w, sy); 
            ctx.lineTo(sx + p.w + 0.5, sy - 0.5);
            ctx.lineTo(sx + p.w + 0.5, sy + p.h + 0.5);
        } else { // diag_l
            ctx.moveTo(sx - 0.5, sy - 0.5); 
            ctx.lineTo(sx, sy);
            ctx.lineTo(sx + p.w, sy + p.h);
            ctx.lineTo(sx + p.w + 0.5, sy + p.h + 0.5);
            ctx.lineTo(sx - 0.5, sy + p.h + 0.5);
        }
        ctx.closePath();
        ctx.clip(); // 사선 바깥으로 픽셀이 튀어나가지 않도록 제한 (물리 충돌선 완벽 일치)

        // 1. 아랫쪽은 8종류의 개별 테마 Wall 구조 렌더링
        this._drawThemedWall(ctx, sx - 1, sy - 1, p.w + 2, p.h + 2, engine.cameraY, texKey, c.base);

        // 2. 사선 방향 표면에 두꺼운 Floor 지층 그리기 (이음새가 완벽히 연결되도록 선분 확장)
        ctx.beginPath();
        const ext = 20; 
        if (p.type === 'diag_r') {
            ctx.moveTo(sx - ext, sy + p.h + ext);
            ctx.lineTo(sx + p.w + ext, sy - ext);
        } else {
            ctx.moveTo(sx - ext, sy - ext);
            ctx.lineTo(sx + p.w + ext, sy + p.h + ext);
        }

        ctx.lineCap = 'butt'; // 끝을 각지게 만들어 클리핑 시 빈틈 발생 원천 차단


        if (tex) {
            // 텍스처 패턴일 때의 밝은 사선 표면층 (14px 노출)
            tex.setTransform(new DOMMatrix().translate(0, -engine.cameraY));
            ctx.strokeStyle = tex;
            ctx.lineWidth = 28; // 반으로 잘리므로 실제 노출 14px
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 8; // 실제 노출 4px (최상단 빛 반사)
            ctx.stroke();
            
            // 지층 분리용 예리한 경계선
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            // 색상 기반일 때의 사선 Floor 층
            const floorC = this._getPlatColors(p);
            ctx.strokeStyle = floorC.base;
            ctx.lineWidth = 28;
            ctx.stroke();

            ctx.strokeStyle = floorC.top;
            ctx.lineWidth = 8;
            ctx.stroke();

            ctx.strokeStyle = floorC.edge;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.restore();
    }

    // ── 새로 8개 테마로 분리된 프로시저럴 Wall 렌더링 ──
    _drawThemedWall(ctx, sx, sy, w, h, cameraY, texKey, baseHue) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx, sy, w, h);
        ctx.clip(); // 폴리곤 영역 외곽 벗어남 방지
        
        switch(texKey) {
            case 'wood':   this._drawMarbleWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            case 'cloth':  this._drawWoodWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            case 'metal':  this._drawSteelWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            case 'circus': this._drawWoodWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            case 'dirt':   this._drawRootWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            case 'branch': this._drawBarkWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            case 'cloud':  this._drawCloudWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            case 'meteor': this._drawObsidianWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
            default:       this._drawMarbleWall(ctx, sx, sy, w, h, cameraY, baseHue); break;
        }

        ctx.restore();
    }

    _drawMarbleWall(ctx, sx, sy, w, h, cy, baseHue) {
        // Stage 1: 매끈한 대리석 Wall (크고 넓은 직사각형 타일, 부드러운 반사)
        ctx.fillStyle = '#0f111a'; ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        const bw = 80, bh = 40;
        const startX = Math.floor(sx / bw) * bw - bw;
        const startY = Math.floor((sy + cy) / bh) * bh - bh - cy;
        for (let y = startY; y < sy + h + bh; y += bh) {
            const offsetX = (Math.abs(Math.floor((y + cy)/bh)) % 2 === 1) ? bw/2 : 0;
            for (let x = startX - offsetX; x < sx + w + bw; x += bw) {
                // 부드러운 엠보싱 / 대리석 질감
                const grad = ctx.createLinearGradient(x, y, x+bw, y+bh);
                grad.addColorStop(0, 'rgba(255,255,255,0.08)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(x, y, bw, bh);
                ctx.strokeRect(x, y, bw, bh);
            }
        }
    }

    _drawWoodWall(ctx, sx, sy, w, h, cy, baseHue) {
        // Stage 2/4: 투박한 나무 기둥 Wall (세로형 강한 결)
        ctx.fillStyle = '#1e100a'; ctx.fillRect(sx, sy, w, h);
        const bw = 30;
        const startX = Math.floor(sx / bw) * bw - bw;
        for (let x = startX; x < sx + w + bw; x += bw) {
            ctx.fillStyle = (Math.abs(Math.floor(x/bw))%2===0) ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.3)';
            ctx.fillRect(x, sy, bw, h);
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy+h); ctx.stroke();
            // 나무 결 잔선들
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x+8, sy); ctx.lineTo(x+8, sy+h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x+22, sy); ctx.lineTo(x+22, sy+h); ctx.stroke();
        }
    }

    _drawSteelWall(ctx, sx, sy, w, h, cy, baseHue) {
        // Stage 3: 철제 Wall (강철 패널과 거대 리벳)
        ctx.fillStyle = '#1a1f24'; ctx.fillRect(sx, sy, w, h);
        const bw = 60, bh = 60;
        const startX = Math.floor(sx / bw) * bw - bw;
        const startY = Math.floor((sy + cy) / bh) * bh - bh - cy;
        for (let y = startY; y < sy + h + bh; y += bh) {
            for (let x = startX; x < sx + w + bw; x += bw) {
                ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2;
                ctx.strokeRect(x, y, bw, bh);
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(x+1, y+1, bw-2, 2);
                // 모서리 4개 리벳 자국
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                [[6,6],[bw-6,6],[6,bh-6],[bw-6,bh-6]].forEach(([rx,ry]) => {
                    ctx.beginPath(); ctx.arc(x+rx, y+ry, 2, 0, Math.PI*2); ctx.fill();
                });
            }
        }
    }

    _drawRootWall(ctx, sx, sy, w, h, cy, baseHue) {
        // Stage 5: 흙과 뒤엉킨 나무 뿌리 Wall
        ctx.fillStyle = '#140c06'; ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = '#0a0502'; ctx.lineWidth = 8;
        const startY = Math.floor((sy + cy) / 45) * 45 - 45 - cy;
        for(let y = startY; y < sy + h + 90; y += 45) {
            ctx.beginPath();
            ctx.moveTo(sx, y);
            const wave = Math.sin((y+cy)*0.1)*15;
            ctx.quadraticCurveTo(sx+w/2, y+wave, sx+w, y-(wave*0.5));
            ctx.stroke();
            // 뿌리 내부 하이라이트/질감
            ctx.strokeStyle = '#24140a'; ctx.lineWidth = 2;
            ctx.stroke();
            ctx.strokeStyle = '#0a0502'; ctx.lineWidth = 8;
        }
    }

    _drawBarkWall(ctx, sx, sy, w, h, cy, baseHue) {
        // Stage 6: 거대한 수직 세계수 껍질 Wall
        ctx.fillStyle = '#18120d'; ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = '#0c0805'; ctx.lineWidth = 4;
        const startX = Math.floor(sx / 15) * 15 - 15;
        for(let x = startX; x < sx + w + 20; x += 15) {
            ctx.beginPath();
            ctx.moveTo(x, sy);
            const drift = Math.sin((x+cy)*0.05)*10;
            ctx.quadraticCurveTo(x+drift, sy+h/2, x, sy+h);
            ctx.stroke();
        }
    }

    _drawCloudWall(ctx, sx, sy, w, h, cy, baseHue) {
        // Stage 7: 부드러운 안개 및 밀도 높은 구름 기둥 Wall
        const g = ctx.createLinearGradient(sx, sy, sx, sy+h);
        g.addColorStop(0, 'rgba(180, 210, 255, 0.45)');
        g.addColorStop(1, 'rgba(100, 150, 220, 0.05)');
        ctx.fillStyle = g;
        ctx.fillRect(sx, sy, w, h);
        
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        const startY = Math.floor((sy + cy) / 80) * 80 - 80 - cy;
        for(let y=startY; y<sy+h+100; y+=80) {
            ctx.beginPath();
            ctx.ellipse(sx+w/2, y, w*0.8, 45, 0, 0, Math.PI*2);
            ctx.fill();
        }
    }

    _drawObsidianWall(ctx, sx, sy, w, h, cy, baseHue) {
        // Stage 8: 날카로운 우주 암석(흑요석) Wall
        ctx.fillStyle = '#050508'; ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1.5;
        const bw = 50, bh = 50;
        const startX = Math.floor(sx / bw) * bw - bw;
        const startY = Math.floor((sy + cy) / bh) * bh - bh - cy;
        for(let y=startY; y<sy+h+bh; y+=bh) {
            for(let x=startX; x<sx+w+bw; x+=bw) {
                // 비정형 사선 기하학 무늬
                ctx.beginPath();
                ctx.moveTo(x, y); ctx.lineTo(x+bw, y+bh);
                ctx.moveTo(x+bw, y); ctx.lineTo(x, y+bh);
                ctx.stroke();
            }
        }
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

    _drawMovingArrow(p, sx, sy) {
        const ctx = this.ctx;
        ctx.fillStyle = '#88bbff';
        const mid = sx + p.w / 2;
        ctx.beginPath();
        if (p.moveAxis === 'x') {
            const d = p.moveDir;
            ctx.moveTo(mid + d * 14, sy + 7);
            ctx.lineTo(mid - d * 6,  sy + 3);
            ctx.lineTo(mid - d * 6,  sy + 11);
        } else {
            const d = p.moveDir;
            ctx.moveTo(mid,     sy + 7 + d * 5);
            ctx.lineTo(mid - 5, sy + 7 - d * 3);
            ctx.lineTo(mid + 5, sy + 7 - d * 3);
        }
        ctx.fill();
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
            // 다이아몬드
            ctx.fillStyle = '#bb0000';
            ctx.beginPath();
            ctx.moveTo(cx2, cy2 - r); ctx.lineTo(cx2 + r, cy2);
            ctx.lineTo(cx2, cy2 + r); ctx.lineTo(cx2 - r, cy2);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ff5555'; ctx.lineWidth = 2; ctx.stroke();
            // 가시 삼각형 4개
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

    // ── HUD ──────────────────────────────────────────────────────────────────
    _drawHUD() {
        const { ctx, canvas, engine, mode } = this;
        const {
            px, py, cameraY, state, chargeStart, savepointUnlocked,
            MAP_H, HITBOX_W, SPRITE_OY,
        } = engine;

        // 우측 진행도 바
        const prog = 1 - (py / MAP_H);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(canvas.width - 16, 8, 8, canvas.height - 16);
        ctx.fillStyle = '#ffdd44';
        const bh = (canvas.height - 16) * prog;
        ctx.fillRect(canvas.width - 16, canvas.height - 8 - bh, 8, bh);

        if (mode === 'game') {
            if (savepointUnlocked) {
                ctx.fillStyle = '#00ff88';
                ctx.font = 'bold 12px monospace';
                ctx.fillText('SAVE', canvas.width - 52, 20);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '11px monospace';
            ctx.fillText(`state:${state}  y:${Math.round(py)}  save:${savepointUnlocked}`, 8, 15);
        }

        // 차지 바 (캐릭터 머리 위)
        if (state === 'ready') {
            const charge = Math.min((performance.now() - chargeStart) / MAX_CHARGE, 1.0);
            const barW   = 90;
            const bx     = px + HITBOX_W / 2 - barW / 2;
            const by     = py - SPRITE_OY - cameraY - 14;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(bx, by, barW, 7);
            ctx.fillStyle = `hsl(${(1 - charge) * 120}, 100%, 55%)`;
            ctx.fillRect(bx, by, barW * charge, 7);
        }
    }
}
