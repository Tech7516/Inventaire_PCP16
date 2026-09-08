import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { loadLotConfig, loadEditableKitOverrides } from "@/lib/configStore";
import { subEntitySections, findKitDefinition, type KitItem } from "@/data/lots";
import type { Lot, SubEntity, ConsumableSection } from "@/data/lots";
import { ArrowLeft, Save, ClipboardList, Users, ChevronDown, ChevronRight, PackageOpen, Lock, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  saveInventoryItems,
  markSubEntity,
  getInventoryItems,
  addLogEntryToDb,
  saveDiscrepancyReportToDb,
  getActiveSession,
  getAllActiveSessions,
  createSession,
  abandonSession,
  completeSession,
  getSession,
  type InventoryItemData,
  type SessionData,
} from "@/lib/inventory-api";
import { useCloudPreferences } from "@/lib/useCloudPreferences";

interface InventoryEntry {
  itemId: string;
  validated: boolean;
  customQuantity: string;
}

export default function InventoryPage() {
  const { lotId, subId, variantId, sacType } = useParams<{ lotId: string; subId: string; variantId?: string; sacType?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") ? parseInt(searchParams.get("session")!) : null;
  const urlVariantId = searchParams.get("variant") || undefined;
  const urlSessionId = searchParams.get("session");
  const { getPref, setPref } = useCloudPreferences();

  const dsaVariant = searchParams.get("dsaVariant");
  const isT7 = dsaVariant === "t7-alpha" || dsaVariant === "t7-bravo";

  const [lot, setLot] = useState<Lot | null>(null);
  const [subEntity, setSubEntity] = useState<SubEntity | null>(null);
  const [sections, setSections] = useState<ConsumableSection[]>([]);
  const [configLoading, setConfigLoading] = useState(true);

  const isDirectInventory = lot?.directInventory === true;
  const variant = subEntity?.variants?.find((v) => v.id === variantId);

  // --- Session management for direct inventory lots (Lot V, Lot CAI, Lot A, Lot C) ---
  const [directSession, setDirectSession] = useState<SessionData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  // Resolve effective session: either from URL param (non-direct) or direct session state
  const effectiveSessionId = sessionId || (directSession?.id ?? null);

  // Check for active session on mount for direct inventory lots
  // URL params take priority (same logic as SubEntities):
  //   ?session=N  → join that specific session
  //   ?variant=V  → only resume a session matching that variant
  //   (none)      → resume any active session for this lot
  useEffect(() => {
    if (!lotId || !isDirectInventory) return;
    const checkSession = async () => {
      setSessionLoading(true);
      try {
        // Case 1: explicit session ID in URL
        if (urlSessionId) {
          const specificSession = await getSession(Number(urlSessionId));
          if (specificSession && specificSession.status === "active") {
            setDirectSession(specificSession);
            if (specificSession.variant_id) {
              try {
                const raw = getPref("lot-variants");
                const parsed = raw ? JSON.parse(raw) : {};
                if (parsed[lotId] !== specificSession.variant_id) {
                  parsed[lotId] = specificSession.variant_id;
                  setPref("lot-variants", JSON.stringify(parsed));
                }
              } catch { /* ignore */ }
            }
          }
          setSessionLoading(false);
          return;
        }

        // Case 2: variant specified in URL — only resume matching session
        if (urlVariantId) {
          const allSessions = await getAllActiveSessions();
          const matching = allSessions.find(
            (s) => s.lot_id === lotId && s.status === "active" && s.variant_id === urlVariantId
          );
          if (matching) {
            setDirectSession(matching);
            if (matching.variant_id) {
              try {
                const raw = getPref("lot-variants");
                const parsed = raw ? JSON.parse(raw) : {};
                if (parsed[lotId] !== matching.variant_id) {
                  parsed[lotId] = matching.variant_id;
                  setPref("lot-variants", JSON.stringify(parsed));
                }
              } catch { /* ignore */ }
            }
          }
          setSessionLoading(false);
          return;
        }

        // Case 3: no URL hints — legacy: resume any active session
        const existing = await getActiveSession(lotId);
        if (existing && existing.status === "active") {
          setDirectSession(existing);
          if (existing.variant_id) {
            try {
              const raw = getPref("lot-variants");
              const parsed = raw ? JSON.parse(raw) : {};
              if (parsed[lotId] !== existing.variant_id) {
                parsed[lotId] = existing.variant_id;
                setPref("lot-variants", JSON.stringify(parsed));
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      setSessionLoading(false);
    };
    checkSession();
    // Poll every 5s to keep session state fresh
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId, isDirectInventory, urlVariantId, urlSessionId]);

  // Create a session for direct inventory when DPS name is set and no session exists
  const ensureDirectSession = async (): Promise<number | null> => {
    if (!isDirectInventory || !lotId) return sessionId;
    if (directSession?.id) return directSession.id;
    const dps = dpsName.trim();
    if (!dps && interventionType !== "desinfection") return null;
    try {
      const s = await createSession(
        lotId,
        dps || "Désinfection",
        lotVariantId || null,
        interventionType || null
      );
      setDirectSession(s);
      return s.id;
    } catch (e: any) {
      toast.error(e?.message || "Impossible de créer la session");
      return null;
    }
  };

  // Abandon the direct inventory session
  const handleAbandon = async () => {
    if (!directSession?.id) return;
    setAbandoning(true);
    try {
      await abandonSession(directSession.id);
      setDirectSession(null);
      toast.success("Session abandonnée");
      navigate("/");
    } catch {
      toast.error("Erreur lors de l'abandon");
    } finally {
      setAbandoning(false);
    }
  };

  // Load lot config from DB (configStore) on mount
  useEffect(() => {
    if (!lotId) return;
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        const config = await loadLotConfig(lotId);
        if (config) {
          setLot(config.lot);
          const sectionKey = sacType ? `${subId}-${sacType}` : subId;
          let loadedSections: ConsumableSection[] = [];
          if (config.lot.directInventory) {
            loadedSections = config.sections[lotId] || [];
          } else if (subId) {
            loadedSections = config.sections[sectionKey] || config.sections[subId] || [];
          }
          // Add T7 accessories section when a T7 variant is selected
          if (isT7 && subEntitySections["t7-accessoires"]) {
            loadedSections = [...loadedSections, ...subEntitySections["t7-accessoires"]];
          }
          setSections(loadedSections);
          if (subId && !config.lot.directInventory) {
            const found = config.subEntities.find((s) => s.id === subId);
            setSubEntity(found || null);
          }
        }
      } catch { /* ignore */ }
      setConfigLoading(false);
    };
    loadConfig();
  }, [lotId, subId, sacType, isT7]);

  // DPS name for direct inventory lots (Lot CAI, Lot V)
  const [dpsName, setDpsName] = useState(() => getPref("dps-name") || "");
  const [interventionType, setInterventionType] = useState<"verification" | "desinfection" | "">("");

  // Get the selected lot variant name for display (e.g. "VL Poussin")
  // URL variant param takes priority over preferences
  const lotVariantName = (() => {
    if (!lot?.variants) return null;
    const effectiveVId = urlVariantId || (() => {
      try {
        const lotVarsRaw = getPref("lot-variants");
        if (lotVarsRaw) {
          const parsed = JSON.parse(lotVarsRaw);
          return parsed[lotId || ""] || null;
        }
      } catch { /* ignore */ }
      return null;
    })();
    if (effectiveVId) {
      const v = lot.variants.find((vv) => vv.id === effectiveVId);
      if (v) return v.name;
    }
    return null;
  })();

  // Get the selected lot variant ID — URL param takes priority over preferences
  const lotVariantId = urlVariantId || (() => {
    try {
      const lotVarsRaw = getPref("lot-variants");
      if (lotVarsRaw) {
        const parsed = JSON.parse(lotVarsRaw);
        return parsed[lotId || ""] || null;
      }
    } catch { /* ignore */ }
    return null;
  })();

  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [editableOverrides, setEditableOverrides] = useState<Record<string, KitItem[]>>({});

  // Load editable kit overrides once
  useEffect(() => {
    loadEditableKitOverrides()
      .then((o) => setEditableOverrides(o))
      .catch(() => { /* ignore */ });
  }, []);

  const [entries, setEntries] = useState<Record<string, InventoryEntry>>(
    () => {
      const initial: Record<string, InventoryEntry> = {};
      sections.forEach((section) => {
        section.items.forEach((item) => {
          initial[item.id] = {
            itemId: item.id,
            validated: true,
            customQuantity: "",
          };
        });
      });
      return initial;
    }
  );

  // Initialize / update kit sub-item entries when overrides or sections change
  useEffect(() => {
    if (sections.length === 0) return;
    setEntries((prev) => {
      const updated = { ...prev };
      let changed = false;
      sections.forEach((section) => {
        section.items.forEach((item) => {
          const kitDef = findKitDefinition(item.name, editableOverrides);
          if (kitDef) {
            kitDef.items.forEach((subItem) => {
              if (!updated[subItem.id]) {
                updated[subItem.id] = {
                  itemId: subItem.id,
                  validated: true,
                  customQuantity: "",
                };
                changed = true;
              }
            });
          }
        });
      });
      return changed ? updated : prev;
    });
  }, [editableOverrides, sections]);

  const toggleKit = (itemId: string) => {
    setExpandedKits((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Load existing items from DB if session exists
  useEffect(() => {
    const loadExisting = async () => {
      if (!effectiveSessionId) {
        setLoadingExisting(false);
        return;
      }
      try {
        const existingItems = await getInventoryItems(
          effectiveSessionId,
          subId,
          variantId || undefined,
          sacType || undefined
        );
        if (existingItems.length > 0) {
          setEntries((prev) => {
            const updated = { ...prev };
            existingItems.forEach((item: InventoryItemData) => {
              if (updated[item.item_id]) {
                updated[item.item_id] = {
                  itemId: item.item_id,
                  validated: item.validated ?? true,
                  customQuantity: item.custom_quantity || "",
                };
              }
            });
            return updated;
          });
        }
      } catch { /* ignore */ }
      setLoadingExisting(false);
    };
    loadExisting();
  }, [effectiveSessionId, subId, variantId, sacType]);

  const sacLabel = sacType === "o2" ? "Sac d'O2" : sacType === "soin" ? "Sac de soin" : sacType === "ams" ? "AMS" : "";
  const displayTitle = isDirectInventory
    ? lotVariantName || lot?.name || ""
    : variant
      ? sacLabel ? `${variant.name} — ${sacLabel}` : variant.name
      : subEntity?.name || "";

  if (configLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-lg text-muted-foreground">Chargement de l'inventaire…</p>
        </div>
      </div>
    );
  }

  if (!lot || (!isDirectInventory && !subEntity)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">Sous-ensemble introuvable</p>
          <Button variant="outline" onClick={() => navigate("/")} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const allItems = (() => {
    const items = sections.flatMap((s) => s.items);
    // Include kit sub-items so they are part of validation/save
    const withKitItems: typeof items = [...items];
    items.forEach((item) => {
      const kitDef = findKitDefinition(item.name, editableOverrides);
      if (kitDef) {
        kitDef.items.forEach((subItem) => {
          if (!withKitItems.find((i) => i.id === subItem.id)) {
            withKitItems.push(subItem);
          }
        });
      }
    });
    return withKitItems;
  })();
  // Ensure all items have an entry in state (safety net for dynamic section changes)
  const safeEntries = { ...entries };
  allItems.forEach((item) => {
    if (!safeEntries[item.id]) {
      safeEntries[item.id] = { itemId: item.id, validated: true, customQuantity: "" };
    }
  });
  const processedCount = allItems.filter(
    (item) => safeEntries[item.id]?.validated || safeEntries[item.id]?.customQuantity?.trim()
  ).length;

  const toggleValidation = (itemId: string) => {
    setEntries((prev) => {
      const existing = prev[itemId] || { itemId, validated: true, customQuantity: "" };
      const wasValidated = existing.validated;
      return {
        ...prev,
        [itemId]: {
          ...existing,
          validated: !wasValidated,
          customQuantity: wasValidated ? "0" : "",
        },
      };
    });
  };

  const updateCustomQuantity = (itemId: string, value: string) => {
    setEntries((prev) => {
      const existing = prev[itemId] || { itemId, validated: true, customQuantity: "" };
      return {
        ...prev,
        [itemId]: {
          ...existing,
          customQuantity: value,
        },
      };
    });
  };

  const handleQuantityFocus = (itemId: string) => {
    setEntries((prev) => {
      const existing = prev[itemId] || { itemId, validated: true, customQuantity: "" };
      if (!existing.validated) return prev;
      return {
        ...prev,
        [itemId]: {
          ...existing,
          validated: false,
          customQuantity: "",
        },
      };
    });
  };

  // Determine if this sub-entity is a Lot B
  const isLotB = subEntity?.inventoryType === "lot-b";

  const handleSubmit = async () => {
    const unprocessed = allItems.filter(
      (item) => !safeEntries[item.id]?.validated && !safeEntries[item.id]?.customQuantity?.trim()
    );
    if (unprocessed.length > 0) {
      toast.error(
        `${unprocessed.length} article(s) non traité(s). Validez le stock ou indiquez une quantité différente.`
      );
      return;
    }

    // For direct inventory, DPS name is required
    if (isDirectInventory && !dpsName.trim() && interventionType !== "desinfection") {
      toast.error("Veuillez saisir le nom du DPS ou cliquer sur « Désinfection ».");
      return;
    }

    setSaving(true);

    try {
      // For direct inventory, ensure a session exists before saving
      let currentSessionId = effectiveSessionId;
      if (isDirectInventory && !currentSessionId) {
        const createdId = await ensureDirectSession();
        if (!createdId) {
          toast.error("Impossible de créer la session. Veuillez saisir le nom du DPS.");
          setSaving(false);
          return;
        }
        currentSessionId = createdId;
      }

      // Save only discrepancies (non-conforming items) to DB
      if (currentSessionId) {
        const discrepancies = allItems.filter(
          (item) => !safeEntries[item.id]?.validated || safeEntries[item.id]?.customQuantity?.trim()
        );
        const itemsPayload = discrepancies.map((item) => ({
          item_id: item.id,
          validated: safeEntries[item.id]?.validated ?? true,
          custom_quantity: safeEntries[item.id]?.customQuantity || null,
        }));

        if (itemsPayload.length > 0) {
          await saveInventoryItems(
            currentSessionId,
            subId || lotId || "",
            itemsPayload,
            dpsName.trim(),
            variantId || null,
            sacType || null
          );
        }

        // Mark sub-entity as checked
        await markSubEntity(
          currentSessionId,
          subId || lotId || "",
          dpsName.trim(),
          variantId || null,
          sacType || null
        );
      }

      toast.success("Inventaire enregistré avec succès !");

      // Build discrepancy items for the report
      const discrepancyEntries = sections.flatMap((section) =>
        section.items
          .filter((item) => !safeEntries[item.id]?.validated || safeEntries[item.id]?.customQuantity?.trim())
          .map((item) => ({
            itemId: item.id,
            validated: safeEntries[item.id]?.validated ?? true,
            customQuantity: safeEntries[item.id]?.customQuantity || "",
            itemName: item.name,
            expectedQuantity: item.expectedQuantity,
            sectionTitle: section.title,
          }))
      );

      const discrepancyItems = discrepancyEntries
        .filter((entry) => !entry.validated && entry.customQuantity.trim())
        .map((entry) => {
          const actual = parseInt(entry.customQuantity, 10);
          const subLabel = (() => {
            if (!subEntity) return subId || "";
            if (variantId) {
              const v = subEntity.variants?.find((vv) => vv.id === variantId);
              return v?.name || variantId;
            }
            return subEntity.name;
          })();
          const sacLbl =
            sacType === "soin" ? "Sac de soin" : sacType === "o2" ? "Sac d'O2" : null;
          const locationParts: string[] = [];
          if (lotVariantName) locationParts.push(lotVariantName);
          if (subLabel) locationParts.push(subLabel);
          if (sacLbl) locationParts.push(sacLbl);
          locationParts.push(entry.sectionTitle);

          return {
            itemName: entry.itemName,
            expectedQuantity: entry.expectedQuantity,
            actualQuantity: isNaN(actual) ? 0 : actual,
            location: locationParts.join(" / "),
          };
        })
        .filter((d) => d.actualQuantity !== d.expectedQuantity);

      // Build full inventory data for download
      const fullInventoryData = [{
        lotId: lotId || "",
        subId: subId || "",
        variantId: variantId || null,
        sacType: sacType || null,
        lotVariantName: lotVariantName || null,
        dpsName: dpsName.trim() || null,
        entries: discrepancyEntries,
        savedAt: new Date().toISOString(),
      }];

      // Determine report_key:
      // - Lot B: separate report per variant (e.g. "lot-b::alpha", "lot-b::bravo")
      // - Lot V: separate report per variant
      // - VPS Auteuil/Neuilly: centralized report (without Lot B)
      // - Lot A: centralized report (without Lot B)
      // - Lot C Alpha/Bravo: centralized report (without Lot B)
      // - Lot CAI: centralized report
      let reportKeyOverride: string | undefined;
      if (isLotB) {
        // Lot B gets its own report key based on the Lot B variant
        const lotBVariantId = variantId || "";
        reportKeyOverride = `lot-b::${lotBVariantId}`;
      } else if (lotId === "lot-vps" && lotVariantName) {
        const lower = lotVariantName.toLowerCase();
        if (lower.includes("auteuil")) reportKeyOverride = "vps-auteuil-central";
        else if (lower.includes("neuilly")) reportKeyOverride = "vps-neuilly-central";
      } else if (lotId === "lot-001") {
        reportKeyOverride = "lot-a-central";
      } else if (lotId === "lot-003") {
        const lower = (lotVariantName || lotVariantId || "").toLowerCase();
        if (lower.includes("alpha")) reportKeyOverride = "lot-c-alpha-central";
        else if (lower.includes("bravo")) reportKeyOverride = "lot-c-bravo-central";
      } else if (lotId === "lot-cai") {
        reportKeyOverride = "lot-cai-central";
      } else if (lotId === "lot-v" && lotVariantId) {
        reportKeyOverride = `lot-v::${lotVariantId}`;
      }

      await saveDiscrepancyReportToDb({
        lotId: lotId || "",
        variantId: lotVariantId,
        lotName: lot?.name || "",
        variantName: lotVariantName || null,
        dpsName: dpsName.trim(),
        discrepancies: discrepancyItems,
        fullInventory: fullInventoryData,
        hasDiscrepancies: discrepancyItems.length > 0,
        reportKeyOverride,
      });

      // Log for direct inventory lots (e.g. Lot V, Lot CAI)
      if (isDirectInventory) {
        const completedKey = variantId && sacType
          ? `${lotId}-${subId}-${variantId}-${sacType}`
          : variantId
            ? `${lotId}-${subId}-${variantId}`
            : `${lotId}-${subId}`;

        await addLogEntryToDb({
          lot_id: lotId || "",
          lot_name: lot?.name || "",
          sub_entity_name: lotVariantName || lot?.name || "",
          variant_name: lotVariantName,
          lot_variant_name: lotVariantName,
          sac_type: null,
          dps_name: dpsName.trim(),
          intervention_type: interventionType || null,
          completed_key: completedKey,
        });

        // Complete the direct inventory session to unlock the variant
        if (currentSessionId) {
          try {
            await completeSession(currentSessionId);
          } catch (completeErr: any) {
            console.warn("Session completion failed (non-blocking):", completeErr);
          }
        }

        navigate(`/report/${lotId}`);
      } else {
        // Go back to sub-entities page
        navigate(`/lot/${lotId}`);
      }
    } catch (e: any) {
      toast.error(e?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement des données existantes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => isDirectInventory ? navigate("/") : navigate(`/lot/${lotId}`)}
                className="cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {displayTitle}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {isDirectInventory ? (lotVariantName || lot.name) : `${lot.name} — ${lot.location}`}
                    {sections.length > 0 && ` · ${processedCount}/${allItems.length} articles traités`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDirectInventory && directSession && (
                <Button
                  variant="outline"
                  onClick={handleAbandon}
                  disabled={abandoning || saving}
                  className="cursor-pointer text-amber-600 border-amber-300 hover:bg-amber-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {abandoning ? "Abandon..." : "Abandonner"}
                </Button>
              )}
              {isDirectInventory && directSession?.variant_id && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1">
                  <Lock className="h-3 w-3" />
                  <span>Variante verrouillée</span>
                </div>
              )}
              <Button onClick={handleSubmit} disabled={saving || (isDirectInventory && !dpsName.trim() && interventionType !== "desinfection")} className="cursor-pointer">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {sections.length === 0 ? (
        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <p className="text-lg text-muted-foreground">
              Aucun article défini pour ce sous-ensemble.
            </p>
            <p className="text-sm text-muted-foreground">
              Les consommables seront ajoutés prochainement.
            </p>
          </div>
        </main>
      ) : (
        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* DPS name field for direct inventory lots */}
          {isDirectInventory && (
            <div className="mb-6 bg-primary/5 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <label htmlFor="dps-name-direct" className="text-sm font-medium text-muted-foreground">
                  Nom du DPS
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  id="dps-name-direct"
                  type="text"
                  placeholder="Saisissez le nom du DPS..."
                  value={dpsName}
                  onChange={(e) => {
                    setDpsName(e.target.value);
                    setPref("dps-name", e.target.value);
                    if (e.target.value.trim()) {
                      setInterventionType("verification");
                    } else if (interventionType === "verification") {
                      setInterventionType("");
                    }
                  }}
                  className="max-w-md"
                />
                <Button
                  type="button"
                  variant={interventionType === "desinfection" ? "default" : "outline"}
                  onClick={() => {
                    setInterventionType("desinfection");
                    setDpsName("");
                    setPref("dps-name", "");
                  }}
                  className="cursor-pointer"
                >
                  Désinfection
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Saisissez le nom du DPS pour une vérification, ou cliquez sur « Désinfection » pour une désinfection.
              </p>
            </div>
          )}
          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.id}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {section.title}
                </h2>
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const entry = safeEntries[item.id] || { itemId: item.id, validated: true, customQuantity: "" };
                    const kitDef = findKitDefinition(item.name, editableOverrides);
                    const isKit = kitDef !== null;
                    const isExpanded = expandedKits.has(item.id);

                    // Determine discrepancy status for coloring
                    let discrepancyClass = "";
                    let discrepancyBadge = null;
                    if (!entry.validated && entry.customQuantity.trim()) {
                      const actual = parseInt(entry.customQuantity, 10);
                      if (!isNaN(actual) && actual !== item.expectedQuantity) {
                        const diff = actual - item.expectedQuantity;
                        if (diff > 0) {
                          discrepancyClass = "border-blue-200 bg-blue-50/30";
                          discrepancyBadge = (
                            <span className="text-xs text-blue-600 font-semibold ml-2 whitespace-nowrap">
                              Excédent : +{diff}
                            </span>
                          );
                        } else {
                          discrepancyClass = "border-amber-200 bg-amber-50/30";
                          discrepancyBadge = (
                            <span className="text-xs text-amber-600 font-semibold ml-2 whitespace-nowrap">
                              Manque : {Math.abs(diff)}
                            </span>
                          );
                        }
                      }
                    }

                    // Kit sub-item renderer
                    const renderKitSubItem = (subItem: KitItem) => {
                      const subEntry = safeEntries[subItem.id] || { itemId: subItem.id, validated: true, customQuantity: "" };
                      let subDiscrepancyClass = "";
                      let subDiscrepancyBadge = null;
                      if (!subEntry.validated && subEntry.customQuantity.trim()) {
                        const actual = parseInt(subEntry.customQuantity, 10);
                        if (!isNaN(actual) && actual !== subItem.expectedQuantity) {
                          const diff = actual - subItem.expectedQuantity;
                          if (diff > 0) {
                            subDiscrepancyClass = "border-blue-200 bg-blue-50/30";
                            subDiscrepancyBadge = (
                              <span className="text-xs text-blue-600 font-semibold ml-2 whitespace-nowrap">
                                Excédent : +{diff}
                              </span>
                            );
                          } else {
                            subDiscrepancyClass = "border-amber-200 bg-amber-50/30";
                            subDiscrepancyBadge = (
                              <span className="text-xs text-amber-600 font-semibold ml-2 whitespace-nowrap">
                                Manque : {Math.abs(diff)}
                              </span>
                            );
                          }
                        }
                      }
                      return (
                        <Card key={subItem.id} className={`transition-all duration-200 ${subDiscrepancyClass}`}>
                          <CardContent className="py-2 px-3 sm:px-4">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-foreground text-sm leading-snug break-words">
                                {subItem.name}
                              </p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                                Attendu : <span className="font-semibold">{subItem.expectedQuantity}</span>
                              </span>
                            </div>
                            {subDiscrepancyBadge && <div className="mt-1">{subDiscrepancyBadge}</div>}
                            <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t">
                              <label
                                htmlFor={`validate-${subItem.id}`}
                                className="flex items-center gap-2 cursor-pointer select-none shrink-0"
                              >
                                <Checkbox
                                  id={`validate-${subItem.id}`}
                                  checked={subEntry.validated}
                                  onCheckedChange={() => toggleValidation(subItem.id)}
                                  className="cursor-pointer"
                                />
                                <span className="text-sm font-medium">Conforme</span>
                              </label>
                              <div className="flex items-center gap-1.5 ml-auto">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">ou qté :</span>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder={String(subItem.expectedQuantity)}
                                  value={subEntry.customQuantity}
                                  onChange={(e) => {
                                    updateCustomQuantity(subItem.id, e.target.value);
                                    if (e.target.value && e.target.value !== String(subItem.expectedQuantity)) {
                                      setEntries((prev) => {
                                        const existing = prev[subItem.id] || { itemId: subItem.id, validated: true, customQuantity: "" };
                                        if (!existing.validated) return prev;
                                        return { ...prev, [subItem.id]: { ...existing, validated: false } };
                                      });
                                    }
                                  }}
                                  onFocus={(e) => {
                                    handleQuantityFocus(subItem.id);
                                    setTimeout(() => e.target.select(), 0);
                                  }}
                                  className="w-16 sm:w-20 text-center h-8 text-sm"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    };

                    // Kit item: render as expandable accordion
                    if (isKit && kitDef) {
                      const kitItemCount = kitDef.items.length;
                      const kitCheckedCount = kitDef.items.filter(
                        (si) => safeEntries[si.id]?.validated || safeEntries[si.id]?.customQuantity?.trim()
                      ).length;
                      return (
                        <div key={item.id} className="border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                            onClick={() => toggleKit(item.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                            )}
                            <PackageOpen className="h-4 w-4 shrink-0 text-primary" />
                            <span className="font-semibold text-foreground text-sm sm:text-base flex-1 text-left">
                              {item.name}
                            </span>
                            {kitItemCount > 0 && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {kitCheckedCount}/{kitItemCount} articles
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              Qté : <span className="font-semibold">{item.expectedQuantity}</span>
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="px-3 py-3 space-y-2 bg-muted/20">
                              {kitItemCount > 0 ? (
                                kitDef.items.map(renderKitSubItem)
                              ) : (
                                <p className="text-sm text-muted-foreground italic px-2">
                                  Kit personnalisé — articles à définir via l'onglet Administration.
                                </p>
                              )}
                              {/* Kit-level conformity checkbox */}
                              <div className="flex items-center gap-3 pt-2 border-t mt-2 px-1">
                                <label
                                  htmlFor={`validate-${item.id}`}
                                  className="flex items-center gap-2 cursor-pointer select-none shrink-0"
                                >
                                  <Checkbox
                                    id={`validate-${item.id}`}
                                    checked={entry.validated}
                                    onCheckedChange={() => toggleValidation(item.id)}
                                    className="cursor-pointer"
                                  />
                                  <span className="text-sm font-medium">Kit conforme</span>
                                </label>
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">ou qté :</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder={String(item.expectedQuantity)}
                                    value={entry.customQuantity}
                                    onChange={(e) => {
                                      updateCustomQuantity(item.id, e.target.value);
                                      if (e.target.value && e.target.value !== String(item.expectedQuantity)) {
                                        setEntries((prev) => {
                                          const existing = prev[item.id] || { itemId: item.id, validated: true, customQuantity: "" };
                                          if (!existing.validated) return prev;
                                          return { ...prev, [item.id]: { ...existing, validated: false } };
                                        });
                                      }
                                    }}
                                    onFocus={(e) => {
                                      handleQuantityFocus(item.id);
                                      setTimeout(() => e.target.select(), 0);
                                    }}
                                    className="w-16 sm:w-20 text-center h-9"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Normal item (non-kit)
                    return (
                      <Card
                        key={item.id}
                        className={`transition-all duration-200 ${discrepancyClass}`}
                      >
                        <CardContent className="py-3 px-3 sm:px-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-foreground text-sm sm:text-base leading-snug break-words">
                              {item.name}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                              Attendu : <span className="font-semibold">{item.expectedQuantity}</span>
                            </span>
                          </div>
                          {discrepancyBadge && (
                            <div className="mt-1">{discrepancyBadge}</div>
                          )}
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t">
                            <label
                              htmlFor={`validate-${item.id}`}
                              className="flex items-center gap-2 cursor-pointer select-none shrink-0"
                            >
                              <Checkbox
                                id={`validate-${item.id}`}
                                checked={entry.validated}
                                onCheckedChange={() => toggleValidation(item.id)}
                                className="cursor-pointer"
                              />
                              <span className="text-sm font-medium">Conforme</span>
                            </label>
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">ou qté :</span>
                              <Input
                                type="number"
                                min={0}
                                placeholder={String(item.expectedQuantity)}
                                value={entry.customQuantity}
                                onChange={(e) => {
                                  updateCustomQuantity(item.id, e.target.value);
                                  if (e.target.value && e.target.value !== String(item.expectedQuantity)) {
                                    setEntries((prev) => {
                                      const existing = prev[item.id] || { itemId: item.id, validated: true, customQuantity: "" };
                                      if (!existing.validated) return prev;
                                      return { ...prev, [item.id]: { ...existing, validated: false } };
                                    });
                                  }
                                }}
                                onFocus={(e) => {
                                  handleQuantityFocus(item.id);
                                  setTimeout(() => e.target.select(), 0);
                                }}
                                className="w-16 sm:w-20 text-center h-9"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}