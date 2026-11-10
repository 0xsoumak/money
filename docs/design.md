# Design guide

Direction: **Bold & high-contrast**. Dark first, with a light theme of the same design.
Approved mockups (mobile home, quick add, web dashboard): https://claude.ai/artifact/HTDvnM3CTop7ARDJCDAM2X (rows B)

Tokens live in [packages/shared/src/tokens.ts](../packages/shared/src/tokens.ts) and are tested for contrast in `tokens.test.ts`. Never hardcode a color, size or radius in an app; use a token.

## Principles

1. **The number is the hero.** The month's total is the biggest thing on the screen. Everything else supports it.
2. **Flat and sharp.** No shadows or gradients. Separation comes from contrast, thin rules and spacing. Corners are tight (6 to 18).
3. **One accent.** Lime is for the primary action and "this is selected". It is not decoration.
4. **Uppercase labels, big numbers.** Small uppercase labels name things; large tabular figures carry the data.
5. **Color is never the only signal.** Over budget shows `₹60 over` in words as well as red.
6. **Fast over pretty.** Quick add is three taps. Every screen is judged by how quickly the user gets back to their day.

## Visualizations: clean and simple

Only three kinds, so everything reads at a glance.

| Visual          | Used for                         | Rules                                                                                                                                                                |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Block meter** | Budget progress, month progress  | 10 equal blocks, filled left to right. Neutral until 80%, then `warning`, over 100% `danger`. Label with words (`₹1,680 left`, `₹60 over`).                          |
| **Share bar**   | Where this month's money went    | One bar, one segment per category, widths proportional to amount. Legend below with name and amount. Includes a dashed "left to spend" segment when a budget exists. |
| **Ranked list** | Category breakdown, top spending | Sorted high to low, name and amount on each row, a bar only if it adds clarity.                                                                                      |

Rules for all of them:

- **No pie or donut charts, no axes, no gridlines, no 3D.** If a chart needs a legend lookup to read, it is too complex.
- **Label directly.** The value sits on or beside the thing it describes. No hover-only information.
- **Numbers first.** Every visual has its exact figure next to it.
- **Same category, same color, everywhere.** Use `categoryColor(key, scheme)`.
- **Animate on change only**: meters fill in on first show and when the value changes (about 400 ms), nothing loops.
- **Trend over time** (post-v1): a single plain line or bar-per-month, labeled at the ends, no more than 12 points.

## Typography

Space Grotesk, weights 400/500/600/700. Money always uses tabular figures. See `type` in tokens for the scale: headline total 76 (phone) / 112 (web), quick-add amount 96, row amount 20, body 18, labels 14 uppercase.

## Components to build

Build these once per platform (web with Tailwind + Base UI/React Aria, mobile with NativeWind), same names and props.

| Component                   | Notes                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `Button`                    | Variants: primary (accent), outline (2px border), ghost. Min height 44. Pressed state darkens. |
| `IconButton`                | 44×44 square with 2px border, required `aria-label`.                                           |
| `AmountDisplay`             | Formats minor units with the user's currency; tabular; size prop maps to type tokens.          |
| `NumberPad`                 | 3×4 grid, 64px keys, haptic on press (mobile), keyboard input on web.                          |
| `CategoryPill`              | Emoji + name; selected state fills with the category color. Scrolls horizontally on phone.     |
| `TransactionRow`            | Color bar, title, category, amount. Swipe to delete on mobile, hover actions on web.           |
| `DayGroup`                  | Uppercase day label with total and a 2px rule, then rows.                                      |
| `BlockMeter`                | The 10-block meter with state colors.                                                          |
| `ShareBar`                  | Proportional segmented bar plus legend.                                                        |
| `MonthSwitcher`             | Previous, label, next. Keyboard arrows on web, swipe on mobile.                                |
| `Sheet` / `Dialog`          | Bottom sheet on mobile, centered dialog on web. Spring motion.                                 |
| `Toast`                     | Used for Undo after delete. Auto-dismiss after 5 s.                                            |
| `TextField`                 | Underline style for notes, bordered for forms. Visible label.                                  |
| `Tabs` / `SegmentedControl` | Expense/Income toggle, All/Expenses/Income filter.                                             |
| `EmptyState`                | One line of plain text and one action.                                                         |
| `Skeleton`                  | Matches row and meter shapes; no spinners on lists.                                            |

## States every component handles

Default, pressed or hover, focus (visible 2px outline), disabled, loading, error. Dark and light.

## Motion

Short and springy: sheets and the keypad use the shared spring; everything else is 160 to 240 ms ease-out. Respect "reduce motion" by turning springs into fades.

## Accessibility

- Text 4.5:1, graphics 3:1 (enforced by tests for tokens).
- Touch targets at least 44×44.
- Amounts get full screen-reader labels (`one hundred eighty rupees`), not just glyphs.
- Never rely on color alone (see principle 5).
