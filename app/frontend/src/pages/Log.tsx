import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ScrollText, Clock, Trash2, FileText, Loader2, Pencil, ShieldCheck, Calendar, X } from "lucide-react";
import {
  getLogEntriesFromDb,
  clearLogEntriesFromDb,
  deleteLogEntryFromDb,
  updateLogEntryDateFromDb,
  getAllDiscrepancyReports,
  clearAllDiscrepancyReports,
  type InventoryLogData,
  type DiscrepancyReportData,
} from "@/lib/inventory-api";

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Format as "mois année" e.g. "Août 2026" */
function formatMonthYear(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Parse a "YYYY-MM" string to an ISO date at start of that month */
function yearMonthToIso(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return "";
  const d = new Date(y, m - 1, 1, 12, 0, 0);
  return d.toISOString();
}

/** Format a Date to "YYYY-MM" for the input */
function isoToYearMonth(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  } catch {
    return "";
  }
}

// Define the custom grouping for the log page
interface LogGroup {
  key: string;
  label: string;
  reportKey: string | null;
  matchFn: (entry: InventoryLogData) => boolean;
}

// Helper: detect if an entry is a Lot B entry (regardless of parent lot)
const isLotBEntry = (e: InventoryLogData): boolean =>
  e.lot_id === "lot-b" ||
  e.sub_entity_name === "Lot B" ||
  (e.completed_key?.includes("lot-b") && !!e.sac_type);

// The 4 Lot B variants (always shown in the report section)
const LOT_B_VARIANTS = [
  { name: "Alpha", variantId: "alpha" },
  { name: "Bravo", variantId: "bravo" },
  { name: "Auteuil", variantId: "auteuil" },
  { name: "Neuilly", variantId: "neuilly" },
];

const findLotBReportKey = (variantId: string, availableKeys: Set<string>): string | null => {
  const primary = `lot-b::${variantId}`;
  if (availableKeys.has(primary)) return primary;
  for (const key of availableKeys) {
    if (key.endsWith(`::${variantId}`)) return key;
  }
  return null;
};

const LOT_C_VARIANTS = [
  { name: "Alpha", variantId: "alpha" },
  { name: "Bravo", variantId: "bravo" },
];

const findLotCReportKey = (variantId: string, availableKeys: Set<string>): string | null => {
  const primary = `lot-c::${variantId}`;
  if (availableKeys.has(primary)) return primary;
  for (const key of availableKeys) {
    if (key.endsWith(`::${variantId}`)) return key;
  }
  return null;
};

const LOT_V_VARIANTS = [
  { name: "Poussin", variantId: "vl-poussin" },
  { name: "Passy", variantId: "vtp-passy" },
];

const findLotVReportKey = (variantId: string, availableKeys: Set<string>): string | null => {
  const primary = `lot-v::${variantId}`;
  if (availableKeys.has(primary)) return primary;
  for (const key of availableKeys) {
    if (key.endsWith(`::${variantId}`)) return key;
  }
  return null;
};

const LOG_GROUPS: LogGroup[] = [
  {
    key: "lot-b",
    label: "Lot B",
    reportKey: null,
    matchFn: isLotBEntry,
  },
  {
    key: "vps-auteuil",
    label: "VPS Auteuil",
    reportKey: "vps-auteuil-central",
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-vps" && !e.lot_variant_name?.includes("Neuilly"),
  },
  {
    key: "vps-neuilly",
    label: "VPS Neuilly",
    reportKey: "vps-neuilly-central",
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-vps" && e.lot_variant_name?.includes("Neuilly"),
  },
  {
    key: "lot-a",
    label: "Lot A",
    reportKey: "lot-a-central",
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-001",
  },
  {
    key: "lot-c",
    label: "Lot C",
    reportKey: null,
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-003",
  },
  {
    key: "lot-v",
    label: "Lot V",
    reportKey: null,
    matchFn: (e) => e.lot_id === "lot-v",
  },
  {
    key: "lot-cai",
    label: "Lot CAI",
    reportKey: "lot-cai-central",
    matchFn: (e) => e.lot_id === "lot-cai",
  },
];

// --- Désinfection groups: lot + variant only, no sub-entity ---
interface DesinfectionGroup {
  key: string;
  label: string;
  matchFn: (entry: InventoryLogData) => boolean;
}

