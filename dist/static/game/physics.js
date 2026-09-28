/*
 * 마블 레이스 물리 레이어 — Box2D(box2d-wasm) 래퍼.
 * 참고 사이트(lazygyu/roulette, https://github.com/lazygyu/roulette)의
 * src/physics-box2d.ts를 그대로 따른다: 바디마다 friction을 따로 튜닝하지
 * 않고 Box2D 기본값(0.2)에 맡기고, density/restitution만 지정한다.
 * world.Step도 그쪽과 동일하게 (dt, velocityIterations=6, positionIterations=2)로
 * 딱 한 번만 호출한다 — 서브스텝을 임의로 늘리거나 마찰을 개별 조정하는 식의
 * 자체 판단은 넣지 않는다.
 *
 * course.js는 계속 px 좌표로 코스를 정의하고, camera.js/renderer.js도 px로만
 * 그린다 — px<->m 변환은 이 파일 안에서만 일어난다(다른 파일은 전혀 안 바뀜).
 */
(function (global) {
  "use strict";

  const PX_PER_METER = 44; // 마블 반지름 11px = 참고 사이트 마블 반지름 0.25m

  function toM(px) {
    return px / PX_PER_METER;
  }
  function toPx(m) {
    return m * PX_PER_METER;
  }

  let box2DModulePromise = null;
  function loadBox2D() {
    if (!box2DModulePromise) {
      box2DModulePromise = global.Box2D();
    }
    return box2DModulePromise;
  }

  function makeBox(Box2D, world, x, y, halfW, halfH, angle, restitution) {
    const bodyDef = new Box2D.b2BodyDef();
    bodyDef.set_type(Box2D.b2_staticBody);
    const body = world.CreateBody(bodyDef);
    body.SetTransform(new Box2D.b2Vec2(toM(x), toM(y)), angle || 0);
    const shape = new Box2D.b2PolygonShape();
    shape.SetAsBox(toM(halfW), toM(halfH));
    const fixtureDef = new Box2D.b2FixtureDef();
    fixtureDef.set_density(1);
    fixtureDef.set_restitution(restitution);
    fixtureDef.set_shape(shape);
    body.CreateFixture(fixtureDef);
    return body;
  }

  function makeCircle(Box2D, world, x, y, r, restitution) {
    const bodyDef = new Box2D.b2BodyDef();
    bodyDef.set_type(Box2D.b2_staticBody);
    const body = world.CreateBody(bodyDef);
    body.SetTransform(new Box2D.b2Vec2(toM(x), toM(y)), 0);
    const shape = new Box2D.b2CircleShape();
    shape.set_m_radius(toM(r));
    const fixtureDef = new Box2D.b2FixtureDef();
    fixtureDef.set_density(1);
    fixtureDef.set_restitution(restitution);
    fixtureDef.set_shape(shape);
    body.CreateFixture(fixtureDef);
    return body;
  }

  // Matter.Bodies.polygon과 같은 정점 배치(첫 정점이 위를 향함)를 그대로 써서
  // sides=4는 다이아몬드, sides=3은 꼭짓점이 위인 역삼각형이 되어 공이 얹히는
  // 수평 "선반"이 생기지 않는다.
  function makePolygon(Box2D, world, x, y, sides, radius, angle, restitution) {
    const bodyDef = new Box2D.b2BodyDef();
    bodyDef.set_type(Box2D.b2_staticBody);
    const body = world.CreateBody(bodyDef);
    body.SetTransform(new Box2D.b2Vec2(toM(x), toM(y)), angle || 0);
    const rM = toM(radius);
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / sides;
      pts.push([Math.cos(a) * rM, Math.sin(a) * rM]);
    }
    const shape = new Box2D.b2PolygonShape();
    const [vecArray, freeVecArray] = Box2D.tuplesToVec2Array(pts);
    shape.Set(vecArray, sides);
    freeVecArray();
    const fixtureDef = new Box2D.b2FixtureDef();
    fixtureDef.set_density(1);
    fixtureDef.set_restitution(restitution);
    fixtureDef.set_shape(shape);
    body.CreateFixture(fixtureDef);
    return body;
  }

  async function createPhysics(course) {
    const Box2D = await loadBox2D();
    const world = new Box2D.b2World(new Box2D.b2Vec2(0, 10));
    // Box2D는 기본적으로 속도가 한동안 낮으면 바디를 재워서(sleep) 그 다음부터는
    // 중력조차 적용하지 않는다 — 마블이 스폰 직후 서로 부딪히며 잠깐 느려지는
    // 순간에 잠들어버리면, 주변에 아무도 안 건드리는 한 영원히 깨지 않고 허공에
    // 떠 있는 것처럼 멈춘다(장애물 모양을 완전히 바꿔도 정확히 같은 자리에
    // 멈춰있는 걸로 실측 확인 — 장애물이 아니라 이 슬립이 원인이었다).
    world.SetAllowSleeping(false);

    const spinners = [];
    const bodies = [];

    for (const ent of course.entities) {
      if (ent.type === "wallSeg") {
        const cx = (ent.x1 + ent.x2) / 2;
        const cy = (ent.y1 + ent.y2) / 2;
        const length = Math.max(2, Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1));
        const angle = Math.atan2(ent.y2 - ent.y1, ent.x2 - ent.x1);
        bodies.push(makeBox(Box2D, world, cx, cy, length / 2, (ent.thickness || 16) / 2, angle, ent.restitution ?? 0.05));
      } else if (ent.type === "peg") {
        bodies.push(makeCircle(Box2D, world, ent.x, ent.y, ent.r, ent.restitution ?? 0.35));
      } else if (ent.type === "fillet") {
        bodies.push(makeCircle(Box2D, world, ent.x, ent.y, ent.r, 0.05));
      } else if (ent.type === "ramp") {
        bodies.push(makeBox(Box2D, world, ent.x, ent.y, ent.length / 2, ent.thickness / 2, ent.angle, ent.restitution ?? 0.08));
      } else if (ent.type === "wedge") {
        bodies.push(makePolygon(Box2D, world, ent.x, ent.y, ent.sides || 3, ent.size, ent.angle || 0, 0.3));
      } else if (ent.type === "pentagon") {
        bodies.push(makePolygon(Box2D, world, ent.x, ent.y, 5, ent.radius, 0, 0.25));
      } else if (ent.type === "spinner") {
        // 참고 사이트처럼 kinematic 바디에 각속도를 한 번만 설정해두면 Box2D가
        // 매 Step마다 알아서 회전시켜준다 — 우리가 매 프레임 각도를 직접
        // 갱신할 필요가 없다(예전 Matter 버전과의 핵심 차이).
        const bodyDef = new Box2D.b2BodyDef();
        bodyDef.set_type(Box2D.b2_kinematicBody);
        const body = world.CreateBody(bodyDef);
        body.SetTransform(new Box2D.b2Vec2(toM(ent.x), toM(ent.y)), 0);

        const armLenHalfM = toM(ent.armLength) / 2;
        const armThickHalfM = toM(ent.armThickness) / 2;

        const spinnerRestitution = ent.restitution ?? 0.25;
        const shape1 = new Box2D.b2PolygonShape();
        shape1.SetAsBox(armLenHalfM, armThickHalfM);
        const fd1 = new Box2D.b2FixtureDef();
        fd1.set_density(1);
        fd1.set_restitution(spinnerRestitution);
        fd1.set_shape(shape1);
        body.CreateFixture(fd1);

        if ((ent.arms || 2) >= 2) {
          const shape2 = new Box2D.b2PolygonShape();
          shape2.SetAsBox(armThickHalfM, armLenHalfM);
          const fd2 = new Box2D.b2FixtureDef();
          fd2.set_density(1);
          fd2.set_restitution(spinnerRestitution);
          fd2.set_shape(shape2);
          body.CreateFixture(fd2);
        }

        body.SetAngularVelocity(ent.angularSpeed);
        bodies.push(body);
        spinners.push({
          _b2body: body,
          body: { position: { x: ent.x, y: ent.y } },
          angle: 0,
          armLength: ent.armLength,
          armThickness: ent.armThickness,
          arms: ent.arms || 2,
        });
      }
    }

    return { Box2D, world, spinners, sliders: [], bodies };
  }

  function disposePhysics(physics) {
    if (!physics) return;
    try {
      physics.world.__destroy__();
    } catch (e) {
      // 페이지 세션 안에서 레이스를 반복할 때 이전 월드를 정리하는 용도라,
      // 실패해도 게임 진행에는 영향이 없다 — 콘솔에만 남긴다.
      console.warn("disposePhysics failed", e);
    }
  }

  const MARBLE_COLORS = [
    "#4bbdce",
    "#d9c16c",
    "#e88a8a",
    "#8ac48a",
    "#b28ae8",
    "#e8a45c",
    "#7fb8e8",
    "#e87fb0",
    "#9fd6c8",
    "#c8a6e8",
  ];

  function spawnMarbles(physics, course, names) {
    const { Box2D, world } = physics;
    const marbles = [];
    const { minX, maxX, minY, maxY } = course.spawnBounds;
    const cols = Math.max(1, Math.floor((maxX - minX) / 34));

    names.forEach((name, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      // 지터를 완전히 0으로 없앴더니(항상 같은 격자) 오히려 일부 마블이 완전히
      // 대칭인 위치에 스폰되면서 그 자리에서 아예 안 움직이는 경우가 실측으로
      // 나왔다(대칭 정지 상태) — 그래서 눈에는 거의 안 보일 만큼 아주 작은
      // 지터(±1.5px)만 남겨서 "일정한 높이/배치"로 보이면서도 완전 대칭은 깬다.
      // (예전엔 Math.max(y, minY) 클램프도 있었는데, row가 늘수록 y가 더
      // 작아지는(위로 쌓이는) 게 정상인데 그 클램프가 row>=1인 마블을 전부
      // minY 한 줄에 뭉개버렸다 — 삭제했다.)
      const x = minX + col * 34 + 17 + (Math.random() - 0.5) * 3;
      const y = minY - row * 34 + (Math.random() - 0.5) * 3;

      const bodyDef = new Box2D.b2BodyDef();
      bodyDef.set_type(Box2D.b2_dynamicBody);
      const body = world.CreateBody(bodyDef);
      body.SetTransform(new Box2D.b2Vec2(toM(x), toM(y)), 0);
      const shape = new Box2D.b2CircleShape();
      shape.set_m_radius(toM(11));
      // (shape, density) 축약형 — 참고 사이트의 createMarble과 동일하게 friction/
      // restitution은 지정하지 않고 Box2D 기본값(friction 0.2, restitution 0)을 쓴다.
      body.CreateFixture(shape, 1 + Math.random());
      // 예전엔 여기서 SetBullet(true)를 켰다 — 150명 이상 스폰 시 다닥다닥
      // 붙은 마블이 정착하며 튕겨서 벽을 뚫는 걸 막으려는 목적이었는데,
      // bullet(연속충돌검사)은 Box2D에서 가장 비싼 연산이라 수천 개가 겹친
      // 채로 있으면 오히려 브라우저가 멈출 정도로 느려졌다(실측 확인). 참고
      // 사이트(lazygyu/roulette)도 bullet을 아예 안 쓰길래 여기서도 뺐다 —
      // 대신 벽 두께(WALL_THICK=8px, 원본은 0)가 이미 원본보다 두꺼워서
      // 어느 정도는 터널링에 덜 취약하다.
      physics.bodies.push(body);

      // 참고 사이트 src/marble.ts의 스킬 게이지 그대로 — 원본은 maxCoolTime =
      // 1000 + (1-weight)*4000(ms), skillRate = 0.2*weight로 참가자별
      // weight에 따라 달라지는데, 이름만 넣는 우리 방식(전원 동일 가중치)에서는
      // 원본 roulette.ts의 정규화 로직상 weight가 전부 0.1로 맞춰진다.
      // 그 값을 그대로 대입하면 maxCoolTime=4.6초, skillRate=0.02(2%) ->
      // 쿨타임이 찰 때마다 2% 확률로 발동, 평균 약 230초(3.8분)에 한 번.
      // 시작 시점도 무작위로 흩어놓는다.
      const marble = {
        id: index,
        name,
        color: MARBLE_COLORS[index % MARBLE_COLORS.length],
        body: { position: { x, y }, velocity: { x: 0, y: 0 } },
        _b2body: body,
        finished: false,
        finishTime: 0,
        rank: 0,
        coolTime: Math.random() * 4.6,
        maxCoolTime: 4.6,
        skillRate: 0.02,
      };
      marbles.push(marble);
    });

    return marbles;
  }

  function applyImpulse(physics, marble, ix, iy) {
    if (!marble._b2body) return;
    marble._b2body.ApplyLinearImpulseToCenter(new physics.Box2D.b2Vec2(ix, iy), true);
  }

  const IMPACT_RADIUS_PX = 440; // 참고 사이트 physics-box2d.ts impact()의 10m 반경
  const IMPACT_RADIUS_M = IMPACT_RADIUS_PX / PX_PER_METER;

  // 참고 사이트 physics-box2d.ts의 impact()를 그대로 옮겼다: 충격파를 낸 마블을
  // 중심으로 반경 10m 안의 다른 마블들에게, 거리가 가까울수록 강하게(거리 비율의
  // 제곱에 5를 곱한 크기) 바깥쪽으로 미는 충격량을 준다.
  function impact(physics, marbles, source) {
    if (!source._b2body) return;
    const srcPos = source._b2body.GetPosition();
    for (const marble of marbles) {
      if (marble === source || marble.finished || !marble._b2body) continue;
      const pos = marble._b2body.GetPosition();
      const dx = pos.x - srcPos.x;
      const dy = pos.y - srcPos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < IMPACT_RADIUS_M * IMPACT_RADIUS_M && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const power = 1 - dist / IMPACT_RADIUS_M;
        const scale = (power * power * 5) / dist;
        marble._b2body.ApplyLinearImpulseToCenter(new physics.Box2D.b2Vec2(dx * scale, dy * scale), true);
      }
    }
  }

  function stepPhysics(physics, marbles, dtSeconds, simTime, goalY) {
    const { world, Box2D } = physics;

    // 참고 사이트와 동일하게 (dt, velocityIterations=6, positionIterations=2)로
    // 딱 한 번만 부른다 — Box2D 자체 solver/CCD에 맡긴다.
    world.Step(dtSeconds, 6, 2);

    for (const spinner of physics.spinners) {
      spinner.angle = spinner._b2body.GetAngle();
    }

    const justFinished = [];
    for (const marble of marbles) {
      if (marble.finished) {
        continue;
      }

      const pos = marble._b2body.GetPosition();
      const vel = marble._b2body.GetLinearVelocity();
      const x = toPx(pos.x);
      const y = toPx(pos.y);
      marble.body.position.x = x;
      marble.body.position.y = y;
      marble.body.velocity.x = toPx(vel.x);
      marble.body.velocity.y = toPx(vel.y);

      const withinTrack = Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 4000 && y < goalY + 4000;
      if (!withinTrack) {
        // 안전장치: 수치 폭주로 좌표가 비정상이 되면 안전한 위치로 되돌린다.
        const safeX = 320 + (Math.random() - 0.5) * 60;
        const safeY = Math.max(-200, Math.min(y, goalY - 200));
        marble._b2body.SetTransform(new Box2D.b2Vec2(toM(safeX), toM(safeY)), marble._b2body.GetAngle());
        marble._b2body.SetLinearVelocity(new Box2D.b2Vec2(0, 0));
        marble.body.position.x = safeX;
        marble.body.position.y = safeY;
        continue;
      }

      if (y >= goalY) {
        marble.finished = true;
        marble.finishTime = simTime;
        justFinished.push(marble);
      }
    }

    return justFinished;
  }

  global.MarblePhysics = { createPhysics, disposePhysics, spawnMarbles, stepPhysics, applyImpulse, impact, MARBLE_COLORS };
})(window);
