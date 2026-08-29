export default async function handler(req, res) {
  // Set Header Anti-CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ status: false, message: "Query (q) parameter required" });
  }

  try {
    const pinApiUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/`;
    const params = new URLSearchParams({
      source_url: `/search/pins/?q=${encodeURIComponent(q)}`,
      data: JSON.stringify({
        options: {
          query: q,
          scope: "pins"
        },
        context: {}
      })
    });

    const response = await fetch(`${pinApiUrl}?${params.toString()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*, q=0.01",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    const data = await response.json();
    const rawResults = data?.resource_response?.data?.results || [];

    const results = rawResults
      .filter(item => item && item.images)
      .map(item => {
        const imageUrl = item.images.orig?.url || item.images["736x"]?.url || item.images["474x"]?.url;
        return {
          title: item.title || item.grid_title || item.description || "Pinterest Media",
          pin_url: `https://www.pinterest.com/pin/${item.id}/`,
          download_direct_url: imageUrl
        };
      })
      .filter(item => item.download_direct_url);

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Tidak ada hasil yang ditemukan."
      });
    }

    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "Pinterest Search Engine",
      query: q,
      total_results: results.length,
      results: results
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Terjadi kesalahan internal pada server.",
      error: error.message
    });
  }
}
