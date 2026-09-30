import Link from "next/link";

const features = [
  {
    number: "01 / instant",
    title: "One command to public",
    description: "Give any local HTTP server a public HTTPS URL in seconds. No dashboard or setup ceremony.",
  },
  {
    number: "02 / flexible",
    title: "Bring your own route",
    description: "Choose a memorable tunnel ID for a demo, or let Expoz generate one when speed matters.",
  },
  {
    number: "03 / resilient",
    title: "Streams, not snapshots",
    description: "Requests and responses move in chunks, keeping larger uploads and downloads practical.",
  },
];

const steps = [
  {
    number: "01",
    title: "Connect",
    description: "The CLI opens a persistent WebSocket to the Expoz relay and claims your tunnel ID.",
  },
  {
    number: "02",
    title: "Forward",
    description: "A visitor request reaches your public URL and streams across the tunnel.",
  },
  {
    number: "03",
    title: "Respond",
    description: "Your local server answers normally. Expoz streams the response back to the visitor.",
  },
];

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <Link className="brand" href="/" aria-label="Expoz home">
            <span className="brand-mark" aria-hidden="true">↗</span>
            <span>expoz</span>
          </Link>
          <nav className="navigation" aria-label="Main navigation">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a className="status-link" href="/health">
              <span className="status-dot" aria-hidden="true" /> Service status
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero shell">
          <div className="hero-grid">
            <div className="hero-copy-block">
              <p className="eyebrow">Local development infrastructure</p>
              <h1>Your localhost,<br /><em>everywhere.</em></h1>
              <p className="hero-copy">
                A fast, open-source HTTPS tunnel for demos, webhooks, and the moment your local app needs to meet the real internet.
              </p>
              <div className="actions">
                <a className="button button-primary" href="#install">
                  Start tunneling <span aria-hidden="true">↗</span>
                </a>
                <a className="button button-secondary" href="https://github.com/kushalshah0/Expoz">
                  View on GitHub <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            <div className="terminal" aria-label="Expoz command line example">
              <div className="terminal-bar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <pre><span className="comment"># expose your local app</span>{"\n"}<span className="prompt">$</span> <span className="command">expoz 3000</span>{"\n\n"}<span className="comment"># your public URL is ready</span>{"\n"}<span className="terminal-url">https://expoz.onrender.com/t/demo</span>{"\n\n"}<span className="comment">connected / streaming / secure</span></pre>
            </div>
          </div>
        </section>

        <div className="signal-strip">
          <div className="shell signal-row">
            <span><strong>01</strong> No port forwarding</span>
            <span><strong>02</strong> No config file</span>
            <span><strong>03</strong> Plain Node.js</span>
            <span><strong>04</strong> Self-hostable</span>
          </div>
        </div>

        <section className="section shell" id="features">
          <div className="section-heading">
            <h2>Built for the<br />messy middle.</h2>
            <p>
              The space between “it works on my machine” and “here, take a look.” Expoz keeps that handoff simple, inspectable, and yours.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature" key={feature.number}>
                <span className="feature-number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="how-section" id="how">
          <div className="shell section">
            <div className="section-heading">
              <h2>The short route<br />to outside.</h2>
              <p>
                A small relay server connects the public internet to a client running beside your app. Your code stays local; the URL does not.
              </p>
            </div>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step" key={step.number}>
                  <span className="step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="install-section shell" id="install">
          <div className="install-band">
            <h2>Ready when your<br />localhost is.</h2>
            <p className="install-command">
              <span>npm install -g @kushalshah0/expoz</span>
              <span>expoz 3000</span>
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-row">
          <span>expoz / open-source local tunnels</span>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/health">Health</a>
            <a href="/status">Status</a>
            <a href="https://github.com/kushalshah0/Expoz">GitHub</a>
          </nav>
        </div>
      </footer>
    </>
  );
}