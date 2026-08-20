import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import {
  buildXaiImageBody,
  normalizeXaiImageUrl,
  XAI_API_BASE,
  xaiImageGenerationModelsUrl,
  xaiImagesEditsUrl,
  xaiImagesGenerationsUrl,
} from './xai.js';
import { isSupportedBedrockImageModel } from './bedrockModels.js';
import {
  extractChatText,
  resolveTextModel,
  resolveTextProvider,
} from './textGen.js';
import { applyEnv, watchEnv } from './env.js';

applyEnv();

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
const LOCAL_SD_BASE_RES = process.env.LOCAL_SD_BASE_RES
  ? Number(process.env.LOCAL_SD_BASE_RES)
  : 768;
const LOCAL_SD_STEPS = process.env.LOCAL_SD_STEPS
  ? Number(process.env.LOCAL_SD_STEPS)
  : 25;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LOCAL_SD_CFG_SCALE = process.env.LOCAL_SD_CFG_SCALE
  ? Number(process.env.LOCAL_SD_CFG_SCALE)
  : 7;
const LOCAL_SD_SAMPLER = process.env.LOCAL_SD_SAMPLER || 'DPM++ 2M Karras';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_DEFAULT_IMAGE_MODEL = process.env.AWS_BEDROCK_IMAGE_MODEL || 'amazon.titan-image-generator-v2:0';
const AWS_IMAGE_MODELS = (process.env.AWS_BEDROCK_IMAGE_MODEL_IDS || 'amazon.titan-image-generator-v2:0,amazon.titan-image-generator-v1,stability.stable-diffusion-xl-v1,stability.sd3-large-v1:0')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const XAI_IMAGE_MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image';
const XAI_IMAGE_MODELS = (process.env.XAI_IMAGE_MODELS || XAI_IMAGE_MODEL)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
let XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_TEXT_MODEL = process.env.XAI_TEXT_MODEL || 'grok-3';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const VENICE_TEXT_MODEL = process.env.VENICE_TEXT_MODEL || 'llama-3.3-70b';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

let bedrockRuntimeClient;
function getBedrockRuntimeClient(credentials) {
  const config = { region: credentials?.region || AWS_REGION };
  if (credentials?.accessKeyId && credentials?.secretAccessKey) {
    config.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    };
    // Create a new client if custom credentials are provided
    return new BedrockRuntimeClient(config);
  }
  if (!bedrockRuntimeClient) {
    bedrockRuntimeClient = new BedrockRuntimeClient(config);
  }
  return bedrockRuntimeClient;
}

let bedrockClient;
function getBedrockClient(credentials) {
  const config = { region: credentials?.region || AWS_REGION };
  if (credentials?.accessKeyId && credentials?.secretAccessKey) {
    config.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    };
    return new BedrockClient(config);
  }
  if (!bedrockClient) {
    bedrockClient = new BedrockClient(config);
  }
  return bedrockClient;
}


function decodeBody(body) {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
    return Buffer.from(body).toString('utf8');
  }
  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }
  return String(body);
}

async function generateAwsBedrockImage({ modelId, prompt, width, height, safeSeed, credentials }) {
  const client = getBedrockRuntimeClient(credentials);
  let body;

  if (modelId.startsWith('amazon.titan-image') || modelId.startsWith('amazon.nova-canvas')) {
    body = JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: { text: prompt },
      imageGenerationConfig: {
        numberOfImages: 1,
        quality: 'standard',
        width,
        height,
        cfgScale: 7,
        seed: safeSeed,
      },
    });
  } else if (modelId.startsWith('stability.stable-diffusion') || modelId.startsWith('stability.sd3')) {
    // Stability AI models (SDXL, SD3) use a different shape
    body = JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      seed: safeSeed,
      steps: 30,
      width,
      height,
    });
  } else {
    throw new Error('MODEL_UNAVAILABLE');
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await client.send(command);
  const decoded = await decodeBody(response.body);
  let data = {};
  try {
    data = JSON.parse(decoded);
  } catch {
    throw new Error('AWS_BAD_RESPONSE');
  }

  const b64 = data?.images?.[0] || data?.artifacts?.[0]?.base64;
  if (!b64) {
    throw new Error('NO_IMAGE_DATA');
  }
  return `data:image/png;base64,${b64}`;
}

