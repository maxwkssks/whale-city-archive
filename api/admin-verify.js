export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST만 허용됩니다." });
  }

  const { soopId } = req.body || {};

  if (!soopId) {
    return res.status(400).json({ ok: false, message: "soopId가 없습니다." });
  }

  const adminIds = (process.env.ADMIN_SOOP_IDS || "").split(",").map(id => id.trim()).filter(Boolean);

  if (adminIds.includes(String(soopId))) {
    return res.status(200).json({ ok: true });
  }

  return res.status(403).json({ ok: false, message: "관리자 권한이 없습니다." });
}
