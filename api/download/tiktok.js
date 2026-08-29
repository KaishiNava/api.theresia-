export default async function handler(req, res) {
  // =========================
  // CORS
  // =========================
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

  // =========================
  // GET URL
  // =========================
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

  // Basic URL validation
  let targetUrl;

  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({
      status: false,
      message: "URL tidak valid"
    });
  }

  // =========================
  // TIKWM REQUEST
  // =========================
  try {
    const tikwmApiUrl =
      `https://www.tikwm.com/api/?url=${encodeURIComponent(
        targetUrl.toString()
      )}`;

    const response = await fetch(tikwmApiUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        status: false,
        message: "Gagal menghubungi TikWM",
        http_status: response.status
      });
    }

    const result = await response.json();

    if (result.code !== 0 || !result.data) {
      return res.status(400).json({
        status: false,
        message:
          result.msg ||
          "Gagal mengambil media. Pastikan URL TikTok/Douyin valid."
      });
    }

    const videoData = result.data;

    // =========================
    // FIX URL
    // =========================
    const fixUrl = (value) => {
      if (!value) return null;

      if (typeof value !== "string") return null;

      if (value.startsWith("http://")) return value;
      if (value.startsWith("https://")) return value;

      return `https://www.tikwm.com${value.startsWith("/") ? "" : "/"}${value}`;
    };

    const videoNowm = fixUrl(videoData.play);
    const videoWm = fixUrl(videoData.wmplay);
    const audio = fixUrl(videoData.music);

    // =========================
    // DOWNLOAD MODE
    //
    // /api/tiktok?url=URL&download=1
    // =========================
    const download =
      req.query?.download === "1" ||
      req.query?.download === "true";

    if (download) {
      if (!videoNowm) {
        return res.status(404).json({
          status: false,
          message: "URL video tidak tersedia"
        });
      }

      // Fetch video dari server TikWM
      const videoResponse = await fetch(videoNowm, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
          Referer: "https://www.tiktok.com/"
        }
      });

      if (!videoResponse.ok) {
        return res.status(502).json({
          status: false,
          message: "Gagal mengambil file video dari provider",
          http_status: videoResponse.status
        });
      }

      const contentType =
        videoResponse.headers.get("content-type") ||
        "video/mp4";

      const contentLength =
        videoResponse.headers.get("content-length");

      // Nama file aman
      const fileName =
        `tiktok_${Date.now()}.mp4`;

      res.setHeader(
        "Content-Type",
        contentType.includes("video")
          ? contentType
          : "video/mp4"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );

      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      // Node.js / Vercel
      if (videoResponse.body) {
        const reader = videoResponse.body.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            res.write(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
        }

        return res.end();
      }

      return res.status(500).json({
        status: false,
        message: "Response video tidak memiliki body"
      });
    }

    // =========================
    // JSON RESPONSE
    // =========================
    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "TikTok / Douyin Downloader",

      data: {
        title:
          videoData.title ||
          "TikTok/Douyin Media",

        cover: fixUrl(videoData.cover),

        author: {
          nickname:
            videoData.author?.nickname ||
            "-",

          unique_id:
            videoData.author?.unique_id ||
            "-",

          avatar:
            fixUrl(videoData.author?.avatar)
        },

        stats: {
          views:
            videoData.play_count ||
            0,

          likes:
            videoData.digg_count ||
            0,

          comments:
            videoData.comment_count ||
            0,

          shares:
            videoData.share_count ||
            0
        },

        video_nowm: videoNowm,
        video_wm: videoWm,
        audio: audio,

        // Endpoint download langsung
        download_url:
          `${getBaseUrl(req)}/api/tiktok?url=${encodeURIComponent(
            targetUrl.toString()
          )}&download=1`
      }
    });
  } catch (error) {
    console.error("TikTok Downloader Error:", error);

    return res.status(500).json({
      status: false,
      message: "Terjadi kesalahan internal pada server.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
}

// =========================
// GET BASE URL
// =========================
function getBaseUrl(req) {
  const protocol =
    req.headers["x-forwarded-proto"] ||
    "https";

  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host;

  return `${protocol}://${host}`;
}