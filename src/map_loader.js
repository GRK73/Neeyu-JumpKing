// JSON map data → engine-ready {platforms, fans, traps, signs}
// mirrors buildGameData() in map_editor.html

export function buildGameDataFromCells(cellsIterable, CELL) {
    const platforms = [], fans = [], traps = [], signs = [];
    for (const [key, items] of cellsIterable) {
        if (!items || !items.length) continue;
        const [cs, rs] = key.split(',');
        const col = +cs, row = +rs;
        const wx = col * CELL, wy = row * CELL;
        for (const item of items) {
            const t = item.type;
            if (t === 'wall' || t === 'floor') {
                platforms.push({ x: wx, y: wy, w: CELL, h: CELL, type: 'wall' });
            } else if (t === 'wall_breakable' || t === 'floor_breakable') {
                platforms.push({ x: wx, y: wy, w: CELL, h: CELL, type: 'wall', gimmick: 'breakable', broken: false, standTimer: 0, respawnTimer: 0 });
            } else if (t === 'wall_ice' || t === 'floor_ice') {
                platforms.push({ x: wx, y: wy, w: CELL, h: CELL, type: 'wall', gimmick: 'ice' });
            } else if (t === 'wall_goal' || t === 'floor_goal') {
                platforms.push({ x: wx, y: wy, w: CELL, h: CELL, type: 'goal' });
            } else if (t === 'diag_r') {
                platforms.push({ x: wx, y: wy, w: CELL, h: CELL, type: 'diag_r' });
            } else if (t === 'diag_l') {
                platforms.push({ x: wx, y: wy, w: CELL, h: CELL, type: 'diag_l' });
            } else if (t === 'trap') {
                traps.push({ x: wx + CELL / 2 - 20, y: wy + CELL / 2 - 20, w: 40, h: 40, bounceVX: 8, bounceVY: -15 });
            } else if (t === 'fan') {
                const DV = {
                    right: { windX:  3.5, windY:  0, dx:  1, dy:  0 },
                    left:  { windX: -3.5, windY:  0, dx: -1, dy:  0 },
                    up:    { windX:  0,   windY: -2, dx:  0, dy: -1 },
                    down:  { windX:  0,   windY:  2, dx:  0, dy:  1 },
                };
                const d = DV[item.dir] || DV.right;
                const reach = item.reach || 5;
                let zx = wx, zy = wy, zw = CELL, zh = CELL;
                if      (d.dx > 0) { zx = wx + CELL;         zw = reach * CELL; }
                else if (d.dx < 0) { zx = wx - reach * CELL; zw = reach * CELL; }
                else if (d.dy > 0) { zy = wy + CELL;         zh = reach * CELL; }
                else if (d.dy < 0) { zy = wy - reach * CELL; zh = reach * CELL; }
                fans.push({
                    x: wx + 5, y: wy + 5, w: CELL - 10, h: CELL - 10,
                    windX: d.windX, windY: d.windY, dir: item.dir || 'right',
                    zoneX: zx, zoneY: zy, zoneW: zw, zoneH: zh,
                });
            } else if (t === 'moving') {
                const ec = item.endC ?? col, er = item.endR ?? row;
                const ex = ec * CELL, ey = er * CELL;
                const w = (item.len || 1) * CELL;
                platforms.push({
                    x: wx, y: wy, w: w, h: 14, type: 'normal', gimmick: 'moving',
                    startX: wx, startY: wy, endX: ex, endY: ey,
                    moveSpeed: item.speed || 1.2, moveProgress: 0, moveDir: 1,
                });
            } else if (t === 'sign') {
                signs.push({ x: wx, y: wy, w: CELL, h: CELL, dir: item.dir || 'right' });
            }
        }
    }
    platforms.forEach(p => { if (!p.hasOwnProperty('broken')) { p.broken = false; p.standTimer = 0; p.respawnTimer = 0; } });
    return { platforms, fans, traps, signs };
}

export async function loadMapJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load map: ${url}`);
    return await res.json();
}
