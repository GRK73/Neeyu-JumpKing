# 비주얼 업그레이드 계획 — 스테이지별 배경·플랫폼 텍스처

## 현재 코드 구조 (모듈화 완료)

```
src/
  constants.js   — 상수
  engine.js      — GameEngine 클래스 (물리/로직)
  renderer.js    — Renderer 클래스  ← 이 파일만 수정
  map_data.js    — 레벨 데이터
  main.js        — 진입점
```

**수정 대상: `src/renderer.js` 전용**
- `_drawBackground()` — 배경 교체
- `_drawPlatforms()` → `_getPlatColors()` + 텍스처 패턴 적용
- `initTextures()` 추가 (생성자에서 한 번 호출)

---

## 구현 방식

### 텍스처 초기화 패턴

```js
// Renderer 생성자 마지막에 호출
initTextures() {
    this._textures = {};
    this._buildStoneTexture();
    this._buildMetalTexture();
    // ... 각 스테이지별
}

_buildStoneTexture() {
    const c = document.createElement('canvas');
    c.width = 40; c.height = 14;
    const x = c.getContext('2d');
    x.fillStyle = '#554433';
    x.fillRect(0, 0, 40, 14);
    x.strokeStyle = 'rgba(0,0,0,0.4)';
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, 5); x.lineTo(40, 5); x.stroke();   // 수평 줄눈
    x.beginPath(); x.moveTo(20, 0); x.lineTo(20, 5); x.stroke();  // 수직 줄눈 (엇갈림)
    x.beginPath(); x.moveTo(0, 9); x.lineTo(40, 9); x.stroke();
    x.beginPath(); x.moveTo(10, 5); x.lineTo(10, 14); x.stroke();
    x.beginPath(); x.moveTo(30, 5); x.lineTo(30, 14); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.08)';
    x.fillRect(0, 0, 40, 2);  // 상단 하이라이트
    this._textures.stone = this.ctx.createPattern(c, 'repeat');
}
```

### 배경 시차 스크롤

```js
_drawBackground() {
    // 기존 단색 그라데이션은 유지 (베이스)
    // + 스테이지별 장식 레이어를 cameraY * 0.3 오프셋으로 그림
    const parallax = this.engine.cameraY * 0.3;
}
```

### 구름·별 파티클 — 고정 시드

```js
// initTextures() 에서 한 번만 생성, 매 프레임 재계산 금지
this._stars = Array.from({length: 120}, (_, i) => ({
    x: (i * 137.508) % 960,          // 황금각 분포
    y: (i * 97.3) % 7000,
    r: (i % 3) * 0.5 + 0.5,
}));
this._clouds = Array.from({length: 18}, (_, i) => ({
    x: (i * 211) % 960,
    y: 1100 + (i * 173) % 800,
    w: 60 + (i * 37) % 80,
    h: 20 + (i * 23) % 20,
}));
```

---

## 스테이지별 구현 명세

### Stage 1 — 돌 바닥 (y 5900~6700)

**배경 `_drawBackground()`**
- 베이스 그라데이션: `#120800 → #1a0e00` (기존 유지)
- 배경 장식: 수평 벽돌 줄눈 선 3~4개, `rgba(80,60,40,0.15)`, 간격 60px, 시차 0.2x

**플랫폼 `_drawPlatforms()`**
- `fillStyle = this._textures.stone` (40×14 타일 패턴)
- 상단 2px `#998877` 하이라이트
- 좌우 엣지 2px `#776655`

---

### Stage 2 — 빨간 천 / 커튼 (y 5100~5900)

**배경**
- 베이스: `#200808 → #300a0a`
- 장식: 화면 양 끝 수직 커튼 실루엣 (x=0~30, x=WIDTH-30~WIDTH), `#1a0000`, 시차 없음
- 커튼 하단 주름: `arc` 반원 3~4개, `#220000`

**플랫폼 텍스처** (`_buildClothTexture()`)
```js
// 40×14 타일
x.fillStyle = '#770011';
x.fillRect(0, 0, 40, 14);
for (let i = 4; i < 40; i += 6) {          // 세로 주름선
    x.fillStyle = 'rgba(0,0,0,0.25)';
    x.fillRect(i, 0, 1, 14);
}
x.fillStyle = '#ccaa00';
x.fillRect(0, 0, 40, 2);                   // 상단 금색 테두리
```

