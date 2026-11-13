'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { CITIES } from '@/data/cities';
import { useAuth } from '@/store/auth';
import type { PursuitAlert } from '@/lib/socket';
import type { FactionInfo, FactionType, WantedSuspect } from '@/types/game';

interface FactionMeta extends FactionInfo {
  badge: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
}

const FACTION_CATALOG: FactionMeta[] = [
  {
    id: 'POLICE',
    name: 'Policía Nacional',
    shortName: 'CNP',
    badge: '🛡️',
    description:
      'Cuerpo urbano encargado de mantener el orden en las grandes ciudades y dar caza a sospechosos buscados.',
    perks: [
      'Acceso al botón Interceptar en zonas urbanas',
      'Recompensas en € y XP por capturar sospechosos',
      'Menor riesgo en controles policiales de ciudad',
    ],
    accentBorder: 'border-sky-500/40',
    accentBg: 'bg-sky-500/15',
    accentText: 'text-sky-300',
  },
  {
    id: 'GUARDIA_CIVIL',
    name: 'Guardia Civil',
    shortName: 'GC',
    badge: '⚔️',
    description:
      'Autoridad en carreteras, autopistas y rutas interurbanas de España. Implacable contra el contrabando.',
    perks: [
      'Acceso al botón Interceptar en cualquier zona',
      'Inmunidad o ventaja en controles de autovía',
      'Bonificación por interceptaciones de alto calor',
    ],
    accentBorder: 'border-emerald-500/40',
    accentBg: 'bg-emerald-500/15',
    accentText: 'text-emerald-300',
  },
  {
    id: 'SYNDICATE',
    name: 'Sindicato del Crimen',
    shortName: 'Sindicato',
    badge: '🕶️',
    description:
      'Red clandestina que controla el mercado negro, los golpes de alto riesgo y la calle nocturna.',
    perks: [
      '+15% de botín en acciones ilegales y callejeras',
      'Reducción de fianza en el calabozo',
      'Respeto extra en barrios de calle y noche',
    ],
    accentBorder: 'border-red-500/40',
    accentBg: 'bg-red-500/15',
    accentText: 'text-red-300',
  },
  {
    id: 'ENTREPRENEUR',
    name: 'Gremio Empresarial',
    shortName: 'Gremio',
    badge: '💼',
    description:
      'Élite financiera e inmobiliaria. Maximiza ingresos legales, alquileres y contactos VIP.',
    perks: [
      '+15% rendimiento en propiedades y negocios',
      'Enfriamiento más rápido del nivel de calor',
      'Acceso preferente en distritos financieros',
    ],
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-500/15',
    accentText: 'text-amber-300',
  },
  {
    id: 'CIVILIAN',
    name: 'Ciudadano Libre',
    shortName: 'Civil',
    badge: '🏙️',
    description:
      'Sin ataduras ni juramentos. Muévete por libre entre lo legal y lo gris sin obligaciones de cuerpo.',
    perks: [
      'Sin restricciones de facción ni rivalidades directas',
      'Cambio de facción flexible en cualquier momento',
      'Perfil bajo ante patrullas rutinarias',
    ],
    accentBorder: 'border-zinc-600/50',
    accentBg: 'bg-zinc-800/60',
    accentText: 'text-zinc-300',
  },
];

function formatCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

function resolveZoneLabel(locationId: string | null): string {
  if (!locationId) return 'Desconocida';
  const city = CITIES.find((c) => c.id === locationId);
  if (!city) return locationId;
  return `${city.city} · ${city.name}`;
}

function renderStars(wantedLevel: number, heat: number): string {
  const level =
    wantedLevel > 0
      ? Math.min(5, Math.max(1, wantedLevel))
      : heat >= 90
        ? 5
        : heat >= 75
          ? 4
          : heat >= 60
            ? 3
            : heat >= 50
              ? 2
              : 1;
  return '★'.repeat(level) + '☆'.repeat(5 - level);
}

