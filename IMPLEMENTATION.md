# Implementation notes

## Architecture

Astro 7 builds static HTML with content collections for published writing and projects. No server adapter or hosted editor is installed. The only browser code on the public site handles mobile navigation, optional hero geometry, and archive search/filter/sort. Fonts are bundled locally; no third-party font requests, trackers, or external search services are required.

The local studio is a small Node HTTP server and vanilla browser interface. It serves no directory listings and binds only to IPv4 loopback. Live draft previews use the same Markdown renderer and hero markup as the public site, in a sandboxed, scriptless iframe. Draft file writes use atomic replacement and restrictive permissions. A short operation guard prevents overlapping mutations; there is no database or workspace ownership system.

## Design decisions

- Warm ivory paper, charcoal text, a restrained rust accent, Instrument Serif display type, and DM Sans UI/body type. Fine procedural linework adds a technical/artistic element without purchased assets.
- The default hero uses only the approved name and abstract geometry. Empty archives use functional labels rather than invented personal prose or work.
- Five permanent navigation routes remain available even when optional personal fields are blank. Populated homepage sections are selected manually; projects are omitted from the homepage until selected.
- Images are user-supplied only. Portrait treatment is optional. Reduced-motion preferences disable geometry movement and transitions.
- Editorial dates are optional date-only strings. No creation time, Git commit time, or display date is used to fabricate publication history. Reading time is calculated from each actual article body at 220 words/minute.

## Content model

Entries are plain Markdown in `src/content/writing/<id>.md` and `src/content/projects/<id>.md`. A stable internal file ID lets homepage selections survive title edits. Astro's loader explicitly uses the filename as the collection ID, while frontmatter `slug` supplies the reader-facing URL.

Publication requires an article title, slug, known category, and body. Project title and slug are required; a project may use a summary without a longer body. Optional fields are `description`, `tags`, `coverImage`, `coverAlt`, `displayDate`, `writtenAt`, `firstPublishedAt`, and `externalUrl`. Empty dates are omitted from frontmatter. A cover requires alt text. Published slugs cannot be changed in the studio; a developer can perform a deliberate URL migration later.

`src/data/home.json` holds hero format, text, portrait choice/treatment, and ordered `featuredWriting` / `featuredProjects` internal IDs. Feature status belongs to this explicit ordered selection rather than a second boolean on each article. Unpublishing a selected entry naturally hides it; its saved selection can take effect again if republished under the same ID.

`src/data/site.json` holds the approved name, optional description/social image, extensible categories, and navigation labels. `contact.json` stores an optional email and labeled HTTP(S) links. `about.md` is plain Markdown. Edit the section in the studio to create its private revision; Publish promotes that section only.

## Publication transaction

1. Require a Git repository with an initial commit, configured identity, the publishing branch checked out, an origin, and no unrelated working-tree/index changes.
2. Verify private paths are ignored and not tracked. Fetch the remote branch and require local/remote history to agree. No automatic merge, checkout, reset, or force push occurs.
3. Check draft version and the hash of its original public file. Validate content, unique slugs, category membership, permanent published URLs, alt text, dates, and featured IDs.
4. Plan the one selected public file plus its referenced private assets. Rewrite `/studio-media/…` to `/images/…`. Copy assets only when absent. Keep inactive hero copy in local memory.
5. Back up the exact affected source files in memory, write the planned content, validate all public inputs, run a real Astro build, and scan `dist` for private references.
6. Check for unexpected source changes. Stage the exact planned paths, verify the staged allowlist, then create the content commit. Before a successful commit, failures unstage the transaction paths and restore their previous contents. The private draft remains available.
7. Record the exact pending commit locally. Remove the published draft or retain an unpublished item as a private archive. Push without force. A failed push retains the commit and offers an exact-commit retry; further publications are blocked until it is resolved.
8. Report pushed separately from live. Deployment checks read GitHub's public Actions API for that commit and require the configured workflow and its `deploy` job to succeed. API/network failures do not become deployment success.

If the process is forcibly terminated during a publication, the working tree or index can retain the selected transaction's source changes. The studio's dirty-tree check prevents silently continuing; review those changes before resuming. The editor does not attempt destructive crash recovery. Private drafts remain on disk. A build failure can leave partial local generated files in ignored `dist`; the next successful build replaces them, and nothing is pushed for that failed attempt.

## Security and portability

Host/Origin and fetch-metadata checks prevent browser access from an unrelated site. Mutations require an in-memory CSRF token that is never stored in localStorage. The local UI has a restrictive content security policy; previews cannot execute scripts. Markdown raw HTML is escaped and the output sanitized. HTTP(S) project/contact links are validated. Files are selected through safe IDs and restricted asset basenames, rather than arbitrary filesystem paths. Public-input symlinks are rejected.

No production browser JavaScript receives a Git credential, draft, local path, or admin endpoint. The editor implementation is public source once committed, but Actions uploads only Astro's static output. All private author state lives below ignored `.studio-local/` and outside Astro's inputs.

The project is not a multi-user CMS. It assumes a trusted Mac account and local filesystem. Existing public image files are retained to avoid breaking shared references or implying guaranteed erasure. Private backups and GitHub account setup remain the owner's responsibility.

Content can migrate as Markdown, JSON, and ordinary WebP images. Another static host can serve `dist` after configuring the origin/base path. Another editor or framework can read the same public content without requiring this local UI.

## Verification record

Verified on November 12, 2026 with Node 24.12.0 and npm 11.6.2:

- Fresh `npm ci`, empty-content production build, and output privacy scan in a clean temporary copy: passed.
- Nine Node integration/security tests: passed. Tests use disposable local Git remotes and never contact the owner's GitHub repository.
- Four Chrome end-to-end workflows: passed. These exercise the editor and real production builds under a project URL prefix, including publishing each content type independently.
- Phone (390 px), tablet (768 px), and desktop (1440 px) public routes: no horizontal overflow; automated WCAG A/AA checks passed. Populated article pages, studio dashboard, and article editor also passed automated accessibility checks.
- Browser-tested date preservation, live Markdown preview, private autosave/reopen, image optimization/promotion, featured selection, search, filtering, sorting, and reduced-motion behavior.
- Temporary authored fixtures and generated test sites were removed. The delivered public content remains empty.
- The owner approved the initial commit, push, and Pages setup. GitHub confirmed the Astro workflow's build and `deploy` job for initial commit `dc20a80`; Pages uses Actions with HTTPS enabled at https://daelenwall.github.io/. Local test success alone was not treated as deployment verification.

Automated accessibility checks supplement keyboard and visual review; they are not a certification of every possible future user-authored page.
