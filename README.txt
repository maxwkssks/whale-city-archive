SOOP Open API 연동 파일

프로젝트 루트에 api 폴더째로 넣으세요.

추가 파일:
- api/soop-login.js
- api/soop-callback.js

Vercel 환경변수:
- SOOP_CLIENT_ID
- SOOP_CLIENT_SECRET
- SOOP_REDIRECT_URI

테스트 주소:
https://whale-city-archive.vercel.app/api/soop-login

중요:
SOOP 개발자 페이지의 Redirect URI와 Vercel의 SOOP_REDIRECT_URI 값은 반드시 같아야 합니다.
