import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Link as LinkIcon, List, Pilcrow } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

/**
 * Lightweight HTML editor: textarea with a small toolbar that wraps the
 * current selection with HTML tags. Keeps the source visible/editable.
 */
export function RichTextEditor({ value, onChange, placeholder, rows = 14 }: RichTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (open: string, close: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end) || "texte";
    const after = value.slice(end);
    const next = `${before}${open}${selected}${close}${after}`;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = before.length + open.length + selected.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const insertAtCursor = (text: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + text.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const insertLink = () => {
    const url = prompt("URL du lien :", "https://");
    if (!url) return;
    wrapSelection(`<a href="${url}">`, "</a>");
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
        <Button type="button" variant="ghost" size="sm" onClick={() => wrapSelection("<strong>", "</strong>")} title="Gras">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => wrapSelection("<em>", "</em>")} title="Italique">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={insertLink} title="Lien">
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => insertAtCursor("\n<ul>\n  <li>Élément</li>\n</ul>\n")} title="Liste">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => insertAtCursor("\n<p>Paragraphe</p>\n")} title="Paragraphe">
          <Pilcrow className="h-4 w-4" />
        </Button>
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => insertAtCursor("{{prenom}}")}>{"{{prenom}}"}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => insertAtCursor("{{nom_manager}}")}>{"{{nom_manager}}"}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => insertAtCursor("{{email}}")}>{"{{email}}"}</Button>
        </div>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "<p>Bonjour {{prenom}}...</p>"}
        rows={rows}
        className="border-0 rounded-none font-mono text-sm focus-visible:ring-0"
      />
    </div>
  );
}
