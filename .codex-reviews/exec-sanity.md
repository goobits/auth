I can’t access your workspace right now: `functions.exec_command` is failing with a sandbox crash (`Sandbox(LandlockRestrict)`), so I can’t inspect `src/routes` myself.

If you paste the output of one of these, I’ll immediately list the top 10 page routes and call out one UX risk:

```bash
cd /workspace
find src/routes -type f \( -name '+page.*' -o -name 'index.*' \) | sort
```

(or if you’re using Next.js-style routes)

```bash
cd /workspace
find src/routes -type f \( -name 'page.*' -o -name 'route.*' -o -name 'layout.*' \) | sort
```