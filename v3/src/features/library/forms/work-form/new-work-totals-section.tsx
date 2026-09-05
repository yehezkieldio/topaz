import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The optional current-chapter/chapter-count/word-count inputs on the create
 * form -- plain local state, not TanStack Form fields, since they're
 * submitted as raw FormData for createWorkAction to seed the first reading
 * observation with (see work-form.tsx).
 */
export const NewWorkTotalsSection = ({
  chapterCount,
  currentChapter,
  onChapterCountChange,
  onCurrentChapterChange,
  onWordCountChange,
  wordCount,
}: {
  currentChapter: string;
  chapterCount: string;
  wordCount: string;
  onCurrentChapterChange: (value: string) => void;
  onChapterCountChange: (value: string) => void;
  onWordCountChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-3 rounded-md border p-3">
    <div>
      <p className="text-sm font-medium">Progress &amp; totals</p>
      <p className="text-muted-foreground text-xs">
        Optional -- fill these in now to skip editing the entry afterward.
      </p>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentChapter">Current chapter</Label>
        <Input
          className="no-spinner rounded-md"
          id="currentChapter"
          inputMode="numeric"
          name="currentChapter"
          onChange={(event) => onCurrentChapterChange(event.target.value)}
          type="number"
          value={currentChapter}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="chapterCount">Chapters</Label>
        <Input
          className="no-spinner rounded-md"
          id="chapterCount"
          inputMode="numeric"
          name="chapterCount"
          onChange={(event) => onChapterCountChange(event.target.value)}
          type="number"
          value={chapterCount}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="wordCount">Words</Label>
        <Input
          className="no-spinner rounded-md"
          id="wordCount"
          inputMode="numeric"
          name="wordCount"
          onChange={(event) => onWordCountChange(event.target.value)}
          type="number"
          value={wordCount}
        />
      </div>
    </div>
  </div>
);
