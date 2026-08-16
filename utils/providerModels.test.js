import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickFirstModelIfMissing } from './providerModels.js';

describe('pickFirstModelIfMissing', () => {
  const models = [
    { id: 'grok-imagine-image-2.0' },
    { id: 'grok-imagine-image' },
  ];

  it('keeps a model that is already in the list', () => {
    assert.equal(pickFirstModelIfMissing('grok-imagine-image', models), null);
  });

  it('returns the first model when the current id is missing', () => {
    assert.equal(
      pickFirstModelIfMissing('grok-imagine-image-quality', models),
      'grok-imagine-image-2.0'
    );
  });

  it('returns null when the catalog is empty', () => {
    assert.equal(pickFirstModelIfMissing('grok-imagine-image', []), null);
    assert.equal(pickFirstModelIfMissing('grok-imagine-image', undefined), null);
  });
});
