export const metadata = {
  title: 'P5 Pixel Intelligence Pipeline',
  description: 'Automated visitor identification, intent scoring, and CRM integration',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
