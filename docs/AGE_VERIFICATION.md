# Age Verification (Age Gate)

This document describes the implementation of the 18+ age confirmation modal.

## Overview

On first visit, users are prompted with an "Age Verification" modal requiring confirmation they are 18+. If accepted, a persistent cookie is stored for 365 days and the normal site content loads. If the user indicates they are under 18, an underage ("KidView") screen is shown for the current session only; on reload the modal reappears because no cookie was stored.

## Behavior

- **Modal Trigger**: Shown when `age_verified` cookie is absent.
- **Accept (I am 18+)**: Sets `age_verified=1` cookie (`SameSite=Lax`, path `/`, 365 days).
- **Deny (I am under 18)**: Does NOT store any cookie. Displays a kid-friendly blocking screen until page reload or manual back action.
- **Subsequent Visits**: If `age_verified=1` cookie present, site loads without modal.
- **Clearing Consent**: User can clear browser cookies to trigger the modal again.

## Components

Located in `frontend/src/components/age-gate/`:

- `AgeGateWrapper.tsx` – Client wrapper that reads cookie and conditionally renders children, modal, or kid view.
- `AgeGateModal.tsx` – Portal modal prompting user consent.
- `KidView.tsx` – Underage placeholder screen with a simple SVG illustration.

Integration occurs in `frontend/src/app/[locale]/layout.tsx` by wrapping existing layout content with `<AgeGateWrapper>`.

## Cookie Name

- `age_verified=1`

## Accessibility & UX Notes

- Modal traps scroll by disabling `body` overflow during display.
- Deny path intentionally avoids persistence, giving users a chance to re-confirm on a future visit.

## Future Enhancements (Optional)

- Add translations for modal text via `next-intl`.
- Add analytics event tracking for accept / deny actions.
- Provide a settings link to re-open or revoke age confirmation.
