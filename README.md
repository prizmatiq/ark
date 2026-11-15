# ARK

A single-column, English-language sprint calculator. Amounts use RUB, with custom 1,000-ruble steppers.

- Optional monthly expenses are prorated by actual calendar days, inclusive of both dates.
- One-time expenses are deducted once.
- Click a planned shift to confirm it in yellow. Confirmation is not payment.
- Confirmed dates stay included after schedule changes, but dates outside the sprint are excluded.
- Summary cards follow the inputs and calendar.
- Markdown exports inputs, expenses, calculations and shift statuses. JSON restores the plan.
- Data stays in localStorage. Older browser settings are migrated; old purchase wishlists are not automatically treated as sprint expenses.

## Install and offline use

Serve over HTTPS (GitHub Pages) or localhost. Android Chrome can install ARK from its menu or the app's Install button when offered. The app shell is cached after the first successful online visit. Export JSON for backups and device transfers.

When changing the shell, increment CACHE in sw.js. A waiting worker surfaces an Update available button; applying it saves the current state and reloads the app. The worker is scoped to this project, not other Pages sites.

## Checks

Run node tests.cjs for calculation, migration, export and PWA asset checks.
