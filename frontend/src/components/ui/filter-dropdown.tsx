import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_SENTINEL = "__filter_empty__";

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const current = options.find((opt) => opt.value === value);
  const normalize = (raw: string) => (raw === "" ? EMPTY_SENTINEL : raw);
  const denormalize = (raw: string) => (raw === EMPTY_SENTINEL ? "" : raw);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-xs font-medium text-muted-foreground">{label}</label>}
      <Select value={normalize(value)} onValueChange={(next) => onChange(denormalize(next))}>
        <SelectTrigger className="h-9 w-full border-border bg-surface px-3 text-sm font-normal hover:bg-surface">
          <SelectValue placeholder={current?.label ?? value} />
        </SelectTrigger>
        <SelectContent className="min-w-[220px] max-w-[320px] [&_[data-radix-select-viewport]]:max-h-96">
          {options.map((option) => (
            <SelectItem key={normalize(option.value)} value={normalize(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
