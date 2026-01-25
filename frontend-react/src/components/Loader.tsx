import { Loader2 } from "lucide-react";

export function GlobalLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="size-10 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-gray-600">Processing...</p>
      </div>
    </div>
  );
}