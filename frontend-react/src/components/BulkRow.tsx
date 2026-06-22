import React, { useState, useEffect } from "react";
import { Plus, Trash2, Loader } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

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
  const [isUploading, setIsUploading] = useState(false);

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

  // Handle image upload to Supabase Storage
  const handleImageUpload = async (file: File) => {
    try {
      setIsUploading(true);
      
      // Create unique filename with sanitization
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      // Sanitize filename: replace spaces and special chars with hyphens, keep only alphanumeric, hyphens, dots
      const sanitizedName = file.name
        .replace(/[^a-zA-Z0-9.-]/g, '-')
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .toLowerCase();
      const fileName = `product-${timestamp}-${randomStr}-${sanitizedName}`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);
      
      if (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload image: ${error.message}`);
        return;
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      
      const publicUrl = publicUrlData.publicUrl;
      
      // Update the row with public URL
      handleChange('photo_url', publicUrl);
      toast.success('Image uploaded successfully');
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  // Keep financial behavior aligned with Inventory edit-row logic:
  // Cost -> Landing(5%) -> Selling(3x, rounded)
  // Landing (manual) -> Selling(3x, rounded)
  const handleCostPriceChange = (rawValue: string) => {
    if (rawValue === "") {
      setLocalValues((prev: any) => ({ ...prev, cost_price: "", overhead: "", unit_price: "" }));
      onUpdate(row.id, "cost_price", "");
      onUpdate(row.id, "overhead", "");
      onUpdate(row.id, "unit_price", "");
      return;
    }

    const baseCost = Number(rawValue);
    if (Number.isNaN(baseCost)) return;
    const landingPrice = Math.round(baseCost * 1.10 * 100) / 100;
    const sellingPrice = Math.round(landingPrice * 3);

    setLocalValues((prev: any) => ({
      ...prev,
      cost_price: rawValue,
      overhead: landingPrice,
      unit_price: sellingPrice,
    }));
    onUpdate(row.id, "cost_price", rawValue);
    onUpdate(row.id, "overhead", landingPrice);
    onUpdate(row.id, "unit_price", sellingPrice);
  };

  const handleLandingPriceChange = (rawValue: string) => {
    if (rawValue === "") {
      setLocalValues((prev: any) => ({ ...prev, overhead: "", unit_price: "" }));
      onUpdate(row.id, "overhead", "");
      onUpdate(row.id, "unit_price", "");
      return;
    }

    const manualLanding = Number(rawValue);
    if (Number.isNaN(manualLanding)) return;
    const sellingPrice = Math.round(manualLanding * 3);

    setLocalValues((prev: any) => ({
      ...prev,
      overhead: rawValue,
      unit_price: sellingPrice,
    }));
    onUpdate(row.id, "overhead", rawValue);
    onUpdate(row.id, "unit_price", sellingPrice);
  };

  return (
    <tr className="divide-x divide-slate-100 hover:bg-blue-50/30 transition-colors">
      <td className="p-1 w-14">
        <div className="relative size-10 mx-auto border rounded bg-slate-50 overflow-hidden">
          {localValues.photo_url ? (
            <img src={localValues.photo_url} className="size-full object-contain cursor-zoom-in" />
          ) : (
            <Plus className="size-3 m-auto absolute inset-0 text-slate-300" />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader className="size-4 text-white animate-spin" />
            </div>
          )}
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 opacity-0 cursor-pointer" 
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImageUpload(file);
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
          onChange={(e) => handleCostPriceChange(e.target.value)} 
        />
      </td>
      <td className="p-0">
        <input 
          type="number" step="any" 
          className="w-full h-10 px-3 text-right outline-none font-mono" 
          value={localValues.overhead || ""} 
          onChange={(e) => handleLandingPriceChange(e.target.value)} 
        />
      </td>
      <td className="p-0">
        <input 
          type="number" step="any" 
          className="w-full h-10 px-3 text-right outline-none font-mono font-bold text-blue-600" 
          value={localValues.unit_price || ""} 
          onChange={(e) => handleChange('unit_price', e.target.value)}
          //readOnly
          tabIndex={-1}
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
