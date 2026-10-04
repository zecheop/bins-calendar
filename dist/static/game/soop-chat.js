/*
 * SOOP(구 아프리카TV) 채팅 연결 (마블 레이스 "!참가" 자동 참가용).
 *
 * *** 중요: 이 파일은 SOOP의 비공식(문서화되지 않은) 채팅 프로토콜을 사용한다. ***
 * live.afreecatv.com/afreeca/player_live_api.php로 방송 중인지 + 채팅 서버
 * 주소(CHDOMAIN/CHPT)를 받아온 뒤, 그 채팅 서버에 직접 웹소켓으로 붙어
 * ESC(0x1B)+TAB로 시작하는 커스텀 바이너리 프레이밍 프로토콜을 이야기한다.
 * player_live_api.php는 브라우저에서 직접 fetch하면 CORS에 막히므로
 * /api/soop-chat-info(Cloudflare Pages Function)가 대신 호출해준다 — 이
 * 엔드포인트는 배포된 사이트에서만 동작하므로, 로컬 정적 서버에서는 SOOP
 * 연결이 항상 실패한다(로컬에서는 정상).
 *
 * 패킷 형식(커뮤니티 역공학, 2026-09 기준 실제 방송(jaeparkk 채널)으로 검증됨):
 *   ESC("\x1b\t") + 패킷타입(4자리 숫자) + 본문바이트길이(6자리, 0패딩) + "00" + 본문
 *   본문 필드는 "\x0c"(FS)로 구분된다.
 * 수신 패킷은 전체를 "\x0c"로 나눴을 때 [0]이 헤더 덩어리(ESC+타입+길이+"00")를
 * 통째로 담고 있고, 채팅 메시지(타입 "0005")는 [1]=메시지, [2]=아이디, [6]=닉네임이다.
 *
 * 별풍선 후원(타입 "0018", SEND_BALLOON)은 커뮤니티 라이브러리(getCurrentThread/soopapi,
 * "실제 수집된 패킷으로 검증" 명시)의 필드 순서를 그대로 따른다 — 채팅 메시지 인덱싱과
 * 동일한 규칙(헤더가 [0])을 적용하면 [1]=bjId, [2]=보낸사람아이디, [3]=닉네임,
 * [4]=별풍선개수, [5]=팬순위, [6]=파일명, [7]=isDefault, [8]=열혈팬여부, [9]=TTS문구.
 * *** 이 부분은 실제 후원 이벤트로 라이브 검증은 못 했다(문서 기반) — 채팅 참가 기능과
 * 달리 신뢰도가 한 단계 낮으니, 실제 후원이 들어오면 한번 확인해보는 게 좋다. ***
 *
 * 이 프로토콜은 SOOP이 언제든 바꿀 수 있는 비공식 스펙이다 — 방송사 채널로
 * 직접 검증하지 못했다면(다른 채널로만 테스트) 실제 방송에서 다시 확인이 필요하다.
 */
