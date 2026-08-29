export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, message: "Method not allowed" });
  }

  let url = req.method === "GET" ? req.query?.url : req.body?.url;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ status: false, message: "URL required" });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ status: false, message: "URL tidak valid" });
  }

  try {
    const cobaltResponse = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        url: parsedUrl.toString(),
        videoQuality: "720",
        downloadMode: "auto"
      })
    });

    const rawText = await cobaltResponse.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        status: false,
        message: "Provider YouTube mengembalikan response tidak valid."
      });
    }

    if (!cobaltResponse.ok || data.status === "error") {
      return res.status(502).json({
        status: false,
        message: data?.text || data?.error?.message || "Gagal memproses video YouTube."
      });
    }

    let downloadUrl = typeof data.url === "string" ? data.url : null;
    if (!downloadUrl && Array.isArray(data.picker)) {
      const first = data.picker.find(item => item?.url);
      if (first) downloadUrl = first.url;
    }

    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "YouTube Downloader",
      data: {
        title: data.filename || "YouTube Video",
        download_url: downloadUrl,
        status: data.status || "success",
        provider: "Cobalt"
      }
    });

  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
}
