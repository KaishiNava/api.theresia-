export default async function handler(req, res) {
  // Set Header Anti-CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ status: false, message: "URL required" });
  }

  try {
    const response = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify({
        url: url,
        vQuality: "1080",
        filenamePattern: "basic"
      })
    });

    const data = await response.json();

    if (data.status === "error") {
      return res.status(400).json({
        status: false,
        message: data.text || "Gagal memproses URL YouTube. Pastikan link valid."
      });
    }

    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "YouTube Downloader",
      data: {
        title: data.filename || "YouTube Video HD",
        download_url: data.url || data.picker?.[0]?.url || null,
        status: data.status
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
