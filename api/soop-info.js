export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      ok: false,
      message: "SOOP URL이 필요합니다."
    });
  }

  try {
    const targetUrl = String(url);

    const pageResponse = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!pageResponse.ok) {
      return res.status(pageResponse.status).json({
        ok: false,
        message: "SOOP 페이지를 불러오지 못했습니다."
      });
    }

    const html = await pageResponse.text();

    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);

    let thumbnail = ogImageMatch?.[1] || "";

    if (thumbnail && thumbnail.startsWith("//")) {
      thumbnail = "https:" + thumbnail;
    }

    const vodIdMatch =
      targetUrl.match(/player\/(\d+)/) ||
      targetUrl.match(/vod\.sooplive\.com\/player\/(\d+)/) ||
      targetUrl.match(/vod\.sooplive\.co\.kr\/player\/(\d+)/);

    const vodId = vodIdMatch?.[1] || "";

    let embedUrl = "";

    if (vodId) {
      embedUrl = `https://vod.sooplive.com/player/${vodId}/embed?type=catch&showChat=false&mutePlay=false`;
    }

    return res.status(200).json({
      ok: true,
      vodId,
      embedUrl,
      thumbnail
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "SOOP 영상 정보를 가져오지 못했습니다."
    });
  }
}
