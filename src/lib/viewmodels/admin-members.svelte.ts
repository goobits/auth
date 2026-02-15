import { DEFAULT_INVITE_DRAFT } from '$lib/viewmodels/admin'
import {
	createInviteShareLink,
	createMemberInvite,
	deleteMemberInvite,
	loadMembersData
} from '$lib/viewmodels/admin-dashboard'

export function createAdminMembersController(
	options: { onUnauthorized?: (error: unknown) => boolean } = {}
) {
	const { onUnauthorized } = options

	let invites = $state<unknown[]>([])
	let users = $state<unknown[]>([])
	let loading = $state(false)
	let error = $state('')
	let inviteEmail = $state('')
	let inviteUses = $state(DEFAULT_INVITE_DRAFT.uses)
	let inviteExpires = $state(DEFAULT_INVITE_DRAFT.expiresInDays)
	let creating = $state(false)

	async function load() {
		loading = true
		error = ''
		try {
			const membersData = await loadMembersData()
			invites = membersData.invites
			users = membersData.users
			error = membersData.error
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to load members data'
		} finally {
			loading = false
		}
	}

	async function createInvite() {
		creating = true
		error = ''
		try {
			const inviteResult = await createMemberInvite({
				email: inviteEmail || null,
				uses: inviteUses,
				expiresInDays: inviteExpires
			})
			if (inviteResult.ok) {
				inviteEmail = ''
				inviteUses = DEFAULT_INVITE_DRAFT.uses
				inviteExpires = DEFAULT_INVITE_DRAFT.expiresInDays
				await load()
			} else {
				error = inviteResult.error
			}
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to create invite'
		} finally {
			creating = false
		}
	}

	async function deleteInvite(id: string) {
		if (!confirm('Delete this invite?')) return
		try {
			const inviteDeletion = await deleteMemberInvite(id)
			if (inviteDeletion.ok) {
				await load()
			} else {
				error = inviteDeletion.error
			}
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to delete invite'
		}
	}

	function copyInvite(code: string) {
		const url = createInviteShareLink(window.location.origin, code)
		navigator.clipboard.writeText(url)
	}

	return {
		get invites() { return invites },
		get users() { return users },
		get loading() { return loading },
		get error() { return error },
		get inviteEmail() { return inviteEmail },
		set inviteEmail(value) { inviteEmail = value },
		get inviteUses() { return inviteUses },
		set inviteUses(value) { inviteUses = value },
		get inviteExpires() { return inviteExpires },
		set inviteExpires(value) { inviteExpires = value },
		get creating() { return creating },
		load,
		createInvite,
		deleteInvite,
		copyInvite
	}
}
