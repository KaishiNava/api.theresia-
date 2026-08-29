export default async function handler(req, res) {
  // 1. Set Header Anti-CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Tangani Request Preflight Browser (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ status: false, message: "Query (q) parameter required" });
  }

  try {
    // 2. Fetch Halaman Pencarian Pinterest
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });

    const html = await response.text();

    // 3. Extract JSON Data dari Script Tag Pinterest
    const jsonMatch = html.match(/<script id="__PWA_DATA__" type="application\/json">(.*?)<\/script>/s) ||
                      html.match(/<script id="initial-data" type="application\/json">(.*?)<\/script>/s);

    if (!jsonMatch) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengekstrak data dari Pinterest. Struktur halaman mungkin berubah."
      });
    }

    const parsedData = JSON.parse(jsonMatch[1]);
    
    // Navigasi ke array hasil pencarian
    const mainData = parsedData?.props?.initialReduxState?.search?.searchPage?.pins || 
                     parsedData?.initialReduxState?.pins || {};
    
    const rawPins = Object.values(mainData);

    // 4. Format & Filter Data (Hanya Mengambil Gambar Kualitas Terbaik)
    const results = rawPins
      .filter(pin => pin && pin.images)
      .map(pin => {
        // Ambil URL gambar resolusi paling tinggi (orig / 736x)
        const directImageUrl = pin.images.orig?.url || 
                               pin.images["736x"]?.url || 
                               pin.images["474x"]?.url;

        return {
          title: pin.grid_title || pin.title || pin.description || "Pinterest Media",
          pin_url: `https://www.pinterest.com/pin/${pin.id}/`,
          download_direct_url: directImageUrl
        };
      })
      .filter(item => item.download_direct_url);

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Tidak ada hasil yang ditemukan."
      });
    }

    // 5. Kirim Response
    return res.status(200).json({
      status: true,
      creator: "Theresia Api",
      service: "Pinterest Search & Downloader",
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
