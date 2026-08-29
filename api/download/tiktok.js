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
    // 2. Fetch data dari API TikWM
    const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const response = await fetch(tikwmApiUrl);
    const result = await response.json();

    // 3. Validasi Response TikWM
    if (result.code !== 0 || !result.data) {
      return res.status(400).json({
        status: false,
        message: result.msg || "Gagal mengambil video TikTok. Pastikan URL valid."
      });
    }

    const videoData = result.data;

    // 4. Buat URL CDN TikWM penuh jika mengembalikan path relatif
    const playUrl = videoData.play.startsWith("http")
      ? videoData.play
      : `https://www.tikwm.com${videoData.play}`;
      
    const wmUrl = videoData.wmplay.startsWith("http")
      ? videoData.wmplay
      : `https://www.tikwm.com${videoData.wmplay}`;

    const musicUrl = videoData.music.startsWith("http")
      ? videoData.music
      : `https://www.tikwm.com${videoData.music}`;

    // 5. Kembalikan Response
    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "TikTok Downloader",
      data: {
        title: videoData.title,
        cover: videoData.cover,
        author: {
          nickname: videoData.author.nickname,
          unique_id: videoData.author.unique_id,
          avatar: videoData.author.avatar
        },
        stats: {
          views: videoData.play_count,
          likes: videoData.digg_count,
          comments: videoData.comment_count,
          shares: videoData.share_count
        },
        video_nowm: playUrl,
        video_wm: wmUrl,
        audio: musicUrl
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
