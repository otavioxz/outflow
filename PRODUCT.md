# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner, a single person in Brazil tracking their own monthly spending. Access may later be granted to other people the owner chooses; they see the same shared data. All UI copy is Portuguese (pt-BR), currency BRL.

## Product Purpose

Record personal expenses with near-zero friction by sending a WhatsApp message (text or voice note) to a bot, then see where the month's money went on a dashboard. Success: the owner logs spending the moment it happens and can answer "how much have I spent this month, and on what?" at a glance.

## Positioning

Capture happens in WhatsApp, not in the app: no form to fill, no app to open. The dashboard is the read side of a conversation the owner already has with the bot. It updates live as messages arrive.

## Operating Context

- Capture: WhatsApp messages like "gastei 45 no ifood" or a voice note; the bot replies with a confirmation and the month's running total. Commands: `resumo`, `desfazer`, `ajuda`.
- Review: the dashboard is used equally on the phone (quick checks during the day) and on the computer (calmer monthly review).
- The dashboard refreshes itself every few seconds while open.

## Capabilities and Constraints

- Expenses: value, description, category (fixed list of 11), payment method, date, origin (text or audio).
- Monthly view with navigation between months, optional monthly budget (`ORCAMENTO_MENSAL`), comparison with the previous month, per-category and per-day breakdowns, deleting an entry.
- Access is private: email + password login; accounts are created by the owner (no public sign-up).
- Stack: Next.js 16 (App Router, Cache Components), SQLite/libSQL, Recharts.
- Undecided: per-person data separation (currently all data is shared), editing entries in the dashboard.

## Evidence on Hand

Only the owner's real expense data. No brand, logo, or marketing assets exist; do not fabricate any.

## Product Principles

1. Capture friction is the enemy; the dashboard never asks the owner to type what WhatsApp already captured.
2. The month's total and its pace against the budget come first; detail is one step below.
3. Private by default: nothing is visible without login.
4. Money is shown exactly (R$ with cents), never rounded in ways that hide what was spent.
