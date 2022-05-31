<script>
	import About from "./About.svelte"
	import Contact from "./Contact.svelte"
	import ContactThankYou from "./ContactThankYou.svelte"
	import Home from "./Home.svelte"
	import Labs from "./Labs.svelte"
	import NotFound from "./404.svelte"
	import PrivacyPolicy from "./Privacy-Policy.svelte"
	import {Router, Route, Link} from "svelte-navigator"
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
                <Link to="/about/">About</Link>
                <Link to="/contact/">Contact</Link>
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

        <Route path="/about/">
            <About/>
        </Route>

        <Route path="/contact/">
            <style src="./Contact.styl"></style>
            <Contact/>
        </Route>

        <Route path="/contact-thank-you/">
            <style src="./ContactThankYou.styl"></style>
            <ContactThankYou/>
        </Route>

        <Route path="/privacy-policy/">
            <PrivacyPolicy/>
        </Route>

        <Route path="/labs/">
            <style src="./Labs.styl"></style>
            <Labs/>
        </Route>

        <Route>
            <NotFound/>
        </Route>
    </main>

    <footer>
        <a href="/labs/">Labs</a> &middot;
        <a href="/privacy-policy/">Privacy Policy</a>
        <br>
        Copyright &copy; {new Date().getFullYear()} by MIKO. All rights reserved.
    </footer>

    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=UA-400768-7"></script>
    <script>
		window.dataLayer = window.dataLayer || [];
		function gtag(){dataLayer.push(arguments);}
		gtag('js', new Date());

		gtag('config', 'UA-400768-7');
    </script>
</Router>