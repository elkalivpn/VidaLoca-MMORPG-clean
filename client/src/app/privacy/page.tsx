import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad y RGPD — VidaLoca MMORPG (+18)',
  description:
    'Información transparente sobre tratamiento de datos, cifrado en bóveda AES-256-GCM, almacenamiento técnico y derechos RGPD en VidaLoca MMORPG.',
};

const SECTIONS = [
  {
    title: '1. Responsable del Tratamiento',
    body: [
      'El responsable del tratamiento de los datos personales asociados a VidaLoca MMORPG es Nexus AI Holding (nexusaiholding.com). Puedes contactar con nuestro Delegado de Privacidad en privacidad@nexusaiholding.com.',
    ],
  },
  {
    title: '2. Datos que Recopilamos y Finalidad',
    body: [
      'Datos de cuenta: correo electrónico, nombre de usuario, alias en el juego, contraseña cifrada de forma irreversible mediante bcrypt (coste 12) y marcas temporales de verificación +18 y aceptación legal.',
      'Datos de seguridad y juego limpio: hashes HMAC-SHA256 de direcciones IP para prevención de fraude, detección de multi-cuentas, auditoría encadenada inmutable (SecurityAuditLog) y telemetría anti-cheat.',
      'Tokens de recuperación: al solicitar restablecimiento de contraseña se genera un token aleatorio de un solo uso del que únicamente almacenamos su hash SHA-256 con caducidad de 30 minutos.',
    ],
  },
  {
    title: '3. Bóveda Cifrada (vidaloca_vault) y Protección Técnica',
    body: [
      'Cualquier dato sensible o de verificación adicional procesado por integraciones de pago o identidad se aísla en el esquema vidaloca_vault mediante cifrado autenticado por envolvente AES-256-GCM y bloqueo estricto de políticas Row Level Security (RLS) en base de datos.',
      'Todas las comunicaciones entre tu navegador/PWA y nuestros servidores operan bajo cifrado TLS y tokens JWT de sesión revocables mediante control de versión (tokenVersion).',
    ],
  },
  {
    title: '4. Almacenamiento Local del Navegador (Sin Rastreadores Publicitarios)',
    body: [
      'Utilizamos almacenamiento local estrictamente necesario para mantener tu sesión de juego (accessToken), recordar la verificación obligatoria de edad +18 (vidaloca_age_18_verified) y evitar repetir el tutorial inicial.',
      'No empleamos cookies publicitarias de terceros ni vendemos perfiles de usuario a redes de anuncios.',
    ],
  },
  {
    title: '5. Conservación y Derechos RGPD / ARCO',
    body: [
      'Conservamos los datos mientras mantengas una cuenta activa o durante el plazo legal necesario para prevenir fraudes y atender responsabilidades legales. Las sesiones de invitado inactivas pueden depurarse periódicamente.',
      'Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición escribiendo desde tu correo registrado a privacidad@nexusaiholding.com.',
    ],
  },
];

export default function PrivacyPage() {
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
            <span className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-300">
              RGPD / GDPR
            </span>
            <Link
              href="/terms"
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-semibold text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
            >
              Términos (+18) →
            </Link>
          </div>
        </div>

        <article className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/75 shadow-2xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500" />
          <div className="p-6 sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
              Privacidad &amp; Seguridad Blindada · Nexus AI Holding
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Política de Privacidad
            </h1>
            <p className="mt-2 text-xs text-zinc-400">
              Última actualización: 2026 · Cumplimiento RGPD (UE) 2016/679 y
              LOPDGDD España.
            </p>

            <div className="mt-8 space-y-6">
              {SECTIONS.map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-5"
                >
                  <h2 className="text-base font-black text-sky-300 sm:text-lg">
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
                Contacto DPO / Privacidad:{' '}
                <strong className="text-zinc-200">
                  privacidad@nexusaiholding.com
                </strong>
              </span>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/terms"
                  className="font-semibold text-amber-300 hover:underline"
                >
                  Términos (+18)
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
