import { useState, useEffect, useCallback } from "react";
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
import { lots, lotSubEntities, subEntitySections } from "@/data/lots";
import { ArrowLeft, ClipboardList, Package, CheckCircle2, Save, XCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { addLogEntry } from "./Log";
import {
  getActiveSession,
  createSession,
  abandonSession,
  completeSession,
  getSubEntityChecks,
  markSubEntity,
  type SessionData,
  type SubEntityCheckData,
} from "@/lib/inventory-api";

const POLL_INTERVAL = 5000; // 5 seconds

export default function SubEntitiesPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const lot = lots.find((l) => l.id === lotId);
  const subEntities = lotId ? lotSubEntities[lotId] || [] : [];

  const [dpsName, setDpsName] = useState(() => localStorage.getItem("dps-name") || "");
  const [session, setSession] = useState<SessionData | null>(null);
  const [checks, setChecks] = useState<SubEntityCheckData[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    try {
      const raw = localStorage.getItem("selected-variants");
      if (raw) Object.assign(initial, JSON.parse(raw));
    } catch { /* ignore */ }
    // Pre-select sub-entity variants based on homepage lot variant selection
    try {
      const lotVars = localStorage.getItem("lot-variants");
      if (lotVars) {
        const parsed = JSON.parse(lotVars);
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
            initial["lot-b"] = lotAVariant;
          }
        }
      }
    } catch { /* ignore */ }
    localStorage.setItem("selected-variants", JSON.stringify(initial));
    return initial;
  });

  // Load or create session on mount
  useEffect(() => {
    const initSession = async () => {
      if (!lotId) return;
      setSessionLoading(true);
      try {
        // Check localStorage for existing session ID
        const storedSessionId = localStorage.getItem("active-session-id");
        if (storedSessionId) {
          // Verify the session is still active
          const activeSession = await getActiveSession(lotId);
          if (activeSession && activeSession.id === parseInt(storedSessionId) && activeSession.status === "active") {
            setSession(activeSession);
            setDpsName(activeSession.dps_name);
            localStorage.setItem("dps-name", activeSession.dps_name);
            // Load checks
            const checksData = await getSubEntityChecks(activeSession.id);
            setChecks(checksData);
            setSessionLoading(false);
            return;
          }
        }

        // Check if there's an active session for this lot
        const activeSession = await getActiveSession(lotId);
        if (activeSession && activeSession.status === "active") {
          setSession(activeSession);
          setDpsName(activeSession.dps_name);
          localStorage.setItem("dps-name", activeSession.dps_name);
          localStorage.setItem("active-session-id", String(activeSession.id));
          localStorage.setItem("active-session-dps", activeSession.dps_name);
          // Load checks
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
      localStorage.setItem("selected-variants", JSON.stringify(next));
      return next;
    });
  };

  const handleValidateDps = async () => {
    if (!dpsName.trim()) {
      toast.error("Veuillez saisir le nom du DPS.");
      return;
    }
    if (!lotId) return;

    setCreatingSession(true);
    try {
      // Get variant from homepage selection
      const lotVars = localStorage.getItem("lot-variants");
      let variantId: string | null = null;
      if (lotVars) {
        try {
          const parsed = JSON.parse(lotVars);
          variantId = parsed[lotId] || null;
        } catch { /* ignore */ }
      }

      const newSession = await createSession(lotId, dpsName.trim(), variantId);
      setSession(newSession);
      localStorage.setItem("dps-name", dpsName.trim());
      localStorage.setItem("active-session-id", String(newSession.id));
      localStorage.setItem("active-session-dps", dpsName.trim());
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
      localStorage.removeItem("active-session-id");
      localStorage.removeItem("active-session-dps");
      localStorage.removeItem("dps-name");
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
      subEntities.forEach((sub) => {
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
              addLogEntry({
                lotId: lotId || "",
                lotName: lot?.name || "",
                subEntityName: sub.name,
                variantName: variantObj?.name || null,
                sacType: "soin",
                dpsName: dpsNameValue,
                completedAt: new Date().toISOString(),
                completedKey: `${lotId}-${sub.id}-${selectedVariant}-soin`,
              });
            }
            if (o2Check) {
              const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
              addLogEntry({
                lotId: lotId || "",
                lotName: lot?.name || "",
                subEntityName: sub.name,
                variantName: variantObj?.name || null,
                sacType: "o2",
                dpsName: dpsNameValue,
                completedAt: new Date().toISOString(),
                completedKey: `${lotId}-${sub.id}-${selectedVariant}-o2`,
              });
            }
          }
        } else if (hasVariants) {
          if (selectedVariant) {
            const check = checks.find(
              (c) => c.sub_entity_id === sub.id && c.variant_id === selectedVariant && !c.sac_type
            );
            if (check) {
              const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
              addLogEntry({
                lotId: lotId || "",
                lotName: lot?.name || "",
                subEntityName: sub.name,
                variantName: variantObj?.name || null,
                sacType: null,
                dpsName: dpsNameValue,
                completedAt: new Date().toISOString(),
                completedKey: `${lotId}-${sub.id}-${selectedVariant}`,
              });
            }
          }
        } else {
          const check = checks.find(
            (c) => c.sub_entity_id === sub.id && !c.variant_id && !c.sac_type
          );
          if (check) {
            addLogEntry({
              lotId: lotId || "",
              lotName: lot?.name || "",
              subEntityName: sub.name,
              variantName: null,
              sacType: null,
              dpsName: dpsNameValue,
              completedAt: new Date().toISOString(),
              completedKey: `${lotId}-${sub.id}`,
            });
          }
        }
      });

      // Clear session state
      localStorage.removeItem("active-session-id");
      localStorage.removeItem("active-session-dps");
      localStorage.removeItem("dps-name");

      toast.success("Inventaire sauvegardé et envoyé !");

      if (lotId) {
        navigate(`/report/${lotId}`);
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

  const getCheckerName = (subId: string, variantId?: string, sacType?: string): string | null => {
    const check = checks.find((c) => {
      if (c.sub_entity_id !== subId) return false;
      if (variantId && c.variant_id !== variantId) return false;
      if (!variantId && c.variant_id) return false;
      if (sacType && c.sac_type !== sacType) return false;
      if (!sacType && c.sac_type) return false;
      return true;
    });
    return check?.checker_name || null;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                            const lotVars = localStorage.getItem("lot-variants");
                            if (lotVars) {
                              const parsed = JSON.parse(lotVars);
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
                  onChange={(e) => setDpsName(e.target.value)}
                  className="max-w-md"
                  disabled={sessionLoading}
                />
                <Button
                  onClick={handleValidateDps}
                  disabled={!dpsName.trim() || creatingSession}
                  className="cursor-pointer"
                >
                  {creatingSession ? "Création..." : "Valider"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Validez le nom du DPS pour accéder aux sous-ensembles.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-primary/5 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">DPS</p>
                  <p className="text-lg font-semibold text-foreground">{session.dps_name}</p>
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
            {subEntities.map((sub) => {
              const sections = subEntitySections[sub.id] || [];
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

              const checkerInfo = hasVariants
                ? sub.inventoryType === "lot-b"
                  ? selectedVariant
                    ? [
                        getCheckerName(sub.id, selectedVariant, "soin"),
                        getCheckerName(sub.id, selectedVariant, "o2"),
                      ].filter(Boolean).join(", ")
                    : null
                  : selectedVariant
                    ? getCheckerName(sub.id, selectedVariant)
                    : null
                : getCheckerName(sub.id);

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

                    {checkerInfo && (
                      <div className="text-xs text-emerald-600 bg-emerald-50 rounded px-2 py-1">
                        Vérifié par : {checkerInfo}
                      </div>
                    )}

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

        {/* No session yet — show message */}
        {!session && !sessionLoading && (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">
              Saisissez et validez le nom du DPS pour commencer l'inventaire.
            </p>
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