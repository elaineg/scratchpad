/**
 * Convert a TipTap/ProseMirror JSON document to HTML and Markdown source.
 * No external dependencies — we walk the JSON doc tree directly.
 *
 * TipTap StarterKit node types we handle:
 *   doc, paragraph, heading (level 1-3), bulletList, orderedList, listItem,
 *   blockquote, horizontalRule, codeBlock, hardBreak, text
 *
 * TipTap mark types we handle:
 *   bold, italic, code, strike, link
 */

// ─── Types (subset of TipTap JSON) ───────────────────────────────────────────

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

// ─── HTML serializer ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodeToHtml(node: TipTapNode): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(nodeToHtml).join("");

    case "paragraph": {
      const inner = (node.content ?? []).map(nodeToHtml).join("");
      return inner ? `<p>${inner}</p>` : "<p></p>";
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;
      const inner = (node.content ?? []).map(nodeToHtml).join("");
      return `<${tag}>${inner}</${tag}>`;
    }

    case "bulletList": {
      const items = (node.content ?? []).map(nodeToHtml).join("");
      return `<ul>${items}</ul>`;
    }

    case "orderedList": {
      const items = (node.content ?? []).map(nodeToHtml).join("");
      return `<ol>${items}</ol>`;
    }

    case "listItem": {
      // listItem contains paragraph nodes; unwrap one level for clean <li> content
      const inner = (node.content ?? [])
        .map((child) => {
          if (child.type === "paragraph") {
            return (child.content ?? []).map(nodeToHtml).join("");
          }
          return nodeToHtml(child);
        })
        .join("");
      return `<li>${inner}</li>`;
    }

    case "blockquote": {
      const inner = (node.content ?? []).map(nodeToHtml).join("");
      return `<blockquote>${inner}</blockquote>`;
    }

    case "horizontalRule":
      return "<hr/>";

    case "codeBlock": {
      const inner = (node.content ?? []).map(nodeToHtml).join("");
      return `<pre><code>${inner}</code></pre>`;
    }

    case "hardBreak":
      return "<br/>";

    case "text": {
      let html = escapeHtml(node.text ?? "");
      const marks = node.marks ?? [];
      // Apply marks inside-out (innermost first)
      for (const mark of marks) {
        switch (mark.type) {
          case "bold":
            html = `<strong>${html}</strong>`;
            break;
          case "italic":
            html = `<em>${html}</em>`;
            break;
          case "code":
            html = `<code>${html}</code>`;
            break;
          case "strike":
            html = `<s>${html}</s>`;
            break;
          case "link": {
            const href = escapeHtml(String(mark.attrs?.href ?? ""));
            html = `<a href="${href}">${html}</a>`;
            break;
          }
        }
      }
      return html;
    }

    default:
      // Unknown node — recurse into content
      return (node.content ?? []).map(nodeToHtml).join("");
  }
}

/**
 * Convert a TipTap JSON doc to an HTML string suitable for ClipboardItem text/html.
 * Wraps output in a basic <html><body> so paste targets get proper MIME context.
 */
export function docToHtml(doc: TipTapNode): string {
  const body = nodeToHtml(doc);
  return `<!DOCTYPE html><html><body>${body}</body></html>`;
}

// ─── Markdown serializer ─────────────────────────────────────────────────────

function marksToMd(text: string, marks: TipTapMark[]): string {
  let out = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "code":
        out = `\`${out}\``;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        out = `[${out}](${href})`;
        break;
      }
    }
  }
  return out;
}

function inlinesToMd(content: TipTapNode[]): string {
  return content
    .map((node) => {
      if (node.type === "text") {
        return marksToMd(node.text ?? "", node.marks ?? []);
      }
      if (node.type === "hardBreak") return "\n";
      return "";
    })
    .join("");
}

function nodeToMd(node: TipTapNode, listDepth = 0): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map((n) => nodeToMd(n, listDepth)).join("\n");

    case "paragraph": {
      const text = inlinesToMd(node.content ?? []);
      return text;
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const hashes = "#".repeat(Math.min(Math.max(level, 1), 6));
      const text = inlinesToMd(node.content ?? []);
      return `${hashes} ${text}`;
    }

    case "bulletList": {
      return (node.content ?? [])
        .map((item) => {
          const inner = (item.content ?? [])
            .map((child) => {
              if (child.type === "paragraph") return inlinesToMd(child.content ?? []);
              return nodeToMd(child, listDepth + 1);
            })
            .join("\n");
          const indent = "  ".repeat(listDepth);
          return `${indent}- ${inner}`;
        })
        .join("\n");
    }

    case "orderedList": {
      return (node.content ?? [])
        .map((item, idx) => {
          const inner = (item.content ?? [])
            .map((child) => {
              if (child.type === "paragraph") return inlinesToMd(child.content ?? []);
              return nodeToMd(child, listDepth + 1);
            })
            .join("\n");
          const indent = "  ".repeat(listDepth);
          return `${indent}${idx + 1}. ${inner}`;
        })
        .join("\n");
    }

    case "blockquote": {
      const inner = (node.content ?? []).map((n) => nodeToMd(n)).join("\n");
      return inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    case "horizontalRule":
      return "---";

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const inner = inlinesToMd(node.content ?? []);
      return `\`\`\`${lang}\n${inner}\n\`\`\``;
    }

    default:
      return "";
  }
}

/**
 * Convert a TipTap JSON doc to raw markdown source string.
 */
export function docToMarkdown(doc: TipTapNode): string {
  return (doc.content ?? []).map((n) => nodeToMd(n)).join("\n");
}

/**
 * Return true if the doc has any non-empty content (user has typed something).
 */
export function docIsEmpty(doc: TipTapNode | null | undefined): boolean {
  if (!doc) return true;
  const content = doc.content ?? [];
  if (content.length === 0) return true;
  // A single empty paragraph is considered empty
  if (content.length === 1 && content[0].type === "paragraph") {
    const inner = content[0].content ?? [];
    return inner.length === 0;
  }
  return false;
}
