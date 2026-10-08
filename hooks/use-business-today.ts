import { useState } from "react";
import { getBusinessCalendarDay } from "@/convex/lib/investmentSchedule";

/** Today's Wisconsin business date, fixed for the life of the page. */
export function useBusinessToday() {
  const [today] = useState(() => getBusinessCalendarDay());
  return today;
}
