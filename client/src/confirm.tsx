import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean; // botón de confirmar en rojo (acciones destructivas)
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

// Hook para pedir confirmación: `if (await confirm({ title, ... })) { ... }`
export function useConfirm() {
  return useContext(ConfirmContext);
}

interface State extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in"
          onClick={(e) => e.target === e.currentTarget && close(false)}
        >
          <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-fg flex items-center gap-2 mb-2">
              <span className={state.danger ? "text-red-400" : "text-accent"}>
                {state.danger ? "⚠️" : "❓"}
              </span>
              {state.title}
            </h2>
            {state.message && <p className="text-sm text-fg-dim mb-5">{state.message}</p>}
            <div className="flex justify-end gap-3 mt-2">
              <button className="btn-ghost px-4 py-2 text-sm" onClick={() => close(false)}>
                {state.cancelText ?? "Cancelar"}
              </button>
              <button
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition ${
                  state.danger
                    ? "bg-red-500 hover:bg-red-400 text-white"
                    : "btn-primary"
                }`}
                onClick={() => close(true)}
              >
                {state.confirmText ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
