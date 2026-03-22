import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

type PCheckbox1Props = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  className?: string;
};

export function PCheckbox1({ id, checked, onCheckedChange, label, className }: PCheckbox1Props) {
  return (
    <Field orientation="horizontal" className={className}>
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  );
}
