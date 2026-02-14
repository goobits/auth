export function toDate(value: string | number | Date) {
	return value instanceof Date ? value : new Date(value)
}

export function formatDateMonthDayYear(value: string | number | Date) {
	return toDate(value).toLocaleDateString('en-US', {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric'
	})
}

export function formatDateMonthDay(value: string | number | Date) {
	return toDate(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric'
	})
}

export function formatDateYear(value: string | number | Date) {
	return String(toDate(value).getFullYear())
}

export function formatDateMonthDayYearShort(value: string | number | Date) {
	return toDate(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})
}

export function formatDateMmDdYyyy(value: string | number | Date) {
	const d = toDate(value)
	const mm = String(d.getMonth() + 1).padStart(2, '0')
	const dd = String(d.getDate()).padStart(2, '0')
	const yyyy = d.getFullYear()
	return `${mm}-${dd}-${yyyy}`
}
