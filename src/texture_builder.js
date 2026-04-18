// ── 프로시저럴 텍스처 빌더 ─────────────────────────────────────────────────
// 초기 로딩 시 한 번만 실행되어 나무·철·대리석 등의 패턴을 OffscreenCanvas에 찍어 반환한다.

function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}

// ── 소형 반복 텍스처(플랫폼 상단 Stroke용) ─────────────────────────────
function buildWoodTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    x.fillStyle = '#4a2f1c'; x.fillRect(0, 0, 40, 14);
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(0, 6); x.lineTo(40, 6); x.stroke();
    x.beginPath(); x.moveTo(0, 11); x.lineTo(40, 11); x.stroke();
    return destCtx.createPattern(c, 'repeat');
}

function buildClothTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    x.fillStyle = '#880011'; x.fillRect(0, 0, 40, 14);
    for (let i = 2; i < 40; i += 8) {
        x.fillStyle = 'rgba(0,0,0,0.3)';
        x.fillRect(i, 0, 3, 14);
        x.fillStyle = 'rgba(255,255,255,0.15)';
        x.fillRect(i + 4, 0, 2, 14);
    }
    return destCtx.createPattern(c, 'repeat');
}

function buildMetalTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    x.fillStyle = '#334455'; x.fillRect(0, 0, 40, 14);
    [[4, 4], [36, 4], [4, 10], [36, 10]].forEach(([bx, by]) => {
        x.fillStyle = '#556677';
        x.beginPath(); x.arc(bx, by, 2, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#7799aa'; x.lineWidth = 0.5; x.stroke();
    });
    return destCtx.createPattern(c, 'repeat');
}

function buildCircusTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    const g = x.createLinearGradient(0, 0, 14, 0);
    g.addColorStop(0,     '#cc2200');
    g.addColorStop(0.499, '#cc2200');
    g.addColorStop(0.5,   '#aa8800');
    g.addColorStop(1,     '#aa8800');
    x.fillStyle = g; x.fillRect(0, 0, 40, 14);
    return destCtx.createPattern(c, 'repeat');
}

function buildCircusBgPattern(destCtx) {
    const [c, x] = offscreen(16, 16);
    x.fillStyle = '#cc2200'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#880000'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
    return destCtx.createPattern(c, 'repeat');
}

function buildDirtTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    x.fillStyle = '#3d2210'; x.fillRect(0, 0, 40, 14);
    [[8, 8], [22, 10], [34, 7]].forEach(([dx, dy]) => {
        x.fillStyle = 'rgba(0,0,0,0.3)';
        x.beginPath(); x.ellipse(dx, dy, 3, 2, 0, 0, Math.PI * 2); x.fill();
    });
    return destCtx.createPattern(c, 'repeat');
}

function buildBranchTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    x.fillStyle = '#5c3a1e'; x.fillRect(0, 0, 40, 14);
    [3, 7, 11].forEach(ly => {
        x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(0, ly); x.lineTo(40, ly); x.stroke();
    });
    return destCtx.createPattern(c, 'repeat');
}

function buildCloudTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    x.fillStyle = '#eaf2f8'; x.fillRect(0, 0, 40, 14);
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(10, 2, 8, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(28, 0, 12, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(30, 4, 10, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(100,150,200,0.25)';
    x.fillRect(0, 11, 40, 3);
    return destCtx.createPattern(c, 'repeat');
}

function buildMeteorTexture(destCtx) {
    const [c, x] = offscreen(40, 14);
    x.fillStyle = '#1a1829'; x.fillRect(0, 0, 40, 14);
    [[10, 6, 3], [30, 8, 4], [22, 3, 2]].forEach(([cx, cy, r]) => {
        x.fillStyle = '#0a0912'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 1;
        x.beginPath(); x.arc(cx + 0.5, cy + 0.5, r, 0, Math.PI * 2); x.stroke();
    });
    return destCtx.createPattern(c, 'repeat');
}

// ── 화면 폭 크기의 벽면 통짜 텍스처 ───────────────────────────────────
function buildBaseWallTextures(destCtx, canvasWidth) {
    const wallTextures = {};
    const W = canvasWidth, H = 800;
    const densityScale = W / 800;

    const drawWrap = (ctx, drawFn) => {
        for (const dx of [-W, 0, W]) {
            for (const dy of [-H, 0, H]) {
                ctx.save();
                ctx.translate(dx, dy);
                drawFn();
                ctx.restore();
            }
        }
    };

    // 1. 대리석
    let [c, x] = offscreen(W, H);
    x.fillStyle = '#0f111a'; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < Math.round(150 * densityScale); i++) {
        const ex = Math.random() * W, ey = Math.random() * H;
        const erx = Math.random() * 150 + 50, ery = Math.random() * 50 + 20;
        const rot = Math.random() * Math.PI;
        drawWrap(x, () => {
            x.beginPath();
            x.ellipse(ex, ey, erx, ery, rot, 0, Math.PI * 2);
            x.fill();
        });
    }
    wallTextures['wood'] = destCtx.createPattern(c, 'repeat');

    // 2 & 4. 나무 판자
    [c, x] = offscreen(W, H);
    x.fillStyle = '#2c1a11'; x.fillRect(0, 0, W, H);

    const plankH = 40;
    for (let y = 0; y < H; y += plankH) {
        const g = x.createLinearGradient(0, y, 0, y + plankH);
        g.addColorStop(0, '#543625');
        g.addColorStop(1, '#271410');
        x.fillStyle = g;
        x.fillRect(0, y + 2, W, plankH - 4);

        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1;
        for (let j = 0; j < Math.round(6 * densityScale); j++) {
            const py1 = y + Math.random() * plankH;
            const py2 = y + Math.random() * plankH;
            drawWrap(x, () => {
                x.beginPath();
                x.moveTo(0, py1);
                x.lineTo(W, py2);
                x.stroke();
            });
        }

        const splits = Math.floor(Math.random() * Math.round(4 * densityScale)) + 1;
        for (let s = 0; s < splits; s++) {
            const sx = Math.random() * W;
            drawWrap(x, () => {
                x.fillStyle = '#1c0e09';
                x.fillRect(sx, y, 6, plankH);

                x.fillStyle = '#050201';
                x.beginPath(); x.arc(sx - 8, y + 10, 3, 0, Math.PI * 2); x.fill();
                x.beginPath(); x.arc(sx + 14, y + 10, 3, 0, Math.PI * 2); x.fill();
                x.beginPath(); x.arc(sx - 8, y + plankH - 10, 3, 0, Math.PI * 2); x.fill();
                x.beginPath(); x.arc(sx + 14, y + plankH - 10, 3, 0, Math.PI * 2); x.fill();
            });
        }

        x.fillStyle = '#150a06';
        x.fillRect(0, y, W, 2);
        x.fillRect(0, y + plankH - 2, W, 2);
    }
    wallTextures['cloth'] = destCtx.createPattern(c, 'repeat');
    wallTextures['circus'] = destCtx.createPattern(c, 'repeat');

    // 3. 철재
    [c, x] = offscreen(W, H);
    x.fillStyle = '#1e242a'; x.fillRect(0, 0, W, H);

    const panelSize = 160;
    x.strokeStyle = '#0d1015'; x.lineWidth = 8;
    for (let i = 0; i < W; i += panelSize) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke();
    }
    for (let i = 0; i < H; i += panelSize) {
        x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke();
    }
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 2;
    for (let i = 0; i < W; i += panelSize) {
        x.beginPath(); x.moveTo(i + 4, 0); x.lineTo(i + 4, H); x.stroke();
    }
    for (let i = 0; i < H; i += panelSize) {
        x.beginPath(); x.moveTo(0, i + 4); x.lineTo(W, i + 4); x.stroke();
    }

    const lg = x.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, 'rgba(255,255,255,0.0)');
    lg.addColorStop(0.35, 'rgba(255,255,255,0.03)');
    lg.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    lg.addColorStop(0.45, 'rgba(255,255,255,0.02)');
    lg.addColorStop(1, 'rgba(255,255,255,0.0)');
    x.fillStyle = lg;
    x.fillRect(0, 0, W, H);

    const lg2 = x.createLinearGradient(W, 0, 0, H);
    lg2.addColorStop(0, 'rgba(100, 150, 255, 0)');
    lg2.addColorStop(0.3, 'rgba(100, 150, 255, 0.12)');
    lg2.addColorStop(0.5, 'rgba(100, 150, 255, 0)');
    x.fillStyle = lg2;
    x.fillRect(0, 0, W, H);

    for (let py = 0; py < H; py += panelSize) {
        for (let px = 0; px < W; px += panelSize) {
            const off = 16;
            [[off, off], [panelSize - off, off], [off, panelSize - off], [panelSize - off, panelSize - off]].forEach(([dx, dy]) => {
                x.fillStyle = '#0a0c0f';
                x.beginPath(); x.arc(px + dx, py + dy, 4, 0, Math.PI * 2); x.fill();
                x.fillStyle = 'rgba(255,255,255,0.4)';
                x.beginPath(); x.arc(px + dx - 1, py + dy - 1, 1.5, 0, Math.PI * 2); x.fill();
            });
        }
    }
    wallTextures['metal'] = destCtx.createPattern(c, 'repeat');

    // 5. 뿌리
    [c, x] = offscreen(W, H);
    x.fillStyle = '#140c06'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < Math.round(40 * densityScale); i++) {
        const ry = Math.random() * H;
        const ry2 = ry + Math.random() * 100 - 50;
        const cp1 = ry + Math.random() * 200 - 100;
        const cp2 = ry + Math.random() * 200 - 100;
        const lw1 = 15 + Math.random() * 20;
        const lw2 = lw1 * 0.5;
        drawWrap(x, () => {
            x.strokeStyle = '#0a0502'; x.lineWidth = lw1;
            x.beginPath(); x.moveTo(0, ry);
            x.bezierCurveTo(W * 0.3, cp1, W * 0.6, cp2, W, ry2);
            x.stroke();
            x.strokeStyle = '#24140a'; x.lineWidth = lw2;
            x.stroke();
        });
    }
    wallTextures['dirt'] = destCtx.createPattern(c, 'repeat');

    // 6. 세계수 껍질
    [c, x] = offscreen(W, H);
    x.fillStyle = '#18120d'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < Math.round(80 * densityScale); i++) {
        const rX = Math.random() * W;
        const rX2 = rX + Math.random() * 100 - 50;
        const cp1 = rX + Math.random() * 80 - 40;
        const cp2 = rX + Math.random() * 80 - 40;
        const lw = 8 + Math.random() * 12;
        drawWrap(x, () => {
            x.strokeStyle = '#0c0805'; x.lineWidth = lw;
            x.beginPath(); x.moveTo(rX, 0);
            x.bezierCurveTo(cp1, H * 0.4, cp2, H * 0.6, rX2, H);
            x.stroke();
        });
    }
    wallTextures['branch'] = destCtx.createPattern(c, 'repeat');

    // 7. 구름 기둥
    [c, x] = offscreen(W, H);
    x.fillStyle = '#111d2e'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < Math.round(80 * densityScale); i++) {
        const cx = Math.random() * W, cy = Math.random() * H;
        const scaleY = 0.5 + Math.random() * 0.8;
        const r = 60 + Math.random() * 80;
        drawWrap(x, () => {
            const grad = x.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, 'rgba(180, 210, 255, 0.15)');
            grad.addColorStop(1, 'rgba(100, 150, 220, 0)');
            x.save();
            x.translate(cx, cy);
            x.scale(1, scaleY);
            x.fillStyle = grad;
            x.beginPath(); x.arc(0, 0, 140, 0, Math.PI * 2); x.fill();
            x.restore();
        });
    }
    wallTextures['cloud'] = destCtx.createPattern(c, 'repeat');

    // 8. 흑요석
    [c, x] = offscreen(W, H);
    x.fillStyle = '#050508'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < Math.round(100 * densityScale); i++) {
        const mx = Math.random() * W;
        const my = Math.random() * H;
        const ex = mx + (Math.random() - 0.5) * 200;
        const ey = my + (Math.random() - 0.5) * 200;
        const lw = 1 + Math.random() * 3;
        drawWrap(x, () => {
            x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = lw;
            x.beginPath();
            x.moveTo(mx, my);
            x.lineTo(ex, ey);
            x.stroke();
        });
    }
    wallTextures['meteor'] = destCtx.createPattern(c, 'repeat');

    return wallTextures;
}

