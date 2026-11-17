---
name: Car Rental
description: The agency staff app, on the web and the phone, dressed in each agency's own theme.
colors:
  primary: "#0C3164"
  on-primary: "#FFFFFF"
  nav: "#0C3164"
  on-nav: "#FFFFFF"
  canvas: "#F3F6FA"
  surface: "#FFFFFF"
  line: "#DEE3EB"
  ink: "#0F1926"
  muted: "#586474"
  status-reserved: "#0F1926"
  status-out: "#0B66D6"
  status-late: "#B71824"
  status-returned: "#A96000"
  status-closed: "#036639"
  status-blocked: "#5F697E"
  on-status: "#FFFFFF"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.334
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.6
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.75
  caption:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Arabic, Tahoma, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.66
rounded:
  bar: "6px"
  md: "10px"
  nav-item: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
  button-outlined:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "5px 15px"
  chip-choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "32px"
  chip-choice-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    height: "32px"
  badge-status:
    backgroundColor: "{colors.status-out}"
    textColor: "{colors.on-status}"
    rounded: "{rounded.pill}"
    height: "24px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
  nav-item-selected:
    textColor: "{colors.on-nav}"
    rounded: "{rounded.nav-item}"
    padding: "4px 16px"
  planning-bar:
    backgroundColor: "{colors.status-reserved}"
    textColor: "{colors.on-status}"
    rounded: "{rounded.bar}"
    height: "32px"
---

# Design System: Car Rental

## Overview

**Creative North Star: "The Planning Board"**

A Tunisian rental agency runs on its planning board: one row per car, one column per day, bookings written across it. This system brings that board to the screen. The statuses are the board's inks, fixed and read the same way in every agency. The agency's own colours dress the frame around them: the sidebar or header, the buttons, the links, the selected choice. Staff work at a counter and in a sunny car park, on a desktop and on cheap phones, so everything is legible first, in light and in dark.

Each agency picks one of 18 themes (`agency.theme`) and light, dark or "follow the device" (`agency.theme_mode`). The owner chooses at Settings → Theme, and every staff member sees the result on the web and the phone. The tokens above are the default theme, Navy in light. Every palette and its dark scheme live in `src/classes/Theme.ts`, the source of truth, copied from the phone app. Screens never name a palette's hex: they read the theme in use.

The components feel warm and friendly on a flat, sturdy base. Choices and statuses are pills, containers have soft 10px corners, and nothing has a sharp corner or a shadow. New screens lean rounder and friendlier, never harder or more ornamental.

**Key Characteristics:**
- Statuses in fixed inks, the agency's palette on the frame.
- 18 themes in three families (dark sidebar, bold colour, light and pastel), each in light and dark.
- Flat: 1px lines and a canvas under white cards, no shadows.
- Pills for choices and statuses, 10px soft corners for everything else.
- One system font; weight, not size, carries most of the hierarchy.
- Right-to-left ready: Arabic mirrors the layout; plates and phone numbers stay left to right.

## Colors

A calm frame in the agency's colours around a fixed set of status inks, with a neutral canvas and white cards in between.

### Primary
- **Agency Colour** (`primary`): buttons, links, the selected choice, focus rings, the "due back today" figure. In Navy it is a deep navy. Other themes put their own colour here, dark enough to carry white text in light and light enough to carry dark text in dark.
- **Frame** (`nav`, `on-nav`): the web sidebar, the phone's header and menu bar, and the text on them. It can be deep (Navy, Noir, Electric), bold (Taxi's yellow, Gulf's powder blue) or pastel (Blossom, Mint, Paper), so `on-nav` is white or ink to match.

### Neutral
- **Canvas** (`canvas`): the page behind everything, faintly tinted toward the theme's hue.
- **Card White** (`surface`): cards, dialogs, fields, the tab bar.
- **Hairline** (`line`): borders and dividers, the only depth cue.
- **Ink** (`ink`): text, and reserved bookings on the planning.
- **Pencil** (`muted`): secondary text, labels, hints. It stays at 4.5 : 1 or better on the canvas in every theme.

### Status Inks
- **Reserved** (`status-reserved`): the theme's ink, as a booking written in pen.
- **Out** (`status-out`): a car with a client.
- **Late** (`status-late`): overdue. On the planning, late bars are striped too.
- **Returned** (`status-returned`): back and waiting to be settled; also maintenance and "due soon".
- **Closed** (`status-closed`): done, paid, available.
- **Blocked** (`status-blocked`): cancelled, blocked, sold; one cool slate in every theme.

### Named Rules
**The Fixed Inks Rule.** A status has one colour everywhere: badges, planning bars, the car list, the contract. No theme changes the status inks, and no brand colour stands for a status.

**The Frame Rule.** The agency's palette dresses only the frame and the actions: sidebar or header, buttons, links, selection. It never paints a status or a whole content area.

**The Designed Dark Rule.** Dark is its own scheme, never an inversion. Surfaces step up from the canvas, tones turn light, and the text on a filled tone (`on-status`, `on-primary`) turns dark. Every text holds 4.5 : 1 in light and 6 : 1 in dark.

**The No-Hex Rule.** Components use palette keys in `sx` (`primary.main`, `text.secondary`) or `COLORS`, `ON_COLORS` and `tint()` from `src/constants.ts` in inline styles. A hex value in a component would not follow the theme. The client's signature is the one exception: dark ink on white paper, as on the printed contract.

## Typography

**Body Font:** the system UI font (system-ui, with Segoe UI, Roboto, Noto Sans Arabic and Tahoma as fallbacks)

**Character:** one familiar font that reads well in French, English and Arabic on any device. Weight does the work: 700 for titles and figures, 600 for names and actions, 400 for the rest.

