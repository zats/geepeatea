import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🤯🫛☕️",
  description: "Starter app for the OpenAI Responses API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <div className="flex h-screen bg-gray-200 w-full flex-col  text-stone-900">
          <main className="h-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
