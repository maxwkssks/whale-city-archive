export default function handler(req, res) {
  const clientId = process.env.SOOP_CLIENT_ID;
  const redirectUri = process.env.SOOP_REDIRECT_URI;

  const authUrl =
    "https://openapi.sooplive.co.kr/oauth/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&response_type=code";

  res.redirect(authUrl);
}