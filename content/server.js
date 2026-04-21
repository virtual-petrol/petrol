import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.post("/generate", async (req, res) => {
    try {
        const { prompt } = req.body;

        // ❌ If no prompt
        if (!prompt) {
            return res.json({ result: "Please enter a prompt" });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();

        // 🔍 DEBUG (terminal मा देखिन्छ)
        console.log("FULL RESPONSE:");
        console.log(JSON.stringify(data, null, 2));

        // ❌ API error handle
        if (data.error) {
            return res.json({
                result: "❌ OpenAI Error: " + data.error.message
            });
        }

        // ✅ Success response
        const output = data.choices?.[0]?.message?.content;

        res.json({
            result: output || "⚠️ No response from AI"
        });

    } catch (error) {
        console.error("SERVER ERROR:", error);
        res.status(500).json({
            result: "Server error: " + error.message
        });
    }
});

app.listen(3000, () => {
    console.log("✅ Server running on http://localhost:3000");
});
