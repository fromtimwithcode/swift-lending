"use client";

import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/errors";

export type PayoffStatement = FunctionReturnType<
  typeof api.payoffs.getPayoffStatement
>;

export function usePayoffStatement(
  loanId: Id<"loans">,
  goodThroughDate: string,
  enabled = true
) {
  const convex = useConvex();
  const [result, setResult] = useState<{
    key: string;
    data: PayoffStatement | null;
    error: string | null;
  } | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const requestKey = `${loanId}:${goodThroughDate}:${requestVersion}`;

  const retry = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !goodThroughDate) return;

    let active = true;
    const watch = convex.watchQuery(api.payoffs.getPayoffStatement, {
      loanId,
      goodThroughDate,
    });
    const readResult = () => {
      if (!active) return;
      try {
        const statement = watch.localQueryResult();
        if (statement !== undefined) {
          setResult({ key: requestKey, data: statement, error: null });
        }
      } catch (queryError) {
        setResult({
          key: requestKey,
          data: null,
          error: getErrorMessage(
            queryError,
            "Unable to calculate the payoff"
          ),
        });
      }
    };
    const unsubscribe = watch.onUpdate(readResult);
    queueMicrotask(readResult);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [convex, enabled, goodThroughDate, loanId, requestKey]);

  const currentResult = enabled && result?.key === requestKey ? result : null;
  return {
    data: currentResult?.data ?? null,
    error: currentResult?.error ?? null,
    isLoading: enabled && currentResult === null,
    retry,
  };
}
