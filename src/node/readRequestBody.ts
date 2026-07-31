import { Buffer } from 'node:buffer'

import { readAsyncIterableBytes, type ReadBodyOptions } from '@goobits/security/request-body'

/** Reads a Node request body with Security's shared bounded-stream policy. */
export async function readRequestBody(
	req: AsyncIterable<Buffer | Uint8Array | string> | Iterable<Buffer | Uint8Array | string>,
	options: ReadBodyOptions = {}
): Promise<Buffer> {
	return Buffer.from(await readAsyncIterableBytes(req, options))
}
