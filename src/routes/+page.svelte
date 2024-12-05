<script>
	import { apps, art } from './_projects.js'
</script>

<svelte:head>
    <title>Code & Design - MIKO.ART</title>
</svelte:head>

<div class="hero">
    <h1>MAKE, LEARN&hellip; PLAY!</h1>
    <h2>APPS CRAFTED WITH
        <img
                src="/media/emoji-sparkling-heart.png"
                height="40"
                width="40"
                style="vertical-align: top"
                alt=""
        />
    </h2>
</div>

<projects>
    {#each apps as { id, description, title, url }, i}
        <a class="project" href="{url}">
            <project-image style="background-image: url('/media/project-{id}.png')"></project-image>
            <project-description>{description}</project-description>
            <project-title><span>{title}</span></project-title>
        </a>
    {/each}
</projects>

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