# Your local publishing studio

## Open your desk

Double-click **Open Studio.command**. A Terminal window starts the studio, and your browser opens it. Leave that Terminal window open while you write. To close the studio, press Control-C in that window.

Your desk is at `http://127.0.0.1:4322`. It runs on this Mac. It is not an administration page on your public website.

## Write an article

1. Choose **Articles → New article**, or **New article** on the dashboard.
2. Enter your title and write or paste your text. The toolbar adds headings, emphasis, links, lists, quotes, and images. The preview updates as you type.
3. Choose a category and a **URL slug**: a short address using lowercase words and hyphens. The studio keeps the public address stable after the first publication, even when you change the title.
4. Optionally add your own description, tags, cover image, and dates.
5. Changes save automatically as a **private draft** after a short pause. **Save draft** saves immediately. Wait for “Draft saved privately on this Mac” before closing the tab.

The draft stays on this Mac. Saving it does not update GitHub, the public website, the archive search, RSS, or the sitemap. Reopen the studio and choose the draft to continue. A browser warning protects unsaved edits when you try to close the page. If a save fails, keep the tab open and resolve the displayed error; the current text is still in the form.

The writing area uses ordinary Markdown. The toolbar's inserted example words are local editing aids: replace them with your own words before publishing. Blank articles cannot be published.

## Publish

Choose **Publish article** when this particular revision is ready. The studio checks it, builds the site, makes a commit containing only that item's public files and referenced images, and pushes it using your existing Git credentials.

The status message distinguishes:

- **Saved privately:** this Mac only.
- **Committed locally:** a publication was prepared, but has not reached GitHub. The dashboard provides **Retry pending push**. Resolve the network or credential error, then retry; do not create another publication first.
- **Pushed:** GitHub received the changes. Pages is still deploying.
- **Deployment confirmed:** GitHub's Pages deployment job succeeded for that exact commit. The studio checks after a push while the tab remains open; the dashboard also offers **Check deployment**. **Open GitHub Actions** shows full build and deployment details.

A GitHub error or API limit can prevent automatic confirmation. Use Actions to inspect it; “pushed” by itself never means “live.” Initial GitHub setup must be completed once as explained in README.md.

Publishing one article or page does not publish other private revisions. If you have used a newly added category, publish Site settings first so the category exists in the public configuration.

## Revise, archive, and delete

Open a published article and edit it. The live version and public source remain unchanged while you work. **Save draft** keeps this revision private. **Publish** replaces the public version after a successful check.

**Discard private revision** deletes your private edits while keeping the published source. **Unpublish / archive** removes the public page in the next deployment and retains your current revision as a private draft. It asks for confirmation because previously published text and images may remain in public Git history, caches, or other copies. It cannot erase those copies.

To delete an item completely from the local editor, unpublish it first, then choose **Delete private draft** and confirm. Image files remain in the image library because another item may use them.

The studio does not silently combine two edits of the same item. If another tab changed a draft, reload before saving. Copy any unsaved text first. If an outside change updated the published source, copy the work you want to keep, discard the stale private revision, reopen the new public version, and apply your changes there.

## Choose dates deliberately

All dates are optional and may be historical. They are never overwritten automatically.

- **Display / archive date:** the date readers see and the date used to sort the archive. Undated pieces sort after dated pieces.
- **Originally written:** an optional record of when you wrote it.
- **First actually published:** when it was genuinely made public. Used as the RSS publication date; leave it blank if unknown. The archive date is never substituted for it.

Dates use a day, month, and year without a time zone, so a January 1 date stays January 1.

## Images

Choose **Choose image**, or **+ Image** in the writing toolbar. Upload your actual photo or another image you own, then select it from the library. A “Private upload” label means it has not been promoted to the public images folder.

Images are optimized locally. Use JPEG, PNG, WebP, or AVIF; HEIC support depends on the installed image library, so export a JPEG if it cannot be decoded. Choose a still image smaller than 12 MB. Add the image description requested by the editor; this helps people using screen readers.

Uploading alone never publishes an image. Publishing copies only the private images referenced by the selected item. A reused public image is already public, even if you remove it from your current page.

## Homepage

Choose **Homepage** and switch between:

- **Minimal:** your name and an optional portrait.
- **Introduction:** your name, your own introductory text, and an optional portrait.
- **Quote:** your name, your own entered quote and optional attribution, and an optional portrait.

Switching formats preserves the text you entered. Inactive introductory or quote text is stored locally and excluded from the published homepage settings. A portrait can use natural color or monochrome; **Remove** restores the geometric design.

Below the hero settings, select your featured published articles and projects. Use ↑ and ↓ to order the selected items. Selection is manual. Save privately or publish the homepage when ready. Changing a feature selection does not publish private edits to those articles.

## Other pages

- **Projects:** create and edit your own projects with title, text, images, optional tags, dates, and an external project link. Draft, publish, and archive work just like articles.
- **About:** write your own page in Markdown. Use headings for sections and the image library for pictures. Your homepage portrait also appears here when present.
- **Contact:** add your own email address and labeled links. Empty fields produce no invented contact information.
- **Site settings:** edit your own search/share description, optional share image, writing categories, and the labels for the five navigation routes.

Each section has its own private draft and Publish action. Empty personal content is intentional and supported.

## If publishing stops

Read the status message. The studio preserves your drafts and does not discard other files, force-push, change branches, or merge conflicts.

- **Setup incomplete:** finish README.md's one-time account, credentials, initial commit, and Pages setup.
- **Other uncommitted files / different histories:** there are source changes outside the editor. Review those changes with your developer before trying again. The editor will not silently include them.
- **Build or validation error:** correct the named field or content problem, save privately, and publish again. The attempted public source changes are rolled back before a commit is made.
- **Push failed:** fix connectivity or credentials, then use the dashboard's retry button.
- **Deployment failed:** open GitHub Actions, inspect the failed run, and correct that problem. Your last successful live deployment may still be visible.

Back up this project folder, including its hidden `.studio-local` folder, privately with Time Machine or another local backup. GitHub stores published work; your private drafts are intentionally absent from it.
