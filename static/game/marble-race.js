/*
 * 마블 레이스 게임 오케스트레이터 — physics/camera/course/renderer를 묶어서
 * idle -> arranged -> countdown -> running -> finished 흐름을 관리한다.
 * DOM/UI는 전혀 모르고, 콜백을 통해서만 바깥(ui.js)과 통신한다.
 *
 * 게임 규칙: 출구(goalY)에 먼저 들어간 공일수록 먼저 "탈락"한다.
 * 마지막까지 남아 결승선을 통과하는 공이 최종 우승이다 — 즉 물리적으로는
 * 예전과 동일한 "모두가 결승선까지 굴러떨어지는" 레이스이고, finishOrder는
 * "탈락 순서"를 의미한다(뒤집어서 보여주면 우승 순위가 된다).
 */
(function (global) {
  "use strict";

  const { createPhysics, disposePhysics, spawnMarbles, stepPhysics, impact, applyImpulse } = global.MarblePhysics;
  const { createCamera, updateCamera } = global.MarbleCamera;
  const { renderRace } = global.MarbleRenderer;
  // 스테이지를 바꿀 수 있어야 해서 const가 아니라 let이다 — setStage()가 재할당하면
  // 이 클로저를 공유하는 모든 함수(arrange/start/loop 등)가 새 코스를 바로 쓴다.
  let course = global.MarbleCourse;

  // 참고 사이트(lazygyu/roulette) src/camera.ts, src/roulette.ts의 카메라 확대/
  // 슬로모션 공식을 그대로 가져왔다 — 우리가 임의로 만든 값이 아니다.
  // zoomThreshold=5m, initialZoom 관련 배율=4배는 그쪽 data/constants.ts 값을
  // px 기준(44px=1m)으로 환산한 것이다.
  const ZOOM_THRESHOLD_PX = 220; // 5m * 44px/m
  const ZOOM_MAX_FACTOR = 4;
  const HOLD_FAST_FACTOR = 2.6;

  // "난입" 기믹(diayo.net 핀볼 참고) — 생존자가 얼마 안 남아 판이 갈릴 때
  // 팬 캐릭터가 튀어나와서 탈락 직전인 마블을 쳐내 순위를 흔든다.
  // 참가자 수가 적을수록 판 자체가 금방 끝나니 발동 구간/횟수도 좁게,
  // 많을수록 후반부 전체에 걸쳐 여러 번 퍼져서 나오도록 참가자 수 구간별로
  // 값을 다르게 잡는다(사용자 지정값).
  const INTRUSION_COOLDOWN_SEC = 4;

  // 생존자가 몇 명 남았을 때부터 몇 명 남을 때까지 난입이 발동 가능한가.
  function getIntrusionSurvivorRange(totalCount) {
    if (totalCount < 10) return { min: 3, max: 6 };
    if (totalCount < 50) return { min: 3, max: 7 };
    if (totalCount < 100) return { min: 4, max: 12 };
    if (totalCount < 200) return { min: 4, max: 20 };
    if (totalCount < 500) return { min: 4, max: 30 };
    return { min: 4, max: 50 }; // <1,000명 (참가자 상한이 1,000이라 이 구간이 최대)
  }

  // 이펙트별 레이스당 최대 발동 횟수 — 참가자 수와 무관하게 납치/펀치 각각
  // 레이스당 최대 1번으로 고정한다(발동 조건/구간은 그대로 유지).
  function getIntrusionMaxCount(_effect, _totalCount) {
    return 1;
  }

  // 이펙트별 연출 길이/타격 시점 — 납치는 캐릭터가 마블을 원래 있던 자리에서
  // 슬롯까지 들어올리는 움직임이 보여야 해서 펀치보다 길게 잡았다.
  const INTRUSION_CONFIG = {
    punch: { pauseSec: 2.6, hitAtSec: 1.3 },
    kidnap: { pauseSec: 2.8, hitAtSec: 1.7 },
  };

  let state = null;

  function resizeCanvasToDisplaySize(canvas) {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(240, Math.round(rect.width));
    const h = Math.max(240, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return { cssW: w, cssH: h, dpr };
  }

  function init(canvas, callbacks) {
    stop();
    state = {
      canvas,
      ctx2d: canvas.getContext("2d"),
      callbacks: callbacks || {},
      phase: "idle",
      speedMultiplier: 1,
      holdFast: false,
      holdFastBlend: 0,
      slowmoActive: false,
      slowmoBlend: 0,
      physics: null,
      camera: createCamera(course),
      marbles: [],
      finishOrder: [],
      effects: [],
      simTime: 0,
      lastTs: 0,
      rafId: 0,
      countdownUntil: 0,
      countdownValue: 0,
      intrusion: createIntrusionState(false),
    };
    resizeCanvasToDisplaySize(canvas);
    if (typeof ResizeObserver !== "undefined") {
      // 캔버스 크기를 바꾸면 내용이 지워진다. running/countdown/finished 단계는
      // rAF 루프가 매 프레임 다시 그려주지만, idle/arranged처럼 정지 화면인
      // 단계는 아무도 다시 안 그려서 리사이즈 한 번에 화면이 새까맣게 비어버린다 —
      // 그래서 리사이즈될 때마다 현재 단계에 맞는 정지 프레임을 즉시 다시 그린다.
      state.resizeObserver = new ResizeObserver(() => {
        resizeCanvasToDisplaySize(canvas);
        if (state.physics) {
          renderStaticFrame();
        } else {
          renderIdleFrame();
        }
      });
      state.resizeObserver.observe(canvas.parentElement);
    }
    renderIdleFrame();
  }

  function renderIdleFrame() {
    if (!state) return;
    const { cssW, cssH, dpr } = resizeCanvasToDisplaySize(state.canvas);
    const ctx = state.ctx2d;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#0e1a1f";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(230, 240, 238, 0.55)";
    ctx.font = "15px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("참가자를 입력하고 시작을 눌러보세요", cssW / 2, cssH / 2);
  }

  function setSpeed(multiplier) {
    if (state) {
      state.speedMultiplier = multiplier;
    }
  }

  function setHoldFast(active) {
    if (state) {
      state.holdFast = active;
    }
  }

  // 스테이지(맵) 전환 — 진행 중인 물리는 정리하고 idle 화면으로 되돌린다.
  function setStage(key) {
    if (!global.MarbleCourseData || !global.MarbleCourseData.stageKeys.includes(key)) {
      return;
    }
    course = global.MarbleCourseData.build(key);
    if (!state) return;
    if (state.physics) {
      disposePhysics(state.physics);
    }
    state.physics = null;
    state.marbles = [];
    state.arrangedNames = null;
    state.finishOrder = [];
    state.effects = [];
    state.simTime = 0;
    state.phase = "idle";
    state.camera = createCamera(course);
    state.callbacks.onPhaseChange?.("idle");
    renderIdleFrame();
  }

  function getStageInfo() {
    if (!global.MarbleCourseData) return null;
    return { current: course.key, keys: global.MarbleCourseData.stageKeys, titles: global.MarbleCourseData.titles };
  }

  function namesMatch(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // "배치": 실제로 출발시키지 않고 참가자들을 코스 시작 지점에 미리 세워서 보여준다.
  // 물리 엔진은 존재하지만 running 단계가 아니므로 stepPhysics가 호출되지 않아 정지 상태를 유지한다.
  async function arrange(names) {
    if (!state || !names.length) {
      return;
    }
    const prevPhysics = state.physics;
    const physics = await createPhysics(course);
    if (!state) return; // 대기 중 stop()이 호출된 경우
    if (prevPhysics) disposePhysics(prevPhysics);
    state.physics = physics;
    state.marbles = spawnMarbles(state.physics, course, names);
    state.arrangedNames = names.slice();
    state.finishOrder = [];
    state.effects = [];
    state.camera = createCamera(course);
    state.simTime = 0;
    state.phase = "arranged";
    state.callbacks.onPhaseChange?.("arranged");
    state.callbacks.onStatsUpdate?.({ total: names.length, alive: names.length, out: 0 });
    renderStaticFrame();
  }

  function renderStaticFrame() {
    if (!state) return;
    const { cssW, cssH, dpr } = resizeCanvasToDisplaySize(state.canvas);
    const ctx = state.ctx2d;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateCamera(state.camera, state.marbles, course, cssW, cssH, 0.016, undefined, state.phase);
    renderRace(ctx, cssW, cssH, state.camera, state.physics, course, state.marbles);
  }

  async function start(names, options) {
    if (!state || !names.length) {
      return;
    }
    const intrusionEffects = options?.intrusionEffects || { kidnap: true, punch: true };
    const reuseArrangement = state.phase === "arranged" && namesMatch(state.arrangedNames, names);
    if (!reuseArrangement) {
      const prevPhysics = state.physics;
      const physics = await createPhysics(course);
      if (!state) return; // 대기 중 stop()이 호출된 경우
      if (prevPhysics) disposePhysics(prevPhysics);
      state.physics = physics;
      state.marbles = spawnMarbles(state.physics, course, names);
      state.camera = createCamera(course);
    }
    state.finishOrder = [];
    state.effects = [];
    const anyIntrusionEffectEnabled = Boolean(intrusionEffects.kidnap || intrusionEffects.punch);
    const survivorRange = getIntrusionSurvivorRange(names.length);
    const effectMaxCounts = {
      kidnap: getIntrusionMaxCount("kidnap", names.length),
      punch: getIntrusionMaxCount("punch", names.length),
    };
    state.intrusion = createIntrusionState(
      anyIntrusionEffectEnabled && names.length >= survivorRange.min,
      intrusionEffects,
      survivorRange,
      effectMaxCounts,
    );
    state.simTime = 0;
    state.holdFast = false;
    state.holdFastBlend = 0;
    state.slowmoActive = false;
    state.slowmoBlend = 0;
    state.phase = "countdown";
    state.countdownValue = 3;
    state.countdownUntil = performance.now() + 3000;
    state.callbacks.onPhaseChange?.("countdown", state.countdownValue);
    state.callbacks.onStatsUpdate?.({ total: names.length, alive: names.length, out: 0 });

    state.countdownTimer = setInterval(() => {
      state.countdownValue -= 1;
      if (state.countdownValue <= 0) {
        clearInterval(state.countdownTimer);
        state.phase = "running";
        state.callbacks.onPhaseChange?.("running");
      } else {
        state.callbacks.onPhaseChange?.("countdown", state.countdownValue);
      }
    }, 1000);

    state.lastTs = performance.now();
    if (!state.rafId) {
      state.rafId = requestAnimationFrame(loop);
    }
  }

  function createIntrusionState(enabled, effectsEnabled, survivorRange, effectMaxCounts) {
    return {
      enabled,
      effectsEnabled: effectsEnabled || { kidnap: true, punch: true },
      survivorRange: survivorRange || { min: 3, max: 6 },
      effectMaxCounts: effectMaxCounts || { kidnap: 1, punch: 1 },
      triggeredCount: 0,
      effectCounts: { kidnap: 0, punch: 0 },
      cooldown: 0,
      active: false,
      effect: null,
      timer: 0,
      hitApplied: false,
      targetMarble: null,
      hitStopRemaining: 0,
      shakeRemaining: 0,
      flashRemaining: 0,
    };
  }

  // 방금 탈락(finished=true)한 마블들을 순위에 반영하고, 마지막 1명이 남는
  // 순간 자동 우승 처리 + 레이스 종료까지 확인한다. stepPhysics로 인한 정상
  // 탈락과 납치로 인한 즉시 탈락이 이 로직을 공유한다.
  function finalizeEliminations(justFinished) {
    for (const marble of justFinished) {
      marble.rank = state.finishOrder.length + 1;
      state.finishOrder.push(marble);
    }
    let alive = state.marbles.length - state.finishOrder.length;
    state.callbacks.onFinishUpdate?.(state.finishOrder, justFinished);
    state.callbacks.onStatsUpdate?.({ total: state.marbles.length, alive, out: state.finishOrder.length });

    // 참고 사이트도 마지막 1명이 남으면 결승선을 실제로 통과하지 않아도
    // 그 순위를 확정한다(roulette.ts _checkFinish의 early 처리) — 마지막
    // 1개가 출구까지 굴러 들어가는 걸 기다리지 않고 바로 우승 처리한다.
    if (alive === 1) {
      const lastMarble = state.marbles.find((m) => !m.finished);
      if (lastMarble) {
        lastMarble.finished = true;
        lastMarble.rank = state.finishOrder.length + 1;
        state.finishOrder.push(lastMarble);
        alive = 0;
        state.callbacks.onFinishUpdate?.(state.finishOrder, [lastMarble]);
        state.callbacks.onStatsUpdate?.({ total: state.marbles.length, alive, out: state.finishOrder.length });
      }
    }

    if (state.finishOrder.length === state.marbles.length) {
      state.phase = "finished";
      state.callbacks.onPhaseChange?.("finished");
      // finishOrder[0] = 가장 먼저 탈락, finishOrder[last] = 마지막까지 남은 우승자.
      state.callbacks.onRaceEnd?.(state.finishOrder);
    }
  }

  // 탈락에 가장 가까운(=결승선에 가장 가까운, y가 가장 큰) 생존 마블을 고른다 —
  // 지금 막 탈락할 참인 애를 쳐내는 게 순위를 가장 극적으로 흔든다.
  function pickIntrusionTarget() {
    let target = null;
    let maxY = -Infinity;
    for (const marble of state.marbles) {
      if (marble.finished || !marble._b2body) continue;
      const y = marble.body.position.y;
      if (y > maxY) {
        maxY = y;
        target = marble;
      }
    }
    return target;
  }

  // 납치는 순위와 무관하게 아무나 잡아간다 — 잘 하고 있던 마블도 예외 없이
  // 끌려갈 수 있어야 "누구든 당할 수 있다"는 긴장감이 생긴다.
  function pickRandomAliveMarble() {
    const alive = state.marbles.filter((m) => !m.finished && m._b2body);
    if (!alive.length) return null;
    return alive[Math.floor(Math.random() * alive.length)];
  }

  // 이번 난입에 어떤 이펙트를 쓸지 고른다 — 둘 다 켜져 있으면 무작위, 하나만
  // 켜져 있으면 그것, 둘 다 꺼져 있으면 null(트리거 자체가 안 일어남).
  function pickEnabledIntrusionEffect(effectsEnabled, effectCounts, effectMaxCounts) {
    const options = [];
    for (const key of ["kidnap", "punch"]) {
      if (!effectsEnabled?.[key]) continue;
      if ((effectCounts?.[key] || 0) >= (effectMaxCounts?.[key] ?? 1)) continue;
      options.push(key);
    }
    if (!options.length) return null;
    return options[Math.floor(Math.random() * options.length)];
  }

  // 대상을 결승선 반대 방향(위)으로 세게 쳐올리고, impact()로 주변 마블까지
  // 같이 흩어놓는다 — marble.js의 자체 스킬 충격파보다 확실히 크게 느껴지도록
  // 힘을 더 준다.
  function applyIntrusionHit(marble) {
    if (!marble || !marble._b2body || marble.finished) return;
    const ix = (Math.random() - 0.5) * 3.2;
    const iy = -6.5;
    applyImpulse(state.physics, marble, ix, iy);
    impact(state.physics, state.marbles, marble);
    const pos = marble._b2body.GetPosition();
    state.effects.push({ x: pos.x, y: pos.y, elapsed: 0, lifetime: 0.6, big: true });
  }

  // 참고 사이트 src/roulette.ts의 _calcTimeScale()을 그대로 옮겼다: 카메라가
  // 주목하는 구슬(우리는 "가장 뒤처진 = 마지막까지 남을 우승 후보" 1명 고정,
  // 그쪽은 순위별 targetIndex)이 결승 기준점(zoomY)에 zoomThreshold보다 가까이
  // 왔고, 그 옆에 경쟁하는 다른 구슬이 있을 때만 goalDist/threshold 비율로
  // 느려진다(최소 0.2배) — 그 외에는 항상 1배다.
  function updateSlowmo(dt) {
    const alive = state.marbles.filter((m) => !m.finished);
    alive.sort((a, b) => a.body.position.y - b.body.position.y);
    const target = alive[0];
    let rawTimeScale = 1;
    let active = false;
    if (target) {
      const goalDist = Math.abs(course.zoomY - target.body.position.y);
      if (
        goalDist < ZOOM_THRESHOLD_PX &&
        alive.length > 1 &&
        target.body.position.y > course.zoomY - ZOOM_THRESHOLD_PX * 1.2
      ) {
        rawTimeScale = Math.max(0.2, goalDist / ZOOM_THRESHOLD_PX);
        active = true;
      }
    }
    state.slowmoActive = active;
    // on/off 전환 자체는 살짝 블렌딩해서 갑자기 튀지 않게 하되, 실제 배속 값은
    // 참고 사이트 공식(rawTimeScale) 그대로 쓴다.
    const blendTarget = active ? 1 : 0;
    state.slowmoBlend += (blendTarget - state.slowmoBlend) * Math.min(1, dt * 4);

    if (state.slowmoBlend > 0.02) {
      // 슬로모션이 (부분적으로라도) 활성화된 동안에는 꾹 누르기 배속을 무시해서
      // 두 가지 배속 조절이 서로 충돌하지 않게 한다.
      state.holdFastBlend += (0 - state.holdFastBlend) * Math.min(1, dt * 4);
    } else {
      const holdTarget = state.holdFast ? 1 : 0;
      state.holdFastBlend += (holdTarget - state.holdFastBlend) * Math.min(1, dt * 6);
    }

    const slowFactor = 1 - state.slowmoBlend * (1 - rawTimeScale);
    const fastFactor = 1 + state.holdFastBlend * (HOLD_FAST_FACTOR - 1);
    return slowFactor * fastFactor;
  }

  function loop(ts) {
    if (!state) {
      return;
    }
    if (state.phase === "idle") {
      // 여기서 그냥 return만 하면 아래(363번째 줄)의 자기 재예약(requestAnimationFrame)
      // 코드를 못 타서 루프 체인이 끊기는데, state.rafId는 이 콜백이 이미 소비한
      // (죽은) id를 그대로 들고 있는다 — start()의 "if (!state.rafId)" 가드가
      // 이 죽은 값을 "아직 루프가 돌고 있다"로 오인해서 다음 배치/시작 때 새
      // requestAnimationFrame을 아예 안 걸어버린다(맵 전환 후 시작하면 먹통되는
      // 버그의 원인). 여기서 확실히 0으로 되돌려서 다음 start()가 새로 예약하게 한다.
      state.rafId = 0;
      return;
    }
    // ts가 이전 프레임보다 거꾸로 가는 경우(탭 백그라운드 복귀 등 드문 상황)를
    // 대비해 하한도 같이 잡는다 — 안 그러면 dt가 음수가 되어 카메라 zoom이
    // 음수로 튀고 렌더러의 ctx.arc가 음수 반지름으로 크래시한다.
    const rawDt = Math.max(0.0001, Math.min(0.032, (ts - state.lastTs) / 1000 || 0.016));
    state.lastTs = ts;

    if (state.phase === "running" && state.intrusion.active) {
      // 난입 연출 중에는 물리를 멈추고 캐릭터 등장/타격/퇴장 타이밍만 진행한다.
      const timing = INTRUSION_CONFIG[state.intrusion.effect] || INTRUSION_CONFIG.punch;
      // 타격 순간 아주 잠깐(히트스톱) 연출을 멈춰서 "턱" 꽂히는 느낌을 준다 —
      // 격투 게임/액션 게임에서 흔히 쓰는 기법이다.
      if (state.intrusion.hitStopRemaining > 0) {
        state.intrusion.hitStopRemaining -= rawDt;
      } else {
        state.intrusion.timer += rawDt;
        if (!state.intrusion.hitApplied && state.intrusion.timer >= timing.hitAtSec) {
          if (state.intrusion.effect === "kidnap") {
            const target = state.intrusion.targetMarble;
            if (target && !target.finished) {
              target.finished = true;
              finalizeEliminations([target]);
            }
          } else {
            // 히트스톱/화면 흔들림/플래시는 실제로 "맞는" 펀치 전용 연출이다 —
            // 납치는 조용히 데려가는 쪽이라 이 타격 연출이 어울리지 않는다.
            applyIntrusionHit(state.intrusion.targetMarble);
            state.intrusion.hitStopRemaining = 0.08;
            state.intrusion.shakeRemaining = 0.3;
            state.intrusion.flashRemaining = 0.16;
          }
          state.intrusion.hitApplied = true;
        }
      }
      if (state.intrusion.shakeRemaining > 0) {
        state.intrusion.shakeRemaining = Math.max(0, state.intrusion.shakeRemaining - rawDt);
      }
      if (state.intrusion.flashRemaining > 0) {
        state.intrusion.flashRemaining = Math.max(0, state.intrusion.flashRemaining - rawDt);
      }
      if (state.intrusion.timer >= timing.pauseSec) {
        state.intrusion.active = false;
        state.intrusion.targetMarble = null;
      }
    } else if (state.phase === "running") {
      if (state.intrusion.cooldown > 0) {
        state.intrusion.cooldown -= rawDt;
      }
      const dynamicScale = updateSlowmo(rawDt);
      const dt = rawDt * state.speedMultiplier * dynamicScale;
      state.simTime += dt;

      const justFinished = stepPhysics(state.physics, state.marbles, dt, state.simTime, course.goalY);
      if (justFinished.length) {
        finalizeEliminations(justFinished);
      }

      // 참고 사이트 src/marble.ts의 스킬 게이지 — 모든 마블이 다 갖고, 쿨타임이
      // 다 차면 정해진 확률로 충격파를 낸다. 텍스트 안내 없이, 게이지가 차는 건
      // 렌더러가 마블 테두리에 호(arc)로 그려서 보여준다.
      // 시작하자마자(입구에 다닥다닥 몰린 채로) 바로 발동되면 어색하다는
      // 피드백에 따라, 코스를 20% 내려가기 전까지는 게이지 자체가 안 차게
      // (쿨타임을 안 줄임) 막아뒀다.
      const skillEligibleY = course.startY + (course.goalY - course.startY) * 0.2;
      for (const marble of state.marbles) {
        if (marble.finished || marble.body.position.y < skillEligibleY) continue;
        marble.coolTime -= dt;
        if (marble.coolTime <= 0) {
          if (Math.random() < marble.skillRate) {
            impact(state.physics, state.marbles, marble);
            state.effects.push({ x: marble.body.position.x, y: marble.body.position.y, elapsed: 0, lifetime: 0.5 });
          }
          marble.coolTime = marble.maxCoolTime;
        }
      }
      for (let i = state.effects.length - 1; i >= 0; i--) {
        const effect = state.effects[i];
        effect.elapsed += dt;
        if (effect.elapsed > effect.lifetime) {
          state.effects.splice(i, 1);
        }
      }

      const intr = state.intrusion;
      if (
        intr.enabled &&
        intr.cooldown <= 0 &&
        state.phase === "running"
      ) {
        const aliveCount = state.marbles.length - state.finishOrder.length;
        const { min: survivorMin, max: survivorMax } = intr.survivorRange;
        if (aliveCount > 1 && aliveCount >= survivorMin && aliveCount <= survivorMax) {
          const effect = pickEnabledIntrusionEffect(intr.effectsEnabled, intr.effectCounts, intr.effectMaxCounts);
          const target = effect === "kidnap" ? pickRandomAliveMarble() : pickIntrusionTarget();
          if (effect && target) {
            intr.active = true;
            intr.effect = effect;
            intr.timer = 0;
            intr.hitApplied = false;
            intr.hitStopRemaining = 0;
            intr.shakeRemaining = 0;
            intr.flashRemaining = 0;
            intr.targetMarble = target;
            if (effect === "kidnap") {
              // 트랙 위 원래 자리에는 안 그리고, drawIntrusion이 캐릭터
              // 쪽으로 옮겨 그리는 동안만 보이게 한다.
              target.hidden = true;
            }
            intr.triggeredCount += 1;
            intr.effectCounts[effect] = (intr.effectCounts[effect] || 0) + 1;
            intr.cooldown = INTRUSION_COOLDOWN_SEC;
          }
        }
      }
    }

    const { cssW, cssH, dpr } = resizeCanvasToDisplaySize(state.canvas);
    const ctx = state.ctx2d;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state.physics) {
      const intr = state.intrusion;
      const intrusionView = intr?.active
        ? {
            active: true,
            effect: intr.effect,
            progress: Math.min(1, intr.timer / (INTRUSION_CONFIG[intr.effect] || INTRUSION_CONFIG.punch).pauseSec),
            x: intr.targetMarble?.body?.position?.x ?? 0,
            y: intr.targetMarble?.body?.position?.y ?? 0,
            targetColor: intr.targetMarble?.color,
            targetName: intr.targetMarble?.name,
            hitApplied: intr.hitApplied,
            shake: intr.shakeRemaining > 0 ? intr.shakeRemaining / 0.3 : 0,
            flash: intr.flashRemaining > 0 ? intr.flashRemaining / 0.16 : 0,
          }
        : { active: false };
      updateCamera(state.camera, state.marbles, course, cssW, cssH, rawDt, intrusionView, state.phase);
      const survivalLeader = renderRace(
        ctx,
        cssW,
        cssH,
        state.camera,
        state.physics,
        course,
        state.marbles,
        state.effects,
        intrusionView,
      );
      state.callbacks.onLeaderUpdate?.(survivalLeader);

      if (state.slowmoBlend > 0.02) {
        ctx.fillStyle = `rgba(140, 190, 230, ${0.1 * state.slowmoBlend})`;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      if (state.holdFastBlend > 0.03) {
        drawHoldFastEffect(ctx, cssW, cssH, state.holdFastBlend, state.simTime);
      }
    }

    if (state.phase === "countdown" && state.countdownValue > 0) {
      ctx.fillStyle = "rgba(240, 220, 160, 0.92)";
      ctx.font = "bold 64px 'Gugi', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(state.countdownValue), cssW / 2, cssH / 2 + 22);
    }

    if (state.phase !== "finished") {
      state.rafId = requestAnimationFrame(loop);
    } else {
      state.rafId = 0;
    }
  }

  function stop() {
    if (state?.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    if (state?.countdownTimer) {
      clearInterval(state.countdownTimer);
    }
    if (state?.resizeObserver) {
      state.resizeObserver.disconnect();
    }
    if (state?.physics) {
      disposePhysics(state.physics);
    }
    state = null;
  }

  // 꾹 눌러 빨리감기 중임을 알려주는 연출: 화면 좌우로 속도선이 스쳐 지나가고
  // 하단에 배속 배지를 띄운다. holdFastBlend(0~1)로 부드럽게 나타나고 사라진다.
  function drawHoldFastEffect(ctx, cssW, cssH, blend, simTime) {
    ctx.save();
    ctx.globalAlpha = blend;
    ctx.strokeStyle = "rgba(240, 220, 160, 0.85)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const streakCount = 5;
    const cycle = 620;
    for (let i = 0; i < streakCount; i++) {
      const phase = ((simTime * 1000 * 1.4 + i * (cycle / streakCount)) % cycle) / cycle;
      const yy = phase * (cssH + 80) - 40;
      ctx.beginPath();
      ctx.moveTo(4, yy);
      ctx.lineTo(34, yy - 34);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cssW - 4, yy);
      ctx.lineTo(cssW - 34, yy - 34);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.min(1, blend * 1.3);
    ctx.fillStyle = "rgba(14, 26, 31, 0.55)";
    const label = "⏩ 빨리감기";
    ctx.font = "bold 13px 'Noto Sans KR', sans-serif";
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + 22;
    const boxX = cssW / 2 - boxW / 2;
    const boxY = cssH - 34;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(boxX, boxY, boxW, 22, 11);
    } else {
      ctx.rect(boxX, boxY, boxW, 22);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(240, 220, 160, 0.95)";
    ctx.textAlign = "center";
    ctx.fillText(label, cssW / 2, boxY + 15);
    ctx.restore();
  }

  function stepOnce(nowMs) {
    // 테스트/디버그 용도: 실제 화면 없이 프레임 하나를 강제로 진행시킨다.
    loop(nowMs);
  }

  function getDebugSnapshot() {
    if (!state) {
      return null;
    }
    return {
      phase: state.phase,
      simTime: state.simTime,
      finishedCount: state.finishOrder.length,
      finishOrder: state.finishOrder.map((m) => m.name),
      slowmoActive: state.slowmoActive,
      intrusion: {
        enabled: state.intrusion.enabled,
        effectsEnabled: state.intrusion.effectsEnabled,
        survivorRange: state.intrusion.survivorRange,
        effectMaxCounts: state.intrusion.effectMaxCounts,
        effectCounts: state.intrusion.effectCounts,
        triggeredCount: state.intrusion.triggeredCount,
        active: state.intrusion.active,
        effect: state.intrusion.effect,
        cooldown: state.intrusion.cooldown,
        timer: state.intrusion.timer,
        hitApplied: state.intrusion.hitApplied,
        hitStopRemaining: state.intrusion.hitStopRemaining,
        shakeRemaining: state.intrusion.shakeRemaining,
        flashRemaining: state.intrusion.flashRemaining,
      },
      marbles: state.marbles.map((m) => ({
        name: m.name,
        y: m.body ? m.body.position.y : null,
        x: m.body ? m.body.position.x : null,
        finished: m.finished,
      })),
    };
  }

  global.MarbleGame = { init, arrange, start, setSpeed, setHoldFast, setStage, getStageInfo, stop, stepOnce, getDebugSnapshot };
})(window);
