/** Pin de mapa cian con escudo oscuro y gota de agua dentro. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48" aria-hidden="true">
      <path d="M20 47C20 47 3 29.5 3 18A17 17 0 0 1 37 18C37 29.5 20 47 20 47Z" fill="#14B8D4" />
      <path d="M20 7.5L29 11V18.5C29 24.5 25.2 28.8 20 30.8C14.8 28.8 11 24.5 11 18.5V11L20 7.5Z" fill="#0A192F" />
      <path d="M20 12.5C20 12.5 15.6 17.6 15.6 20.6A4.4 4.4 0 0 0 24.4 20.6C24.4 17.6 20 12.5 20 12.5Z" fill="#00B4D8" />
      <ellipse cx="18.4" cy="20.4" rx="1" ry="1.6" fill="#FFFFFF" opacity=".8" />
    </svg>
  );
}
