import { Marked } from 'marked';

export interface WorkNoteOptions {
  environmentName: string;
  owner: string;
  repo: string;
  runId: number;
  state: string;
  approver: string;
  approverUrl: string;
  comments?: string | null;
  releaseBody?: string | null;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes HTML special characters in plain text.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

/**
 * Neutralizes literal `[code]` and `[/code]` tags so user content cannot break
 * out of a ServiceNow `[code]...[/code]` block.
 */
function sanitizeServiceNowCodeTag(text: string): string {
  return text.replace(/\[(\/?code)\]/gi, '&#91;$1&#93;');
}

const markedInstance = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Shift headings down one level so changelog sections sit below the main <h2> banner.
    heading({ tokens, depth }) {
      const level = Math.min(depth + 1, 6);
      const text = this.parser.parseInline(tokens);

      return `<h${level}>${text}</h${level}>`;
    },
  },
});

/**
 * Converts a Markdown changelog into compact HTML suitable for ServiceNow `[code]` blocks.
 */
export function markdownToServiceNowHtml(markdown: string): string {
  const html = markedInstance.parse(markdown, { async: false });
  const compact = html.replace(/>\s*\n\s*</g, '><').trim();

  return sanitizeServiceNowCodeTag(compact);
}

/**
 * Formats the ServiceNow `work_notes` payload for a deployment approval.
 */
export function formatWorkNotes(options: WorkNoteOptions): string {
  const { environmentName, owner, repo, runId, state, approver, approverUrl, comments, releaseBody } = options;

  const sections: string[] = [
    `[code]<h2>🚀🚀🚀 New Deployment 🚀🚀🚀</h2>[/code]`,
    `[code]This item has been deployed using the <strong>${escapeHtml(environmentName)}</strong> environment via a <a href="https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}">GitHub Action</a> pipeline.[/code]`,
    `[code]It was <strong>${escapeHtml(state)}</strong> by the GitHub user <a href="${escapeHtml(approverUrl)}">${escapeHtml(approver)}</a>.[/code]`,
  ];

  const trimmedComments = comments?.trim();
  if (trimmedComments) {
    const formattedComments = sanitizeServiceNowCodeTag(escapeHtml(trimmedComments)).replace(/\r?\n/g, '<br>');
    sections.push(
      `The following comment was added with the approval:\n[code]<blockquote>${formattedComments}</blockquote>[/code]`,
    );
  }

  const trimmedReleaseBody = releaseBody?.trim();
  if (trimmedReleaseBody) {
    sections.push(
      `The following changelog is associated with this release:\n[code]${markdownToServiceNowHtml(trimmedReleaseBody)}[/code]`,
    );
  }

  return sections.join('\n\n');
}