---

### Stage 3 — 철 바닥 / 사무실 (y 4300~5100)

**배경**
- 베이스: `#0a0a12 → #141420`
- 장식: 격자 패턴 (40px 간격 가로·세로선), `rgba(40,60,80,0.12)`, 시차 0.1x

**플랫폼 텍스처** (`_buildMetalTexture()`)
```js
// 40×14 타일
x.fillStyle = '#334455';
x.fillRect(0, 0, 40, 14);
x.fillStyle = 'rgba(255,255,255,0.12)';
x.fillRect(0, 0, 40, 2);                   // 반사광
// 볼트 4개
[[4,4],[36,4],[4,10],[36,10]].forEach(([bx,by]) => {
    x.fillStyle = '#556677';
    x.beginPath(); x.arc(bx, by, 2, 0, Math.PI*2); x.fill();
    x.strokeStyle = '#7799aa'; x.lineWidth = 0.5; x.stroke();
});
```

**부서지는 바닥**: 기존 `standTimer` 비율에 따라 균열선 점진적 추가 (이미 구현됨, 텍스처 위에 오버레이)

---

### Stage 4 — 서커스 천막 (y 3500~4300)

**배경**
- 베이스: `#1a0505 → #280808`
- 장식: 45° 사선 줄무늬 패턴 (`createPattern`, 16px 피치, 빨강/어두운빨강), `globalAlpha 0.15`
- 상단 삼각 천막 실루엣: `moveTo/lineTo` 지그재그 3~4개 봉우리, `#220000`

**플랫폼 텍스처** (`_buildCircusTexture()`)
```js
// 40×14 타일 — 빨강·금 대각선 줄무늬
const grad = x.createLinearGradient(0,0,14,14);
grad.addColorStop(0, '#cc2200');
grad.addColorStop(0.5, '#cc2200');
grad.addColorStop(0.5, '#aa8800');
grad.addColorStop(1, '#aa8800');
// createPattern으로 반복
x.fillStyle = '#ccaa00';
x.fillRect(0, 0, 40, 2);                   // 상단 금색 테두리
```

---

### Stage 5 — 숲 / 세이브포인트 (y 2700~3500)

**배경**
- 베이스: `#071407 → #0d200d`
- 장식: 나무 실루엣 5그루 (고정 x 위치), 각 나무 = 직사각형 줄기 + 삼각형 수관, `#041004`, 시차 0.25x
  ```js
  this._trees = [80, 220, 450, 680, 850].map((tx, i) => ({
      x: tx, h: 120 + (i*37)%80, trunk: 10 + (i*13)%8
  }));
  ```

**플랫폼 텍스처** (`_buildDirtTexture()`)
```js
// 40×14 타일
x.fillStyle = '#3d2210';
x.fillRect(0, 0, 40, 14);
x.fillStyle = '#337722';
x.fillRect(0, 0, 40, 4);                   // 잔디
// 흙 속 돌멩이 3개
[[8,8],[22,10],[34,7]].forEach(([dx,dy]) => {
    x.fillStyle = 'rgba(0,0,0,0.3)';
    x.beginPath(); x.ellipse(dx, dy, 3, 2, 0, 0, Math.PI*2); x.fill();
});
```

**세이브 플랫폼 추가 렌더**: 깃발 아이콘 (`moveTo` 삼각형) — `savepointUnlocked` 여부로 색상 분기

---

### Stage 6 — 나뭇가지 / 숲 상층 (y 1900~2700)

**배경**
- 베이스: `#051205 → #091a09`
- 장식: 잎사귀 파티클 40개 (고정 좌표), `ellipse(3,2)`, `rgba(30,80,20,0.4)`, 시차 0.35x

