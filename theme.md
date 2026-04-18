# Neeyu-JumpKing Texture & Theme History

This document archives the 8 stage themes and the 7 basic procedural texture algorithms that are used in the game's HTML5 Canvas rendering. These textures are generated offscreen as `canvas.width × 800` patterns (screen-width × 800px height) to eliminate horizontal tiling seams. Element density is scaled proportionally via `densityScale = canvas.width / 800`.

## 8 Stage Themes Overview

The game features 8 distinct stage themes, ordered from bottom to top. Note that while there are 8 themes, there are only 7 underlying procedural texture patterns because the `curtain` and `circus` themes share the same "Wood Planks" texture generation algorithm.

1. **Stage (1스테이지 - 최하단)**
   - **Texture:** Marble (texKey: `wood`)
   - **Colors:** Background `#050814 → #100f1a`, Platform `#554433` (Top: `#776655`)
2. **Curtain (2스테이지)**
   - **Texture:** Wood Planks (texKey: `cloth`)
   - **Colors:** Background `#200808 → #300a0a`, Platform `#770011` (Top: `#aa0022`)
3. **Office (3스테이지)**
   - **Texture:** Shiny Steel (texKey: `metal`)
   - **Colors:** Background `#0f1218 → #1c222c`, Platform `#334455` (Top: `#556677`)
4. **Circus (4스테이지)**
   - **Texture:** Wood Planks (texKey: `circus`) - *Shares generation algorithm with Curtain*
   - **Colors:** Background `#1a0505 → #280808`, Platform `#881100` (Top: `#cc2200`)
5. **Forest (5스테이지)**
   - **Texture:** Root (texKey: `dirt`)
   - **Colors:** Background `#071407 → #0d200d`, Platform `#225511` (Top: `#337722`)
6. **Canopy (6스테이지)**
   - **Texture:** Bark (texKey: `branch`)
   - **Colors:** Background `#1e3b52 → #3d6c82`, Platform `#1a4410` (Top: `#2a6618`)
7. **Sky (7스테이지)**
   - **Texture:** Cloud (texKey: `cloud`)
   - **Colors:** Background `#4a90e2 → #87cefa`, Platform `#99bbcc` (Top: `#bbddee`)
8. **Space (8스테이지 - 최상단)**
   - **Texture:** Obsidian (texKey: `meteor`)
   - **Colors:** Background `#050510 → #0a0a1a`, Platform `#112233` (Top: `#223355`)

---

## Procedural Texture Algorithms (`_buildBaseWallTextures`)

### 1. Marble (대리석 / `stage` 테마용, texKey: `wood`)
```javascript
let [c, x] = this._offscreen(W, H);
x.fillStyle = '#0f111a'; x.fillRect(0,0,W,H);
x.fillStyle = 'rgba(255,255,255,0.03)';
for(let i=0; i<150; i++) {
    x.beginPath();
    x.ellipse(Math.random()*W, Math.random()*H, Math.random()*150+50, Math.random()*50+20, Math.random()*Math.PI, 0, Math.PI*2);
    x.fill();
}
x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 2;
for(let i=0; i<40; i++) {
    x.beginPath(); x.moveTo(Math.random()*W, Math.random()*H);
    x.bezierCurveTo(Math.random()*W, Math.random()*H, Math.random()*W, Math.random()*H, Math.random()*W, Math.random()*H);
    x.stroke();
}
this._wallTextures['wood'] = this.ctx.createPattern(c, 'repeat');
```

### 2. Wood Planks (나무 판자 / `curtain` 및 `circus` 테마 공용, texKey: `cloth`, `circus`)
```javascript
[c, x] = this._offscreen(W, H);
x.fillStyle = '#1e100a'; x.fillRect(0,0,W,H);
x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 4;
for(let i=0; i<60; i++) {
    x.beginPath(); 
    let px = Math.random()*W;
    x.moveTo(px, 0);
    x.bezierCurveTo(px + Math.random()*100-50, H*0.3, px + Math.random()*100-50, H*0.7, px + Math.random()*60-30, H);
    x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.02)'; x.lineWidth = 8;
    x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 4;
}
this._wallTextures['cloth'] = this.ctx.createPattern(c, 'repeat');
this._wallTextures['circus'] = this.ctx.createPattern(c, 'repeat');
```

