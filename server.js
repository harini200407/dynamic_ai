// server.js — Using D-ID API + MongoDB only
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // to serve video.html or other frontend

// ✅ MongoDB Connection
const MONGO_URI = "mongodb+srv://harini:harini@test-padmasini.ashrojs.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(MONGO_URI);
let collection;

client.connect().then(() => {
  const db = client.db("ai_teacher");
  collection = db.collection("lessons");
  console.log("✅ Connected to MongoDB");
});

// ✅ Route 1: Generate video from D-ID
app.post("/generate-and-upload", async (req, res) => {
  const { topic, subtopic, description } = req.body;

  try {
    const didResponse = await axios.post(
      "https://api.d-id.com/talks",
      {
        script: {
          type: "text",
          input: description,
          subtitles: "false",
        },
        // You can remove presenter_id or use a valid one from your D-ID dashboard
        // presenter_id: "amy-jcwq6j4g"
      },
      {
        headers: {
          Authorization: "Basic WkdsdVpYTm9hREl5TVRBeU1EQXhRR2R0WVdsc0xtTnZiUTp6RXV1eUtQWEU2Z0Vid3loY2kybFg=",
          "Content-Type": "application/json",
        },
      }
    );

    const talkId = didResponse.data.id;

    // Poll until video is ready
    let videoUrl = "";
    let status = "notDone";

    while (status !== "done") {
      const poll = await axios.get(`https://api.d-id.com/talks/${talkId}`, {
        headers: {
          Authorization: "Basic WkdsdVpYTm9hREl5TVRBeU1EQXhRR2R0WVdsc0xtTnZiUTp6RXV1eUtQWEU2Z0Vid3loY2kybFg=",
        },
      });

      status = poll.data.status;
      if (status === "done") {
        videoUrl = poll.data.result_url;
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    res.json({ firebase_video_url: videoUrl });
  } catch (err) {
    console.error("❌ D-ID Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Video generation failed" });
  }
});

// ✅ Route 2: Save to MongoDB
app.post("/save-full-data", async (req, res) => {
  const { topic, subtopic, description, questions, video_url } = req.body;

  try {
    const doc = {
      topic,
      subtopic,
      description,
      video_url,
      questions,
      date_added: new Date(),
    };

    await collection.insertOne(doc);
    res.json({ message: "✅ Data saved successfully." });
  } catch (err) {
    console.error("❌ MongoDB Save Error:", err.message);
    res.status(500).json({ error: "Failed to save to database" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
