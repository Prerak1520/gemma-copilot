import './globals.css';

export const metadata = { title: 'Gemma Copilot' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <h1>Gemma Copilot — dashboard</h1>
          <div className="sub">local — proxies <span className="kbd">/api/*</span> to the express api on :3939</div>
          {children}
        </div>
      </body>
    </html>
  );
}
