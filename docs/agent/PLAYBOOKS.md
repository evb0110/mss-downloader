# PLAYBOOKS

Detailed procedures, pitfalls, and context for non-trivial tasks.

## Codices (Admont) patterns and heuristics
- Direct IIIF manifest: https://admont.codices.at/iiif/{UUID} (preferred for one-click)
- IIIF image info.json: https://admont.codices.at/iiif/image/{UUID}/info.json (single page)
- Heuristics implemented in CodicesLoader:
  - Extract raw UUIDs from HTML and try bases: {origin}/iiif/, https://admont.codices.at/iiif/, https://codices.at/iiif/
  - Parse escaped URLs (JSON-escaped) and common manifest hints
  - Fallback page scraping to construct full/full IIIF image URLs
- Supported entry: list both patterns in description and use direct IIIF manifest as example

## Morgan Library (themorgan.org) extraction strategy
- Site is Drupal 10 with Digital Facsimiles grid and individual pages
- Thumbs redirect to canonical collection page: /collection/{slug}[/thumbs]
- Preferred assets (highest to lowest):
  - Use pagination (?page=1,2,…) to gather all facsimile ids from the collection grid before building links
  1) ZIF tiles: https://host.themorgan.org/facsimile/images/{slug}/{id}.zif
  2) High-res JPEGs from individual page: /sites/default/files/facsimile/{BBID}/{id}.jpg
  3) Original images converted from styled thumbs
  4) Direct full-size images under /images/collection/
- Identifiers are parsed from both direct and styled facsimile paths on the thumbs page
- Also parse individual page URLs to find high-res JPEGs if needed
- Be polite: add small delays when crawling individual pages
- Direct IIIF manifest: https://admont.codices.at/iiif/{UUID} (preferred for one-click)
- IIIF image info.json: https://admont.codices.at/iiif/image/{UUID}/info.json (single page)
- Heuristics implemented in CodicesLoader:
  - Extract raw UUIDs from HTML and try bases: {origin}/iiif/, https://admont.codices.at/iiif/, https://codices.at/iiif/
  - Parse escaped URLs (JSON-escaped) and common manifest hints
  - Fallback page scraping to construct full/full IIIF image URLs
- Supported entry: list both patterns in description and use direct IIIF manifest as example

## Safe terminal usage (Agent Mode)
- Always add --no-pager to git commands that could paginate
- Avoid interactive commands (no editors, no prompts)
- For large file reads, prefer dedicated tools over `cat`; request specific ranges when possible

## Versioning and releases
- Patch (Z): new patterns, bugfixes, docs
- Minor (Y): new loaders, larger feature improvements
- Major (X): breaking changes or wide refactors
- Steps: bump version, update changelog array in package.json, commit, tag, push, gh release create

## Where to update Supported Libraries
- EnhancedManuscriptDownloaderService.SUPPORTED_LIBRARIES array contains name/example/description
- Keep descriptions explicit about direct IIIF vs SPA viewer pages

## Common pitfalls
- Forgetting to update SUPPORTED_LIBRARIES after adding detection — users won’t see examples
- Adding pattern without bumping version — releases won’t reflect change
- Using interactive or paged commands — breaks in CI/Agent context

