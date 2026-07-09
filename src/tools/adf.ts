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
    if (type === 'taskItem') {
      const state = ((n['attrs'] as AdfNode)?.['state'] as string) ?? 'TODO';
      const prefix = state === 'DONE' ? '[x] ' : '[ ] ';
      return prefix + content.map(c => extractText(c)).join('') + '\n';
    }
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
//
// One row = one Feature group: a Gherkin block (Feature/Background/Scenarios)
// covering a related theme, paired with a [+]/[-] checklist where each item
// maps 1:1 to one Scenario in the block.

export interface TcGroup {
  gherkin: string;
  tcs: string[];
}

export function parseTcMarkdown(text: string): TcGroup[] {
  const groups: TcGroup[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    if (!/^###\s/.test(lines[i]!.trim())) { i++; continue; }
    i++;

    while (i < lines.length && !lines[i]!.trim().startsWith('```')) i++;
    if (i >= lines.length) break;
    i++;

    const gherkinLines: string[] = [];
    while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
      gherkinLines.push(lines[i]!);
      i++;
    }
    i++;

    const tcs: string[] = [];
    while (i < lines.length && !/^###\s/.test(lines[i]!.trim())) {
      const line = lines[i]!.trim();
      if (line.startsWith('[+]') || line.startsWith('[-]')) tcs.push(line);
      else if (line.startsWith('- [+]') || line.startsWith('- [-]')) tcs.push(line.slice(2));
      i++;
    }

    const gherkin = gherkinLines.join('\n').trim();
    if (gherkin) groups.push({ gherkin, tcs });
  }

  return groups;
}

export function scenariosToAdfTable(groups: TcGroup[]): AdfNode {
  const header: AdfNode = {
    type: 'tableRow',
    content: [
      headerCell('Test Scenario'),
      headerCell('Evidence'),
      headerCell('Status'),
    ],
  };

  const rows = groups.map(g => {
    const scenarioCell = cell([
      { type: 'codeBlock', attrs: { language: 'gherkin' }, content: [{ type: 'text', text: g.gherkin }] },
    ]);

    const tcCell: AdfNode = g.tcs.length === 0
      ? cell([para(txt(''))])
      : cell([{
          type: 'orderedList',
          content: g.tcs.map(tc => ({
            type: 'listItem',
            content: [para(txt(tc))],
          })),
        }]);

    return {
      type: 'tableRow',
      content: [scenarioCell, tcCell, cell([para(txt(''))])],
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
