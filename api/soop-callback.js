export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("SOOP 인증 code가 없습니다.");
  }

  try {
    const tokenResponse = await fetch("https://openapi.sooplive.co.kr/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.SOOP_CLIENT_ID,
        client_secret: process.env.SOOP_CLIENT_SECRET,
        redirect_uri: process.env.SOOP_REDIRECT_URI,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("SOOP 토큰 발급 실패:", tokenData);
      return res.status(500).json(tokenData);
    }

    // 일단 테스트용: 토큰 발급 성공 확인
    // 실제 서비스에서는 access_token을 화면에 보여주면 안 됨
    return res.redirect(
      `/login.html?soop=success`
    );
  } catch (error) {
    console.error("SOOP callback error:", error);
    return res.status(500).send("SOOP 연동 중 오류가 발생했습니다.");
  }
}