### Hierarchy
- **Headline** (700, 1.5rem, 1.334): the page title, one per page, as an h1.
- **Title** (700, 1.25rem, 1.6): section titles, as h2 whatever their size.
- **Body** (400, 1rem, 1.5): running text, rows, values.
- **Body Small** (400, 0.875rem, 1.43): secondary lines, captions under rows, list details.
- **Label** (600, 0.875rem): buttons and actions, sentence case, never uppercase.
- **Caption** (400, 0.75rem): meta such as planning weekdays and plates under a car's name.

The phone app uses the same roles at fixed sizes: title 20px, body 16px, meta 13px.

### Named Rules
**The One Family Rule.** No second font. Hierarchy comes from weight and size, and figures that line up use tabular numerals.

## Layout

A sidebar and a page on desktop; a menu bar and a drawer below 900px (the phone app uses tabs and stacked screens). The sidebar is 248px wide, in the theme's frame colour, with the day's pages first, then "every day" and "money" groups. The page content is centred with a 1200px maximum, padded 16px on a phone and 24px from 900px up. Sections stack as cards 16px apart, and lay out on MUI's 12-column grid (two columns from 900px, figures four across on Today). Small forms open as dialogs.

The planning is the signature layout: car names in a sticky column, one 48px row per car, days at least 44px wide (a week scrolls sideways on a small phone), and bookings as bars positioned by time. No page scrolls sideways at 375px.

## Elevation & Depth

Flat. Papers and cards have no shadow; depth comes from white cards on the tinted canvas and 1px hairline borders. In dark, surfaces step up in lightness instead (canvas, then a lighter card). Dialogs and menus are the only raised layers, with MUI's default shadow.

### Named Rules
**The Flat Counter Rule.** Nothing at rest casts a shadow. To set something apart, use a card on the canvas or a hairline, not a shadow.

## Shapes

Warm, soft geometry. Containers (cards, fields, buttons, dialogs) have 10px corners; the sidebar's items are 20px pills; choices, status badges and the "My tasks" toggle are full pills; planning bars have 6px corners so short bookings still read as bars. No sharp corners.

### Named Rules
**The Soft Corner Rule.** New components start from a pill (for a choice, a status or a tag) or a 10px corner (for anything holding content). Rounder is right; square is wrong.

## Components

### Buttons
- **Shape:** softly rounded (10px), sentence-case label at 600, no shadow.
- **Primary:** filled with the agency colour, text in `on-primary`. One per view, for its main action ("Hand over the car", "Save").
- **Outlined / Text:** agency-colour text on white, for secondary actions ("Add an expense", "Choose a client").
- **Icon buttons** always have an accessible name (`aria-label`); delete and remove use the late red.
- **Focus:** MUI's focus state; custom buttons (`bareButton`) get a 2px agency-colour ring, 2px out.

### Chips
- **Choice** (`Choice` in `common.tsx`): a row of pills, one filled in the agency colour when selected (`aria-pressed`), the others outlined. Used for date ranges, zoom, payment method, deposit method, block reason, report tabs.
- **Status badge** (`Badge`): a small pill filled with the status ink, bold text in `on-status`. Label always present; colour never alone.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** card white on the canvas.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 16px. A `Section` card has a title (h2) and its rows 8px apart.

### Inputs / Fields
- **Style:** MUI outlined, small (40px), 10px corners, card-white background, a label always shown. Dates are native date inputs, so they follow light and dark.
- **Focus:** the agency colour on the outline.
- **Error:** the late red, with the reason below the field.

### Navigation
- **Sidebar:** the theme's frame colour (`nav`) with `on-nav` text and icons, group headers in small overline caps at 60% opacity, the current page as a pill tinted 14% with `on-nav`. The agency's logo (or a tinted tile) and name at the top; language and sign-out at the bottom.
- **Phone:** a menu bar in the frame colour opens the same sidebar as a drawer. In the phone app, headers take the frame colour, and the tab bar stays card white with the agency colour for the current tab.

### Planning board
The signature component. Car names and plates in a column of links, one row per car, today's column tinted with the agency colour at 7%. Bookings are bars in the status inks with the client's name, 24px minimum, each a link or button whose name gives the status and dates. Late bars are striped. An empty day is a button that offers "Reserve" or "Block". The legend lists every ink.

## Do's and Don'ts

### Do:
- **Do** read colours from the theme: palette keys in `sx`, or `COLORS`, `ON_COLORS` and `tint(tone, opacity)` in inline styles, so light, dark and all 18 themes follow.
- **Do** give a status its ink from `STATUS_TONES` (reserved `ink`, out `info`, returned `warn`, closed `ok`, cancelled `muted`, late `danger`), with its label beside it.
- **Do** make anything clickable a link or a button (`component='button'` with `bareButton`), with a name and a visible focus ring.
- **Do** keep text at 4.5 : 1 or better in light and 6 : 1 in dark, including text on the bold and pastel frames.
- **Do** add a new palette in `src/classes/Theme.ts` (phone app first), with its light and dark schemes, and in `App\Models\Agency::THEMES`.
- **Do** pin plates, phone numbers and anything positioned by coordinates to left to right.

### Don't:
- **Don't** put a hex value in a component; it would ignore the agency's theme and dark mode.
- **Don't** use the agency colour for a status, or a status ink for decoration.
- **Don't** put white text on a filled colour by hand; use `on-primary`, `on-nav` or `on-status`.
- **Don't** add shadows to cards or rows, or a second font.
- **Don't** make square-cornered components; choices and statuses are pills, containers 10px.
- **Don't** put `onClick` on a `Box`, a `div` or a table row without a link or button a keyboard can reach.
