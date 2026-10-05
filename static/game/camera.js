/*
 * 마블 레이스 카메라 — 참고 사이트(lazygyu/roulette) src/camera.ts의 확대/추적
 * 공식을 그대로 옮겼다: 우승 후보 구슬의 위치(x,y)를 그대로 따라가고, 결승
 * 기준점(zoomY)에 가까워질수록 최대 4배까지 선형으로 확대한다. 우리가 임의로
 * 지어낸 "무리 퍼짐에 따른 줌아웃" 같은 로직은 넣지 않는다.
 */
(function (global) {
  "use strict";

  const ZOOM_THRESHOLD_PX = 220; // 참고 사이트 zoomThreshold(5m) * 44px/m
  const ZOOM_MAX_FACTOR = 4;

  function createCamera(course) {
    return {
      x: course.width / 2,
      y: course.startY,
      zoom: 1,
      targetX: course.width / 2,
      targetY: course.startY,
      targetZoom: 1,
      courseWidth: course.width,
    };
  }

  const INTRUSION_FOCUS_ZOOM = 2.1;

  const ARRANGED_VIEW_PADDING_PX = 70;
  const ARRANGED_VIEW_MIN_ZOOM = 0.4;
  const ARRANGED_VIEW_MAX_ZOOM = 3;

  // 배치/카운트다운 단계(아직 아무도 안 움직인 상태)의 카메라 확대/축소 —
  // 방금 스폰된 무리 전체(+여백)가 화면에 딱 맞게 들어오는 배율을 계산한다.
  // 인원이 적으면 무리가 작아서 확대되어 네임태그가 잘 보이고, 인원이
  // 많아서 무리가 커지면 자동으로 축소되어 전체가 한 화면에 들어온다.
  // 사각 영역(+여백)이 화면에 딱 맞게 들어오는 배율.
  function fitZoomForBox(minX, maxX, minY, maxY, padding, course, canvasWidth, canvasHeight) {
    const spanX = Math.max(1, maxX - minX + padding * 2);
    const spanY = Math.max(1, maxY - minY + padding * 2);
    const baseScale = canvasWidth / course.width; // zoom=1일 때의 world->screen 배율
    return Math.min(canvasWidth / (spanX * baseScale), canvasHeight / (spanY * baseScale));
  }

  function computeArrangedView(marbles, course, canvasWidth, canvasHeight) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const m of marbles) {
      const x = m.body.position.x;
      const y = m.body.position.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const fitZoom = fitZoomForBox(minX, maxX, minY, maxY, ARRANGED_VIEW_PADDING_PX, course, canvasWidth, canvasHeight);
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: Math.max(ARRANGED_VIEW_MIN_ZOOM, Math.min(ARRANGED_VIEW_MAX_ZOOM, fitZoom)),
    };
  }

  // 섞기처럼 두 마블이 멀리 떨어져 있을 수 있는 연출은, 둘 다 한 화면에 들어올
  // 때까지 축소한다. 가까우면 평소 연출 배율. 여백은 코스 좌표가 아니라 화면
  // 픽셀로 잡아야 크게 축소돼도 가장자리 마블의 이름표가 잘리지 않는다.
  const FIT_BOX_SCREEN_PADDING_PX = 56;
  const FIT_BOX_ARC_PX = 60; // renderer.js drawSwapDot이 위로 그리는 호 높이
  const FIT_BOX_MIN_ZOOM = 0.05;

  function computeFitBoxView(box, course, canvasWidth, canvasHeight) {
    const baseScale = canvasWidth / course.width;
    const spanX = Math.max(1, box.maxX - box.minX);
    const spanY = Math.max(1, box.maxY - box.minY + FIT_BOX_ARC_PX);
    const usableW = Math.max(1, canvasWidth - FIT_BOX_SCREEN_PADDING_PX * 2);
    const usableH = Math.max(1, canvasHeight - FIT_BOX_SCREEN_PADDING_PX * 2);
    const fitZoom = Math.min(usableW / (spanX * baseScale), usableH / (spanY * baseScale));
    return {
      x: (box.minX + box.maxX) / 2,
      y: (box.minY - FIT_BOX_ARC_PX + box.maxY) / 2,
      zoom: Math.max(FIT_BOX_MIN_ZOOM, Math.min(INTRUSION_FOCUS_ZOOM, fitZoom)),
    };
  }

  function updateCamera(camera, marbles, course, canvasWidth, canvasHeight, dt, intrusion, phase) {
    // worldToScreen이 스테이지 전환 후에도 항상 "지금" 코스의 폭을 쓰도록 카메라에
    // 매 프레임 갱신해둔다 — 예전엔 전역 MarbleCourse.width를 직접 읽어서, 게임
    // 도중 다른 맵으로 바꾸면 이전 맵 폭 기준으로 렌더링되는 버그가 있었다.
    camera.courseWidth = course.width;

    // 방해기능(납치/펀치/섞기/워프 연출 중이거나 스턴 중인 마블이 있을 때)이
    // 진행되는 동안에는 평소의 "우승 후보 추적"을 잠깐 멈추고, 카메라가
    // 이펙트가 벌어지는 자리로 이동 + 확대해서 화면에서 무슨 일이 일어나는지
    // 바로 보이게 한다. 스턴은 물리를 멈추지 않지만 카메라 초점만은 같이 옮긴다.
    if (intrusion && intrusion.cameraFocus) {
      if (intrusion.fitBox) {
        const view = computeFitBoxView(intrusion.fitBox, course, canvasWidth, canvasHeight);
        camera.targetX = view.x;
        camera.targetY = view.y;
        camera.targetZoom = view.zoom;
      } else {
        camera.targetX = intrusion.x;
        camera.targetY = intrusion.y - 70;
        camera.targetZoom = INTRUSION_FOCUS_ZOOM;
      }
      // 평소 추적(dt*2.2)보다 빠르게 당겨서, 연출 시작 전 대기(0.6초) 안에
      // 카메라가 거의 다 도착하게 한다.
      camera.x += (camera.targetX - camera.x) * Math.min(1, dt * 5);
      camera.y += (camera.targetY - camera.y) * Math.min(1, dt * 5);
      camera.zoom += (camera.targetZoom - camera.zoom) * Math.min(1, dt * 5);
      return;
    }

    if ((phase === "arranged" || phase === "countdown") && marbles.length) {
      const view = computeArrangedView(marbles, course, canvasWidth, canvasHeight);
      camera.targetX = view.x;
      camera.targetY = view.y;
      camera.targetZoom = view.zoom;
      if (phase === "arranged") {
        // 배치 직후는 정지 프레임을 딱 한 번만 그려서(연속 루프 없음) 서서히
        // 당기면 확대/축소가 거의 안 보인 채로 끝난다 — 바로 스냅한다.
        camera.x = camera.targetX;
        camera.y = camera.targetY;
        camera.zoom = camera.targetZoom;
      } else {
        camera.x += (camera.targetX - camera.x) * Math.min(1, dt * 2.2);
        camera.y += (camera.targetY - camera.y) * Math.min(1, dt * 2.2);
        camera.zoom += (camera.targetZoom - camera.zoom) * Math.min(1, dt * 3);
      }
      return;
    }

    const active = marbles.filter((m) => !m.finished);
    // 탈락 레이스: 출구에 먼저 들어가면 탈락이므로, 가장 뒤처진(=y가 가장 작은)
    // 공이 마지막까지 남을 우승 후보다 — 참고 사이트의 targetIndex(다음 순위가
    // 확정될 구슬)에 대응하는 개념.
    let leader = null;
    let leaderY = Infinity;
    for (const m of active) {
      const y = m.body.position.y;
      if (y < leaderY) {
        leaderY = y;
        leader = m;
      }
    }

    if (leader) {
      const finale = course.finaleView;
      if (finale && leader.body.position.y > finale.enterY) {
        // 항아리처럼 결승부가 좁은 관이 아니라 넓은 통짜 구조인 맵은, 공의
        // y좌표를 그대로 쫓아가면 그 순간 공 주변만 보이고 위/아래 나머지가
        // 잘린다(실측으로 확인된 "상부만 보임" 버그) — 그래서 이 구간에 들어온
        // 뒤로는 공을 픽셀 단위로 쫓지 않고, 항아리 전체(minY~maxY)가 항상
        // 화면 안에 들어오도록 카메라를 그 구간 중앙에 고정한다.
        camera.targetX = finale.focusX;
        camera.targetY = (finale.minY + finale.maxY) / 2;
        const neededHeight = finale.maxY - finale.minY;
        // zoom=1일 때 보이는 세로 범위는 canvasHeight/(canvasWidth/course.width)다.
        // 그 범위가 neededHeight보다 작으면(즉 항아리가 화면보다 세로로 더 길면)
        // zoom을 1보다 낮춰서(축소) 항아리 전체가 다 들어오게 만든다. 가로는
        // 이미 course.width가 캔버스 폭 전체와 같으므로 1을 넘길 필요는 없다.
        const visibleHeightAtZoom1 = canvasHeight * (course.width / canvasWidth);
        camera.targetZoom = Math.min(1, visibleHeightAtZoom1 / neededHeight);
      } else {
        camera.targetX = leader.body.position.x;
        camera.targetY = leader.body.position.y;

        // camera.ts _calcTargetPositionAndZoom과 동일한 공식.
        const goalDist = Math.abs(course.zoomY - leader.body.position.y);
        if (goalDist < ZOOM_THRESHOLD_PX) {
          camera.targetZoom = Math.max(1, (1 - goalDist / ZOOM_THRESHOLD_PX) * ZOOM_MAX_FACTOR);
        } else {
          camera.targetZoom = 1;
        }
      }
    } else {
      camera.targetZoom = 1;
    }

    camera.x += (camera.targetX - camera.x) * Math.min(1, dt * 2.2);
    camera.y += (camera.targetY - camera.y) * Math.min(1, dt * 2.2);
    camera.zoom += (camera.targetZoom - camera.zoom) * Math.min(1, dt * 3);
  }

  function worldToScreen(camera, canvasWidth, canvasHeight, worldX, worldY) {
    const scale = camera.zoom * (canvasWidth / camera.courseWidth);
    const screenX = (worldX - camera.x) * scale + canvasWidth / 2;
    const screenY = (worldY - camera.y) * scale + canvasHeight / 2;
    return [screenX, screenY, scale];
  }

  global.MarbleCamera = { createCamera, updateCamera, worldToScreen };
})(window);
