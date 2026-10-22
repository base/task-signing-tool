import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownTextProps {
  children: string;
}

export function MarkdownText({ children }: MarkdownTextProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--cds-primary)] underline font-medium hover:text-[var(--cds-primary-hover)] break-all"
            onClick={e => e.stopPropagation()}
          />
        ),
        p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0 leading-relaxed" />,
        ul: ({ ...props }) => <ul {...props} className="list-disc list-inside mb-2 space-y-1" />,
        ol: ({ ...props }) => <ol {...props} className="list-decimal list-inside mb-2 space-y-1" />,
        li: ({ ...props }) => <li {...props} className="ml-1" />,
        code: ({ ...props }) => (
          <code
            {...props}
            className="text-[var(--cds-text-primary)] bg-gray-100 px-1 py-0.5 rounded font-mono text-xs"
          />
        ),
        pre: ({ ...props }) => (
          <pre
            {...props}
            className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto my-2 text-xs text-[var(--cds-text-primary)] [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
          />
        ),
      }}
    >
      {children}
    </Markdown>
  );
}
