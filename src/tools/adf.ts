// Atlassian Document Format (ADF) utilities
// Rewrite of tools/jira/adf_utils.py

type AdfNode = Record<string, unknown>;

export function extractText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');

  if (typeof node === 'object') {
    const n = node as AdfNode;
    const type = (n['type'] as string) ?? '';
    const text = (n['text'] as string) ?? '';
    const content = (n['content'] as unknown[]) ?? [];

    if (type === 'hardBreak') return '\n';
    if (type === 'bulletList')
      return content.map(item => `- ${extractText(item).trim()}`).join('\n') + '\n';
    if (type === 'orderedList')
      return content.map((item, i) => `${i + 1}. ${extractText(item).trim()}`).join('\n') + '\n';
    if (type === 'listItem')
      return extractText({ type: 'doc', content });
    if (type === 'heading') {
      const level = ((n['attrs'] as AdfNode)?.['level'] as number) ?? 2;
      return `\n${'#'.repeat(level)} ${content.map(c => extractText(c)).join('')}\n`;
    }
    if (type === 'paragraph')
      return content.map(c => extractText(c)).join('') + '\n';
    if (type === 'codeBlock')
      return `\`\`\`\n${content.map(c => extractText(c)).join('')}\n\`\`\`\n`;
    if (type === 'table' || type === 'tableRow')
      return content.map(c => extractText(c)).join('');
    if (type === 'tableCell' || type === 'tableHeader')
      return content.map(c => extractText(c)).join('') + '\t';
    if (type === 'taskList')
      return content.map(c => extractText(c)).join('');
    if (type === 'taskItem')
      return content.map(c => extractText(c)).join('') + '\n';
    if (text) return text;
    return content.map(c => extractText(c)).join('');
  }
  return String(node);
}

export function fieldText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const v = value as AdfNode;
    if (v['type'] === 'doc') return extractText(value).trim();
    return String(v['displayName'] ?? v['name'] ?? v['value'] ?? '');
  }
  return String(value);
}

// ── Markdown → ADF ───────────────────────────────────────────────────────────

function makeId(): string {
  return crypto.randomUUID();
}

function txt(text: string, bold = false): AdfNode {
  const node: AdfNode = { type: 'text', text };
  if (bold) node['marks'] = [{ type: 'strong' }];
  return node;
}

function para(...nodes: AdfNode[]): AdfNode {
  return { type: 'paragraph', content: nodes };
}

function cell(content: AdfNode[]): AdfNode {
  return { type: 'tableCell', attrs: {}, content };
}

function headerCell(label: string): AdfNode {
  return { type: 'tableHeader', attrs: {}, content: [para(txt(label, true))] };
}

function bulletList(items: string[]): AdfNode {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [para(txt(item))],
    })),
  };
}

export function markdownToAdf(text: string): AdfNode {
  const lines = text.split('\n');
  const content: AdfNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      content.push({ type: 'codeBlock', attrs: {}, content: [{ type: 'text', text: codeLines.join('\n') }] });
      i++;
      continue;
    }

    if (line.startsWith('#')) {
      const actualLevel = line.match(/^#+/)?.[0].length ?? 1;
      content.push({
        type: 'heading',
        attrs: { level: Math.min(actualLevel, 6) },
        content: [{ type: 'text', text: line.replace(/^#+\s*/, '') }],
      });
      i++;
      continue;
    }

    if (/^\s*[-*+]\s/.test(line)) {
      const items: AdfNode[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i]!)) {
        items.push({
          type: 'listItem',
          content: [para(txt(lines[i]!.replace(/^\s*[-*+]\s*/, '')))],
        });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const items: AdfNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i]!)) {
        items.push({
          type: 'listItem',
          content: [para(txt(lines[i]!.replace(/^\s*\d+\.\s*/, '')))],
        });
        i++;
      }
      content.push({ type: 'orderedList', content: items });
      continue;
    }

    if (!line.trim()) { i++; continue; }

    content.push(para(txt(line.trim())));
    i++;
  }

  return { version: 1, type: 'doc', content };
}

// ── TC table (tc.md) → ADF table ─────────────────────────────────────────────

export interface TcScenario {
  title: string;
  type: string;
  priority: string;
  given: string[];
  when: string[];
  then: string[];
  tcs: string[];
}

export function parseTcMarkdown(text: string): TcScenario[] {
  const scenarios: TcScenario[] = [];
  let current: TcScenario | null = null;
  let section: 'given' | 'when' | 'then' | 'tc' | null = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    if (line.startsWith('### ')) {
      if (current) scenarios.push(current);
      current = { title: line.replace(/^###\s*/, ''), type: '', priority: 'S', given: [], when: [], then: [], tcs: [] };
      section = null;
      continue;
    }
    if (!current) continue;

    if (line.startsWith('**Type:**')) { current.type = line.slice(9).trim(); continue; }
    if (line.startsWith('**Priority:**')) { current.priority = line.slice(13).trim(); continue; }
    if (line.startsWith('**Given**')) { section = 'given'; const r = line.slice(9).trim(); if (r) current.given.push(r); continue; }
    if (line.startsWith('**When**')) { section = 'when'; const r = line.slice(8).trim(); if (r) current.when.push(r); continue; }
    if (line.startsWith('**Then**')) { section = 'then'; const r = line.slice(8).trim(); if (r) current.then.push(r); continue; }
    if (line.startsWith('**TC') && line.includes(':')) { section = 'tc'; continue; }

    if ((section === 'given' || section === 'when' || section === 'then') && line.startsWith('- '))
      current[section].push(line.slice(2));
    else if (section === 'tc') {
      if (line.startsWith('[+]') || line.startsWith('[-]'))
        current.tcs.push(line);
      else if (line.startsWith('- [+]') || line.startsWith('- [-]'))
        current.tcs.push(line.slice(2));
    }
  }

  if (current) scenarios.push(current);
  return scenarios;
}

export function scenariosToAdfTable(scenarios: TcScenario[]): AdfNode {
  const header: AdfNode = {
    type: 'tableRow',
    content: [
      headerCell('Test Scenario'),
      headerCell('Type'),
      headerCell('Test Case & Evidence'),
      headerCell('Priority'),
      headerCell('Status'),
    ],
  };

  const rows = scenarios.map(s => {
    const scenarioNodes: AdfNode[] = [para(txt(s.title))];
    if (s.given.length) { scenarioNodes.push(para(txt('Given: '))); scenarioNodes.push(bulletList(s.given)); }
    if (s.when.length) { scenarioNodes.push(para(txt('When: '))); scenarioNodes.push(bulletList(s.when)); }
    if (s.then.length) { scenarioNodes.push(para(txt('Then: '))); scenarioNodes.push(bulletList(s.then)); }

    const tcCell: AdfNode = s.tcs.length === 0
      ? cell([para(txt(''))])
      : cell([{
          type: 'taskList',
          attrs: { localId: makeId() },
          content: s.tcs.map(tc => ({
            type: 'taskItem',
            attrs: { localId: makeId(), state: 'TODO' },
            content: [txt(tc)],
          })),
        }]);

    return {
      type: 'tableRow',
      content: [
        cell(scenarioNodes),
        cell([para(txt(s.type))]),
        tcCell,
        cell([para(txt(s.priority))]),
        cell([para(txt(''))]),
      ],
    };
  });

  return {
    version: 1,
    type: 'doc',
    content: [{
      type: 'table',
      attrs: { isNumberColumnEnabled: true, layout: 'default' },
      content: [header, ...rows],
    }],
  };
}
