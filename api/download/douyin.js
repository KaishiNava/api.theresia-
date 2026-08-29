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
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(parsedUrl.toString())}`;
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36",
        Accept: "application/json"
      }
    });

    const result = await response.json();
    if (result.code !== 0 || !result.data) {
      return res.status(400).json({ status: false, message: result.msg || "Gagal mengambil video Douyin." });
    }

    const videoData = result.data;
    const fixUrl = (val) => {
      if (!val || typeof val !== "string") return null;
      if (val.startsWith("http")) return val;
      return `https://www.tikwm.com${val.startsWith("/") ? "" : "/"}${val}`;
    };

    const videoNowm = fixUrl(videoData.play);
    const download = req.query?.download === "1" || req.query?.download === "true";

    if (download) {
      if (!videoNowm) {
        return res.status(404).json({ status: false, message: "Video Douyin tidak tersedia" });
      }

      const videoResponse = await fetch(videoNowm, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36",
          Referer: "https://www.douyin.com/"
        }
      });

      const arrayBuffer = await videoResponse.arrayBuffer();
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="douyin_${Date.now()}.mp4"`);
      return res.send(Buffer.from(arrayBuffer));
    }

    const baseUrl = getBaseUrl(req);
    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "Douyin Downloader",
      data: {
        title: videoData.title || "Douyin Video",
        cover: fixUrl(videoData.cover),
        author: {
          nickname: videoData.author?.nickname || "-",
          unique_id: videoData.author?.unique_id || "-",
          avatar: fixUrl(videoData.author?.avatar)
        },
        video_nowm: videoNowm,
        video_wm: fixUrl(videoData.wmplay),
        audio: fixUrl(videoData.music),
        download_url: `${baseUrl}/api/download/douyin?url=${encodeURIComponent(parsedUrl.toString())}&download=1`
      }
    });

  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
}

function getBaseUrl(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}
