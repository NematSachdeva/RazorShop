import React from 'react';

interface FormattedMarkdownTextProps {
  content: string;
  className?: string;
}

/**
 * Clean, safe Markdown renderer for Merchant Helper chat messages.
 * Supports bold (**text**), italic (*text*), inline code (`code`),
 * bullet lists, numbered lists, headings, and Markdown tables.
 * Pure React implementation — zero dangerouslySetInnerHTML for complete XSS safety.
 */
export const FormattedMarkdownText: React.FC<FormattedMarkdownTextProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  // 1. Clean malformed / dangling Markdown syntax
  const cleaned = cleanMarkdownContent(content);

  // 2. Split content into blocks (tables, lists, headings, paragraphs)
  const blocks = parseMarkdownBlocks(cleaned);

  return (
    <div className={`markdown-body space-y-2 text-xs leading-relaxed font-sans ${className}`}>
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>{renderBlock(block, idx)}</React.Fragment>
      ))}
    </div>
  );
};

/**
 * Pre-cleans dangling asterisks and malformed markdown tags.
 */
function cleanMarkdownContent(text: string): string {
  let s = text;

  // Remove standalone dangling lines like "* **", "- **"
  s = s.replace(/^[ \t]*[*|-][ \t]*\*\*[ \t]*$/gm, '');
  s = s.replace(/^[ \t]*\*\*[ \t]*$/gm, '');

  // Fix unmatched bold tags (**Action: -> Action:)
  s = s.replace(/\*\*(Action|Actions|Recommended Action|Recommended Actions|Note|Summary|Next Steps|Details|Overview):\*\*/gi, '$1:');
  s = s.replace(/\*\*(Action|Actions|Recommended Action|Recommended Actions|Note|Summary|Next Steps|Details|Overview):(?!\*)/gi, '$1:');

  // Fix dangling ** at line ends
  s = s.replace(/\*\*\s*$/gm, '');

  // Balance unmatched ** tags in each paragraph
  const paragraphs = s.split('\n');
  const balanced = paragraphs.map((p) => {
    const starCount = (p.match(/\*\*/g) || []).length;
    if (starCount % 2 !== 0) {
      const lastIdx = p.lastIndexOf('**');
      if (lastIdx !== -1) {
        return p.substring(0, lastIdx) + p.substring(lastIdx + 2);
      }
    }
    return p;
  });

  return balanced.join('\n');
}

interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

interface HeadingBlock {
  type: 'heading';
  level: number;
  text: string;
}

interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

type MarkdownBlock = TableBlock | ListBlock | HeadingBlock | ParagraphBlock;

/**
 * Parses markdown string into block structures (tables, lists, headings, paragraphs).
 */
function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // A. Detect Table (must start/end with | and next line have |---|)
    if (
      trimmed.startsWith('|') &&
      trimmed.endsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('|') &&
      lines[i + 1].includes('---')
    ) {
      const headers = parseTableRow(trimmed);
      i += 2; // Skip header line and delimiter line
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        rows.push(parseTableRow(lines[i].trim()));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // B. Detect Unordered List (- item, * item, • item)
    if (/^[•\-\*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[•\-\*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[•\-\*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // C. Detect Ordered List (1. item, 2. item)
    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[\.\)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[\.\)]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // D. Detect Headings (# Heading, ## Heading)
    if (/^#{1,4}\s+/.test(trimmed)) {
      const match = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: 'heading',
          level: match[1].length,
          text: match[2],
        });
        i++;
        continue;
      }
    }

    // E. Default Paragraph (group continuous lines)
    const paragraphLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('|') &&
      !/^[•\-\*]\s+/.test(lines[i].trim()) &&
      !/^\d+[\.\)]\s+/.test(lines[i].trim()) &&
      !/^#{1,4}\s+/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }

  return blocks;
}

function parseTableRow(rowStr: string): string[] {
  return rowStr
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Render block structure to React Nodes.
 */
function renderBlock(block: MarkdownBlock, key: number): React.ReactNode {
  switch (block.type) {
    case 'table':
      return (
        <div key={key} className="overflow-x-auto my-2 rounded-lg border shadow-2xs" style={{ borderColor: 'var(--c-border-soft)' }}>
          <table className="min-w-full text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b font-semibold" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)', color: 'var(--c-gold)' }}>
                {block.headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 text-left font-bold border-r last:border-r-0" style={{ borderColor: 'var(--c-border-soft)' }}>
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b last:border-b-0 transition" style={{ borderColor: 'var(--c-border-soft)' }}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 border-r last:border-r-0" style={{ borderColor: 'var(--c-border-soft)' }}>
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'list':
      if (block.ordered) {
        return (
          <ol key={key} className="list-decimal list-inside space-y-1 my-1.5 pl-1 font-sans">
            {block.items.map((item, itemIdx) => (
              <li key={itemIdx} className="leading-relaxed">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={key} className="list-disc list-inside space-y-1 my-1.5 pl-1 font-sans">
          {block.items.map((item, itemIdx) => (
            <li key={itemIdx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );

    case 'heading':
      return (
        <h4 key={key} className="font-bold text-sm mt-2 mb-1 font-sans" style={{ color: 'var(--c-gold)' }}>
          {renderInlineMarkdown(block.text)}
        </h4>
      );

    case 'paragraph':
      return (
        <p key={key} className="leading-relaxed whitespace-pre-wrap">
          {renderInlineMarkdown(block.text)}
        </p>
      );
  }
}

/**
 * Safely parses inline formatting (**bold**, *italic*, `code`) into React elements.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match **bold**, *italic*, or `code`
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold" style={{ color: 'var(--c-text)' }}>
          {inner}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className="italic" style={{ color: 'var(--c-text-dim)' }}>
          {inner}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <code key={index} className="px-1.5 py-0.5 rounded font-mono text-[11px]" style={{ background: 'var(--c-surface2)', color: 'var(--c-gold)', border: '1px solid var(--c-border-soft)' }}>
          {inner}
        </code>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
