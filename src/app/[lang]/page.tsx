
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/dictionaries";
import { ContactSection } from "@/components/ContactSection";

export default async function Home({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const t = await getDictionary(lang);
  const es = lang === "es";

  // Rutas originales. No modificar.
  const demoHref = `/${lang}/birria-dona-lupe`;
  const ownerHref = `/${lang}/login`;

  const features = [
    {
      number: "01",
      icon: "📦",
      title: es ? "Inventario inteligente" : "Smart inventory",
      description: es
        ? "Sabe exactamente qué tienes y cuántos platillos puedes preparar."
        : "Know exactly what you have and how many dishes you can make.",
    },
    {
      number: "02",
      icon: "🍽️",
      title: es ? "Menú en tiempo real" : "Live digital menu",
      description: es
        ? "Tus clientes siempre saben qué pueden pedir."
        : "Your customers always know what's available.",
    },
    {
      number: "03",
      icon: "✨",
      title: es ? "Más que ventas" : "More than sales",
      description: es
        ? "Apartados, recompensas y movimientos en un solo lugar."
        : "Reservations, rewards and transactions in one place.",
    },
  ];

  return (
    <main className="relative min-w-0 flex-1 overflow-hidden bg-[#FAF9F6] text-[#24372C]">
      {/* ANIMACIONES */}
      <style>{`
        @keyframes th-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-13px);
          }
        }

        @keyframes th-float-alt {
          0%, 100% {
            transform: translateY(0px) rotate(-6deg);
          }
          50% {
            transform: translateY(10px) rotate(-3deg);
          }
        }

        @keyframes th-fade-up {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes th-pop {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.055);
          }
        }

        .th-float {
          animation: th-float 6s ease-in-out infinite;
        }

        .th-float-alt {
          animation: th-float-alt 7s ease-in-out infinite;
        }

        .th-fade-up {
          animation: th-fade-up 0.85s ease-out both;
        }

        .th-fade-delay {
          animation-delay: 0.15s;
        }

        .th-fade-delay-2 {
          animation-delay: 0.3s;
        }

        .th-pop {
          animation: th-pop 4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .th-float,
          .th-float-alt,
          .th-fade-up,
          .th-pop {
            animation: none !important;
          }

          html {
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      {/* NAVBAR */}
      <header className="relative z-30 border-b border-[#E9EAE3] bg-[#FAF9F6]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <Link
            href={`/${lang}`}
            className="group flex items-center gap-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#244D38] text-lg text-white transition-transform duration-300 group-hover:-rotate-12">
              ✳
            </span>

            <span className="text-lg font-black tracking-[-0.05em] sm:text-xl">
              ¿Todavía hay<span className="text-[#E68B5C]">?</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <a
              href="#contacto"
              className="text-xs font-semibold text-[#456051] transition hover:text-[#E68B5C] sm:text-sm"
            >
              {es ? "Contacto" : "Contact"}
            </a>

            <Link
              href={es ? "/en" : "/es"}
              className="rounded-full border border-[#E4E7DE] px-3 py-2 text-xs font-bold transition hover:bg-white sm:text-sm"
            >
              {es ? "EN" : "ES"}
            </Link>

            {/* TEXTO ACTUALIZADO: INICIAR SESIÓN */}
            <Link
              href={ownerHref}
              className="hidden text-sm font-semibold text-[#456051] transition hover:text-[#E68B5C] sm:inline"
            >
              {es ? "Iniciar sesión" : "Business login"}
            </Link>

            <Link
              href={demoHref}
              className="rounded-full bg-[#244D38] px-4 py-2.5 text-xs font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#32684C] sm:px-5 sm:text-sm"
            >
              {es ? "Explorar demo ↗" : "Explore demo ↗"}
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative isolate">
        <div className="pointer-events-none absolute -left-32 top-32 h-72 w-72 rounded-full bg-[#E9F0E6] blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[#F7E9DE] blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.03fr_0.97fr] lg:gap-14 lg:px-12 lg:py-32">
          {/* TEXTO PRINCIPAL */}
          <div className="relative z-10">
            <div className="th-fade-up inline-flex items-center gap-2 rounded-full border border-[#DCE7DA] bg-[#EDF5EA] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-[#60A876]" />

              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#426A4D]">
                {es
                  ? "El futuro de tu negocio de comida"
                  : "The future of your food business"}
              </span>
            </div>

            <h1 className="th-fade-up th-fade-delay mt-7 max-w-3xl text-[3.4rem] font-black leading-[1.03] tracking-[-0.07em] sm:text-7xl lg:text-[5.25rem]">
              {es ? (
                <>
                  Lo bueno
                  <br />
                  <span className="text-[#E68B5C]">
                    no debería
                  </span>
                  <br />
                  acabarse.
                </>
              ) : (
                <>
                  Good food
                  <br />
                  <span className="text-[#E68B5C]">
                    deserves
                  </span>
                  <br />
                  better.
                </>
              )}
            </h1>

            <p className="th-fade-up th-fade-delay-2 mt-7 max-w-lg text-base leading-8 text-[#708076] sm:text-lg">
              {es
                ? "Menos desperdicio, más ventas y clientes felices. Organiza tu inventario, muestra tu menú y controla tu negocio desde un solo lugar."
                : "Less waste, more sales, happier customers. Manage inventory, share your menu and run your business from one place."}
            </p>

            {/* BOTONES PRINCIPALES */}
            <div className="th-fade-up th-fade-delay-2 mt-9 flex flex-col gap-3 sm:flex-row">
              {/* DEMO */}
              <Link
                href={demoHref}
                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#244D38] px-7 py-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(36,77,56,0.15)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#32684C]"
              >
                {es
                  ? "Descubrir cómo funciona"
                  : "See how it works"}

                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  ↗
                </span>
              </Link>

              {/* ACCESO AL PANEL CON PIN */}
              <Link
                href={ownerHref}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-[#DDE2D7] bg-white px-7 py-4 text-sm font-bold text-[#244D38] transition-all duration-300 hover:-translate-y-1 hover:border-[#244D38]"
              >
                {es
                  ? "Iniciar sesión"
                  : "Business login"}
              </Link>
            </div>

            {/* ENLACE AL FORMULARIO */}
            <a
              href="#contacto"
              className="th-fade-up th-fade-delay-2 mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#607768] underline decoration-[#E68B5C] decoration-2 underline-offset-4 transition hover:text-[#244D38]"
            >
              {es
                ? "¿Te interesa la plataforma? Hablemos"
                : "Interested in the platform? Let's talk"}

              <span aria-hidden="true">↗</span>
            </a>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#79877B]">
              <span className="flex items-center gap-2">
                <span className="text-[#5AA36D]">✓</span>
                {es ? "Fácil de usar" : "Easy to use"}
              </span>

              <span className="flex items-center gap-2">
                <span className="text-[#5AA36D]">✓</span>
                {es
                  ? "Información en vivo"
                  : "Live updates"}
              </span>

              <span className="flex items-center gap-2">
                <span className="text-[#5AA36D]">✓</span>
                {es ? "Hecho para ti" : "Made for you"}
              </span>
            </div>
          </div>

          {/* ILUSTRACIÓN DEL PRODUCTO */}
          <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center py-8 lg:max-w-none">
            {/* CÍRCULOS DECORATIVOS */}
            <div className="absolute h-[92%] w-[92%] rounded-full bg-[#EAF0E6]" />

            <div className="absolute h-[74%] w-[74%] rounded-full border border-[#CFDDCA]" />

            <div className="absolute h-[56%] w-[56%] rounded-full border border-dashed border-[#C1D5BE]" />

            {/* COMIDA FLOTANTE */}
            <div className="th-float absolute -left-2 top-10 z-20 flex h-20 w-20 rotate-[-12deg] items-center justify-center rounded-[1.8rem] border border-white bg-white text-4xl shadow-[0_15px_35px_rgba(31,62,42,0.09)] sm:left-0 sm:h-24 sm:w-24 sm:text-5xl">
              🥑
            </div>

            <div className="th-float-alt absolute -right-1 top-12 z-20 flex h-20 w-20 items-center justify-center rounded-[1.8rem] border border-white bg-white text-4xl shadow-[0_15px_35px_rgba(31,62,42,0.09)] sm:right-0 sm:h-24 sm:w-24 sm:text-5xl">
              🍋
            </div>

            <div
              className="th-float absolute -bottom-1 left-3 z-20 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#FCE7DA] text-3xl shadow-lg sm:bottom-5 sm:left-5 sm:h-20 sm:w-20 sm:text-4xl"
              style={{ animationDelay: "1.4s" }}
            >
              🌶️
            </div>

            {/* TARJETA PRINCIPAL */}
            <div className="relative z-10 my-12 w-[78%] max-w-[365px] rotate-[-3deg] rounded-[2.25rem] border border-white bg-white p-4 shadow-[0_35px_75px_rgba(27,60,38,0.13)] transition-transform duration-500 hover:rotate-0 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-[#EDF0EA] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A095]">
                    {es
                      ? "MENÚ DIGITAL"
                      : "DIGITAL MENU"}
                  </p>

                  <p className="mt-1 text-base font-black text-[#244D38] sm:text-lg">
                    ¿Todavía hay?
                  </p>
                </div>

                <span className="flex items-center gap-1.5 rounded-full bg-[#E9F5EA] px-2.5 py-1.5 text-[10px] font-bold text-[#438D53]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#58AD6B]" />
                  LIVE
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-[#F5E9DA]">
                <div className="relative flex aspect-[1.35/1] items-center justify-center overflow-hidden bg-gradient-to-br from-[#F7EAD7] via-[#EBD6B7] to-[#D9BFA4]">
                  <div className="absolute h-[75%] w-[75%] rounded-full bg-[#FBF7EF] shadow-[0_15px_30px_rgba(81,56,28,0.15)]" />

                  <div className="absolute h-[62%] w-[62%] rounded-full border-2 border-[#E7DBCA]" />

                  <div className="th-pop relative z-10 text-7xl drop-shadow-lg sm:text-8xl">
                    🥗
                  </div>

                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-[#47734F]">
                    {es
                      ? "Recién preparado"
                      : "Freshly prepared"}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-[#849086]">
                    {es
                      ? "Tu menú, actualizado"
                      : "Your menu, updated"}
                  </p>

                  <h3 className="mt-1 text-base font-black text-[#244D38] sm:text-lg">
                    {es
                      ? "Siempre al día"
                      : "Always up to date"}
                  </h3>
                </div>

                <span className="rounded-xl bg-[#E9F3E9] px-3 py-2 text-xs font-extrabold text-[#438D53]">
                  ✓
                </span>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="h-2 flex-1 rounded-full bg-[#E9EEE8]" />
                <span className="h-2 w-12 rounded-full bg-[#E68B5C]" />
                <span className="h-2 w-8 rounded-full bg-[#E9EEE8]" />
              </div>
            </div>

            {/* NOTIFICACIÓN FLOTANTE */}
            <div className="th-float absolute -right-2 bottom-12 z-20 rounded-2xl border border-white bg-white px-4 py-3 shadow-[0_14px_40px_rgba(31,62,42,0.12)] sm:-right-5 sm:bottom-20 sm:px-5 sm:py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9F5EA] text-lg">
                  📈
                </span>

                <div>
                  <p className="text-[10px] font-medium text-[#95A095]">
                    {es
                      ? "Todo conectado"
                      : "Everything connected"}
                  </p>

                  <p className="mt-1 text-xs font-black text-[#244D38] sm:text-sm">
                    {es
                      ? "Tu negocio en vivo"
                      : "Your business, live"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INDICADOR DE SCROLL */}
        <div className="relative hidden justify-center pb-8 lg:flex">
          <span className="flex flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0AAA0]">
            {es
              ? "Descubre más"
              : "Discover more"}

            <span className="th-float text-xl">↓</span>
          </span>
        </div>
      </section>

      {/* FRANJA DE BENEFICIOS */}
      <section className="border-y border-[#E6ECE3] bg-[#F0F4ED]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-7 text-center sm:grid-cols-3 sm:px-8 lg:px-12">
          {[
            es
              ? "Menos desperdicio"
              : "Less food waste",
            es ? "Más control" : "More control",
            es
              ? "Mejores experiencias"
              : "Better experiences",
          ].map((item, i) => (
            <div
              key={item}
              className="flex items-center justify-center gap-3 text-sm font-bold text-[#43664C]"
            >
              <span className="text-lg text-[#E68B5C]">
                {i === 0
                  ? "✳"
                  : i === 1
                    ? "✦"
                    : "♡"}
              </span>

              {item}
            </div>
          ))}
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E68B5C]">
              {es
                ? "Simple, pero poderoso"
                : "Simple, yet powerful"}
            </p>

            <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.05em] text-[#244D38] sm:text-5xl">
              {es
                ? "Todo lo que necesitas, nada que te complique."
                : "Everything you need. Nothing you don't."}
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#7D8A80]">
              {es
                ? "Pensado para la vida real de los negocios de comida: rápida, cambiante y llena de movimiento."
                : "Designed for the real world of food businesses: fast-paced, ever-changing and always moving."}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group flex min-h-[290px] flex-col rounded-[2rem] border border-[#E9EEE7] bg-[#FBFCFA] p-7 transition-all duration-500 hover:-translate-y-2 hover:border-[#C7DDC7] hover:bg-[#F2F8F0] hover:shadow-[0_20px_45px_rgba(31,62,42,0.07)]"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF3EA] text-3xl transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110">
                    {feature.icon}
                  </span>

                  <span className="text-xs font-black text-[#BAC7BC]">
                    {feature.number}
                  </span>
                </div>

                <h3 className="mt-10 text-xl font-black tracking-tight text-[#244D38]">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-[#7D8A80]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN DE INVENTARIO */}
      <section className="bg-[#F4F6F1] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div className="relative order-2 flex min-h-[350px] items-center justify-center lg:order-1">
            <div className="absolute h-80 w-80 rounded-full bg-[#E3EDE1] sm:h-[390px] sm:w-[390px]" />

            <div className="th-float relative z-10 w-[76%] max-w-[350px] rotate-[-5deg] rounded-[2rem] border border-white bg-white p-6 shadow-[0_25px_55px_rgba(31,62,42,0.12)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-[#244D38]">
                  {es ? "Inventario" : "Inventory"}
                </span>

                <span className="rounded-full bg-[#E9F5EA] px-3 py-1 text-[10px] font-bold text-[#438D53]">
                  ● LIVE
                </span>
              </div>

              <div className="mt-7 flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3E8] text-3xl">
                  🍅
                </span>

                <div className="flex-1">
                  <p className="text-sm font-bold text-[#244D38]">
                    {es ? "Ingredientes" : "Ingredients"}
                  </p>

                  <div className="mt-2 h-2 rounded-full bg-[#E8EFE8]">
                    <div className="h-full w-[78%] rounded-full bg-[#69AA78]" />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F0E4] text-3xl">
                  🧀
                </span>

                <div className="flex-1">
                  <p className="text-sm font-bold text-[#244D38]">
                    {es ? "Existencias" : "Stock levels"}
                  </p>

                  <div className="mt-2 h-2 rounded-full bg-[#E8EFE8]">
                    <div className="h-full w-[55%] rounded-full bg-[#E6A36C]" />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF5EA] text-3xl">
                  🥬
                </span>

                <div className="flex-1">
                  <p className="text-sm font-bold text-[#244D38]">
                    {es
                      ? "Disponibilidad"
                      : "Availability"}
                  </p>

                  <div className="mt-2 h-2 rounded-full bg-[#E8EFE8]">
                    <div className="h-full w-[90%] rounded-full bg-[#69AA78]" />
                  </div>
                </div>
              </div>
            </div>

            {/* ZANAHORIA FLOTANTE */}
            <div className="th-float-alt absolute bottom-0 right-0 z-20 rounded-2xl border border-white bg-[#FCE9D8] px-5 py-4 text-3xl shadow-xl sm:right-7">
              🥕
            </div>
          </div>

          {/* TEXTO */}
          <div className="order-1 lg:order-2">
            <span className="inline-flex rounded-full bg-[#E8F0E3] px-4 py-2 text-[11px] font-black uppercase tracking-[0.17em] text-[#54815B]">
              {es
                ? "Más fácil, todos los días"
                : "Easier, every day"}
            </span>

            <h2 className="mt-6 max-w-xl text-4xl font-black leading-[1.1] tracking-[-0.055em] text-[#244D38] sm:text-5xl">
              {es ? (
                <>
                  Tú haces la comida.
                  <br />
                  <span className="text-[#E68B5C]">
                    Nosotros las cuentas.
                  </span>
                </>
              ) : (
                <>
                  You make the food.
                  <br />
                  <span className="text-[#E68B5C]">
                    We handle the numbers.
                  </span>
                </>
              )}
            </h2>

            <p className="mt-6 max-w-lg text-base leading-8 text-[#78877C]">
              {es
                ? "Olvídate de calcular a mano cuántas porciones quedan. Registra tus ingredientes y deja que la plataforma te ayude a mantener todo organizado."
                : "Forget manually counting how many portions are left. Add your ingredients and let the platform help keep everything organized."}
            </p>

            <Link
              href={demoHref}
              className="group mt-8 inline-flex items-center gap-2 text-sm font-black text-[#244D38] underline decoration-[#E68B5C] decoration-2 underline-offset-8 transition hover:text-[#E68B5C]"
            >
              {es
                ? "Mira cómo funciona"
                : "See it in action"}

              <span className="transition-transform group-hover:translate-x-1">
                ↗
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#244D38] px-6 py-16 text-center text-white sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />

          <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full border-[45px] border-white/10" />

          <span className="relative inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em]">
            ¿Todavía hay?
          </span>

          <h2 className="relative mx-auto mt-7 max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.055em] sm:text-6xl">
            {es
              ? "Que no se te escape ninguna oportunidad."
              : "Make every opportunity count."}
          </h2>

          <p className="relative mx-auto mt-6 max-w-xl text-base leading-8 text-[#D5E5D6]">
            {es
              ? "Conoce una manera más sencilla de conectar tu cocina, tu inventario y tus clientes."
              : "Discover an easier way to connect your kitchen, inventory and customers."}
          </p>

          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={demoHref}
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 text-sm font-black text-[#244D38] transition-all duration-300 hover:-translate-y-1 hover:bg-[#F7ECDD]"
            >
              {es
                ? "Explorar la demostración"
                : "Explore the demo"}

              <span>↗</span>
            </Link>

            <a
              href="#contacto"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/35 bg-white/10 px-8 py-4 text-sm font-black text-white transition-all duration-300 hover:-translate-y-1 hover:bg-white/20"
            >
              {es ? "Contáctanos" : "Contact us"}

              <span>↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* CONTACTO DE FERNANDA Y ALEJANDRO */}
      {/* Mantiene el formulario y los enlaces directos */}
      <ContactSection lang={lang} />

      {/* FOOTER */}
      <footer className="border-t border-[#E7EBE4] bg-[#FAF9F6]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div>
            <p className="text-lg font-black tracking-tight text-[#244D38]">
              ¿Todavía hay<span className="text-[#E68B5C]">?</span>
            </p>

            <p className="mt-1 text-xs text-[#8D9A8D]">
              {es
                ? "Hecho para quienes alimentan al mundo."
                : "Made for the people who feed the world."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-[#66806D]">
            <Link
              href={demoHref}
              className="transition hover:text-[#244D38]"
            >
              {t.demoLink}
            </Link>

            {/* TEXTO ACTUALIZADO EN EL FOOTER */}
            <Link
              href={ownerHref}
              className="transition hover:text-[#244D38]"
            >
              {es ? "Iniciar sesión" : "Business login"}
            </Link>

            <a
              href="#contacto"
              className="transition hover:text-[#244D38]"
            >
              {es ? "Contacto" : "Contact"}
            </a>

            <Link
              href={es ? "/en" : "/es"}
              className="transition hover:tex t-[#244D38]"
            >
              {t.switchLang}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
