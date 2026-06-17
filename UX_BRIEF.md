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
