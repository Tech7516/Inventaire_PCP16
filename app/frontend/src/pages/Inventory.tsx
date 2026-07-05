import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { lots } from "@/data/lots";
import { ArrowLeft, Plus, Trash2, Save, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  condition: string;
  comment: string;
}

export default function InventoryPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const lot = lots.find((l) => l.id === lotId);

  const [items, setItems] = useState<InventoryItem[]>([
    { id: crypto.randomUUID(), name: "", quantity: 1, condition: "bon", comment: "" },
  ]);

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

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), name: "", quantity: 1, condition: "bon", comment: "" },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error("Vous devez garder au moins une ligne");
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof InventoryItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSubmit = () => {
    const emptyItems = items.filter((item) => !item.name.trim());
    if (emptyItems.length > 0) {
      toast.error("Veuillez remplir le nom de tous les articles");
      return;
    }
    toast.success(`Inventaire enregistré avec ${items.length} article(s)`);
    console.log("Inventaire soumis:", { lotId, items });
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
                <ClipboardList className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {lot.name}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {lot.location}
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleSubmit} className="cursor-pointer">
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-4">
          {items.map((item, index) => (
            <Card key={item.id} className="transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Article {index + 1}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor={`name-${item.id}`}>Nom de l'article</Label>
                    <Input
                      id={`name-${item.id}`}
                      placeholder="Ex: Ordinateur portable"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`quantity-${item.id}`}>Quantité</Label>
                    <Input
                      id={`quantity-${item.id}`}
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`condition-${item.id}`}>État</Label>
                    <Select
                      value={item.condition}
                      onValueChange={(value) => updateItem(item.id, "condition", value)}
                    >
                      <SelectTrigger id={`condition-${item.id}`} className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bon" className="cursor-pointer">Bon état</SelectItem>
                        <SelectItem value="use" className="cursor-pointer">Usé</SelectItem>
                        <SelectItem value="endommage" className="cursor-pointer">Endommagé</SelectItem>
                        <SelectItem value="hors-service" className="cursor-pointer">Hors service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor={`comment-${item.id}`}>Commentaire</Label>
                    <Textarea
                      id={`comment-${item.id}`}
                      placeholder="Remarques..."
                      value={item.comment}
                      onChange={(e) => updateItem(item.id, "comment", e.target.value)}
                      className="resize-none h-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={addItem}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un article
          </Button>
        </div>
      </main>
    </div>
  );
}