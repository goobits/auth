import { z } from 'zod'

export type BookingSlot = {
	start: string
	end: string
	available: boolean
	remaining: number
}

export type CalendarDay = {
	date: Date
	isCurrentMonth: boolean
}

export type BookingField = 'name' | 'email' | 'seats' | 'note'

export type BookingFieldErrors = Partial<Record<BookingField, string>>

export const bookingSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
	email: z.string().email('Please enter a valid email'),
	seats: z.number().int().min(1, 'At least 1 seat required').max(4, 'Maximum 4 seats'),
	note: z.string().max(500, 'Note is too long').optional()
})

type BookingValidationInput = {
	name: string
	email: string
	seats: number
	note: string
}

export function validateBookingForm(input: BookingValidationInput) {
	const result = bookingSchema.safeParse({
		name: input.name.trim(),
		email: input.email.trim(),
		seats: Number(input.seats),
		note: input.note.trim() || undefined
	})

	if (result.success) {
		return { valid: true, errors: {} as BookingFieldErrors }
	}

	const errors: BookingFieldErrors = {}
	for (const issue of result.error.issues) {
		const field = issue.path[0]
		if (!field || typeof field !== 'string') continue
		if (!errors[field as BookingField]) {
			errors[field as BookingField] = issue.message
		}
	}
	return { valid: false, errors }
}

export function getMonthRange(date: Date) {
	const start = new Date(date.getFullYear(), date.getMonth(), 1)
	const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
	return { start, end }
}

export function getCalendarDays(date: Date): CalendarDay[] {
	const { start, end } = getMonthRange(date)
	const days: CalendarDay[] = []

	const startDay = start.getDay()
	for (let i = 0; i < startDay; i++) {
		const d = new Date(start)
		d.setDate(d.getDate() - (startDay - i))
		days.push({ date: d, isCurrentMonth: false })
	}

	for (let d = 1; d <= end.getDate(); d++) {
		days.push({
			date: new Date(date.getFullYear(), date.getMonth(), d),
			isCurrentMonth: true
		})
	}

	const endDay = end.getDay()
	for (let i = 1; i < 7 - endDay; i++) {
		const d = new Date(end)
		d.setDate(d.getDate() + i)
		days.push({ date: d, isCurrentMonth: false })
	}

	return days
}

export function formatMonthYear(date: Date) {
	return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatFullDay(isoOrDate: string | Date) {
	return new Date(isoOrDate).toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	})
}

export function formatTime(iso: string) {
	return new Date(iso).toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	})
}

export function isSameDay(d1: Date, d2: Date) {
	return d1.toDateString() === d2.toDateString()
}

export function isToday(date: Date) {
	return isSameDay(date, new Date())
}

export function isPast(date: Date) {
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	return date < today
}

export function getSlotsForDate(slots: BookingSlot[], date: Date) {
	return slots.filter((slot) => isSameDay(new Date(slot.start), date))
}

export function getAvailableCount(slots: BookingSlot[], date: Date) {
	return getSlotsForDate(slots, date).filter((slot) => slot.available).length
}
