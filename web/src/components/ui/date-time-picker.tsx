import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function DateTimePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return <div className="flex flex-wrap gap-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button id={id} type="button" variant="outline" className="min-w-48 flex-1 justify-start font-normal"><CalendarIcon className="h-4 w-4" />{format(selected, "PPP", { locale: ru })}</Button></PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={selected} defaultMonth={selected} disabled={{ before: today }} initialFocus onSelect={(date) => {
        if (!date) return;
        const localDate = format(date, "yyyy-MM-dd");
        onChange(`${localDate}T${value.slice(11)}`);
        setOpen(false);
      }} /></PopoverContent>
    </Popover>
    <Input aria-label="Время отправки" type="time" required className="w-36" value={value.slice(11)} onChange={(event) => { if (event.target.value) onChange(`${value.slice(0, 10)}T${event.target.value}`); }} />
  </div>;
}
