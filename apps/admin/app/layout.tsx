import React from 'react';

export const metadata = {
  title: 'BarberDZ Admin Portal',
  description: 'Super Admin Portal for BarberDZ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
