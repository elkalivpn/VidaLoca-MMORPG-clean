'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const CITIES = [
  { name: 'Madrid', vibe: 'Negocios y calle', color: 'from-sky-600/40 to-zinc-900' },
  { name: 'Barcelona', vibe: 'Ramblas y tratos', color: 'from-rose-600/40 to-zinc-900' },
  { name: 'Marbella', vibe: 'Yates y lujo', color: 'from-amber-500/40 to-zinc-900' },
  { name: 'Sevilla', vibe: 'Historia y poder', color: 'from-orange-600/40 to-zinc-900' },
  { name: 'Valencia', vibe: 'Arte y futuro', color: 'from-cyan-600/40 to-zinc-900' },
  { name: 'Bilbao', vibe: 'Norte e industria', color: 'from-zinc-500/40 to-zinc-900' },
];

const FEATURES = [
  {
    title: 'Mundo libre',
    desc: 'Sin caminos obligatorios. Legal, gris o ilegal: tú decides quién eres en cada barrio.',
    icon: '🗺️',
  },
  {
    title: 'Economía dual',
    desc: 'Euros del mundo real del juego y VidaCoins premium. Invierte, arriesga, escala.',
    icon: '💶',
  },
  {
    title: 'Clanes y territorios',
    desc: 'Fundá tu clan, recluta, controla zonas y marca el mapa con tu tag.',
    icon: '⚔️',
  },
  {
    title: 'Vehículos y propiedades',
    desc: 'De garajes en Chamberí a villas en Puerto Banús. Tu imperio se ve.',
    icon: '🏎️',
  },
  {
    title: 'Misiones narrativas',
    desc: 'Contactos, deudas, entregas y traiciones en calles que conoces.',
    icon: '📜',
  },
  {
    title: 'Multijugador en vivo',
    desc: 'Presencia por zona, chat global y de barrio, eventos de mundo en tiempo real.',
    icon: '📡',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let result: any;
      if (mode === 'login') {
        result = await api.login({ email: form.email, password: form.password });
      } else {
        result = await api.register({
          email: form.email,
          password: form.password,
          username: form.username,
          displayName: form.displayName || form.username,
        });
      }
      const token = result.accessToken || result?.tokens?.accessToken;
      if (token) {
        localStorage.setItem('accessToken', token);
        if (result.refreshToken) localStorage.setItem('refreshToken', result.refreshToken);
        router.push('/dashboard');
      } else {
        setError('Respuesta de autenticación inválida');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const scrollToAuth = () => {
    setShowAuth(true);
    setTimeout(() => {
      document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-black text-xl tracking-tighter">
            <span className="text-amber-500">VIDA</span>
            <span className="text-white">LOCA</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#mundo" className="hover:text-white transition">Mundo</a>
            <a href="#ciudades" className="hover:text-white transition">Ciudades</a>
            <a href="#features" className="hover:text-white transition">Juego</a>
            <a href="#descargas" className="hover:text-white transition">Descargas</a>
            <a href="#auth" className="hover:text-white transition">Entrar</a>
          </nav>
          <button type="button" onClick={scrollToAuth} className="btn-primary text-sm py-2 px-4">
            Jugar ahora
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(217,119,6,0.25),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_60%,rgba(127,29,29,0.15),transparent_50%)]" />
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black to-transparent" />

        {/* Decorative grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-amber-500/90 text-sm font-semibold tracking-[0.2em] uppercase mb-4">
              MMORPG · España · Mundo libre
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] mb-6">
              Tú decides
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
                quién eres
              </span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-lg mb-8 leading-relaxed">
              Vive en Madrid, Barcelona, Marbella y más. Construye tu imperio, únete a un clan
              o domina la calle. Economía dual, misiones reales y multijugador en vivo.
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={scrollToAuth} className="btn-primary text-base px-8 py-3.5">
                Empezar gratis
              </button>
              <a
                href="#mundo"
                className="btn-secondary text-base px-8 py-3.5 inline-flex items-center"
              >
                Ver el mundo
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-zinc-500">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Multijugador en tiempo real
              </span>
              <span>6 ciudades</span>
              <span>Clanes · Misiones · Battle Pass</span>
            </div>
          </div>

          {/* Visual mock – game preview cards */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-4 bg-amber-500/10 blur-3xl rounded-full" />
            <div className="relative space-y-4">
              <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl shadow-amber-900/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">En vivo · Malasaña</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-800 text-emerald-400">
                    ONLINE
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">Rey de la noche</p>
                <p className="text-zinc-500 text-sm mb-4">Nivel 12 · 48.200 € · 1.250 VidaCoins</p>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" />
                </div>
                <p className="text-[10px] text-zinc-600 mt-1">XP temporada Battle Pass</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
                  <p className="text-3xl mb-2">🏎️</p>
                  <p className="font-semibold text-sm">Supercoche</p>
                  <p className="text-xs text-zinc-500">Puerto Banús</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
                  <p className="text-3xl mb-2">🏛️</p>
                  <p className="font-semibold text-sm">Ático Salamanca</p>
                  <p className="text-xs text-zinc-500">+2.400 €/día</p>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-black text-sm">
                  VL
                </div>
                <div>
                  <p className="font-semibold text-sm">[VL] Los Inquebrantables</p>
                  <p className="text-xs text-zinc-500">12 miembros · 3 territorios</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MUNDO / PITCH */}
      <section id="mundo" className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              No es un grindeo. Es tu vida.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              VidaLoca no te obliga a ser héroe ni villano. Te pone en las calles de España
              y te deja elegir: empresario, traficante de influencias, rey del club o
              alguien que solo quiere el ático en Salamanca.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { t: 'Legal', d: 'Negocios, alquileres, reputación limpia y contactos de alto nivel.', c: 'border-emerald-900/50 bg-emerald-950/20' },
              { t: 'Gris', d: 'Tratos opacos, deudas, favores. El poder real vive aquí.', c: 'border-amber-900/50 bg-amber-950/20' },
              { t: 'Calle', d: 'Riesgo, clanes, territorio. Quien controla el barrio, controla el juego.', c: 'border-red-900/50 bg-red-950/20' },
            ].map((x) => (
              <div key={x.t} className={`rounded-2xl border p-6 ${x.c}`}>
                <h3 className="text-xl font-bold mb-2">{x.t}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CIUDADES */}
      <section id="ciudades" className="py-24 border-t border-white/5 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase mb-2">Mapa</p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">Ciudades reales</h2>
            </div>
            <p className="text-zinc-500 max-w-md text-sm">
              Viaja entre zonas, únete al chat del barrio y compite por presencia y control.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CITIES.map((c) => (
              <div
                key={c.name}
                className={`relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br ${c.color} p-6 min-h-[140px] group hover:border-amber-500/40 transition`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2" />
                <h3 className="text-2xl font-black relative z-10">{c.name}</h3>
                <p className="text-zinc-400 text-sm mt-1 relative z-10">{c.vibe}</p>
                <p className="text-[10px] text-zinc-600 mt-4 uppercase tracking-wider relative z-10 group-hover:text-amber-500/80 transition">
                  Zona jugable
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase mb-2">Gameplay</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              Todo lo que necesitas para dominar
            </h2>
            <p className="text-zinc-400">
              Sistemas pensados para profundidad, no para relleno. Cada decisión deja huella.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-600 transition"
              >
                <span className="text-3xl" aria-hidden>
                  {f.icon}
                </span>
                <h3 className="text-lg font-bold mt-4 mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE / “screenshots” mock */}
      <section className="py-24 border-t border-white/5 bg-gradient-to-b from-zinc-950 to-black">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Así se siente</h2>
            <p className="text-zinc-500">Dashboard, mapa, clanes e inventario — todo en el navegador.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: 'Mapa interactivo',
                desc: 'Viaja entre barrios y ve quién está online en tu zona.',
                mock: (
                  <div className="h-36 rounded-lg bg-zinc-950 border border-zinc-800 relative overflow-hidden">
                    <div className="absolute inset-4 rounded border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 text-xs">
                      Madrid · Barcelona · Marbella
                    </div>
                    <span className="absolute top-1/3 left-1/3 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-lg shadow-amber-500/50" />
                    <span className="absolute top-1/2 left-2/3 w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="absolute bottom-1/3 left-1/2 w-2 h-2 rounded-full bg-sky-400" />
                  </div>
                ),
              },
              {
                title: 'Clanes',
                desc: 'Crea, únete, ranking y territorios controlados.',
                mock: (
                  <div className="h-36 rounded-lg bg-zinc-950 border border-zinc-800 p-3 space-y-2">
                    {['[VL] Los Inquebrantables', '[NB] Norte Brutal', '[SD] Sol y Dinero'].map((n, i) => (
                      <div key={n} className="flex justify-between text-xs bg-zinc-900 rounded px-2 py-1.5 border border-zinc-800">
                        <span className="text-zinc-300">#{i + 1} {n}</span>
                        <span className="text-amber-500/80">Nv.{14 - i * 2}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                title: 'Inventario & armas',
                desc: 'Rarezas, equipar, progresión visible.',
                mock: (
                  <div className="h-36 rounded-lg bg-zinc-950 border border-zinc-800 p-3 grid grid-cols-3 gap-2">
                    {['LEGENDARY', 'EPIC', 'RARE'].map((r) => (
                      <div key={r} className="rounded border border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center text-[9px] text-zinc-500 p-1">
                        <span className="text-lg mb-1">🔫</span>
                        {r}
                      </div>
                    ))}
                  </div>
                ),
              },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                {s.mock}
                <h3 className="font-bold mt-4 mb-1">{s.title}</h3>
                <p className="text-zinc-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* DESCARGAS / DEPLOY */}
      <section id="descargas" className="py-24 border-t border-white/5 bg-zinc-950/80">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase mb-2">
              Descargas
            </p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              Juega o despliega en un comando
            </h2>
            <p className="text-zinc-400">
              Código abierto del proyecto limpio. Clona, configura Neon y arranca.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <a
              href="https://github.com/elkalivpn/VidaLoca-MMORPG-clean"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-amber-500/40 transition block"
            >
              <p className="text-2xl mb-2">📦</p>
              <h3 className="font-bold text-lg mb-1">Código fuente</h3>
              <p className="text-sm text-zinc-500">
                GitHub · VidaLoca-MMORPG-clean — sin secretos, listo para clonar.
              </p>
            </a>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <p className="text-2xl mb-2">⚡</p>
              <h3 className="font-bold text-lg mb-2">Setup en un comando</h3>
              <pre className="text-[11px] sm:text-xs text-zinc-400 bg-black/50 rounded-lg p-3 overflow-x-auto border border-zinc-800 leading-relaxed">
{`git clone https://github.com/elkalivpn/VidaLoca-MMORPG-clean.git
cd VidaLoca-MMORPG-clean
cp .env.example .env   # DATABASE_URL + JWT
./scripts/setup.sh`}
              </pre>
            </div>
          </div>
          <p className="text-center text-zinc-600 text-xs mt-8">
            Requiere Node 20+, cuenta Neon (gratis) y 2 terminales para API + cliente.
          </p>
        </div>
      </section>

      {/* AUTH CTA */}
      <section id="auth" className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase mb-2">Empieza</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              Tu vida loca empieza aquí
            </h2>
            <p className="text-zinc-400 mb-6 leading-relaxed">
              Crea tu personaje en segundos. Sin descargas. Entra al mapa, elige ciudad
              y decide tu primer movimiento.
            </p>
            <ul className="space-y-3 text-sm text-zinc-400">
              {[
                'Registro rápido y acceso inmediato al mundo',
                'Chat y presencia por zona desde el primer login',
                'Progresión por decisiones, no por grindeo ciego',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-amber-500">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="card border-zinc-700/80 shadow-2xl shadow-amber-900/10">
            <div className="flex gap-2 mb-6 p-1 bg-zinc-950 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  mode === 'register' ? 'bg-amber-600 text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  mode === 'login' ? 'bg-amber-600 text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Ya tengo cuenta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' && (
                <>
                  <input
                    className="input"
                    placeholder="Nombre de usuario"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    autoComplete="username"
                  />
                  <input
                    className="input"
                    placeholder="Nombre visible (opcional)"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  />
                </>
              )}
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
              <input
                className="input"
                type="password"
                placeholder="Contraseña"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {error && (
                <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={loading}>
                {loading
                  ? 'Conectando...'
                  : mode === 'login'
                    ? 'Entrar al mundo'
                    : 'Empezar mi vida loca'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <div className="font-black tracking-tighter">
            <span className="text-amber-600">VIDA</span>
            <span className="text-zinc-400">LOCA</span>
          </div>
          <p>Mundo libre · Tú decides quién eres</p>
          <p className="text-xs">MMORPG de navegador · España</p>
        </div>
      </footer>
    </div>
  );
}
