const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const stations = [
  {
    name: "R2AltPop",
    stream: "https://icecast.err.ee/r2alternatiiv.mp3",
    fallbackImage: "/images/r2altpop.png"
  },
  {
    name: "R2Chill",
    stream: "https://icecast.err.ee/r2chill.mp3",
    fallbackImage: "/images/r2chill.png"
  },
  {
    name: "R2Eesti",
    stream: "https://icecast.err.ee/r2eesti.mp3",
    fallbackImage: "/images/r2eesti.png"
  },
  {
    name: "R2Millenium",
    stream: "https://icecast.err.ee/r2music.mp3",
    fallbackImage: "/images/r2millenium.png"
  },
  {
    name: "R2Räp",
    stream: "https://icecast.err.ee/r2p.mp3",
    fallbackImage: "/images/r2rap.png"
  },
  {
    name: "R2Rock",
    stream: "https://icecast.err.ee/r2rock.mp3",
    fallbackImage: "/images/r2rock.png"
  },
  {
    name: "KlaraNostalgia",
    stream: "https://icecast.err.ee/klaranostalgia.mp3",
    fallbackImage: "/images/klaranostalgia.png"
  },
  {
    name: "KlaraJazz",
    stream: "https://icecast.err.ee/klarajazz.mp3",
    fallbackImage: "/images/klarajazz.png"
  },
  {
    name: "R4Retro",
    stream: "https://icecast.err.ee/r4retro.mp3",
    fallbackImage: "/images/r4retro.png"
  }
];

function cleanTitle(raw) {
  if (!raw) return "";

  return raw
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/\bfeat\.?\b/gi, " ")
    .replace(/\bft\.?\b/gi, " ")
    .replace(/\bfeaturing\b/gi, " ")
    .replace(/\bremix\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTrack(title) {
  const cleaned = cleanTitle(title);
  const parts = cleaned.split(" - ");

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      song: parts.slice(1).join(" - ").trim()
    };
  }

  return {
    artist: "",
    song: cleaned
  };
}

function scoreMatch(item, artist, song) {
  const a = (item.artistName || item.artist?.name || "").toLowerCase();
  const s = (item.trackName || item.title || "").toLowerCase();

  const artistLc = (artist || "").toLowerCase();
  const songLc = (song || "").toLowerCase();

  let score = 0;

  if (artistLc && a === artistLc) score += 5;
  else if (artistLc && a.includes(artistLc)) score += 3;

  if (songLc && s === songLc) score += 5;
  else if (songLc && s.includes(songLc)) score += 3;

  return score;
}

async function getArtworkFromITunes(trackTitle) {
  try {
    const { artist, song } = parseTrack(trackTitle);
    const searchTerm = `${artist} ${song}`.trim();

    if (!searchTerm) return null;

    const url =
      `https://itunes.apple.com/search` +
      `?term=${encodeURIComponent(searchTerm)}` +
      `&media=music` +
      `&entity=song` +
      `&country=EE` +
      `&limit=5`;

    const res = await axios.get(url, { timeout: 8000 });
    const results = res.data?.results || [];

    if (!results.length) return null;

    const best =
      results
        .map(item => ({ item, score: scoreMatch(item, artist, song) }))
        .sort((a, b) => b.score - a.score)[0]?.item || null;

    if (!best?.artworkUrl100) return null;

    return best.artworkUrl100.replace("100x100", "400x400");
  } catch (e) {
    console.log("iTunes artwork error:", e.message);
    return null;
  }
}

async function getArtworkFromDeezer(trackTitle) {
  try {
    const { artist, song } = parseTrack(trackTitle);
    const searchTerm = `${artist} ${song}`.trim();

    if (!searchTerm) return null;

    const url = `https://api.deezer.com/search?q=${encodeURIComponent(searchTerm)}`;
    const res = await axios.get(url, { timeout: 8000 });
    const results = res.data?.data || [];

    if (!results.length) return null;

    const best =
      results
        .map(item => ({ item, score: scoreMatch(item, artist, song) }))
        .sort((a, b) => b.score - a.score)[0]?.item || null;

    if (!best) return null;

    return (
      best.album?.cover_xl ||
      best.album?.cover_big ||
      best.album?.cover_medium ||
      best.album?.cover ||
      null
    );
  } catch (e) {
    console.log("Deezer artwork error:", e.message);
    return null;
  }
}

async function getBestArtwork(trackTitle, fallbackImage) {
  const iTunesArtwork = await getArtworkFromITunes(trackTitle);
  if (iTunesArtwork) return iTunesArtwork;

  const deezerArtwork = await getArtworkFromDeezer(trackTitle);
  if (deezerArtwork) return deezerArtwork;

  return fallbackImage;
}

app.get("/api/stations", async (req, res) => {
  try {
    const ice = await axios.get("https://icecast.err.ee/status-json.xsl", {
      timeout: 8000
    });

    const sources = ice.data?.icestats?.source || [];

    const data = await Promise.all(
      stations.map(async (station) => {
        const src = sources.find((x) =>
          (x.listenurl || "").toLowerCase().includes(
            station.stream.split("/").pop().toLowerCase()
          )
        );

        const title =
          src?.title && String(src.title).trim() !== ""
            ? String(src.title).trim()
            : "Hetkel mitte saadaval";

        const artwork = await getBestArtwork(title, station.fallbackImage);

        return {
          name: station.name,
          stream: station.stream,
          title,
          artwork
        };
      })
    );

    res.json(data);
  } catch (err) {
    console.log("API error:", err.message);
    res.status(500).json({ error: "Viga andmete laadimisel" });
  }
});

app.listen(PORT, () =>
  console.log("Server töötab: http://localhost:" + PORT)
);