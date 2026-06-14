import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  CalendarDays,
  CalendarRange,
  Percent,
  Tag,
  Package,
  RefreshCw,
  Users,
  UserPlus,
  Repeat,
  Megaphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

export interface DashboardStats {
  period: {
    today: { revenue: number; orders: number; collected: number };
    this_month: { revenue: number; orders: number; collected: number };
    last_month: { revenue: number; orders: number };
    all_time: { revenue: number; orders: number; collected: number };
  };
  daily_trend: { date: string; revenue: number; orders: number }[];
  monthly_trend: { month: string; revenue: number; orders: number }[];
  categories: {
    name: string;
    orders: number;
    units_sold: number;
    revenue: number;
    share_percent: number;
  }[];
  discounts: {
    avg_discount_percent: number;
    avg_extra_discount: number;
    total_discount_given: number;
    orders_with_discount: number;
    total_orders: number;
    discount_rate_percent: number;
    effective_discount_percent: number;
  };
  clients?: {
    total_customers: number;
    repeat_customers: number;
    repeat_rate_percent: number;
    new_this_month: number;
    avg_lifetime_value: number;
    avg_orders_per_customer: number;
  };
  top_clients?: {
    name: string;
    phone: string;
    orders: number;
    revenue: number;
    last_order_at: string | null;
  }[];
  referral_sources?: {
    source: string;
    orders: number;
    customers: number;
    revenue: number;
    share_percent: number;
  }[];
}

interface DashboardProps {
  stats: DashboardStats | null;
  onRefresh: () => void;
  isLoading?: boolean;
}

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#ca8a04",
  "#64748b",
];

