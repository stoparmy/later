import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return <DayPicker locale={ru} labels={{ labelPrevious: () => "Предыдущий месяц", labelNext: () => "Следующий месяц" }} showOutsideDays={showOutsideDays} className={cn("p-3", className)} classNames={{
    months: "flex flex-col sm:flex-row gap-4", month: "space-y-4", caption: "flex justify-center pt-1 relative items-center",
    caption_label: "text-sm font-medium", nav: "flex items-center gap-1", nav_button: "h-7 w-7 bg-transparent p-0 inline-flex items-center justify-center rounded-md border opacity-60 hover:opacity-100 hover:bg-accent",
    nav_button_previous: "absolute left-1", nav_button_next: "absolute right-1", table: "w-full border-collapse space-y-1",
    head_row: "flex", head_cell: "text-muted-foreground rounded-md w-9 font-normal text-xs", row: "flex w-full mt-2",
    cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
    day: "h-9 w-9 p-0 font-normal rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
    day_today: "bg-accent text-accent-foreground", day_outside: "text-muted-foreground opacity-50", day_disabled: "text-muted-foreground opacity-40", day_hidden: "invisible",
    ...classNames,
  }} components={{ IconLeft: () => <ChevronLeft className="h-4 w-4" />, IconRight: () => <ChevronRight className="h-4 w-4" /> }} {...props} />;
}
