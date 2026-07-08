"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Package,
  AlertTriangle,
  Boxes,
} from "lucide-react";

export default function InventoryReportsPage() {
  const { t } = useTranslation();

  // hadi mock data
  const stockMonitoring = [
    { name: "Premium Olive Oil 1L", stock: 45, threshold: 10, value: 450000 },
    {
      name: "Moroccan Mint Tea Pack",
      stock: 8,
      threshold: 15,
      value: 12000,
      lowStock: true,
    },
    {
      name: "Organic Argan Cosmetics",
      stock: 120,
      threshold: 20,
      value: 4800000,
    },
    {
      name: "Pure Saffron 5g",
      stock: 3,
      threshold: 5,
      value: 150000,
      lowStock: true,
    },
  ];

  const formatMAD = (centimes: number) => {
    return (
      "MAD " +
      (centimes / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-1 bg-slate-50/50 dark:bg-transparent min-h-screen">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/rapports"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-850 rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {t("reports.inventory.title", "Inventory Reports")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t(
                "reports.inventory.subtitle",
                "Valuate stock items, track low levels, and manage replenishment limits",
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => alert("Inventory Report Exported Successfully!")}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150 shadow-sm cursor-pointer"
        >
          <Download size={15} />
          <span>{t("reports.export", "Export")}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Inventory Value */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t("reports.inventory.total_val", "Total Inventory Value")}
            </span>
            <span className="text-3xl font-bold text-emerald-800 dark:text-emerald-455 mt-1">
              {formatMAD(45020000)} {/* 450,200.00 MAD */}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t("reports.inventory.sku_count", "Across 148 product listings")}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <Package size={24} />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              {t("reports.inventory.low_stock", "Low Stock Alerts")}
            </span>
            <span className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">2</span>
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-1">
              ⚠️{" "}
              {t(
                "reports.inventory.need_reorder",
                "Items requiring reordering soon",
              )}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Stock Levels Monitoring Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <Boxes size={18} className="text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {t("reports.inventory.stock_levels_title", "Stock Level Status")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider">
                  {t("reports.inventory.product", "Product")}
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-center w-40">
                  {t("reports.inventory.current_stock", "Current Stock")}
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-center w-40">
                  {t("reports.inventory.threshold", "Alert Threshold")}
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wider text-right w-44">
                  {t("reports.inventory.value", "Value (Cost)")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {stockMonitoring.map((item, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/40 transition-colors duration-150"
                >
                  <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.lowStock && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-[9px] font-bold text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                          Low Stock
                        </span>
                      )}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-xs text-center font-bold whitespace-nowrap ${item.lowStock ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-zinc-200"}`}
                  >
                    {item.stock}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-400 text-center whitespace-nowrap font-medium">
                    {item.threshold}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-emerald-800 dark:text-emerald-455 text-right whitespace-nowrap">
                    {formatMAD(item.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
