# UX Brief — Scratchpad

## 1. Problem statement
A blank page that's already waiting for you — open it and just start typing, no doc to name, no toolbar to learn; it quietly formats and saves itself as you go.

## 2. Primary user action
**Type.** The cursor is already blinking, auto-focused, in the center column on cold load. There is no button to press first, nothing to click, nothing to set up. The first keystroke is already real writing. A faint placeholder ("Start typing…") shows the intent and vanishes the instant a key is pressed.

## 3. Emotional tone
Warm, calm, focused — a quiet writing room, not an app. Dropbox Paper / iA-Writer lineage OVERRIDES the SSENSE house chrome here (there is essentially no chrome to style). Paper-white background (not harsh #fff), soft near-black ink (not #000), generous airy spacing, unhurried. Typography is the entire surface and the entire delight.

## 4. Design decisions
- **Zero-chrome cold load (make-or-break).** Screen is COMPLETELY BLANK white: NO header, NO toolbar, NO buttons, NO sidebar, NO menu, NO logo, NO footer. On screen there is ONLY the centered writing column with a blinking auto-focused caret and a faint single-line placeholder. The value needs no instruction because there is nothing to learn — you just type.
- **Reformat with zero jump (make-or-break).** Markdown input-rules are framework-native (TipTap/ProseMirror or Lexical markdown-shortcut). Typing `## ` consumes the syntax in place and the line reflows to a heading with NO page jump, NO caret jump, NO surrounding-line shift — only that one line changes size, caret stays put at the typing position. Keystrokes have zero perceptible lag; the caret is smooth and always visible.
- **Whisper-quiet autosave.** Debounced (~800ms) save to one localStorage key. The ONLY status affordance is a tiny low-contrast "Saved" word in a screen corner (bottom-right), light grey, small; it fades in briefly after a save settles and fades back to nothing. Default canvas shows nothing distracting. Reload restores the exact document.
- **"Get your note out" — copy affordance that respects the zen.** Two labeled text actions, **Copy as Rich Text** and **Copy as Markdown**, sit in the TOP-RIGHT corner of the viewport (fixed, outside the writing column so they never overlay or reflow the text). They are HIDDEN on a blank document (preserving the chrome-free cold load, success check 8) and FADE IN (~250ms opacity, no slide/no layout shift) the moment the doc becomes non-empty; they fade back out when the doc is emptied again. Resting state is faint grey (same low-contrast family as "Saved"), labels readable not iconic, so a user knows they copy; on hover/focus they darken to ink. They are real text labels (legible, never a mystery icon) so the feature is discoverable once content exists, yet invisible until earned. Clicking does NOT move focus out of the editor (the editor caret is preserved; we restore focus after the clipboard write) and does NOT shift the writing column.
  - **Rich Text** writes a `ClipboardItem` with both `text/html` (rendered HTML — headings, bold, bullets, dividers as real formatting) and a `text/plain` fallback (the markdown source), so pasting into Slack/Gmail/Docs/Notion preserves formatting.
  - **Markdown** copies the raw markdown source string as `text/plain`.
- **Robust copy confirmation + explicit failure (honor transient-cue lesson).** On a successful copy, the clicked action's label is REPLACED IN PLACE by "Copied rich text ✓" / "Copied markdown ✓" in a calm confirm-green, and HOLDS for ~1.8s (well above any sub-150ms flash, perceptible to a hurried human, survives the live autosave re-render because the confirm state is keyed to the action, not a detached toast), then eases back to the resting label. If the clipboard write throws or is blocked (permissions/insecure context), the label instead shows "Copy blocked — select all & ⌘C" in a muted warning tone for ~3s — an explicit, actionable failure, never a silent pretend-success. Only the clicked action changes; its sibling stays at rest.
- **Mobile (≤375px) safe.** The two actions stay top-right, shrink to small text, and sit ABOVE the 12vh top margin band so they never overlay the writing column or the caret; if both labels would crowd the 375px width they stack right-aligned. No fixed control ever covers text or the autofocused caret.

## 5. Typography spec (the product)
- **Font surface:** humanist/readable stack — `ui-serif, "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif` for body (Paper-warm). Acceptable alt: a humanist sans (`ui-sans-serif, "Inter", system-ui`). Builder picks one; commit to it.
- **Palette:** paper background `#FBFAF8` (warm near-white); ink `#2B2B29` (soft near-black, not #000); muted grey `#A6A39C` for placeholder + "Saved".
- **Body:** ~19px, line-height ~1.75, paragraph spacing ~1em between paragraphs.
- **Measure:** centered column, `max-width: 68ch` (within the 65–75ch target), comfortable top margin (~12vh) and side gutters; never full-bleed.
- **Heading scale:** H1 ~32px / lh 1.25; H2 ~26px; H3 ~21px; semibold, slightly tighter, with breathing room above.
- **Marks:** bullets = subtle round marker with hanging indent; numbered lists aligned; blockquote = soft left hairline rule (grey) + indent, ink slightly muted; inline `code` = light grey background, monospace, small radius; `---` divider = single faint hairline rule, generous space above/below; bold/italic real weight/slant.

## 6. 5-second check (above the fold, cold visitor)
- **Headline:** none rendered — the blank page IS the message.
- **Subtitle:** none.
- **Primary action:** blinking auto-focused caret in the centered column (zero clicks to type).
- **Pre-filled example / hint:** faint grey "Start typing…" placeholder that disappears on first keystroke.
