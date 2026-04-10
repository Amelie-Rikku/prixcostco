import { signInWithGoogle } from "./db";

export default function Auth() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Erreur de connexion:", e);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080c14",
        color: "#f1f5f9",
        fontFamily: "'Syne', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{ textAlign: "center", maxWidth: "320px", width: "100%" }}>
        <div
          style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: 6,
          }}
        >
          Prix <span style={{ color: "#818cf8" }}>Costco</span>
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "#4b5563",
            fontFamily: "'DM Mono', monospace",
            marginBottom: 48,
          }}
        >
          Costco · Maxi · Super C
        </div>
        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            background: "rgba(99,102,241,0.2)",
            border: "1px solid rgba(99,102,241,0.5)",
            borderRadius: "12px",
            padding: "14px 20px",
            color: "#a5b4fc",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 700,
            fontFamily: "'Syne', sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          Connexion avec Google
        </button>
      </div>
    </div>
  );
}
