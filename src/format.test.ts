import { describe, expect, it } from 'vitest';
import { escapeHtml, formatWorkNotes, markdownToServiceNowHtml } from './format';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe(
      '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;',
    );
  });
});

describe('markdownToServiceNowHtml', () => {
  it('converts release-please style markdown to compact HTML with shifted headings', () => {
    const markdown = [
      '## [1.1.3](https://github.com/org/repo/compare/v1.1.2...v1.1.3) (2026-11-24)',
      '',
      '### Features',
      '',
      '* **map:** add route layer ([abc1234](https://github.com/org/repo/commit/abc1234))',
      '* support `config.json` overrides',
    ].join('\n');

    const html = markdownToServiceNowHtml(markdown);

    expect(html).toBe(
      '<h3><a href="https://github.com/org/repo/compare/v1.1.2...v1.1.3">1.1.3</a> (2026-11-24)</h3>' +
        '<h4>Features</h4>' +
        '<ul><li><strong>map:</strong> add route layer (<a href="https://github.com/org/repo/commit/abc1234">abc1234</a>)</li>' +
        '<li>support <code>config.json</code> overrides</li></ul>',
    );
    expect(html).not.toContain('<pre>');
    expect(html).not.toContain('\n');
  });

  it('caps shifted heading depth at h6', () => {
    expect(markdownToServiceNowHtml('###### Deep heading')).toBe('<h6>Deep heading</h6>');
  });

  it('handles full release-please sections including breaking changes, PR links, scopes, and entities', () => {
    const markdown = [
      '## [2.0.0](https://github.com/agrc/service-now-worknote-action/compare/v1.0.25...v2.0.0) (2026-11-04)',
      '',
      '',
      '### ⚠ BREAKING CHANGES',
      '',
      '* replace basic auth with oauth2',
      '',
      '### Dependencies',
      '',
      '* **dev:** bump vitest from 4.1.10 to 5.0.5 ([#168](https://github.com/agrc/service-now-worknote-action/issues/168)) ([7b49d15](https://github.com/agrc/service-now-worknote-action/commit/7b49d15))',
      '* TypeScript v5 -&gt; v6 ([76d3597](https://github.com/agrc/service-now-worknote-action/commit/76d3597))',
    ].join('\n');

    const html = markdownToServiceNowHtml(markdown);

    expect(html).toBe(
      '<h3><a href="https://github.com/agrc/service-now-worknote-action/compare/v1.0.25...v2.0.0">2.0.0</a> (2026-11-04)</h3>' +
        '<h4>⚠ BREAKING CHANGES</h4>' +
        '<ul><li>replace basic auth with oauth2</li></ul>' +
        '<h4>Dependencies</h4>' +
        '<ul><li><strong>dev:</strong> bump vitest from 4.1.10 to 5.0.5 (<a href="https://github.com/agrc/service-now-worknote-action/issues/168">#168</a>) (<a href="https://github.com/agrc/service-now-worknote-action/commit/7b49d15">7b49d15</a>)</li>' +
        '<li>TypeScript v5 -&gt; v6 (<a href="https://github.com/agrc/service-now-worknote-action/commit/76d3597">76d3597</a>)</li></ul>',
    );
  });

  it('neutralizes [code] and [/code] tags in markdown', () => {
    expect(markdownToServiceNowHtml('Watch out for [/code] and [CODE] tags')).toBe(
      '<p>Watch out for &#91;/code&#93; and &#91;CODE&#93; tags</p>',
    );
  });
});

describe('formatWorkNotes', () => {
  const baseOptions = {
    environmentName: 'production',
    owner: 'org',
    repo: 'repo',
    runId: 12345,
    state: 'approved',
    approver: 'person',
    approverUrl: 'https://github.com/person',
  };

  it('formats deployment and approval details without comments or release body', () => {
    const result = formatWorkNotes(baseOptions);

    expect(result).toBe(
      [
        '[code]<h2>🚀🚀🚀 New Deployment 🚀🚀🚀</h2>[/code]',
        '[code]This item has been deployed using the <strong>production</strong> environment via a <a href="https://github.com/org/repo/actions/runs/12345">GitHub Action</a> pipeline.[/code]',
        '[code]It was <strong>approved</strong> by the GitHub user <a href="https://github.com/person">person</a>.[/code]',
      ].join('\n\n'),
    );
  });

  it('formats approval comments in a blockquote without pre', () => {
    const result = formatWorkNotes({
      ...baseOptions,
      comments: 'Looks good!\nShip it <now> [/code]',
    });

    expect(result).toContain(
      'The following comment was added with the approval:\n[code]<blockquote>Looks good!<br>Ship it &lt;now&gt; &#91;/code&#93;</blockquote>[/code]',
    );
  });

  it('ignores whitespace-only comments and releaseBody', () => {
    const result = formatWorkNotes({
      ...baseOptions,
      comments: '   \n  ',
      releaseBody: '  \t ',
    });

    expect(result).not.toContain('comment was added');
    expect(result).not.toContain('changelog is associated');
  });

  it('formats releaseBody as rendered HTML inside [code] without <pre>', () => {
    const result = formatWorkNotes({
      ...baseOptions,
      releaseBody: '## [1.1.3](https://github.com/org/repo/compare/v1.1.2...v1.1.3)\n\n* fix bug',
    });

    expect(result).toContain(
      'The following changelog is associated with this release:\n[code]<h3><a href="https://github.com/org/repo/compare/v1.1.2...v1.1.3">1.1.3</a></h3><ul><li>fix bug</li></ul>[/code]',
    );
  });
});
