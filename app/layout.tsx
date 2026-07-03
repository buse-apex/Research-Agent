import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "The Apex Brief · School Research Agent",
  description: "Internal franchisee tool for school research and outreach drafting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
