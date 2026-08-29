export default async function handler(req, res) {
  // ==========================================
  // CORS
  // ==========================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      status: false,
      message: "Method not allowed"
    });
  }

  // ==========================================
  // GET URL
  // ==========================================
  let url;

  if (req.method === "GET") {
    url = req.query?.url;
  } else {
    url = req.body?.url;
  }

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      status: false,
      message: "URL required"
    });
  }

  // ==========================================
  // VALIDATE URL
  // ==========================================
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({
      status: false,
      message: "URL tidak valid"
    });
  }

  // ==========================================
  // YOUTUBE CHECK
  // ==========================================
  const hostname = parsedUrl.hostname
    .toLowerCase()
    .replace(/^www\./, "");

  const isYoutube =
    hostname === "youtube.com" ||
    hostname === "youtu.be" ||
    hostname.endsWith(".youtube.com");

  if (!isYoutube) {
    return res.status(400).json({
      status: false,
      message: "URL harus berupa link YouTube"
    });
  }

  // ==========================================
  // COBALT
  // ==========================================
  try {
    const cobaltResponse = await fetch(
      "https://api.cobalt.tools/",
      {
        method: "POST",

        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"
        },

        body: JSON.stringify({
          url: parsedUrl.toString(),

          videoQuality: "1080",

          audioFormat: "mp3",

          filenameStyle: "basic",

          downloadMode: "auto"
        })
      }
    );

    const rawText = await cobaltResponse.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        status: false,
        message: "Provider downloader mengembalikan response yang tidak valid.",
        provider_status: cobaltResponse.status
      });
    }

    // ==========================================
    // PROVIDER ERROR
    // ==========================================
    if (!cobaltResponse.ok) {
      return res.status(502).json({
        status: false,
        message:
          data?.text ||
          data?.error?.message ||
          "Gagal menghubungi provider YouTube.",
        provider_status: cobaltResponse.status
      });
    }

    if (
      data.status === "error" ||
      data.status === "failed"
    ) {
      return res.status(400).json({
        status: false,
        message:
          data.text ||
          data.error?.message ||
          "Gagal memproses video YouTube."
      });
    }

    // ==========================================
    // GET DOWNLOAD URL
    // ==========================================
    let downloadUrl = null;

    if (typeof data.url === "string") {
      downloadUrl = data.url;
    }

    if (
      !downloadUrl &&
      Array.isArray(data.picker) &&
      data.picker.length > 0
    ) {
      const first = data.picker.find(
        item => typeof item?.url === "string"
      );

      if (first) {
        downloadUrl = first.url;
      }
    }

    // ==========================================
    // PICKER
    // ==========================================
    const picker = Array.isArray(data.picker)
      ? data.picker
          .filter(item => item?.url)
          .map(item => ({
            url: item.url,
            type: item.type || null
          }))
      : [];

    // ==========================================
    // NO DOWNLOAD URL
    // ==========================================
    if (!downloadUrl && picker.length === 0) {
      return res.status(502).json({
        status: false,
        message:
          "Provider berhasil dipanggil tetapi tidak memberikan URL download.",
        provider_status: data.status || null
      });
    }

    // ==========================================
    // SUCCESS
    // ==========================================
    return res.status(200).json({
      status: true,

      creator: "Theresia Api",

      service: "YouTube Downloader",

      data: {
        title:
          data.filename ||
          "YouTube Video",

        download_url:
          downloadUrl,

        status:
          data.status || "tunnel",

        picker:
          picker,

        provider:
          "Cobalt"
      }
    });

  } catch (error) {
    console.error(
      "YouTube Downloader Error:",
      error
    );

    return res.status(500).json({
      status: false,
      message:
        "Terjadi kesalahan internal pada server.",

      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
}