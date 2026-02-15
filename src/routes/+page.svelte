<script>
	import { apps } from './_projects.ts'
	import '$lib/theme/home.css'
</script>

<svelte:head>
    <title>Code & Design - MIKO.ART</title>
</svelte:head>

<div class="home home__hero">
    <h1 class="home__hero-title">MAKE, LEARN&hellip; PLAY!</h1>
    <h2 class="home__hero-subtitle">APPS CRAFTED WITH
        <img
                src="/media/emoji-sparkling-heart.png"
                height="40"
                width="40"
                class="home__hero-heart"
                alt=""
        />
    </h2>
</div>

<div class="home__projects">
    {#each apps as { id, description, title, url }}
        <a class="home__project" href="{url}">
            <span class="home__project-image" style="background-image: url('/media/project-{id}.png')"></span>
            <span class="home__project-description">{description}</span>
            <span class="home__project-title"><span class="home__project-title-text">{title}</span></span>
        </a>
    {/each}
</div>

<!--<h1>ENJOY ART</h1>-->
<!--<h2>MADE WITH GENERATIVE ALGORITHMS ✨</h2>-->
<!--<projects>-->
<!--    {#each art as {id, description, title, url}, i}-->
<!--        <a class="project" href="{url}">-->
<!--            <project-image style="background-image: url('/media/project-{id}.png')"></project-image>-->
<!--            <project-description>{description}</project-description>-->
<!--            <project-title><span>{title}</span></project-title>-->
<!--        </a>-->
<!--    {/each}-->
<!--</projects>-->

<style>
	.home__hero-heart {
		vertical-align: top;
	}
</style>
