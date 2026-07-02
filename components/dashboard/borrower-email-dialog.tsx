"use client";

import { useEffect, useId, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/errors";
import { ConfirmDialog } from "./confirm-dialog";

const MAX_MESSAGE_LENGTH = 4000;

interface BorrowerEmailDialogProps {
  open: boolean;
  onClose: () => void;
  borrowerId: Id<"userProfiles">;
  borrowerName: string;
  loanId?: Id<"loans">;
  drawRequestId?: Id<"drawRequests">;
  contextLabel: string;
  contextDescription?: string;
}

export function BorrowerEmailDialog({
  open,
  onClose,
  borrowerId,
  borrowerName,
  loanId,
  drawRequestId,
  contextLabel,
  contextDescription,
}: BorrowerEmailDialogProps) {
  const messageId = useId();
  const helperId = useId();
  const errorId = useId();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendMessage = useMutation(api.messages.sendMessage);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setError(null);
  }, [borrowerId, drawRequestId, loanId, open]);

  const handleSend = async () => {
    const content = message.trim();
    if (!content) {
      setError("Enter a message before sending.");
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      setError(`Message must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`);
      return;
    }

    setSending(true);
    setError(null);
    try {
      await sendMessage({
        recipientId: borrowerId,
        content,
        loanId,
        drawRequestId,
      });
      toast.success(`Email sent to ${borrowerName}`);
      setMessage("");
      onClose();
    } catch (err) {
      const safeMessage = getErrorMessage(err, "Failed to send email. Please try again.");
      setError(safeMessage);
      toast.error(safeMessage);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setMessage("");
    setError(null);
    onClose();
  };

  const trimmedLength = message.trim().length;

  return (
    <ConfirmDialog
      open={open}
      onCancel={handleClose}
      onConfirm={handleSend}
      title={`Email ${borrowerName}`}
      description="Send a direct email notification and save the note in Messages."
      confirmLabel="Send Email"
      confirmDisabled={trimmedLength === 0}
      loading={sending}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/35 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Context
          </p>
          <p className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
            {contextLabel}
          </p>
          {contextDescription && (
            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {contextDescription}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor={messageId} className="text-sm font-medium">
              Message <span className="text-destructive">*</span>
            </label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {message.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            id={messageId}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (error) setError(null);
            }}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={7}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : helperId}
            placeholder="Write the update you want to send..."
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          {error ? (
            <p id={errorId} className="mt-2 text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p id={helperId} className="mt-2 text-xs leading-5 text-muted-foreground">
              The investor will receive this by email and can reply from the Messages page.
            </p>
          )}
        </div>
      </div>
    </ConfirmDialog>
  );
}
