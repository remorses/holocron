import { cn } from "website/src/lib/utils";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "website/src/components/ui/tooltip";
import {
  RiCodeSSlashLine,
  RiBookLine,
  RiLoopRightFill,
  RiCheckLine,
} from "@remixicon/react";
import { UIMessage } from "ai";
import { memo } from "react";
import { Markdown } from "./ui/markdown";

type ChatMessageProps = {
  message: UIMessage;
  children?: React.ReactNode;
};

export const ChatMessage = memo(function ChatMessage({
  message,
  children,
}: ChatMessageProps) {
  console.log(`rendering message ${message.id}`);
  return (
    <article
      className={cn(
        "flex items-start gap-4 text-[15px] leading-relaxed",
        message.role === "user" && "justify-end",
      )}
    >
      <div
        className={cn(
          message.role === "user"
            ? "bg-muted px-4 py-3 rounded-xl"
            : "space-y-4",
        )}
      >
        <div className=" prose ">
          <p className="sr-only">
            {message.role === "user" ? "You" : "Bart"} said:
          </p>
          {message.parts.map((part, index) => {
            if (part.type === "tool-invocation") {
              return (
                <pre key={index}>
                  {JSON.stringify(part.toolInvocation, null, 2)}
                </pre>
              );
            }

            if (part.type === "text") {
              if (message.role === "user") {
                return part.text;
              }
              return <Markdown key={index}>{part.text}</Markdown>;
            }

            if (part.type === "reasoning") {
              return (
                <Markdown className="opacity-70" key={index}>
                  {"thinking:" + part.reasoning}
                </Markdown>
              );
            }
          })}
        </div>
        {message.role !== "user" && <MessageActions />}
      </div>
    </article>
  );
});

type ActionButtonProps = {
  icon: React.ReactNode;
  label: string;
};

const ActionButton = memo(function ActionButton({
  icon,
  label,
}: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="relative text-muted-foreground/80 hover:text-foreground transition-colors size-8 flex items-center justify-center before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-border first:before:hidden first-of-type:rounded-s-lg last-of-type:rounded-e-lg focus-visible:z-10 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring/70">
          {icon}
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="dark px-2 py-1 text-xs">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
});

const MessageActions = memo(function MessageActions() {
  return (
    <div className="relative inline-flex bg-white rounded-md border border-black/[0.08] shadow-sm -space-x-px">
      <TooltipProvider delayDuration={0}>
        <ActionButton icon={<RiCodeSSlashLine size={16} />} label="Show code" />
        <ActionButton icon={<RiBookLine size={16} />} label="Bookmark" />
        <ActionButton icon={<RiLoopRightFill size={16} />} label="Refresh" />
        <ActionButton icon={<RiCheckLine size={16} />} label="Approve" />
      </TooltipProvider>
    </div>
  );
});
