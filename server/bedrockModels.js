const SUPPORTED_BEDROCK_IMAGE_PREFIXES = [
  'amazon.titan-image',
  'amazon.nova-canvas',
  'stability.stable-diffusion',
  'stability.sd3',
];

export function isSupportedBedrockImageModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  return SUPPORTED_BEDROCK_IMAGE_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}
