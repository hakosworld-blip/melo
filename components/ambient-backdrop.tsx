/**
 * The room's light.
 *
 * Glass only reads as glass when there is something behind it. Three very soft,
 * slowly drifting colour orbs sit above the flat canvas and below the content,
 * so every translucent surface has colour to refract — without tinting text or
 * competing with artwork. Purely decorative, never interactive.
 */
export default function AmbientBackdrop() {
  return (
    <div className="ambient" aria-hidden="true">
      <span
        className="ambient-orb"
        style={{
          top: "-18%",
          left: "-12%",
          width: "58vmax",
          height: "58vmax",
          background: "radial-gradient(circle, #4f7dff 0%, transparent 68%)",
          animation: "melo-drift-a 26s ease-in-out infinite",
        }}
      />
      <span
        className="ambient-orb"
        style={{
          top: "8%",
          right: "-20%",
          width: "52vmax",
          height: "52vmax",
          background: "radial-gradient(circle, #a855f7 0%, transparent 68%)",
          animation: "melo-drift-b 32s ease-in-out infinite",
        }}
      />
      <span
        className="ambient-orb"
        style={{
          bottom: "-30%",
          left: "18%",
          width: "62vmax",
          height: "62vmax",
          background: "radial-gradient(circle, #1fa97a 0%, transparent 70%)",
          animation: "melo-drift-c 38s ease-in-out infinite",
        }}
      />
      <span className="ambient-veil" />
    </div>
  );
}
