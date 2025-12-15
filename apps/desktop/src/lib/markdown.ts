/**
 * Simple markdown parser for preview
 * Supports: headers, bold, italic, code, links, lists, blockquotes
 */

export function parseMarkdown(text: string): string {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks (before other processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const highlighted = highlightCode(code, lang);
    return `<pre class="code-block${lang ? ' language-' + lang : ''}"><code>${highlighted}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers with IDs for anchor links and sticky support
  const slugify = (text: string) => text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  html = html.replace(/^######\s+(.*)$/gm, (_, text) => `<h6 id="${slugify(text)}" class="sticky-heading">${text}</h6>`);
  html = html.replace(/^#####\s+(.*)$/gm, (_, text) => `<h5 id="${slugify(text)}" class="sticky-heading">${text}</h5>`);
  html = html.replace(/^####\s+(.*)$/gm, (_, text) => `<h4 id="${slugify(text)}" class="sticky-heading">${text}</h4>`);
  html = html.replace(/^###\s+(.*)$/gm, (_, text) => `<h3 id="${slugify(text)}" class="sticky-heading">${text}</h3>`);
  html = html.replace(/^##\s+(.*)$/gm, (_, text) => `<h2 id="${slugify(text)}" class="sticky-heading">${text}</h2>`);
  html = html.replace(/^#\s+(.*)$/gm, (_, text) => `<h1 id="${slugify(text)}" class="sticky-heading">${text}</h1>`);

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Wiki-style note links [[note title]]
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<a href="#" class="note-link" data-note-title="$1">$1</a>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Blockquotes
  html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');

  // Tables (simple support)
  html = parseMarkdownTables(html);

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');
  html = html.replace(/^\*\*\*$/gm, '<hr />');

  // Unordered lists
  html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');

  // Task lists
  html = html.replace(/<li>\[\s\]\s*(.*)<\/li>/g, '<li class="task"><input type="checkbox" disabled /> $1</li>');
  html = html.replace(/<li>\[x\]\s*(.*)<\/li>/gi, '<li class="task"><input type="checkbox" checked disabled /> $1</li>');

  // Paragraphs (lines not already wrapped)
  html = html.replace(/^(?!<[a-z])(.*?)$/gm, (match, content) => {
    if (content.trim() === '') return '';
    return `<p>${content}</p>`;
  });

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  // Line breaks
  html = html.replace(/\n\n/g, '\n');

  return html;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };
  return text.replace(/[&<>]/g, (char) => map[char] || char);
}

/**
 * Parse markdown tables
 */
function parseMarkdownTables(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is a table row (contains | at start or end)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Check if this is the separator row (|----|)
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        // Skip separator row, it marks the header
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }

      // Parse cells
      const cells = line
        .split('|')
        .slice(1, -1) // Remove empty first and last from split
        .map(cell => cell.trim());

      tableRows.push(cells.join('|'));
    } else {
      // If we were in a table, close it
      if (inTable && tableRows.length > 0) {
        result.push(renderTable(tableRows));
        inTable = false;
        tableRows = [];
      }
      result.push(line);
    }
  }

  // Close any remaining table
  if (inTable && tableRows.length > 0) {
    result.push(renderTable(tableRows));
  }

  return result.join('\n');
}

function renderTable(rows: string[]): string {
  if (rows.length === 0) return '';

  let tableHtml = '<table class="md-table">';

  // First row is header
  if (rows.length > 0) {
    const headerCells = rows[0].split('|');
    tableHtml += '<thead><tr>';
    for (const cell of headerCells) {
      tableHtml += `<th>${cell.trim()}</th>`;
    }
    tableHtml += '</tr></thead>';
  }

  // Rest are body rows
  if (rows.length > 1) {
    tableHtml += '<tbody>';
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split('|');
      tableHtml += '<tr>';
      for (const cell of cells) {
        tableHtml += `<td>${cell.trim()}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody>';
  }

  tableHtml += '</table>';
  return tableHtml;
}

/**
 * Basic syntax highlighting for code blocks
 */
function highlightCode(code: string, lang: string): string {
  // Common keywords for different languages
  const keywords: Record<string, string[]> = {
    js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'default', 'switch', 'case', 'break', 'continue'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'default', 'switch', 'case', 'break', 'continue'],
    ts: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'extends', 'public', 'private', 'protected', 'readonly'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'extends', 'public', 'private', 'protected', 'readonly'],
    rust: ['fn', 'let', 'mut', 'const', 'if', 'else', 'for', 'while', 'loop', 'match', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'self', 'Self', 'return', 'async', 'await', 'move', 'ref', 'where', 'type', 'dyn', 'static', 'unsafe'],
    python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'raise', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'lambda', 'True', 'False', 'None', 'async', 'await'],
    py: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'raise', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'lambda', 'True', 'False', 'None', 'async', 'await'],
    go: ['func', 'var', 'const', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'return', 'package', 'import', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'break', 'continue', 'fallthrough'],
    sql: ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'NULL', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN'],
  };

  const langKeywords = keywords[lang.toLowerCase()] || [];

  let result = code;

  // Highlight strings (single and double quotes)
  result = result.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span class="hl-string">$&</span>');

  // Highlight comments (// and #)
  result = result.replace(/(\/\/.*$|#.*$)/gm, '<span class="hl-comment">$&</span>');

  // Highlight numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');

  // Highlight keywords
  if (langKeywords.length > 0) {
    const keywordPattern = new RegExp(`\\b(${langKeywords.join('|')})\\b`, 'g');
    result = result.replace(keywordPattern, '<span class="hl-keyword">$1</span>');
  }

  // Highlight function calls (word followed by parenthesis)
  result = result.replace(/\b([a-zA-Z_]\w*)\s*\(/g, '<span class="hl-function">$1</span>(');

  return result;
}

/**
 * Simple fuzzy matching function
 * Returns a score (higher is better match) or 0 if no match
 */
export function fuzzyMatch(text: string, query: string): number {
  if (!query) return 1;
  if (!text) return 0;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) return 100;

  // Contains match
  if (textLower.includes(queryLower)) {
    // Prefer matches at the start
    const index = textLower.indexOf(queryLower);
    return 80 - (index * 0.5);
  }

  // Fuzzy match: check if all query characters appear in order
  let queryIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
      consecutiveMatches++;
      // Bonus for consecutive matches
      score += consecutiveMatches * 2;
      // Bonus for matching at word boundaries
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-' || text[i - 1] === '_') {
        score += 5;
      }
    } else {
      consecutiveMatches = 0;
    }
  }

  // Only return score if all query characters were found
  if (queryIndex === queryLower.length) {
    return Math.max(1, score);
  }

  return 0;
}

/**
 * Get word count from text
 */
export function getWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Get character count from text
 */
export function getCharCount(text: string): number {
  return text.length;
}

/**
 * Estimate reading time in minutes
 */
export function getReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = getWordCount(text);
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Extract all wiki-style links [[title]] from text
 */
export function extractNoteLinks(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];
  return matches.map(m => m.slice(2, -2).toLowerCase());
}

/**
 * Heading item for table of contents
 */
export interface HeadingItem {
  level: number;
  text: string;
  line: number;
}

/**
 * Extract all headings from markdown text for table of contents
 */
export function extractHeadings(text: string): HeadingItem[] {
  if (!text) return [];

  const headings: HeadingItem[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return headings;
}
