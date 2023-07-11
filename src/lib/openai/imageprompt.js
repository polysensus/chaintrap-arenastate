import { getLogger } from "../log.js";

const log = getLogger("nftstorage");

export const defaultImageSize = "256x256";
export const defaultIconSize = "256x256";

export async function generateIconBinary(options) {

  options = {...options};
  const path = options.openaiImagesUrl;
  const prompt = options.openaiImagePrompt;
  delete options['openaiImagesUrl'];
  delete options['openaiImagePrompt'];
  options.imageSize = options.imageSize ?? defaultIconSize;
  return await generateImageBinary(path, prompt, options)
}

/**
 * 
 * @param {string} path openai api url
 * @param {string} prompt the generation prompt
 * @param {{openaiAPIKey,fetch?,imageSize?,openai_image_options?}} options 
 * @returns 
 */
export async function generateImageBinary(path, prompt, options) {
  if (!options.fetch)
    throw new Error("you must provide a fetch implementation");
  if (!options.openaiAPIKey)
    throw new Error("the openaiAPIKey option is required");
  const body = {
    prompt,
    n: 1,
    size: options.imageSize ?? defaultImageSize,
    response_format: "b64_json",
    ...options.openai_image_options,
  };

  log.debug("prompt body", body);

  const result = await options.fetch(path, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.openaiAPIKey}`,
    },
  });
  const j = await result.json();
  const b64json = j["data"][0]?.b64_json;
  if (!b64json) {
    throw new Error("No data item in response");
  }
  return ethers.utils.base64.decode(b64json);
}