function toMultipleOf64(value) {
  return Math.max(256, Math.round(value / 64) * 64);
}

function getLocalSdDimensions(aspectRatio) {
  const fallback = VENICE_ASPECT_RATIO_MAP['1:1'];
  const source = VENICE_ASPECT_RATIO_MAP[aspectRatio] || fallback;
  // Use area-based scaling for consistent quality across aspect ratios
  const targetArea = LOCAL_SD_BASE_RES * LOCAL_SD_BASE_RES;
  const sourceArea = source.width * source.height;
  const scale = Math.sqrt(targetArea / sourceArea);
  
  return {
    width: toMultipleOf64(source.width * scale),
    height: toMultipleOf64(source.height * scale),
  };
}

async function referenceToBase64(referenceImage) {
  if (!referenceImage || typeof referenceImage !== 'string') return '';
  const dataMatch = referenceImage.match(/^data:[^;]+;base64,(.+)$/);
  if (dataMatch) return dataMatch[1];
  if (referenceImage.startsWith('http://') || referenceImage.startsWith('https://')) {
    const imgRes = await fetch(referenceImage);
    if (!imgRes.ok) return '';
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return buf.toString('base64');
  }
  return referenceImage;
}

function uniqueReferenceImages(referenceImage, referenceImages) {
  const list = [];
  if (typeof referenceImage === 'string' && referenceImage) list.push(referenceImage);
  if (Array.isArray(referenceImages)) {
    for (const item of referenceImages) {
      if (typeof item === 'string' && item) list.push(item);
    }
  }
  return [...new Set(list)];
}

app.use(express.json({ limit: '20mb' }));

const GEMINI_IMAGE_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
];

app.post('/api/models', async (req, res) => {
  const { awsCredentials } = req.body ?? {};
  const geminiKey = process.env.GEMINI_API_KEY;
  const veniceKey = process.env.VENICE_API_KEY;
  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const hasAwsRuntimeAuth = Boolean(
    (awsAccessKey && awsSecretKey) || process.env.AWS_PROFILE || process.env.AWS_WEB_IDENTITY_TOKEN_FILE || process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_EC2_METADATA_DISABLED === 'false'
  );
  const result = { gemini: [], venice: [], aws: [], xai: [] };

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

  if (hasAwsRuntimeAuth || awsCredentials) {
    try {
      const client = getBedrockClient(awsCredentials);
      const command = new ListFoundationModelsCommand({
        byOutputModality: 'IMAGE'
      });
      const data = await client.send(command);
      console.log(`[models] bedrock models found: ${data.modelSummaries?.length || 0}`);
      result.aws = (data.modelSummaries || [])
        .filter(m => m.modelLifecycle?.status !== 'LEGACY' && m.modelLifecycle?.status !== 'RETIRED')
        .filter(m => isSupportedBedrockImageModel(m.modelId))
        .map(m => ({ id: m.modelId, name: m.modelName || m.modelId }));
      
      if (result.aws.length === 0 && AWS_IMAGE_MODELS.length > 0) {
        result.aws = AWS_IMAGE_MODELS.map((id) => ({ id, name: id }));
      }
    } catch (e) {
      console.warn('[models] aws fetch failed:', e.message);
      if (AWS_IMAGE_MODELS.length > 0) {
        result.aws = AWS_IMAGE_MODELS.map((id) => ({ id, name: id }));
      }
    }
  } else if (AWS_IMAGE_MODELS.length > 0) {
    result.aws = AWS_IMAGE_MODELS.map((id) => ({ id, name: id }));
  }

  if (XAI_API_KEY) {
    try {
      const r = await fetch(xaiImageGenerationModelsUrl(), {
        headers: { Authorization: `Bearer ${XAI_API_KEY}` },
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(`XAI_MODELS_${r.status}`);
      }
      result.xai = (data.models || [])
        .map((m) => ({ id: m.id, name: m.aliases?.[0] || m.id }))
        .filter((m) => Boolean(m.id));
      if (result.xai.length === 0 && XAI_IMAGE_MODELS.length > 0) {
        result.xai = XAI_IMAGE_MODELS.map((id) => ({ id, name: id }));
      }
    } catch (e) {
      console.warn('[models] xai fetch failed:', e.message);
      if (XAI_IMAGE_MODELS.length > 0) {
        result.xai = XAI_IMAGE_MODELS.map((id) => ({ id, name: id }));
      }
    }
  } else if (XAI_IMAGE_MODELS.length > 0) {
    result.xai = XAI_IMAGE_MODELS.map((id) => ({ id, name: id }));
  }

  return res.json(result);
});

app.get('/api/local-sd-status', async (req, res) => {
  const localSdUrl = process.env.LOCAL_SD_URL || 'http://localhost:7860';
  try {
    const checkRes = await Promise.race([
      fetch(`${localSdUrl}/sdapi/v1/sd-models`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000)),
    ]);
    return res.json({ available: checkRes.ok });
  } catch {
    return res.json({ available: false });
  }
});

