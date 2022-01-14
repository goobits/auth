<script>
	const apps = [
		{
			id: 'sketchpad',
			description: 'Draw, create & share with this online drawing application. Free for all since 2008. Fun for all ages!',
			title: 'Sketchpad',
			url: 'https://sketchpad.app/'
		},
		{
			id: 'colorpiano',
			description: 'Learn music theory essentials, and visualize amazing composers with this interactive color piano.',
			title: 'Color Piano',
			url: 'https://colorpiano.app/'
		},
		{
			id: 'colorsphere',
			description: 'Lorem ipsum, or lipsum as it is sometimes known, in laying out print, graphic or web designs',
			title: 'Color Sphere',
			url: 'https://colorsphere.app/'
		},
		{
			id: 'sandscapes',
			description: 'Lorem ipsum, or lipsum as it is sometimes known, in laying out print, graphic or web designs',
			title: 'Sandscapes',
			url: 'https://miko.art/sandscapes/'
		},
		{
			id: 'melodic-tendrils',
			description: 'Lorem ipsum, or lipsum as it is sometimes known, in laying out print, graphic or web designs',
			title: 'Melodic Tendrils',
			url: 'https://miko.art/melodic-tendrils/'
		}
	]

	const art = [
		{
			id: 'purring-hills',
			description: 'Lorem ipsum, or lipsum as it is sometimes known',
			title: 'Purring Hills',
			url: 'https://miko.art/generative-purring-hills/'
		},
		{
			id: 'growing-ferns',
			description: 'Lorem ipsum, or lipsum as it is sometimes known',
			title: 'Growing Ferns',
			url: 'https://miko.art/generative-growing-ferns/'
		},
		{
			id: 'crystals',
			description: 'Lorem ipsum, or lipsum as it is sometimes known',
			title: 'Crystals',
			url: 'https://miko.art/generative-crystals/'
		},
		{
			id: 'supershapes',
			description: 'Lorem ipsum, or lipsum as it is sometimes known',
			title: 'Supershapes',
			url: 'https://miko.art/generative-supershapes/'
		},
		{
			id: 'cards',
			description: 'Lorem ipsum, or lipsum as it is sometimes known',
			title: 'C.A.R.D.S.',
			url: 'https://miko.art/generative-cards/'
		},
		{
			id: 'glsl',
			description: 'Lorem ipsum, or lipsum as it is sometimes known',
			title: 'GLSL',
			url: 'https://miko.art/generative-webcamfx/'
		}
	]
</script>

<title>MIKO.ART - Code & Design</title>

<h1>MAKE, LEARN&hellip; PLAY!</h1>
<h2>APPS CRAFTED WITH 💖</h2>
<projects>
    {#each apps as {id, description, title, url}, i}
        <a class="project" href="{url}">
            <project-image style="background-image: url('/media/project-{id}.png')"></project-image>
            <project-description>{description}</project-description>
            <project-title><span>{title}</span></project-title>
        </a>
    {/each}
</projects>

<h1>ENJOY ART</h1>
<h2>MADE WITH GENERATIVE ALGORITHMS ✨</h2>
<projects>
    {#each art as {id, description, title, url}, i}
        <a class="project" href="{url}">
            <project-image style="background-image: url('/media/project-{id}.png')"></project-image>
            <project-description>{description}</project-description>
            <project-title><span>{title}</span></project-title>
        </a>
    {/each}
</projects>