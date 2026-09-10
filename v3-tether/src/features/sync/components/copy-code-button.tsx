"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const COPIED_LABEL_MS = 1500;

export const CopyCodeButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      onClick={() => {
        void navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), COPIED_LABEL_MS);
        });
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {copied ? (
        <>
          <Check className="size-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          Copy code
        </>
      )}
    </Button>
  );
};
