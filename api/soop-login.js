export default function handler(req, res) {
  const clientId = process.env.SOOP_CLIENT_ID;
  const redirectUri = process.env.SOOP_REDIRECT_URI;

  // [추가] 환경변수 미설정 시 undefined가 URL에 들어가 로그인이 깨짐
  // Vercel 환경변수에 SOOP_CLIENT_ID, SOOP_REDIRECT_URI가 없으면 즉시 에러 반환
  if (!clientId || !redirectUri) {
    console.error("환경변수 누락:", { SOOP_CLIENT_ID: !!clientId, SOOP_REDIRECT_URI: !!redirectUri });
    return res.status(500).send("서버 설정 오류: SOOP 환경변수가 설정되지 않았습니다.");
  }

  const authUrl =
    "https://openapi.sooplive.com/auth/code" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&response_type=code";

  res.redirect(authUrl);
}