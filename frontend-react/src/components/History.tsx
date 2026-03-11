import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id?: string | null;
  actor_email?: string | null;
  source?: string | null;
  notes?: string | null;
  before?: any;
  after?: any;
  created_at: string;
}

interface HistoryProps {
  events: AuditEvent[];
  entityType: string;
  onEntityTypeChange: (value: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function History({ events, entityType, onEntityTypeChange, onRefresh, isLoading }: HistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedId(null);
  }, [entityType]);

  const renderSummary = (ev: AuditEvent) => {
    const after = ev.after || {};
    const changes = Array.isArray(after.changes) ? after.changes : [];
    if (changes.length > 0) {
      const itemCode = after.item_code || after.itemCode;
      const prefix = itemCode ? `${itemCode} — ` : "";
      const first = changes[0];
      return `${prefix}changed ${first.label || first.field} from ${first.from ?? "-"} to ${first.to ?? "-"}`;
    }
    if (ev.action === "pi_created") {
      return `PI created ${after.order_number ? `(${after.order_number})` : ""}`;
    }
    if (ev.action === "order_sold") {
      return `Sold ${after.order_number ? `(${after.order_number})` : ""} to ${after.client_name || "customer"} for ₹${(after.final_total || 0).toLocaleString()}`;
    }
    return ev.notes || "-";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>History</CardTitle>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={entityType}
              onChange={(e) => onEntityTypeChange(e.target.value)}
            >
              <option value="all">All</option>
              <option value="inventory">Inventory</option>
              <option value="order">Orders</option>
              <option value="product">Products</option>
            </select>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-xs text-slate-500 font-medium">
            Showing {events.length} records
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Time</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <React.Fragment key={ev.id}>
                  <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
                    <TableCell className="text-xs text-slate-600">{new Date(ev.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-slate-900 capitalize">{ev.entity_type}</div>
                      <div className="font-mono text-[10px] text-slate-500">{String(ev.entity_id).slice(0, 8)}</div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{ev.action}</TableCell>
                    <TableCell className="text-xs text-slate-600">{renderSummary(ev)}</TableCell>
                    <TableCell className="text-right text-xs text-slate-500">
                      {expandedId === ev.id ? "Hide" : "View"}
                    </TableCell>
                  </TableRow>
                  {expandedId === ev.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-gray-50/60">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="font-semibold text-slate-700 mb-1">Before</div>
                            <pre className="rounded-md border bg-white p-3 overflow-auto max-h-56">
{JSON.stringify(ev.before || {}, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-700 mb-1">After</div>
                            <pre className="rounded-md border bg-white p-3 overflow-auto max-h-56">
{JSON.stringify(ev.after || {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-slate-500 py-10">
                    No history entries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
