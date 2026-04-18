import { MAX_CHARGE } from './constants.js';

// ── 절대 좌표계 HUD (진행바·상태·차지 게이지) ────────────────────────────
export function drawHUD(renderer) {
    const { ctx, canvas, engine, mode } = renderer;
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
