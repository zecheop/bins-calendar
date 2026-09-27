/*
 * 마블 레이스 코스 정의 (물리 엔진 비의존적 데이터 모듈) — v4.
 * 좌표 단위: world px (카메라가 화면 px로 변환). px<->m 변환은 physics.js와
 * 동일한 비율(44px = 1m)을 써서 아래 포팅된 좌표와 항상 맞아떨어지게 한다.
 *
 * 이 파일의 스테이지(wheelOfFortune/potOfGreed)는 참고 사이트
 * lazygyu/roulette(https://github.com/lazygyu/roulette, MIT 라이선스)의
 * 실제 소스 src/data/maps.ts에 있는 좌표를 그대로 가져온 것이다 — 벽 polyline,
 * 장애물(box/diamond), 회전 막대(kinematic box), 원(circle) 전부 원본 위치/
 * 크기/각속도/반발력을 px로만 환산했다. 우리가 임의로 배치를 지어낸 게 아니다.
 * 다만 입구 대기 튜브는 원본이 -300m(또는 -191.5m)로 과도하게 길어서 -60m로
 * 잘랐다 — 장애물이 전혀 없는 순수 대기 구간이라 잘라도 코스 설계에는
 * 영향이 없다.
 *
 * 원본 데이터의 shape 타입 3개(polyline/box/circle)는 우리 엔진의 기존 타입
 * (wallSeg+fillet / ramp 또는 spinner / peg)에 그대로 대응된다:
 *   - polyline -> polylineToWalls()로 얇은(8px) 벽 세그먼트 체인
 *   - box(static)  -> ramp (고정 사각형/다이아몬드, angle은 원본 rotation 그대로)
 *   - box(kinematic) -> spinner (angularSpeed는 원본 angularVelocity 그대로, rad/s)
 *   - circle -> peg (restitution도 원본 값 그대로)
 */
