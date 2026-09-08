import { useEffect, useRef } from 'react';
import { attachComponentData, getComponentData } from '@backstage/core-plugin-api';
import { EntityGithubActionsContent } from '@backstage/plugin-github-actions';

// The GitHub Actions tab's workflow-runs table renders the full,
// potentially multi-paragraph commit message directly into a table cell
// with no truncation, blowing out row height. The plugin exposes no
// prop/class hook for that specific column, and its cell carries
// material-table's own inline style (width, color, font-weight), which
// beats anything set via the app theme's CSS - only inline styles set
// after the fact can win. So this wraps the tab's content in a container
// we can find cells inside, and truncates/styles them directly in JS.
const MESSAGE_CELL_SELECTOR = 'table tbody tr td:nth-child(2)';
const TITLE_MAX_LENGTH = 200;
const TEXT_MAX_LENGTH = 80;
// Marks a cell with the truncated text we last wrote to it, so a mutation
// callback triggered by our own edit (rather than a React re-render
// restoring the full original message) is recognized and skipped instead
// of reprocessing - and, since it's derived from live content rather than
// a boolean flag, a later re-render that puts fresh text back in is still
// detected and reprocessed.
const PROCESSED_ATTR = 'data-idp-clamped-text';

export const GITHUB_ACTIONS_MESSAGE_CLAMP_CLASS = 'idp-github-actions-message-clamp';

function firstLineOf(text: string): string {
  const [line] = text.split(/\r?\n/);
  return line.trim();
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function clampMessageCell(cell: HTMLElement) {
  const anchor = cell.querySelector('a');
  if (!anchor) {
    return;
  }

  const currentText = anchor.textContent ?? '';
  if (cell.getAttribute(PROCESSED_ATTR) === currentText) {
    // Already clamped and untouched since - a mutation from our own edit,
    // not a fresh React render. Nothing to do.
    return;
  }

  const firstLine = firstLineOf(currentText);
  const clampedText = truncate(firstLine, TEXT_MAX_LENGTH);

  anchor.textContent = clampedText;
  cell.title = firstLine.slice(0, TITLE_MAX_LENGTH);
  cell.style.whiteSpace = 'nowrap';
  cell.style.overflow = 'hidden';
  cell.style.textOverflow = 'ellipsis';
  cell.style.maxWidth = '360px';
  cell.setAttribute(PROCESSED_ATTR, clampedText);
}

function GithubActionsMessageClamp() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const clampAll = () => {
      container
        .querySelectorAll<HTMLElement>(MESSAGE_CELL_SELECTOR)
        .forEach(clampMessageCell);
    };

    clampAll();
    const observer = new MutationObserver(clampAll);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={GITHUB_ACTIONS_MESSAGE_CLAMP_CLASS} ref={containerRef}>
      <EntityGithubActionsContent />
    </div>
  );
}

// convertLegacyEntityContentExtension() requires its argument to carry the
// componentData that createRoutableExtension() attaches (core.extensionName,
// core.mountPoint, core.plugin) - copy it over from the real extension onto
// this wrapper so it's still recognized as a valid legacy entity content
// extension, and its route ref keeps working.
const originalElement = <EntityGithubActionsContent />;
for (const key of ['core.extensionName', 'core.mountPoint', 'core.plugin']) {
  const value = getComponentData(originalElement, key);
  if (value !== undefined) {
    attachComponentData(GithubActionsMessageClamp, key, value);
  }
}

export { GithubActionsMessageClamp };
