/**
 * Quick snippets for fast content insertion
 * Triggered by typing / followed by the snippet name
 * Supports custom user snippets and dynamic variables
 */

export interface Snippet {
  name: string;
  description: string;
  icon: string;
  template: string | (() => string);
  isCustom?: boolean;
  category?: string;
}

export interface CustomSnippet {
  id: string;
  name: string;
  description: string;
  icon: string;
  template: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

const CUSTOM_SNIPPETS_KEY = 'viny-custom-snippets';

// Dynamic variable placeholders
export const snippetVariables = {
  '{{date}}': () => new Date().toISOString().split('T')[0],
  '{{date:long}}': () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  '{{date:short}}': () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  '{{time}}': () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  '{{time:24}}': () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  '{{datetime}}': () => new Date().toLocaleString(),
  '{{timestamp}}': () => new Date().toISOString(),
  '{{year}}': () => new Date().getFullYear().toString(),
  '{{month}}': () => (new Date().getMonth() + 1).toString().padStart(2, '0'),
  '{{day}}': () => new Date().getDate().toString().padStart(2, '0'),
  '{{weekday}}': () => new Date().toLocaleDateString('en-US', { weekday: 'long' }),
  '{{week}}': () => getWeekNumber().toString(),
  '{{uuid}}': () => crypto.randomUUID(),
  '{{random}}': () => Math.random().toString(36).substring(2, 8),
};

function getWeekNumber(): number {
  const date = new Date();
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Process template with dynamic variables
export function processTemplate(template: string): string {
  let result = template;
  for (const [placeholder, getValue] of Object.entries(snippetVariables)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), getValue());
  }
  return result;
}

