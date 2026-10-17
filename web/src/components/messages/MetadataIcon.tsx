import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function MetadataIcon({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={text}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">{text}</TooltipContent>
    </Tooltip>
  );
}
