# BUSHIRI Dashboard Redesign Design

## Goal

Redesign the existing BUSHIRI dashboard into a sea-inspired Korean data board that feels like a practical Korean fish-market price board, while still reading as a modern web application. The primary outcome is a table-first dashboard where users can see all fish species at a glance and compare prices by vendor immediately.

## Product Intent

This redesign is not a generic analytics dashboard and not a decorative ocean-themed landing page. It is an operational market board for seafood pricing. The interface should prioritize rapid scanning, vendor comparison, and Korean-language readability over ornamental UI.

The emotional reference is a refined Noryangjin-style market board:

- practical rather than luxurious
- intense but controlled
- marine in tone, not cartoonish
- information-dense, but still legible

## Core Design Direction

### Visual Tone

- Direction: **수산시장 실무형**
- Primary palette: deep teal, ink-black, salt-white, muted gray-green
- Ocean motif should appear through tone, linework, surface texture, and subtle rhythm, not through literal illustrations
- The interface should feel like damp metal, marine paint, and market signage rather than glassmorphism or startup SaaS chrome

### Language

- Primary interface language: **Korean**
- Navigation, filters, labels, metric titles, status tags, and table headings should default to Korean
- English may remain only where unavoidable for technical route or developer-facing artifacts

## Information Architecture

### Primary Screen Structure

The main dashboard should be composed of three layers only:

1. **Top filter bar**
2. **Compact summary metrics**
3. **Large market table**

The table is the hero. Everything above it exists only to help users read the table faster.

### Top Filter Bar

The filter bar should remain narrow and operational. It should include:

- 날짜 선택
- 검색
- 품절 제외 토글
- 이벤트만 보기 토글
- 판매처 표시 on/off

The filter bar should not include storytelling copy, banners, or oversized controls.

### Summary Metrics

The summary band should include 3-4 compact metrics only:

- 오늘 등록 어종 수
- 판매처 수
- 품절 건수
- 이벤트 표기 건수

These should be presented as practical counters, not oversized marketing cards.

## Main Data Board

### Table Structure

The main board is fixed as:

- **Rows = 어종**
- **Columns = 판매처**

This structure is the central organizing principle of the redesign.

It is preferred because:

- all species are visible at once
- vendor-to-vendor comparison is immediate
- it resembles a real market rate board
- it supports fast operator scanning during daily review

### Cell Information Priority

Each table cell should present information in this exact hierarchy:

1. **가격** — largest, boldest element
2. **중량** — smaller, secondary text directly below price
3. **상태 태그** — compact tags for 품절 / 이벤트 / 활어 / 선어

This hierarchy must remain consistent across the board.

### Cell Styling Rules

- Price is the dominant typographic element
- Weight sits beneath the price in muted secondary text
- Tags are compact and low-height
- Background tint changes are subtle and should only indicate status emphasis
- Avoid loud color blocks per cell; use restrained highlighting
- Empty cells should read as intentionally empty, not broken

## Visual System

### Color Rules

- Base background: salt-white or very pale gray-green
- Table lines: dark gray-green with strong contrast
- Primary accent: deep teal
- Alert accent: muted rust or amber for operational notice states
- Danger accent: restrained red-brown for 품절 or serious warnings

Avoid bright blue gradients, purple SaaS hues, neon effects, and glossy UI tropes.

### Typography

- Interface language is Korean-first, so typography must support dense Hangul readability
- Table numerals should feel tabular and practical
- Price values should have the strongest weight and contrast
- Headings should be compact, not editorially oversized

### Surface and Texture

- Use thin structural borders generously
- Add only subtle marine texture or line rhythm in background surfaces
- No emoji, no cartoon fish, no wave clip-art
- The ocean reference should stay atmospheric and material, not literal

## Layout Behavior

### Desktop

- The table dominates the screen width
- Filters and metrics remain above the fold
- Side navigation can remain, but should visually recede behind the main board

### Mobile / Narrow Screens

The mobile interpretation should preserve the same data hierarchy rather than attempting to shrink the desktop grid indefinitely.

- Filters collapse cleanly
- Summary metrics stack compactly
- The market table may switch to a horizontally scrollable board or condensed matrix view
- Price remains first, weight second, status third

## Page-Level Intent

### /today

This becomes the primary market board and the most visually important route.

- default landing page
- all species visible at once
- strongest expression of the redesign

### /trends

This remains secondary.

- should inherit the same tone
- should still use practical Korean labeling
- should support deeper review of a selected species without competing with `/today`

### /raw-posts

- admin/operations oriented
- more utilitarian, less theatrical
- should visually connect to the system, but not steal visual attention from the main board

### /settings

- source inventory and operational status
- practical table/list layout
- same palette and structural language as `/today`, but calmer

## Interaction Principles

- fast scanning over animation spectacle
- hover states should be restrained
- status emphasis should come from contrast and tag logic, not movement
- filters should feel crisp and immediate
- avoid ornamental motion that slows reading

## States

### Empty State

When `item_snapshots` or `insights` are absent, the board should still look intentional:

- empty rows should not collapse the page into a broken shell
- use Korean empty-state copy that explains the data has not arrived yet
- keep the grid structure visually stable even when data is missing

### Error State

- inline, practical Korean error text
- no dramatic illustrations
- preserve layout integrity when API calls fail

### Loading State

- skeletal rows that resemble the eventual table shape
- loading patterns should align with the board layout, not generic spinner-only UI

## Explicit Non-Goals

The redesign must not become:

- a generic startup admin dashboard
- a decorative ocean landing page
- a card-heavy SaaS analytics board
- a route set where charts overpower the main market table
- a bilingual UI where English dominates the user-facing product surface

## Acceptance Criteria

The redesign is correct when all of the following are true:

- the first impression is sea-adjacent and Korean-market practical, not generic SaaS
- the interface is primarily Korean
- the `/today` route is visibly a table-first data board
- all species can be scanned at a glance on the main board
- rows are species and columns are vendors
- price is the most prominent cell element
- weight and status are secondary but still readable
- the top area is limited to filters and compact metrics
- the board remains usable when live market data is empty

## Implementation Boundaries for the Next Plan

The implementation plan should focus on:

- redesigning the existing frontend, especially `/today`
- aligning labels and UI copy to Korean
- restructuring the main table into species-by-vendor layout
- refining supporting pages to match the same visual language

It should not introduce unrelated product features or expand backend scope beyond what is needed to support the redesigned board.
