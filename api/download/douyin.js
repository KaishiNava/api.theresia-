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
    const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const response = await fetch(tikwmApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    
    const result = await response.json();

    if (result.code !== 0 || !result.data) {
      return res.status(400).json({
        status: false,
        message: result.msg || "Gagal mengambil video TikTok/Douyin. Pastikan URL valid."
      });
    }

    const videoData = result.data;

    const fixUrl = (path) => {
      if (!path) return null;
      return path.startsWith("http") ? path : `https://www.tikwm.com${path}`;
    };

    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "TikTok / Douyin Downloader",
      data: {
        title: videoData.title || "TikTok/Douyin Media",
        cover: fixUrl(videoData.cover),
        author: {
          nickname: videoData.author?.nickname || "-",
          unique_id: videoData.author?.unique_id || "-",
          avatar: fixUrl(videoData.author?.avatar)
        },
        stats: {
          views: videoData.play_count || 0,
          likes: videoData.digg_count || 0,
          comments: videoData.comment_count || 0,
          shares: videoData.share_count || 0
        },
        video_nowm: fixUrl(videoData.play),
        video_wm: fixUrl(videoData.wmplay),
        audio: fixUrl(videoData.music)
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
