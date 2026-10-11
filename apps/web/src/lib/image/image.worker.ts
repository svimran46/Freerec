import { decode, encode, resize } from "@/lib/image/codecs";
import { megapixels, type Size } from "@/lib/image/geometry";
import { ImageError, type ImageRequest, type ImageResponse, type ProcessResult } from "@/lib/image/types";

async function handle(request: ImageRequest): Promise<ProcessResult | Size> {
  const image = await decode(request.file, request.name, request.kind);
  const source = { width: image.width, height: image.height };
  if (request.op === "probe") return source;

  const { plan } = request;
  const resized = plan.resize ? await resize(image, plan.resize) : image;
  const size = { width: resized.width, height: resized.height };
  if (plan.maxOutputPixels && size.width * size.height > plan.maxOutputPixels) {
    throw new ImageError(
      `The result would be ${megapixels(size)}. The limit is ${megapixels({ width: plan.maxOutputPixels, height: 1 })}.`,
    );
  }
  return { bytes: await encode(resized, plan.format, plan.quality), size, source };
}

self.onmessage = async (event: MessageEvent<ImageRequest>) => {
  let response: ImageResponse;
  try {
    response = { ok: true, result: await handle(event.data) };
  } catch (error) {
    response = {
      ok: false,
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const transfer = response.ok && "bytes" in response.result ? [response.result.bytes] : [];
  self.postMessage(response, { transfer });
};