export const snippets: Snippet[] = [
  // Date & Time
  {
    name: 'today',
    description: 'Insert today\'s date',
    icon: '📅',
    template: () => new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
  },
  {
    name: 'date',
    description: 'Insert date (YYYY-MM-DD)',
    icon: '📆',
    template: () => new Date().toISOString().split('T')[0],
  },
  {
    name: 'time',
    description: 'Insert current time',
    icon: '🕐',
    template: () => new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
  },
  {
    name: 'datetime',
    description: 'Insert date and time',
    icon: '📅',
    template: () => new Date().toLocaleString(),
  },
  {
    name: 'timestamp',
    description: 'Insert ISO timestamp',
    icon: '⏱️',
    template: () => new Date().toISOString(),
  },

  // Callouts & Blocks
  {
    name: 'note',
    description: 'Note callout',
    icon: '📝',
    template: '> **Note:** ',
  },
  {
    name: 'tip',
    description: 'Tip callout',
    icon: '💡',
    template: '> **Tip:** ',
  },
  {
    name: 'warning',
    description: 'Warning callout',
    icon: '⚠️',
    template: '> **Warning:** ',
  },
  {
    name: 'important',
    description: 'Important callout',
    icon: '❗',
    template: '> **Important:** ',
  },
  {
    name: 'question',
    description: 'Question callout',
    icon: '❓',
    template: '> **Question:** ',
  },

  // Code blocks
  {
    name: 'code',
    description: 'Code block',
    icon: '💻',
    template: '```\n\n```',
  },
  {
    name: 'js',
    description: 'JavaScript code block',
    icon: '🟨',
    template: '```javascript\n\n```',
  },
  {
    name: 'ts',
    description: 'TypeScript code block',
    icon: '🔷',
    template: '```typescript\n\n```',
  },
  {
    name: 'python',
    description: 'Python code block',
    icon: '🐍',
    template: '```python\n\n```',
  },
  {
    name: 'bash',
    description: 'Bash code block',
    icon: '🖥️',
    template: '```bash\n\n```',
  },
  {
    name: 'sql',
    description: 'SQL code block',
    icon: '🗃️',
    template: '```sql\n\n```',
  },

  // Lists & Tasks
  {
    name: 'task',
    description: 'Task list',
    icon: '☑️',
    template: '- [ ] ',
  },
  {
    name: 'tasks',
    description: 'Multiple tasks',
    icon: '📋',
    template: '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3',
  },
  {
    name: 'bullet',
    description: 'Bullet list',
    icon: '•',
    template: '- Item 1\n- Item 2\n- Item 3',
  },
  {
    name: 'numbered',
    description: 'Numbered list',
    icon: '1️⃣',
    template: '1. First\n2. Second\n3. Third',
  },

  // Tables
  {
    name: 'table',
    description: 'Simple table',
    icon: '📊',
    template: '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |',
  },
  {
    name: 'table2',
    description: '2-column table',
    icon: '📊',
    template: '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |',
  },

  // Templates
  {
    name: 'meeting',
    description: 'Meeting notes template',
    icon: '🤝',
    template: `## Meeting Notes

**Date:** ${new Date().toLocaleDateString()}
**Attendees:**

### Agenda
-

### Discussion
-

### Action Items
- [ ]

### Next Steps
- `,
  },
  {
    name: 'daily',
    description: 'Daily note template',
    icon: '📓',
    template: () => `## ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

### Goals for Today
- [ ]

### Notes


### Wins


### Tomorrow
- `,
  },
  {
    name: 'weekly',
    description: 'Weekly review template',
    icon: '📅',
    template: `## Weekly Review

### Accomplishments
-

### Challenges
-

### Learnings
-

### Next Week Goals
- [ ]

### Notes
`,
  },
  {
    name: 'project',
    description: 'Project template',
    icon: '🚀',
    template: `## Project:

### Overview


### Goals
-

### Timeline
| Phase | Start | End | Status |
|-------|-------|-----|--------|
| Phase 1 | | | |

### Tasks
- [ ]

### Resources
-

### Notes
`,
  },

  // Misc
  {
    name: 'hr',
    description: 'Horizontal rule',
    icon: '➖',
    template: '\n---\n',
  },
  {
    name: 'toc',
    description: 'Table of contents placeholder',
    icon: '📑',
    template: '## Table of Contents\n\n[TOC]\n',
  },
  {
    name: 'link',
    description: 'Link template',
    icon: '🔗',
    template: '[text](url)',
  },
  {
    name: 'image',
    description: 'Image template',
    icon: '🖼️',
    template: '![alt text](url)',
  },
  {
    name: 'footnote',
    description: 'Footnote',
    icon: '📌',
    template: '[^1]\n\n[^1]: ',
  },
];

