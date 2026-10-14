'use client';

import {
  X,
  Sparkles,
  AlertCircle,
  UserCheck,
  RefreshCw,
  Route,
} from 'lucide-react';

interface DniSearchModalProps {
  isOpen: boolean;
  dni: string;
  loading: boolean;
  errorMsg: string | null;
  hasPasajero: boolean;
  saludoCompleto?: string;
  onDniChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onClose: () => void;
}

export function DniSearchModal({
  isOpen,
  dni,
  loading,
  errorMsg,
  hasPasajero,
  saludoCompleto,
  onDniChange,
  onSubmit,
  onClose,
}: DniSearchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header del Modal con Logo Oficial Pointly */}
        <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-white text-center relative border-b border-slate-800/90">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-xl shadow-blue-500/10 mx-auto mb-3 border border-slate-100">
            <img
              src="/logo.png"
              alt="Pointly"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Pointly</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
              En Vivo
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Consulte con su DNI su zona de abordaje y la ruta continua hacia el bus
          </p>

          {hasPasajero && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Formulario solo DNI */}
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {/* Saludo si ya se ha consultado a una persona */}
          {hasPasajero && saludoCompleto && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-800/80 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-white block">
                  {saludoCompleto}
                </span>
                <span className="text-[11px] text-emerald-300">
                  Ya estás monitoreando tu ruta activa. Puedes consultar otro DNI si deseas.
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Número de Documento (DNI)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserCheck className="w-4 h-4" />
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={dni}
                onChange={(e) => onDniChange(e.target.value)}
                placeholder="Ingrese su DNI"
                required
                autoFocus
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/90 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Verificando manifiesto...</span>
              </>
            ) : (
              <>
                <Route className="w-4 h-4 text-white" />
                <span>Ver Mi Abordaje y Ruta</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
