export default async function handler(req, res) {
  // 1. Set Header Anti-CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Tangani Request Preflight Browser (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ status: false, message: "URL required" });
  }

  try {
    // 2. Tembak Endpoint API Cobalt untuk Kualitas 720p
    const res720 = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: url,
        videoQuality: "720"
      })
    });
    const data720 = await res720.json();

    // 3. Tembak Endpoint API Cobalt untuk Kualitas 1080p
    const res1080 = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: url,
        videoQuality: "1080"
      })
    });
    const data1080 = await res1080.json();

    // Validasi jika URL tidak valid atau tidak bisa diunduh
    if (data720.status === "error" && data1080.status === "error") {
      return res.status(400).json({
        status: false,
        message: data720.text || "Gagal memproses URL YouTube. Pastikan link valid."
      });
    }

    // 4. Kembalikan Response
    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "YouTube Downloader",
      data: {
        title: data720.filename || "YouTube Video HD",
        quality_720p: data720.url || null,
        quality_1080p: data1080.url || data720.url || null
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Terjadi kesalahan internal pada server.",
      error: error.message
    });
  }
}