**플랫폼 텍스처** (`_buildBranchTexture()`)
```js
// 40×14 타일 — 나무껍질
x.fillStyle = '#5c3a1e';
x.fillRect(0, 0, 40, 14);
// 나이테 줄 (불규칙 가로선)
[3, 7, 11].forEach(ly => {
    x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, ly); x.lineTo(40, ly); x.stroke();
});
// 이끼 (상단 불규칙 초록 점)
x.fillStyle = 'rgba(40,100,20,0.5)';
[2,8,15,24,31,38].forEach(mx => x.fillRect(mx, 0, 3, 2));
```

**함정 렌더 개선** (`_drawTraps()`): 현재 다이아몬드 위에 가시 삼각형 4개 추가

---

### Stage 7 — 구름 / 하늘 (y 1100~1900)

**배경**
- 베이스: `#08101c → #0e1a2e`
- 장식: `this._clouds` 배열로 미리 생성한 타원 구름들, `rgba(200,220,255,0.08)`, 시차 0.4x
  ```js
  _drawCloud(cloud, parallax) {
      const sy = cloud.y - parallax;
      if (sy < -50 || sy > CANVAS_H + 50) return;
      this.ctx.fillStyle = 'rgba(200,220,255,0.08)';
      this.ctx.beginPath();
      this.ctx.ellipse(cloud.x, sy, cloud.w/2, cloud.h/2, 0, 0, Math.PI*2);
      this.ctx.fill();
  }
  ```

**플랫폼 텍스처 (얼음)**: 기존 `#4499cc` 베이스 유지 + 눈결정 개선 (X자 대신 `*` 형태 6방향 선)

---

### Stage 8 — 운석 / 밤하늘 (y 200~1100)

**배경**
- 베이스: `#000008 → #020210`
- 장식 1: `this._stars` 배열 별 파티클, `fillRect(1×1)` 흰점, 시차 0 (고정)
- 장식 2: 운석 2~3개, 긴 타원 + `LinearGradient(투명→#ffffff)` 꼬리, 시차 0.15x

**플랫폼 텍스처 (우주 암석)** (`_buildRockTexture()`)
```js
// 40×14 타일
x.fillStyle = '#223344';
x.fillRect(0, 0, 40, 14);
// 크레이터 2개
[[12,7],[30,5]].forEach(([cx,cy]) => {
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1;
    x.beginPath(); x.arc(cx, cy, 3, 0, Math.PI*2); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.05)';
    x.beginPath(); x.arc(cx-1, cy-1, 2, 0, Math.PI*2); x.fill();
});
x.fillStyle = 'rgba(255,255,255,0.06)';
x.fillRect(0, 0, 40, 1);
```

---

## 구현 순서 (우선순위)

| 순서 | 작업 | 예상 난이도 |
|------|------|-------------|
| 1 | `initTextures()` + Stage 1 돌 텍스처 | 낮음 — 기반 코드 작성 |
| 2 | Stage 8 밤하늘 배경 (별+운석) | 낮음 — 임팩트 큼 |
| 3 | Stage 5 숲 배경 (나무 실루엣) | 낮음 |
| 4 | Stage 7 하늘 구름 | 낮음 |
| 5 | Stage 3 금속 텍스처 + 볼트 | 낮음 |
| 6 | Stage 2 커튼 + 주름 | 보통 |
| 7 | Stage 4 서커스 줄무늬 | 보통 |
| 8 | Stage 6 나뭇가지 + 이끼 | 보통 |
| 9 | 시차 스크롤 전체 적용 | 보통 |
| 10 | 스테이지 경계 페이드 전환 | 높음 |

---

## 주의사항

- `initTextures()`는 **브라우저 환경에서만** 호출 (`document.createElement` 필요)  
  → `Renderer` 생성자 안에서 호출하면 됨, Node 테스트에서는 mock 불필요 (renderer는 Node에서 import만 함)
- 파티클 좌표(`_stars`, `_clouds`, `_trees`)는 `Math.random()` 대신 **결정론적 계산** (황금각·소수 곱) — 매번 같은 모습
- 에디터 플레이(`mode: 'editor'`)에도 동일하게 적용됨 (`Renderer` 공유)
- 텍스처 패턴은 `ctx.createPattern()`이므로 **canvas 교체 시 재생성 불필요** (같은 ctx에 묶임)
