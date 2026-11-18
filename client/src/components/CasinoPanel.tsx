'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { playAlertSfx, playCasinoChipSfx, playCasinoWinSfx } from '@/lib/sfx';
import type {
  CasinoBlackjackResponse,
  CasinoCard,
  CasinoCurrency,
  CasinoDiceChoice,
  CasinoDiceResponse,
  CasinoRouletteBetType,
  CasinoRouletteResponse,
  CasinoStatusResponse,
} from '@/types/game';

type CasinoGameTab = 'roulette' | 'blackjack' | 'dice';

const EUR_CHIP_VALUES = [10, 25, 100, 500, 2500] as const;
const VC_CHIP_VALUES = [1, 5, 25, 100, 250] as const;

function formatAmount(amount: number, currency: CasinoCurrency): string {
  return `${amount.toLocaleString('es-ES')} ${currency === 'VIDACOIN' ? 'VC' : '€'}`;
}

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function getNumberColor(num: number): 'RED' | 'BLACK' | 'GREEN' {
  if (num === 0) return 'GREEN';
  return RED_NUMBERS.has(num) ? 'RED' : 'BLACK';
}

function PlayingCard({ card }: { card: CasinoCard }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div
      className={`relative flex h-24 w-16 flex-col justify-between rounded-xl border bg-zinc-100 p-2 shadow-lg transition-transform hover:-translate-y-0.5 ${
        isRed
          ? 'border-rose-300 text-rose-600'
          : 'border-zinc-300 text-zinc-900'
      }`}
    >
      <div className="flex items-center justify-between text-xs font-black leading-none">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
      <div className="self-center text-2xl leading-none">{card.suit}</div>
      <div className="flex items-center justify-between text-xs font-black leading-none rotate-180">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
    </div>
  );
}

