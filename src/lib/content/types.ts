export type Route = {
	id: string;
	title: string;
	distance: string;
	icon: string;
	description: string;
	surface: string;
	hills: string;
	note: string;
	accent: 'hatchling' | 'raptor' | 'trex';
	pdf: string;
	gpx: string;
};
