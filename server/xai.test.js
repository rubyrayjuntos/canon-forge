import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildXaiImageBody,
  normalizeXaiImageUrl,
  xaiImageGenerationModelsUrl,
  xaiImagesEditsUrl,
  xaiImagesGenerationsUrl,
} from './xai.js';

describe('xAI image API helpers', () => {
  it('uses /v1 paths for models, generate, and edit', () => {
    assert.equal(
      xaiImageGenerationModelsUrl(),
      'https://api.x.ai/v1/image-generation-models'
    );
    assert.equal(xaiImagesGenerationsUrl(), 'https://api.x.ai/v1/images/generations');
    assert.equal(xaiImagesEditsUrl(), 'https://api.x.ai/v1/images/edits');
  });

  it('builds a generate body without a reference image', () => {
    assert.deepEqual(
      buildXaiImageBody({
        model: 'grok-imagine-image',
        prompt: 'a portrait',
        aspectRatio: '16:9',
      }),
      {
        model: 'grok-imagine-image',
        prompt: 'a portrait',
        aspect_ratio: '16:9',
        resolution: '2k',
        n: 1,
      }
    );
  });

  it('builds a documented single-image edit body', () => {
    assert.deepEqual(
      buildXaiImageBody({
        model: 'grok-imagine-image',
        prompt: 'keep identity, change wardrobe',
        aspectRatio: '3:4',
        referenceImage: 'data:image/png;base64,abc',
      }),
      {
        model: 'grok-imagine-image',
        prompt: 'keep identity, change wardrobe',
        aspect_ratio: '3:4',
        resolution: '2k',
        image: {
          url: 'data:image/png;base64,abc',
          type: 'image_url',
        },
      }
    );
  });

  it('returns a hosted URL when present', () => {
    assert.equal(
      normalizeXaiImageUrl({ data: [{ url: 'https://cdn.x.ai/img.png' }] }),
      'https://cdn.x.ai/img.png'
    );
  });

  it('prefixes raw b64_json as a data URI', () => {
    assert.equal(
      normalizeXaiImageUrl({ data: [{ b64_json: 'iVBORw0KGgo' }] }),
      'data:image/png;base64,iVBORw0KGgo'
    );
  });

  it('passes through an existing data URI', () => {
    assert.equal(
      normalizeXaiImageUrl({
        data: [{ b64_json: 'data:image/jpeg;base64,abc' }],
      }),
      'data:image/jpeg;base64,abc'
    );
  });

  it('returns empty when no image payload is present', () => {
    assert.equal(normalizeXaiImageUrl({ data: [] }), '');
    assert.equal(normalizeXaiImageUrl({}), '');
  });
});