function DiceFace({ value, rolling }: { value: number; rolling: boolean }) {
  const pipMap: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const active = pipMap[value] ?? [4];
  return (
    <div
      className={`grid h-16 w-16 grid-cols-3 grid-rows-3 gap-1.5 rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-zinc-100 to-zinc-300 p-2.5 shadow-[0_8px_24px_rgba(245,158,11,0.25)] transition-transform ${
        rolling ? 'animate-spin' : ''
      }`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <span
          key={idx}
          className={`h-2.5 w-2.5 rounded-full self-center justify-self-center ${
            active.includes(idx) ? 'bg-zinc-900' : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

export default function CasinoPanel() {
  const refreshPlayer = useAuthStore((s) => s.refreshPlayer);
  const authPlayer = useAuthStore((s) => s.player);

  const [gameTab, setGameTab] = useState<CasinoGameTab>('roulette');
  const [currency, setCurrency] = useState<CasinoCurrency>('EUR');
  const [status, setStatus] = useState<CasinoStatusResponse | null>(null);
  const [bet, setBet] = useState<number>(100);
  const [betInput, setBetInput] = useState<string>('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Roulette state
  const [rouletteBetType, setRouletteBetType] =
    useState<CasinoRouletteBetType>('RED');
  const [rouletteNumber, setRouletteNumber] = useState<number>(7);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [rouletteResult, setRouletteResult] =
    useState<CasinoRouletteResponse | null>(null);

  // Blackjack state
  const [blackjackHand, setBlackjackHand] =
    useState<CasinoBlackjackResponse | null>(null);

  // Dice state
  const [diceChoice, setDiceChoice] = useState<CasinoDiceChoice>('HIGH');
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<CasinoDiceResponse | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.casinoStatus();
      setStatus(data);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo conectar con el Casino Clandestino',
      );
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const isVip = Boolean(status?.player?.isVip ?? authPlayer?.isVip);
  const minBetEur = status?.minBet ?? 10;
  const maxBetEur = isVip
    ? (status?.vipMaxBet ?? 100000)
    : (status?.maxBet ?? 25000);
  const minBetVc = status?.minBetVc ?? 1;
  const maxBetVc = isVip
    ? (status?.vipMaxBetVc ?? 2000)
    : (status?.maxBetVc ?? 500);

  const minBet = currency === 'VIDACOIN' ? minBetVc : minBetEur;
  const maxBet = currency === 'VIDACOIN' ? maxBetVc : maxBetEur;
  const chipValues = currency === 'VIDACOIN' ? VC_CHIP_VALUES : EUR_CHIP_VALUES;

  const currentEuros = Math.floor(
    status?.player?.euros ?? authPlayer?.euros ?? 0,
  );
  const currentVc = Math.floor(
    status?.player?.vidaCoins ?? authPlayer?.vidaCoins ?? 0,
  );
  const activeBalance = currency === 'VIDACOIN' ? currentVc : currentEuros;
  const isBlackjackPlaying = blackjackHand?.status === 'PLAYING';

  const commitBet = useCallback(
    (val: number, overrideMin = minBet, overrideMax = maxBet) => {
      const clamped = Math.min(
        overrideMax,
        Math.max(overrideMin, Math.round(val)),
      );
      setBet(clamped);
      setBetInput(String(clamped));
      return clamped;
    },
    [maxBet, minBet],
  );

  const switchCurrency = (next: CasinoCurrency) => {
    if (busy || isBlackjackPlaying || next === currency) return;
    playCasinoChipSfx();
    setCurrency(next);
    setError('');
    if (next === 'VIDACOIN') {
      commitBet(5, minBetVc, maxBetVc);
    } else {
      commitBet(100, minBetEur, maxBetEur);
    }
  };

  const selectChip = (val: number) => {
    playCasinoChipSfx();
    commitBet(val);
  };

  const spinRoulette = async () => {
    if (busy) return;
    const activeBet = commitBet(bet);
    setError('');
    setBusy(true);
    setWheelSpinning(true);
    setWheelAngle((prev) => prev + 720 + Math.floor(Math.random() * 360));
    playCasinoChipSfx();
    try {
      const [res] = await Promise.all([
        api.casinoRoulette({
          bet: activeBet,
          currency,
          betType: rouletteBetType,
          ...(rouletteBetType === 'NUMBER' ? { number: rouletteNumber } : {}),
        }),
        new Promise((r) => setTimeout(r, 750)),
      ]);
      setRouletteResult(res);
      if (res.won) {
        playCasinoWinSfx();
      } else {
        playAlertSfx();
      }
      await Promise.all([loadStatus(), refreshPlayer()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error en la ruleta');
    } finally {
      setWheelSpinning(false);
      setBusy(false);
    }
  };

  const startBlackjack = async () => {
    if (busy) return;
    const activeBet = commitBet(bet);
    setError('');
    setBusy(true);
    playCasinoChipSfx();
    try {
      const res = await api.casinoBlackjackStart({ bet: activeBet, currency });
      setBlackjackHand(res);
      if (res.status !== 'PLAYING') {
        const net = res.net ?? res.netProfit ?? 0;
        if (net > 0) playCasinoWinSfx();
        else if (net < 0) playAlertSfx();
        await Promise.all([loadStatus(), refreshPlayer()]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al repartir Blackjack');
    } finally {
      setBusy(false);
    }
  };

  const actBlackjack = async (action: 'HIT' | 'STAND' | 'DOUBLE') => {
    if (
      busy ||
      !blackjackHand ||
      blackjackHand.status !== 'PLAYING' ||
      !blackjackHand.handId
    ) {
      return;
    }
    setError('');
    setBusy(true);
    playCasinoChipSfx();
    try {
      const res = await api.casinoBlackjackAction({
        handId: blackjackHand.handId,
        action,
      });
      setBlackjackHand(res);
      if (res.status !== 'PLAYING') {
        const net = res.net ?? res.netProfit ?? 0;
        if (net > 0) playCasinoWinSfx();
        else if (net < 0) playAlertSfx();
        await Promise.all([loadStatus(), refreshPlayer()]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Acción inválida en Blackjack');
    } finally {
      setBusy(false);
    }
  };

  const rollDice = async () => {
    if (busy) return;
    const activeBet = commitBet(bet);
    setError('');
    setBusy(true);
    setDiceRolling(true);
    playCasinoChipSfx();
    try {
      const [res] = await Promise.all([
        api.casinoDice({ bet: activeBet, currency, choice: diceChoice }),
        new Promise((r) => setTimeout(r, 550)),
      ]);
      setDiceResult(res);
      if (res.won) {
        playCasinoWinSfx();
      } else {
        playAlertSfx();
      }
      await Promise.all([loadStatus(), refreshPlayer()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al lanzar los dados');
    } finally {
      setDiceRolling(false);
      setBusy(false);
    }
  };

  const rouletteOutcome =
    rouletteResult?.outcomeNumber ?? rouletteResult?.resultNumber;
  const rouletteColor =
    rouletteResult?.color ??
    rouletteResult?.resultColor ??
    (typeof rouletteOutcome === 'number'
      ? getNumberColor(rouletteOutcome)
      : 'BLACK');
  const rouletteCurrency: CasinoCurrency = rouletteResult?.currency ?? currency;
  const blackjackCurrency: CasinoCurrency = blackjackHand?.currency ?? currency;
  const blackjackDoubleBalance =
    blackjackCurrency === 'VIDACOIN' ? currentVc : currentEuros;
  const blackjackNet =
    blackjackHand?.net ??
    blackjackHand?.netProfit ??
    (blackjackHand
      ? Math.round((blackjackHand.payout - blackjackHand.bet) * 100) / 100
      : 0);
  const diceCurrency: CasinoCurrency = diceResult?.currency ?? currency;
  const diceFace1 = diceResult?.die1 ?? diceResult?.dice?.[0] ?? 6;
  const diceFace2 = diceResult?.die2 ?? diceResult?.dice?.[1] ?? 1;

  return (
    <div className="space-y-4">
      {/* Luxury Clandestine Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-zinc-900 via-zinc-950 to-rose-950/30 p-5 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-rose-500/50 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-rose-300">
                +18 Clandestino
              </span>
              <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">
                💶 € ↔ € · 🪙 VC ↔ VC
              </span>
              {isVip && (
                <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                  👑 Mesa VIP · Límite {formatAmount(maxBet, currency)}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-amber-300">
              Salón Nocturno · Casino Clandestino
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Apuesta Euros del juego para ganar Euros o apuesta VidaCoins (VC)
              para multiplicar VidaCoins en tiempo real.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-zinc-950/85 px-4 py-2.5 text-right space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">
              Tu Banca Disponible
            </p>
            <div className="flex items-center justify-end gap-3">
              <span
                className={`text-base font-black tabular-nums ${
                  currency === 'EUR' ? 'text-amber-300' : 'text-zinc-400'
                }`}
              >
                {currentEuros.toLocaleString('es-ES')} €
              </span>
              <span className="text-zinc-700">|</span>
              <span
                className={`text-base font-black tabular-nums ${
                  currency === 'VIDACOIN' ? 'text-fuchsia-300' : 'text-zinc-400'
                }`}
              >
                {currentVc.toLocaleString('es-ES')} VC
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Apuesta ({currency === 'VIDACOIN' ? 'VC' : '€'}):{' '}
              {formatAmount(minBet, currency)} –{' '}
              {formatAmount(maxBet, currency)}
            </p>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Divisa de apuesta:
            </span>
            <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              <button
                type="button"
                disabled={busy || isBlackjackPlaying}
                onClick={() => switchCurrency('EUR')}
                className={`rounded-lg px-3 py-1 text-xs font-black transition ${
                  currency === 'EUR'
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                } disabled:opacity-50`}
              >
                💶 Euros del Juego (€)
              </button>
              <button
                type="button"
                disabled={busy || isBlackjackPlaying}
                onClick={() => switchCurrency('VIDACOIN')}
                className={`rounded-lg px-3 py-1 text-xs font-black transition ${
                  currency === 'VIDACOIN'
                    ? 'bg-fuchsia-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                } disabled:opacity-50`}
              >
                🪙 VidaCoins (VC)
              </button>
            </div>
          </div>
          {isBlackjackPlaying && (
            <span className="text-[11px] text-amber-300">
              Termina la mano actual de Blackjack antes de cambiar de divisa.
            </span>
          )}
        </div>

        {/* Chip Selector */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800/60 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mr-1">
            Fichas:
          </span>
          {chipValues.map((val) => (
            <button
              key={val}
              type="button"
              disabled={busy || val > maxBet}
              onClick={() => selectChip(val)}
              className={`rounded-full border px-3 py-1 text-xs font-black transition ${
                bet === val
                  ? currency === 'VIDACOIN'
                    ? 'border-fuchsia-400 bg-fuchsia-500 text-zinc-950 shadow-[0_0_15px_rgba(217,70,239,0.45)]'
                    : 'border-amber-400 bg-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-500/50'
              } disabled:opacity-40`}
            >
              {formatAmount(val, currency)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => selectChip(Math.max(minBet, Math.floor(bet / 2)))}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-500"
            >
              ½
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                selectChip(Math.min(maxBet, Math.max(minBet, bet * 2)))
              }
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-500"
            >
              2×
            </button>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Cantidad de apuesta"
              value={betInput}
              disabled={busy}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '');
                setBetInput(digits);
                if (digits !== '') {
                  const n = Number.parseInt(digits, 10);
                  if (!Number.isNaN(n)) {
                    setBet(Math.min(maxBet, Math.max(minBet, n)));
                  }
                }
              }}
              onBlur={() => {
                const parsed = Number.parseInt(betInput, 10);
                if (Number.isNaN(parsed)) {
                  commitBet(bet);
                } else {
                  commitBet(parsed);
                }
              }}
              className={`w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-xs font-bold ${
                currency === 'VIDACOIN' ? 'text-fuchsia-300' : 'text-amber-300'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Game Selector Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { id: 'roulette', label: '🎡 Ruleta Europea', sub: 'Hasta 36×' },
            { id: 'blackjack', label: '🃏 Blackjack 21', sub: 'Pago 3:2' },
            { id: 'dice', label: '🎲 Dados 2d6', sub: 'Siete 4.5×' },
          ] as const
        ).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              playCasinoChipSfx();
              setGameTab(g.id);
              setError('');
            }}
            className={`rounded-xl border p-3 text-left transition ${
              gameTab === g.id
                ? 'border-amber-400/70 bg-amber-500/15 text-amber-200 shadow-lg shadow-amber-500/5'
                : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="text-sm font-black">{g.label}</div>
            <div className="text-[11px] opacity-75">{g.sub}</div>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-2.5 text-xs font-medium text-rose-200">
          {error}
        </div>
      )}

      {/* ROULETTE */}
      {gameTab === 'roulette' && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr] rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          {/* Wheel Display */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="relative flex h-44 w-44 items-center justify-center">
              <div
                className="h-44 w-44 rounded-full border-4 border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.2)] transition-transform duration-700 ease-out"
                style={{
                  transform: `rotate(${wheelAngle}deg)`,
                  background:
                    'conic-gradient(#16a34a 0deg 10deg, #b91c1c 10deg 20deg, #18181b 20deg 30deg, #b91c1c 30deg 40deg, #18181b 40deg 50deg, #b91c1c 50deg 60deg, #18181b 60deg 70deg, #b91c1c 70deg 80deg, #18181b 80deg 90deg, #b91c1c 90deg 100deg, #18181b 100deg 110deg, #b91c1c 110deg 120deg, #18181b 120deg 130deg, #b91c1c 130deg 140deg, #18181b 140deg 150deg, #b91c1c 150deg 160deg, #18181b 160deg 170deg, #b91c1c 170deg 180deg, #18181b 180deg 190deg, #b91c1c 190deg 200deg, #18181b 200deg 210deg, #b91c1c 210deg 220deg, #18181b 220deg 230deg, #b91c1c 230deg 240deg, #18181b 240deg 250deg, #b91c1c 250deg 260deg, #18181b 260deg 270deg, #b91c1c 270deg 280deg, #18181b 280deg 290deg, #b91c1c 290deg 300deg, #18181b 300deg 310deg, #b91c1c 310deg 320deg, #18181b 320deg 330deg, #b91c1c 330deg 340deg, #18181b 340deg 350deg, #b91c1c 350deg 360deg)',
                }}
              />
              <div className="absolute h-24 w-24 rounded-full border-2 border-amber-400/50 bg-zinc-950 flex flex-col items-center justify-center shadow-inner">
                {wheelSpinning ? (
                  <span className="text-xs font-black uppercase tracking-widest text-amber-300 animate-pulse">
                    Girando…
                  </span>
                ) : rouletteResult && typeof rouletteOutcome === 'number' ? (
                  <>
                    <span
                      className={`text-3xl font-black tabular-nums ${
                        rouletteColor === 'RED'
                          ? 'text-rose-400'
                          : rouletteColor === 'GREEN'
                            ? 'text-emerald-400'
                            : 'text-zinc-100'
                      }`}
                    >
                      {rouletteOutcome}
                    </span>
                    <span className="text-[10px] uppercase text-zinc-400">
                      {rouletteColor === 'RED'
                        ? 'Rojo'
                        : rouletteColor === 'GREEN'
                          ? 'Cero'
                          : 'Negro'}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-zinc-500">
                    0 – 36
                  </span>
                )}
              </div>
              <div className="absolute -top-1.5 h-3 w-3 rotate-45 bg-amber-300 shadow" />
            </div>

            {rouletteResult && !wheelSpinning && (
              <div
                className={`mt-4 w-full rounded-xl border p-2.5 text-center text-xs ${
                  rouletteResult.won
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                }`}
              >
                <p className="font-bold">
                  {rouletteResult.won
                    ? `+${formatAmount(rouletteResult.payout, rouletteCurrency)} (${rouletteResult.multiplier}×)`
                    : `-${formatAmount(rouletteResult.bet, rouletteCurrency)}`}
                </p>
                {rouletteResult.narrative && (
                  <p className="mt-0.5 text-[11px] opacity-85">
                    {rouletteResult.narrative}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Betting Board */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    type: 'RED',
                    label: 'Rojo (2×)',
                    style: 'border-rose-500/50 bg-rose-950/50 text-rose-200',
                  },
                  {
                    type: 'BLACK',
                    label: 'Negro (2×)',
                    style: 'border-zinc-600 bg-zinc-950 text-zinc-100',
                  },
                  {
                    type: 'GREEN',
                    label: 'Verde 0 (36×)',
                    style:
                      'border-emerald-500/50 bg-emerald-950/50 text-emerald-200',
                  },
                  {
                    type: 'EVEN',
                    label: 'Par (2×)',
                    style: 'border-zinc-700 bg-zinc-900 text-zinc-200',
                  },
                  {
                    type: 'ODD',
                    label: 'Impar (2×)',
                    style: 'border-zinc-700 bg-zinc-900 text-zinc-200',
                  },
                  {
                    type: 'NUMBER',
                    label: `Pleno #${rouletteNumber} (36×)`,
                    style: 'border-amber-500/50 bg-amber-950/40 text-amber-200',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    playCasinoChipSfx();
                    setRouletteBetType(opt.type);
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    opt.style
                  } ${
                    rouletteBetType === opt.type
                      ? 'ring-2 ring-amber-400 scale-[1.01]'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Number Grid 0-36 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-400">
                Selección rápida de número exacto (0–36)
              </p>
              <div className="grid grid-cols-10 sm:grid-cols-[repeat(13,minmax(0,1fr))] gap-1">
                {Array.from({ length: 37 }).map((_, n) => {
                  const col = getNumberColor(n);
                  const active =
                    rouletteBetType === 'NUMBER' && rouletteNumber === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        playCasinoChipSfx();
                        setRouletteNumber(n);
                        setRouletteBetType('NUMBER');
                      }}
                      className={`h-7 rounded text-[11px] font-bold transition ${
                        col === 'GREEN'
                          ? 'bg-emerald-700/70 text-emerald-100'
                          : col === 'RED'
                            ? 'bg-rose-800/70 text-rose-100'
                            : 'bg-zinc-800 text-zinc-200'
                      } ${
                        active
                          ? 'ring-2 ring-amber-400 brightness-125'
                          : 'hover:brightness-110'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={busy || activeBalance < bet}
              onClick={() => {
                void spinRoulette();
              }}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-black text-zinc-950 shadow-lg hover:from-amber-400 hover:to-orange-400 disabled:opacity-40"
            >
              {wheelSpinning
                ? 'Girando Ruleta…'
                : `Girar Ruleta (${formatAmount(bet, currency)})`}
            </button>
          </div>
        </div>
      )}

      {/* BLACKJACK 21 */}
      {gameTab === 'blackjack' && (
        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/35 to-zinc-950 p-5 space-y-5">
          {!blackjackHand ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-sm text-zinc-300">
                Enfréntate al crupier clandestino. Consigue 21 o supera su mano
                sin pasarte. Pago en la misma divisa apostada (
                {currency === 'VIDACOIN' ? 'VidaCoins' : 'Euros'}).
              </p>
              <button
                type="button"
                disabled={busy || activeBalance < bet}
                onClick={() => {
                  void startBlackjack();
                }}
                className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
              >
                Repartir Mano ({formatAmount(bet, currency)})
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="uppercase tracking-wider text-zinc-400 font-semibold">
                    Crupier
                  </span>
                  <span className="rounded bg-zinc-900 px-2 py-0.5 font-bold text-zinc-200">
                    Puntos: {blackjackHand.dealerScore}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {blackjackHand.dealerCards.map((c, idx) => (
                    <PlayingCard key={`d-${idx}`} card={c} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="uppercase tracking-wider text-amber-300 font-semibold">
                    Tu Mano (
                    {formatAmount(blackjackHand.bet, blackjackCurrency)})
                  </span>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">
                    Puntos: {blackjackHand.playerScore}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {blackjackHand.playerCards.map((c, idx) => (
                    <PlayingCard key={`p-${idx}`} card={c} />
                  ))}
                </div>
              </div>

              <div
                className={`rounded-xl border px-4 py-3 text-xs ${
                  blackjackHand.status === 'PLAYING'
                    ? 'border-zinc-700 bg-zinc-900/80 text-zinc-200'
                    : blackjackNet > 0
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                      : blackjackNet === 0
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                }`}
              >
                <p className="font-black uppercase tracking-wider">
                  {blackjackHand.status === 'PLAYING'
                    ? 'Tu turno'
                    : blackjackHand.status === 'PLAYER_BLACKJACK'
                      ? '¡BLACKJACK NATURAL!'
                      : blackjackHand.status === 'PLAYER_WIN'
                        ? '¡GANAS LA MANO!'
                        : blackjackHand.status === 'PUSH'
                          ? 'EMPATE (PUSH)'
                          : blackjackHand.status === 'BUST'
                            ? 'TE PASASTE DE 21'
                            : 'GANA LA BANCA'}
                  {blackjackHand.status !== 'PLAYING' &&
                    ` · ${blackjackNet >= 0 ? '+' : ''}${formatAmount(blackjackNet, blackjackCurrency)}`}
                </p>
                {blackjackHand.narrative && (
                  <p className="mt-1 opacity-90">{blackjackHand.narrative}</p>
                )}
              </div>

              {blackjackHand.status === 'PLAYING' ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void actBlackjack('HIT');
                    }}
                    className="rounded-xl bg-sky-500 py-2.5 text-xs font-black text-zinc-950 hover:bg-sky-400 disabled:opacity-40"
                  >
                    Pedir Carta (Hit)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void actBlackjack('STAND');
                    }}
                    className="rounded-xl bg-amber-500 py-2.5 text-xs font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                  >
                    Plantarse (Stand)
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      blackjackHand.playerCards.length > 2 ||
                      blackjackDoubleBalance < blackjackHand.bet
                    }
                    onClick={() => {
                      void actBlackjack('DOUBLE');
                    }}
                    className="rounded-xl border border-amber-400/60 bg-amber-500/20 py-2.5 text-xs font-black text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
                  >
                    Doblar (Double)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy || activeBalance < bet}
                  onClick={() => {
                    void startBlackjack();
                  }}
                  className="w-full rounded-xl bg-amber-500 py-3 text-sm font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                >
                  Nueva Mano ({formatAmount(bet, currency)})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* STREET DICE (2d6) */}
      {gameTab === 'dice' && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-5">
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/80 py-6">
            <div className="flex items-center gap-5">
              <DiceFace value={diceFace1} rolling={diceRolling} />
              <DiceFace value={diceFace2} rolling={diceRolling} />
            </div>
            {diceResult && !diceRolling && (
              <div className="text-center">
                <p className="text-lg font-black text-amber-300">
                  Total: {diceResult.total}
                </p>
                <p
                  className={`text-xs font-bold mt-1 ${
                    diceResult.won ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {diceResult.won
                    ? `¡Ganaste ${formatAmount(diceResult.payout, diceCurrency)} (${diceResult.multiplier}×)!`
                    : `Perdiste ${formatAmount(diceResult.bet, diceCurrency)}`}
                </p>
                {diceResult.narrative && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {diceResult.narrative}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'LOW', label: 'Baja (< 7)', mult: '2×' },
                { id: 'SEVEN', label: 'Siete Dorado (7)', mult: '4.5×' },
                { id: 'HIGH', label: 'Alta (> 7)', mult: '2×' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  playCasinoChipSfx();
                  setDiceChoice(opt.id);
                }}
                className={`rounded-xl border p-3 text-center transition ${
                  diceChoice === opt.id
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-xs font-black">{opt.label}</div>
                <div className="text-[11px] text-amber-400 font-bold mt-0.5">
                  Paga {opt.mult}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busy || activeBalance < bet}
            onClick={() => {
              void rollDice();
            }}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 py-3 text-sm font-black text-zinc-950 shadow-lg hover:brightness-110 disabled:opacity-40"
          >
            {diceRolling
              ? 'Lanzando Dados…'
              : `Lanzar Dados 2d6 (${formatAmount(bet, currency)})`}
          </button>
        </div>
      )}

      {/* Recent Plays + Responsible Virtual Gaming */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Historial reciente del salón
          </h3>
          <span className="text-[10px] text-zinc-500">
            +18 Juego Virtual · Apuestas con Euros (€) o VidaCoins (VC) del
            juego
          </span>
        </div>
        {status?.recentPlays && status.recentPlays.length > 0 ? (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {status.recentPlays.slice(0, 8).map((item) => {
              const itemCurrency: CasinoCurrency =
                item.currency === 'VIDACOIN' ? 'VIDACOIN' : 'EUR';
              const friendlyReason =
                item.reason === 'CASINO:ROULETTE'
                  ? item.type === 'EARN'
                    ? '🎡 Premio Ruleta Europea'
                    : '🎡 Apuesta Ruleta Europea'
                  : item.reason === 'CASINO:BLACKJACK'
                    ? item.type === 'EARN'
                      ? '🃏 Premio Blackjack 21'
                      : '🃏 Mano Blackjack 21'
                    : item.reason === 'CASINO:DICE'
                      ? item.type === 'EARN'
                        ? '🎲 Premio Dados 2d6'
                        : '🎲 Tirada Dados 2d6'
                      : item.reason;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-900/60 px-3 py-1.5 text-xs"
                >
                  <span className="text-zinc-300 truncate">
                    {friendlyReason}
                  </span>
                  <span
                    className={`ml-2 shrink-0 font-bold tabular-nums ${
                      item.type === 'EARN'
                        ? itemCurrency === 'VIDACOIN'
                          ? 'text-fuchsia-300'
                          : 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {item.type === 'EARN' ? '+' : '-'}
                    {formatAmount(Math.abs(item.amount), itemCurrency)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Aún no hay jugadas registradas en esta sesión.
          </p>
        )}
      </div>
    </div>
  );
}
