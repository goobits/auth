import { describe, expect, it } from 'vitest'
import {
	parseAdminCreateEventsBatchInput,
	parseAdminProgramMutationInput,
	TransportValidationError
} from '../../packages/calendar/src/index.ts'

describe('admin transport validation', () => {
	it('accepts valid program upsert payload', () => {
		const result = parseAdminProgramMutationInput({
			action: 'upsert',
			slug: 'gym',
			label: 'Gym',
			activityName: 'Gym',
			pageTitle: 'Gym | MIKO.ART',
			eyebrow: 'Gym',
			heroTitleLine1: 'Move daily.',
			heroTitleLine2: 'Stay strong.',
			heroSubtitle: 'Strength and recovery sessions.',
			description: 'Members workouts and mobility.',
			icon: '💪',
			eyebrowClass: 'eyebrow-gym',
			glowClass: 'glow-gym',
			formGlowClass: 'form-gym',
			serviceStatusNote: 'Open weekly',
			enabled: true,
			sortOrder: 10
		})

		expect(result.action).toBe('upsert')
		if (result.action !== 'upsert') return
		expect(result.program.slug).toBe('gym')
		expect(result.program.enabled).toBe(true)
		expect(result.program.sortOrder).toBe(10)
	})

	it('rejects invalid event creation payload', () => {
		expect(() =>
			parseAdminCreateEventsBatchInput({
				activitySlug: 'gym',
				title: 'Bad event',
				startsAt: '2026-02-18T10:00:00.000Z',
				endsAt: '2026-02-18T09:00:00.000Z',
				capacity: 2
			})
		).toThrow(TransportValidationError)
	})
})
