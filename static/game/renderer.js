/*
 * 마블 레이스 렌더러 — 캔버스에 코스/구슬/이펙트를 그린다.
 * 물리/게임흐름과 분리되어 있으며 상태를 읽기만 한다.
 * 참고 사이트 미니맵처럼 얇은 점선 벽 + 네온 스타일을 쓴다.
 *
 * 성능 메모: 예전엔 벽/페그처럼 개수가 많은 요소에도 shadowBlur로 글로우를
 * 넣었는데, ctx.shadowBlur는 도형마다 실제로 블러 연산을 새로 돌리는 무거운
 * 기능이라 벽 수십 개 + 페그 수십 개 + 구슬 수십 개가 겹치면 프레임이 뚝뚝
 * 끊길 정도로 느려졌다("쓸데없는 부하" 피드백). 그래서 여기서는 shadowBlur를
 * 아예 쓰지 않고, 살짝 크고 흐린 반투명 원/사각형을 밑에 한 번 더 그리는
 * 방식(globalAlpha만 사용)으로 훨씬 싸게 비슷한 느낌만 낸다.
 */
(function (global) {
  "use strict";

  const { worldToScreen } = global.MarbleCamera;

  const NEON = "rgba(120, 230, 255, 0.95)";
  const NEON_DIM = "rgba(120, 230, 255, 0.55)";
  const NEON_GLOW = "rgba(120, 230, 255, 0.16)";

  function drawCourse(ctx, camera, physics, course, canvasW, canvasH) {
    const scaleFactor = camera.zoom * (canvasW / course.width);

    for (const ent of course.entities) {
      if (ent.type === "wallSeg") {
        const [x1, y1] = worldToScreen(camera, canvasW, canvasH, ent.x1, ent.y1);
        const [x2, y2] = worldToScreen(camera, canvasW, canvasH, ent.x2, ent.y2);
        const coreWidth = Math.max(1.2, (ent.thickness || WALL_T_FALLBACK) * scaleFactor * 0.4);
        ctx.lineCap = "round";
        // 점선이던 벽을 원본(lazygyu/roulette)처럼 매끈하게 이어진 실선으로
        // 바꿨다 — 굵고 흐린 선을 먼저 깔고 그 위에 또렷한 선을 겹쳐서,
        // 비싼 shadowBlur 없이도 은은한 네온 발광 느낌을 낸다.
        ctx.strokeStyle = NEON_GLOW;
        ctx.lineWidth = coreWidth * 3.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = NEON_DIM;
        ctx.lineWidth = coreWidth;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (ent.type === "fillet") {
        // 폴리라인이 꺾이는 지점(정점)마다 물리 쪽엔 이미 이 반지름의 원형
        // 바디가 있는데, 렌더러가 그동안 이걸 안 그려서 두 벽 세그먼트가
        // 만나는 안쪽 모서리에 눈에 띄는 틈/턱이 남아 있었다 — 벽과 같은
        // 네온 색으로 그 자리를 매끄럽게 채운다.
        const [x, y, scale] = worldToScreen(camera, canvasW, canvasH, ent.x, ent.y);
        const r = Math.max(0.8, ent.r * scale);
        ctx.beginPath();
        ctx.fillStyle = NEON_GLOW;
        ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = NEON_DIM;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.type === "peg") {
        const [x, y, scale] = worldToScreen(camera, canvasW, canvasH, ent.x, ent.y);
        ctx.beginPath();
        ctx.fillStyle = NEON;
        ctx.arc(x, y, ent.r * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.type === "ramp") {
        drawBar(ctx, camera, canvasW, canvasH, ent.x, ent.y, ent.length, ent.thickness, ent.angle, NEON_DIM);
      } else if (ent.type === "wedge") {
        drawWedge(ctx, camera, canvasW, canvasH, ent.x, ent.y, ent.size, ent.angle || 0, ent.sides || 3);
      } else if (ent.type === "pentagon") {
        drawWedge(ctx, camera, canvasW, canvasH, ent.x, ent.y, ent.radius, 0, 5);
      }
    }

    for (const slider of physics.sliders) {
      drawBar(ctx, camera, canvasW, canvasH, slider.x, slider.y, slider.length, slider.thickness, 0, NEON);
    }

    for (const spinner of physics.spinners) {
      const { x, y } = spinner.body.position;
      // 팔 길이를 물리 body의 고정값에서 그대로 가져와 그린다 — 회전 각도와 무관하게
      // 항상 같은 길이로 보여야 진짜 2D 평면 회전처럼 보인다(시계 초침/분침과 동일).
      drawBar(ctx, camera, canvasW, canvasH, x, y, spinner.armLength, spinner.armThickness, spinner.angle, NEON);
      if ((spinner.arms || 2) >= 2) {
        drawBar(ctx, camera, canvasW, canvasH, x, y, spinner.armLength, spinner.armThickness, spinner.angle + Math.PI / 2, NEON);
      }
      const [cx, cy, scale] = worldToScreen(camera, canvasW, canvasH, x, y);
      ctx.beginPath();
      ctx.fillStyle = "rgba(230, 245, 250, 0.95)";
      ctx.arc(cx, cy, Math.max(2, 4 * scale), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBar(ctx, camera, canvasW, canvasH, cx, cy, length, thickness, angle, color) {
    const [x, y, scale] = worldToScreen(camera, canvasW, canvasH, cx, cy);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect((-length / 2) * scale, (-thickness / 2) * scale, length * scale, thickness * scale);
    ctx.restore();
  }

  function drawWedge(ctx, camera, canvasW, canvasH, cx, cy, size, angle, sides) {
    const [x, y, scale] = worldToScreen(camera, canvasW, canvasH, cx, cy);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / sides;
      const px = Math.cos(a) * size * scale;
      const py = Math.sin(a) * size * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(120, 230, 255, 0.18)";
    ctx.fill();
    ctx.strokeStyle = NEON;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  function drawGoalLine(ctx, camera, course, canvasW, canvasH) {
    const [, y] = worldToScreen(camera, canvasW, canvasH, 0, course.goalY);
    if (y < -20 || y > canvasH + 20) {
      return;
    }
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "rgba(217, 193, 108, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasW, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMarbles(ctx, camera, marbles, canvasW, canvasH) {
    // hidden: 납치 연출 중 캐릭터 쪽으로 옮겨 그려지는 동안 트랙 위 원래
    // 자리에 중복으로 그려지지 않게 감춘다(marble-race.js에서 설정).
    const active = marbles.filter((m) => !m.finished && !m.hidden);
    // 탈락 레이스이므로 "먼저 들어가면 탈락"이다 -> 지금 가장 뒤처진(출구에서 가장 먼,
    // y가 가장 작은) 공이 현재의 우승 후보(마지막에 떨어질 공)다. 그 공을 강조한다.
    let leader = null;
    let leaderY = Infinity;
    for (const m of active) {
      if (m.body.position.y < leaderY) {
        leaderY = m.body.position.y;
        leader = m;
      }
    }

    for (const marble of marbles) {
      if (marble.finished || marble.hidden) {
        continue;
      }
      const [x, y, scale] = worldToScreen(camera, canvasW, canvasH, marble.body.position.x, marble.body.position.y);
      if (y < -30 || y > canvasH + 30) {
        continue;
      }
      const r = 11 * scale;

      if (marble === leader) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(240, 220, 160, 0.9)";
        ctx.lineWidth = 2;
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.fillStyle = marble.color;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // 참고 사이트 marble.ts의 _renderCoolTime과 같은 스킬 쿨타임 게이지 —
      // 텍스트 안내 없이 마블 테두리에 호로 표시한다. 원본은 다 찬 상태에서
      // 줄어드는 방향이지만, 여기서는 "게이지가 차오른다"는 사용자 요청에 맞게
      // 방향만 반대로(0에서 꽉 찰 때까지 채워지도록) 그린다.
      if (marble.maxCoolTime) {
        const fillRatio = 1 - Math.max(0, marble.coolTime) / marble.maxCoolTime;
        if (fillRatio > 0.02) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 205, 110, 0.85)";
          ctx.lineWidth = Math.max(1, 1.5 * scale);
          const startAngle = -Math.PI / 2;
          ctx.arc(x, y, r + 3 * scale, startAngle, startAngle + Math.PI * 2 * fillRatio);
          ctx.stroke();
        }
      }

      // 카메라가 축소되면(scale이 작아지면) 이름이 사라지던 버그 — 공이 떨어지는
      // 동안 이름이 계속 안 보이면 누구인지 알 수 없다는 요청에 따라, 배율/참가자
      // 수와 무관하게 항상 그린다. 다만 글자 크기는 최소치 이하로는 안 줄어들게
      // 막아서 아무리 축소돼도 읽을 수 있게 한다.
      ctx.font = `${Math.max(9, 11 * scale)}px "Noto Sans KR", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.textAlign = "center";
      ctx.fillText(marble.name, x, y - r - 4);
    }

    return leader;
  }

  const IMPACT_RADIUS_PX = 440; // physics.js의 IMPACT_RADIUS_PX와 동일(10m*44px/m)

  // 참고 사이트 skillEffect.ts를 그대로 옮겼다 — 충격파를 낸 자리에 500ms 동안
  // 퍼져나가는 원을 그리고, 실제 충격파가 미치는 반경(440px)까지 커지면서 사라진다.
  function drawEffects(ctx, camera, canvasW, canvasH, effects) {
    if (!effects || !effects.length) return;
    for (const effect of effects) {
      const [x, y, scale] = worldToScreen(camera, canvasW, canvasH, effect.x, effect.y);
      const rate = Math.min(1, effect.elapsed / effect.lifetime);
      const radius = rate * IMPACT_RADIUS_PX * scale;
      ctx.save();
      ctx.globalAlpha = 1 - rate * rate;
      ctx.strokeStyle = "rgba(255, 205, 110, 0.9)";
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // 펀치 난입의 타격 충격파는 훨씬 굵고 밝은 두 겹 링 + 중심 섬광으로
      // 눈에 확 띄게 그려서 "턱" 꽂히는 느낌을 살린다.
      if (effect.big) {
        ctx.strokeStyle = "rgba(255, 240, 200, 0.95)";
        ctx.lineWidth = Math.max(2, 5 * scale) * (1 - rate * 0.7);
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        if (rate < 0.3) {
          ctx.globalAlpha = (1 - rate / 0.3) * 0.9;
          ctx.fillStyle = "rgba(255, 250, 220, 0.9)";
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, 22 * scale) * (1 - rate), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  const WALL_T_FALLBACK = 12;

  // 난입 이펙트별 캐릭터 PNG — 이미지가 없거나 로드 실패하면 이모지로 대신
  // 그린다. 이미지 원본 가로세로 비율은 유지한 채 높이 기준으로 맞춘다.
  // frames가 여러 장이면(현재는 펀치만) 타격 시점(hitApplied) 전/후로 프레임을
  // 바꿔서 "휘두르기 전 -> 맞히는 순간" 2프레임 애니메이션처럼 보이게 한다.
  const INTRUSION_EFFECTS = {
    punch: {
      frames: ["/static/assets/game-intrusion-punch-1.png", "/static/assets/game-intrusion-punch.png"],
      emoji: "👊",
      sizeScale: 1.3,
    },
    // slot: 캐릭터 이미지 안에서 마블을 얹어둘 자리 — 이미지 크기 기준 비율
    // 좌표(0~1)다. 재첩이 캐릭터가 두 귀(팔)를 들어올린 사이 빈 공간.
    kidnap: {
      frames: ["/static/assets/game-intrusion-kidnap.png"],
      emoji: "🫳",
      slot: { xFrac: 0.401, yFrac: 0.162 },
    },
  };
  const imageCache = {};

  function getEffectFrameImage(effectKey, frameIndex) {
    const cacheKey = `${effectKey}:${frameIndex}`;
    const cached = imageCache[cacheKey];
    if (cached === undefined) {
      const src = INTRUSION_EFFECTS[effectKey]?.frames?.[frameIndex];
      if (!src) {
        imageCache[cacheKey] = { img: null, failed: true };
        return null;
      }
      const img = new Image();
      imageCache[cacheKey] = { img: null, failed: false };
      img.onload = () => {
        imageCache[cacheKey] = { img, failed: false };
      };
      img.onerror = () => {
        imageCache[cacheKey] = { img: null, failed: true };
      };
      img.src = src;
      return null;
    }
    return cached.img;
  }

  // 빈스 캘린더는 납치/펀치 난입 효과를 항상 꺼둔 상태라(캐릭터 아트가 없음)
  // 어차피 그려질 일이 없는 이미지를 미리 받아올 필요가 없다 — 원래 있던
  // 즉시 preload 로직은 제거하고, getEffectFrameImage가 실제로 그려질 때만
  // (지금은 절대 없음) 지연 로드하도록 둔다.

  // 등장(0~0.35) -> 유지/타격(0.35~0.65) -> 퇴장(0.65~1) 3단계로 위에서
  // 슬라이드되어 들어왔다 나가는 캐릭터 + 배너 텍스트를 그린다.
  function drawIntrusion(ctx, camera, canvasW, canvasH, intrusion) {
    if (!intrusion || !intrusion.active) {
      return;
    }
    const config = INTRUSION_EFFECTS[intrusion.effect] || INTRUSION_EFFECTS.punch;
    const [x, y, scale] = worldToScreen(camera, canvasW, canvasH, intrusion.x, intrusion.y);
    const p = intrusion.progress;
    let slideOut = 0;
    if (p < 0.35) {
      slideOut = 1 - p / 0.35;
    } else if (p > 0.65) {
      slideOut = (p - 0.65) / 0.35;
    }
    const sizeScale = config.sizeScale || 1;
    const height = Math.max(130, 240 * scale) * sizeScale;
    const drawX = x;
    const drawY = y - height * 0.55 - height * 1.2 * slideOut;

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - slideOut);
    const effectKey = intrusion.effect || "punch";
    const frameIndex = intrusion.hitApplied ? Math.min(1, config.frames.length - 1) : 0;
    const img = getEffectFrameImage(effectKey, frameIndex);
    let imgLeft = 0;
    let imgTop = 0;
    let imgWidth = 0;
    if (img) {
      imgWidth = height * (img.naturalWidth / img.naturalHeight);
      imgLeft = drawX - imgWidth / 2;
      imgTop = drawY - height / 2;
      ctx.drawImage(img, imgLeft, imgTop, imgWidth, height);
    } else {
      ctx.font = `${Math.round(height * 0.6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.emoji, drawX, drawY);
    }

    // 납치 캐릭터가 마블을 원래 있던 자리(x, y)에서 슬롯까지 들어올리는
    // 과정을 보여준다 — 등장(0~0.35) 동안 점점 슬롯 쪽으로 옮겨가고, 그 뒤
    // (유지/퇴장)에는 계속 슬롯에 붙어서 캐릭터와 함께 움직인다.
    if (img && config.slot && intrusion.targetColor) {
      const slotX = imgLeft + imgWidth * config.slot.xFrac;
      const slotY = imgTop + height * config.slot.yFrac;
      const grabT = p < 0.35 ? p / 0.35 : 1;
      const eased = grabT * grabT * (3 - 2 * grabT);
      const marbleX = x + (slotX - x) * eased;
      const marbleY = y + (slotY - y) * eased;
      const marbleR = height * 0.09;
      ctx.beginPath();
      ctx.fillStyle = intrusion.targetColor;
      ctx.arc(marbleX, marbleY, marbleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, marbleR * 0.15);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
      if (intrusion.targetName) {
        ctx.font = `${Math.max(10, Math.round(marbleR * 1.1))}px "Noto Sans KR", sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textAlign = "center";
        ctx.fillText(intrusion.targetName, marbleX, marbleY - marbleR - 4);
      }
    }
    ctx.restore();
  }

  function renderRace(ctx, canvasW, canvasH, camera, physics, course, marbles, effects, intrusion) {
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = "#0a1216";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 타격 순간 화면 전체를 잠깐 흔들어서(스크린 셰이크) 임팩트를 준다.
    const shake = intrusion?.shake || 0;
    ctx.save();
    if (shake > 0) {
      const mag = 10 * shake;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    drawCourse(ctx, camera, physics, course, canvasW, canvasH);
    drawGoalLine(ctx, camera, course, canvasW, canvasH);
    const leader = drawMarbles(ctx, camera, marbles, canvasW, canvasH);
    drawEffects(ctx, camera, canvasW, canvasH, effects);
    drawIntrusion(ctx, camera, canvasW, canvasH, intrusion);
    ctx.restore();

    // 타격 직후 짧은 흰색 플래시로 "턱" 꽂히는 순간을 강조한다.
    const flash = intrusion?.flash || 0;
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 * flash;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }

    return leader;
  }

  global.MarbleRenderer = { renderRace };
})(window);
