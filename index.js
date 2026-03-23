const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const stations = [
  { name: "R2", stream: "https://icecast.err.ee/raadio2.mp3", fallbackImage: "/images/r2.png" },
  { name: "R2AltPop", stream: "https://icecast.err.ee/r2alternatiiv.mp3", fallbackImage: "/images/r2altpop.png" },
  { name: "R2Chill", stream: "https://icecast.err.ee/r2chill.mp3", fallbackImage: "/images/r2chill.png" },
  { name: "R2Eesti", stream: "https://icecast.err.ee/r2eesti.mp3", fallbackImage: "/images/r2eesti.png" },
  { name: "R2Millenium", stream: "https://icecast.err.ee/r2music.mp3", fallbackImage: "/images/r2millenium.png" },
  { name: "R2Räp", stream: "https://icecast.err.ee/r2p.mp3", fallbackImage: "/images/r2rap.png" },
  { name: "R2Rock", stream: "https://icecast.err.ee/r2rock.mp3", fallbackImage: "/images/r2rock.png" },
  { name: "R2Pop", stream: "https://icecast.err.ee/r2pop.mp3", fallbackImage: "/images/r2pop.png" },
  { name: "KlaraNostalgia", stream: "https://icecast.err.ee/klaranostalgia.mp3", fallbackImage: "/images/klaranostalgia.png" },
  { name: "KlaraJazz", stream: "https://icecast.err.ee/klarajazz.mp3", fallbackImage: "/images/klarajazz.png" },
  { name: "R4Retro", stream: "https://icecast.err.ee/r4retro.mp3", fallbackImage: "/images/r4retro.png" },
  { name: "Raadio Tallinn", stream: "https://icecast.err.ee/raadiotallinn.mp3", fallbackImage: "/images/raadiotallinn.png" }
];

function cleanTitle(raw) {
  if (!raw) return "";

  return raw
    .replace(/–|—/g, "-")
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTrack(title) {
  const cleaned = cleanTitle(title);
  const parts = cleaned.split(" - ");

  return {
    artist: parts[0] || "",
    song: parts.slice(1).join(" ") || ""
  };
}

async function getITunes(track) {
  try {
    const { artist, song } = parseTrack(track);
    const term = `${artist} ${song}`.trim();

    if (!term) return null;

    const res = await axios.get(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=3`,
      { timeout: 8000 }
    );

    return res.data.results[0]?.artworkUrl100?.replace("100x100", "400x400") || null;
  } catch {
    return null;
  }
}

async function getDeezer(track) {
  try {
    const res = await axios.get(
      `https://api.deezer.com/search?q=${encodeURIComponent(track)}`,
      { timeout: 8000 }
    );

    return res.data.data[0]?.album?.cover_big || null;
  } catch {
    return null;
  }
}

async function getR2WebsiteImage() {
  try {
    const res = await axios.get("https://r2.err.ee", {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const $ = cheerio.load(res.data);

    let img =
      $(".radio-player-img").attr("src") ||
      $(".radio-player-img").attr("ng-src") ||
      null;

    if (!img) return null;

    if (img.startsWith("//")) {
      img = "https:" + img;
    } else if (img.startsWith("/")) {
      img = "https://r2.err.ee" + img;
    }

    return img;
  } catch (e) {
    console.log("R2 website image error:", e.message);
    return null;
  }
}

async function getArtwork(title, station) {
  const normalizedTitle = (title || "").toLowerCase();

  if (
    (station.name === "R2" || station.name === "Raadio Tallinn") &&
    normalizedTitle.includes("uudised")
  ) {
    return "/images/uudised.png";
  }

  let img = await getITunes(title);
  if (img) return img;

  img = await getDeezer(title);
  if (img) return img;

  if (station.name === "R2") {
    img = await getR2WebsiteImage();
    if (img) return img;
  }

  return station.fallbackImage;
}

app.get("/api/stations", async (req, res) => {
  try {
    const ice = await axios.get("https://icecast.err.ee/status-json.xsl", {
      timeout: 8000
    });

    const sources = ice.data.icestats.source;

    const data = await Promise.all(
      stations.map(async (s) => {
        const src = sources.find((x) =>
          x.listenurl.toLowerCase().includes(s.stream.split("/").pop())
        );

        const title = src?.title || "Hetkel mitte saadaval";
        const artwork = await getArtwork(title, s);

        return {
          name: s.name,
          stream: s.stream,
          title,
          artwork
        };
      })
    );

    res.json(data);
  } catch (err) {
    console.log("API error:", err.message);
    res.status(500).json({ error: "Viga" });
  }
});

app.listen(PORT, () => {
  console.log("http://localhost:" + PORT);
});