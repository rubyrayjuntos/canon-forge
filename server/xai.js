export const XAI_API_BASE = 'https://api.x.ai';

export function xaiImageGenerationModelsUrl() {
  return `${XAI_API_BASE}/v1/image-generation-models`;
}

export function xaiImagesGenerationsUrl() {
  return `${XAI_API_BASE}/v1/images/generations`;
}

export function xaiImagesEditsUrl() {
  return `${XAI_API_BASE}/v1/images/edits`;
}

export function buildXaiImageBody({
  model,
  prompt,
  aspectRatio,
  resolution = '2k',
  referenceImage,
}) {
  const body = {
    model,
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
  };

  if (referenceImage) {
    body.image = {
      url: referenceImage,
      type: 'image_url',
    };
    return body;
  }

  body.n = 1;
  return body;
}

export function normalizeXaiImageUrl(data) {
  const candidate = data?.data?.[0];
  if (!candidate) return '';
  if (candidate.url) return candidate.url;
  if (!candidate.b64_json) return '';
  if (String(candidate.b64_json).startsWith('data:')) return candidate.b64_json;
  return `data:image/png;base64,${candidate.b64_json}`;
}
