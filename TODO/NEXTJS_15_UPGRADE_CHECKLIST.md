# Next.js 15 Upgrade Checklist

## Pre-Upgrade Preparation

- [x] Create `nextjs-14-stable-backup` branch from `stage` and push to origin
- [x] Record current framework versions in `docs/pre-upgrade-versions.txt`
- [x] Capture baseline build and test logs (`pre-upgrade-build.log`, `pre-upgrade-tests.log`)
- [x] Run dependency audit (`npm outdated`, `npx npm-check-updates`) and note blockers

## Dependency Upgrades

- [x] Upgrade `react` and `react-dom` to ^19.0.0
- [x] Upgrade `next` to 15.5.6 and update `@next/third-parties`
- [x] Upgrade `next-intl` to the latest compatible release
- [x] Update testing libraries (`@testing-library/*`, `jest-environment-jsdom`)
- [x] Confirm compatibility for `react-hook-form`, `framer-motion`, and `react-dropzone`

## Code Migration

- [x] Make `frontend/src/app/layout.tsx` async and await `headers()`
- [x] Update `frontend/src/app/[locale]/layout.tsx` to await `params` and `generateMetadata`
- [x] Convert all dynamic route pages to await `params`/`searchParams`
- [x] Adjust middleware if required by the newer `next-intl` release
- [x] Refresh `next.config.js` experimental settings and add Turbopack/cache tuning
- [x] Update `tsconfig.json` target/lib to ES2022/ES2023
- [x] Revise Jest, Playwright, and related configs for React 19 async APIs

## Tooling & Scripts

- [ ] Add `/scripts/convert-pages-to-async.sh` helper
- [ ] Update lint/type-check scripts if new options are needed
- [ ] Ensure `npm run dev` supports Turbopack fallback via `NEXT_DEV_BUNDLER`

## Testing & Verification

- [ ] Run `npm run lint`, `npm run type-check`, and `npm run build`
- [ ] Execute unit tests with coverage (`npm run test:coverage`)
- [ ] Execute Playwright E2E suite (`npm run test:e2e`)
- [ ] Perform manual QA for core flows (albums, media, auth, admin, locale switcher)
- [ ] Benchmark Lighthouse metrics before and after upgrade

## Documentation

- [ ] Update `/docs/FRONTEND_ARCHITECTURE.md` with Next.js 15 patterns
- [ ] Update `/docs/LOCAL_DEVELOPMENT.md` for Turbopack workflow
- [ ] Create `/docs/NEXTJS_15_MIGRATION.md` with findings and resolutions

## Deployment & Rollback

- [ ] Deploy upgrade branch to staging and run smoke tests
- [ ] Monitor logs and error tracking for regressions
- [ ] Finalize rollback instructions in case production issues appear

## Post-Upgrade Follow-Up

- [ ] Plan adoption of React 19 features (`use()`, server actions, ref cleanup)
- [ ] Identify performance optimization opportunities with new caching APIs
- [ ] Communicate upgrade outcomes and next steps to the team
