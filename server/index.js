import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview';
const MAX_INT32 = 2147483647;
const ALLOWED_ASPECT_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
const REQUEST_TIMEOUT_MS = process.env.GENERATION_TIMEOUT_MS
  ? Number(process.env.GENERATION_TIMEOUT_MS)
  : 120000;
const VIDEO_TIMEOUT_MS = 300000; // 5 minutes for Veo
const VIDEO_MODEL = process.env.VEO_MODEL || 'veo-3.0-fast-generate-001';
const VIDEO_POLL_INTERVAL_MS = 10000;

const VENICE_API_BASE = 'https://api.venice.ai/api/v1';
const VENICE_ASPECT_RATIO_MAP = {
  '1:1':  { width: 1024, height: 1024 },
  '3:4':  { width: 768,  height: 1024 },
  '4:3':  { width: 1024, height: 768  },
  '9:16': { width: 576,  height: 1024 },
  '16:9': { width: 1280, height: 720  },
};

app.use(express.json({ limit: '20mb' }));

const GEMINI_IMAGE_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
];

app.get('/api/models', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const veniceKey = process.env.VENICE_API_KEY;
  const result = { gemini: [], venice: [] };

  if (geminiKey) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      const data = await r.json();
      result.gemini = (data.models || [])
        .filter(m => GEMINI_IMAGE_MODELS.includes(m.name.replace('models/', '')))
        .map(m => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name.replace('models/', '') }));
    } catch (e) {
      console.warn('[models] gemini fetch failed:', e.message);
    }
  }

  if (veniceKey) {
    try {
      const r = await fetch(`${VENICE_API_BASE}/models?type=image`, {
        headers: { Authorization: `Bearer ${veniceKey}` },
      });
      const data = await r.json();
      result.venice = (data.data || []).map(m => ({ id: m.id, name: m.id }));
    } catch (e) {
      console.warn('[models] venice fetch failed:', e.message);
    }
  }

  return res.json(result);
});

