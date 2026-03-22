const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const stations = [
  { name: "R2AltPop", stream: "https://icecast.err.ee/r2alternatiiv.mp3" },
  { name: "R2Chill", stream: "https://icecast.err.ee/r2chill.mp3" },
  { name: "R2Eesti", stream: "https://icecast.err.ee/r2eesti.mp3" },
  { name: "R2Millenium", stream: "https://icecast.err.ee/r2music.mp3" },
  { name: "R2Räp", stream: "https://icecast.err.ee/r2p.mp3" },
  { name: "R2Rock", stream: "https://icecast.err.ee/r2rock.mp3" },
  { name: "KlaraNostalgia", stream: "https://icecast.err.ee/klaranostalgia.mp3" },
  { name: "KlaraJazz", stream: "https://icecast.err.ee/klarajazz.mp3" },
  { name: "R4Retro", stream: "https://icecast.err.ee/r4retro.mp3" }
];

async function getArtwork(track){
  try{
    const res = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(track)}&limit=1`);
    if(res.data.results.length > 0){
      return res.data.results[0].artworkUrl100.replace("100x100","400x400");
    }
  }catch(e){}
  return null;
}

app.get("/api/stations", async (req,res)=>{
  try{
    const ice = await axios.get("https://icecast.err.ee/status-json.xsl");
    const sources = ice.data.icestats.source;

    const data = await Promise.all(stations.map(async s=>{
      const src = sources.find(x =>
        x.listenurl.toLowerCase().includes(s.stream.split("/").pop())
      );

      const title = src?.title || "Hetkel mitte saadaval";
      const artwork = await getArtwork(title);

      return {
        name: s.name,
        stream: s.stream,
        title,
        artwork
      };
    }));

    res.json(data);
  }catch(err){
    res.status(500).json({error:"Viga andmete laadimisel"});
  }
});

app.listen(PORT,()=>console.log("Server töötab: http://localhost:"+PORT));