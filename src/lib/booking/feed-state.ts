import type { CalendarEventsResponse, CalendarJoinResponse, CalendarLeaveResponse } from '$lib/client/api/calendarClient'

type FeedEvent = CalendarEventsResponse['upcoming'][number]
type MutationState = NonNullable<CalendarJoinResponse['state'] | CalendarLeaveResponse['state']>

export function applyEventMutationState(
	events: FeedEvent[],
	eventId: number,
	state: MutationState | null | undefined
) {
	if (!state) return events
	return events.map((event) =>
		event.id === eventId
			? {
				...event,
				seatsTaken: state.seatsTaken,
				seatsLeft: state.seatsLeft,
				waitlistCount: state.waitlistCount,
				userStatus: state.userStatus,
				userGuestCount: state.userGuestCount
			}
			: event
	)
}
