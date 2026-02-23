import { serve } from "bun";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import questionsData from "./questions.json";
import tailwindPlugin from "bun-plugin-tailwind";

// Serve the application and API
const server = serve({
  async fetch(req) {
    const url = new URL(req.url);

    // Dynamic bundling for JS/TSX files
    if (url.pathname === "/frontend.js") {
      console.log(`[Build] Intercepted request for /frontend.js`);
      try {
        const build = await Bun.build({
          entrypoints: ["src/frontend.tsx"],
          target: "browser",
          plugins: [tailwindPlugin],
          minify: false, // Keep it readable for debug
        });

        if (!build.success) {
          console.error("[Build] Bun.build failed:", build.logs);
          return new Response("Build failed: " + build.logs.map(l => l.message).join("\n"), { status: 500 });
        }

        console.log(`[Build] Success! Serving frontend.js bundle (${build.outputs[0].size} bytes)`);
        return new Response(build.outputs[0], { headers: { "Content-Type": "text/javascript" } });
      } catch (err: any) {
        console.error("[Build] Exceptional error during bundling:", err);
        return new Response("Build Error: " + err.message, { status: 500 });
      }
    }

    // Serve static files from src/ (mostly assets)
    if (url.pathname !== "/" && !url.pathname.startsWith("/api/")) {
      const filePath = `src${url.pathname === "/index.css" ? "/index.css" : url.pathname}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const contentType = file.type || "application/octet-stream";
        console.log(`[Static] Serving: ${url.pathname} (${contentType})`);
        return new Response(file, { headers: { "Content-Type": contentType } });
      }
    }

    // Default to index.html for root or unknown paths (for SPA support)
    if (url.pathname === "/" || (!url.pathname.startsWith("/api/") && !url.pathname.includes("."))) {
      console.log(`[Static] Serving: index.html for ${url.pathname}`);
      const indexFile = Bun.file("src/index.html");
      if (await indexFile.exists()) {
        return new Response(indexFile, { headers: { "Content-Type": "text/html" } });
      }
    }

    // API Routes
    if (url.pathname === "/api/questions") {
      return Response.json(questionsData);
    }

    if (url.pathname === "/api/transcribe" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File;
        if (!audioFile) return Response.json({ error: "No audio file" }, { status: 400 });

        console.log(`[Transcription] Received file: ${audioFile.name}, size: ${audioFile.size} bytes`);

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === "your_key_here") {
          console.warn("[Transcription] Missing or placeholder OpenAI API Key. Returning mock transcription.");
          return Response.json({ text: "I'm sorry, to actually transcribe your voice you need to provide a real OpenAI API Key in the .env file. This is a mock response because the key is missing." });
        }

        const openaiFormData = new FormData();
        openaiFormData.append("file", audioFile);
        openaiFormData.append("model", "whisper-1");

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`
          },
          body: openaiFormData
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("[Transcription] OpenAI Error:", errorData);
          return Response.json({ error: errorData.error?.message || "OpenAI transcription failed" }, { status: response.status });
        }

        const data = await response.json();
        return Response.json({ text: data.text });
      } catch (error: any) {
        console.error("Transcription Error:", error);
        return Response.json({ error: error.message || "Transcription failed" }, { status: 500 });
      }
    }

    if (url.pathname === "/api/analyze" && req.method === "POST") {
      try {
        const body = await req.json();
        const { question, answer, role, timeLimit, remainingTime } = body;

        console.log(`[AI Analysis] Processing request for role: ${role}`);

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === "your_key_here") {
          console.warn("[AI Analysis] Missing OpenAI API Key. Returning sample feedback.");
          return Response.json({
            feedback: {
              mistakes: ["Usage of filler words (um, uh)", "Answer could be more structured using the STAR method"],
              annotatedAnswer: "I managed a team [Comment: Strong opening] to deliver a high-impact feature. We [Comment: Use 'I' instead of 'We' here] completed it on time.",
              explanation: "Overall, your response was relevant, but it lacked specific quantifiable metrics and a clear conclusion.",
              sampleAnswer: "In my previous role, I led the redesign of our core dashboard. I identified three bottlenecks, implemented a new caching layer, and reduced load times by 40% over two months.",
              scores: { communication: 82, structure: 75, relevance: 88, timing: 95 }
            }
          });
        }

        const prompt = `
          Act as an elite expert interview coach. Analyze the candidate response.
          Role: ${role}, Question: "${question}", Target: ${timeLimit}s, Actual: ${timeLimit - remainingTime}s.
          Answer: "${answer}"

          Task:
          1. Identify specific mistakes (filler words, weak phrasing, logical gaps).
          2. Create an "annotatedAnswer" string where you wrap mistakes in brackets like this: [Comment: <issue description>]. Example: "I actually [Comment: Filler word] think..."
          3. Provide a "sampleAnswer" that is professional, clear, and perfectly timed.
          
          Output exactly in JSON:
          {
            "feedback": {
              "mistakes": ["Point 1", "Point 2"],
              "annotatedAnswer": "User Transcript with [Comment: ...] markers",
              "explanation": "Brief overview.",
              "sampleAnswer": "Model answer.",
              "scores": { "communication": 75, "structure": 80, "relevance": 90, "timing": 100 }
            }
          }
        `;

        const { text } = await generateText({
          model: openai("gpt-4o"),
          prompt: prompt,
          system: "Professional interview evaluator. Return ONLY JSON.",
        });

        // Robust JSON cleaning
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text;
        return Response.json(JSON.parse(cleanJson));
      } catch (error: any) {
        console.error("AI Error:", error);
        return Response.json({
          feedback: {
            mistakes: ["AI Evaluation Error", "Service Unavailable"],
            explanation: `Error during AI analysis: ${error.message}`,
            sampleAnswer: "Please try again later or check your API configuration.",
            scores: { communication: 0, structure: 0, relevance: 0, timing: 0 }
          }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 InterviewAI Server running at ${server.url}`);
