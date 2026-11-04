import type { Metadata } from "next";
import { Patua_One } from "next/font/google";
import "./globals.css";

const patuaOne = Patua_One({
  variable: "--font-patua-one",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Vitanova Match",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${patuaOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
