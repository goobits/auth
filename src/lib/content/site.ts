import { bring, quickFacts, routes, schedule } from './event';
import { donation, faq, footer, remind, volunteer } from './engagement';
import { hero, meta, nav } from './meta';

export type { Route } from './types';

export const site = {
	meta,
	nav,
	hero,
	quickFacts,
	schedule,
	routes,
	bring,
	donation,
	volunteer,
	faq,
	remind,
	footer
};
