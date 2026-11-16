'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { playCoinSfx } from '@/lib/sfx';
import type { InventoryItem, MarketListing, VipShopOffer } from '@/types/game';

const RARITY_STYLES: Record<string, string> = {
  COMMON: 'border-zinc-700 text-zinc-300 bg-zinc-800/70',
  RARE: 'border-sky-500/40 text-sky-300 bg-sky-500/15',
  EPIC: 'border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/15',
  LEGENDARY: 'border-amber-400/60 text-amber-200 bg-amber-500/20',
};

const VIP_CATEGORY_LABELS: Record<'ALL' | VipShopOffer['category'], string> = {
  ALL: 'Todos',
  VIP: '👑 Club VIP',
  CHARACTER: '🎭 Personajes',
  CLOTHING: '👔 Vestimenta',
  WEAPON: '🔫 Armas',
  UTILITY: '⚡ Utilidades',
  COSMETIC: '✨ Cosméticos',
};

export default function MarketplacePanel() {
  const { token, player, refreshPlayer } = useAuth();
  const [subtab, setSubtab] = useState<'p2p' | 'vip'>('p2p');
  const [vipFilter, setVipFilter] = useState<'ALL' | VipShopOffer['category']>(
    'ALL',
  );
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vipOffers, setVipOffers] = useState<VipShopOffer[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [priceEuros, setPriceEuros] = useState('500');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [l, inv, vip] = await Promise.all([
        api.marketListings(),
        api.inventory() as Promise<
          InventoryItem[] | { inventory?: InventoryItem[] }
        >,
        api.vipShop(),
      ]);
      const list = Array.isArray(l) ? l : [];
      const rawInv = Array.isArray(inv) ? inv : (inv?.inventory ?? []);
      const invArr = rawInv.filter((i) => !i.equipped);
      setListings(list);
      setInventory(invArr);
      setVipOffers(Array.isArray(vip) ? vip : []);
      if (invArr.length > 0) {
        setSelectedItemId((prev) =>
          invArr.some((i) => i.id === prev) ? prev : invArr[0].id,
        );
      } else {
        setSelectedItemId('');
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publishListing(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedItemId || busyId) return;
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const price = Number(priceEuros);
    if (!Number.isFinite(price) || price < 10) {
      setMsg('El precio mínimo de venta P2P es de 10 €');
      return;
    }
    setBusyId('publish');
    setMsg('');
    try {
      await api.createMarketListing({
        inventoryItemId: selectedItemId,
        quantity: qty,
        priceEuros: price,
      });
      playCoinSfx();
      setMsg('Anuncio publicado en el Mercado Negro P2P');
      await Promise.all([load(), refreshPlayer()]);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error al publicar');
    } finally {
      setBusyId(null);
    }
  }

  async function buyListing(id: string) {
    if (!token || busyId) return;
    setBusyId(id);
    setMsg('');
    try {
      const res = await api.buyMarketListing(id);
      playCoinSfx();
      setMsg(
        `Compraste ${res.quantity}x ${res.itemName} por ${res.priceEuros.toLocaleString('es-ES')} €`,
      );
      await Promise.all([load(), refreshPlayer()]);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error en la compra');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelListing(id: string) {
    if (!token || busyId) return;
    setBusyId(id);
    setMsg('');
    try {
      await api.cancelMarketListing(id);
      setMsg('Anuncio cancelado e ítem devuelto a tu inventario');
      await Promise.all([load(), refreshPlayer()]);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      setBusyId(null);
    }
  }

  async function buyVip(offerId: string) {
    if (!token || busyId) return;
    setBusyId(offerId);
    setMsg('');
    try {
      const res = await api.buyVipOffer(offerId);
      playCoinSfx();
      setMsg(`¡Canjeado ${res.name}! ${res.detail}`);
      await Promise.all([load(), refreshPlayer()]);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error al canjear');
    } finally {
      setBusyId(null);
    }
  }

  const isVipActive = Boolean(
    player?.isVip &&
    (!player.vipExpiresAt ||
      new Date(player.vipExpiresAt).getTime() > Date.now()),
  );

  const visibleVipOffers =
    vipFilter === 'ALL'
      ? vipOffers
      : vipOffers.filter((o) => o.category === vipFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-amber-400">
            Mercado Negro P2P &amp; Club VIP
          </h2>
          <p className="text-xs text-zinc-400">
            Comercia ítems entre jugadores (5% tasa estándar · 2% tasa Club VIP)
            o desbloquea contenido exclusivo con VidaCoins.
          </p>
        </div>

        <div className="flex gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 p-1 text-xs">
          <button
            type="button"
            onClick={() => setSubtab('p2p')}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              subtab === 'p2p'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Mercado P2P ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setSubtab('vip')}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              subtab === 'vip'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            👑 Club VIP &amp; Tienda VC ({vipOffers.length})
          </button>
        </div>
      </div>

      {msg && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {msg}
        </p>
      )}

      {subtab === 'p2p' ? (
        <div className="space-y-5">
          {/* Publicar ítem */}
          <form
            onSubmit={(e) => {
              void publishListing(e);
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">
                Vender Ítem de tu Inventario
              </h3>
              <span className="text-[11px] text-amber-300">
                {isVipActive
                  ? '👑 Tasa Club VIP: 2% · Recibes 98%'
                  : 'Tasa estándar: 5% (2% con Club VIP)'}
              </span>
            </div>

            {inventory.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No tienes ítems disponibles (desequipa un ítem primero o
                consigue botín en misiones y tienda VIP).
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1 block text-[11px] text-zinc-400">
                    Ítem
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
                  >
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.template.name} (x{item.quantity} ·{' '}
                        {item.template.rarity})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-[11px] text-zinc-400">
                    Cant.
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-[11px] text-zinc-400">
                    Precio total (€)
                  </label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={priceEuros}
                    onChange={(e) => setPriceEuros(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyId === 'publish'}
                  className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {busyId === 'publish' ? 'Publicando…' : 'Publicar Venta'}
                </button>
              </div>
            )}
          </form>

          {/* Listado activo */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Anuncios Activos de Jugadores
            </h3>
            {listings.length === 0 ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-500">
                No hay anuncios activos en este momento. ¡Sé el primero en poner
                un ítem a la venta!
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {listings.map((l) => {
                  const isMine = l.sellerId === player?.id;
                  const rarityStyle =
                    RARITY_STYLES[l.template.rarity] ?? RARITY_STYLES.COMMON;
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-zinc-100">
                            {l.quantity}x {l.template.name}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${rarityStyle}`}
                          >
                            {l.template.rarity}
                          </span>
                        </div>
                        <p className="text-zinc-400">
                          {l.template.description}
                        </p>
                        <div className="text-[11px] text-zinc-500">
                          Vendedor: {l.seller.isVip ? '👑 ' : ''}
                          {l.seller.displayName} (Nv.{l.seller.level})
                        </div>
                      </div>
                      <div className="shrink-0 text-right space-y-1.5">
                        <div className="text-sm font-black text-amber-300">
                          {l.priceEuros.toLocaleString('es-ES')} €
                        </div>
                        {isMine ? (
                          <button
                            type="button"
                            disabled={busyId === l.id}
                            onClick={() => {
                              void cancelListing(l.id);
                            }}
                            className="rounded border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/25"
                          >
                            Cancelar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === l.id}
                            onClick={() => {
                              void buyListing(l.id);
                            }}
                            className="rounded bg-amber-500 px-3 py-1 text-[11px] font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                          >
                            {busyId === l.id ? 'Comprando…' : 'Comprar'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 text-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-bold text-amber-200">
                  {isVipActive
                    ? `👑 Club VIP Activo${player?.vipExpiresAt ? ` hasta ${new Date(player.vipExpiresAt).toLocaleDateString('es-ES')}` : ''}`
                    : '👑 Ventajas del Club VIP VidaLoca'}
                </span>
                <p className="text-zinc-400 mt-0.5">
                  Consigue VidaCoins jugando (retos diarios, rachas, misiones y
                  logros) y desbloquea contenido exclusivo sin PayPal.
                </p>
              </div>
              <span className="rounded-lg border border-amber-400/40 bg-zinc-900 px-3 py-1.5 text-sm font-black text-amber-300">
                Saldo: {player?.vidaCoins ?? 0} VC
              </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 text-[11px] text-amber-100/90">
              <div className="rounded bg-zinc-900/70 px-2.5 py-1.5 border border-amber-500/20">
                ⚡ +25% XP en misiones y progreso
              </div>
              <div className="rounded bg-zinc-900/70 px-2.5 py-1.5 border border-amber-500/20">
                💶 +15% € extra en misiones y rentas
              </div>
              <div className="rounded bg-zinc-900/70 px-2.5 py-1.5 border border-amber-500/20">
                🏷️ Tasa Mercado P2P al 2% (vs 5%)
              </div>
              <div className="rounded bg-zinc-900/70 px-2.5 py-1.5 border border-amber-500/20">
                🎯 Acceso a 10 Misiones Exclusivas VIP
              </div>
              <div className="rounded bg-zinc-900/70 px-2.5 py-1.5 border border-amber-500/20">
                🏎️ Acceso a 8 Hiperdeportivos y Yates VIP
              </div>
              <div className="rounded bg-zinc-900/70 px-2.5 py-1.5 border border-amber-500/20">
                🏰 Acceso a 4 Mansiones y Clubes VIP
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {(
              Object.keys(VIP_CATEGORY_LABELS) as Array<
                'ALL' | VipShopOffer['category']
              >
            ).map((cat) => {
              const count =
                cat === 'ALL'
                  ? vipOffers.length
                  : vipOffers.filter((o) => o.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setVipFilter(cat)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    vipFilter === cat
                      ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                      : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {VIP_CATEGORY_LABELS[cat]} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleVipOffers.map((offer) => {
              const affordable = (player?.vidaCoins ?? 0) >= offer.priceVida;
              return (
                <div
                  key={offer.id}
                  className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        {VIP_CATEGORY_LABELS[offer.category]}
                      </span>
                      <span className="text-sm font-black text-amber-300">
                        {offer.priceVida} VC
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-zinc-100">
                      {offer.name}
                    </h4>
                    <p className="mt-1 text-xs text-zinc-400">
                      {offer.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!affordable || busyId === offer.id}
                    onClick={() => {
                      void buyVip(offer.id);
                    }}
                    className={`w-full rounded-lg py-2 text-xs font-bold transition ${
                      affordable
                        ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                        : 'border border-zinc-700 bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {busyId === offer.id
                      ? 'Procesando…'
                      : affordable
                        ? `Canjear por ${offer.priceVida} VC`
                        : `Faltan ${offer.priceVida - (player?.vidaCoins ?? 0)} VC`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
