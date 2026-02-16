export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonType = 'button' | 'submit' | 'reset'

export type ButtonProps = {
	href?: string | undefined
	type?: ButtonType | undefined
	variant?: ButtonVariant | undefined
	size?: ButtonSize | undefined
	pill?: boolean | undefined
	fullWidth?: boolean | undefined
	disabled?: boolean | undefined
	className?: string | undefined
	target?: '_blank' | '_self' | '_parent' | '_top' | undefined
	rel?: string | undefined
	ariaLabel?: string | undefined
	ariaSelected?: boolean | undefined
	ariaChecked?: boolean | undefined
	ariaExpanded?: boolean | undefined
	ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | undefined
	role?: string | undefined
	title?: string | undefined
	onClick?: ((event: MouseEvent) => void) | undefined
}
