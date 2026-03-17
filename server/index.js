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

app.use(express.json({ limit: '1mb' }));

app.post('/api/generate', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  const { prompt, seed, aspectRatio, fastRender } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROMPT' });
  }

  const ratio = ALLOWED_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : '16:9';
  const safeSeed = Math.abs(Math.floor(Number(seed ?? 0))) % (MAX_INT32 + 1);
  const imageSize = fastRender ? '512' : '1K';
  const startedAt = Date.now();
  console.log(`[generate] start ratio=${ratio} seed=${safeSeed} len=${prompt.length} fast=${!!fastRender}`);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const generate = (size) =>
      Promise.race([
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            seed: safeSeed,
            imageConfig: {
              aspectRatio: ratio,
              imageSize: size,
            },
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)
        ),
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
    if (!candidate) {
      return res.status(502).json({ error: 'NO_RESULT' });
    }
    if (candidate.finishReason === 'SAFETY') {
      return res.status(400).json({ error: 'SAFETY_BLOCK' });
    }

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
    if (message.includes('"code":503') || message.includes('UNAVAILABLE')) {
      return res.status(503).json({ error: 'MODEL_UNAVAILABLE' });
    }
    if (message === 'TIMEOUT') {
      return res.status(504).json({ error: 'TIMEOUT' });
    }
    return res.status(500).json({ error: 'GENERATION_FAILED' });
  } finally {
    const elapsed = Date.now() - startedAt;
    console.log(`[generate] done in ${elapsed}ms`);
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
