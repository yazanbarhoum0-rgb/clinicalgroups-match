import type { Metadata } from "next";
import { Patua_One } from "next/font/google";
import "./globals.css";

const patuaOne = Patua_One({
  variable: "--font-patua-one",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Clinical Match — BAU Medical Community",
  description: "Find your clinical group classmates and make your rotations better together.",
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
