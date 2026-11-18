import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de Uso y Aviso +18 — VidaLoca MMORPG',
  description:
    'Términos legales, clasificación +18 sin censura, normas de juego justo, economía virtual y casino simulado de VidaLoca MMORPG.',
};

const SECTIONS = [
  {
    title: '1. Clasificación Estricta +18 y Naturaleza Ficticia',
    body: [
      'VidaLoca MMORPG es una obra de entretenimiento digital interactiva destinada exclusivamente a personas mayores de 18 años (+18) o mayores de edad según la legislación vigente en su país de residencia.',
      'El videojuego contiene ficción adulta explícita: violencia urbana, sangre, combates armados, persecuciones policiales, temática nocturna en clubes privados, tráfico simulado de sustancias ficticias y apuestas simuladas en casino clandestino. Todo el contenido es ficticio y no promueve conductas ilegales en la vida real.',
    ],
  },
  {
    title: '2. Cuentas, Acceso como Invitado y Seguridad',
    body: [
      'Puedes probar VidaLoca mediante una sesión de invitado o registrando una cuenta permanente con correo electrónico veraz y contraseña robusta (mínimo 8 caracteres con letra y número).',
      'Eres responsable de custodiar tus credenciales. Las cuentas de invitado tienen carácter temporal y solo pueden recuperarse por correo si previamente se convierten en cuenta permanente.',
    ],
  },
  {
    title: '3. Economía Virtual, VidaCoins y Casino Simulado',
    body: [
      'Los Euros del juego (€), Dinero Negro, VidaCoins (VC), propiedades, armas y vehículos son bienes digitales ficticios sin valor monetario real, no reembolsables y no canjeables por dinero fiduciario fuera de la plataforma.',
      'El Casino Clandestino (+18) emplea monedas virtuales dentro de la experiencia de juego. Aunque ofrezca mesas de alto riesgo con euros virtuales o VidaCoins, nunca constituye juego de azar con dinero real ni permite retiradas económicas externas.',
    ],
  },
  {
    title: '4. Juego Limpio, Anti-Cheat y Convivencia (Cero Toxicidad)',
    body: [
      'Queda terminantemente prohibido el uso de bots, macros, scripts de automatización, multi-cuentas para lavado de dinero P2P, explotación de errores, inyección de prompts, suplantación o acoso fuera del rol.',
      'El abuso reiterado de mecánicas (como camping policial abusivo sobre recién llegados o colusión en el mercado negro P2P) conlleva sanciones automáticas, bloqueo temporal de transacciones, pérdida de inventario ilícito o suspensión definitiva de la cuenta.',
    ],
  },
  {
    title: '5. Propiedad Intelectual y Disponibilidad del Servicio',
    body: [
      'Todos los diseños, gráficos, mundos 3D, código, textos, logotipos y mecánicas de VidaLoca MMORPG pertenecen a Nexus AI Holding (nexusaiholding.com). El acceso se ofrece bajo licencia limitada, personal y revocable.',
      'Nos reservamos el derecho de realizar mantenimientos, ajustes de equilibrio económico o actualizaciones para garantizar la estabilidad y justicia del mundo persistente.',
    ],
  },
  {
    title: '6. Legislación Aplicable y Contacto Legal',
    body: [
      'Estos Términos se rigen por la legislación española y de la Unión Europea aplicable a servicios digitales. Para consultas legales, reclamaciones o soporte sobre cuentas, escribe a legal@nexusaiholding.com o soporte@nexusaiholding.com.',
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/#portal"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-bold text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            ← Volver a VidaLoca
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-md border border-rose-500/60 bg-rose-600 px-2 py-0.5 font-black text-white">
              +18
            </span>
            <Link
              href="/privacy"
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-semibold text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
            >
              Política de Privacidad →
            </Link>
          </div>
        </div>

        <article className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/75 shadow-2xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-rose-600 via-amber-500 to-fuchsia-600" />
          <div className="p-6 sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
              Marco Legal · Nexus AI Holding
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Términos y Condiciones de Uso (+18)
            </h1>
            <p className="mt-2 text-xs text-zinc-400">
              Última actualización: 2026 · Aplicable a web, PWA y clientes
              conectados bajo nexusaiholding.com.
            </p>

            <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-950/25 p-4 text-xs leading-relaxed text-rose-200">
              <strong className="font-black uppercase tracking-wide text-rose-300">
                Aviso Obligatorio +18:
              </strong>{' '}
              Al registrarte o acceder a VidaLoca MMORPG declaras bajo tu
              responsabilidad tener al menos 18 años cumplidos y aceptar las
              presentes condiciones de juego y convivencia.
            </div>

            <div className="mt-8 space-y-6">
              {SECTIONS.map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-5"
                >
                  <h2 className="text-base font-black text-amber-300 sm:text-lg">
                    {section.title}
                  </h2>
                  <div className="mt-2.5 space-y-2.5 text-sm leading-relaxed text-zinc-300">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-6 text-xs text-zinc-400">
              <span>
                Operado por <strong className="text-zinc-200">Nexus AI Holding</strong>{' '}
                (nexusaiholding.com)
              </span>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/privacy"
                  className="font-semibold text-amber-300 hover:underline"
                >
                  Privacidad y RGPD
                </Link>
                <Link
                  href="/forgot-password"
                  className="font-semibold text-zinc-300 hover:text-amber-300 hover:underline"
                >
                  Recuperar contraseña
                </Link>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}
