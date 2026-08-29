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

  const hostname = parsedUrl.hostname
    .toLowerCase()
    .replace(/^www\./, "");

  const isDouyin =
    hostname === "douyin.com" ||
    hostname.endsWith(".douyin.com");

  if (!isDouyin) {
    return res.status(400).json({
      status: false,
      message: "URL harus berupa link Douyin"
    });
  }

  // ==========================================
  // TIKWM
  // ==========================================
  try {
    const apiUrl =
      `https://www.tikwm.com/api/?url=${encodeURIComponent(
        parsedUrl.toString()
      )}`;

    const response = await fetch(apiUrl, {
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
        message: "Provider TikWM tidak dapat dihubungi",
        provider_status: response.status
      });
    }

    const result = await response.json();

    if (
      result.code !== 0 ||
      !result.data
    ) {
      return res.status(400).json({
        status: false,
        message:
          result.msg ||
          "Gagal mengambil video Douyin."
      });
    }

    const videoData = result.data;

    // ==========================================
    // FIX URL
    // ==========================================
    const fixUrl = (value) => {
      if (!value) return null;

      if (typeof value !== "string") {
        return null;
      }

      if (
        value.startsWith("http://") ||
        value.startsWith("https://")
      ) {
        return value;
      }

      return `https://www.tikwm.com${
        value.startsWith("/") ? "" : "/"
      }${value}`;
    };

    const videoNowm =
      fixUrl(videoData.play);

    const videoWm =
      fixUrl(videoData.wmplay);

    const audio =
      fixUrl(videoData.music);

    // ==========================================
    // DIRECT DOWNLOAD
    //
    // ?download=1
    // ==========================================
    const download =
      req.query?.download === "1" ||
      req.query?.download === "true";

    if (download) {
      if (!videoNowm) {
        return res.status(404).json({
          status: false,
          message: "Video Douyin tidak tersedia"
        });
      }

      const videoResponse =
        await fetch(videoNowm, {
          method: "GET",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",

            Referer:
              "https://www.douyin.com/"
          }
        });

      if (!videoResponse.ok) {
        return res.status(502).json({
          status: false,
          message:
            "Gagal mengambil file video dari provider.",

          provider_status:
            videoResponse.status
        });
      }

      const contentType =
        videoResponse.headers.get(
          "content-type"
        ) || "video/mp4";

      const contentLength =
        videoResponse.headers.get(
          "content-length"
        );

      const filename =
        `douyin_${Date.now()}.mp4`;

      res.setHeader(
        "Content-Type",
        contentType.includes("video")
          ? contentType
          : "video/mp4"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      // ==========================================
      // STREAM VIDEO
      // ==========================================
      if (videoResponse.body) {
        const reader =
          videoResponse.body.getReader();

        try {
          while (true) {
            const {
              done,
              value
            } = await reader.read();

            if (done) break;

            res.write(
              Buffer.from(value)
            );
          }
        } finally {
          reader.releaseLock();
        }

        return res.end();
      }

      return res.status(500).json({
        status: false,
        message:
          "Response video tidak memiliki body."
      });
    }

    // ==========================================
    // DIRECT DOWNLOAD URL
    // ==========================================
    const baseUrl =
      getBaseUrl(req);

    const downloadUrl =
      `${baseUrl}/api/douyin?url=${encodeURIComponent(
        parsedUrl.toString()
      )}&download=1`;

    // ==========================================
    // JSON RESPONSE
    // ==========================================
    return res.status(200).json({
      status: true,

      creator:
        "Theresia Api",

      service:
        "Douyin Downloader",

      data: {
        title:
          videoData.title ||
          "Douyin Video",

        cover:
          fixUrl(videoData.cover),

        author: {
          nickname:
            videoData.author?.nickname ||
            "-",

          unique_id:
            videoData.author?.unique_id ||
            "-",

          avatar:
            fixUrl(
              videoData.author?.avatar
            )
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

        video_nowm:
          videoNowm,

        video_wm:
          videoWm,

        audio:
          audio,

        download_url:
          downloadUrl
      }
    });

  } catch (error) {
    console.error(
      "Douyin Downloader Error:",
      error
    );

    return res.status(500).json({
      status: false,

      message:
        "Terjadi kesalahan internal pada server.",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined
    });
  }
}

// ==========================================
// BASE URL
// ==========================================
function getBaseUrl(req) {
  const protocol =
    req.headers["x-forwarded-proto"] ||
    "https";

  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host;

  return `${protocol}://${host}`;
}