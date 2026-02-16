export type PaymentProvider = 'venmo' | 'cashapp' | 'paypal' | 'other'

type PaymentLinkInput = {
	provider: string | null
	handle: string | null
	amountCents: number
	currency: string
	note: string
}

export function buildPaymentLink(input: PaymentLinkInput): string | null {
	const provider = (input.provider || '').toLowerCase()
	const handle = (input.handle || '').trim().replace(/^@/, '')
	const amount = Math.max(0, input.amountCents) / 100
	const currency = (input.currency || 'USD').toUpperCase()
	const note = input.note || 'Event'
	if (!handle || amount <= 0) return null

	if (provider === 'venmo') {
		const params = new URLSearchParams({
			txn: 'pay',
			recipients: handle,
			amount: String(amount),
			note
		})
		return `venmo://paycharge?${params.toString()}`
	}
	if (provider === 'cashapp') {
		const params = new URLSearchParams({
			cashtag: handle,
			amount: String(amount),
			note
		})
		return `https://cash.app/$${handle}?${params.toString()}`
	}
	if (provider === 'paypal') {
		const params = new URLSearchParams({
			cmd: '_xclick',
			business: handle,
			amount: String(amount),
			currency_code: currency,
			item_name: note
		})
		return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`
	}
	return null
}