// ── 결정론적 배경 파티클(별/구름/나무/잎사귀) ──────────────────────────
function buildParticles() {
    const stars = Array.from({ length: 120 }, (_, i) => ({
        x: (i * 137.508) % 960,
        y: (i * 97.3) % 700,
        r: (i % 3) * 0.5 + 0.5,
    }));
    const clouds = Array.from({ length: 18 }, (_, i) => ({
        x: (i * 211) % 960,
        y: 1100 + (i * 173) % 800,
        w: 60 + (i * 37) % 80,
        h: 20 + (i * 23) % 20,
    }));
    const trees = [80, 220, 450, 680, 850].map((tx, i) => ({
        x: tx,
        h: 120 + (i * 37) % 80,
        trunk: 10 + (i * 13) % 8,
    }));
    const leaves = Array.from({ length: 40 }, (_, i) => ({
        x: (i * 173) % 960,
        y: (i * 113) % 700,
    }));
    return { stars, clouds, trees, leaves };
}

/**
 * 전체 텍스처·파티클을 빌드해 렌더러에 장착할 번들을 반환한다.
 * @param {CanvasRenderingContext2D} destCtx 메인 캔버스 컨텍스트(패턴 생성용)
 * @param {number} canvasWidth 벽면 텍스처 폭 기준
 */
export function initTextures(destCtx, canvasWidth) {
    const textures = {
        wood:     buildWoodTexture(destCtx),
        cloth:    buildClothTexture(destCtx),
        metal:    buildMetalTexture(destCtx),
        circus:   buildCircusTexture(destCtx),
        circusBg: buildCircusBgPattern(destCtx),
        dirt:     buildDirtTexture(destCtx),
        branch:   buildBranchTexture(destCtx),
        cloud:    buildCloudTexture(destCtx),
        meteor:   buildMeteorTexture(destCtx),
    };
    const wallTextures = buildBaseWallTextures(destCtx, canvasWidth);
    const particles = buildParticles();
    return { textures, wallTextures, ...particles };
}
