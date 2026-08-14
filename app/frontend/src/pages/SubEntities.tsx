import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadLotConfig } from "@/lib/configStore";
import type { Lot, SubEntity, SubEntityVariant, ConsumableSection } from "@/data/lots";
import { ArrowLeft, ClipboardList, Package, CheckCircle2, Save, XCircle, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  getActiveSession,
  createSession,
  abandonSession,
  completeSession,
  getSubEntityChecks,
  markSubEntity,
  addLogEntryToDb,
  type SessionData,
  type SubEntityCheckData,
} from "@/lib/inventory-api";
import { useCloudPreferences } from "@/lib/useCloudPreferences";

const POLL_INTERVAL = 5000; // 5 seconds

export default function SubEntitiesPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { getPref, setPref, removePref } = useCloudPreferences();
  const [lot, setLot] = useState<Lot | null>(null);
  const [subEntities, setSubEntities] = useState<SubEntity[]>([]);
  const [configSections, setConfigSections] = useState<Record<string, ConsumableSection[]>>({});
  const [configLoading, setConfigLoading] = useState(true);

  const [dpsName, setDpsName] = useState("");
  const [interventionType, setInterventionType] = useState<"verification" | "desinfection" | "">("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [checks, setChecks] = useState<SubEntityCheckData[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Multiple Lot B instances for Lot A (gros postes de secours)
  const [lotBInstances, setLotBInstances] = useState<number[]>([0]);

  // Load preferences from cloud on mount (only once per lotId change)
  // NOTE: getPref/setPref are intentionally excluded from deps — we only want
  // to initialize dpsName and variants on mount, not overwrite user input on
  // every cache update (which would make the DPS field read-only).
  useEffect(() => {
    const dpsVal = getPref("dps-name");
    if (dpsVal) setDpsName(dpsVal);

    const selVarsRaw = getPref("selected-variants");
    const lotVarsRaw = getPref("lot-variants");
    const initial: Record<string, string> = {};
    if (selVarsRaw) {
      try { Object.assign(initial, JSON.parse(selVarsRaw)); } catch { /* ignore */ }
    }
    // Pre-select sub-entity variants based on homepage lot variant selection
    if (lotVarsRaw) {
      try {
        const parsed = JSON.parse(lotVarsRaw);
        if (lotId === "lot-vps") {
          const vpsVariant = parsed["lot-vps"];
          if (vpsVariant) initial["vps-lot-b"] = vpsVariant;
        }
        if (lotId === "lot-003") {
          const lotCVariant = parsed["lot-003"];
          if (lotCVariant && (lotCVariant === "alpha" || lotCVariant === "bravo")) {
            initial["pom-c"] = lotCVariant;
            initial["lot-b-c"] = lotCVariant;
            initial["caisse-c"] = lotCVariant;
          }
        }
        if (lotId === "lot-001") {
          const lotAVariant = parsed["lot-001"];
          if (lotAVariant && (lotAVariant === "alpha" || lotAVariant === "bravo" || lotAVariant === "auteuil" || lotAVariant === "neuilly")) {
            initial["lot-b-0"] = lotAVariant;
          }
        }
      } catch { /* ignore */ }
    }
    setSelectedVariants(initial);
    if (Object.keys(initial).length > 0) {
      setPref("selected-variants", JSON.stringify(initial));
    }

    // Load Lot B instances for Lot A
    if (lotId === "lot-001") {
      const lotBInstRaw = getPref("lot-b-instances");
      if (lotBInstRaw) {
        try {
          const parsed = JSON.parse(lotBInstRaw) as number[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLotBInstances(parsed);
          }
        } catch { /* ignore */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId]);

  // Persist Lot B instances to cloud preferences
  useEffect(() => {
    if (lotId === "lot-001" && lotBInstances.length > 0) {
      setPref("lot-b-instances", JSON.stringify(lotBInstances));
    }
  }, [lotBInstances, lotId, setPref]);

  // Load lot config from DB (configStore) on mount
  useEffect(() => {
    if (!lotId) return;
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        const config = await loadLotConfig(lotId);
        if (config) {
          setLot(config.lot);
          setSubEntities(config.subEntities);
          setConfigSections(config.sections);
        }
      } catch { /* ignore */ }
      setConfigLoading(false);
    };
    loadConfig();
  }, [lotId]);

  // Load or create session on mount — check API directly (no localStorage cache)
  useEffect(() => {
    const initSession = async () => {
      if (!lotId) return;
      setSessionLoading(true);
      try {
        const activeSession = await getActiveSession(lotId);
        if (activeSession && activeSession.status === "active") {
          setSession(activeSession);
          setDpsName(activeSession.dps_name);
          setPref("dps-name", activeSession.dps_name);
          if (activeSession.intervention_type === "verification" || activeSession.intervention_type === "desinfection") {
            setInterventionType(activeSession.intervention_type);
          }
          const checksData = await getSubEntityChecks(activeSession.id);
          setChecks(checksData);
        }
      } catch { /* ignore */ }
      setSessionLoading(false);
    };
    initSession();
  }, [lotId]);

  // Polling for checks updates
  useEffect(() => {
    if (!session) return;
    const poll = async () => {
      try {
        const checksData = await getSubEntityChecks(session.id);
        setChecks(checksData);
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [session]);

  const persistVariant = (subId: string, value: string) => {
    setSelectedVariants((prev) => {
      const next = { ...prev, [subId]: value };
      setPref("selected-variants", JSON.stringify(next));
      return next;
    });
  };

  const handleValidateDps = async () => {
    if (interventionType === "verification" && !dpsName.trim()) {
      toast.error("Veuillez saisir le nom du DPS.");
      return;
    }
    if (!interventionType) {
      toast.error("Veuillez saisir un nom de DPS ou cliquer sur « Désinfection ».");
      return;
    }
    if (!lotId) return;

    setCreatingSession(true);
    try {
      // Get variant from cloud preferences
      const lotVarsRaw = getPref("lot-variants");
      let variantId: string | null = null;
      if (lotVarsRaw) {
        try {
          const parsed = JSON.parse(lotVarsRaw);
          variantId = parsed[lotId] || null;
        } catch { /* ignore */ }
      }

      const newSession = await createSession(lotId, dpsName.trim(), variantId, interventionType);
      setSession(newSession);
      setPref("dps-name", dpsName.trim());
      toast.success("Session d'inventaire créée !");
    } catch (e: any) {
      const detail = e?.data?.detail || e?.message || "Erreur lors de la création de la session";
      toast.error(detail);
    } finally {
      setCreatingSession(false);
    }
  };

  const handleAbandon = async () => {
    if (!session) return;
    setAbandoning(true);
    try {
      await abandonSession(session.id);
      setSession(null);
      setChecks([]);
      setDpsName("");
      removePref("dps-name");
      toast.success("Inventaire abandonné.");
      navigate("/");
    } catch (e: any) {
      toast.error(e?.data?.detail || "Erreur lors de l'abandon");
    } finally {
      setAbandoning(false);
    }
  };

  const handleSave = async () => {
    if (!session) {
      toast.error("Aucune session active.");
      return;
    }

    setCompleting(true);
    try {
      const completedSession = await completeSession(session.id);

      // Log each checked sub-entity
      const dpsNameValue = session.dps_name;
      // Get lot variant name for logging (from cloud preferences)
      const currentLotVariantName = (() => {
        if (!lot?.variants) return null;
        try {
          const lotVarsRaw = getPref("lot-variants");
          if (lotVarsRaw) {
            const parsed = JSON.parse(lotVarsRaw);
            const selectedVId = parsed[lotId || ""];
            if (selectedVId) {
              const v = lot.variants.find((vv) => vv.id === selectedVId);
              if (v) return v.name;
            }
          }
        } catch { /* ignore */ }
        return null;
      })();

      const logPromises: Promise<any>[] = [];
      subEntities.forEach((sub) => {
        // Skip lot-b sub-entity for Lot A (handled separately as multi-instance)
        if (lotId === "lot-001" && sub.id === "lot-b") return;

        const hasVariants = sub.variants && sub.variants.length > 0;
        const selectedVariant = selectedVariants[sub.id];

        if (hasVariants && sub.inventoryType === "lot-b") {
          if (selectedVariant) {
            const soinCheck = checks.find(
              (c) => c.sub_entity_id === sub.id && c.variant_id === selectedVariant && c.sac_type === "soin"
            );
            const o2Check = checks.find(
              (c) => c.sub_entity_id === sub.id && c.variant_id === selectedVariant && c.sac_type === "o2"
            );

            if (soinCheck) {
              const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
              logPromises.push(addLogEntryToDb({
                lot_id: "lot-b",
                lot_name: "Lot B",
                sub_entity_name: sub.name,
                variant_name: variantObj?.name || null,
                lot_variant_name: null,
                sac_type: "soin",
                dps_name: dpsNameValue,
                intervention_type: session.intervention_type || interventionType || null,
                completed_key: `lot-b-${selectedVariant}-soin`,
              }));
            }
            if (o2Check) {
              const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
              logPromises.push(addLogEntryToDb({
                lot_id: "lot-b",
                lot_name: "Lot B",
                sub_entity_name: sub.name,
                variant_name: variantObj?.name || null,
                lot_variant_name: null,
                sac_type: "o2",
                dps_name: dpsNameValue,
                intervention_type: session.intervention_type || interventionType || null,
                completed_key: `lot-b-${selectedVariant}-o2`,
              }));
            }
          }
        } else if (hasVariants) {
          if (selectedVariant) {
            const check = checks.find(
              (c) => c.sub_entity_id === sub.id && c.variant_id === selectedVariant && !c.sac_type
            );
            if (check) {
              const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
              logPromises.push(addLogEntryToDb({
                lot_id: lotId || "",
                lot_name: lot?.name || "",
                sub_entity_name: sub.name,
                variant_name: variantObj?.name || null,
                lot_variant_name: currentLotVariantName,
                sac_type: null,
                dps_name: dpsNameValue,
                intervention_type: session.intervention_type || interventionType || null,
                completed_key: `${lotId}-${sub.id}-${selectedVariant}`,
              }));
            }
          }
        } else {
          const check = checks.find(
            (c) => c.sub_entity_id === sub.id && !c.variant_id && !c.sac_type
          );
          if (check) {
            logPromises.push(addLogEntryToDb({
              lot_id: lotId || "",
              lot_name: lot?.name || "",
              sub_entity_name: sub.name,
              variant_name: null,
              lot_variant_name: currentLotVariantName,
              sac_type: null,
              dps_name: dpsNameValue,
              intervention_type: session.intervention_type || interventionType || null,
              completed_key: `${lotId}-${sub.id}`,
            }));
          }
        }
      });

      // Log Lot B instances for Lot A (multi-instance)
      if (lotId === "lot-001") {
        const lotBSubDef = subEntities.find((s) => s.id === "lot-b");
        lotBInstances.forEach((idx, arrIndex) => {
          const instanceKey = `lot-b-${idx}`;
          const variantId = selectedVariants[instanceKey];
          if (!variantId) return;
          const soinCheck = checks.find(
            (c) => c.sub_entity_id === "lot-b" && c.variant_id === variantId && c.sac_type === "soin"
          );
          const o2Check = checks.find(
            (c) => c.sub_entity_id === "lot-b" && c.variant_id === variantId && c.sac_type === "o2"
          );
          const variantObj = lotBSubDef?.variants?.find((v) => v.id === variantId);
          if (soinCheck) {
            logPromises.push(addLogEntryToDb({
              lot_id: "lot-b",
              lot_name: "Lot B",
              sub_entity_name: `Lot B #${arrIndex + 1}`,
              variant_name: variantObj?.name || null,
              lot_variant_name: null,
              sac_type: "soin",
              dps_name: dpsNameValue,
              intervention_type: session.intervention_type || interventionType || null,
              completed_key: `lot-b-${idx}-${variantId}-soin`,
            }));
          }
          if (o2Check) {
            logPromises.push(addLogEntryToDb({
              lot_id: "lot-b",
              lot_name: "Lot B",
              sub_entity_name: `Lot B #${arrIndex + 1}`,
              variant_name: variantObj?.name || null,
              lot_variant_name: null,
              sac_type: "o2",
              dps_name: dpsNameValue,
              intervention_type: session.intervention_type || interventionType || null,
              completed_key: `lot-b-${idx}-${variantId}-o2`,
            }));
          }
        });
      }

      await Promise.all(logPromises);

      // Clear session state (cloud preferences)
      removePref("dps-name");

      toast.success("Inventaire sauvegardé et envoyé !");

      // Navigate to the centralized report
      if (lotId) {
        let reportNavKey = "";
        if (lotId === "lot-vps" && currentLotVariantName) {
          const lower = currentLotVariantName.toLowerCase();
          if (lower.includes("auteuil")) reportNavKey = "vps-auteuil-central";
          else if (lower.includes("neuilly")) reportNavKey = "vps-neuilly-central";
        } else if (lotId === "lot-001") {
          reportNavKey = "lot-a-central";
        } else if (lotId === "lot-003") {
          const lotCVariant = currentLotVariantName || (() => { try { const v = JSON.parse(getPref("lot-variants") || "{}"); return v["lot-003"] || ""; } catch { return ""; } })();
          const lower = lotCVariant.toLowerCase();
          if (lower.includes("alpha")) reportNavKey = "lot-c-alpha-central";
          else if (lower.includes("bravo")) reportNavKey = "lot-c-bravo-central";
        } else if (lotId === "lot-cai") {
          reportNavKey = "lot-cai-central";
        }

        if (reportNavKey) {
          navigate(`/report/key/${encodeURIComponent(reportNavKey)}`);
        } else {
          navigate(`/report/${lotId}`);
        }
      }
    } catch (e: any) {
      toast.error(e?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setCompleting(false);
    }
  };

  if (!lot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">Lot introuvable</p>
          <Button variant="outline" onClick={() => navigate("/")} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const isSubChecked = (subId: string, variantId?: string, sacType?: string) => {
    return checks.some((c) => {
      if (c.sub_entity_id !== subId) return false;
      if (variantId && c.variant_id !== variantId) return false;
      if (!variantId && c.variant_id) return false;
      if (sacType && c.sac_type !== sacType) return false;
      if (!sacType && c.sac_type) return false;
      return true;
    });
  };

  const isLotBComplete = (subId: string) => {
    const variantId = selectedVariants[subId];
    if (!variantId) return false;
    return isSubChecked(subId, variantId, "soin") && isSubChecked(subId, variantId, "o2");
  };

  const isVariantComplete = (subId: string) => {
    const variantId = selectedVariants[subId];
    if (!variantId) return false;
    return isSubChecked(subId, variantId);
  };

  // Lot A: multiple Lot B instances support (gros postes de secours)
  const isLotA = lotId === "lot-001";
  const lotBSub = isLotA ? subEntities.find((s) => s.id === "lot-b") : null;
  const otherSubs = isLotA ? subEntities.filter((s) => s.id !== "lot-b") : subEntities;

  // Get already-used variant IDs across all Lot B instances (excluding a specific instance)
  const getUsedLotBVariants = (excludeIdx?: number): Set<string> => {
    const used = new Set<string>();
    lotBInstances.forEach((i) => {
      if (i === excludeIdx) return;
      const v = selectedVariants[`lot-b-${i}`];
      if (v) used.add(v);
    });
    return used;
  };

  // Check if a specific Lot B instance is complete
  const isLotBInstanceComplete = (idx: number): boolean => {
    const variantId = selectedVariants[`lot-b-${idx}`];
    if (!variantId) return false;
    return isSubChecked("lot-b", variantId, "soin") && isSubChecked("lot-b", variantId, "o2");
  };

  // Check if all Lot B instances are complete (for Lot A)
  const areAllLotBComplete = (): boolean => {
    if (!isLotA || !lotBSub) return true;
    return lotBInstances.every((idx) => isLotBInstanceComplete(idx));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-3">
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
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                  {lotId === "lot-001"
                    ? `${lot.name} — ${lot.location}`
                    : lot.variants && lot.variants.length > 0
                      ? (() => {
                          try {
                            const lotVarsRaw = getPref("lot-variants");
                            if (lotVarsRaw) {
                              const parsed = JSON.parse(lotVarsRaw);
                              const variantId = parsed[lotId || ""];
                              if (variantId) {
                                const variantObj = lot.variants.find((v) => v.id === variantId);
                                if (variantObj) return variantObj.name;
                              }
                            }
                          } catch { /* ignore */ }
                          return lot.name;
                        })()
                      : lot.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {session ? "Inventaire en cours" : "Sélectionnez un sous-ensemble à inventorier"}
                </p>
              </div>
            </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Nom du DPS — input or display */}
        <div className="mb-6">
          {!session ? (
            <div className="space-y-3">
              <label htmlFor="dps-name" className="block text-sm font-medium text-muted-foreground mb-1.5">
                Nom du DPS
              </label>
              <div className="flex items-center gap-3">
                <Input
                  id="dps-name"
                  type="text"
                  placeholder="Saisissez le nom du DPS..."
                  value={dpsName}
                  onChange={(e) => {
                    setDpsName(e.target.value);
                    if (e.target.value.trim()) {
                      setInterventionType("verification");
                    } else if (interventionType === "verification") {
                      setInterventionType("");
                    }
                  }}
                  className="max-w-md"
                  disabled={sessionLoading}
                />
                <Button
                  type="button"
                  variant={interventionType === "desinfection" ? "default" : "outline"}
                  onClick={() => {
                    setInterventionType("desinfection");
                    setDpsName("");
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
          ) : (
            <div className="flex items-center justify-between bg-primary/5 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  {session.intervention_type === "desinfection" ? (
                    <>
                      <p className="text-sm font-medium text-muted-foreground">Intervention</p>
                      <p className="text-lg font-semibold text-foreground">Désinfection</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-muted-foreground">DPS</p>
                      <p className="text-lg font-semibold text-foreground">{session.dps_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Vérification de matériel (DPS)</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAbandon}
                  disabled={abandoning}
                  className="cursor-pointer text-destructive hover:text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {abandoning ? "Abandon..." : "Abandonner"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sub-entities grid — only visible when session is active */}
        {session && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(isLotA ? otherSubs : subEntities).map((sub) => {
              const sections = configSections[sub.id] || [];
              const itemCount = sections.reduce(
                (total, section) => total + section.items.length,
                0
              );
              const hasVariants = sub.variants && sub.variants.length > 0;
              const selectedVariant = selectedVariants[sub.id];
              const isCompleted = hasVariants
                ? sub.inventoryType === "lot-b"
                  ? isLotBComplete(sub.id)
                  : isVariantComplete(sub.id)
                : isSubChecked(sub.id);

              return (
                <Card
                  key={sub.id}
                  className={`group transition-all duration-200 hover:shadow-md ${
                    isCompleted ? "border-emerald-300 bg-emerald-50/30" : "hover:border-primary/30"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {sub.name}
                      </CardTitle>
                      {isCompleted && (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sub.description && (
                      <p className="text-sm text-muted-foreground">
                        {sub.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4 shrink-0" />
                      <span>
                        {hasVariants
                          ? `${sub.variants!.length} variante${sub.variants!.length > 1 ? "s" : ""}`
                          : itemCount > 0
                            ? `${itemCount} article${itemCount > 1 ? "s" : ""} à vérifier`
                            : "Aucun article défini"}
                      </span>
                    </div>

                    {hasVariants && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">
                          {sub.inventoryType === "lot-b" ? "Choix du lot B :" : `Choix du ${sub.name.toLowerCase()} :`}
                        </label>
                        <Select
                          value={selectedVariant || ""}
                          onValueChange={(value) => persistVariant(sub.id, value)}
                        >
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue placeholder={`Choisir ${sub.inventoryType === "lot-b" ? "un lot B" : `un ${sub.name.toLowerCase()}`}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {sub.variants!.map((variant) => (
                              <SelectItem key={variant.id} value={variant.id} className="cursor-pointer">
                                {variant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="pt-3 border-t space-y-2">
                      {hasVariants && sub.inventoryType === "lot-b" ? (
                        <>
                          <Button
                            className="w-full cursor-pointer"
                            variant="default"
                            disabled={!selectedVariant}
                            onClick={() => {
                              if (selectedVariant) {
                                navigate(`/inventory/${lotId}/${sub.id}/${selectedVariant}/soin?session=${session.id}`);
                              }
                            }}
                          >
                            {isSubChecked(sub.id, selectedVariant, "soin") && (
                              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-200" />
                            )}
                            Vérifier le sac de soin
                          </Button>
                          <Button
                            className="w-full cursor-pointer"
                            variant="default"
                            disabled={!selectedVariant}
                            onClick={() => {
                              if (selectedVariant) {
                                navigate(`/inventory/${lotId}/${sub.id}/${selectedVariant}/o2?session=${session.id}`);
                              }
                            }}
                          >
                            {isSubChecked(sub.id, selectedVariant, "o2") && (
                              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-200" />
                            )}
                            Vérifier le sac d'O2
                          </Button>
                        </>
                      ) : hasVariants ? (
                        <Button
                          className="w-full cursor-pointer"
                          variant="default"
                          disabled={!selectedVariant}
                          onClick={() => {
                            if (selectedVariant) {
                              navigate(`/inventory/${lotId}/${sub.id}/${selectedVariant}?session=${session.id}`);
                            }
                          }}
                        >
                          Vérifier l'inventaire
                        </Button>
                      ) : (
                        <Button
                          className="w-full cursor-pointer"
                          variant="default"
                          onClick={() => navigate(`/inventory/${lotId}/${sub.id}?session=${session.id}`)}
                        >
                          Vérifier l'inventaire
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Lot A — Multiple Lot B instances (gros postes de secours) */}
        {session && isLotA && lotBSub && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Gros postes de secours (Lot B)
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLotBInstances((prev) => [...prev, prev.length > 0 ? Math.max(...prev) + 1 : 0]);
                }}
                disabled={lotBInstances.length >= (lotBSub.variants?.length || 0)}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un Lot B
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lotBInstances.map((idx, arrIndex) => {
                const instanceKey = `lot-b-${idx}`;
                const selectedVariant = selectedVariants[instanceKey];
                const usedVariants = getUsedLotBVariants(idx);
                const isCompleted = isLotBInstanceComplete(idx);

                return (
                  <Card
                    key={idx}
                    className={`group transition-all duration-200 hover:shadow-md ${
                      isCompleted ? "border-emerald-300 bg-emerald-50/30" : "hover:border-primary/30"
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold text-foreground">
                          Lot B #{arrIndex + 1}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          {isCompleted && (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          )}
                          {lotBInstances.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setLotBInstances((prev) => prev.filter((i) => i !== idx));
                                setSelectedVariants((prev) => {
                                  const next = { ...prev };
                                  delete next[instanceKey];
                                  setPref("selected-variants", JSON.stringify(next));
                                  return next;
                                });
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">
                          Choix du lot B :
                        </label>
                        <Select
                          value={selectedVariant || ""}
                          onValueChange={(value) => persistVariant(instanceKey, value)}
                        >
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue placeholder="Choisir un lot B..." />
                          </SelectTrigger>
                          <SelectContent>
                            {lotBSub.variants!.map((variant) => {
                              const isUsed = usedVariants.has(variant.id);
                              return (
                                <SelectItem
                                  key={variant.id}
                                  value={variant.id}
                                  disabled={isUsed}
                                  className={`cursor-pointer ${isUsed ? "opacity-50" : ""}`}
                                >
                                  {variant.name}
                                  {isUsed ? " (déjà sélectionné)" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="pt-3 border-t space-y-2">
                        <Button
                          className="w-full cursor-pointer"
                          variant="default"
                          disabled={!selectedVariant}
                          onClick={() => {
                            if (selectedVariant) {
                              navigate(`/inventory/${lotId}/lot-b/${selectedVariant}/soin?session=${session.id}`);
                            }
                          }}
                        >
                          {isSubChecked("lot-b", selectedVariant, "soin") && (
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-200" />
                          )}
                          Vérifier le sac de soin
                        </Button>
                        <Button
                          className="w-full cursor-pointer"
                          variant="default"
                          disabled={!selectedVariant}
                          onClick={() => {
                            if (selectedVariant) {
                              navigate(`/inventory/${lotId}/lot-b/${selectedVariant}/o2?session=${session.id}`);
                            }
                          }}
                        >
                          {isSubChecked("lot-b", selectedVariant, "o2") && (
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-200" />
                          )}
                          Vérifier le sac d'O2
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No session yet — show message + Valider button */}
        {!session && !sessionLoading && (
          <div className="text-center py-12 space-y-6">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">
              Saisissez et validez le nom du DPS pour commencer l'inventaire.
            </p>
            <Button
              onClick={handleValidateDps}
              disabled={(!dpsName.trim() && interventionType !== "desinfection") || creatingSession}
              className="cursor-pointer"
              size="lg"
            >
              {creatingSession ? "Création..." : "Valider"}
            </Button>
          </div>
        )}

        {/* Loading */}
        {sessionLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement de la session...</p>
          </div>
        )}
      </main>

      {/* Bouton Sauvegarder/Envoyer en bas — only when session is active */}
      {session && (
        <footer className="border-t bg-card">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Button
              className="w-full sm:w-auto cursor-pointer"
              variant="default"
              size="lg"
              onClick={handleSave}
              disabled={completing}
            >
              <Save className="h-4 w-4 mr-2" />
              {completing ? "Sauvegarde..." : "Sauvegarder / Envoyer"}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}