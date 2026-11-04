/**
 * Structured data must never let store-entered text break out of its
 * <script> element. Regression test for the FAQ page, which escaped "<" as
 * "<" itself ("\u003c" in a normal string literal) and so escaped nothing.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JsonLd from "@/components/seo/json-ld";
import { serializeJsonLd } from "@/lib/seo/json-ld";

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const hostile = {
  name: `</script><script>alert("x")</script>`,
  text: `Tom & Jerry <b>silk</b> --> ${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}`,
};

describe("serializeJsonLd", () => {
  it("escapes every character that could end the script or confuse the parser", () => {
    const json = serializeJsonLd(hostile);
    expect(json).not.toMatch(/[<>&]/);
    expect(json).not.toContain(LINE_SEPARATOR);
    expect(json).not.toContain(PARAGRAPH_SEPARATOR);
    expect(json).toContain("\\u003c/script\\u003e");
  });

  it("parses back to exactly the original data", () => {
    expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile);
  });
});

describe("<JsonLd>", () => {
  it("renders a single script element whose content cannot be closed early", () => {
    const html = renderToStaticMarkup(createElement(JsonLd, { data: { "@type": "FAQPage", ...hostile } }));
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const body = html.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "");
    expect(JSON.parse(body)).toEqual({ "@type": "FAQPage", ...hostile });
  });
});

describe("structured data in the codebase", () => {
  const roots = ["app", "components"].map((dir) => path.resolve(import.meta.dirname, "../..", dir));
  const files = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      return statSync(full).isDirectory() ? files(full) : /\.(tsx|jsx)$/.test(entry) ? [full] : [];
    });

  it("goes through <JsonLd> everywhere, never a hand-written script", () => {
    const offenders = roots
      .flatMap(files)
      .filter((file) => !file.endsWith(path.join("seo", "json-ld.tsx")))
      .filter((file) => readFileSync(file, "utf8").includes("application/ld+json"));
    expect(offenders).toEqual([]);
  });
});
