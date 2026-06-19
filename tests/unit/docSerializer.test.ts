/**
 * Unit tests for docSerializer — docToHtml, docToMarkdown, docIsEmpty.
 */
import { describe, it, expect } from "vitest";
import { docToHtml, docToMarkdown, docIsEmpty } from "../../lib/docSerializer";
import type { TipTapNode } from "../../lib/docSerializer";

// ─── Fixture docs ─────────────────────────────────────────────────────────────

const emptyDoc: TipTapNode = {
  type: "doc",
  content: [{ type: "paragraph", content: [] }],
};

const emptyDocNoContent: TipTapNode = {
  type: "doc",
  content: [],
};

const headingAndPara: TipTapNode = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Title" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "body text" }],
    },
  ],
};

const boldDoc: TipTapNode = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "ship it", marks: [{ type: "bold" }] }],
    },
  ],
};

const bulletDoc: TipTapNode = {
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "buy milk" }] },
          ],
        },
      ],
    },
  ],
};

const hrDoc: TipTapNode = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "before" }] },
    { type: "horizontalRule" },
    { type: "paragraph", content: [{ type: "text", text: "after" }] },
  ],
};

const mixedDoc: TipTapNode = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "H1 Title" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "normal " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " and " },
        { type: "text", text: "italic", marks: [{ type: "italic" }] },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "item 1" }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "item 2" }] }],
        },
      ],
    },
  ],
};

// ─── docIsEmpty ───────────────────────────────────────────────────────────────

describe("docIsEmpty", () => {
  it("returns true for null", () => {
    expect(docIsEmpty(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(docIsEmpty(undefined)).toBe(true);
  });

  it("returns true for a single empty paragraph (TipTap default)", () => {
    expect(docIsEmpty(emptyDoc)).toBe(true);
  });

  it("returns true for doc with no content array", () => {
    expect(docIsEmpty(emptyDocNoContent)).toBe(true);
  });

  it("returns false for a doc with a heading", () => {
    expect(docIsEmpty(headingAndPara)).toBe(false);
  });

  it("returns false for a doc with bold text", () => {
    expect(docIsEmpty(boldDoc)).toBe(false);
  });

  it("returns false for a doc with a bullet list", () => {
    expect(docIsEmpty(bulletDoc)).toBe(false);
  });

  it("returns false for a doc with an hr", () => {
    expect(docIsEmpty(hrDoc)).toBe(false);
  });
});

// ─── docToHtml ────────────────────────────────────────────────────────────────

describe("docToHtml", () => {
  it("wraps output in DOCTYPE html/body", () => {
    const html = docToHtml(emptyDoc);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("<body>");
  });

  it("renders h2 heading correctly", () => {
    const html = docToHtml(headingAndPara);
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<p>body text</p>");
  });

  it("renders bold as <strong>", () => {
    const html = docToHtml(boldDoc);
    expect(html).toContain("<strong>ship it</strong>");
    // No literal asterisks
    expect(html).not.toContain("**");
  });

  it("renders bullet list as <ul><li>", () => {
    const html = docToHtml(bulletDoc);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>buy milk</li>");
  });

  it("renders horizontal rule as <hr/>", () => {
    const html = docToHtml(hrDoc);
    expect(html).toContain("<hr/>");
    expect(html).toContain("<p>before</p>");
    expect(html).toContain("<p>after</p>");
  });

  it("renders h1 correctly", () => {
    const html = docToHtml(mixedDoc);
    expect(html).toContain("<h1>H1 Title</h1>");
  });

  it("renders mixed marks in paragraph (bold + italic)", () => {
    const html = docToHtml(mixedDoc);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("escapes HTML special chars in text", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: '<script>alert("xss")</script>' }],
        },
      ],
    };
    const html = docToHtml(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders inline code as <code>", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hello", marks: [{ type: "code" }] }],
        },
      ],
    };
    const html = docToHtml(doc);
    expect(html).toContain("<code>hello</code>");
  });

  it("renders blockquote as <blockquote>", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "wise words" }] },
          ],
        },
      ],
    };
    const html = docToHtml(doc);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("wise words");
  });

  it("renders ordered list as <ol><li>", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "first" }] },
              ],
            },
          ],
        },
      ],
    };
    const html = docToHtml(doc);
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
  });
});

// ─── docToMarkdown ───────────────────────────────────────────────────────────

describe("docToMarkdown", () => {
  it("renders heading as markdown ## syntax", () => {
    const md = docToMarkdown(headingAndPara);
    expect(md).toContain("## Title");
    expect(md).toContain("body text");
  });

  it("renders bold as **text**", () => {
    const md = docToMarkdown(boldDoc);
    expect(md).toContain("**ship it**");
  });

  it("renders bullet list item with - prefix", () => {
    const md = docToMarkdown(bulletDoc);
    expect(md).toContain("- buy milk");
  });

  it("renders horizontal rule as ---", () => {
    const md = docToMarkdown(hrDoc);
    expect(md).toContain("---");
    expect(md).toContain("before");
    expect(md).toContain("after");
  });

  it("renders h1 as # prefix", () => {
    const md = docToMarkdown(mixedDoc);
    expect(md).toContain("# H1 Title");
  });

  it("renders italic as *text*", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "italic", marks: [{ type: "italic" }] }],
        },
      ],
    };
    const md = docToMarkdown(doc);
    expect(md).toContain("*italic*");
  });

  it("renders inline code with backticks", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hello", marks: [{ type: "code" }] }],
        },
      ],
    };
    const md = docToMarkdown(doc);
    expect(md).toContain("`hello`");
  });

  it("renders blockquote lines with > prefix", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "wise words" }] },
          ],
        },
      ],
    };
    const md = docToMarkdown(doc);
    expect(md).toContain("> wise words");
  });

  it("renders ordered list with numbered prefix", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "first" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "second" }] },
              ],
            },
          ],
        },
      ],
    };
    const md = docToMarkdown(doc);
    expect(md).toContain("1. first");
    expect(md).toContain("2. second");
  });
});