(function (global) {
  "use strict";

  const INFO_ENDPOINT = "/api/soop-chat-info";
  const ESC = "\x1b\t";
  const SEP = "\x0c";
  const PING_INTERVAL_MS = 60000;

  // bodyStr을 그대로 이어붙이는 형태 — 배열+join 방식은 구분자 개수를 착각하기
  // 쉬워서(선행/후행 빈 필드), 검증된 파이썬 레퍼런스의 f-string 그대로 문자열을
  // 직접 조립한다.
  function buildPacket(type, bodyStr) {
    const byteLength = new TextEncoder().encode(bodyStr).length;
    return `${ESC}${String(type).padStart(4, "0")}${String(byteLength).padStart(6, "0")}00${bodyStr}`;
  }

  // "https://www.sooplive.com/station/psb010203" 같은 링크에서 BJ 아이디만 뽑는다.
  // 아이디를 그냥 붙여넣은 경우(URL이 아닌 경우)도 그대로 통과시킨다.
  function parseSoopBjId(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    const urlMatch = text.match(/sooplive\.com\/(?:station\/)?([a-zA-Z0-9_]{3,20})/i);
    if (urlMatch) return urlMatch[1];
    const bareMatch = text.match(/^([a-zA-Z0-9_]{3,20})$/);
    return bareMatch ? bareMatch[1] : null;
  }

  function connect(bjid, handlers) {
    const seenUserIds = new Set();
    let ws = null;
    let closedByUser = false;
    let pingTimer = 0;

    handlers.onStatus?.("connecting");

    fetch(`${INFO_ENDPOINT}?bjid=${encodeURIComponent(bjid)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.available) {
          throw new Error(data.message || "채팅 연결 준비 실패");
        }
        openSocket(data);
      })
      .catch((err) => {
        handlers.onStatus?.("error", err.message || String(err));
      });

    function openSocket(info) {
      if (closedByUser) return;
      ws = new WebSocket(`wss://${info.chdomain}:${info.chpt}/Websocket/${info.bjid}`, ["chat"]);

      ws.onopen = () => {
        // CONNECT: 본문 = FFF + "16" + F (검증된 파이썬 레퍼런스와 동일)
        ws.send(buildPacket(1, `${SEP}${SEP}${SEP}16${SEP}`));
        window.setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            // JOIN: 본문 = F + CHATNO + FFFFF
            ws.send(buildPacket(2, `${SEP}${info.chatno}${SEP.repeat(5)}`));
            handlers.onStatus?.("connected", null, {
              channelName: info.channelName,
              liveTitle: info.liveTitle,
            });
          }
        }, 1000);
      };

      // 브라우저에서는 채팅 서버의 메시지가 문자열이 아니라 Blob(바이너리 프레임)으로 온다.
      // 문자열로만 처리하면 모든 패킷이 버려져서 "참가"가 하나도 안 잡힌다.
      ws.binaryType = "arraybuffer";
      const decoder = new TextDecoder("utf-8");
      ws.onmessage = (event) => {
        const data = event.data;
        handleRawPacket(typeof data === "string" ? data : decoder.decode(data));
      };

      ws.onerror = () => {
        handlers.onStatus?.("error", "채팅 서버 연결 오류");
      };

      ws.onclose = () => {
        if (!closedByUser) {
          handlers.onStatus?.("error", "채팅 연결이 끊어졌어요");
        }
      };

      pingTimer = window.setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(buildPacket(0, SEP));
        }
      }, PING_INTERVAL_MS);
    }

    function handleRawPacket(raw) {
      if (!raw.startsWith(ESC)) return;
      const fields = raw.split(SEP);
      const packetType = fields[0].slice(ESC.length, ESC.length + 4);
      if (packetType === "0005") {
        handleChatMessage(fields);
      } else if (packetType === "0018") {
        handleBalloonDonation(fields);
      }
    }

    // 채팅 메시지: 전체를 FS(\x0c)로 나눴을 때 [0]=헤더, [1]=메시지, [2]=아이디, [6]=닉네임.
    function handleChatMessage(fields) {
      const text = String(fields[1] || "").trim();
      const userId = String(fields[2] || "").trim();
      const nickname = String(fields[6] || "").trim() || userId;
      if (!text.startsWith("참가") && !text.startsWith("!참가")) {
        return;
      }
      if (!nickname || seenUserIds.has(userId || nickname)) {
        return;
      }
      seenUserIds.add(userId || nickname);
      handlers.onJoin?.(nickname);
    }

    // 별풍선 후원: [3]=닉네임, [4]=개수. 문서 기반 인덱싱(라이브 미검증, 위 주석 참고).
    function handleBalloonDonation(fields) {
      const nickname = String(fields[3] || "").trim();
      const amount = Number(fields[4] || 0);
      if (!nickname || !amount) return;
      handlers.onDonation?.({ nickname, amount });
    }

    return {
      disconnect() {
        closedByUser = true;
        window.clearInterval(pingTimer);
        ws?.close();
      },
    };
  }

  global.MarbleSoop = { connect, parseSoopBjId };
})(window);
