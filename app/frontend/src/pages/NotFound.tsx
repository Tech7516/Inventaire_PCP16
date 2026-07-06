import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <FileQuestion className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <h1 className="text-2xl font-semibold text-foreground">
          Page introuvable
        </h1>
        <p className="text-sm text-muted-foreground">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Button onClick={() => navigate("/")} className="cursor-pointer">
          Retour à l'accueil
        </Button>
      </div>
    </div>
  );
}