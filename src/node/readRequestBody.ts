import { Buffer } from 'node:buffer'

export async function readRequestBody(
	req: AsyncIterable<Buffer | Uint8Array | string>
): Promise<Buffer> {
	const chunks: Buffer[] = []
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
	}
	return Buffer.concat(chunks)
}
