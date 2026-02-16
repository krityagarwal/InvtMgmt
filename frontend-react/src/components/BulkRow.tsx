import React, { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";


interface CategoryOption {
  id: string;
  name: string;
}

interface BulkRowProps {
  row: any;
  categoryOptions: { id: string; name: string }[];
  onUpdate: (rowId: string, field: string, value: any) => void;
  onRemove: (rowId: string) => void;
}

export const BulkRow = React.memo(({ row, categoryOptions, onUpdate, onRemove }: BulkRowProps) => {
  // Local state for instant typing
  const [localValues, setLocalValues] = useState(row);

  // Sync local state if parent row changes (e.g., after a sync or clear)
  useEffect(() => {
    setLocalValues(row);
  }, [row]);

  const handleChange = (field: string, value: any) => {
    // 1. Update UI instantly
    setLocalValues((prev: any) => ({ ...prev, [field]: value }));
    // 2. Pass to parent for data integrity
    onUpdate(row.id, field, value);
  };

  return (
    <tr className="divide-x divide-slate-100 hover:bg-blue-50/30 transition-colors">
      <td className="p-1 w-14">
        <div className="relative size-10 mx-auto border rounded bg-slate-50 overflow-hidden">
          {localValues.photo_url ? (
            <img src={localValues.photo_url} className="size-full object-contain cursor-zoom-in" 
            onClick={() => setSelectedImage(row.photo_url)}/>
          ) : (
            <Plus className="size-3 m-auto absolute inset-0 text-slate-300" />
          )}
          <input 
            type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => handleChange('photo_url', reader.result);
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
      </td>
      <td className="p-0">
        <input 
          className="w-full h-10 px-3 outline-none focus:bg-white font-bold" 
          value={localValues.item_code || ""}
          onChange={(e) => handleChange('item_code', e.target.value)}
        />
      </td>
        <td className="p-0">
        <select 
            className="w-full h-10 px-2 bg-transparent outline-none cursor-pointer text-[11px]"
            value={localValues.category_id || ""}
            onChange={(e) => handleChange('category_id', e.target.value)}
            >
            <option value="">Select Category</option>
            {categoryOptions.map((cat) => (
                // Add the key prop here. Using cat.id is perfect because it's a UUID.
                <option key={cat.id} value={cat.id}>
                {cat.name}
                </option>
            ))}
        </select>
        </td>
      <td className="p-0">
        <input 
          className="w-full h-10 px-3 outline-none" 
          value={localValues.vendor_name || ""} 
          onChange={(e) => handleChange('vendor_name', e.target.value)} 
        />
      </td>
      <td className="p-0">
        <input 
          type="number" step="any" 
          className="w-full h-10 px-3 text-right outline-none font-mono" 
          value={localValues.cost_price || ""} 
          onChange={(e) => handleChange('cost_price', e.target.value)} 
        />
      </td>
      <td className="p-0">
        <input 
          type="number" step="any" 
          className="w-full h-10 px-3 text-right outline-none font-mono" 
          value={localValues.overhead || ""} 
          onChange={(e) => handleChange('overhead', e.target.value)} 
        />
      </td>
      <td className="p-0">
        <input 
          type="number" step="any" 
          className="w-full h-10 px-3 text-right outline-none font-mono font-bold text-blue-600" 
          value={localValues.unit_price || ""} 
          onChange={(e) => handleChange('unit_price', e.target.value)} 
        />
      </td>
      <td className="p-0">
        <input 
          type="number" 
          className="w-full h-10 px-3 text-center outline-none" 
          value={localValues.display_qty || ""} 
          onChange={(e) => handleChange('display_qty', e.target.value)} 
        />
      </td>
      <td className="p-0">
        <input 
          type="number" 
          className="w-full h-10 px-3 text-center outline-none" 
          value={localValues.godown_qty || ""} 
          onChange={(e) => handleChange('godown_qty', e.target.value)} 
        />
      </td>
      <td className="p-0 text-center bg-slate-50/50">
        <Button 
          variant="ghost" size="icon" 
          className="h-10 w-full rounded-none text-red-300 hover:text-red-600" 
          onClick={() => onRemove(row.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </td>
    </tr>
  );
});