app.post('/api/generate', async (req, res) => {
  const { prompt, seed, aspectRatio, fastRender, provider = 'gemini', model, referenceImage } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROMPT' });
  }

  const ratio = ALLOWED_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : '16:9';
  const safeSeed = Math.abs(Math.floor(Number(seed ?? 0))) % (MAX_INT32 + 1);
  const startedAt = Date.now();
  console.log(`[generate] start provider=${provider} model=${model || 'default'} ratio=${ratio} seed=${safeSeed}`);

  try {
    // --- Local Stable Diffusion (AUTOMATIC1111) ---
    if (provider === 'local-sd') {
      const localSdUrl = process.env.LOCAL_SD_URL || 'http://localhost:7860';
      const { width, height } = VENICE_ASPECT_RATIO_MAP[ratio] || VENICE_ASPECT_RATIO_MAP['16:9'];

      const sdRes = await Promise.race([
        fetch(`${localSdUrl}/sdapi/v1/txt2img`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            negative_prompt:
              'deformed, disfigured, bad anatomy, extra limbs, missing limbs, watermark, text, blurry, low quality',
            steps: 30,
            width,
            height,
            seed: safeSeed,
            cfg_scale: 7,
            sampler_name: 'DPM++ 2M Karras',
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)),
      ]);

      if (!sdRes.ok) {
        const text = await sdRes.text();
        console.error('[local-sd] error:', sdRes.status, text.slice(0, 200));
        return res.status(502).json({ error: 'LOCAL_SD_ERROR' });
      }

      const sdData = await sdRes.json();
      const b64 = sdData?.images?.[0];
      if (!b64) return res.status(502).json({ error: 'NO_IMAGE_DATA' });
      console.log(`[local-sd] done in ${Date.now() - startedAt}ms`);
      return res.json({ url: `data:image/png;base64,${b64}`, prompt });
    }

    // --- Venice AI ---
    if (provider === 'venice') {
      const veniceKey = process.env.VENICE_API_KEY;
      if (!veniceKey) return res.status(401).json({ error: 'AUTH_REQUIRED' });

      const { width, height } = VENICE_ASPECT_RATIO_MAP[ratio] || VENICE_ASPECT_RATIO_MAP['16:9'];
      const veniceRes = await Promise.race([
        fetch(`${VENICE_API_BASE}/image/generate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${veniceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'flux-dev-uncensored',
            prompt,
            width,
            height,
            steps: 28,
            cfg_scale: 7,
            seed: safeSeed,
            safe_mode: false,
            return_binary: false,
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)),
      ]);

      const veniceData = await veniceRes.json();
      if (!veniceRes.ok) {
        console.error('[venice] API error:', JSON.stringify(veniceData));
        return res.status(502).json({ error: 'NO_IMAGE_DATA' });
      }
      // Venice returns OpenAI-compatible format: data[0].b64_json
      // or sometimes images[0] directly
      const b64 = veniceData?.images?.[0]
        ?? veniceData?.data?.[0]?.b64_json
        ?? veniceData?.data?.[0]?.url;
      if (!b64) {
        console.error('[venice] unexpected response shape:', JSON.stringify(veniceData).slice(0, 300));
        return res.status(502).json({ error: 'NO_IMAGE_DATA' });
      }
      // If it's already a URL (not base64), return directly
      const url = b64.startsWith('http') ? b64 : `data:image/png;base64,${b64}`;
      return res.json({ url, prompt });
    }

    // --- Gemini ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const activeModel = model || MODEL_NAME;
    const imageSize = fastRender ? '512' : '1K';
    const ai = new GoogleGenAI({ apiKey });
    const parts = [];
    if (referenceImage) {
      const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
      if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    parts.push({ text: prompt });
    const generate = (size) =>
      Promise.race([
        ai.models.generateContent({
          model: activeModel,
          contents: [{ parts }],
          config: { seed: safeSeed, imageConfig: { aspectRatio: ratio, imageSize: size } },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)),
      ]);

    let response;
    try {
      response = await generate(imageSize);
    } catch (err) {
      if (fastRender) {
        console.warn('[generate] fast render failed, retrying at 1K');
        response = await generate('1K');
      } else {
        throw err;
      }
    }

    const candidate = response.candidates?.[0];
    if (!candidate) return res.status(502).json({ error: 'NO_RESULT' });
    if (candidate.finishReason === 'SAFETY') return res.status(400).json({ error: 'SAFETY_BLOCK' });

    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return res.json({
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            prompt,
          });
        }
      }
    }
    return res.status(502).json({ error: 'NO_IMAGE_DATA' });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'GENERATION_FAILED';
    const elapsed = Date.now() - startedAt;
    console.error(`[generate] failed after ${elapsed}ms: ${message}`);
    if (message.includes('"code":503') || message.includes('UNAVAILABLE')) return res.status(503).json({ error: 'MODEL_UNAVAILABLE' });
    if (message.includes('"code":429') || message.includes('RESOURCE_EXHAUSTED')) return res.status(429).json({ error: 'RATE_LIMITED' });
    if (message === 'TIMEOUT') return res.status(504).json({ error: 'TIMEOUT' });
    return res.status(500).json({ error: 'GENERATION_FAILED' });
  } finally {
    console.log(`[generate] done in ${Date.now() - startedAt}ms`);
  }
});

app.post('/api/generate-video', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROMPT' });
  }

  const startedAt = Date.now();
  console.log(`[video] start len=${prompt.length}`);

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Start the long-running Veo operation
    let operation = await ai.models.generateVideos({
      model: VIDEO_MODEL,
      prompt,
      config: {
        numberOfVideos: 1,
        durationSeconds: 8,
        aspectRatio: '16:9',
        personGeneration: 'allow_adult',
      },
    });

    // Poll until done or timeout
    while (!operation.done) {
      if (Date.now() - startedAt > VIDEO_TIMEOUT_MS) {
        throw new Error('TIMEOUT');
      }
      await new Promise(r => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
      operation = await ai.operations.getVideosOperation({ operation });
      console.log(`[video] polling... elapsed=${Date.now() - startedAt}ms`);
    }

    const generatedVideo = operation.response?.generatedVideos?.[0];
    if (!generatedVideo?.video?.uri) {
      return res.status(502).json({ error: 'NO_VIDEO_DATA' });
    }

    // Download the video bytes from the Files API
    const videoUri = generatedVideo.video.uri;
    const downloadUrl = videoUri.includes('?') ? `${videoUri}&alt=media` : `${videoUri}?alt=media`;
    const videoRes = await fetch(downloadUrl, {
      headers: { 'X-Goog-Api-Key': apiKey },
    });

    if (!videoRes.ok) {
      console.error(`[video] download failed: ${videoRes.status}`);
      return res.status(502).json({ error: 'VIDEO_DOWNLOAD_FAILED' });
    }

    const videoBuffer = await videoRes.arrayBuffer();
    const base64 = Buffer.from(videoBuffer).toString('base64');
    const mimeType = generatedVideo.video.mimeType || 'video/mp4';

    const elapsed = Date.now() - startedAt;
    console.log(`[video] done in ${elapsed}ms size=${videoBuffer.byteLength}`);

    return res.json({ url: `data:${mimeType};base64,${base64}`, prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VIDEO_FAILED';
    const elapsed = Date.now() - startedAt;
    console.error(`[video] failed after ${elapsed}ms: ${message}`);
    if (message === 'TIMEOUT') return res.status(504).json({ error: 'TIMEOUT' });
    if (message.includes('"code":429') || message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
    return res.status(500).json({ error: 'VIDEO_FAILED' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.resolve(__dirname, '..', 'dist');

  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
