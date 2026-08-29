export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, message: "Method not allowed" });
  }

  let q = req.method === "GET" ? req.query?.q : req.body?.q;
  let limit = req.method === "GET" ? req.query?.limit : req.body?.limit;

  if (!q || typeof q !== "string" || !q.trim()) {
    return res.status(400).json({ status: false, message: "Query (q) required" });
  }

  q = q.trim();
  limit = Math.min(Math.max(Number.parseInt(limit || "20", 10) || 20, 1), 50);

  try {
    const searchUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(
      `/search/pins/?q=${q}`
    )}&data=${encodeURIComponent(
      JSON.stringify({
        options: { isPrefetch: false, query: q, scope: "pins", page_size: limit },
        context: {}
      })
    )}`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.pinterest.com/"
      }
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        status: false,
        message: "Pinterest mengembalikan response yang bukan JSON.",
        provider_status: response.status
      });
    }

    const rawResults = data?.resource_response?.data?.results || [];
    if (!Array.isArray(rawResults) || rawResults.length === 0) {
      return res.status(404).json({
        status: false,
        message: `Tidak ada gambar ditemukan untuk "${q}".`
      });
    }

    const results = [];
    const usedUrls = new Set();

    for (const item of rawResults) {
      if (!item || !item.images) continue;

      const imageUrl =
        item.images.orig?.url ||
        item.images["736x"]?.url ||
        item.images["564x"]?.url ||
        item.images["474x"]?.url;

      if (!imageUrl || usedUrls.has(imageUrl)) continue;
      usedUrls.add(imageUrl);

      results.push({
        id: item.id || null,
        title: item.title || item.grid_title || item.description || "Pinterest Image",
        description: item.description || null,
        pin_url: item.id ? `https://www.pinterest.com/pin/${item.id}/` : null,
        image_url: imageUrl,
        download_direct_url: imageUrl,
        author: {
          name: item.pinner?.full_name || item.pinner?.username || null,
          username: item.pinner?.username || null
        }
      });

      if (results.length >= limit) break;
    }

    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "Pinterest Search Engine",
      query: q,
      total_results: results.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Terjadi kesalahan internal pada server.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}
