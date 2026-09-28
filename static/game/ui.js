/*
 * 마블 레이스 UI 연결 — DOM 요소와 MarbleGame/MarbleSoop/MarbleBgm API를 이어준다.
 * 사이드 내비게이션의 "게임" 탭에서 최초 1회 initRaceUI()가 호출된다.
 */
(function (global) {
  "use strict";

  const MAX_PARTICIPANTS = 1000; // bullet(연속충돌검사) 제거 + 입구 천장 높이 확장 후 1차 목표치

  // 핀볼 게임 결과를 "역대 기록"으로 남기는 기능 — 아무나 테스트 삼아 돌린 것까지
  // 다 쌓이면 기록이 의미 없어지므로, 로그인 이메일이 이 목록에 있을 때만 기록한다.
  // 실제 허용 여부는 Firestore 보안 규칙(isGameLogRunner)이 최종적으로 검사한다 —
  // 여기 배열은 화면에서 불필요한 쓰기 시도를 미리 걸러내는 용도일 뿐이다.
  // TODO: 빈스 본인 계정 이메일이 정해지면 추가 (firestore.rules의 isGameLogRunner()도 같이 갱신)
  const GAME_LOG_RUNNER_EMAILS = ["wjddndj2@gmail.com"];

  function recordGameLog(ranking) {
    const user = global.firebase?.auth?.().currentUser;
    const email = String(user?.email || "").trim().toLowerCase();
    if (!GAME_LOG_RUNNER_EMAILS.includes(email)) {
      return;
    }
    const db = global.firebase?.firestore?.();
    const collectionName = global.VINCE_FIREBASE_CONFIG?.gameLogCollection || "game_logs";
    if (!db) {
      return;
    }
    const stageInfo = global.MarbleGame.getStageInfo();
    const stageTitle = stageInfo?.titles?.[stageInfo.current] || stageInfo?.current || "";
    db.collection(collectionName)
      .add({
        createdAt: global.firebase.firestore.FieldValue.serverTimestamp(),
        stageTitle,
        participantCount: ranking.length,
        ranking: ranking.map((marble) => marble.name),
        runBy: email,
      })
      .catch((error) => console.error("게임 기록 저장 실패", error));
  }

  let wired = false;

  function parseParticipants(raw) {
    const names = [];
    raw
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((entry) => {
        // "곤듀*3" 처럼 이름 뒤에 *숫자를 붙이면 그 수만큼 반복해서 넣는다.
        const match = entry.match(/^(.+?)\*(\d+)$/);
        if (match) {
          const base = match[1].trim();
          const count = Math.max(1, parseInt(match[2], 10));
          for (let i = 0; i < count; i++) {
            names.push(base);
          }
        } else {
          names.push(entry);
        }
      });
    return names.slice(0, MAX_PARTICIPANTS);
  }

  function initRaceUI() {
    if (wired) {
      return;
    }
    wired = true;

    const canvas = document.getElementById("race-canvas");
    const stageEl = document.getElementById("race-stage");
    const participantsEl = document.getElementById("race-participants");
    const shuffleBtn = document.getElementById("race-shuffle");
    const clearBtn = document.getElementById("race-clear");
    const countLabelEl = document.getElementById("race-count-label");
    const arrangeBtn = document.getElementById("race-arrange");
    const startBtn = document.getElementById("race-start");
    const speedEl = document.getElementById("race-speed");
    const speedValueEl = document.getElementById("race-speed-value");
    const phaseLabelEl = document.getElementById("race-phase-label");
    const leaderTagEl = document.getElementById("race-leader-tag");
    const aliveTagEl = document.getElementById("race-alive-tag");
    const winnerRevealEl = document.getElementById("race-winner-reveal");
    const winnerNameEl = document.getElementById("race-winner-name");
    const confettiEl = document.getElementById("race-confetti");
    const winnerNextBtn = document.getElementById("race-winner-next");
    const resultsEl = document.getElementById("race-results");
    const resultsListEl = document.getElementById("race-results-list");
    const restartBtn = document.getElementById("race-restart");
    const fullscreenBtn = document.getElementById("race-fullscreen");
    const chzzkBtn = document.getElementById("race-chzzk-connect");
    const chzzkStatusEl = document.getElementById("race-chzzk-status");
    const chzzkUrlEl = document.getElementById("race-chzzk-url");
    const statTotalEl = document.getElementById("race-stat-total");
    const statAliveEl = document.getElementById("race-stat-alive");
    const statOutEl = document.getElementById("race-stat-out");
    const recentOutListEl = document.getElementById("race-recent-out-list");
    const bgmToggleBtn = document.getElementById("game-bgm-toggle");
    const bgmPanelEl = document.getElementById("game-bgm-panel");
    const bgmPlayBtn = document.getElementById("game-bgm-play");
    const bgmMuteBtn = document.getElementById("game-bgm-mute");
    const bgmVolumeEl = document.getElementById("game-bgm-volume");
    const gameLogToggleBtn = document.getElementById("game-log-toggle");
    const gameLogModalEl = document.getElementById("game-log-modal");
    const gameLogCloseBtn = document.getElementById("game-log-close");
    const gameLogListEl = document.getElementById("game-log-list");

    if (!canvas) {
      return;
    }

    let recentOut = [];
    let pendingRanking = null;

    function renderRecentOutList() {
      if (!recentOut.length) {
        recentOutListEl.innerHTML = "";
        return;
      }
      recentOutListEl.innerHTML = recentOut
        .map((entry) => `<li><span class="race-recent-out-rank">#${entry.rank}</span>${escapeHtmlSafe(entry.name)}</li>`)
        .join("");
      recentOutListEl.scrollTop = recentOutListEl.scrollHeight;
    }

    function resetRecentOutList() {
      recentOut = [];
      renderRecentOutList();
    }

    function showResults(ranking) {
      winnerRevealEl.classList.add("hidden");
      resultsListEl.innerHTML = ranking
        .map((marble, index) => {
          const isTop3 = index < 3;
          return `<li class="${isTop3 ? "is-top3" : ""}"><span class="race-rank">${index + 1}</span><span class="race-name">${escapeHtmlSafe(marble.name)}</span></li>`;
        })
        .join("");
      resultsEl.classList.remove("hidden");
    }

    function updateCountLabel() {
      const names = parseParticipants(participantsEl.value);
      countLabelEl.textContent = `${names.length}명`;
    }

    function setPhaseLabel(text) {
      phaseLabelEl.textContent = text;
    }

    const CONFETTI_COLORS = ["#4bbdce", "#d9c16c", "#e88a8a", "#8ac48a", "#b28ae8", "#e8a45c", "#7fb8e8", "#fff8e6"];

    // 우승 발표가 너무 밋밋하다는 피드백에 따라, 참고 사이트 particleManager.ts의
    // "우승 시 색종이 200개를 흩뿌리는" 연출을 우리 우승 카드에 맞게 색종이
    // 조각이 화면 위에서 떨어지는 CSS 애니메이션으로 옮겼다.
    function spawnConfetti() {
      if (!confettiEl) return;
      confettiEl.innerHTML = "";
      const pieceCount = 70;
      for (let i = 0; i < pieceCount; i++) {
        const piece = document.createElement("span");
        piece.className = "race-confetti-piece";
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        piece.style.setProperty("--race-confetti-fall-distance", `${380 + Math.random() * 220}px`);
        piece.style.setProperty("--race-confetti-spin", `${(Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360)}deg`);
        const duration = 1.6 + Math.random() * 1.2;
        piece.style.animationDuration = `${duration}s`;
        piece.style.animationDelay = `${Math.random() * 0.5}s`;
        confettiEl.appendChild(piece);
      }
    }

    function addParticipant(name) {
      const existing = parseParticipants(participantsEl.value);
      if (existing.includes(name) || existing.length >= MAX_PARTICIPANTS) {
        return;
      }
      existing.push(name);
      participantsEl.value = existing.join("\n");
      updateCountLabel();
    }

    let currentPhase = "idle";
    const raceCallbacks = {
      onPhaseChange(phase, countdownValue) {
        currentPhase = phase;
        if (phase === "idle") {
          // 맵을 바꾸면 setStage()가 여기로 "idle"을 보낸다 — 직전 레이스의
          // 우승/결과 카드가 화면에 그대로 남아있던 버그를 여기서 지운다.
          setPhaseLabel("참가자를 입력하세요");
          resultsEl.classList.add("hidden");
          winnerRevealEl.classList.add("hidden");
          leaderTagEl.classList.add("hidden");
          aliveTagEl.classList.add("hidden");
          pendingRanking = null;
        } else if (phase === "arranged") {
          setPhaseLabel("배치 완료 · 시작을 눌러보세요");
        } else if (phase === "countdown") {
          setPhaseLabel(`곧 출발! ${countdownValue}`);
        } else if (phase === "running") {
          setPhaseLabel("레이스 진행 중 · 마지막까지 남는 공이 우승!");
          leaderTagEl.classList.remove("hidden");
          aliveTagEl.classList.remove("hidden");
        } else if (phase === "finished") {
          setPhaseLabel("모든 공 탈락 완료");
          leaderTagEl.classList.add("hidden");
        }
      },
      onLeaderUpdate(leader) {
        if (leader) {
          leaderTagEl.textContent = `🏆 우승 후보 ${leader.name}`;
        }
      },
      onFinishUpdate(finishOrder, justFinished) {
        for (const marble of justFinished) {
          aliveTagEl.textContent = `방금 탈락: ${marble.name}`;
          recentOut.push({ rank: marble.rank, name: marble.name });
        }
        renderRecentOutList();
      },
      onStatsUpdate({ total, alive, out }) {
        statTotalEl.textContent = String(total);
        statAliveEl.textContent = String(alive);
        statOutEl.textContent = String(out);
      },
      onRaceEnd(eliminationOrder) {
        // eliminationOrder[0] = 가장 먼저 탈락, 마지막 원소 = 최종 우승자.
        // 우승자 발표 연출을 먼저 보여주고, "다음" 버튼을 누르면 전체 순위
        // (우승 -> 오래 남은 순 -> 먼저 탈락)로 넘어간다.
        const ranking = [...eliminationOrder].reverse();
        pendingRanking = ranking;
        recordGameLog(ranking);

        // 페이지 로드 시점에 미리 요청해두긴 하지만, 그것만으로는 "요청은
        // 했지만 아직 안 끝났을 수도 있다"는 문제가 그대로 남는다 — 실제로
        // 로드가 끝났다는 보장 없이 바로 글자를 그리면 기본 폰트가 잠깐
        // 보였다 바뀌는 현상이 생긴다. 우승 화면을 띄우기 직전에 한 번 더
        // 로드를 기다리고(끝나 있으면 즉시 통과), 혹시라도 오래 걸리는
        // 경우를 대비해 최대 400ms만 기다린 뒤에는 그냥 진행한다.
        const fontReady = (document.fonts?.load('40px "Black Han Sans"') ?? Promise.resolve()).catch(() => {});
        const timeout = new Promise((resolve) => window.setTimeout(resolve, 400));
        Promise.race([fontReady, timeout]).then(() => {
          winnerNameEl.textContent = ranking[0].name;
          winnerRevealEl.classList.remove("hidden");
          spawnConfetti();
        });
      },
    };

    global.MarbleGame.init(canvas, raceCallbacks);

    const stageSelectEl = document.getElementById("race-stage-select");
    if (stageSelectEl) {
      const stageInfo = global.MarbleGame.getStageInfo();
      if (stageInfo) {
        stageSelectEl.innerHTML = stageInfo.keys
          .map((key) => `<option value="${key}">${stageInfo.titles[key]}</option>`)
          .join("");
        stageSelectEl.value = stageInfo.current;
        stageSelectEl.addEventListener("change", () => {
          global.MarbleGame.setStage(stageSelectEl.value);
        });
      }
    }

    winnerNextBtn.addEventListener("click", () => {
      if (pendingRanking) {
        showResults(pendingRanking);
        pendingRanking = null;
      }
    });

    function performArrange() {
      // 카운트다운 중이거나 레이스가 진행 중일 때 참가자 목록을 고치면
      // arrange()가 물리 엔진을 통째로 새로 만들어서 레이스가 처음 상태로
      // 되돌아가버렸다 — 그 두 단계에서는 자동/수동 배치 모두 막는다.
      if (currentPhase === "countdown" || currentPhase === "running") {
        return;
      }
      const names = parseParticipants(participantsEl.value);
      if (!names.length) {
        return;
      }
      resultsEl.classList.add("hidden");
      winnerRevealEl.classList.add("hidden");
      leaderTagEl.classList.add("hidden");
      aliveTagEl.classList.add("hidden");
      pendingRanking = null;
      resetRecentOutList();
      global.MarbleGame.arrange(names);
    }

    updateCountLabel();
    // 참가자를 입력할 때마다 자동으로 배치되도록 한다 — 매 키 입력마다 물리
    // 엔진을 새로 만드는 건 낭비라 타이핑이 잠깐 멈췄을 때(600ms)만 실행한다.
    let autoArrangeTimer = 0;
    participantsEl.addEventListener("input", () => {
      updateCountLabel();
      window.clearTimeout(autoArrangeTimer);
      autoArrangeTimer = window.setTimeout(performArrange, 120);
    });

    shuffleBtn.addEventListener("click", () => {
      const names = parseParticipants(participantsEl.value);
      for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
      }
      participantsEl.value = names.join("\n");
      updateCountLabel();
      performArrange();
    });

    clearBtn.addEventListener("click", () => {
      participantsEl.value = "";
      updateCountLabel();
    });

    arrangeBtn.addEventListener("click", performArrange);

    startBtn.addEventListener("click", () => {
      const names = parseParticipants(participantsEl.value);
      if (!names.length) {
        return;
      }
      resultsEl.classList.add("hidden");
      winnerRevealEl.classList.add("hidden");
      leaderTagEl.classList.add("hidden");
      pendingRanking = null;
      resetRecentOutList();
      global.MarbleGame.setSpeed(Number(speedEl.value) || 1);
      global.MarbleGame.start(names, {
        // 빈스 캘린더용 캐릭터 아트(납치/펀치 난입 이미지)가 없어서 두 효과 모두 끔.
        intrusionEffects: {
          kidnap: false,
          punch: false,
        },
      });
    });

    restartBtn.addEventListener("click", () => {
      resultsEl.classList.add("hidden");
      winnerRevealEl.classList.add("hidden");
      phaseLabelEl.textContent = "참가자를 입력하세요";
      aliveTagEl.classList.add("hidden");
      pendingRanking = null;
      resetRecentOutList();
      global.MarbleGame.init(canvas, raceCallbacks);
    });

    speedEl.addEventListener("input", () => {
      const value = Number(speedEl.value) || 1;
      speedValueEl.textContent = `${value.toFixed(1)}×`;
      global.MarbleGame.setSpeed(value);
    });

    // 꾹 눌러 빨리감기 — 마우스/터치 공용(Pointer Events).
    let holding = false;
    function setHold(next) {
      if (holding === next) return;
      holding = next;
      global.MarbleGame.setHoldFast(next);
    }
    stageEl.addEventListener("pointerdown", () => setHold(true));
    stageEl.addEventListener("pointerup", () => setHold(false));
    stageEl.addEventListener("pointercancel", () => setHold(false));
    stageEl.addEventListener("pointerleave", () => setHold(false));

    // 전체화면
    fullscreenBtn.addEventListener("click", () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        stageEl.requestFullscreen?.();
      }
    });

    // SOOP 채팅 연결 (참가/!참가로 자동 참가) — 입력창에 방송국 링크를 붙여넣고
    // "확인"을 누르면 그 채널의 채팅에 연결된다.
    // (SOOP은 아직 후원 연동을 검증하지 못해 채팅 참가 방식만 지원한다.)
    let chzzkHandle = null;
    chzzkBtn.addEventListener("click", () => {
      if (chzzkHandle) {
        chzzkHandle.disconnect();
        chzzkHandle = null;
        chzzkBtn.textContent = "확인";
        chzzkUrlEl.disabled = false;
        chzzkStatusEl.textContent = "";
        chzzkStatusEl.classList.remove("is-live");
        return;
      }
      const bjid = global.MarbleSoop.parseSoopBjId(chzzkUrlEl.value);
      if (!bjid) {
        chzzkStatusEl.textContent = "올바른 SOOP 방송국 링크를 입력하세요";
        chzzkStatusEl.classList.remove("is-live");
        return;
      }
      chzzkStatusEl.textContent = "연결 중...";
      chzzkUrlEl.disabled = true;
      chzzkHandle = global.MarbleSoop.connect(bjid, {
        onStatus(status, message, info) {
          if (status === "connected") {
            // 어떤 방송에 연결됐는지 유저가 확인할 수 있게 채널명/방송 제목을 보여준다.
            const channelName = info?.channelName || "";
            const liveTitle = info?.liveTitle || "";
            const whoText = channelName ? `${channelName}${liveTitle ? ` · ${liveTitle}` : ""}` : "";
            chzzkStatusEl.textContent = whoText ? `🔴 ${whoText} 방송 연결됨` : "채팅 연결됨";
            chzzkStatusEl.classList.add("is-live");
            chzzkBtn.textContent = "연결 끊기";
          } else if (status === "connecting") {
            chzzkStatusEl.textContent = "연결 중...";
          } else if (status === "error") {
            chzzkStatusEl.textContent = message || "연결 실패";
            chzzkStatusEl.classList.remove("is-live");
            chzzkHandle = null;
            chzzkUrlEl.disabled = false;
            chzzkBtn.textContent = "확인";
          }
        },
        onJoin(nickname) {
          addParticipant(nickname);
        },
      });
    });

    // BGM (YouTube IFrame API, 오디오 전용으로 사용)
    // 재생 버튼을 누른 뒤에야 플레이어를 만들면 iframe 로딩+핸드셰이크 시간만큼
    // 소리가 늦게 나온다 — BGM 패널을 여는 시점(재생 전)에 미리 초기화해서
    // 실제로 재생 버튼을 누를 땐 이미 준비된 상태가 되게 한다.
    let bgmInited = false;
    let bgmPlaying = false;
    let bgmMuted = false;
    function ensureBgmInited() {
      if (!bgmInited) {
        global.MarbleBgm.init("game-bgm-mount", Number(bgmVolumeEl.value));
        bgmInited = true;
      }
    }
    bgmToggleBtn.addEventListener("click", () => {
      const nextOpen = bgmPanelEl.classList.contains("hidden");
      bgmPanelEl.classList.toggle("hidden", !nextOpen);
      bgmToggleBtn.setAttribute("aria-pressed", String(nextOpen));
      if (nextOpen) {
        ensureBgmInited();
      }
    });
    bgmPlayBtn.addEventListener("click", () => {
      ensureBgmInited();
      bgmPlaying = !bgmPlaying;
      if (bgmPlaying) {
        global.MarbleBgm.play();
        bgmPlayBtn.textContent = "⏸";
      } else {
        global.MarbleBgm.pause();
        bgmPlayBtn.textContent = "▶";
      }
    });
    bgmMuteBtn.addEventListener("click", () => {
      bgmMuted = !bgmMuted;
      global.MarbleBgm.setMuted(bgmMuted);
      bgmMuteBtn.textContent = bgmMuted ? "🔇" : "🔊";
    });
    bgmVolumeEl.addEventListener("input", () => {
      global.MarbleBgm.setVolume(Number(bgmVolumeEl.value));
    });

    // 역대 기록 — 누구나 열람 가능(공개 read), 실제 기록은 recordGameLog가
    // 지정된 계정으로 로그인했을 때만 남긴다.
    let gameLogsLoaded = false;

    function formatGameLogDate(timestamp) {
      const date = timestamp?.toDate?.();
      if (!date) return "";
      const parts = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const pick = (type) => parts.find((part) => part.type === type)?.value || "";
      return `${pick("year")}.${pick("month")}.${pick("day")} ${pick("hour")}:${pick("minute")}`;
    }

    // 순위를 가로로 나란히 보여줬더니 복사해서 다른 곳에 붙여넣을 때 줄바꿈이
    // 없이 다 붙어버려서 보기 불편하다는 피드백 — 세로로 한 줄씩 나열하고,
    // 복붙할 때 굳이 필요 없는 순위 목록은 기본적으로 접어둔다(클릭해야 펼침).
    function renderGameLogEntry(doc) {
      const data = doc.data();
      const ranking = Array.isArray(data.ranking) ? data.ranking : [];
      const rankingList = ranking.map((name) => `<li>${escapeHtmlSafe(name)}</li>`).join("");
      return `
        <article class="game-log-entry">
          <div class="game-log-entry-head">
            <b>${escapeHtmlSafe(data.stageTitle || "맵 정보 없음")}</b>
            <span>${escapeHtmlSafe(formatGameLogDate(data.createdAt))}</span>
            <span>참가 ${Number(data.participantCount) || ranking.length}명</span>
          </div>
          <button type="button" class="game-log-expand" data-log-expand>순위 보기(${ranking.length}명)</button>
          <ol class="game-log-full-ranking hidden">${rankingList}</ol>
        </article>
      `;
    }

    async function loadGameLogs() {
      const db = global.firebase?.firestore?.();
      const collectionName = global.VINCE_FIREBASE_CONFIG?.gameLogCollection || "game_logs";
      if (!db) {
        gameLogListEl.innerHTML = '<p class="game-log-empty">기록을 불러올 수 없어요.</p>';
        return;
      }
      try {
        const snapshot = await db.collection(collectionName).orderBy("createdAt", "desc").limit(50).get();
        if (snapshot.empty) {
          gameLogListEl.innerHTML = '<p class="game-log-empty">아직 기록된 레이스가 없어요.</p>';
          return;
        }
        gameLogListEl.innerHTML = snapshot.docs.map(renderGameLogEntry).join("");
      } catch (error) {
        console.error(error);
        gameLogListEl.innerHTML = '<p class="game-log-empty">기록을 불러오지 못했어요.</p>';
      }
    }

    gameLogToggleBtn?.addEventListener("click", () => {
      gameLogModalEl.classList.remove("hidden");
      if (!gameLogsLoaded) {
        gameLogsLoaded = true;
        loadGameLogs();
      }
    });
    gameLogCloseBtn?.addEventListener("click", () => {
      gameLogModalEl.classList.add("hidden");
    });
    gameLogModalEl?.addEventListener("click", (event) => {
      if (event.target === gameLogModalEl) {
        gameLogModalEl.classList.add("hidden");
      }
    });
    gameLogListEl?.addEventListener("click", (event) => {
      const expandBtn = event.target.closest("[data-log-expand]");
      if (!expandBtn) return;
      const list = expandBtn.nextElementSibling;
      const nowHidden = list.classList.toggle("hidden");
      expandBtn.textContent = nowHidden
        ? expandBtn.textContent.replace("숨기기", "순위 보기")
        : expandBtn.textContent.replace("순위 보기", "숨기기");
    });
  }

  function escapeHtmlSafe(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  global.initRaceUI = initRaceUI;
})(window);