const DESINFECTION_GROUPS: DesinfectionGroup[] = [
  { key: "lot-a", label: "Lot A", matchFn: (e) => e.lot_id === "lot-001" },
  { key: "lot-b-alpha", label: "Lot B Alpha", matchFn: (e) => isLotBEntry(e) && (e.variant_name?.toLowerCase().includes("alpha") || false) },
  { key: "lot-b-bravo", label: "Lot B Bravo", matchFn: (e) => isLotBEntry(e) && (e.variant_name?.toLowerCase().includes("bravo") || false) },
  { key: "lot-b-auteuil", label: "Lot B Auteuil", matchFn: (e) => isLotBEntry(e) && (e.variant_name?.toLowerCase().includes("auteuil") || false) },
  { key: "lot-b-neuilly", label: "Lot B Neuilly", matchFn: (e) => isLotBEntry(e) && (e.variant_name?.toLowerCase().includes("neuilly") || false) },
  { key: "vps-auteuil", label: "VPS Auteuil", matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-vps" && !e.lot_variant_name?.includes("Neuilly") },
  { key: "vps-neuilly", label: "VPS Neuilly", matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-vps" && e.lot_variant_name?.includes("Neuilly") },
  { key: "lot-c-alpha", label: "Lot C Alpha", matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-003" && (e.lot_variant_name?.includes("Alpha") || e.variant_name?.includes("Alpha") || false) },
  { key: "lot-c-bravo", label: "Lot C Bravo", matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-003" && (e.lot_variant_name?.includes("Bravo") || e.variant_name?.includes("Bravo") || false) },
  { key: "lot-v-poussin", label: "Lot V Poussin", matchFn: (e) => e.lot_id === "lot-v" && (e.lot_variant_name?.toLowerCase().includes("poussin") || e.variant_name?.toLowerCase().includes("poussin") || false) },
  { key: "lot-v-passy", label: "Lot V Passy", matchFn: (e) => e.lot_id === "lot-v" && (e.lot_variant_name?.toLowerCase().includes("passy") || e.variant_name?.toLowerCase().includes("passy") || false) },
  { key: "lot-cai", label: "Lot CAI", matchFn: (e) => e.lot_id === "lot-cai" },
];

const REQUIRED_PER_ROLLING_YEAR = 3;

/** Rolling 12-month window: from (now - 12 months) to now */
function isWithinRollingYear(isoDate: string): boolean {
  const entryDate = new Date(isoDate);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return entryDate >= cutoff && entryDate <= now;
}

export default function LogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromReport = searchParams.get("from") === "report";
  const [entries, setEntries] = useState<InventoryLogData[]>([]);
  const [reports, setReports] = useState<DiscrepancyReportData[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state for editing date
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<InventoryLogData | null>(null);
  const [editMonth, setEditMonth] = useState(""); // "YYYY-MM"

  // Confirm delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const reloadEntries = useCallback(async () => {
    const data = await getLogEntriesFromDb();
    setEntries(data);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [data, allReports] = await Promise.all([
        getLogEntriesFromDb(),
        getAllDiscrepancyReports(),
      ]);
      setEntries(data);
      setReports(allReports);
      setLoading(false);
    };
    load();
  }, []);

  const handleClear = async () => {
    await Promise.all([clearLogEntriesFromDb(), clearAllDiscrepancyReports()]);
    setEntries([]);
    setReports([]);
  };

  const handleDeleteEntry = async (logId: number) => {
    await deleteLogEntryFromDb(logId);
    setDeleteConfirmId(null);
    await reloadEntries();
  };

  const handleOpenEditDate = (entry: InventoryLogData) => {
    setEditingEntry(entry);
    setEditMonth(isoToYearMonth(entry.created_at || ""));
    setEditDialogOpen(true);
  };

  const handleSaveDate = async () => {
    if (!editingEntry || !editMonth) return;
    const newIso = yearMonthToIso(editMonth);
    if (!newIso) return;
    await updateLogEntryDateFromDb(editingEntry.id, newIso);
    setEditDialogOpen(false);
    setEditingEntry(null);
    await reloadEntries();
  };

  const availableReportKeys = new Set(reports.map((r) => r.report_key));

  const getLotBReportKey = (variantName: string | null): string | null => {
    if (!variantName) return null;
    const lower = variantName.toLowerCase();
    if (lower.includes("alpha")) return "lot-b::alpha";
    if (lower.includes("bravo")) return "lot-b::bravo";
    if (lower.includes("auteuil")) return "lot-b::auteuil";
    if (lower.includes("neuilly")) return "lot-b::neuilly";
    return null;
  };

  const getLotVReportKey = (variantName: string | null): string | null => {
    if (!variantName) return null;
    const lower = variantName.toLowerCase();
    if (lower.includes("poussin")) return "lot-v::vl-poussin";
    if (lower.includes("passy")) return "lot-v::vtp-passy";
    return null;
  };

  // Group entries by LOG_GROUPS
  const groupedEntries: Record<string, InventoryLogData[]> = {};
  LOG_GROUPS.forEach((g) => {
    groupedEntries[g.key] = [];
  });
  groupedEntries["other"] = [];

  entries.forEach((entry) => {
    let matched = false;
    for (const group of LOG_GROUPS) {
      if (group.matchFn(entry)) {
        groupedEntries[group.key].push(entry);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groupedEntries["other"].push(entry);
    }
  });

  Object.keys(groupedEntries).forEach((key) => {
    groupedEntries[key].sort(
      (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
    );
  });

  // Deduplicate Lot B entries: keep only the most recent per variant + sac_type
  const dedupedLotB = (() => {
    const seen = new Map<string, InventoryLogData>();
    for (const entry of groupedEntries["lot-b"] || []) {
      const variantName = entry.variant_name || "";
      const sacType = entry.sac_type || "";
      const dedupKey = `${variantName}::${sacType}`;
      if (!seen.has(dedupKey)) {
        seen.set(dedupKey, entry);
      }
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
    );
  })();
  groupedEntries["lot-b"] = dedupedLotB;

  const getLotBVariantNames = (groupEntries: InventoryLogData[]): string[] => {
    const variants = new Set<string>();
    groupEntries.forEach((e) => {
      if (e.variant_name) variants.add(e.variant_name);
    });
    return Array.from(variants).sort();
  };

  const getLotVVariantNames = (groupEntries: InventoryLogData[]): string[] => {
    const variants = new Set<string>();
    groupEntries.forEach((e) => {
      if (e.lot_variant_name) variants.add(e.lot_variant_name);
      else if (e.variant_name) variants.add(e.variant_name);
    });
    return Array.from(variants).sort();
  };

  const isGroupComplete = (group: LogGroup, lotBVariants: string[], lotVVariants: string[]): boolean => {
    if (group.reportKey) {
      return availableReportKeys.has(group.reportKey);
    }
    if (group.key === "lot-b") {
      return LOT_B_VARIANTS.some(v => !!findLotBReportKey(v.variantId, availableReportKeys));
    }
    if (group.key === "lot-c") {
      return LOT_C_VARIANTS.some(v => !!findLotCReportKey(v.variantId, availableReportKeys));
    }
    if (group.key === "lot-v") {
      return LOT_V_VARIANTS.some(v => !!findLotVReportKey(v.variantId, availableReportKeys));
    }
    return false;
  };

  // --- Désinfection data: filter + group, NO dedup ---
  const desinfectionEntries = useMemo(
    () => entries.filter((e) => e.intervention_type === "desinfection"),
    [entries]
  );

  const desinfectionGrouped = useMemo(() => {
    const groups: Record<string, InventoryLogData[]> = {};
    DESINFECTION_GROUPS.forEach((g) => {
      groups[g.key] = [];
    });
    groups["other"] = [];

    desinfectionEntries.forEach((entry) => {
      let matched = false;
      for (const group of DESINFECTION_GROUPS) {
        if (group.matchFn(entry)) {
          groups[group.key].push(entry);
          matched = true;
          break;
        }
      }
      if (!matched) {
        groups["other"].push(entry);
      }
    });

    // Sort newest first within each group
    Object.keys(groups).forEach((key) => {
      groups[key].sort(
        (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
      );
    });

    return groups;
  }, [desinfectionEntries]);

  // Count desinfections in rolling 12-month window per group
  const desinfectionCountRolling = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(desinfectionGrouped).forEach((key) => {
      counts[key] = desinfectionGrouped[key].filter((e) =>
        isWithinRollingYear(e.created_at || "")
      ).length;
    });
    return counts;
  }, [desinfectionGrouped]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Shared component for a single désinfection entry row
  const renderDesinfectionEntry = (entry: InventoryLogData, idx: number, total: number) => {
    const isConfirmDelete = deleteConfirmId === entry.id;

    return (
      <Card key={entry.id} className="transition-all">
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-mono text-muted-foreground w-6 text-right shrink-0">
                #{total - idx}
              </span>
              <span className="font-medium text-foreground text-sm truncate">
                Désinfection
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatMonthYear(entry.created_at || "")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenEditDate(entry)}
                className="cursor-pointer h-7 w-7 p-0"
                title="Modifier la date"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              {isConfirmDelete ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="cursor-pointer h-7 text-xs px-2"
                  >
                    Oui
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmId(null)}
                    className="cursor-pointer h-7 text-xs px-2"
                  >
                    Non
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirmId(entry.id)}
                  className="cursor-pointer h-7 w-7 p-0 text-destructive hover:text-destructive"
                  title="Supprimer cette désinfection"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    Journal des inventaires
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Historique des vérifications et désinfections
                  </p>
                </div>
              </div>
            </div>
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Effacer le journal
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="verifications" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="verifications" className="cursor-pointer gap-1.5">
              <ScrollText className="h-4 w-4" />
              Vérifications
            </TabsTrigger>
            <TabsTrigger value="desinfection" className="cursor-pointer gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Désinfection
            </TabsTrigger>
          </TabsList>

          {/* ===== Onglet Vérifications (contenu existant) ===== */}
          <TabsContent value="verifications">
            <div className="space-y-8">
              {LOG_GROUPS.map((group) => {
                const groupEntries = groupedEntries[group.key] || [];
                const hasEntries = groupEntries.length > 0;
                const hasCentralReport = group.reportKey
                  ? availableReportKeys.has(group.reportKey)
                  : false;
                const lotBVariants = group.key === "lot-b" ? getLotBVariantNames(groupEntries) : [];
                const lotVVariants = group.key === "lot-v" ? getLotVVariantNames(groupEntries) : [];
                const groupComplete = isGroupComplete(group, lotBVariants, lotVVariants);

                return (
                  <div key={group.key}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        {group.label}
                      </h2>
                      {group.reportKey ? (
                        <div className="flex items-center gap-1">
                          {hasCentralReport ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/report/key/${encodeURIComponent(group.reportKey!)}?from=log`)}
                              className="cursor-pointer shrink-0"
                            >
                              <FileText className="h-4 w-4 mr-1.5" />
                              Rapport
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="opacity-50 shrink-0">
                              <FileText className="h-4 w-4 mr-1.5" />
                              Rapport
                            </Button>
                          )}
                          {hasCentralReport && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/report/key/${encodeURIComponent(group.reportKey!)}?from=log&mode=edit`)}
                              className="cursor-pointer shrink-0 h-8 w-8 p-0"
                              title="Modifier le rapport"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ) : group.key === "lot-b" ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {LOT_B_VARIANTS.map((v) => {
                            const reportKey = findLotBReportKey(v.variantId, availableReportKeys);
                            const hasReport = !!reportKey;
                            return (
                              <div key={v.name} className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!hasReport}
                                  onClick={() => navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log`)}
                                  className={`shrink-0 ${hasReport ? "cursor-pointer" : "opacity-50"}`}
                                >
                                  <FileText className="h-4 w-4 mr-1.5" />
                                  {v.name}
                                </Button>
                                {hasReport && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log&mode=edit`)}
                                    className="cursor-pointer shrink-0 h-8 w-8 p-0"
                                    title="Modifier le rapport"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : group.key === "lot-c" ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {LOT_C_VARIANTS.map((v) => {
                            const reportKey = findLotCReportKey(v.variantId, availableReportKeys);
                            const hasReport = !!reportKey;
                            return (
                              <div key={v.name} className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!hasReport}
                                  onClick={() => hasReport && navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log`)}
                                  className={`shrink-0 ${hasReport ? "cursor-pointer" : "opacity-50"}`}
                                >
                                  <FileText className="h-4 w-4 mr-1.5" />
                                  {v.name}
                                </Button>
                                {hasReport && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log&mode=edit`)}
                                    className="cursor-pointer shrink-0 h-8 w-8 p-0"
                                    title="Modifier le rapport"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : group.key === "lot-v" ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {LOT_V_VARIANTS.map((v) => {
                            const reportKey = findLotVReportKey(v.variantId, availableReportKeys);
                            const hasReport = !!reportKey;
                            return (
                              <div key={v.name} className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!hasReport}
                                  onClick={() => hasReport && navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log`)}
                                  className={`shrink-0 ${hasReport ? "cursor-pointer" : "opacity-50"}`}
                                >
                                  <FileText className="h-4 w-4 mr-1.5" />
                                  {v.name}
                                </Button>
                                {hasReport && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log&mode=edit`)}
                                    className="cursor-pointer shrink-0 h-8 w-8 p-0"
                                    title="Modifier le rapport"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    {hasEntries && (
                      <div className="space-y-2">
                        {groupEntries.map((entry) => {
                          const subLabel = entry.sub_entity_name;
                          const variantLabel = entry.variant_name;
                          const sacLabel =
                            entry.sac_type === "soin"
                              ? "Sac de soin"
                              : entry.sac_type === "o2"
                                ? "Sac d'O2"
                                : null;

                          const detailParts: string[] = [];
                          if (group.key === "lot-b") {
                            const cleanVariant = variantLabel?.replace(/^Lot\s*B\s+/i, "") || null;
                            if (cleanVariant) detailParts.push(`Lot B ${cleanVariant}`);
                            else detailParts.push("Lot B");
                            if (sacLabel) detailParts.push(sacLabel);
                          } else if (group.key === "lot-c") {
                            const lotCVariant = entry.lot_variant_name
                              || (variantLabel?.replace(/^(Caisse|POM|Lot\s*C)\s+/i, ""))
                              || variantLabel;
                            const cleanSubEntity = subLabel?.replace(/\s+(Alpha|Bravo)$/i, "") || subLabel;
                            if (lotCVariant && (lotCVariant.includes("Alpha") || lotCVariant.includes("Bravo"))) {
                              const v = lotCVariant.includes("Alpha") ? "Alpha" : "Bravo";
                              detailParts.push(`Lot C ${v}`);
                            } else {
                              detailParts.push("Lot C");
                            }
                            detailParts.push(cleanSubEntity);
                          } else {
                            detailParts.push(subLabel);
                            if (variantLabel) detailParts.push(variantLabel);
                            if (sacLabel) detailParts.push(sacLabel);
                          }
                          const detailLine = detailParts.join(" — ");

                          return (
                            <Card key={entry.id} className="transition-all">
                              <CardContent className="py-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground">
                                      {detailLine}
                                    </p>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                      <span>
                                        {entry.intervention_type === "desinfection" ? "Désinfection" : `DPS : ${entry.dps_name || "—"}`}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {formatDateTime(entry.created_at || "")}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {groupedEntries["other"] && groupedEntries["other"].length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    Autres
                  </h2>
                  <div className="space-y-2">
                    {groupedEntries["other"].map((entry) => {
                      const subLabel = entry.sub_entity_name;
                      const variantLabel = entry.variant_name;
                      const sacLabel =
                        entry.sac_type === "soin"
                          ? "Sac de soin"
                          : entry.sac_type === "o2"
                            ? "Sac d'O2"
                            : null;

                      const detailParts = [subLabel];
                      if (variantLabel) detailParts.push(variantLabel);
                      if (sacLabel) detailParts.push(sacLabel);
                      const detailLine = detailParts.join(" — ");

                      return (
                        <Card key={entry.id} className="transition-all">
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground">
                                  {detailLine}
                                </p>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span>
                                    {entry.intervention_type === "desinfection" ? "Désinfection" : `DPS : ${entry.dps_name || "—"}`}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatDateTime(entry.created_at || "")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== Onglet Désinfection ===== */}
          <TabsContent value="desinfection">
            <div className="space-y-8">
              {DESINFECTION_GROUPS.map((group) => {
                const groupEntries = desinfectionGrouped[group.key] || [];
                const countRolling = desinfectionCountRolling[group.key] || 0;
                const isOnTrack = countRolling >= REQUIRED_PER_ROLLING_YEAR;

                return (
                  <div key={group.key}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isOnTrack ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {group.label}
                      </h2>
                      <span
                        className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                          isOnTrack
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {countRolling}/{REQUIRED_PER_ROLLING_YEAR} (12 mois glissants)
                      </span>
                    </div>

                    {groupEntries.length > 0 ? (
                      <div className="space-y-2">
                        {groupEntries.map((entry, idx) =>
                          renderDesinfectionEntry(entry, idx, groupEntries.length)
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic py-2">
                        Aucune désinfection enregistrée
                      </p>
                    )}
                  </div>
                );
              })}

              {desinfectionGrouped["other"] && desinfectionGrouped["other"].length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    Autres
                  </h2>
                  <div className="space-y-2">
                    {desinfectionGrouped["other"].map((entry, idx) =>
                      renderDesinfectionEntry(entry, idx, desinfectionGrouped["other"].length)
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialog for editing désinfection date */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la date de désinfection</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Mois et année
            </label>
            <Input
              type="month"
              value={editMonth}
              onChange={(e) => setEditMonth(e.target.value)}
              className="w-full"
            />
            {editingEntry && (
              <p className="text-xs text-muted-foreground mt-2">
                Date actuelle : {formatMonthYear(editingEntry.created_at || "")}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveDate}
              disabled={!editMonth}
              className="cursor-pointer"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}