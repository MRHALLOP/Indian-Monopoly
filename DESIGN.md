# DESIGN.md — Indian Monopoly · Mobile Controller View

> **Stitch Project:** `MONOPOLY` (`projects/4377857579024575154`)
> **Device Type:** Mobile (390 x 884px viewport)
> **Design System:** Indian Currency Game System
> **Color Mode:** Light (implementation overrides to Dark/Zinc for immersion)
> **Last Updated:** 2026-06-20

---

## Table of Contents

1. [Design System Overview](#1-design-system-overview)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing and Layout](#4-spacing-and-layout)
5. [Elevation and Depth](#5-elevation-and-depth)
6. [Shape Language](#6-shape-language)
7. [Screen Architecture](#7-screen-architecture)
8. [Screen-by-Screen Specifications](#8-screen-by-screen-specifications)
9. [Component Library](#9-component-library)
10. [Interaction and Animation Patterns](#10-interaction-and-animation-patterns)
11. [Socket Event to UI State Map](#11-socket-event-to-ui-state-map)
12. [Accessibility Notes](#12-accessibility-notes)

---

## 1. Design System Overview

### Brand Personality

**"Enthusiastic Authority"** - The mobile controller is a player's personal command centre. It must feel like a premium fintech app that also happens to be a game controller. The UI blends:

- **Minimalism** - tight information hierarchy, no decorative clutter
- **Tactile Skeuomorphism** - physical push button effects, depth shadows, color-coded property bands
- **Cultural Grounding** - Indian rupee (RS) symbol throughout; city names drawn from Indian geography; color palette inspired by Indian banknote denominations

### Implementation Note

The Stitch design system specifies a **Light** base. The live implementation deliberately uses **dark backgrounds** (bg-zinc-950, bg-zinc-900, bg-indigo-950, bg-red-950) to:
- Reduce eye strain during extended sessions in a dimmed room (party context)
- Make the accent colors (emerald turn indicator, red roll button, amber bid buttons) pop strongly
- Maintain the tactile "game controller" feel

Both the Stitch tokens (for the design rationale) and the actual implementation colors (for code accuracy) are documented below.

---

## 2. Color Palette

### 2.1 Stitch Design System Tokens (Indian Currency Game System)

| Token | Hex | Usage |
|---|---|---|
| primary | #9e216d | Primary actions, high-value states |
| primary-container | #bd3d87 | RS 2000 Magenta - buttons, property highlights |
| on-primary | #ffffff | Text on primary surfaces |
| secondary | #52625a | RS 500 Stone/Olive - secondary buttons, utility BGs |
| secondary-container | #d3e4da | Chip backgrounds, drawer panels |
| tertiary | #794e00 | RS 200 Orange - alerts, active-turn indicator |
| tertiary-container | #996400 | Sale badges, warnings |
| surface | #fcf9f8 | Base off-white canvas |
| surface-container | #f0eded | Card backgrounds |
| on-surface | #1b1c1c | Primary body text |
| outline | #88717a | Borders, dividers |
| error | #ba1a1a | Error states |
| error-container | #ffdad6 | Error surface backgrounds |

### 2.2 Implementation Color Map (Tailwind CSS - Dark Mode Override)

| Purpose | Tailwind Class | Description |
|---|---|---|
| Page background (idle) | bg-zinc-950 | Near-black neutral base |
| Page background (my turn) | bg-emerald-950 | Deep green - immediately signals active turn |
| Card / tile surface | bg-zinc-900 | One step lighter than base |
| Card border | border-zinc-700 | Subtle separation |
| Header / HUD | bg-black/60 backdrop-blur-md | Glassmorphism overlay |
| Roll button | from-red-500 to-red-700 | Radial gradient, high energy |
| Roll button glow | shadow-[0_0_50px_rgba(239,68,68,0.5)] | Ambient red halo |
| End Turn button | from-amber-500 to-amber-700 | Warm amber gradient |
| Primary money text | text-emerald-400 | RS amounts, positive figures |
| Negative money | text-red-500 | Debt, costs |
| Player name | text-white font-black | Maximum legibility |
| Waiting spinner | border-t-emerald-500 | On zinc-700 ring |
| Trade offer border | border-amber-500 | Distinct, urgent amber |
| Auction background | bg-indigo-950 | Signals mode change |
| Debt / crisis background | from-red-950 via-zinc-950 to-zinc-950 | Gradient danger |
| Buy modal property color | Dynamic tile.color Tailwind class | Pulled from CITIES constant |

### 2.3 Property Color Groups

| Color Group | Tailwind Class | Hex |
|---|---|---|
| Brown | bg-amber-900 | #78350f |
| Light Blue | bg-sky-400 | #38bdf8 |
| Pink | bg-pink-500 | #ec4899 |
| Orange | bg-orange-400 | #fb923c |
| Red | bg-red-600 | #dc2626 |
| Yellow | bg-yellow-500 | #eab308 |
| Green | bg-green-600 | #16a34a |
| Dark Blue | bg-blue-800 | #1e40af |
| Station | bg-gray-800 | #1f2937 |
| Utility | bg-yellow-400 / bg-blue-400 | #facc15 / #60a5fa |

---

## 3. Typography

### 3.1 Font Stack (Stitch Design System)

| Role | Font Family | Weight | Size | Line Height | Tracking |
|---|---|---|---|---|---|
| display-lg | Montserrat | 800 | 48px | 56px | -0.02em |
| display-lg-mobile | Montserrat | 800 | 32px | 40px | - |
| headline-md | Montserrat | 700 | 24px | 32px | - |
| property-title | Montserrat | 700 | 18px | 24px | - |
| body-lg | Plus Jakarta Sans | 500 | 18px | 28px | - |
| body-md | Plus Jakarta Sans | 400 | 16px | 24px | - |
| game-log | Plus Jakarta Sans | 600 | 14px | 20px | - |
| label-caps | Plus Jakarta Sans | 800 | 12px | 16px | +0.05em |

### 3.2 Implementation Typography (Tailwind CSS)

| Semantic Use | Class Combination |
|---|---|
| Player name (HUD) | font-black text-3xl text-white uppercase |
| Cash balance (HUD) | font-mono font-black text-3xl text-emerald-400 tracking-tighter |
| Roll/End button label | font-black text-5xl tracking-widest |
| Drawer tab label | font-black uppercase text-xs tracking-widest |
| Property name | font-black text-white uppercase tracking-wide text-sm |
| Property price | font-mono font-bold text-sm text-emerald-400 |
| Section label / badge | font-black uppercase text-xs tracking-wider |
| Toast notification | font-black uppercase tracking-widest |
| Debt amount | font-black text-5xl text-white |
| Auction bid amount | font-black text-6xl text-white |

### 3.3 Typography Principles

- **Uppercase everywhere** - All action buttons, player names, property names, section headers, and drawer tabs use uppercase. This creates the authoritative, title deed feel from the physical game.
- **Monospace for currency** - All RS amounts use font-mono to maintain consistent digit widths, preventing layout shifts as numbers change.
- **Weight hierarchy**: font-black (900) for labels and CTAs; font-bold (700) for secondary info; font-semibold for body text.

---

## 4. Spacing and Layout

### 4.1 Stitch Spacing Scale (8px rhythmic base)

| Token | Value | Use |
|---|---|---|
| xs | 4px | Icon gaps, tight chip padding |
| base | 8px | Default inline spacing |
| sm | 12px | Within-card gaps |
| gutter | 16px | Screen-edge margins |
| card-padding | 20px | Standard card padding |
| md | 24px | Between cards in a list |
| lg | 40px | Between major sections |
| xl | 64px | Screen-level section gaps |

### 4.2 Mobile Controller Layout Structure

The controller uses a fixed full-height flex column (h-screen flex flex-col) with three distinct vertical zones:

```
+-------------------------------------+  <- Screen top
|  ZONE 1: STATUS HUD                 |  h: auto (~80px)
|  [Player Name]       [RS Cash]      |  bg-black/60 backdrop-blur
+-------------------------------------+
|                                     |
|  ZONE 2: ACTION CENTER              |  flex-grow (fills remaining)
|  (Roll / End Turn / Waiting /       |  Vertically centered content
|   Modals overlay here)              |
|                                     |
+-------------------------------------+
|  ZONE 3: DRAWER SYSTEM              |  h: 256px or 384px
|  [Trade] [Portfolio(N)] [Guide]     |  Tab row: rounded-t-2xl tabs
|  Scrollable content area            |
+-------------------------------------+  <- Screen bottom
```

### 4.3 Drawer Tab Layout

| Tab | Flex Weight | Active Color | Inactive Color |
|---|---|---|---|
| Trade | flex-1 | bg-blue-600 text-white | bg-zinc-800 text-zinc-500 |
| Portfolio (N) | flex-[1.5] | bg-zinc-700 text-white | bg-zinc-800 text-zinc-500 |
| Guide | flex-1 | bg-cyan-700 text-white | bg-zinc-800 text-zinc-500 |

### 4.4 Full-Screen Override Screens

These screens replace the standard controller layout:

- Lobby - join flow
- Auction - live bidding
- Raise Money (Debt) - emergency mortgage/sell flow
- Bankruptcy - end state

---

## 5. Elevation and Depth

### 5.1 Stitch Elevation Levels

| Level | Surface | Treatment |
|---|---|---|
| 0 | Page base | #fcf9f8 (Stitch) / bg-zinc-950 (implementation) |
| 1 | Cards / tiles | Pure white + 2px primary-tinted border + soft shadow |
| 2 | Active buttons | Stronger shadow (y+8, 16px blur) + hue tint |
| 3 | Modals / overlays | bg-black/95 backdrop + shadow-2xl + border-4 |

### 5.2 Glassmorphism (HUD Header)

```css
background: rgba(0, 0, 0, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgb(39, 39, 42);
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
```

### 5.3 Tactile Button Depth

```css
/* Resting state - ROLL button */
box-shadow:
  0 0 50px rgba(239, 68, 68, 0.5),
  inset 0 10px 20px rgba(255, 255, 255, 0.3);

/* Pressed state */
transform: scale(0.95);
box-shadow: none;
```

---

## 6. Shape Language

### 6.1 Stitch Roundness Tokens

| Token | Value | Use |
|---|---|---|
| sm | 0.25rem (4px) | Micro-elements |
| DEFAULT | 0.5rem (8px) | Buttons, inputs |
| md | 0.75rem (12px) | Chips |
| lg | 1rem (16px) | Cards |
| xl | 1.5rem (24px) | Game cards, board tiles |
| full | 9999px | Pill chips, avatars |

### 6.2 Implementation Rounding

| Element | Tailwind Radius |
|---|---|
| Main action button (ROLL / END TURN) | rounded-full (perfect circle) |
| Property card | rounded-2xl (16px) |
| Drawer tab | rounded-t-2xl (top corners only) |
| Sub-button in drawer | rounded-xl (12px) |
| Buy modal | rounded-3xl (24px) |
| Trade offer card | rounded-3xl |
| Toast notification | rounded-full |
| Property color indicator strip | rounded-full (h-3 bar) |
| House indicator dots | rounded-sm |
| Input field | rounded-xl or rounded-2xl |
| Color group swatch | rounded-md |

---

## 7. Screen Architecture

### 7.1 View State Machine

```
        +----------------+
        |     LOBBY      | (initial)
        +-------+--------+
                | join_game -> game_update
                v
        +----------------+  auction_start  +-----------+
        |      GAME      | -------------> | AUCTION   |
        |                | <------------- |           |
        | (isMyTurn /    |  auction_end    +-----------+
        |  waiting)      |
        +----------------+
                |
      raise_money event
                v
        +----------------+
        |  RAISE MONEY   | -> debt cleared -> GAME
        +----------------+
                |
         bankrupt=true
                v
        +----------------+
        |  BANKRUPTCY    | (terminal)
        +----------------+
```

### 7.2 Stitch Screen Inventory

| Screen ID | Title | Dimensions |
|---|---|---|
| 451c72ad | Mobile: Active Turn and Buy Modal | 390x884 |
| 66b21812 | Mobile: Idle and Assets View | 390x884 |
| 0ec345141d | Mobile: End Turn Summary | 390x884 |
| 747d35d2 | Mobile: Trade Properties and Cash | 390x884 |
| 819552f4 | Mobile: Real-Time Auction | 390x884 |
| 10c1452a | Mobile: Portfolio and Mortgage Management | 390x884 |
| da98d00a | Mobile: Detailed Asset Cards | 390x884 |
| ea0f2be7 | Mobile: Counter-Offer State | 390x884 |

---

## 8. Screen-by-Screen Specifications

### S1 - Lobby / Join Game

**File:** client/src/mobile/ControllerComponent.jsx (L192-210)
**View State:** LOBBY | **Background:** bg-zinc-900

```
+-------------------------------------+
|         Join Game                   |  h1: 5xl font-black tracking-widest
|                                     |
|  [ ENTER YOUR NAME                 ]|  border-4 zinc-700 focus:emerald-500
|                                     |
|  [         CONNECT                 ]|  bg-emerald-500 shadow-[0_10px_0_...]
|                                     |  active: translate-y-2 shadow-none
+-------------------------------------+
```

Socket: join_game -> { room: "ABCD", name }

---

### S2 - Active Turn: Roll Phase

**Stitch Screen:** 451c72ad
**Condition:** isMyTurn && !modal && !gameState.hasRolled
**Background:** bg-emerald-950

```
+-------------------------------------+
|  [PLAYER NAME]         [RS 1,500]   |  Glassmorphism HUD
+-------------------------------------+
|                                     |
|           +---------+               |
|           |         |               |
|           |  ROLL   |               |  288x288px rounded-full
|           |         |               |  from-red-500 to-red-700
|           +---------+               |  glow + inner highlight
|                                     |
|    [Jail Controls if applicable]    |  absolute bottom-4
+-------------------------------------+
|  [Trade] [Portfolio(N)] [Guide]     |
|  [Drawer content h-64]              |
+-------------------------------------+
```

ROLL button: 288x288px, rounded-full, red gradient, glow shadows
Socket: roll_dice -> { room: "ABCD" }

Jail Controls (if me.inJail):
- Pay RS 50 Bail -> bg-blue-600, emits pay_bail
- Use Jail Card (N) -> bg-orange-500, emits use_jail_card

---

### S3 - Active Turn: End Turn Phase

**Stitch Screen:** 0ec345141d
**Condition:** isMyTurn && !modal && gameState.hasRolled
**Background:** bg-emerald-950

Same layout as S2, center button changes:
- END TURN: from-amber-500 to-amber-700, amber glow shadow
- Socket: end_turn -> { room: "ABCD" }

---

### S4 - Idle / Waiting Turn

**Stitch Screen:** 66b21812
**Condition:** !isMyTurn | **Background:** bg-zinc-950

```
|   [ spinner ]                       |  w-16 h-16, border-8 zinc-700
|                                     |  border-t-emerald-500 animate-spin
|     WAITING...                      |  text-zinc-500 text-2xl font-black
```

Drawer remains fully functional during wait.

---

### S5 - Buy Property Modal

**Trigger:** prompt_buy socket event -> modal.type === 'BUY'
**Overlay:** absolute inset-0 bg-black/95 z-30

```
+-----------------------------+
| [###  COLOR BAND  ###]      |  h-24 dynamic tile.color border-b-8
|    PROPERTY NAME            |  text-4xl font-black uppercase text-black
+-----------------------------+
|         RS 400              |  text-6xl font-mono font-black
|                             |
|  [ BUY                    ] |  bg-emerald-500 shadow-y+6 active:translate-y-1
|  [ AUCTION                ] |  bg-amber-500 shadow-y+6 active:translate-y-1
+-----------------------------+
```

- bg-white rounded-3xl w-full max-w-sm overflow-hidden
- BUY: buy_property -> { room, propertyId }
- AUCTION: start_auction -> { room, propertyId }

---

### S6 - Trade Offer Incoming Modal

**Stitch Screen:** ea0f2be7
**Trigger:** trade_offer socket event
**Overlay:** absolute inset-0 bg-black/95 z-40 rounded-3xl p-6

```
+----------------------------------+
|  Trade Offer!                    |  text-3xl text-amber-500 border-amber-500
|  [Name] wants to trade:          |
|  [ They give: RS X + City    ]   |  bg-zinc-800 rounded-2xl
|  [ They want: RS Y + City    ]   |  emerald-400 / red-400 text rows
|  [ ACCEPT ✅ ]  [ DECLINE ❌ ]   |  grid-cols-2, emerald-600 / red-600
+----------------------------------+
```

---

### S7 - Portfolio Drawer (Property Manager)

**Stitch Screen:** 10c1452a
**File:** client/src/mobile/PropertyManager.jsx
**Active drawer:** portfolio | **h-64**

```
+--------------------------------------+
| [########## color strip ##########]  |  h-3 rounded-full
| PROPERTY NAME               [■][■]   |  emerald-500 house dots
|  [ BUILD (RS 100) ] [ MORTGAGE ]    |  grid-cols-2 gap-3
+--------------------------------------+
```

Property card states:

| Condition | Appearance |
|---|---|
| Normal | border-zinc-700 |
| Mortgaged | border-red-900 opacity-70 grayscale |
| BUILD (can build) | bg-emerald-600 |
| BUILD (not my turn) | bg-zinc-700 opacity-50 "Not your turn" |
| BUILD (missing set) | bg-zinc-700 opacity-50 "Need all N in set" |
| SELL HOUSE | bg-amber-700 |
| MORTGAGE | bg-red-900 |
| UNMORTGAGE | bg-blue-600 |

Socket actions via manage_property: BUILD_HOUSE, SELL_HOUSE, MORTGAGE, UNMORTGAGE

---

### S8 - Trade Drawer (Trade Interface)

**Stitch Screen:** 747d35d2
**File:** client/src/mobile/TradeInterface.jsx
**Active drawer:** trade | Tab: bg-blue-600

```
+--------------------------------+
|  Trade                         |  text-xl text-amber-500 text-center
|                                |
|  Trade With: [ Select...  v ]  |  bg-zinc-900 border-zinc-700
|                                |
|  +-- YOU OFFER ─────────────+  |  bg-emerald-950/60 border-emerald-800
|  | Your Property: [select]  |  |
|  | Your Cash (RS): [input]  |  |
|  +---------------------------+  |
|                                |
|  +-- YOU REQUEST ─────────+   |  bg-blue-950/60 border-blue-800
|  | Their Property: [select] |  |
|  | Their Cash (RS): [input] |  |
|  +---------------------------+  |
|                                |
|  [ SEND OFFER ->              ]|  bg-amber-500 text-black font-black
+--------------------------------+
```

Socket: initiate_trade -> { room, targetId, offerCash, requestCash, offerPropertyId, requestPropertyId }

---

### S9 - Property Guide Drawer (Property Viewer)

**File:** client/src/mobile/PropertyViewer.jsx
**Active drawer:** viewProps | **h-96** (taller)
Tab: bg-cyan-700

Three-level accordion:

Level 1 - Color Group Header:
```
[ (swatch) LIGHT BLUE        3 PROPS v ]  bg-zinc-900 border-zinc-800 rounded-2xl
```

Level 2 - Property Row:
```
  +-- PANAJI              RS 100  v --+  bg-zinc-800/80 rounded-xl
  +-- AGRA                RS 100  v --+
  +-- VADODARA            RS 120  v --+
```

Level 3 - Property Detail (expanded):
```
     [ Base Rent          RS 6        ]  divide-y divide-zinc-800/80
     [ 1 House            RS 30       ]
     [ 2 Houses           RS 90       ]
     [ 3 Houses           RS 270      ]
     [ 4 Houses           RS 400      ]
     [ Hotel              RS 550      ]
     [ Build Cost         RS 50/house ]  bg-emerald-950/30 text-emerald-400
     [ Mortgage Value     RS 50       ]  bg-red-950/20 text-red-400
```

Stations section: 4 stations + RS 25/50/100/200 rent table
Utilities section: 2 utilities + 4x / 10x dice roll rules

---

### S10 - Auction: Active Bidder

**Stitch Screen:** 819552f4
**File:** client/src/mobile/AuctionController.jsx
**Background:** bg-indigo-950 (full-screen)

```
+-------------------------------------+
|         AUCTION                     |  text-indigo-300 label-caps
|         Current Bid                 |  text-zinc-400 text-sm
|           RS 120                    |  text-6xl font-black text-white
+-------------------------------------+
|  [ Status banner if winning/last ]  |
+-------------------------------------+
|  [ + RS 10     -> Total: RS 130 ]  |  h-24 bg-blue-600    border-b-4 blue-800
|  [ + RS 50  Aggressive -> RS 170]  |  h-20 bg-purple-600  border-b-4 purple-800
|  [ + RS 100 Dominate -> RS 220  ]  |  h-16 bg-red-700     border-b-4 red-900
|  [ Custom RS... ] [ BID ]          |  bg-indigo-900 border-indigo-600
|  [ Withdraw / Fold               ] |  bg-zinc-800 border-zinc-600
+-------------------------------------+
```

Bid Button Hierarchy:

| Button | Height | Color | Psychology |
|---|---|---|---|
| +RS 10 | h-24 (96px) | Blue | Cautious / incremental |
| +RS 50 | h-20 (80px) | Purple | Aggressive |
| +RS 100 | h-16 (64px) | Red | Dominant / risky |

Status Banners:
- Winning: bg-emerald-600/30 border-emerald-500 - "You're Winning!"
- Last bidder: bg-amber-600/30 border-amber-500 - "Last Bidder!"

Socket: place_bid -> { room, amount } | withdraw_auction -> { room }

---

### S11 - Auction: Folded State

**Condition:** amActive === false | **Background:** bg-gray-950

```
+-------------------------------------+
|       (white flag emoji)            |  text-6xl
|          YOU FOLDED                 |  text-4xl text-red-400 font-black
|   Waiting for auction to end...     |  text-zinc-400
|          [ spinner ]                |  border-t-red-500 animate-spin
+-------------------------------------+
```

---

### S12 - Raise Money (Debt Crisis)

**Trigger:** raise_money socket + navigator.vibrate([200,100,200,100,200])
**Background:** bg-gradient-to-b from-red-950 via-zinc-950 to-zinc-950

```
+-------------------------------------+
|     PAYMENT DUE                     |  bg-red-900/80 border-b-4 border-red-600
|           RS 350                    |  text-5xl font-black text-white
|   You need to raise RS 350          |  bg-red-800/60 rounded-full pill
+-------------------------------------+
|  Your Cash:          RS -350        |  text-red-500 (negative)
+-------------------------------------+
|  SELL HOUSES & MORTGAGE             |  scrollable list
|                                     |
|  +--------------------------------+ |
|  | ## MUMBAI            [■■]     | |  property card with color strip
|  |  [Sell House +RS 100]         | |  amber-600 button
|  |  [Mortgage +RS 200]           | |  blue-600 button
|  +--------------------------------+ |
|  +--------------------------------+ |
|  | ## DELHI  [Already Mortgaged] | |  red-900 opacity-60
|  +--------------------------------+ |
+-------------------------------------+
|  [ Give Up - Declare Bankruptcy   ] |  bg-red-900/60 border-red-700
+-------------------------------------+
```

Socket: declare_bankruptcy -> { room: "ABCD" }

---

### S13 - Bankruptcy Screen

**Condition:** me?.bankrupt === true | **Background:** bg-red-950

```
+-------------------------------------+
|                                     |
|           BANKRUPT                  |  text-6xl text-red-500 font-black
|                                     |  tracking-widest uppercase
|  You are out of the game.           |  text-xl text-red-300 text-center
|  Watch the TV for the final result! |
|                                     |
+-------------------------------------+
```

Terminal state - no user actions available.

---

## 9. Component Library

### 9.1 Status HUD (Persistent Header)

```jsx
<div className="flex justify-between items-center p-5 rounded-2xl mb-4
                bg-black/60 border border-zinc-800 shadow-xl backdrop-blur-md">
  <h1 className="font-black text-3xl text-white uppercase">{me?.name}</h1>
  <span className="text-emerald-400 font-mono text-3xl font-black tracking-tighter">
    RS {me?.cash.toLocaleString()}
  </span>
</div>
```

- backdrop-blur-md glassmorphism
- Balance uses toLocaleString() for comma formatting
- Name always uppercase - mirrors physical game piece identity

### 9.2 Toast Notification

```jsx
<div className="fixed top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white
                px-8 py-4 rounded-full font-black uppercase tracking-widest
                shadow-[0_10px_30px_rgba(220,38,38,0.5)] z-50 animate-bounce">
  {toast}
</div>
```

- Appears on: action_error, trade feedback
- Duration: 3 seconds
- Vibration: navigator.vibrate(200)
- Animation: animate-bounce

### 9.3 House / Hotel Indicator

```jsx
// 1-4 houses
[...Array(houses)].map((_, i) => (
  <div key={i} className="w-3 h-3 bg-emerald-500 rounded-sm shadow-md" />
))

// Hotel (5)
<div className="w-4 h-3 bg-red-600 rounded-sm" />
```

### 9.4 Waiting Spinner

```jsx
<div className="w-16 h-16 border-8 border-zinc-700 border-t-emerald-500
                rounded-full animate-spin" />
```

Emerald top segment signals that an active player's turn is happening.

### 9.5 Accordion Pattern (Property Viewer)

Three-tier nested accordion:
1. Trigger: button onClick toggles isOpen state on group header
2. Indicator: chevron with transition-transform duration-200 rotate-180 when open
3. Content: conditionally rendered sibling div
4. Nesting: Group -> Property -> Detail, each with independent state

---

## 10. Interaction and Animation Patterns

### 10.1 Tactile Button Press

```css
/* Resting state */
box-shadow: 0 N px 0 [darker-color];
transform: none;

/* Active / Pressed */
transform: translateY(2px) or scale(0.95);
box-shadow: none;
transition: all 0.1s;
```

Tailwind variants:
- Lobby button: active:translate-y-2 active:shadow-none transition-all
- ROLL/END TURN: active:scale-95 transition-transform
- Bid buttons: active:scale-95 transition-transform active:bg-[darker]

### 10.2 Background Color Transition (Turn Indicator)

```jsx
className={h-screen flex flex-col p-4 transition-colors duration-500
            }
```

Duration: 500ms - noticeable but not sluggish.

### 10.3 Haptic Feedback (Web Vibration API)

| Event | Pattern |
|---|---|
| Toast shown | navigator.vibrate(200) - single 200ms buzz |
| Raise Money alert | navigator.vibrate([200,100,200,100,200]) - SOS pattern |

### 10.4 Drawer Height Change

Guide drawer uses h-96 vs h-64 for Trade/Portfolio - a discrete class swap to accommodate deeper accordion content.

### 10.5 Property Expand Animation

```css
/* animate-[slideDown_0.2s_ease-out] in PropertyViewer */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 11. Socket Event to UI State Map

| Socket Event | Direction | Effect on UI |
|---|---|---|
| game_update | Receive | Updates all gameState, triggers view transitions |
| auction_start | Receive | Switches view to AUCTION, sets auctionData |
| auction_update | Receive | Merges new data into auctionData |
| auction_end | Receive | Clears auctionData, returns to GAME |
| prompt_buy | Receive | Opens Buy Property modal with tile data |
| trade_offer | Receive | Opens Trade Offer incoming modal |
| trigger_visual | Receive | Shows toast (TRADE_ACCEPTED / TRADE_DECLINED) |
| action_error | Receive | Shows toast with error message |
| raise_money | Receive | Switches to RaiseMoneyScreen, vibrates |
| raise_money_resolved | Receive | Exits raise-money mode, shows "Debt cleared!" toast |
| join_game | Emit | { room: "ABCD", name } |
| roll_dice | Emit | { room: "ABCD" } |
| end_turn | Emit | { room: "ABCD" } |
| buy_property | Emit | { room: "ABCD", propertyId } |
| start_auction | Emit | { room: "ABCD", propertyId } |
| place_bid | Emit | { room, amount } |
| withdraw_auction | Emit | { room } |
| initiate_trade | Emit | Full trade offer object |
| accept_trade | Emit | Trade offer object |
| decline_trade | Emit | { room, initiatorId } |
| manage_property | Emit | { room, action, propertyId } |
| declare_bankruptcy | Emit | { room: "ABCD" } |
| pay_bail | Emit | { room: "ABCD" } |
| use_jail_card | Emit | { room: "ABCD" } |

---

## 12. Accessibility Notes

### Touch Target Sizes
- ROLL / END TURN buttons: 288x288px - far exceeds WCAG 44x44px minimum
- Drawer tabs: p-3 padding + full-width flex - comfortable thumb reach
- Bid buttons: h-24, h-20, h-16 full-width - accessible under time pressure
- Property card expand buttons: w-full px-4 py-3 - adequate tap area

### Color Contrast
- Cash display: text-emerald-400 on bg-black/60 - passes AA for large text
- Player name: text-white font-black on dark glass - high contrast
- Negative values: text-red-500 used for debt amounts
- Waiting text: text-zinc-500 on bg-zinc-950 - consider text-zinc-400 for improvement

### Screen Reader Notes
- Property names use uppercase CSS, not uppercase HTML - screen readers read natural case
- Emoji used decoratively - acceptable in game context

### Motion / Haptics
- animate-spin spinner is purely visual - no semantic information conveyed via animation alone
- navigator.vibrate is progressive enhancement - game functions without it

---

## Appendix A: File Map

| File | Purpose |
|---|---|
| client/src/mobile/ControllerComponent.jsx | Root controller - view state machine, socket listeners, main layout |
| client/src/mobile/AuctionController.jsx | Full-screen auction bidding UI |
| client/src/mobile/PropertyManager.jsx | Portfolio drawer - build/sell/mortgage per property |
| client/src/mobile/PropertyViewer.jsx | Guide drawer - all properties reference |
| client/src/mobile/TradeInterface.jsx | Trade drawer - compose and send trade offers |
| client/src/constants.js | CITIES array - all 40 board tiles with pricing, rent, color data |

## Appendix B: Game Data Summary

| Board Tile Type | Count | Notes |
|---|---|---|
| Standard properties | 22 | 8 color groups |
| Stations | 4 | IDs: 5, 15, 25, 35 - RS 200 each |
| Utilities | 2 | IDs: 12, 27 - RS 150 each |
| Special tiles | 12 | GO, Jail, Tax, Chance, Community Chest, etc. |

Price Range: RS 60 (Guwahati/Bhubaneswar) to RS 400 (Mumbai)
House Cost Range: RS 50 to RS 200
Station Rent: RS 25/50/100/200 by stations owned
Utility Rent: 4x or 10x dice roll
