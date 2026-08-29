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

  // ==========================================
  // GET PARAMETER
  // ==========================================
  let q = req.method === "GET" ? req.query?.q : req.body?.q;
  let limit = req.method === "GET" ? req.query?.limit : req.body?.limit;

  if (!q || typeof q !== "string" || !q.trim()) {
    return res.status(400).json({ status: false, message: "Query (q) parameter required" });
  }

  q = q.trim();
  limit = Math.min(Math.max(Number.parseInt(limit || "20", 10), 1), 50);

  // ==========================================
  // PINTEREST SCRAPER (Bypass 403)
  // ==========================================
  try {
    const url = `https://id.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Upgrade-Insecure-Requests": "1"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        status: false,
        message: "Pinterest memblokir permintaan ini sementara waktu.",
        provider_status: response.status
      });
    }

    const html = await response.text();

    // Ekstrak data state dari tag script HTML
    const jsonMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (!jsonMatch || !jsonMatch[1]) {
      return res.status(502).json({
        status: false,
        message: "Gagal mengekstrak data dari Pinterest (Struktur HTML berubah)."
      });
    }

    const data = JSON.parse(jsonMatch[1]);
    const pins = [];
    const usedUrls = new Set();

    // Fungsi rekursif untuk mencari objek gambar di seluruh JSON
    function findPins(obj) {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.images && obj.images.orig && obj.images.orig.url) {
        const imgUrl = obj.images.orig.url;
        if (!usedUrls.has(imgUrl)) {
          usedUrls.add(imgUrl);
          pins.push({
            id: obj.id || null,
            title: obj.title || obj.grid_title || obj.description || "Pinterest Image",
            description: obj.description || null,
            pin_url: obj.id ? `https://www.pinterest.com/pin/${obj.id}/` : null,
            image_url: imgUrl,
            download_direct_url: imgUrl,
            author: {
              name: obj.pinner?.full_name || obj.pinner?.username || "Unknown",
              username: obj.pinner?.username || null
            }
          });
        }
      }
      
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          findPins(obj[key]);
        }
      }
    }

    findPins(data);

    const results = pins.slice(0, limit);

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message: `Tidak ada gambar untuk pencarian "${q}".`
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
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}
