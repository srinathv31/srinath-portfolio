import FlowField from "@/components/FlowField";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function V3Page() {
  return (
    <main className="relative h-full w-full overflow-y-auto overflow-x-hidden">
      <FlowField />

      {/* Theme toggle */}
      <div className="fixed top-6 right-6 z-50 animate-fade-up-4">
        <ThemeToggle />
      </div>

      {/* Main content grid */}
      <div className="relative z-10 min-h-dvh pointer-events-none">
        {/* Asymmetric layout container */}
        <div className="grid grid-cols-12 gap-4 min-h-screen px-6 md:px-10 lg:px-16">
          {/* Left vertical accent line */}
          <div className="hidden lg:flex col-span-1 items-center justify-center">
            <div className="w-px h-48 bg-gradient-to-b from-transparent via-[var(--accent)] to-transparent animate-scale-in" />
          </div>

          {/* Main content area */}
          <div className="col-span-12 lg:col-span-7 flex flex-col justify-center py-16 lg:py-0">
            {/* Small label above name */}
            <div className="animate-fade-up-1 mb-6">
              <span
                className="text-xs tracking-[0.3em] uppercase"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
              >
                Developer & Creator
              </span>
            </div>

            {/* Name - editorial style with mixed weights */}
            <div className="animate-fade-up-2">
              <h1
                className="text-6xl sm:text-7xl md:text-8xl lg:text-[7rem] xl:text-[8.5rem] leading-[0.9] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span
                  className="block font-light italic"
                  style={{ color: "var(--text-primary)" }}
                >
                  Srinath
                </span>
                <span
                  className="block font-semibold mt-1 md:mt-2"
                  style={{ color: "var(--accent)" }}
                >
                  Venkatesh
                </span>
              </h1>
            </div>

            {/* Decorative horizontal line */}
            <div className="animate-scale-in mt-10 mb-8 w-24 h-px bg-gradient-to-r from-[var(--accent)] to-transparent" />

            {/* Bio text - refined typography */}
            <div className="animate-fade-up-3 max-w-md">
              <p
                className="text-xl md:text-2xl leading-relaxed font-light"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
              >
                Building cool things.
              </p>
              <p
                className="text-base md:text-lg mt-3"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
              >
                Recently into AI.
              </p>
            </div>

            {/* Social links - minimal, refined */}
            <div className="animate-fade-up-4 mt-12 pointer-events-auto">
              <div className="flex flex-wrap items-center gap-6 md:gap-8">
                <a
                  href="https://github.com/srinathv31"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group link-underline flex items-center gap-2 text-sm tracking-wide transition-colors duration-300"
                  style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
                  aria-label="Visit GitHub profile"
                >
                  <svg
                    className="w-4 h-4 transition-transform duration-300 group-hover:scale-110"
                    style={{ color: "var(--text-muted)" }}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="group-hover:text-[var(--text-primary)] transition-colors">GitHub</span>
                </a>

                <span style={{ color: "var(--text-muted)" }}>/</span>

                <a
                  href="https://linkedin.com/in/srinath-venkatesh/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group link-underline flex items-center gap-2 text-sm tracking-wide transition-colors duration-300"
                  style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
                  aria-label="Visit LinkedIn profile"
                >
                  <svg
                    className="w-4 h-4 transition-transform duration-300 group-hover:scale-110"
                    style={{ color: "var(--text-muted)" }}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  <span className="group-hover:text-[var(--text-primary)] transition-colors">LinkedIn</span>
                </a>

                <span style={{ color: "var(--text-muted)" }}>/</span>

                <a
                  href="mailto:srinath@srinathvenkatesh.com"
                  className="group link-underline flex items-center gap-2 text-sm tracking-wide transition-colors duration-300"
                  style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
                  aria-label="Send an email"
                >
                  <svg
                    className="w-4 h-4 transition-transform duration-300 group-hover:scale-110"
                    style={{ color: "var(--text-muted)" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="group-hover:text-[var(--text-primary)] transition-colors">Email</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right side - decorative element / future expansion */}
          <div className="hidden lg:flex col-span-4 items-end justify-end pb-20">
            <div className="animate-fade-up-4 text-right">
              <p
                className="text-xs tracking-widest uppercase"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
              >
                Based in
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
              >
                San Francisco Bay Area
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