### 3. Shiny Steel (철재 / `office` 테마용, texKey: `metal`)
```javascript
[c, x] = this._offscreen(W, H);
x.fillStyle = '#1a1f24'; x.fillRect(0,0,W,H);
x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 8;
for(let i=0; i<20; i++) { 
    x.beginPath(); x.moveTo(Math.random()*W, 0); x.lineTo(Math.random()*W, H); x.stroke();
    x.beginPath(); x.moveTo(0, Math.random()*H); x.lineTo(W, Math.random()*H); x.stroke();
}
x.fillStyle = 'rgba(0,0,0,0.4)';
for(let i=0; i<100; i++) { 
    x.beginPath(); x.arc(Math.random()*W, Math.random()*H, 4+Math.random()*4, 0, Math.PI*2); x.fill();
}
this._wallTextures['metal'] = this.ctx.createPattern(c, 'repeat');
```

### 4. Root (뿌리 / `forest` 테마용, texKey: `dirt`)
```javascript
[c, x] = this._offscreen(W, H);
x.fillStyle = '#140c06'; x.fillRect(0,0,W,H);
for(let i=0; i<40; i++) {
    x.strokeStyle = '#0a0502'; x.lineWidth = 15 + Math.random()*20; 
    let rY = Math.random()*H;
    x.beginPath(); x.moveTo(0, rY);
    x.bezierCurveTo(W*0.3, rY+Math.random()*200-100, W*0.6, rY+Math.random()*200-100, W, rY+Math.random()*100-50);
    x.stroke();
    x.strokeStyle = '#24140a'; x.lineWidth = x.lineWidth * 0.5;
    x.stroke();
}
this._wallTextures['dirt'] = this.ctx.createPattern(c, 'repeat');
```

### 5. Bark (세계수 껍질 / `canopy` 테마용, texKey: `branch`)
```javascript
[c, x] = this._offscreen(W, H);
x.fillStyle = '#18120d'; x.fillRect(0,0,W,H);
for(let i=0; i<80; i++) {
    x.strokeStyle = '#0c0805'; x.lineWidth = 8 + Math.random()*12;
    let rX = Math.random()*W;
    x.beginPath(); x.moveTo(rX, 0);
    x.bezierCurveTo(rX+Math.random()*80-40, H*0.4, rX+Math.random()*80-40, H*0.6, rX+Math.random()*100-50, H);
    x.stroke();
}
this._wallTextures['branch'] = this.ctx.createPattern(c, 'repeat');
```

### 6. Cloud (구름 기둥 / `sky` 테마용, texKey: `cloud`)
```javascript
[c, x] = this._offscreen(W, H);
x.fillStyle = '#111d2e'; x.fillRect(0,0,W,H);
for(let i=0; i<80; i++) {
    const grad = x.createRadialGradient(0,0,0, 0,0, 60+Math.random()*80);
    grad.addColorStop(0, 'rgba(180, 210, 255, 0.15)');
    grad.addColorStop(1, 'rgba(100, 150, 220, 0)');
    x.save();
    x.translate(Math.random()*W, Math.random()*H);
    x.scale(1, 0.5+Math.random()*0.8);
    x.fillStyle = grad;
    x.beginPath(); x.arc(0,0, 140, 0, Math.PI*2); x.fill();
    x.restore();
}
this._wallTextures['cloud'] = this.ctx.createPattern(c, 'repeat');
```

### 7. Obsidian (흑요석 / `space` 테마용, texKey: `meteor`)
```javascript
[c, x] = this._offscreen(W, H);
x.fillStyle = '#050508'; x.fillRect(0,0,W,H);
for(let i=0; i<100; i++) {
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 1 + Math.random()*3;
    x.beginPath(); 
    let mx = Math.random()*W, my = Math.random()*H;
    x.moveTo(mx, my);
    x.lineTo(mx + (Math.random()-0.5)*200, my + (Math.random()-0.5)*200);
    x.stroke();
}
this._wallTextures['meteor'] = this.ctx.createPattern(c, 'repeat');
```