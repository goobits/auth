import { renderSVG, type QrCodeGenerateSvgOptions } from 'uqr'

export type QrCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

export type QrCodeSvgOptions = {
	value: string
	errorCorrection?: QrCodeErrorCorrectionLevel
	border?: number
	pixelSize?: number
}

const maxQrCodeValueLength = 2048
const defaultBorder = 2
const defaultPixelSize = 4

export function renderQrCodeSvg({
	value,
	errorCorrection = 'M',
	border = defaultBorder,
	pixelSize = defaultPixelSize
}: QrCodeSvgOptions): string {
	if (!value.trim()) {
		throw new Error('QR code value is required')
	}
	if (value.length > maxQrCodeValueLength) {
		throw new Error(`QR code value must be ${maxQrCodeValueLength} characters or fewer`)
	}

	const options: QrCodeGenerateSvgOptions = {
		ecc: errorCorrection,
		border: integerOption(border, 'QR code border', 0, 16),
		pixelSize: integerOption(pixelSize, 'QR code pixel size', 1, 32),
		whiteColor: 'white',
		blackColor: 'black'
	}

	return renderSVG(value, options).replace('<svg ', '<svg aria-hidden="true" focusable="false" ')
}

function integerOption(value: number, label: string, min: number, max: number): number {
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new Error(`${label} must be an integer from ${min} to ${max}`)
	}
	return value
}
