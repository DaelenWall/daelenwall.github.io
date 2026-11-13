# Daelen Wall

A portable Astro website and a local publishing studio. All personal writing, pictures, project descriptions, and contact details start empty. The only displayed personal name supplied with the project is **Daelen Wall**.

## Requirements

- macOS, Node.js **24 LTS** (the included `.nvmrc` selects 24), npm, and Git.
- A free GitHub account and a **public** repository for free GitHub Pages hosting.
- Existing Git credentials on this Mac, configured once using SSH or GitHub CLI. Credentials are never entered into the studio or shipped to the website.
- Google Chrome for the optional browser test suite. The website and editor work in ordinary modern browsers.

All dependencies are free. Serving, writing, and publishing do not require an AI service, CMS account, database, subscription, or paid API.

## Start locally

```sh
npm install
npm run studio
```

The studio opens automatically on macOS at **http://127.0.0.1:4322**. Keep its Terminal window open while writing. You can subsequently double-click **Open Studio.command** in Finder. The launcher finds Node installed through nvm or your normal PATH, and runs `npm ci` if dependencies have not yet been installed. If macOS asks about opening the launcher, use Finder's Open action. If executable permissions were lost while copying the folder, run `chmod +x "Open Studio.command"` once.

For the public-source preview, run `npm run dev` in another Terminal window and open **http://127.0.0.1:4321**. This preview contains published source only. Draft previews appear inside the studio and do not need a separate server. Astro 7 runs its dev server in the background; stop it with `npx astro dev stop` when finished.

To inspect a production build:

```sh
npm run build
npm run check:privacy
npm run preview
```

## One-time GitHub Pages setup

The existing origin was inspected during implementation and points to `https://github.com/DaelenWall/daelenwall.github.io.git`. Nothing in the site depends on hardcoding that account. No initial commit, remote push, repository visibility change, or public deployment is performed without approval.

1. Confirm that this is the repository you want to publish, and that it is public. Do not put secrets or private documents in it. Public source, public media, and commit history are inspectable.
2. Configure Git's author name and your chosen GitHub email **once**, if they are missing. A GitHub-provided no-reply address is an option. Use your actual chosen values:

   ```sh
   git config user.name "YOUR CHOSEN GIT AUTHOR NAME"
   git config user.email "YOUR CHOSEN GIT EMAIL"
   ```

3. Authenticate Git once. With GitHub CLI installed, use `gh auth login`, then `gh auth setup-git`. Alternatively use your existing SSH configuration and an SSH origin. Do not paste credentials into source files, URLs, browser fields, or environment files that will be committed.
4. Review the initial source and make its first commit. The following is an explicit allowlist; it leaves the original local brief and `.studio-local/` out of the commit:

   ```sh
   git add -- .github .gitignore .nvmrc "Open Studio.command" README.md EDITOR_GUIDE.md IMPLEMENTATION.md astro.config.mjs package.json package-lock.json playwright.config.mjs tsconfig.json public scripts shared src studio tests
   git diff --cached --stat
   git commit -m "Build personal website and local publishing studio"
   ```

5. On GitHub, open this repository's **Settings → Pages**, and choose **GitHub Actions** as the source. Enable Actions if your account or repository settings require it.
6. When ready to make this reviewed source public, push `main` once:

   ```sh
   git push -u origin main
   ```

7. Open the repository's Actions tab. Wait for **Deploy to GitHub Pages**, including its `deploy` job, to succeed. The GitHub environment shows the actual live URL. For the current personal-site repository, the expected URL is `https://daelenwall.github.io/`; it is not considered deployed until GitHub confirms it.

After setup, recurring content publication uses the studio's **Publish** button. It validates, builds, commits only the selected public files and referenced images, and pushes using this Mac's Git credentials. Other private drafts are not included.

### Root site, project site, and migration

`shared/paths.mjs` derives the GitHub owner/repository from `GITHUB_REPOSITORY` in Actions, or from the local origin. An `<owner>.github.io` repository uses `/`; another repository uses `/<repository>/`. The derived origin supplies canonical, Open Graph, sitemap, and RSS URLs. All internal navigation and local image URLs use Astro's base path, including Markdown links beginning with `/`.

