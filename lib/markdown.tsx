import type { ReactNode } from "react";
import { createElement } from "react";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; level: HeadingLevel; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "code"; code: string }
  | { type: "list"; ordered: boolean; items: string[] };

export function renderMarkdown(markdown: string): ReactNode {
  const blocks = parseBlocks(markdown);

  if (blocks.length === 0) {
    return null;
  }

  return blocks.map((block, index) => renderBlock(block, index));
}

export function stripMarkdown(markdown: string) {
  return normalizeWhitespace(
    markdown
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""))
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^\s*([-*+]\s+|\d+\.\s+)/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1"),
  );
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <p key={index}>
          {renderLines(block.lines, `${index}-paragraph`)}
        </p>
      );
    case "heading":
      return createElement(
        `h${block.level}`,
        { key: index },
        renderInline(block.text, `${index}-heading`),
      );
    case "quote":
      return (
        <blockquote key={index}>
          <p>{renderLines(block.lines, `${index}-quote`)}</p>
        </blockquote>
      );
    case "code":
      return (
        <pre key={index}>
          <code>{block.code}</code>
        </pre>
      );
    case "list":
      return block.ordered ? (
        <ol key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{renderInline(item, `${index}-${itemIndex}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{renderInline(item, `${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

function renderLines(lines: string[], keyPrefix: string): ReactNode {
  return lines.flatMap((line, lineIndex) => {
    const nodes = renderInline(line, `${keyPrefix}-${lineIndex}`);

    if (lineIndex === lines.length - 1) {
      return nodes;
    }

    return [...nodes, <br key={`${keyPrefix}-${lineIndex}-br`} />];
  });
}

function renderInline(text: string, keyPrefix: string, inLink = false): ReactNode[] {
  const nodes: ReactNode[] = [];
  let bufferStart = 0;
  let index = 0;
  let nodeIndex = 0;

  function flushBuffer(end: number) {
    if (end > bufferStart) {
      nodes.push(text.slice(bufferStart, end));
    }
    bufferStart = end;
  }

  while (index < text.length) {
    if (text.startsWith("**", index)) {
      const close = text.indexOf("**", index + 2);

      if (close > index + 2) {
        flushBuffer(index);
        nodes.push(
          <strong key={`${keyPrefix}-${nodeIndex++}`}>
            {renderInline(text.slice(index + 2, close), `${keyPrefix}-${nodeIndex}`, inLink)}
          </strong>,
        );
        index = close + 2;
        bufferStart = index;
        continue;
      }
    }

    if (text[index] === "*") {
      const close = text.indexOf("*", index + 1);

      if (close > index + 1 && text[close - 1] !== "*") {
        flushBuffer(index);
        nodes.push(
          <em key={`${keyPrefix}-${nodeIndex++}`}>
            {renderInline(text.slice(index + 1, close), `${keyPrefix}-${nodeIndex}`, inLink)}
          </em>,
        );
        index = close + 1;
        bufferStart = index;
        continue;
      }
    }

    if (text[index] === "`") {
      const close = text.indexOf("`", index + 1);

      if (close > index + 1) {
        flushBuffer(index);
        nodes.push(<code key={`${keyPrefix}-${nodeIndex++}`}>{text.slice(index + 1, close)}</code>);
        index = close + 1;
        bufferStart = index;
        continue;
      }
    }

    if (text[index] === "[") {
      const closeBracket = text.indexOf("]", index + 1);
      const openParen = closeBracket > -1 ? text.indexOf("(", closeBracket + 1) : -1;
      const closeParen = openParen > -1 ? text.indexOf(")", openParen + 1) : -1;

      if (closeBracket > index + 1 && openParen === closeBracket + 1 && closeParen > openParen + 1) {
        const href = text.slice(openParen + 1, closeParen).trim();

        if (isSafeHref(href)) {
          flushBuffer(index);
          nodes.push(
          <a
              key={`${keyPrefix}-${nodeIndex++}`}
              href={href}
              rel="noreferrer noopener"
            >
              {renderInline(text.slice(index + 1, closeBracket), `${keyPrefix}-${nodeIndex}`, true)}
            </a>,
          );
          index = closeParen + 1;
          bufferStart = index;
          continue;
        }
      }
    }

    const plainLink = inLink ? null : matchPlainLink(text, index);

    if (plainLink) {
      flushBuffer(index);
      nodes.push(
        <a
          key={`${keyPrefix}-${nodeIndex++}`}
          href={plainLink.href}
          rel="noreferrer noopener"
        >
          {plainLink.text}
        </a>,
      );
      index += plainLink.text.length;
      bufferStart = index;
      continue;
    }

    index += 1;
  }

  flushBuffer(text.length);

  return nodes;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && lines[index].startsWith("```")) {
        index += 1;
      }

      blocks.push({ type: "code", code: codeLines.join("\n") });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as HeadingLevel,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index].startsWith(">")) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);

    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index];
        const currentMatch = current.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);

        if (!currentMatch || /\d+\./.test(currentMatch[2]) !== ordered) {
          break;
        }

        items.push(currentMatch[3].trimEnd());
        index += 1;

        while (
          index < lines.length &&
          lines[index].trim() &&
          !lines[index].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
        ) {
          items[items.length - 1] = `${items[items.length - 1]} ${lines[index].trim()}`;
          index += 1;
        }
      }

      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines = [line.trimEnd()];
    index += 1;

    while (index < lines.length && lines[index].trim()) {
      const next = lines[index];

      if (
        next.startsWith("```") ||
        next.match(/^(#{1,6})\s+/) ||
        next.startsWith(">") ||
        next.match(/^(\s*)([-*+]|\d+\.)\s+/)
      ) {
        break;
      }

      paragraphLines.push(next.trimEnd());
      index += 1;
    }

    blocks.push({ type: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

function isSafeHref(href: string) {
  if (!href) {
    return false;
  }

  if (href.startsWith("/") || href.startsWith("#")) {
    return true;
  }

  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function matchPlainLink(text: string, index: number): { href: string; text: string } | null {
  const candidate =
    matchUrlPrefix(text, index, "https://") ||
    matchUrlPrefix(text, index, "http://") ||
    matchUrlPrefix(text, index, "mailto:") ||
    matchUrlPrefix(text, index, "www.");

  if (!candidate) {
    return null;
  }

  const previousChar = index > 0 ? text[index - 1] : "";

  if (previousChar && /[A-Za-z0-9_]/.test(previousChar)) {
    return null;
  }

  const trimmed = trimTrailingUrlPunctuation(candidate);

  if (!trimmed) {
    return null;
  }

  const href = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;

  if (!isSafeHref(href)) {
    return null;
  }

  return { href, text: trimmed };
}

function matchUrlPrefix(text: string, index: number, prefix: string) {
  return text.startsWith(prefix, index) ? readUrlCandidate(text, index) : null;
}

function readUrlCandidate(text: string, index: number) {
  let end = index;

  while (end < text.length && !/\s/.test(text[end])) {
    end += 1;
  }

  return text.slice(index, end);
}

function trimTrailingUrlPunctuation(value: string) {
  let end = value.length;

  while (end > 0) {
    const char = value[end - 1];

    if (!")]}.,!?:;'\"".includes(char)) {
      break;
    }

    if (char === ")" || char === "]" || char === "}") {
      const openChar = char === ")" ? "(" : char === "]" ? "[" : "{";
      const opens = (value.slice(0, end - 1).match(new RegExp(`\\${openChar}`, "g")) ?? []).length;
      const closes = (value.slice(0, end - 1).match(new RegExp(`\\${char}`, "g")) ?? []).length;

      if (opens > closes) {
        break;
      }
    }

    end -= 1;
  }

  return value.slice(0, end);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
