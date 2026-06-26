import { useEffect, useRef, useState } from "react";
import { CATEGORY_META, projectTerm, type Category } from "../types";

interface Props {
  category: Category;
  onClose: () => void;
  onCreate: (name: string) => void;
}

// Modal con el estilo de la app para crear un proyecto/curso
// (reemplaza al prompt() nativo del navegador).
export default function ProjectModal({ category, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const term = projectTerm(category).toLowerCase();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim());
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold mb-1 text-fg flex items-center gap-2">
          <span className="text-accent">📁</span> Nuevo {term}
        </h2>
        <p className="text-xs text-fg-dim mb-4">
          En el apartado {CATEGORY_META[category].icon} {CATEGORY_META[category].label}
        </p>

        <label className="block text-xs text-fg-dim mb-1">Nombre del {term}</label>
        <input
          ref={inputRef}
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={category === "Estudios" ? "ej: Certificación AWS" : "ej: Rediseño web"}
        />

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary px-5 py-2 text-sm" disabled={!name.trim()} onClick={submit}>
            Crear {term}
          </button>
        </div>
      </div>
    </div>
  );
}
