<script lang="ts">
	import { renderQrCodeSvg, type QrCodeErrorCorrectionLevel } from '../qr/index.ts'

	let {
		value,
		label = 'QR code',
		size = 118,
		errorCorrection = 'M',
		className = ''
	}: {
		value: string
		label?: string
		size?: number
		errorCorrection?: QrCodeErrorCorrectionLevel
		className?: string
	} = $props()

	const normalizedSize = $derived(Math.max(64, Math.min(320, Math.round(size))))
	const svg = $derived(value.trim() ? renderQrCodeSvg({ value, errorCorrection }) : '')
	const containerClass = $derived(['auth-qr-code', className].filter(Boolean).join(' '))
</script>

<div
	class={containerClass}
	role="img"
	aria-label={label}
	style={`--auth-qr-code-size: ${normalizedSize}px;`}
>
	{#if svg}
		{@html svg}
	{/if}
</div>

<style>
	.auth-qr-code {
		display: flex;
		width: var(--auth-qr-code-size, 118px);
		height: var(--auth-qr-code-size, 118px);
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: var(--auth-qr-code-radius, 10px);
		background: #fff;
	}

	.auth-qr-code :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
	}
</style>
