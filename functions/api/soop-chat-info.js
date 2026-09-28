const DEFAULT_BJID = "psb010203";

// 마블 레이스 "SOOP 채팅 연결" 버튼이 호출하는 엔드포인트.
// live.afreecatv.com/afreeca/player_live_api.php는 Access-Control-Allow-Origin이
// play.sooplive.com으로 고정돼 있어 브라우저에서 직접 fetch할 수 없다 —
// chzzk-chat-token.js와 같은 방식으로 서버(Cloudflare Pages Function)에서 대신
// 호출해, 채팅 웹소켓 접속에 필요한 값만 브라우저에 돌려준다.
//
// *** 이 값들은 SOOP(구 아프리카TV)의 비공식 프로토콜이다 — 플랫폼이 언제든
// 바꿀 수 있고, 공개 문서가 없어 커뮤니티가 역공학한 내용에 기반한다. ***
export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const bjid = requestUrl.searchParams.get("bjid") || String(context.env?.SOOP_BJID || DEFAULT_BJID).trim() || DEFAULT_BJID;

  try {
    const body = new URLSearchParams({
      bid: bjid,
      bno: "",
      type: "live",
      confirm_adult: "false",
      player_type: "html5",
      mode: "landing",
      from_api: "0",
      pwd: "",
      stream_type: "common",
      quality: "HD",
    });

    const res = await fetch(`https://live.afreecatv.com/afreeca/player_live_api.php?bjid=${encodeURIComponent(bjid)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      return Response.json({ available: false, message: "방송 정보를 가져오지 못했어요." }, { status: 502 });
    }
    const data = (await res.json())?.CHANNEL || {};
    const isLive = Number(data.RESULT || 0) === 1;
    if (!isLive) {
      return Response.json({ available: false, message: "지금은 방송 중이 아니에요." }, { status: 404 });
    }
    const chdomain = String(data.CHDOMAIN || "").toLowerCase();
    const chatno = String(data.CHATNO || "");
    const chpt = String(Number(data.CHPT || 0) + 1);
    if (!chdomain || !chatno || !Number(chpt)) {
      return Response.json({ available: false, message: "채팅 서버 정보가 비어있어요." }, { status: 502 });
    }

    return Response.json({
      available: true,
      bjid: String(data.BJID || bjid),
      chdomain,
      chatno,
      chpt,
      channelName: String(data.BJNICK || "").trim(),
      liveTitle: String(data.TITLE || "").trim(),
    });
  } catch (error) {
    return Response.json({ available: false, message: "SOOP 채팅 연결을 준비하는 중 오류가 발생했어요." }, { status: 500 });
  }
}