// Custom snippets management
function loadCustomSnippets(): CustomSnippet[] {
  try {
    const stored = localStorage.getItem(CUSTOM_SNIPPETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCustomSnippets(customSnippets: CustomSnippet[]): void {
  localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(customSnippets));
}

export function getCustomSnippets(): CustomSnippet[] {
  return loadCustomSnippets();
}

export function addCustomSnippet(snippet: Omit<CustomSnippet, 'id' | 'createdAt' | 'updatedAt'>): CustomSnippet {
  const customSnippets = loadCustomSnippets();
  const newSnippet: CustomSnippet = {
    ...snippet,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  customSnippets.push(newSnippet);
  saveCustomSnippets(customSnippets);
  return newSnippet;
}

export function updateCustomSnippet(id: string, updates: Partial<Omit<CustomSnippet, 'id' | 'createdAt'>>): CustomSnippet | null {
  const customSnippets = loadCustomSnippets();
  const index = customSnippets.findIndex(s => s.id === id);
  if (index === -1) return null;

  customSnippets[index] = {
    ...customSnippets[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveCustomSnippets(customSnippets);
  return customSnippets[index];
}

export function deleteCustomSnippet(id: string): boolean {
  const customSnippets = loadCustomSnippets();
  const index = customSnippets.findIndex(s => s.id === id);
  if (index === -1) return false;

  customSnippets.splice(index, 1);
  saveCustomSnippets(customSnippets);
  return true;
}

export function exportCustomSnippets(): string {
  const customSnippets = loadCustomSnippets();
  return JSON.stringify(customSnippets, null, 2);
}

export function importCustomSnippets(json: string): number {
  try {
    const imported = JSON.parse(json) as CustomSnippet[];
    if (!Array.isArray(imported)) throw new Error('Invalid format');

    const customSnippets = loadCustomSnippets();
    let count = 0;

    for (const snippet of imported) {
      if (snippet.name && snippet.template) {
        customSnippets.push({
          ...snippet,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        count++;
      }
    }

    saveCustomSnippets(customSnippets);
    return count;
  } catch {
    return 0;
  }
}

// Get all snippets (built-in + custom)
export function getAllSnippets(): Snippet[] {
  const customSnippets = loadCustomSnippets();
  const customAsSnippets: Snippet[] = customSnippets.map(cs => ({
    name: cs.name,
    description: cs.description,
    icon: cs.icon,
    template: cs.template,
    isCustom: true,
    category: cs.category,
  }));

  return [...customAsSnippets, ...snippets];
}

/**
 * Search snippets by name (includes custom snippets)
 */
export function searchSnippets(query: string, limit: number = 8): Snippet[] {
  const allSnippets = getAllSnippets();

  if (!query) return allSnippets.slice(0, limit);

  const queryLower = query.toLowerCase();
  return allSnippets
    .filter(s =>
      s.name.toLowerCase().includes(queryLower) ||
      s.description.toLowerCase().includes(queryLower)
    )
    .slice(0, limit);
}

/**
 * Get snippet content (resolves function templates and processes variables)
 */
export function getSnippetContent(snippet: Snippet): string {
  const raw = typeof snippet.template === 'function'
    ? snippet.template()
    : snippet.template;

  // Process dynamic variables for custom snippets
  if (snippet.isCustom) {
    return processTemplate(raw);
  }

  return raw;
}

// Snippet categories
export const snippetCategories = [
  { id: 'date-time', name: 'Date & Time', icon: '📅' },
  { id: 'callouts', name: 'Callouts', icon: '💬' },
  { id: 'code', name: 'Code', icon: '💻' },
  { id: 'lists', name: 'Lists & Tasks', icon: '📋' },
  { id: 'tables', name: 'Tables', icon: '📊' },
  { id: 'templates', name: 'Templates', icon: '📝' },
  { id: 'misc', name: 'Miscellaneous', icon: '🔧' },
  { id: 'custom', name: 'Custom', icon: '⭐' },
];

// Get available variable placeholders for documentation
export function getAvailableVariables(): { placeholder: string; description: string; example: string }[] {
  return [
    { placeholder: '{{date}}', description: 'Date (YYYY-MM-DD)', example: snippetVariables['{{date}}']() },
    { placeholder: '{{date:long}}', description: 'Full date', example: snippetVariables['{{date:long}}']() },
    { placeholder: '{{date:short}}', description: 'Short date', example: snippetVariables['{{date:short}}']() },
    { placeholder: '{{time}}', description: 'Current time (12h)', example: snippetVariables['{{time}}']() },
    { placeholder: '{{time:24}}', description: 'Current time (24h)', example: snippetVariables['{{time:24}}']() },
    { placeholder: '{{datetime}}', description: 'Date and time', example: snippetVariables['{{datetime}}']() },
    { placeholder: '{{timestamp}}', description: 'ISO timestamp', example: snippetVariables['{{timestamp}}']() },
    { placeholder: '{{year}}', description: 'Current year', example: snippetVariables['{{year}}']() },
    { placeholder: '{{month}}', description: 'Current month (01-12)', example: snippetVariables['{{month}}']() },
    { placeholder: '{{day}}', description: 'Current day (01-31)', example: snippetVariables['{{day}}']() },
    { placeholder: '{{weekday}}', description: 'Day of week', example: snippetVariables['{{weekday}}']() },
    { placeholder: '{{week}}', description: 'Week number', example: snippetVariables['{{week}}']() },
    { placeholder: '{{uuid}}', description: 'Random UUID', example: 'xxxxxxxx-xxxx-...' },
    { placeholder: '{{random}}', description: 'Random string', example: 'abc123' },
  ];
}
