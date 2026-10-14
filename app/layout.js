export const metadata = {
  title: "OTP Excel Tool",
  description: "Excel upload karo, email se OTP aur return qty bhar do",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f5f6f8",
          margin: 0,
          color: "#1d2433",
        }}
      >
        {children}
      </body>
    </html>
  );
}
