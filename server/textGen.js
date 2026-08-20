export function isImageModelId(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  const id = modelId.toLowerCase();
  return (
    id.includes('image') ||
    id.includes('imagine') ||
    id.includes('titan') ||
    id.includes('stable-diffusion') ||
    id.includes('sd3') ||
    id.includes('flux') ||
    id.includes('nova-canvas')
  );
}

export function resolveTextProvider(provider, { hasXai, hasGemini } = {}) {
  if (provider && provider !== 'aws' && provider !== 'local-sd') return provider;
  if (hasXai) return 'xai';
  if (hasGemini) return 'gemini';
  return 'local-llm';
}

export function resolveTextModel(provider, model, defaults) {
  if (model && !isImageModelId(model)) return model;
  if (provider === 'xai') return defaults.xai;
  if (provider === 'gemini') return defaults.gemini;
  if (provider === 'venice') return defaults.venice;
  return defaults.ollama;
}

export function extractChatText(data) {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.text ||
    data?.response ||
    ''
  );
}
