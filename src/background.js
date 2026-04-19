import { CELL } from './constants.js';
import { getStageBg } from './stage_themes.js';

// 경계 중심 ±FADE_PX 구간에서 인접 스테이지 bg와 크로스페이드
const FADE_PX = 120;

// ── 하늘·테마 그라데이션 배경 ────────────────────────────────────────────
// stages는 고정 배열이므로 정렬 결과를 렌더러 인스턴스에 캐시하여 매 프레임 재정렬/재할당 회피
function getSortedStages(renderer) {
    const stages = renderer.engine.stages;
    if (!stages || stages.length === 0) return [];
    if (renderer._sortedStages && renderer._sortedStagesSrc === stages) {
        return renderer._sortedStages;
    }
    renderer._sortedStages = stages.slice().sort((a, b) => b.topRow - a.topRow);
    renderer._sortedStagesSrc = stages;
    return renderer._sortedStages;
}

export function drawBackground(renderer) {
    const { ctx, canvas, engine } = renderer;
    const W = canvas.width, H = canvas.height;
    const cameraY = engine.cameraY;
    const midWorld = cameraY + H / 2;

    const sorted = getSortedStages(renderer);
    const numStages = sorted.length;

    let baseIdx = 0;
    if (numStages > 1) {
        for (let i = 0; i < numStages; i++) {
            if (midWorld >= sorted[i].topRow * CELL) { baseIdx = i; break; }
        }
    }

    // 가장 가까운 경계와의 거리로 인접 스테이지를 보간
    // 경계에서 alpha=0.5 (50/50), ±FADE_PX 지점에서 alpha=0
    let blendIdx = -1;
    let alpha = 0;
    if (numStages > 1) {
        // 아래 경계: sorted[baseIdx-1]와 접함 (Y가 더 큰 쪽)
        if (baseIdx > 0) {
            const boundaryY = sorted[baseIdx - 1].topRow * CELL;
            const d = boundaryY - midWorld; // 현재 스테이지 안에 있으면 d >= 0
            if (d >= 0 && d < FADE_PX) {
                alpha = 0.5 * (1 - d / FADE_PX);
                blendIdx = baseIdx - 1;
            }
        }
        // 위 경계: sorted[baseIdx+1]와 접함 (Y가 더 작은 쪽)
        if (baseIdx < numStages - 1) {
            const boundaryY = sorted[baseIdx].topRow * CELL;
            const d = midWorld - boundaryY; // 현재 스테이지 안에 있으면 d >= 0
            if (d >= 0 && d < FADE_PX) {
                const a = 0.5 * (1 - d / FADE_PX);
                if (a > alpha) { alpha = a; blendIdx = baseIdx + 1; }
            }
        }
    }

    const drawBgLayer = (stageIdx, layerAlpha) => {
        const stage = sorted[stageIdx];
        const bgImg = renderer.bgImages && stage && renderer.bgImages[stage.theme];
        if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
            const scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight) * 1.05;
            const drawW = bgImg.naturalWidth * scale;
            const drawH = bgImg.naturalHeight * scale;

            let stageMin, stageMax;
            if (numStages > 0) {
                stageMin = stageIdx < numStages - 1 ? sorted[stageIdx + 1].topRow * CELL : 0;
                stageMax = sorted[stageIdx].topRow * CELL + 800;
            } else {
                stageMin = 0; stageMax = engine.MAP_H;
            }

            let p = (cameraY - Math.max(0, stageMin)) / (stageMax - Math.max(0, stageMin));
            p = Math.max(0, Math.min(1, p));
            const yOffset = p * (H - drawH);
            const xOffset = (W - drawW) / 2;

            ctx.save();
            ctx.globalAlpha = layerAlpha;
            ctx.drawImage(bgImg, xOffset, yOffset, drawW, drawH);
            ctx.restore();
        } else if (layerAlpha > 0.5) {
            const [c1, c2] = getStageBg(midWorld, engine.stages);
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, c1);
            grad.addColorStop(1, c2);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }
    };

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    drawBgLayer(baseIdx, 1.0);
    if (alpha > 0 && blendIdx >= 0) {
        drawBgLayer(blendIdx, alpha);
    }

    ctx.fillStyle = 'rgba(0, 5, 20, 0.4)';
    ctx.fillRect(0, 0, W, H);
}

// ── 스테이지별 장식(시차 스크롤) ─────────────────────────────────────────
export function drawStageDecorations(renderer, midWorld, cameraY, W, H) {
    const { ctx } = renderer;

    if (midWorld > 5900) {
        // Stage 1: 무대 단상
        const g = ctx.createRadialGradient(W / 2, -50, 10, W / 2, -50, 600);
        g.addColorStop(0, 'rgba(255,255,200,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        const off = (cameraY * 0.15) % 150;
        for (let x = -(off % 150); x < W + 150; x += 150) {
            ctx.fillRect(x, 0, 40, H);
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
        // Stage 3: 사무실 블라인드 + 형광등
        const py = (cameraY * 0.15) % 200;

        ctx.fillStyle = 'rgba(120, 160, 200, 0.04)';
        for (let x = 60; x < W - 60; x += 180) {
            ctx.fillRect(x, 0, 140, H);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let y = -(py % 200); y < H + 200; y += 200) {
            ctx.fillRect(0, y, W, 8);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(0, y + 2, W, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, y - 20, W, 20);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
        }

    } else if (midWorld > 3500) {
        // Stage 4: 사선 줄무늬 + 천막 봉우리
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = renderer._textures.circusBg;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
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
        // Stage 5: 나무 실루엣
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const baseY = H + 10;
        for (const t of renderer._trees) {
            const topY = baseY - t.h;
            ctx.beginPath();
            ctx.moveTo(t.x, topY);
            ctx.lineTo(t.x + t.trunk * 3.5, topY + t.h * 0.65);
            ctx.lineTo(t.x - t.trunk * 3.5, topY + t.h * 0.65);
            ctx.closePath(); ctx.fill();
            ctx.fillRect(t.x - t.trunk / 2, topY + t.h * 0.65, t.trunk, t.h * 0.35);
        }

    } else if (midWorld > 1900) {
        // Stage 6: 잎사귀 파티클
        ctx.fillStyle = 'rgba(50,140,30,0.55)';
        const drift = (cameraY * 0.35) % H;
        for (const lf of renderer._leaves) {
            const sy = ((lf.y - drift) % H + H) % H;
            ctx.beginPath();
            ctx.ellipse(lf.x, sy, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

    } else if (midWorld > 1100) {
        // Stage 7: 구름
        const parallax = cameraY * 0.4;
        ctx.fillStyle = 'rgba(200,220,255,0.14)';
        for (const cl of renderer._clouds) {
            const sy = cl.y - parallax;
            if (sy < -60 || sy > H + 60) continue;
            ctx.beginPath();
            ctx.ellipse(cl.x, sy, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

    } else {
        // Stage 8: 별 + 운석
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const s of renderer._stars) {
            ctx.fillRect(s.x, s.y, s.r, s.r);
        }
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
