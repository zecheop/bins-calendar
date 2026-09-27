const DEFAULT_CHANNEL_ID = "";

// 마블 레이스 "CHZZK 채팅 연결" 버튼이 호출하는 엔드포인트.
// 브라우저에서 api.chzzk.naver.com / comm-api.game.naver.com을 직접 fetch하면
// CORS/User-Agent 제한에 걸리기 쉬워서, live-status.js와 같은 방식으로
// 서버(Cloudflare Pages Function)에서 대신 호출해 채팅 접속에 필요한
// chatChannelId + accessToken만 브라우저에 돌려준다. 별도의 secret은 필요 없다
// (읽기 전용 채팅 접속 토큰은 채널 ID만으로 공개 발급된다).
export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const channelId =
    requestUrl.searchParams.get("channelId") ||
    String(context.env?.CHZZK_CHANNEL_ID || DEFAULT_CHANNEL_ID).trim() ||
    DEFAULT_CHANNEL_ID;
  const headers = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

  try {
    const liveRes = await fetch(`https://api.chzzk.naver.com/service/v2/channels/${channelId}/live-detail`, { headers });
    if (!liveRes.ok) {
      return Response.json({ available: false, message: "채널 정보를 가져오지 못했어요." }, { status: 502 });
    }
    const liveJson = (await liveRes.json()).content || {};
    const chatChannelId = liveJson.chatChannelId;
    if (!chatChannelId) {
      return Response.json({ available: false, message: "채팅 채널을 찾지 못했어요 (방송 중이 아닐 수 있어요)." }, { status: 404 });
    }
    // 사용자가 어떤 방송에 연결됐는지 확인할 수 있게, 이미 받아온 live-detail
    // 응답에서 채널명/방송 제목도 같이 뽑아 돌려준다(추가 요청 없음).
    const channelName = String(liveJson.channel?.channelName || "").trim();
    const liveTitle = String(liveJson.liveTitle || "").trim();

    const tokenRes = await fetch(
      `https://comm-api.game.naver.com/nng_main/v1/chats/access-token?channelId=${chatChannelId}&chatType=STREAMING`,
      { headers }
    );
    if (!tokenRes.ok) {
      return Response.json({ available: false, message: "채팅 접속 토큰 발급에 실패했어요." }, { status: 502 });
    }
    const tokenJson = (await tokenRes.json()).content || {};
    const accessToken = tokenJson.accessToken;
    if (!accessToken) {
      return Response.json({ available: false, message: "채팅 접속 토큰이 비어있어요." }, { status: 502 });
    }

    return Response.json({ available: true, chatChannelId, accessToken, channelName, liveTitle });
  } catch (error) {
    return Response.json({ available: false, message: "치지직 채팅 연결을 준비하는 중 오류가 발생했어요." }, { status: 500 });
  }
}
