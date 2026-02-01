import * as React from "react"
import { Check } from "lucide-react"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = ({ checked, onCheckedChange, className, ...props }: CheckboxProps) => {
  return (
    <div 
      onClick={() => onCheckedChange?.(!checked)}
      className={`size-4 rounded border border-gray-300 flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white'}`}
    >
      {checked && <Check className="size-3 text-white" />}
    </div>
  )
}