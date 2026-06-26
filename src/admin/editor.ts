/**
 * Markdown editor wrapper around EasyMDE.
 *
 * Loads EasyMDE from CDN if not already present, then configures it
 * with a curated toolbar, word-count status bar, and a save callback.
 */

/* ------------------------------------------------------------------ */
/*  Types (minimal — avoids a hard dep on @types/easymde)              */
/* ------------------------------------------------------------------ */

interface EasyMDEInstance {
  value(): string;
  value(text: string): void;
  toTextArea(): void;
  codemirror: {
    on(event: string, handler: () => void): void;
  };
  cleanup(): void;
}

interface EasyMDEOptions {
  element: HTMLElement;
  initialValue?: string;
  spellChecker?: boolean;
  status?: Array<string | boolean>;
  toolbar?: Array<string | object>;
  previewRender?: (plainText: string) => string;
  sideBySideFullscreen?: boolean;
  minHeight?: string;
  renderingConfig?: { codeSyntaxHighlighting?: boolean };
}

declare class EasyMDEConstructor {
  constructor(options: EasyMDEOptions);
  value(): string;
  value(text: string): void;
  toTextArea(): void;
  codemirror: { on(event: string, handler: () => void): void };
  cleanup(): void;
}

declare global {
  interface Window {
    EasyMDE: typeof EasyMDEConstructor | undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  CDN loader                                                         */
/* ------------------------------------------------------------------ */

const EASYMDE_CSS = 'https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css';
const EASYMDE_JS = 'https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js';

let loadPromise: Promise<void> | null = null;

function loadEasyMDE(): Promise<void> {
  if (window.EasyMDE) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = EASYMDE_CSS;
    document.head.appendChild(link);

    // JS
    const script = document.createElement('script');
    script.src = EASYMDE_JS;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load EasyMDE from CDN.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create an EasyMDE editor instance inside the given container.
 * Calls `onSave` with the current content when Ctrl+S / Cmd+S is pressed.
 */
export async function createEditor(
  container: HTMLElement,
  onSave: (content: string) => void,
): Promise<EasyMDEInstance> {
  await loadEasyMDE();

  const textarea = document.createElement('textarea');
  container.appendChild(textarea);

  const EasyMDE = window.EasyMDE!;

  const mde = new EasyMDE({
    element: textarea,
    spellChecker: false,
    status: ['words'],
    minHeight: '300px',
    sideBySideFullscreen: false,
    renderingConfig: {
      codeSyntaxHighlighting: false,
    },
    toolbar: [
      'bold',
      'italic',
      'heading',
      '|',
      'unordered-list',
      'ordered-list',
      '|',
      'link',
      '|',
      'preview',
      'side-by-side',
      '|',
      'guide',
    ],
    previewRender: (plainText: string) => {
      // Use a simple markdown-to-html render for preview.
      // The actual chat uses the server's component library, but for
      // authoring the stock preview is sufficient.
      return (EasyMDE as any).prototype.parent?.previewRender?.(plainText)
        ?? simpleMarkdownToHtml(plainText);
    },
  });

  // Ctrl+S / Cmd+S to save
  mde.codemirror.on('keydown', () => {
    const cm = (mde as any).codemirror;
    cm.on('keydown', (_instance: unknown, event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        onSave(mde.value());
      }
    });
  });

  return mde as unknown as EasyMDEInstance;
}

/** Replace the editor content. */
export function setEditorContent(editor: EasyMDEInstance, content: string): void {
  editor.value(content);
}

/** Get the current editor content. */
export function getEditorContent(editor: EasyMDEInstance): string {
  return editor.value();
}

/* ------------------------------------------------------------------ */
/*  Simple markdown-to-HTML (for preview pane)                         */
/* ------------------------------------------------------------------ */

function simpleMarkdownToHtml(md: string): string {
  let html = md;

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}
