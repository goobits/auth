<script>
	import {Router, Route, Link} from "svelte-navigator"
	import Home from "./Home.svelte"
	import About from "./About.svelte"
	import Contact from "./Contact.svelte"
</script>

<Router>
	<style src="./App.styl"></style>

	<header>
		<center>
			<logo>
				<a href="/">
					<img src="/media/logo.svg" alt="logo"/>
				</a>
			</logo>
			<links>
				<Link to="/">Home</Link>
				<Link to="/about">About</Link>
				<Link to="/contact">Contact</Link>
				<a href="https://twitter.com/mudcube/" target="_blank" style="transform: none">
					<img src="/media/twitter.png" alt="twitter"/>
				</a>
			</links>
		</center>
	</header>

	<main>
		<Route path="/">
			<Home/>
		</Route>

		<Route path="about">
			<About/>
		</Route>

		<Route path="contact">
			<Contact/>
		</Route>
	</main>

	<footer>
		Copyright &copy; {new Date().getFullYear()} by MIKO. All rights reserved.
	</footer>
</Router>