import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractChatText,
  isImageModelId,
  resolveTextModel,
  resolveTextProvider,
} from './textGen.js';

const defaults = {
  xai: 'grok-3',
  gemini: 'gemini-2.5-flash',
  venice: 'llama-3.3-70b',
  ollama: 'llama3',
};

describe('text generation routing', () => {
  it('treats imagine/image ids as image models', () => {
    assert.equal(isImageModelId('grok-imagine-image'), true);
    assert.equal(isImageModelId('grok-3'), false);
  });

  it('falls AWS back to an available text provider', () => {
    assert.equal(resolveTextProvider('aws', { hasXai: true, hasGemini: true }), 'xai');
    assert.equal(resolveTextProvider('xai', { hasXai: true }), 'xai');
  });

  it('does not send an image model id to chat completions', () => {
    assert.equal(resolveTextModel('xai', 'grok-imagine-image', defaults), 'grok-3');
    assert.equal(resolveTextModel('xai', 'grok-3', defaults), 'grok-3');
  });

  it('reads OpenAI-style chat content', () => {
    assert.equal(
      extractChatText({ choices: [{ message: { content: '{"name":"Nexus"}' } }] }),
      '{"name":"Nexus"}'
    );
  });
});
