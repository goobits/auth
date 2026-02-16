import { createAdminSectionLoad } from '../_section.server'

export { actions } from '../+page.server'
export const load = createAdminSectionLoad('dash')
