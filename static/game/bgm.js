/*
 * 마블 레이스 배경음악 — YouTube IFrame Player API를 오디오 전용으로 사용한다.
 * 재생/일시정지는 항상 사용자의 클릭(버튼)에서만 호출된다 — 브라우저의 소리 있는
 * 자동재생 차단 정책은 사용자 제스처로 시작하는 재생에는 적용되지 않는다.
 * 영상 파일을 다운로드/추출하지 않고, 임베드 플레이어를 그대로 사용한다.
 *
 * 사용자가 원하는 상태(재생 여부·음소거·볼륨)를 여기서 기억해 두고, 플레이어가 준비되거나
 * 재생을 다시 시작할 때마다 그대로 다시 적용한다. 브라우저가 재생을 이어가려고 플레이어를
 * 몰래 음소거하거나, 준비 전에 누른 음소거/볼륨이 무시돼서 "켰는데 소리가 안 나는" 일을 막는다.
 */
(function (global) {
  "use strict";

  const VIDEO_ID = "U0TXIXTzJEY";
  const STATE_ENDED = 0;
  const STATE_PLAYING = 1;
  const STATE_PAUSED = 2;
  const STATE_BUFFERING = 3;

  let player = null;
  let ready = false;
  let apiLoading = false;
  let initStarted = false;

  let wantPlaying = false;
  let wantMuted = false;
  let volume = 60;
  let changeListener = null;

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

  function notify(playing = wantPlaying) {
    changeListener?.(playing);
  }

  function applyAudio() {
    if (!ready) return;
    player.setVolume(volume);
    if (wantMuted) {
      player.mute();
    } else {
      player.unMute();
    }
  }

  function init(mountId, initialVolume) {
    if (initStarted) {
      return;
    }
    initStarted = true;
    volume = initialVolume ?? volume;
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
            applyAudio();
            if (wantPlaying) {
              player.playVideo();
            }
            notify();
          },
          onStateChange(event) {
            if (event.data === STATE_ENDED && wantPlaying) {
              player.seekTo(0, true);
              player.playVideo();
            }
            if (event.data === STATE_PLAYING && !wantPlaying) {
              player.pauseVideo();
            }
            // 재생을 원했는데 플레이어가 멈춰 있으면(브라우저 차단 등) 재생 버튼(▶)을 보여줘서
            // 다음 클릭이 다시 재생이 되게 한다.
            notify(wantPlaying && event.data !== STATE_PAUSED);
          },
        },
      });
    });
  }

  function play() {
    wantPlaying = true;
    if (ready) {
      applyAudio();
      player.playVideo();
    }
    notify();
  }

  function pause() {
    wantPlaying = false;
    if (ready) {
      player.pauseVideo();
    }
    notify();
  }

  function isPlaying() {
    return wantPlaying;
  }

  function isReady() {
    return ready;
  }

  function isActuallyPlaying() {
    if (!ready) return false;
    const state = player.getPlayerState?.();
    return state === STATE_PLAYING || state === STATE_BUFFERING;
  }

  function setVolume(value) {
    volume = Number(value);
    if (ready) {
      player.setVolume(volume);
    }
  }

  function setMuted(muted) {
    wantMuted = Boolean(muted);
    applyAudio();
  }

  function onChange(listener) {
    changeListener = listener;
  }

  global.MarbleBgm = { init, play, pause, isPlaying, isReady, isActuallyPlaying, setVolume, setMuted, onChange };
})(window);
