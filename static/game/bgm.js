/*
 * 마블 레이스 배경음악 — YouTube IFrame Player API를 오디오 전용으로 사용한다.
 * 재생/일시정지는 항상 사용자의 클릭(버튼)에서만 호출된다 — 브라우저의 소리 있는
 * 자동재생 차단 정책은 사용자 제스처로 시작하는 재생에는 적용되지 않는다.
 * 영상 파일을 다운로드/추출하지 않고, 임베드 플레이어를 그대로 사용한다.
 */
(function (global) {
  "use strict";

  const VIDEO_ID = "U0TXIXTzJEY";

  let player = null;
  let ready = false;
  let pendingAction = null;
  let apiLoading = false;

  function ensureApi(onReady) {
    if (global.YT && global.YT.Player) {
      onReady();
      return;
    }
    if (!apiLoading) {
      apiLoading = true;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prevCb = global.onYouTubeIframeAPIReady;
    global.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
      prevCb?.();
      onReady();
    };
  }

  function init(mountId, initialVolume) {
    if (player) {
      return;
    }
    ensureApi(() => {
      player = new global.YT.Player(mountId, {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 0,
          controls: 0,
          loop: 1,
          playlist: VIDEO_ID,
          playsinline: 1,
          disablekb: 1,
        },
        events: {
          onReady() {
            ready = true;
            player.setVolume(initialVolume ?? 60);
            if (pendingAction === "play") {
              player.playVideo();
            }
            pendingAction = null;
          },
        },
      });
    });
  }

  function play() {
    if (ready) {
      player.playVideo();
    } else {
      pendingAction = "play";
    }
  }

  function pause() {
    pendingAction = null;
    if (ready) {
      player.pauseVideo();
    }
  }

  function setVolume(value) {
    if (ready) {
      player.setVolume(value);
    }
  }

  function setMuted(muted) {
    if (!ready) return;
    if (muted) {
      player.mute();
    } else {
      player.unMute();
    }
  }

  global.MarbleBgm = { init, play, pause, setVolume, setMuted };
})(window);
