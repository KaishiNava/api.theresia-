export default async function handler(req, res) {
  // ==========================================
  // CORS
  // ==========================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

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

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  const isYoutube = hostname === "youtube.com" || hostname === "youtu.be" || hostname.endsWith(".youtube.com");

  if (!isYoutube) {
    return res.status(400).json({ status: false, message: "URL harus berupa link YouTube" });
  }

  // ==========================================
  // MULTI-INSTANCE COBALT FALLBACK
  // ==========================================
  const instances = [
    "https://api.cobalt.tools",
    "https://co.wuk.sh",
    "https://cobalt.q-n.space"
  ];

  let successData = null;
  let usedProvider = null;

  try {
    for (const instance of instances) {
      try {
        const response = await fetch(instance, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://cobalt.tools",
            "Referer": "https://cobalt.tools/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
          },
          body: JSON.stringify({
            url: parsedUrl.toString(),
            videoQuality: "1080",
            filenamePattern: "basic"
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status !== "error" && data.status !== "failed") {
            successData = data;
            usedProvider = instance;
            break; // Berhenti mencari jika sukses
          }
        }
      } catch (err) {
        continue; // Lanjut ke instance berikutnya jika error/timeout
      }
    }

    if (!successData) {
      return res.status(502).json({
        status: false,
        message: "Seluruh server provider sedang sibuk atau menolak koneksi. Silakan coba beberapa saat lagi."
      });
    }

    // ==========================================
    // GET DOWNLOAD URL
    // ==========================================
    let downloadUrl = null;

    if (typeof successData.url === "string") {
      downloadUrl = successData.url;
    }

    if (!downloadUrl && Array.isArray(successData.picker) && successData.picker.length > 0) {
      const first = successData.picker.find(item => typeof item?.url === "string");
      if (first) {
        downloadUrl = first.url;
      }
    }

    const picker = Array.isArray(successData.picker)
      ? successData.picker
          .filter(item => item?.url)
          .map(item => ({ url: item.url, type: item.type || null }))
      : [];

    if (!downloadUrl && picker.length === 0) {
      return res.status(502).json({
        status: false,
        message: "Provider berhasil dipanggil tetapi tidak memberikan URL download.",
      });
    }

    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "YouTube Downloader",
      data: {
        title: successData.filename || "YouTube Video",
        download_url: downloadUrl,
        status: successData.status || "success",
        picker: picker,
        provider: "Cobalt Multi-Server"
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Terjadi kesalahan internal pada server.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}
