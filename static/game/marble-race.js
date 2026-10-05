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

  const {
    createPhysics,
    disposePhysics,
    spawnMarbles,
    stepPhysics,
    impact,
    applyImpulse,
    captureMarbleSnapshot,
    applyMarbleSnapshot,
    teleportMarbleTo,
    findSpinnerTouching,
    bounceOffSpinner,
  } = global.MarblePhysics;
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
  const INTRUSION_COOLDOWN_SEC = 5;

  // 이펙트가 정해진 뒤 실제 연출이 시작되기 전까지, 카메라가 먼저 그 자리로
  // 넘어가게 기다린다. 고정 시간(예전 0.6초)으로는 카메라가 멀리 있을 때 아직
  // 이동 중에 연출이 다 끝나버려서, "카메라가 실제로 도착했는지"를 보고 도착한
  // 뒤 LEAD_HOLD_SEC만큼 더 보여준 다음 시작한다. 혹시 도착 판정이 안 나도
  // LEAD_MAX_SEC가 지나면 그냥 시작한다.
  const LEAD_HOLD_SEC = 0.25;
  const LEAD_MAX_SEC = 2.0;
  // 카메라 초점이 화면 중앙에서 가로/세로 이 비율 안에 들어오고 배율이 목표의
  // ±15% 안이면 "도착"으로 본다.
  const CAMERA_SETTLED_SCREEN_FRACTION = 0.3;
  const CAMERA_SETTLED_ZOOM_TOLERANCE = 0.15;

  function createLead() {
    return { elapsed: 0, settledFor: 0 };
  }

  // 대기 시간을 한 프레임 진행시키고, 연출을 시작해도 되면 true.
  function advanceLead(lead, rawDt) {
    lead.elapsed += rawDt;
    lead.settledFor = state.cameraSettled ? lead.settledFor + rawDt : 0;
    return lead.settledFor >= LEAD_HOLD_SEC || lead.elapsed >= LEAD_MAX_SEC;
  }

  // 참가자가 적으면 시작하자마자 생존자 수 조건이 충족돼서 맵 꼭대기에서 바로
  // 난입이 터졌다 — 대상 마블이 코스를 이만큼(비율) 내려온 뒤에만 고르게 한다.
  const INTERFERENCE_ELIGIBLE_FRACTION = 0.2;

  // 생존자가 몇 명 남았을 때부터 몇 명 남을 때까지 난입이 발동 가능한가.
  function getIntrusionSurvivorRange(totalCount) {
    if (totalCount < 10) return { min: 3, max: 6 };
    if (totalCount < 50) return { min: 3, max: 7 };
    if (totalCount < 100) return { min: 4, max: 12 };
    if (totalCount < 200) return { min: 4, max: 20 };
    if (totalCount < 500) return { min: 4, max: 30 };
    return { min: 4, max: 50 }; // <1,000명 (참가자 상한이 1,000이라 이 구간이 최대)
  }

  // 이펙트별 연출 길이/타격(실제 효과 적용) 시점 — 납치는 캐릭터가 마블을
  // 원래 있던 자리에서 슬롯까지 들어올리는 움직임이 보여야 해서 펀치보다
  // 길게 잡았다. 섞기/워프는 hitAtSec 전까지 "멈춤 + 연출"을 보여주고,
  // hitAtSec 순간에 실제 자리 교환/순간이동이 적용된다.
  const INTRUSION_CONFIG = {
    punch: { pauseSec: 2.6, hitAtSec: 1.3 },
    kidnap: { pauseSec: 2.8, hitAtSec: 1.7 },
    // 섞기는 두 마블이 멀리 떨어져 있으면 카메라가 크게 축소된 상태라, 이동과
    // 도착 지점 표시를 따라갈 수 있게 조금 길게 잡는다.
    shuffle: { pauseSec: 1.8, hitAtSec: 1.1 },
    warp: { pauseSec: 1.7, hitAtSec: 0.85 },
  };

  // 납치/펀치/섞기/스턴/워프 다섯 가지를 "난입 조건" 하나로 묶어서 켜고 끄기 +
  // 레이스당 합산 최대 발동 횟수를 운영자가 직접 정한다(state.interference,
  // UI에서 지정). 다섯 다 생존자 수 구간(getIntrusionSurvivorRange)과 쿨타임
  // (INTRUSION_COOLDOWN_SEC)을 공유하는 같은 자동 발동 풀에서 무작위로 뽑힌다 —
  // 납치/펀치/섞기/워프는 캐릭터·연출이 있는 멈춤 애니메이션(state.intrusion)을
  // 타고, 스턴만 물리를 멈추지 않고(다른 마블은 계속 움직여야 "방해"가 되므로)
  // 그 마블만 그 자리에 고정한 채 레이더링 쪽에서 계속 지직거리는 이펙트를 그린다.
  const STUN_DURATION_SEC = 2.5;

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
      pendingStun: null,
      cameraSettled: false,
      warpTrail: [],
      warpTrailTimer: 0,
      interference: {
        enabledEffects: { kidnap: true, punch: true, shuffle: true, stun: true, warp: true },
        max: 0,
        used: 0,
        effectCounts: { kidnap: 0, punch: 0, shuffle: 0, stun: 0, warp: 0 },
      },
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
    const intrusionEffects = options?.intrusionEffects || { kidnap: true, punch: true, shuffle: true, stun: true, warp: true };
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
    const anyIntrusionEffectEnabled = Boolean(
      intrusionEffects.kidnap || intrusionEffects.punch || intrusionEffects.shuffle || intrusionEffects.stun || intrusionEffects.warp
    );
    const survivorRange = getIntrusionSurvivorRange(names.length);
    state.pendingStun = null;
    state.warpTrail = [];
    state.warpTrailTimer = 0;
    state.intrusion = createIntrusionState(
      anyIntrusionEffectEnabled && names.length >= survivorRange.min,
      survivorRange,
    );
    const interferenceMax = Math.max(0, Math.floor(Number(options?.interferenceMax ?? 3)) || 0);
    state.interference = {
      enabledEffects: {
        kidnap: Boolean(intrusionEffects.kidnap),
        punch: Boolean(intrusionEffects.punch),
        shuffle: Boolean(intrusionEffects.shuffle),
        stun: Boolean(intrusionEffects.stun),
        warp: Boolean(intrusionEffects.warp),
      },
      max: interferenceMax,
      used: 0,
      effectCounts: { kidnap: 0, punch: 0, shuffle: 0, stun: 0, warp: 0 },
    };
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

  function createIntrusionState(enabled, survivorRange) {
    return {
      enabled,
      survivorRange: survivorRange || { min: 3, max: 6 },
      triggeredCount: 0,
      cooldown: 0,
      active: false,
      effect: null,
      lead: null, // 연출 시작 전 카메라 이동 대기 상태(createLead), 없으면 null
      timer: 0,
      hitApplied: false,
      targetMarble: null,
      targetMarbleB: null, // 섞기 전용 — 맞바꿀 두 번째 마블.
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
  function isPastInterferenceLine(marble) {
    const lineY = course.startY + (course.goalY - course.startY) * INTERFERENCE_ELIGIBLE_FRACTION;
    return marble.body.position.y >= lineY;
  }

  function isInterferenceCandidate(marble) {
    return !marble.finished && marble._b2body && isPastInterferenceLine(marble);
  }

  function pickIntrusionTarget() {
    let target = null;
    let maxY = -Infinity;
    for (const marble of state.marbles) {
      if (!isInterferenceCandidate(marble)) continue;
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
    const alive = state.marbles.filter(isInterferenceCandidate);
    if (!alive.length) return null;
    return alive[Math.floor(Math.random() * alive.length)];
  }

  function isStunInProgress() {
    return Boolean(state.pendingStun) || state.marbles.some((m) => m.stunRemaining > 0);
  }

  // 이번 난입에 시도할 이펙트 순서 — 켜져 있는 것들 중 이번 레이스에서 덜
  // 나온 것부터(같은 횟수끼리는 무작위 순서). 그래서 켜둔 이펙트가 한 번씩 다
  // 나오기 전에는 같은 이펙트가 다시 나오지 않고, 최대 발동 횟수가 켜둔 개수보다
  // 많을 때만 두 바퀴째로 넘어가 중복이 생긴다. 스턴은 한 번에 한 마블만
  // 걸리도록, 이미 걸려 있거나 걸리기 직전이면 후보에서 뺀다.
  function orderInterferenceCandidates() {
    const counts = state.interference.effectCounts;
    const options = ["kidnap", "punch", "shuffle", "stun", "warp"].filter((key) => {
      if (!state.interference.enabledEffects[key]) return false;
      if (key === "stun" && isStunInProgress()) return false;
      return true;
    });
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options.sort((a, b) => counts[a] - counts[b]);
  }

  // 이펙트 하나를 실제로 시작해본다 — 대상이 없으면(코스 20% 아래로 내려온
  // 마블이 부족하면) false를 돌려주고 아무것도 바꾸지 않는다.
  function tryStartInterference(effect) {
    if (effect === "stun") {
      return queueStunEffect();
    }
    let target = null;
    let targetB = null;
    if (effect === "kidnap") {
      target = pickRandomAliveMarble();
    } else if (effect === "punch" || effect === "warp") {
      target = pickIntrusionTarget();
    } else if (effect === "shuffle") {
      target = pickIntrusionTarget();
      targetB = target ? pickOtherAliveMarble(target) : null;
      if (!targetB) return false;
    }
    if (!target) return false;
    const intr = state.intrusion;
    intr.active = true;
    intr.effect = effect;
    // 납치/섞기/워프 대상의 hidden 처리는 카메라 대기(lead)가 끝나는 순간
    // loop()의 연출 분기에서 한다.
    intr.lead = createLead();
    intr.timer = 0;
    intr.hitApplied = false;
    intr.hitStopRemaining = 0;
    intr.shakeRemaining = 0;
    intr.flashRemaining = 0;
    intr.targetMarble = target;
    intr.targetMarbleB = targetB;
    return true;
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

  // 스턴은 유일하게 물리를 멈추지 않는 이펙트다(다른 마블은 계속 달린다).
  // 대상은 고르는 순간부터 그 자리에 붙잡아 둬서(움직이는 대상을 쫓아가면 카메라가
  // 끝내 못 따라잡는다) 카메라가 도착할 때까지 기다리고(pendingStun), 도착한
  // 뒤에야 지직거림 + 2.5초 카운트를 시작한다. 대상이 있을 때만 true를 돌려주고,
  // 호출한 쪽(자동 난입 트리거)이 그때만 횟수를 차감한다.
  function queueStunEffect() {
    const target = pickIntrusionTarget(); // 결승선에 가장 가까운(=선두) 생존 마블.
    if (!target) return false;
    target._stunSnapshot = captureMarbleSnapshot(target);
    state.pendingStun = { marble: target, lead: createLead() };
    return true;
  }

  // 마블 반지름(11px) + 약간의 여유 — 이 거리 안에 회전 막대 팔이 들어오면 맞은 것.
  const STUN_SPINNER_HIT_RADIUS_PX = 13;

  // 스턴(또는 스턴 대기) 중에 회전 막대에 맞으면 즉시 풀고 막대가 도는 방향으로
  // 튕겨낸다. 맞은 자리에 작은 충격파 링을 띄워 "맞아서 풀렸다"는 게 보이게 한다.
  function releaseStunBySpinner(marble, spinner) {
    marble.stunRemaining = 0;
    marble._stunSnapshot = null;
    bounceOffSpinner(state.physics, marble, spinner);
    state.effects.push({ x: marble.body.position.x, y: marble.body.position.y, elapsed: 0, lifetime: 0.45 });
  }

  // 워프 도착 지점 — 코스는 원본 지도의 벽 폴리라인을 그대로 옮긴 거라 그냥
  // 무작위 좌표를 고르면 벽 안이나 트랙 밖에 떨어질 수 있다. 그래서 레이스 중
  // 마블들이 실제로 지나간 자리(항상 트랙 안)를 계속 기록해두고(warpTrail),
  // 그중 대상에서 충분히 먼 곳을 무작위로 고른다. 기록된 자리가 없으면
  // 예전처럼 출발점 스폰 구간으로 보낸다.
  const WARP_TRAIL_INTERVAL_SEC = 0.25;
  const WARP_TRAIL_SAMPLES_PER_TICK = 3;
  const WARP_TRAIL_MAX = 2000;
  const WARP_MIN_DISTANCE_PX = 600;

  function recordWarpTrail(rawDt) {
    state.warpTrailTimer -= rawDt;
    if (state.warpTrailTimer > 0) return;
    state.warpTrailTimer = WARP_TRAIL_INTERVAL_SEC;
    const candidates = state.marbles.filter((m) => !m.finished && !m.hidden && m._b2body);
    for (let i = 0; i < WARP_TRAIL_SAMPLES_PER_TICK && candidates.length; i++) {
      const m = candidates[Math.floor(Math.random() * candidates.length)];
      const point = { x: m.body.position.x, y: m.body.position.y };
      if (state.warpTrail.length < WARP_TRAIL_MAX) {
        state.warpTrail.push(point);
      } else {
        state.warpTrail[Math.floor(Math.random() * WARP_TRAIL_MAX)] = point;
      }
    }
  }

  function pickWarpDestination(target) {
    const tx = target.body.position.x;
    const ty = target.body.position.y;
    const far = state.warpTrail.filter((p) => Math.hypot(p.x - tx, p.y - ty) >= WARP_MIN_DISTANCE_PX);
    if (far.length) {
      return far[Math.floor(Math.random() * far.length)];
    }
    const bounds = course.spawnBounds;
    return {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
    };
  }

  // 섞기 상대는 대상을 제외한 생존 마블 중 무작위 1명 — "섞기는 1:1로만"이라는
  // 요청에 따라 전체를 뒤섞지 않고 딱 두 마블의 자리만 맞바꾼다.
  function pickOtherAliveMarble(exclude) {
    const candidates = state.marbles.filter((m) => isInterferenceCandidate(m) && m !== exclude);
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
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
      // 연출 시작 전, 카메라가 대상에게 먼저 도착할 때까지 기다린다. 이 동안에는
      // 대상도 트랙 위에 그대로 보이고, 끝나는 순간부터 연출 쪽이 넘겨받아 그린다.
      if (state.intrusion.lead) {
        if (advanceLead(state.intrusion.lead, rawDt)) {
          state.intrusion.lead = null;
          const effect = state.intrusion.effect;
          if (effect === "kidnap" || effect === "shuffle" || effect === "warp") {
            if (state.intrusion.targetMarble) state.intrusion.targetMarble.hidden = true;
            if (state.intrusion.targetMarbleB) state.intrusion.targetMarbleB.hidden = true;
          }
        }
      } else if (state.intrusion.hitStopRemaining > 0) {
        // 타격 순간 아주 잠깐(히트스톱) 연출을 멈춰서 "턱" 꽂히는 느낌을 준다 —
        // 격투 게임/액션 게임에서 흔히 쓰는 기법이다.
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
          } else if (state.intrusion.effect === "punch") {
            // 히트스톱/화면 흔들림/플래시는 실제로 "맞는" 펀치 전용 연출이다 —
            // 납치는 조용히 데려가는 쪽이라 이 타격 연출이 어울리지 않는다.
            applyIntrusionHit(state.intrusion.targetMarble);
            state.intrusion.hitStopRemaining = 0.08;
            state.intrusion.shakeRemaining = 0.3;
            state.intrusion.flashRemaining = 0.16;
          } else if (state.intrusion.effect === "shuffle") {
            // 렌더러가 그 전까지는 두 마블이 서로 자리를 향해 이동하는 모습을
            // 그려 보여주고, 바로 이 순간에 실제 물리상 자리를 맞바꾼다.
            const a = state.intrusion.targetMarble;
            const b = state.intrusion.targetMarbleB;
            if (a && b) {
              const snapA = captureMarbleSnapshot(a);
              const snapB = captureMarbleSnapshot(b);
              applyMarbleSnapshot(state.physics, a, snapB);
              applyMarbleSnapshot(state.physics, b, snapA);
              a.hidden = false;
              b.hidden = false;
            }
          } else if (state.intrusion.effect === "warp") {
            // 블랙홀이 다 빨아들인 시점 — 맵의 무작위 지점으로 순간이동시키고,
            // 이때부터는 도착 지점에 웜홀이 나타나는 걸로 보여준다.
            const target = state.intrusion.targetMarble;
            if (target) {
              const dest = pickWarpDestination(target);
              teleportMarbleTo(state.physics, target, dest.x, dest.y);
              target.hidden = false;
            }
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
        state.intrusion.targetMarbleB = null;
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
      recordWarpTrail(rawDt);

      // 스턴 대기 — 다른 마블은 계속 달리고, 대상만 고른 자리에 붙잡힌 채로
      // 카메라가 도착하길 기다린다. 도착하면 그때부터 지직거림 + 2.5초 카운트
      // (실제 시간 기준 — 결승 직전 슬로모션 중에도 늘어나지 않는다).
      const pending = state.pendingStun;
      if (pending) {
        const spinnerHit = pending.marble._stunSnapshot
          ? findSpinnerTouching(state.physics, pending.marble._stunSnapshot, STUN_SPINNER_HIT_RADIUS_PX)
          : null;
        if (pending.marble.finished) {
          pending.marble._stunSnapshot = null;
          state.pendingStun = null;
        } else if (spinnerHit) {
          state.pendingStun = null;
          releaseStunBySpinner(pending.marble, spinnerHit);
        } else {
          applyMarbleSnapshot(state.physics, pending.marble, pending.marble._stunSnapshot);
          if (advanceLead(pending.lead, rawDt)) {
            pending.marble.stunRemaining = STUN_DURATION_SEC;
            state.pendingStun = null;
          }
        }
      }

      // 스턴 중인 마블은 월드 스텝으로 중력/충돌을 받아 살짝 움직였을 걸 매
      // 프레임 바로 원래 자리로 되돌려서(완전 정지로) 보이게 한다. 단, 회전
      // 막대 팔이 붙잡힌 자리에 닿으면 그 즉시 스턴이 풀리고 튕겨 나간다.
      // 지직거리는 이펙트 자체는 renderer.js의 drawMarbles가 marble.stunRemaining을
      // 보고 매 프레임 직접 그린다.
      for (const marble of state.marbles) {
        if (!(marble.stunRemaining > 0)) continue;
        marble.stunRemaining -= rawDt;
        if (marble.finished || marble.stunRemaining <= 0) {
          marble.stunRemaining = 0;
          marble._stunSnapshot = null;
          continue;
        }
        if (!marble._stunSnapshot) continue;
        const spinnerHit = findSpinnerTouching(state.physics, marble._stunSnapshot, STUN_SPINNER_HIT_RADIUS_PX);
        if (spinnerHit) {
          releaseStunBySpinner(marble, spinnerHit);
          continue;
        }
        applyMarbleSnapshot(state.physics, marble, marble._stunSnapshot);
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
        state.interference.used < state.interference.max &&
        state.phase === "running"
      ) {
        const aliveCount = state.marbles.length - state.finishOrder.length;
        const { min: survivorMin, max: survivorMax } = intr.survivorRange;
        if (aliveCount > 1 && aliveCount >= survivorMin && aliveCount <= survivorMax) {
          // 덜 나온 이펙트부터 차례로 시도해서, 대상이 없어 못 터지는 이펙트
          // (예: 섞기인데 후보 마블이 1개뿐)가 있으면 다음 후보로 넘어간다.
          for (const effect of orderInterferenceCandidates()) {
            if (tryStartInterference(effect)) {
              state.interference.effectCounts[effect] += 1;
              intr.triggeredCount += 1;
              intr.cooldown = INTRUSION_COOLDOWN_SEC;
              state.interference.used += 1;
              break;
            }
          }
        }
      }
    }

    const { cssW, cssH, dpr } = resizeCanvasToDisplaySize(state.canvas);
    const ctx = state.ctx2d;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state.physics) {
      const intr = state.intrusion;
      // 카메라는 납치/펀치/섞기/워프 연출 중이거나(active) 스턴 중인 마블이
      // 있을 때 그 자리로 옮겨간다(cameraFocus) — 스턴은 물리를 멈추지 않으므로
      // active는 false지만 카메라 초점은 그대로 그 마블을 따라간다.
      let intrusionView;
      if (intr?.active) {
        const timing = INTRUSION_CONFIG[intr.effect] || INTRUSION_CONFIG.punch;
        const tx = intr.targetMarble?.body?.position?.x ?? 0;
        const ty = intr.targetMarble?.body?.position?.y ?? 0;
        const tbx = intr.targetMarbleB?.body?.position?.x ?? tx;
        const tby = intr.targetMarbleB?.body?.position?.y ?? ty;
        const focusX = intr.effect === "shuffle" ? (tx + tbx) / 2 : tx;
        const focusY = intr.effect === "shuffle" ? (ty + tby) / 2 : ty;
        intrusionView = {
          active: true,
          leading: Boolean(intr.lead),
          cameraFocus: true,
          effect: intr.effect,
          progress: Math.min(1, intr.timer / timing.pauseSec),
          hitProgress: Math.min(1, intr.timer / timing.hitAtSec),
          hitAtSec: timing.hitAtSec,
          pauseSec: timing.pauseSec,
          x: focusX,
          y: focusY,
          fitBox:
            intr.effect === "shuffle"
              ? { minX: Math.min(tx, tbx), maxX: Math.max(tx, tbx), minY: Math.min(ty, tby), maxY: Math.max(ty, tby) }
              : null,
          targetColor: intr.targetMarble?.color,
          targetName: intr.targetMarble?.name,
          targetX: tx,
          targetY: ty,
          targetBColor: intr.targetMarbleB?.color,
          targetBName: intr.targetMarbleB?.name,
          targetBX: tbx,
          targetBY: tby,
          hitApplied: intr.hitApplied,
          shake: intr.shakeRemaining > 0 ? intr.shakeRemaining / 0.3 : 0,
          flash: intr.flashRemaining > 0 ? intr.flashRemaining / 0.16 : 0,
        };
      } else {
        const stunFocus =
          state.pendingStun?.marble || state.marbles.find((m) => m.stunRemaining > 0 && !m.finished);
        intrusionView = stunFocus
          ? {
              active: false,
              cameraFocus: true,
              effect: "stun",
              x: stunFocus.body.position.x,
              y: stunFocus.body.position.y,
              shake: 0,
              flash: 0,
            }
          : { active: false, cameraFocus: false, shake: 0, flash: 0 };
      }
      updateCamera(state.camera, state.marbles, course, cssW, cssH, rawDt, intrusionView, state.phase);
      // 다음 프레임의 advanceLead가 볼 "카메라가 초점에 도착했는가" 판정.
      const cam = state.camera;
      const camScale = cam.zoom * (cssW / course.width);
      const offX = Math.abs(cam.targetX - cam.x) * camScale;
      const offY = Math.abs(cam.targetY - cam.y) * camScale;
      const zoomRatio = cam.zoom / cam.targetZoom;
      state.cameraSettled =
        offX < cssW * CAMERA_SETTLED_SCREEN_FRACTION &&
        offY < cssH * CAMERA_SETTLED_SCREEN_FRACTION &&
        Math.abs(zoomRatio - 1) < CAMERA_SETTLED_ZOOM_TOLERANCE;
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
      cameraSettled: Boolean(state.cameraSettled),
      leading: Boolean(state.intrusion.lead) || Boolean(state.pendingStun),
      interference: {
        ...state.interference,
        enabledEffects: { ...state.interference.enabledEffects },
        effectCounts: { ...state.interference.effectCounts },
      },
      intrusion: {
        enabled: state.intrusion.enabled,
        survivorRange: state.intrusion.survivorRange,
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
        hidden: Boolean(m.hidden),
        stunned: m.stunRemaining > 0,
      })),
    };
  }

  global.MarbleGame = {
    init,
    arrange,
    start,
    setSpeed,
    setHoldFast,
    setStage,
    getStageInfo,
    stop,
    stepOnce,
    getDebugSnapshot,
  };
})(window);