async function pingUrl(url, timeoutMs = 2000) {
  try {
    const response = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)),
    ]);
    return Boolean(response.ok);
  } catch {
    return false;
  }
}

app.get('/api/health', async (_req, res) => {
  const [ollama, localSd] = await Promise.all([
    pingUrl(`${OLLAMA_URL}/api/tags`),
    pingUrl(`${process.env.LOCAL_SD_URL || 'http://localhost:7860'}/sdapi/v1/sd-models`),
  ]);
  return res.json({
    envLoadedAt: process.env.CANON_ENV_LOADED_AT || null,
    providers: {
      xai: { configured: Boolean(XAI_API_KEY), note: 'Imagine for images, Grok for text' },
      venice: { configured: Boolean(process.env.VENICE_API_KEY) },
      gemini: { configured: Boolean(process.env.GEMINI_API_KEY), note: 'Also used for video' },
      aws: { configured: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) },
      'local-llm': { configured: true, available: ollama },
      'local-sd': { available: localSd },
    },
  });
});

app.post('/api/generate-text', async (req, res) => {
  const { prompt, provider = 'local-llm', model } = req.body ?? {};
  console.log(`[text-gen] prompt received, len=${prompt?.length} provider=${provider}`);
  if (!prompt) return res.status(400).json({ error: 'INVALID_PROMPT' });

  const textProvider = resolveTextProvider(provider, {
    hasXai: Boolean(XAI_API_KEY),
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
  });
  const textModel = resolveTextModel(textProvider, model, {
    xai: XAI_TEXT_MODEL,
    gemini: GEMINI_TEXT_MODEL,
    venice: VENICE_TEXT_MODEL,
    ollama: OLLAMA_MODEL,
  });

  try {
    let text = '';

    if (textProvider === 'xai') {
      if (!XAI_API_KEY) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const xaiRes = await fetch(`${XAI_API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${XAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: textModel,
          temperature: 1.1,
          messages: [
            { role: 'system', content: 'Return only a valid JSON object. No markdown, no commentary.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const xaiData = await xaiRes.json();
      if (!xaiRes.ok) {
        console.error('[text-gen] xai error:', JSON.stringify(xaiData).slice(0, 400));
        return res.status(502).json({ error: 'LLM_UNAVAILABLE' });
      }
      text = extractChatText(xaiData);
    } else if (textProvider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: textModel,
        contents: prompt,
      });
      text = response.text || '';
    } else if (textProvider === 'venice') {
      const veniceKey = process.env.VENICE_API_KEY;
      if (!veniceKey) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const veniceRes = await fetch(`${VENICE_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${veniceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: textModel,
          temperature: 1.1,
          messages: [
            { role: 'system', content: 'Return only a valid JSON object. No markdown, no commentary.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const veniceData = await veniceRes.json();
      if (!veniceRes.ok) {
        console.error('[text-gen] venice error:', JSON.stringify(veniceData).slice(0, 400));
        return res.status(502).json({ error: 'LLM_UNAVAILABLE' });
      }
      text = extractChatText(veniceData);
    } else {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: textModel,
          prompt,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error('OLLAMA_ERROR');
      const data = await response.json();
      text = data.response || '';
    }

    if (!text) return res.status(502).json({ error: 'NO_RESULT' });
    return res.json({ text });
  } catch (error) {
    console.error('[text-gen] error:', error);
    return res.status(502).json({ error: 'LLM_UNAVAILABLE' });
  }
});

app.post('/api/generate', async (req, res) => {
  const { prompt, seed, aspectRatio, fastRender, provider = 'gemini', model, referenceImage, referenceImages, useInitImage, awsCredentials } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROMPT' });
  }

  const ratio = ALLOWED_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : '16:9';
  const safeSeed = Math.abs(Math.floor(Number(seed ?? 0))) % (MAX_INT32 + 1);
  const refs = uniqueReferenceImages(referenceImage, referenceImages);
  const primaryRef = refs[0];
  const startedAt = Date.now();
  console.log(`[generate] start provider=${provider} model=${model || 'default'} ratio=${ratio} seed=${safeSeed} refs=${refs.length} init=${Boolean(useInitImage && primaryRef)}`);

  try {
    // --- xAI Grok Imagine ---
    if (provider === 'xai') {
      if (!XAI_API_KEY) return res.status(401).json({ error: 'AUTH_REQUIRED' });

      const isEdit = Boolean(primaryRef) && useInitImage;
      const xaiBody = buildXaiImageBody({
        model: model || XAI_IMAGE_MODEL,
        prompt,
        aspectRatio: ratio,
        referenceImage: isEdit ? primaryRef : undefined,
      });

      const xaiRes = await Promise.race([
        fetch(isEdit ? xaiImagesEditsUrl() : xaiImagesGenerationsUrl(), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(xaiBody),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)),
      ]);

      const xaiData = await xaiRes.json();
      if (!xaiRes.ok) {
        const code = xaiData?.code || xaiData?.error?.code || '';
        const errorMessage = xaiData?.error?.message || xaiData?.error || xaiData?.message || `XAI_ERROR_${xaiRes.status}`;
        console.error('[xai] API error:', errorMessage, JSON.stringify(xaiData).slice(0, 500));
        if (String(code).includes('content-moderated') || String(errorMessage).includes('content moderation')) {
          return res.status(400).json({ error: 'SAFETY_BLOCK' });
        }
        if (xaiRes.status === 401 || xaiRes.status === 403) return res.status(401).json({ error: 'AUTH_REQUIRED' });
        if (xaiRes.status === 429) return res.status(429).json({ error: 'RATE_LIMITED' });
        if (xaiRes.status === 503) return res.status(503).json({ error: 'MODEL_UNAVAILABLE' });
        return res.status(502).json({ error: 'GENERATION_FAILED' });
      }

      const url = normalizeXaiImageUrl(xaiData);
      if (!url) return res.status(502).json({ error: 'NO_IMAGE_DATA' });
      return res.json({ url, prompt });
    }

    // --- Local Stable Diffusion (AUTOMATIC1111) ---
    if (provider === 'local-sd') {
      const localSdUrl = process.env.LOCAL_SD_URL || 'http://localhost:7860';
      const { width, height } = getLocalSdDimensions(ratio);
      const useImg2Img = Boolean(useInitImage && primaryRef);
      const endpoint = useImg2Img ? 'img2img' : 'txt2img';
      console.log(`[local-sd] fetching ${localSdUrl}/sdapi/v1/${endpoint}`);

      const localPrompt = `${prompt}, high-fidelity, photorealistic, raw photo, 8k uhd, highly detailed skin, realistic eyes`;
      const payload = {
        prompt: localPrompt,
        negative_prompt:
          'deformed, disfigured, bad anatomy, extra limbs, missing limbs, duplicate body, duplicate person, triptych, diptych, contact sheet, split screen, collage, watermark, text, blurry, low quality, grainy, lowres, monochrome, signature, cut off, out of frame, bad proportions, gross proportions, cloned face, mutation',
        steps: LOCAL_SD_STEPS,
        width,
        height,
        seed: safeSeed,
        cfg_scale: LOCAL_SD_CFG_SCALE,
        sampler_name: LOCAL_SD_SAMPLER,
      };
      if (useImg2Img) {
        const initB64 = await referenceToBase64(primaryRef);
        if (initB64) {
          payload.init_images = [initB64];
          payload.denoising_strength = 0.45;
        }
      } else {
        payload.enable_hr = true;
        payload.denoising_strength = 0.55;
        payload.hr_scale = 1.5;
        payload.hr_upscaler = 'Latent';
        payload.hr_second_pass_steps = 15;
      }

      const sdRes = await Promise.race([
        fetch(`${localSdUrl}/sdapi/v1/${useImg2Img && payload.init_images ? 'img2img' : 'txt2img'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
        if (veniceRes.status === 401 || veniceRes.status === 403) return res.status(401).json({ error: 'AUTH_REQUIRED' });
        if (veniceRes.status === 402) return res.status(402).json({ error: 'INSUFFICIENT_BALANCE' });
        if (veniceRes.status === 429) return res.status(429).json({ error: 'RATE_LIMITED' });
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

    // --- AWS Bedrock ---
    if (provider === 'aws') {
      const { width, height } = VENICE_ASPECT_RATIO_MAP[ratio] || VENICE_ASPECT_RATIO_MAP['16:9'];
      const modelId = model || AWS_DEFAULT_IMAGE_MODEL;
      const url = await Promise.race([
        generateAwsBedrockImage({ modelId, prompt, width, height, safeSeed, credentials: awsCredentials }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)),
      ]);
      return res.json({ url, prompt });
    }

    // --- Gemini ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const activeModel = model || MODEL_NAME;
    const imageSize = fastRender ? '512' : '1K';
    const ai = new GoogleGenAI({ apiKey });
    const parts = [];
    for (const ref of refs) {
      const match = String(ref).match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        continue;
      }
      if (String(ref).startsWith('http')) {
        const b64 = await referenceToBase64(ref);
        if (b64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
      }
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
    if (message.includes('AccessDeniedException') || message.includes('UnrecognizedClientException') || message.includes('ExpiredTokenException') || message.includes('AUTH_REQUIRED')) {
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }
    if (message.includes('marked by provider as Legacy')) {
      return res.status(503).json({ error: 'MODEL_UNAVAILABLE' });
    }
    if (message.includes('"code":503') || message.includes('UNAVAILABLE')) return res.status(503).json({ error: 'MODEL_UNAVAILABLE' });
    if (message.includes('"code":429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('ThrottlingException') || message.includes('TooManyRequestsException')) {
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
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
    if (message.includes('leaked')) return res.status(401).json({ error: 'KEY_LEAKED' });
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
  process.env.CANON_ENV_LOADED_AT = new Date().toISOString();
  watchEnv((file) => {
    XAI_API_KEY = process.env.XAI_API_KEY;
    process.env.CANON_ENV_LOADED_AT = new Date().toISOString();
    console.log(`[env] reloaded ${file}`);
  });
  console.log(`Server listening on http://localhost:${PORT}`);
});
