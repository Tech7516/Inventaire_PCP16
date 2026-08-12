import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Package,
  FolderTree,
  Boxes,
  Settings,
} from "lucide-react";
import {
  loadAllLotConfigs,
  saveLotConfig,
  deleteLotConfig,
  generateId,
  createEmptyLotConfig,
  createEmptySubEntity,
  createEmptySection,
  createEmptyItem,
  type LotConfig,
} from "@/lib/configStore";
import type { Lot, SubEntity, ConsumableSection, ConsumableItem, LotVariant } from "@/data/lots";

export default function AdminPage() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<LotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAllLotConfigs();
      setConfigs(data);
    } catch {
      toast.error("Erreur lors du chargement des configurations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const toggleLot = (lotId: string) => {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  const toggleSub = (subKey: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(subKey)) next.delete(subKey);
      else next.add(subKey);
      return next;
    });
  };

  // --- Lot operations ---

  const handleAddLot = () => {
    const lotId = generateId("lot-custom");
    const newConfig = createEmptyLotConfig(lotId, "Nouveau lot");
    setConfigs((prev) => [...prev, newConfig]);
    setExpandedLots((prev) => new Set(prev).add(lotId));
  };

  const updateLot = (lotId: string, updates: Partial<Lot>) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId ? { ...c, lot: { ...c.lot, ...updates } } : c
      )
    );
  };

  const handleSaveLot = async (config: LotConfig) => {
    setSaving(config.lot.id);
    try {
      await saveLotConfig(config);
      toast.success(`Configuration "${config.lot.name}" sauvegardée`);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteLot = async (lotId: string, lotName: string) => {
    if (!confirm(`Supprimer le lot "${lotName}" ? Cette action est irréversible.`)) return;
    setConfigs((prev) => prev.filter((c) => c.lot.id !== lotId));
    try {
      await deleteLotConfig(lotId);
      toast.success(`Lot "${lotName}" supprimé`);
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  // --- Variant operations ---

  const addVariant = (lotId: string) => {
    const variantId = generateId("var");
    const newVariant: LotVariant = { id: variantId, name: "Nouvelle variante" };
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? { ...c, lot: { ...c.lot, variants: [...(c.lot.variants || []), newVariant] } }
          : c
      )
    );
  };

  const updateVariant = (lotId: string, variantId: string, name: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId && c.lot.variants
          ? {
              ...c,
              lot: {
                ...c.lot,
                variants: c.lot.variants.map((v) =>
                  v.id === variantId ? { ...v, name } : v
                ),
              },
            }
          : c
      )
    );
  };

  const removeVariant = (lotId: string, variantId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId && c.lot.variants
          ? { ...c, lot: { ...c.lot, variants: c.lot.variants.filter((v) => v.id !== variantId) } }
          : c
      )
    );
  };

  // --- Sub-entity operations ---

  const addSubEntity = (lotId: string) => {
    const subId = generateId("sub");
    const newSub: SubEntity = createEmptySubEntity(subId, "Nouveau sous-ensemble");
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? { ...c, subEntities: [...c.subEntities, newSub], sections: { ...c.sections, [subId]: [] } }
          : c
      )
    );
    setExpandedSubs((prev) => new Set(prev).add(`${lotId}::${subId}`));
  };

  const updateSubEntity = (lotId: string, subId: string, updates: Partial<SubEntity>) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? {
              ...c,
              subEntities: c.subEntities.map((s) =>
                s.id === subId ? { ...s, ...updates } : s
              ),
            }
          : c
      )
    );
  };

  const removeSubEntity = (lotId: string, subId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? {
              ...c,
              subEntities: c.subEntities.filter((s) => s.id !== subId),
              sections: Object.fromEntries(
                Object.entries(c.sections).filter(([key]) => !key.startsWith(subId))
              ),
            }
          : c
      )
    );
  };

  // --- Sub-entity variant operations ---

  const addSubVariant = (lotId: string, subId: string) => {
    const variantId = generateId("subvar");
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? {
              ...c,
              subEntities: c.subEntities.map((s) =>
                s.id === subId
                  ? { ...s, variants: [...(s.variants || []), { id: variantId, name: "Nouvelle variante" }] }
                  : s
              ),
            }
          : c
      )
    );
  };

  const updateSubVariant = (lotId: string, subId: string, variantId: string, name: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? {
              ...c,
              subEntities: c.subEntities.map((s) =>
                s.id === subId && s.variants
                  ? { ...s, variants: s.variants.map((v) => (v.id === variantId ? { ...v, name } : v)) }
                  : s
              ),
            }
          : c
      )
    );
  };

  const removeSubVariant = (lotId: string, subId: string, variantId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? {
              ...c,
              subEntities: c.subEntities.map((s) =>
                s.id === subId && s.variants
                  ? { ...s, variants: s.variants.filter((v) => v.id !== variantId) }
                  : s
              ),
            }
          : c
      )
    );
  };

  // --- Section operations ---

  const getSectionKey = (lotId: string, subId: string, sacType?: string) => {
    if (sacType) return `${subId}-${sacType}`;
    return subId;
  };

  const addSection = (lotId: string, sectionKey: string) => {
    const sectionId = generateId("sec");
    const newSection: ConsumableSection = createEmptySection(sectionId, "Nouvelle section");
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId
          ? { ...c, sections: { ...c.sections, [sectionKey]: [...(c.sections[sectionKey] || []), newSection] } }
          : c
      )
    );
  };

  const updateSection = (lotId: string, sectionKey: string, sectionId: string, title: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId && c.sections[sectionKey]
          ? {
              ...c,
              sections: {
                ...c.sections,
                [sectionKey]: c.sections[sectionKey].map((s) =>
                  s.id === sectionId ? { ...s, title } : s
                ),
              },
            }
          : c
      )
    );
  };

  const removeSection = (lotId: string, sectionKey: string, sectionId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId && c.sections[sectionKey]
          ? {
              ...c,
              sections: {
                ...c.sections,
                [sectionKey]: c.sections[sectionKey].filter((s) => s.id !== sectionId),
              },
            }
          : c
      )
    );
  };

  // --- Item operations ---

  const addItem = (lotId: string, sectionKey: string, sectionId: string) => {
    const itemId = generateId("item");
    const newItem: ConsumableItem = createEmptyItem(itemId, "Nouvel article");
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId && c.sections[sectionKey]
          ? {
              ...c,
              sections: {
                ...c.sections,
                [sectionKey]: c.sections[sectionKey].map((s) =>
                  s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s
                ),
              },
            }
          : c
      )
    );
  };

  const updateItem = (
    lotId: string,
    sectionKey: string,
    sectionId: string,
    itemId: string,
    updates: Partial<ConsumableItem>
  ) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId && c.sections[sectionKey]
          ? {
              ...c,
              sections: {
                ...c.sections,
                [sectionKey]: c.sections[sectionKey].map((s) =>
                  s.id === sectionId
                    ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, ...updates } : it)) }
                    : s
                ),
              },
            }
          : c
      )
    );
  };

  const removeItem = (lotId: string, sectionKey: string, sectionId: string, itemId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.lot.id === lotId && c.sections[sectionKey]
          ? {
              ...c,
              sections: {
                ...c.sections,
                [sectionKey]: c.sections[sectionKey].map((s) =>
                  s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s
                ),
              },
            }
          : c
      )
    );
  };

  // --- Render helpers ---

  const renderItems = (
    lotId: string,
    sectionKey: string,
    section: ConsumableSection
  ) => (
    <div className="space-y-2 pl-2 sm:pl-8">
      {section.items.map((item) => (
        <div key={item.id} className="bg-muted/30 rounded-md p-2">
          <div className="flex items-center gap-2">
            <Input
              value={item.name}
              onChange={(e) => updateItem(lotId, sectionKey, section.id, item.id, { name: e.target.value })}
              className="flex-1 h-8 text-sm"
              placeholder="Nom de l'article"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={() => removeItem(lotId, sectionKey, section.id, item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Qté:</Label>
            <Input
              type="number"
              min={0}
              value={item.expectedQuantity}
              onChange={(e) =>
                updateItem(lotId, sectionKey, section.id, item.id, {
                  expectedQuantity: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-20 h-8 text-sm text-center"
            />
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => addItem(lotId, sectionKey, section.id)}
      >
        <Plus className="h-3 w-3 mr-1" />
        Ajouter un article
      </Button>
    </div>
  );

  const renderSections = (lotId: string, sectionKey: string) => {
    const config = configs.find((c) => c.lot.id === lotId);
    if (!config) return null;
    const sections = config.sections[sectionKey] || [];

    return (
      <div className="space-y-3 pl-2 sm:pl-4">
        {sections.map((section) => (
          <div key={section.id} className="border rounded-md p-3 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={section.title}
                onChange={(e) => updateSection(lotId, sectionKey, section.id, e.target.value)}
                className="flex-1 h-8 text-sm font-medium"
                placeholder="Titre de la section"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeSection(lotId, sectionKey, section.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {renderItems(lotId, sectionKey, section)}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => addSection(lotId, sectionKey)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Ajouter une section
        </Button>
      </div>
    );
  };

  const renderSubEntity = (lotId: string, sub: SubEntity) => {
    const subKey = `${lotId}::${sub.id}`;
    const isExpanded = expandedSubs.has(subKey);
    const sectionKey = getSectionKey(lotId, sub.id);

    return (
      <div key={sub.id} className="border rounded-md">
        <div
          className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30"
          onClick={() => toggleSub(subKey)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <FolderTree className="h-4 w-4 shrink-0 text-primary" />
          <Input
            value={sub.name}
            onChange={(e) => updateSubEntity(lotId, sub.id, { name: e.target.value })}
            className="flex-1 h-8 text-sm font-medium"
            onClick={(e) => e.stopPropagation()}
            placeholder="Nom du sous-ensemble"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              removeSubEntity(lotId, sub.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-3">
            {/* Sub-entity variants */}
            {sub.variants && sub.variants.length > 0 && (
              <div className="space-y-1 pl-2 sm:pl-4">
                <Label className="text-xs text-muted-foreground">Variantes du sous-ensemble :</Label>
                {sub.variants.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <Input
                      value={v.name}
                      onChange={(e) => updateSubVariant(lotId, sub.id, v.id, e.target.value)}
                      className="flex-1 h-7 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeSubVariant(lotId, sub.id, v.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs ml-2 sm:ml-4"
              onClick={() => addSubVariant(lotId, sub.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter une variante
            </Button>

            {/* Inventory type selector */}
            <div className="flex items-center gap-2 pl-2 sm:pl-4">
              <Label className="text-xs text-muted-foreground">Type d'inventaire :</Label>
              <select
                value={sub.inventoryType || "standard"}
                onChange={(e) =>
                  updateSubEntity(lotId, sub.id, {
                    inventoryType: e.target.value === "lot-b" ? "lot-b" : undefined,
                  })
                }
                className="text-xs border rounded px-2 py-1 bg-background"
              >
                <option value="standard">Standard</option>
                <option value="lot-b">Lot B (sac de soin + sac d'O2)</option>
              </select>
            </div>

            {/* Sections */}
            <div className="pl-2 sm:pl-4">
              <Label className="text-xs text-muted-foreground mb-2 block">Sections et articles :</Label>
              {renderSections(lotId, sectionKey)}
            </div>

            {/* Lot B specific: sac de soin / sac d'O2 */}
            {sub.inventoryType === "lot-b" && (
              <div className="pl-2 sm:pl-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Sac de soin :</Label>
                  {renderSections(lotId, `${sub.id}-soin`)}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Sac d'O2 :</Label>
                  {renderSections(lotId, `${sub.id}-o2`)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLot = (config: LotConfig) => {
    const lot = config.lot;
    const isExpanded = expandedLots.has(lot.id);
    const itemCount = Object.values(config.sections).reduce(
      (sum, sections) => sum + sections.reduce((s, sec) => s + sec.items.length, 0),
      0
    );

    return (
      <Card key={lot.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 cursor-pointer"
            onClick={() => toggleLot(lot.id)}
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0" />
              )}
              <Package className="h-5 w-5 shrink-0 text-primary" />
              <CardTitle className="text-base">{lot.name}</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground sm:ml-auto">
              {config.subEntities.length} sous-ensemble(s) · {itemCount} article(s)
            </span>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* Lot properties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nom du lot</Label>
                <Input
                  value={lot.name}
                  onChange={(e) => updateLot(lot.id, { name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Localisation</Label>
                <Input
                  value={lot.location}
                  onChange={(e) => updateLot(lot.id, { location: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Ex: Passy"
                />
              </div>
            </div>

            {/* Direct inventory toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id={`direct-${lot.id}`}
                checked={lot.directInventory || false}
                onCheckedChange={(checked) =>
                  updateLot(lot.id, { directInventory: checked === true })
                }
              />
              <Label htmlFor={`direct-${lot.id}`} className="text-sm cursor-pointer">
                Inventaire direct (sans page sous-ensembles)
              </Label>
            </div>

            {/* Lot variants */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Variantes du lot :</Label>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => addVariant(lot.id)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Variante
                </Button>
              </div>
              {lot.variants && lot.variants.length > 0 && (
                <div className="space-y-1">
                  {lot.variants.map((v) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <Input
                        value={v.name}
                        onChange={(e) => updateVariant(lot.id, v.id, e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeVariant(lot.id, v.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-entities */}
            {!lot.directInventory && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Sous-ensembles :</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => addSubEntity(lot.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Sous-ensemble
                  </Button>
                </div>
                {config.subEntities.map((sub) => renderSubEntity(lot.id, sub))}
              </div>
            )}

            {/* Direct inventory sections */}
            {lot.directInventory && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sections (inventaire direct) :</Label>
                {renderSections(lot.id, lot.id)}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                size="sm"
                onClick={() => handleSaveLot(config)}
                disabled={saving === lot.id}
              >
                <Save className="h-4 w-4 mr-1" />
                {saving === lot.id ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDeleteLot(lot.id, lot.name)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                  Administration
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Modifier les quantités et créer de nouveaux lots
                </p>
              </div>
            </div>
            <Button onClick={handleAddLot} disabled={loading} className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau lot
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement des configurations...
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-12">
            <Boxes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Aucun lot configuré</p>
            <Button onClick={handleAddLot}>
              <Plus className="h-4 w-4 mr-2" />
              Créer le premier lot
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map((config) => renderLot(config))}
          </div>
        )}
      </main>
    </div>
  );
}