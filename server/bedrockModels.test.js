import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSupportedBedrockImageModel } from './bedrockModels.js';

describe('isSupportedBedrockImageModel', () => {
  it('accepts Titan, Nova Canvas, SDXL, and SD3 ids', () => {
    assert.equal(isSupportedBedrockImageModel('amazon.titan-image-generator-v2:0'), true);
    assert.equal(isSupportedBedrockImageModel('amazon.nova-canvas-v1:0'), true);
    assert.equal(isSupportedBedrockImageModel('stability.stable-diffusion-xl-v1'), true);
    assert.equal(isSupportedBedrockImageModel('stability.sd3-large-v1:0'), true);
  });

  it('rejects families the invoke encoder does not handle', () => {
    assert.equal(isSupportedBedrockImageModel('stability.stable-image-ultra-v1:0'), false);
    assert.equal(isSupportedBedrockImageModel('amazon.nova-reel-v1:0'), false);
    assert.equal(isSupportedBedrockImageModel('anthropic.claude-3-sonnet-20240229-v1:0'), false);
    assert.equal(isSupportedBedrockImageModel(''), false);
    assert.equal(isSupportedBedrockImageModel(undefined), false);
  });
});