(function (global) {
  "use strict";

  const PX_PER_METER = 44; // physics.js와 동일 — 마블 반지름 11px = 0.25m
  const WALL_THICK = 8; // 원본은 두께 0(edge)인 폴리라인이라 최대한 얇게

  function wallSeg(x1, y1, x2, y2, thickness, restitution) {
    return { type: "wallSeg", x1, y1, x2, y2, thickness, restitution };
  }

  // 폴리라인을 벽 세그먼트로 변환하되, 각 세그먼트를 자기 방향으로 half-thickness만큼
  // 늘려서 다음 세그먼트와 겹치게 한다 -> 코너에 얇은 틈(구슬이 끼는 지점)이 생기지 않는다.
  function polylineToWalls(points, thickness, restitution) {
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const ext = thickness / 2;
      segs.push(wallSeg(x1 - ux * ext, y1 - uy * ext, x2 + ux * ext, y2 + uy * ext, thickness, restitution));
    }
    // 꺾이는 지점(내부 정점)마다 두 세그먼트를 각자 방향으로만 늘려 붙이다 보니
    // 안쪽 모서리에 미세한 턱이 남는다 — 정점에 벽 두께와 같은 반지름의 원을
    // 끼워 넣어 이음매를 완전히 매끄러운 곡면으로 채운다.
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i];
      segs.push({ type: "fillet", x, y, r: thickness / 2 });
    }
    // 닫힌 폴리라인(시작점 == 끝점, 예: 이 파일의 육각형/사각형 장식들)은 그
    // 이음매가 인덱스 0과 마지막 인덱스에 걸쳐 있어서 위 루프(1..length-2)가
    // 건너뛴다 — 그 한 곳만 필렛이 안 채워져서 뾰족한 함정이 될 수 있다.
    const first = points[0];
    const last = points[points.length - 1];
    if (points.length > 2 && first[0] === last[0] && first[1] === last[1]) {
      segs.push({ type: "fillet", x: first[0], y: first[1], r: thickness / 2 });
    }
    return segs;
  }

  const PORTED_STAGES = {
    wheelOfFortune: {
      title: "MAP 1",
      width: 1265.0,
      startY: -2640,
      goalY: 4884.0,
      zoomY: 4697.0, // 원본 stage.zoomY(106.75m)*44 — 카메라 확대/슬로우 기준점
      totalHeight: 5317.0,
      // 1,000명 목표로 스폰 그리드(가로 32칸)를 채우면 위쪽으로 약 32줄
      // (~1090px)까지 쌓인다 — 천장이 그보다 낮은 y=-3400에 있으면 맨 위쪽
      // 줄이 천장 밖(벽 반대편)에 스폰되어 안으로 못 들어오고 밖으로 흘러
      // 나가는 문제가 있었다. 여유를 크게 잡아 y=-4200으로 올렸다.
      ceiling: { x1: 60.0, x2: 1205.0, y: -4200 },
    polylines: [
      // 첫 점(803,-2640)을 지워서 위쪽 벽 두 개를 잇던 "천장"을 없앴다 — 원래
      // -300m짜리 대기 튜브를 -60m로 잘랐더니 천장이 스폰 위치 바로 위(20px)까지
      // 내려와 있었고, 사람이 많아지면 위쪽 줄 마블이 그 천장과 아래 무리
      // 사이에 끼어 안 내려오는 걸 실측으로 확인했다. 입구를 완전히 열었다.
      // 마지막 출구 통로 폭을 임의로 넓혀봤는데 오히려 더 안 좋아져서(벽 기울기가
      // 바뀌면서 막대와 벽 사이 상호작용이 이상해짐), 원본 GitHub 좌표(741.4/781,
      // 막대 축 693)로 전부 되돌렸다 — 이 지점은 우리가 임의로 바꾸지 않는다.
      // 150명 넘게 넣으면 좁은 튜브(319px)에 다 안 들어가서 입구를 훨씬 넓혔다 —
      // 맨 위(y=-2640)만 60px까지 벌리고, 원래 튜브 폭(y=374)까지는 대각선으로
      // 좁아지게 이어서 아래쪽 코스 형태는 그대로 유지된다. 공이 벽 밖으로
      // 튀어나가지 않도록 SPAWN_TUBES도 이 넓어진 폭에 맞춰 같이 조정했다.
      // 150명 이상 한꺼번에 스폰되면 정착 과정에서 순간적으로 튕겨나가는 공이
      // 실제로 있었는데, 스폰 밴드 위쪽(y=startY보다 더 위)은 원래 벽이 아예
      // 없어서 그대로 멀리(최대 4000px 가까이) 날아가는 걸 실측으로 확인했다.
      // 벽을 y=-4200까지 그대로 연장해서 스폰 밴드 전체를 감싸도록 했다
      // (1,000명 스폰 그리드 높이까지 커버하도록 나중에 더 끌어올렸다).
      // 마지막 병목 출구(원본 그대로면 741.4~781, 폭 39.6px)가 150명 규모에서
      // 정체가 심하다는 피드백에 따라 마블 한 개 지름(22px)만큼 좌우 11px씩
      // 넓혔었는데(폭 39.6->61.6px), 그 다음 "넓힌 만큼의 절반만 다시 좁혀달라"는
      // 요청에 따라 좌우 5.5px씩 다시 좁혔다 — 결과적으로 원본보다 11px만
      // 넓은 폭(50.6px)이 됐다. 회전 막대 축(693, 아래 spinners)은 여전히
      // 그대로 둬서 "벽 기울기+막대 축을 같이 옮겨서 상호작용이 깨지는" 문제를 피한다.
      { restitution: 0, points: [[60.0,-4200], [60.0,-2640], [484.0,374.0], [165.0,847.0], [165.0,1144], [506.0,1320], [506.0,1474.0], [132.0,1804], [132.0,2365.0], [440.0,2585.0], [440.0,2772], [484.0,2816], [440.0,2860], [440.0,4367.0], [735.9,4697.0], [735.9,4917.0]] },
      { restitution: 0, points: [[1205.0,-4200], [1205.0,-2640], [803.0,407.0], [495.0,880], [495.0,990.0], [847.0,1144], [847.0,1474.0], [1133.0,1694.0], [913.0,2002.0], [913.0,2442.0], [1133.0,2607.0], [1133.0,2772], [1089.0,2816], [1133.0,2860], [1133.0,4422.0], [786.5,4697.0], [786.5,4917.0]] },
      { restitution: 0, points: [[638.0,1650.0], [385.0,1914.0], [385.0,2189.0], [638.0,2365.0], [638.0,1650.0]] },
      { restitution: 0, points: [[726.0,1650.0], [726.0,1892], [847.0,1771.0], [726.0,1650.0]] },
    ],
    ramps: [
      { x: 759.0, y: 1320.0, length: 17.6, thickness: 17.6, angle: -45, restitution: 1 },
      { x: 759.0, y: 1408, length: 17.6, thickness: 17.6, angle: -45, restitution: 0 },
      { x: 759.0, y: 1232, length: 17.6, thickness: 17.6, angle: -45, restitution: 0 },
      { x: 627.0, y: 1320, length: 17.6, thickness: 17.6, angle: -45, restitution: 0 },
      { x: 627.0, y: 1408, length: 17.6, thickness: 17.6, angle: -45, restitution: 0 },
      { x: 627.0, y: 1232, length: 17.6, thickness: 17.6, angle: -45, restitution: 0 },
      { x: 490.6, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 574.2, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 657.8, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 741.4, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 825.0, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 908.6, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 987.8, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 1075.8, y: 2930.4, length: 52.8, thickness: 8.8, angle: 45, restitution: 0 },
      { x: 490.6, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 574.2, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 657.8, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 741.4, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 825.0, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 908.6, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 987.8, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 1075.8, y: 3040.4, length: 52.8, thickness: 8.8, angle: -45, restitution: 0 },
      { x: 495.0, y: 4048, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 638.0, y: 4048, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 781.0, y: 4048, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 924.0, y: 4048, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 1067.0, y: 4048, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 561.0, y: 4180, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 704.0, y: 4180, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 847.0, y: 4180, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 990.0, y: 4180, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 495.0, y: 4312, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 638.0, y: 4312, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 781.0, y: 4312, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 924.0, y: 4312, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
      { x: 1067.0, y: 4312, length: 22.0, thickness: 22.0, angle: 0.7853981633974483, restitution: 0 },
    ],
    spinners: [
      { x: 429.0, y: 3300, armLength: 176, armThickness: 8.8, angularSpeed: 3.5, restitution: 0 },
      { x: 605.0, y: 3300, armLength: 176, armThickness: 8.8, angularSpeed: -3.5, restitution: 0 },
      { x: 781.0, y: 3300, armLength: 176, armThickness: 8.8, angularSpeed: 3.5, restitution: 0 },
      { x: 957.0, y: 3300, armLength: 176, armThickness: 8.8, angularSpeed: -3.5, restitution: 0 },
      { x: 1133.0, y: 3300, armLength: 176, armThickness: 8.8, angularSpeed: 3.5, restitution: 0 },
      { x: 693.0, y: 4697.0, armLength: 176, armThickness: 8.8, angularSpeed: -1.2, restitution: 0 },
    ],
    pegs: [
    ],
    },
    potOfGreed: {
      title: "MAP 2",
      width: 1232,
      startY: -2640,
      goalY: 4004.0,
      zoomY: 4070.0, // 원본 stage.zoomY(92.5m)*44 — 카메라 확대/슬로우 기준점
      totalHeight: 4439.2,
      ceiling: { x1: 60.0, x2: 1172.0, y: -4200 }, // wheelOfFortune 쪽 주석 참고
      // 이 맵은 결승 직전이 좁은 관이 아니라 넓은 "항아리"(위쪽 y=2706 근처부터
      // 벌어져서 아래쪽 y=4039 근처까지 이어지는 통짜 구조)라서, 다른 맵처럼
      // 마지막 공의 y좌표를 그대로 쫓아가면 그 순간 공이 있는 위치 근처만
      // 보이고 항아리 위/아래 나머지는 화면 밖으로 잘려나간다(실제로 "항아리
      // 상부만 보이고 하부가 안 보인다"는 피드백으로 확인). 그래서 마지막 공이
      // 이 y범위(항아리 입구)에 들어오면, 그 이후로는 공의 정확한 y를 쫓아가는
      // 대신 항아리 전체(minY~maxY)가 화면에 다 들어오도록 카메라를 고정한다.
      finaleView: { enterY: 2700, minY: 2650, maxY: 4090, focusX: 616 },
    polylines: [
      // 여기도 동일하게 천장 역할을 하던 첫 점(792,-2640)을 지웠다.
      // 여기도 동일하게 입구만 넓혔다(자세한 이유는 wheelOfFortune 쪽 주석 참고).
      { restitution: 0, points: [[60,-4200], [60,-2640], [440,374.0], [132,660], [308,2706.0]] },
      { restitution: 0, points: [[352,2956.8], [440,3748.8], [396,3735.6], [308,3722.4], [264,3458.4], [220,2930.4], [352,2956.8]] },
      { restitution: 0, points: [[1172,-4200], [1172,-2640], [792,374.0], [1100,660], [924,2706.0]] },
      { restitution: 0, points: [[880,2956.8], [792,3748.8], [836,3735.6], [924,3722.4], [968,3458.4], [1012,2930.4], [880,2956.8]] },
      { restitution: 0, points: [[528,3405.6], [572,3458.4], [572,4039.2]] },
      { restitution: 0, points: [[704,3405.6], [660,3458.4], [660,4039.2]] },
      { restitution: 0, points: [[572,3775.2], [528,3801.6], [440,3828], [396,3828], [308,3801.6], [264,3775.2], [220,3722.4], [176,3458.4], [132,2930.4], [176,2798.4], [220,2745.6], [264,2719.2], [308,2706.0]] },
      { restitution: 0, points: [[660,3775.2], [704,3801.6], [792,3828], [836,3828], [924,3801.6], [968,3775.2], [1012,3722.4], [1056,3458.4], [1100,2930.4], [1056,2798.4], [1012,2745.6], [968,2719.2], [924,2706.0]] },
    ],
    ramps: [
      { x: 616, y: 880, length: 264, thickness: 264, angle: 0.7853981633974483, restitution: 0 },
      { x: 616, y: 2420, length: 264, thickness: 264, angle: 0.7853981633974483, restitution: 0 },
      { x: 396, y: 1628, length: 176, thickness: 176, angle: 0.7853981633974483, restitution: 0 },
      { x: 836, y: 1628, length: 176, thickness: 176, angle: 0.7853981633974483, restitution: 0 },
    ],
    spinners: [
      { x: 528, y: 528, armLength: 176, armThickness: 8.8, angularSpeed: -3, restitution: 0 },
      { x: 704, y: 528, armLength: 176, armThickness: 8.8, angularSpeed: 3, restitution: 0 },
      { x: 396, y: 3828, armLength: 88, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 308, y: 3801.6, armLength: 132.0, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 220, y: 3722.4, armLength: 132.0, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 198.0, y: 3590.4, armLength: 176, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 176, y: 3458.4, armLength: 176, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 165.0, y: 3326.4, armLength: 176, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 154.0, y: 3194.4, armLength: 176, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 143.0, y: 3062.4, armLength: 176, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 132, y: 2930.4, armLength: 176, armThickness: 8.8, angularSpeed: -10, restitution: 0 },
      { x: 836, y: 3828, armLength: 88, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 924, y: 3801.6, armLength: 132.0, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 1012, y: 3722.4, armLength: 132.0, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 1034.0, y: 3590.4, armLength: 176, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 1056, y: 3458.4, armLength: 176, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 1067.0, y: 3326.4, armLength: 176, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 1078.0, y: 3194.4, armLength: 176, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 1089.0, y: 3062.4, armLength: 176, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
      { x: 1100, y: 2930.4, armLength: 176, armThickness: 8.8, angularSpeed: 10, restitution: 0 },
    ],
    pegs: [
    ],
    },
  };
  // 각 스테이지 입구 튜브의 실제 안쪽 좌우 벽 x좌표(px). polylines[0]/[1]의
  // 천장 모서리 바로 아래 지점에서 읽었다.
  // 입구를 훨씬 넓혔으므로(스폰 위치 근처 y=startY+20은 그 넓어진 부분 맨 위라
  // 거의 전체 폭이다) 스폰 범위도 그 넓은 폭 기준으로 여유 20px만 남기고 잡는다
  // — 150명 이상도 몇 줄 안 쌓이고 넉넉하게 들어가면서, 여전히 벽 안쪽이라
  // 튜브 밖으로 튀어나가지 않는다.
  const SPAWN_TUBES = {
    wheelOfFortune: { minX: 80, maxX: 1185 },
    potOfGreed: { minX: 80, maxX: 1152 },
  };

  function buildStage(key) {
    const stage = PORTED_STAGES[key];
    const entities = [];
    for (const p of stage.polylines) {
      entities.push(...polylineToWalls(p.points, WALL_THICK, p.restitution));
    }
    if (stage.ceiling) {
      // 좌우 입구 벽의 맨 위(y=ceiling.y)를 이어주는 천장. 이게 없으면 150명
      // 스폰 시 무리 압력으로 튕겨나간 마블이 벽 위쪽 뚫린 틈으로 그대로
      // 빠져나가 코스 밖 수천 px까지 날아가는 걸 실측으로 확인했다(P74가
      // frame 130에 y=-3866, x=1411까지 이탈). 좌우 벽과 겹치도록 살짝
      // 넓게(WALL_THICK만큼) 잡아서 모서리 틈도 막는다.
      const { x1, x2, y } = stage.ceiling;
      entities.push(wallSeg(x1 - WALL_THICK, y, x2 + WALL_THICK, y, WALL_THICK, 0));
    }
    for (const r of stage.ramps) {
      entities.push({ type: "ramp", x: r.x, y: r.y, length: r.length, thickness: r.thickness, angle: r.angle, restitution: r.restitution });
    }
    for (const s of stage.spinners) {
      entities.push({ type: "spinner", x: s.x, y: s.y, armLength: s.armLength, armThickness: s.armThickness, angularSpeed: s.angularSpeed, arms: 1, restitution: s.restitution });
    }
    for (const p of stage.pegs) {
      entities.push({ type: "peg", x: p.x, y: p.y, r: p.r, restitution: p.restitution });
    }

    const width = stage.width;
    const startY = stage.startY;
    // 스폰 범위는 코스 전체 폭이 아니라 입구 대기 튜브의 실제 안쪽 폭에서 잡아야
    // 한다 — 전체 폭 기준으로 잡았더니(예: 0.05~0.95) 튜브 벽보다 바깥에 마블이
    // 스폰되는 회귀가 실측으로 나왔다(레이스가 46초 -> 163초로 오히려 느려짐).
    // 튜브 안쪽 좌우 벽 x좌표를 스테이지마다 그대로 읽어서 그 안에서만 스폰한다.
    const tube = SPAWN_TUBES[key];
    return {
      key,
      title: stage.title,
      width,
      startY,
      goalY: stage.goalY,
      zoomY: stage.zoomY,
      finaleView: stage.finaleView || null,
      totalHeight: stage.totalHeight,
      spawnBounds: { minX: tube.minX, maxX: tube.maxX, minY: startY + 20, maxY: startY + 320 },
      entities,
    };
  }

  const STAGE_KEYS = ["wheelOfFortune", "potOfGreed"];

  global.MarbleCourseData = {
    stageKeys: STAGE_KEYS,
    titles: STAGE_KEYS.reduce((acc, k) => {
      acc[k] = PORTED_STAGES[k].title;
      return acc;
    }, {}),
    build: buildStage,
  };
  global.MarbleCourse = buildStage(STAGE_KEYS[0]);
})(window);
