import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCharacterIdentityBlock,
  faceReferenceInstruction,
  HEADSHOT_NEGATIVE_CONSTRAINTS,
  HEADSHOT_SCENE,
  isFaceEstablishingShot,
  isFigureStudyShot,
  pickAutoLockPatch,
  requiresCanonFace,
  setLockReferenceUrl,
  shouldUseInitImage,
  shotAspectRatio,
  vaultAspectClass,
} from './identityLock.js';

describe('identity lock', () => {
  it('requires a canon face for every character shot except headshot', () => {
    assert.equal(requiresCanonFace('HEADSHOT'), false);
    assert.equal(requiresCanonFace('WARDROBE'), true);
    assert.equal(requiresCanonFace('BODY_REVERSE'), true);
    assert.equal(isFaceEstablishingShot('HEADSHOT'), true);
  });

  it('auto-locks the first headshot, wide, and medium stills', () => {
    assert.deepEqual(
      pickAutoLockPatch('CharacterForge', 'HEADSHOT', 'https://face'),
      { canonHeadshotUrl: 'https://face' }
    );
    assert.deepEqual(
      pickAutoLockPatch('SetForge', 'WIDE', 'https://wide'),
      { canonWideUrl: 'https://wide' }
    );
    assert.deepEqual(
      pickAutoLockPatch('SetForge', 'MEDIUM', 'https://medium'),
      { canonMediumUrl: 'https://medium' }
    );
    assert.equal(pickAutoLockPatch('CharacterForge', 'WARDROBE', 'https://x'), null);
  });

  it('uses the locked wide as the set reference for later coverage', () => {
    const profile = { canonWideUrl: 'https://wide', canonMediumUrl: 'https://medium' };
    assert.equal(setLockReferenceUrl(profile, 'WIDE'), 'https://wide');
    assert.equal(setLockReferenceUrl(profile, 'MEDIUM'), 'https://wide');
    assert.equal(setLockReferenceUrl({}, 'MEDIUM'), undefined);
  });

  it('attaches a hard face-match instruction only when a reference image exists', () => {
    assert.equal(faceReferenceInstruction(false), '');
    assert.match(faceReferenceInstruction(true), /FACE REFERENCE IMAGE IS ATTACHED/);
    const withRef = buildCharacterIdentityBlock(
      { name: 'Rook Vale', age: '34', gender: 'Male', distinctiveFeatures: 'broken nose' },
      { hasFaceReference: true }
    );
    assert.match(withRef, /Rook Vale/);
    assert.match(withRef, /broken nose/);
    assert.match(withRef, /FACE REFERENCE IMAGE IS ATTACHED/);
    const withoutRef = buildCharacterIdentityBlock({ name: 'Rook Vale' }, { hasFaceReference: false });
    assert.doesNotMatch(withoutRef, /FACE REFERENCE IMAGE IS ATTACHED/);
  });

  it('writes a face-only identity block for headshots', () => {
    const block = buildCharacterIdentityBlock(
      {
        name: 'Rook Vale',
        distinctiveFeatures: 'forehead rune, cheek scars, bald scalp',
        wardrobe: 'oversized black hoodie, ripped jeans, combat boots',
      },
      { shotType: 'HEADSHOT' }
    );
    assert.match(block, /MANDATORY FACE/);
    assert.match(block, /forehead rune/);
    assert.match(block, /collar, neckline, or shoulders/);
    assert.doesNotMatch(block, /shoulder-to-waist ratio/);
    assert.match(HEADSHOT_SCENE, /clavicle/);
    assert.match(HEADSHOT_NEGATIVE_CONSTRAINTS, /full body/);
  });

  it('does not init-image a body shot on local SD from a headshot', () => {
    assert.equal(
      shouldUseInitImage({ provider: 'local-llm', forgeType: 'CharacterForge', type: 'WARDROBE' }),
      false
    );
    assert.equal(
      shouldUseInitImage({ provider: 'local-sd', forgeType: 'CharacterForge', type: 'HEADSHOT' }),
      true
    );
    assert.equal(
      shouldUseInitImage({ provider: 'xai', forgeType: 'CharacterForge', type: 'WARDROBE' }),
      false
    );
    assert.equal(
      shouldUseInitImage({ provider: 'xai', forgeType: 'CharacterForge', type: 'HEADSHOT' }),
      true
    );
    assert.equal(
      shouldUseInitImage({ provider: 'local-llm', forgeType: 'CompositorForge', type: 'CINEMATIC_COMPOSITE' }),
      false
    );
    assert.equal(
      shouldUseInitImage({ provider: 'xai', forgeType: 'CompositorForge', type: 'CINEMATIC_COMPOSITE' }),
      false
    );
  });

  it('keeps body-study identity descriptive without substituting a training kit', () => {
    const block = buildCharacterIdentityBlock(
      {
        name: 'Rook Vale',
        wardrobe: 'open shirt, optional boxer-briefs',
      },
      { shotType: 'BODY_REVERSE', hasFaceReference: false }
    );
    assert.match(block, /Signature wardrobe/);
    assert.match(block, /boxer-briefs/);
    assert.doesNotMatch(block, /training kit/);
    assert.doesNotMatch(block, /compression shirt/);
    assert.doesNotMatch(block, /FACE REFERENCE IMAGE IS ATTACHED/);
  });

  it('recognizes figure-study shot types without adding provider policy', () => {
    assert.equal(isFigureStudyShot('BODY_NUDE_FRONT'), true);
    assert.equal(isFigureStudyShot('BODY_REVERSE'), false);
    assert.equal(isFigureStudyShot('WARDROBE'), false);
  });

  it('uses portrait frames for wardrobe and body shots', () => {
    assert.equal(shotAspectRatio('HEADSHOT'), '1:1');
    assert.equal(shotAspectRatio('WARDROBE'), '3:4');
    assert.equal(shotAspectRatio('ACTION'), '3:4');
    assert.equal(shotAspectRatio('WIDE'), '16:9');
    assert.equal(vaultAspectClass('WARDROBE'), 'aspect-[3/4]');
    assert.equal(vaultAspectClass('HEADSHOT'), 'aspect-square');
  });
});
