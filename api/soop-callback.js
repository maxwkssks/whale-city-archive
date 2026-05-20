export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("SOOP 인증 code가 없습니다.");
  }

  // [추가] 환경변수 미설정 시 token 교환 자체가 실패하므로 먼저 체크
  if (!process.env.SOOP_CLIENT_ID || !process.env.SOOP_CLIENT_SECRET || !process.env.SOOP_REDIRECT_URI) {
    console.error("환경변수 누락:", {
      CLIENT_ID: !!process.env.SOOP_CLIENT_ID,
      CLIENT_SECRET: !!process.env.SOOP_CLIENT_SECRET,
      REDIRECT_URI: !!process.env.SOOP_REDIRECT_URI
    });
    return res.status(500).send("서버 설정 오류: SOOP 환경변수가 설정되지 않았습니다.");
  }

  try {
    // ─── [기존 유지] 인증 code → access_token 교환 ──────────────────────────
    const tokenResponse = await fetch("https://openapi.sooplive.com/auth/token", {
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

    // ─── [추가] access_token으로 SOOP 사용자 정보 조회 ──────────────────────
    // 기존 코드는 토큰만 받고 /login.html?soop=success 로 끝나서
    // 누가 로그인했는지 알 방법이 없었음.
    // 닉네임을 클립·인물·월드컵 수정 기록에 남기려면 실제 사용자 정보가 필요함.
    // ※ SOOP OpenAPI 사용자 프로필 엔드포인트 (SOOP 개발자 문서 참고)
    //   응답 필드가 다를 경우 아래 soopId / soopNick 추출 부분 수정 필요
    const profileResponse = await fetch("https://openapi.sooplive.com/user/stationinfo", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ access_token: tokenData.access_token })
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok || profileData.result !== 1) {
      console.error("SOOP 사용자 정보 조회 실패:", profileData);
      return res.redirect("/login.html?soop=error");
    }

    console.log("SOOP 프로필 응답 키:", Object.keys(profileData.data || {}));

    // stationinfo 응답에 user_id가 없으므로 profile_image URL에서 BJ ID 추출
    // 예: https://profile.img.sooplive.com/LOGO/nm/nmax0724/nmax0724.jpg → nmax0724
    const profileImage = profileData.data?.profile_image || "";
    const urlParts = profileImage.split("/").filter(Boolean);
    const soopId   = urlParts.length >= 2 ? urlParts[urlParts.length - 2] : "";
    const soopNick = profileData.data?.user_nick || soopId || "알 수 없음";

    // [버그 수정] soopId가 빈 문자열이면 main.js에서 로그인 조건이 false가 되어
    // 에러 메시지 없이 로그인이 조용히 실패함 → 명시적으로 error 페이지로 보냄
    if (!soopId) {
      console.error("SOOP user_id를 가져오지 못했습니다. 응답 구조 확인 필요:", profileData);
      return res.redirect("/login.html?soop=error");
    }

    // ─── [변경] 기존: /login.html?soop=success (사용자 정보 없이 이동만 했음)
    //           변경: soop_id·soop_nick을 URL 파라미터로 프론트에 전달
    //           → 프론트(main.js)에서 localStorage에 저장 후 수정 기록에 활용
    return res.redirect(
      `/login.html?soop_id=${encodeURIComponent(soopId)}&soop_nick=${encodeURIComponent(soopNick)}`
    );

  } catch (error) {
    console.error("SOOP callback error:", error);
    return res.status(500).send("SOOP 연동 중 오류가 발생했습니다.");
  }
}