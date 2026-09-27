/*
 * CHZZK 채팅 연결 (마블 레이스 "!참가" 자동 참가 + 후원 연동용).
 *
 * *** 중요: 이 파일은 CHZZK의 비공식(문서화되지 않은) 채팅 프로토콜을 사용한다. ***
 * CHZZK은 시청 전용 채팅 읽기에 별도의 로그인/시크릿 키를 요구하지 않으므로
 * secret은 어디에도 없다 — chatChannelId/accessToken은 /api/chzzk-chat-token
 * (Cloudflare Pages Function, functions/api/chzzk-chat-token.js)이 매 연결마다
 * 그때그때 발급받아 넘겨준다. 이 엔드포인트는 배포된 사이트(Cloudflare Pages)에서만
 * 동작하므로, 로컬 정적 서버(python http.server)에서는 CHZZK 연결이 항상 실패한다 —
 * 로컬에서는 정상이다.
 *
 * 이 프로토콜은 Naver가 언제든 바꿀 수 있는 비공식 스펙이라, 실제 방송에서
 * 한 번도 검증하지 못한 상태다 — 라이브로 테스트해보고 안 되면 cmd 번호나
 * 메시지 구조를 다시 맞춰야 할 수 있다.
 */
(function (global) {
  "use strict";

  const TOKEN_ENDPOINT = "/api/chzzk-chat-token";
  const CHAT_WS_URL = "wss://kr-ss1.chat.naver.com/chat";

  const CMD = {
    PING: 0,
    PONG: 10000,
    CONNECT: 100,
    CONNECTED: 10100,
    CHAT: 93101,
    DONATION: 93102,
  };

  // 후원(도네이션) 메시지의 msgTypeCode 값 — 같은 93102 커맨드 안에 구독 등
  // 다른 이벤트도 섞여 오므로 이 코드로 후원만 골라낸다(비공식 커뮤니티
  // 라이브러리 d2n0s4ur/chzzk-chat 참고).
  const DONATION_MSG_TYPE = 10;

  function connect(channelId, handlers) {
    const seenUserIds = new Set();
    let ws = null;
    let closedByUser = false;
    let pingTimer = 0;

    handlers.onStatus?.("connecting");

    fetch(`${TOKEN_ENDPOINT}?channelId=${encodeURIComponent(channelId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.available) {
          throw new Error(data.message || "채팅 연결 준비 실패");
        }
        openSocket(data.chatChannelId, data.accessToken, data.channelName, data.liveTitle);
      })
      .catch((err) => {
        handlers.onStatus?.("error", err.message || String(err));
      });

    function openSocket(chatChannelId, accessToken, channelName, liveTitle) {
      if (closedByUser) return;
      ws = new WebSocket(CHAT_WS_URL);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            ver: "2",
            cmd: CMD.CONNECT,
            svcid: "game",
            cid: chatChannelId,
            bdy: { uid: null, devType: 2001, accTkn: accessToken, auth: "READ" },
            tid: 1,
          })
        );
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          return;
        }

        if (data.cmd === CMD.PING) {
          ws.send(JSON.stringify({ ver: "2", cmd: CMD.PONG }));
          return;
        }

        if (data.cmd === CMD.CONNECTED) {
          handlers.onStatus?.("connected", null, { channelName, liveTitle });
          return;
        }

        if (data.cmd === CMD.CHAT && Array.isArray(data.bdy)) {
          for (const msg of data.bdy) {
            handleChatMessage(msg);
          }
        }

        if (data.cmd === CMD.DONATION && Array.isArray(data.bdy)) {
          for (const msg of data.bdy) {
            handleDonationMessage(msg);
          }
        }
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
          ws.send(JSON.stringify({ ver: "2", cmd: CMD.PING }));
        }
      }, 20000);
    }

    function handleChatMessage(msg) {
      const text = String(msg?.msg ?? "").trim();
      if (!text.startsWith("참가") && !text.startsWith("!참가")) {
        return;
      }
      let nickname = "";
      let userIdHash = "";
      try {
        const profile = JSON.parse(msg.profile);
        nickname = profile?.nickname || "";
        userIdHash = profile?.userIdHash || nickname;
      } catch (err) {
        nickname = "익명";
        userIdHash = `anon-${Math.random()}`;
      }
      if (!nickname || seenUserIds.has(userIdHash)) {
        return;
      }
      seenUserIds.add(userIdHash);
      handlers.onJoin?.(nickname);
    }

    // 후원 메시지 파싱 — 비공식 라이브러리(d2n0s4ur/chzzk-chat) 구조를 참고했다.
    // msgTypeCode=10이 후원, extras.payAmount가 실제 결제된 치즈 금액(1치즈=1원),
    // msg.msg가 후원 문구(응원 메시지)다. 익명 후원은 msg.uid가 "anonymous".
    function handleDonationMessage(msg) {
      if (msg?.msgTypeCode !== DONATION_MSG_TYPE) {
        return;
      }
      let amount = 0;
      try {
        amount = Number(JSON.parse(msg.extras)?.payAmount || 0);
      } catch (err) {
        return;
      }
      if (!amount) return;

      let nickname = "";
      if (msg.uid !== "anonymous") {
        try {
          nickname = JSON.parse(msg.profile)?.nickname || "";
        } catch (err) {
          nickname = "";
        }
      }
      const message = String(msg?.msg ?? "").trim();
      handlers.onDonation?.({ nickname, message, amount });
    }

    return {
      disconnect() {
        closedByUser = true;
        window.clearInterval(pingTimer);
        ws?.close();
      },
    };
  }

  global.MarbleChzzk = { connect };
})(window);