const formatCurrency = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const formatShortDate = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function Dashboard({ stats, onRefresh, isLoading }: DashboardProps) {
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <p className="mb-4">No analytics data loaded yet.</p>
        <Button onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className="size-4 mr-2" />
          Load Dashboard
        </Button>
      </div>
    );
  }

  const { period, daily_trend, monthly_trend, categories, discounts, clients, top_clients, referral_sources } = stats;
  const monthChange =
    period.last_month.revenue > 0
      ? ((period.this_month.revenue - period.last_month.revenue) / period.last_month.revenue) * 100
      : null;

  const pieData = categories.slice(0, 8).map((c) => ({
    name: c.name,
    value: c.revenue,
  }));

  const referralChartData = (referral_sources ?? []).slice(0, 8).map((r) => ({
    name: r.source,
    value: r.revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">
            Revenue, customers, categories, and discount insights from sold orders
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-gray-600">Today</CardTitle>
            <CalendarDays className="size-3.5 text-blue-600" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{formatCurrency(period.today.revenue)}</div>
            <p className="text-[10px] text-gray-500 mt-1">
              {period.today.orders} order{period.today.orders !== 1 ? "s" : ""} ·{" "}
              {formatCurrency(period.today.collected)} collected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-gray-600">This Month</CardTitle>
            <CalendarRange className="size-3.5 text-violet-600" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{formatCurrency(period.this_month.revenue)}</div>
            <p className="text-[10px] text-gray-500 mt-1">
              {period.this_month.orders} orders
              {monthChange !== null && (
                <span className={monthChange >= 0 ? " text-green-600" : " text-red-600"}>
                  {" "}
                  · {monthChange >= 0 ? "+" : ""}
                  {monthChange.toFixed(0)}% vs last month
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-gray-600">Last Month</CardTitle>
            <TrendingUp className="size-3.5 text-emerald-600" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{formatCurrency(period.last_month.revenue)}</div>
            <p className="text-[10px] text-gray-500 mt-1">{period.last_month.orders} orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-gray-600">All Time</CardTitle>
            <TrendingUp className="size-3.5 text-gray-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{formatCurrency(period.all_time.revenue)}</div>
            <p className="text-[10px] text-gray-500 mt-1">
              {period.all_time.orders} orders · {formatCurrency(period.all_time.collected)} collected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discount KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-orange-100 bg-orange-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-orange-800">Avg Discount %</CardTitle>
            <Percent className="size-3.5 text-orange-600" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-orange-900">{discounts.avg_discount_percent}%</div>
            <p className="text-[10px] text-orange-700/80 mt-1">Per sold order (list % field)</p>
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-orange-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-orange-800">Effective Discount</CardTitle>
            <Tag className="size-3.5 text-orange-600" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-orange-900">{discounts.effective_discount_percent}%</div>
            <p className="text-[10px] text-orange-700/80 mt-1">Total discounts ÷ subtotal</p>
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-orange-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-orange-800">Total Discount Given</CardTitle>
            <Tag className="size-3.5 text-orange-600" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-orange-900">{formatCurrency(discounts.total_discount_given)}</div>
            <p className="text-[10px] text-orange-700/80 mt-1">
              Avg flat extra: {formatCurrency(discounts.avg_extra_discount)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-orange-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-[11px] font-medium text-orange-800">Orders Discounted</CardTitle>
            <Percent className="size-3.5 text-orange-600" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-orange-900">{discounts.discount_rate_percent}%</div>
            <p className="text-[10px] text-orange-700/80 mt-1">
              {discounts.orders_with_discount} of {discounts.total_orders} orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Client KPIs */}
      {clients && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="size-4" />
            Customer Insights
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="border-sky-100 bg-sky-50/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] font-medium text-sky-800">Total Customers</CardTitle>
                <Users className="size-3.5 text-sky-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold text-sky-900">{clients.total_customers}</div>
                <p className="text-[10px] text-sky-700/80 mt-1">Unique buyers (sold orders)</p>
              </CardContent>
            </Card>

            <Card className="border-sky-100 bg-sky-50/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] font-medium text-sky-800">New This Month</CardTitle>
                <UserPlus className="size-3.5 text-sky-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold text-sky-900">{clients.new_this_month}</div>
                <p className="text-[10px] text-sky-700/80 mt-1">First-time buyers</p>
              </CardContent>
            </Card>

            <Card className="border-sky-100 bg-sky-50/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] font-medium text-sky-800">Repeat Customers</CardTitle>
                <Repeat className="size-3.5 text-sky-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold text-sky-900">{clients.repeat_customers}</div>
                <p className="text-[10px] text-sky-700/80 mt-1">{clients.repeat_rate_percent}% of all customers</p>
              </CardContent>
            </Card>

            <Card className="border-sky-100 bg-sky-50/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] font-medium text-sky-800">Avg Lifetime Value</CardTitle>
                <TrendingUp className="size-3.5 text-sky-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold text-sky-900">{formatCurrency(clients.avg_lifetime_value)}</div>
                <p className="text-[10px] text-sky-700/80 mt-1">Revenue per customer</p>
              </CardContent>
            </Card>

            <Card className="border-sky-100 bg-sky-50/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] font-medium text-sky-800">Avg Orders / Customer</CardTitle>
                <Repeat className="size-3.5 text-sky-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold text-sky-900">{clients.avg_orders_per_customer}</div>
                <p className="text-[10px] text-sky-700/80 mt-1">Purchase frequency</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Daily Revenue (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "revenue" ? [formatCurrency(value), "Revenue"] : [value, "Orders"]
                    }
                    labelFormatter={(label) => formatShortDate(String(label))}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Revenue (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "revenue" ? [formatCurrency(value), "Revenue"] : [value, "Orders"]
                    }
                    labelFormatter={(label) => formatMonth(String(label))}
                  />
                  <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="size-4 text-gray-500" />
              Revenue by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-500 py-12 text-center">No category sales yet</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Category Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500 py-12 text-center">No category data yet</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categories.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 8, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "revenue") return [formatCurrency(value), "Revenue"];
                        if (name === "units_sold") return [value, "Units"];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="revenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client analytics */}
      {(top_clients?.length || referralChartData.length) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Megaphone className="size-4 text-gray-500" />
                Revenue by Referral Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              {referralChartData.length === 0 ? (
                <p className="text-sm text-gray-500 py-12 text-center">No referral data yet</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={referral_sources?.slice(0, 8) ?? []}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 8, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis type="category" dataKey="source" width={88} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "revenue") return [formatCurrency(value), "Revenue"];
                          if (name === "customers") return [value, "Customers"];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="revenue" fill="#0891b2" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-gray-500" />
                Top Customers by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!top_clients?.length ? (
                <p className="text-sm text-gray-500 py-12 text-center">No customer data yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                      <th className="pb-2 pr-3 font-medium">Customer</th>
                      <th className="pb-2 pr-3 font-medium text-right">Revenue</th>
                      <th className="pb-2 pr-3 font-medium text-right">Orders</th>
                      <th className="pb-2 font-medium text-right">Last Purchase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_clients.map((client, index) => (
                      <tr key={`${client.name}-${client.phone}-${index}`} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-gray-900">{client.name}</div>
                          {client.phone ? (
                            <div className="text-[11px] text-gray-500">{client.phone}</div>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-medium">{formatCurrency(client.revenue)}</td>
                        <td className="py-2.5 pr-3 text-right text-gray-600">{client.orders}</td>
                        <td className="py-2.5 text-right text-gray-600 text-[12px]">
                          {formatDateTime(client.last_order_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Referral breakdown table */}
      {referral_sources && referral_sources.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Referral Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium text-right">Revenue</th>
                  <th className="pb-2 pr-4 font-medium text-right">Share</th>
                  <th className="pb-2 pr-4 font-medium text-right">Orders</th>
                  <th className="pb-2 font-medium text-right">Customers</th>
                </tr>
              </thead>
              <tbody>
                {referral_sources.map((ref) => (
                  <tr key={ref.source} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{ref.source}</td>
                    <td className="py-2.5 pr-4 text-right">{formatCurrency(ref.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{ref.share_percent}%</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{ref.orders}</td>
                    <td className="py-2.5 text-right text-gray-600">{ref.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Category table */}
      {categories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium text-right">Revenue</th>
                  <th className="pb-2 pr-4 font-medium text-right">Share</th>
                  <th className="pb-2 pr-4 font-medium text-right">Units</th>
                  <th className="pb-2 font-medium text-right">Orders</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{cat.name}</td>
                    <td className="py-2.5 pr-4 text-right">{formatCurrency(cat.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{cat.share_percent}%</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{cat.units_sold}</td>
                    <td className="py-2.5 text-right text-gray-600">{cat.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