export default function FactionsPanel({
  pursuitAlerts = [],
}: {
  pursuitAlerts?: PursuitAlert[];
}) {
  const { token, player, refreshPlayer } = useAuth();
  const [factions, setFactions] = useState<FactionMeta[]>(FACTION_CATALOG);
  const [wanted, setWanted] = useState<WantedSuspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  const jailUntilMs = player?.jailUntil
    ? new Date(player.jailUntil).getTime()
    : 0;
  const inJail = Number.isFinite(jailUntilMs) && jailUntilMs > now;
  const jailRemainingMs = Math.max(0, jailUntilMs - now);

  useEffect(() => {
    if (!inJail) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inJail]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [factionsRes, wantedRes] = await Promise.allSettled([
        api.factions(),
        api.wantedList(),
      ]);

      if (factionsRes.status === 'fulfilled' && factionsRes.value) {
        const rawList = Array.isArray(factionsRes.value)
          ? factionsRes.value
          : Array.isArray(factionsRes.value.factions)
            ? factionsRes.value.factions
            : [];

        if (rawList.length > 0) {
          const merged = FACTION_CATALOG.map((base) => {
            const remote = rawList.find((r) => r.id === base.id);
            if (!remote) return base;
            return {
              ...base,
              ...remote,
              perks:
                Array.isArray(remote.perks) && remote.perks.length > 0
                  ? remote.perks
                  : base.perks,
            };
          });
          setFactions(merged);
        }
      }

      if (wantedRes.status === 'fulfilled' && wantedRes.value) {
        const list = Array.isArray(wantedRes.value)
          ? wantedRes.value
          : Array.isArray(wantedRes.value.suspects)
            ? wantedRes.value.suspects
            : Array.isArray(wantedRes.value.wanted)
              ? wantedRes.value.wanted
              : [];
        setWanted(list.filter((s) => (s.heat ?? 0) >= 40));
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (pursuitAlerts.length > 0) {
      void loadData();
    }
  }, [pursuitAlerts.length, loadData]);

  const currentFaction: FactionType = player?.faction ?? 'CIVILIAN';
  const isLawEnforcement =
    currentFaction === 'POLICE' || currentFaction === 'GUARDIA_CIVIL';

  const activeFactionMeta = useMemo(
    () =>
      factions.find((f) => f.id === currentFaction) ??
      FACTION_CATALOG[FACTION_CATALOG.length - 1],
    [factions, currentFaction],
  );

  async function handleJoinFaction(factionId: FactionType) {
    if (!token || busyAction || factionId === currentFaction) return;
    setBusyAction(`join:${factionId}`);
    setMsg(null);
    try {
      const res = await api.joinFaction(factionId);
      setMsg({
        text: res?.message || `Te has unido a ${factionId}`,
        tone: 'ok',
      });
      await Promise.all([refreshPlayer(), loadData()]);
    } catch (e: unknown) {
      setMsg({
        text: e instanceof Error ? e.message : 'No se pudo cambiar de facción',
        tone: 'err',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePayBail() {
    if (!token || busyAction) return;
    setBusyAction('bail');
    setMsg(null);
    try {
      const res = await api.payBail();
      setMsg({
        text:
          res?.message ||
          `Fianza pagada${res?.paidEuros ? ` (${res.paidEuros.toLocaleString('es-ES')} €)` : ''}. ¡Eres libre!`,
        tone: 'ok',
      });
      await Promise.all([refreshPlayer(), loadData()]);
    } catch (e: unknown) {
      setMsg({
        text: e instanceof Error ? e.message : 'Error al pagar la fianza',
        tone: 'err',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleIntercept(suspect: WantedSuspect) {
    const targetId = suspect.playerId || suspect.id;
    if (!token || !targetId || busyAction) return;
    setBusyAction(`intercept:${targetId}`);
    setMsg(null);
    try {
      const res = await api.interceptWanted(targetId);
      const reward = res?.rewardEuros ?? res?.bountyEuros;
      setMsg({
        text:
          res?.message ||
          `Sospechoso ${suspect.displayName} interceptado${reward ? ` (+${reward.toLocaleString('es-ES')} €)` : ''}`,
        tone: 'ok',
      });
      await Promise.all([refreshPlayer(), loadData()]);
    } catch (e: unknown) {
      setMsg({
        text: e instanceof Error ? e.message : 'No se pudo interceptar',
        tone: 'err',
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-400">
            Facciones y Radar de Se Busca
          </h2>
          <p className="text-xs text-zinc-400">
            Elige tu bando en España, gestiona tu rango y vigila las alertas
            policiales en tiempo real.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${activeFactionMeta.accentBorder} ${activeFactionMeta.accentBg}`}
        >
          <span>{activeFactionMeta.badge}</span>
          <span className={`font-semibold ${activeFactionMeta.accentText}`}>
            {activeFactionMeta.name}
          </span>
          {typeof player?.factionRank === 'number' &&
            player.factionRank > 0 && (
              <span className="text-zinc-300">
                · Rango {player.factionRank}
              </span>
            )}
        </div>
      </div>

      {inJail && (
        <div className="rounded-xl border border-red-500/50 bg-red-950/40 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
              <span>⛓️ Estás en el calabozo</span>
              <span className="rounded bg-red-500/20 px-2 py-0.5 font-mono text-xs text-red-200">
                {formatCountdown(jailRemainingMs)}
              </span>
            </div>
            <p className="text-xs text-red-200/80">
              Tus operaciones y movimientos están restringidos hasta cumplir la
              condena o pagar la fianza.
            </p>
          </div>
          <button
            type="button"
            disabled={busyAction === 'bail'}
            onClick={() => {
              void handlePayBail();
            }}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busyAction === 'bail' ? 'Pagando…' : 'Pagar Fianza'}
          </button>
        </div>
      )}

      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.tone === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
              : 'border-red-500/40 bg-red-950/30 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">
          Facciones disponibles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {factions.map((f) => {
            const isCurrent = f.id === currentFaction;
            const isJoining = busyAction === `join:${f.id}`;
            return (
              <div
                key={f.id}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition ${
                  isCurrent
                    ? `${f.accentBorder} ${f.accentBg}`
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{f.badge}</span>
                      <div>
                        <div
                          className={`font-semibold text-sm ${f.accentText}`}
                        >
                          {f.name}
                        </div>
                        {typeof f.memberCount === 'number' && (
                          <div className="text-[11px] text-zinc-500">
                            {f.memberCount} miembros
                          </div>
                        )}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-zinc-950/80 border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        Activa
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {f.description}
                  </p>

                  <ul className="space-y-1 pt-1">
                    {f.perks.map((perk) => (
                      <li
                        key={perk}
                        className="text-[11px] text-zinc-400 flex items-start gap-1.5"
                      >
                        <span className="text-amber-400">•</span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || Boolean(busyAction) || inJail}
                  onClick={() => {
                    void handleJoinFaction(f.id);
                  }}
                  className={`w-full rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isCurrent
                      ? 'bg-zinc-800/80 text-zinc-400 cursor-default'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 disabled:opacity-50'
                  }`}
                >
                  {isCurrent
                    ? 'Facción actual'
                    : isJoining
                      ? 'Cambiando…'
                      : `Unirse a ${f.shortName || f.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <span>🚨 Radar de Se Busca (Wanted)</span>
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[11px] text-red-300">
                {wanted.length} activos
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              Sospechosos con calor ≥ 40. Solo Policía Nacional y Guardia Civil
              en la misma zona pueden interceptar.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void loadData();
            }}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? 'Actualizando…' : 'Actualizar radar'}
          </button>
        </div>

        {pursuitAlerts.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-zinc-900/70 p-2.5 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
              Alertas recientes
            </div>
            <ul className="space-y-1 max-h-28 overflow-auto">
              {[...pursuitAlerts]
                .reverse()
                .slice(0, 5)
                .map((a) => (
                  <li
                    key={a.id}
                    className="text-xs text-zinc-300 flex items-center justify-between gap-2"
                  >
                    <span>
                      {a.type === 'alert' ? '🚨' : '✅'}{' '}
                      {a.message ||
                        (a.type === 'alert'
                          ? `Alerta de búsqueda: ${a.suspectName || 'Sospechoso'} en ${resolveZoneLabel(a.locationId || null)}`
                          : `Persecución resuelta: ${a.suspectName || 'Sospechoso'} (${a.outcome || 'capturado'})`)}
                    </span>
                    <span className="text-[10px] text-zinc-500 shrink-0">
                      {new Date(a.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {wanted.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
            No hay sospechosos buscados en este momento. Las calles están
            tranquilas.
          </div>
        ) : (
          <ul className="space-y-2">
            {wanted.map((s) => {
              const targetId = s.playerId || s.id || s.displayName;
              const isSelf = targetId === player?.id;
              const sameZone =
                Boolean(s.locationId) && s.locationId === player?.locationId;
              const canIntercept =
                isLawEnforcement && sameZone && !inJail && !isSelf;
              const bounty = s.bountyEuros ?? s.bounty ?? 0;

              let reason = '';
              if (isSelf) reason = 'Eres tú';
              else if (inJail) reason = 'Estás en el calabozo';
              else if (!isLawEnforcement)
                reason = 'Solo Policía / Guardia Civil';
              else if (!sameZone) reason = 'Ve a su zona para interceptar';

              return (
                <li
                  key={targetId}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-100">
                        {s.displayName}
                      </span>
                      <span
                        className="text-xs tracking-wider text-amber-400"
                        title={`Nivel de búsqueda ${s.wantedLevel}`}
                      >
                        {renderStars(s.wantedLevel, s.heat)}
                      </span>
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] text-red-300">
                        Calor {s.heat}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
                      <span>📍 {resolveZoneLabel(s.locationId)}</span>
                      <span>·</span>
                      <span className="text-emerald-300 font-medium">
                        Recompensa: {bounty.toLocaleString('es-ES')} €
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {reason && (
                      <span className="text-[11px] text-zinc-500">
                        {reason}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={
                        !canIntercept || busyAction === `intercept:${targetId}`
                      }
                      onClick={() => {
                        void handleIntercept(s);
                      }}
                      className="rounded-lg bg-sky-500/20 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busyAction === `intercept:${targetId}`
                        ? 'Interceptando…'
                        : 'Interceptar'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
