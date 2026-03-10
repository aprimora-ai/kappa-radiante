import type { ReactNode } from "react";

export const metadata = {
  title: "Radiante 3D",
  description: "Visualização 3D dinâmica para estados temporais de um sistema informacional."
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif",
          backgroundColor: "#050816",
          color: "#f9fafb"
        }}
      >
        {children}
      </body>
    </html>
  );
}