For another host or a custom domain, explicitly supply `SITE_URL` (the origin) and `BASE_PATH` (the URL prefix). For example:

```sh
SITE_URL=https://your-domain.example BASE_PATH=/ npm run build
```

Set the same environment values on the Actions build step if deploying that configuration. A custom domain also requires its DNS configuration and a user-authored `public/CNAME`. Those are optional and have not been configured.

The publishing branch is `main` in the workflow. To change it, update `.github/workflows/deploy.yml` and create the ignored `.studio-local/config.json` containing `{ "publishBranch": "your-branch" }`. The studio refuses to switch branches or reconcile divergent histories automatically.

## Privacy boundaries

| Location | Purpose | Public? |
| --- | --- | --- |
| `src/content/writing/*.md` | Approved article source | Yes |
| `src/content/projects/*.md` | Approved project source | Yes |
| `src/data/` | Approved homepage, About, Contact, and metadata | Yes |
| `public/images/` | Images intentionally included in publications | Yes, even if no longer linked |
| `studio/` | Editor program, without author data | Inspectable source; never deployed |
| `.studio-local/drafts/` | Drafts, revisions, and archived items | Local only; ignored by Git |
| `.studio-local/media/` | Uploaded original working images after optimization | Local only until selected for publication |
| `.studio-local/hero-memory.json` | Inactive intro/quote preserved after publication | Local only |
| `.studio-local/publication.json` | Pending push / last pushed commit | Local only |
| `dist/` | Generated static site, sole deployment artifact | Public when deployed; ignored by Git |

Saving a draft never writes to public source. Editing a published item creates a separate private revision with a hash of its starting public version. The studio will reject publication if that public version has changed outside the studio. Each draft also has a version so two tabs cannot silently overwrite each other.

The studio binds to `127.0.0.1` only, checks Host and Origin, blocks cross-site requests, and requires a random in-memory token for writes. No token is saved in browser storage. Markdown does not execute raw HTML; rendered output is sanitized. Image uploads are decoded, resized to a maximum 2000 × 2000 bounding box, stripped of original metadata, and converted to WebP. SVG and animated uploads are rejected.

The build rejects private asset references in public input and scans the static output. Actions uploads only `dist`, never the checkout or editor. `.studio-local/` is ignored; do not override that rule with `git add -f`. The original project brief is preserved locally and ignored too.

**Back up `.studio-local/` privately**, for example with Time Machine. Cloning the public GitHub repository on another Mac does not recover private drafts. The editor does not encrypt local files or protect them from other programs running as your Mac user.

Unpublishing removes a page from future builds and keeps a local draft. Previously public content and images can remain in Git history, search caches, downloads, and `public/images/`. Unpublishing is not guaranteed erasure. The editor does not rewrite history or delete possibly shared public assets.

## Verification

```sh
npm ci
npm test
npm run test:browser
npm run build
npm run check:privacy
```

Tests use temporary content and local bare Git repositories, removed afterward. They never publish to your GitHub origin. Integration coverage includes draft isolation from commits/build/search/RSS/sitemap, historical dates, private revisions, selective asset promotion, rollback, failed pushes and retry, stale revisions, and settings isolation. Browser coverage uses empty and populated project-path production builds, phone/tablet/desktop layouts, navigation, search/filter/sort, image upload, live preview, publishing, and automated accessibility checks.

The end-to-end suite uses your installed Chrome. To use Playwright's bundled Chromium instead, remove `channel: 'chrome'` from `playwright.config.mjs` and install its browser with `npx playwright install chromium`. Tests that bind loopback ports or run a browser need the corresponding permissions in a sandboxed development environment.

See [EDITOR_GUIDE.md](EDITOR_GUIDE.md) for everyday authoring and [IMPLEMENTATION.md](IMPLEMENTATION.md) for the content model and design decisions.

## Official implementation references

- [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [GitHub Pages availability and repository types](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
