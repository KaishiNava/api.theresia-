export default async function handler(req, res) {
  // ==========================================
  // CORS
  // ==========================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
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
  // GET PARAMETER
  // ==========================================
  let q;
  let limit;

  if (req.method === "GET") {
    q = req.query?.q;
    limit = req.query?.limit;
  } else {
    q = req.body?.q;
    limit = req.body?.limit;
  }

  if (!q || typeof q !== "string") {
    return res.status(400).json({
      status: false,
      message:
        "Query (q) parameter required"
    });
  }

  q = q.trim();

  if (!q) {
    return res.status(400).json({
      status: false,
      message:
        "Query tidak boleh kosong"
    });
  }

  // ==========================================
  // LIMIT
  // ==========================================
  limit = Number.parseInt(limit || "20", 10);

  if (!Number.isFinite(limit)) {
    limit = 20;
  }

  // Batasi agar API tidak terlalu berat
  limit = Math.min(
    Math.max(limit, 1),
    50
  );

  // ==========================================
  // PINTEREST API
  // ==========================================
  try {
    const endpoint =
      "https://www.pinterest.com/resource/BaseSearchResource/get/";

    const sourceUrl =
      `/search/pins/?q=${encodeURIComponent(q)}`;

    const payload = {
      options: {
        query: q,
        scope: "pins",
        page_size: limit
      },
      context: {}
    };

    const params =
      new URLSearchParams();

    params.set(
      "source_url",
      sourceUrl
    );

    params.set(
      "data",
      JSON.stringify(payload)
    );

    const response =
      await fetch(
        `${endpoint}?${params.toString()}`,
        {
          method: "GET",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",

            "Accept":
              "application/json, text/javascript, */*; q=0.01",

            "Accept-Language":
              "en-US,en;q=0.9",

            "Referer":
              `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`,

            "X-Requested-With":
              "XMLHttpRequest"
          }
        }
      );

    // ==========================================
    // RESPONSE CHECK
    // ==========================================
    const text =
      await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        status: false,
        message:
          "Pinterest mengembalikan response yang bukan JSON.",

        provider_status:
          response.status
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        status: false,
        message:
          "Pinterest gagal memproses pencarian.",

        provider_status:
          response.status
      });
    }

    // ==========================================
    // GET RESULTS
    // ==========================================
    const rawResults =
      data?.resource_response?.data?.results ||
      [];

    if (!Array.isArray(rawResults)) {
      return res.status(502).json({
        status: false,
        message:
          "Format response Pinterest berubah."
      });
    }

    // ==========================================
    // FORMAT IMAGE
    // ==========================================
    const getImage =
      (images) => {
        if (!images) {
          return null;
        }

        return (
          images.orig?.url ||
          images["1200x"]?.url ||
          images["736x"]?.url ||
          images["564x"]?.url ||
          images["474x"]?.url ||
          images["236x"]?.url ||
          null
        );
      };

    // ==========================================
    // PROCESS RESULTS
    // ==========================================
    const results = [];

    const usedUrls =
      new Set();

    for (
      const item of rawResults
    ) {
      if (!item) {
        continue;
      }

      const imageUrl =
        getImage(item.images);

      if (!imageUrl) {
        continue;
      }

      // Hilangkan gambar duplikat
      if (usedUrls.has(imageUrl)) {
        continue;
      }

      usedUrls.add(imageUrl);

      const pinId =
        item.id ||
        null;

      const pinUrl =
        pinId
          ? `https://www.pinterest.com/pin/${pinId}/`
          : null;

      results.push({
        id:
          pinId,

        title:
          item.title ||
          item.grid_title ||
          item.description ||
          "Pinterest Image",

        description:
          item.description ||
          null,

        pin_url:
          pinUrl,

        image_url:
          imageUrl,

        download_direct_url:
          imageUrl,

        width:
          item.images?.orig?.width ||
          null,

        height:
          item.images?.orig?.height ||
          null,

        author: {
          name:
            item.pinner?.full_name ||
            item.pinner?.username ||
            null,

          username:
            item.pinner?.username ||
            null
        }
      });

      if (
        results.length >= limit
      ) {
        break;
      }
    }

    // ==========================================
    // EMPTY RESULT
    // ==========================================
    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message:
          `Tidak ada gambar untuk pencarian "${q}".`
      });
    }

    // ==========================================
    // SUCCESS
    // ==========================================
    return res.status(200).json({
      status: true,

      creator:
        "Theresia Api",

      service:
        "Pinterest Search Engine",

      query:
        q,

      total_results:
        results.length,

      results:
        results
    });

  } catch (error) {
    console.error(
      "Pinterest Search Error:",
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