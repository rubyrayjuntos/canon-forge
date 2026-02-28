import { GoogleGenAI } from "@google/genai";
import { CharacterProfile, SetProfile, ReferenceType, SetReferenceType, CompositeConfig } from "../types";
import { AESTHETIC_PROMPT_CORE, CHARACTER_TEMPLATES, SET_TEMPLATES } from "../constants";

const MAX_INT32 = 2147483647;

interface GenerationResult {
  url: string;
  prompt: string;
}

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

/**
 * Sends a text prompt to the Gemini image generation model and returns the
 * generated image as a base64 data URL along with the prompt used.
 *
 * @param prompt - The full generation prompt describing the desired image.
 * @param seed - A deterministic seed for reproducible outputs (clamped to INT32).
 * @param aspectRatio - The output image aspect ratio. Defaults to "16:9".
 * @throws {Error} "AUTH_REQUIRED" when the API key is missing or invalid.
 * @throws {Error} "Blocked by safety filters." when content policy is violated.
 * @throws {Error} "No image data found." when the model returns no image parts.
 */
async function callGemini(
  prompt: string,
  seed: number,
  aspectRatio: AspectRatio = "16:9"
): Promise<GenerationResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const modelName = 'gemini-3-pro-image-preview';

  const safeSeed = Math.abs(Math.floor(seed)) % (MAX_INT32 + 1);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        seed: safeSeed,
        imageConfig: {
          aspectRatio,
          imageSize: "1K"
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("Model produced no result.");
    if (candidate.finishReason === 'SAFETY') throw new Error("Blocked by safety filters.");

    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return {
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            prompt,
          };
        }
      }
    }
    throw new Error("No image data found.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Requested entity was not found")) throw new Error("AUTH_REQUIRED");
    throw error;
  }
}

/**
 * Generates a character reference image (headshot, body, wardrobe, etc.)
 * based on the character profile and requested reference type.
 *
 * @param profile - The full character profile to use as the visual identity.
 * @param type - The style/category of reference image to generate.
 */
export async function generateCharacterImage(
  profile: CharacterProfile,
  type: ReferenceType
): Promise<GenerationResult> {
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Subject: Character ${profile.name}, ${profile.age}y/o ${profile.gender}, ${profile.build} build, ${profile.skinTone} skin, ${profile.eyes} eyes, ${profile.hair} hair. ${profile.distinctiveFeatures}.
    Scene: ${CHARACTER_TEMPLATES[type]}
    Style: High-fidelity cinematic photography. Strict facial and anatomical consistency.`.trim();

  return callGemini(prompt, profile.seed, type === 'BODY_REVERSE' ? "3:4" : "16:9");
}

/**
 * Generates an environment/set reference image (wide, medium, POV, etc.)
 * based on the set profile and requested shot type.
 *
 * @param profile - The full set profile describing the environment.
 * @param type - The composition style of the shot to generate.
 */
export async function generateSetImage(
  profile: SetProfile,
  type: SetReferenceType
): Promise<GenerationResult> {
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Environment: ${profile.name}, a ${profile.locationType} location.
    Aesthetic: ${profile.style}. Ambiance: ${profile.ambiance}.
    Lighting Specs: ${profile.lighting}. Details: ${profile.details}.
    Composition: ${SET_TEMPLATES[type]}
    Style: High-fidelity architectural photography.`.trim();

  return callGemini(prompt, profile.seed, "16:9");
}

/**
 * Generates a composite cinematic image placing the character inside the set,
 * with a specified action, optional extra actors, and composition style.
 * Uses the character's seed as the identity anchor for cross-scene consistency.
 *
 * @param char - The character profile (visual identity source).
 * @param set - The environment profile (location context).
 * @param config - Additional scene direction (action, actors, composition style).
 */
export async function generateCompositeImage(
  char: CharacterProfile,
  set: SetProfile,
  config: CompositeConfig
): Promise<GenerationResult> {
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Scene Composition: Merge Character and Environment seamlessly.
    Character Visual Identity (MANDATORY): ${char.name}, ${char.age}y/o ${char.gender}, ${char.build} build, ${char.skinTone} skin, ${char.eyes} eyes, ${char.hair} hair. ${char.distinctiveFeatures}.
    Note: The face must match exactly with the character's core facial traits.

    Environment Context: ${set.name}, ${set.locationType}, style ${set.style}, ${set.lighting} lighting. ${set.details}.

    Action: ${config.action}.
    Additional Details/Actors: ${config.extraActors || 'None'}.

    Integration Logic: Place the character physically in the environment. Match local lighting, shadows, and color bounce from the ${set.lighting}.
    Atmospheric depth should match the ${set.ambiance}.

    Style: ${config.compositionStyle || 'High-fidelity cinematic shot'}.`.trim();

  // Character seed is the identity anchor for cross-scene consistency
  return callGemini(prompt, char.seed, "16:9");
}
