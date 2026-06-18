const base = import.meta.env.BASE_URL;

export default function Slide01Title() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#050505",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Inter', sans-serif",
        color: "#F0EDE8",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      {/* Deep purple glow — centered, behind everything */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "80vw",
          height: "80vw",
          background: "radial-gradient(circle, rgba(79,70,229,0.35) 0%, rgba(79,70,229,0.08) 40%, rgba(5,5,5,0) 70%)",
          zIndex: 1,
          filter: "blur(80px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* Saffron accent glow — upper left */}
      <div
        style={{
          position: "absolute",
          top: "-10vh",
          left: "-10vw",
          width: "50vw",
          height: "50vw",
          background: "radial-gradient(circle, rgba(245,166,35,0.12) 0%, rgba(5,5,5,0) 65%)",
          zIndex: 1,
          filter: "blur(60px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: "4vh",
          left: "5vw",
          right: "5vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.85vw",
            fontWeight: 700,
            color: "#F5A623",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          PantrySwipe
        </span>
        {/* App icon — top right */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.8vw" }}>
          <span
            style={{
              fontSize: "0.85vw",
              fontWeight: 300,
              color: "#6b7280",
              letterSpacing: "0.15em",
            }}
          >
            2026
          </span>
          {/* PantrySwipe app logo */}
          <img
            src={`${base}app-logo.png`}
            alt="PantrySwipe logo"
            style={{
              width: "4.5vw",
              height: "4.5vw",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              boxShadow: "0 0 1.8vw rgba(245,166,35,0.35), 0 0.3vw 1vw rgba(0,0,0,0.6)",
              border: "1px solid rgba(245,166,35,0.25)",
            }}
          />
        </div>
      </div>

      {/* Main content — centered */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 3,
          textAlign: "center",
          width: "80vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Saffron rule above */}
        <div
          style={{
            width: "4vw",
            height: "2px",
            backgroundColor: "#F5A623",
            marginBottom: "4vh",
          }}
        />

        <h1
          style={{
            fontSize: "9vw",
            fontWeight: 900,
            margin: 0,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            color: "#F0EDE8",
            textWrap: "balance",
          }}
        >
          PantrySwipe
        </h1>

        <p
          style={{
            fontSize: "1.4vw",
            fontWeight: 300,
            color: "#9ca3af",
            letterSpacing: "0.05em",
            marginTop: "3vh",
            maxWidth: "50vw",
            lineHeight: 1.6,
          }}
        >
          The AI kitchen companion that turns what's in your fridge into tonight's dinner.
        </p>

        {/* Saffron rule below */}
        <div
          style={{
            width: "4vw",
            height: "2px",
            backgroundColor: "#F5A623",
            marginTop: "4vh",
          }}
        />

        <p
          style={{
            fontSize: "1vw",
            fontWeight: 400,
            color: "#6b7280",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginTop: "3vh",
          }}
        >
          Seeking a Technical Co-Founder · Singapore · 2026
        </p>
      </div>

      {/* Vignette edges */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          boxShadow: "inset 0 0 15vw rgba(0,0,0,0.7)",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* Bottom fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100vw",
          height: "20vh",
          background: "linear-gradient(to top, rgba(5,5,5,1) 0%, rgba(5,5,5,0) 100%)",
          zIndex: 4,
          pointerEvents: "none",
        }}
      />

      {/* Slide number */}
      <div
        style={{
          position: "absolute",
          bottom: "4vh",
          right: "5vw",
          fontSize: "0.8vw",
          fontWeight: 300,
          color: "#374151",
          letterSpacing: "0.1em",
          zIndex: 10,
        }}
      >
        01
      </div>
    </div>
  );
}
