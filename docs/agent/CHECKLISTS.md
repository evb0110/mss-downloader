# CHECKLISTS

Fast action checklists for repetitive tasks.

## Add or adjust URL pattern (existing library)
- [ ] Implement detection or loader logic (prefer library loader over shared if specific)
- [ ] Update EnhancedManuscriptDownloaderService.detectLibrary() if domain-based
- [ ] Update Supported Libraries entry (name/example/description)
- [ ] Bump patch version in package.json and add succinct changelog line
- [ ] npm run typecheck:silent (non-blocking); proceed
- [ ] git commit -m "feat(<lib>): <short>" (Refs #<id> if applicable)
- [ ] git push origin main; git tag vX.Y.Z; git push --tags
- [ ] gh release create vX.Y.Z --generate-notes --title "vX.Y.Z - <summary>"

## Add a new library
- [ ] Create loader in src/main/services/library-loaders/<Name>Loader.ts (follow existing patterns)
- [ ] Register loader in EnhancedManuscriptDownloaderService constructor and routing switch
- [ ] Add detectLibrary() rule and SUPPORTED_LIBRARIES entry
- [ ] Add example URL(s) and description (IIIF vs native)
- [ ] Bump minor if notable; patch otherwise
- [ ] Typecheck (silent), commit, push, tag, release

## Release (docs or minor fixes)
- [ ] Update package.json version and changelog short notes
- [ ] Commit to main
- [ ] Tag vX.Y.Z and push
- [ ] gh release create vX.Y.Z --generate-notes --title

## After merging loader logic
- [ ] Verify example link works end-to-end
- [ ] If SPA or auth quirks: document in description with alternative direct IIIF example

