import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={styles.container}>
      {/* Background Video */}
      <video style={styles.backgroundVideo} autoPlay muted loop>
        <source src="/background-video.mp4" type="video/mp4" />
        <source src="/background-video.webm" type="video/webm" />
        Your browser does not support the video tag.
      </video>
      
      {/* Dark overlay for better text readability */}
      <div style={styles.videoOverlay}></div>
      
      <div style={styles.hero}>
        <h1 style={styles.title}>
          <span style={styles.titleHighlight}>QuickMeds</span>
        </h1>
        <p style={styles.subtitle}>
          Find emergency medicines quickly by checking real-time stock availability in nearby pharmacies. 
          Fast delivery to your doorstep.
        </p>

        <div style={styles.btnGroup}>
          <Link to="/login" style={styles.btnPrimary}>
            Login
          </Link>
          <Link to="/signup" style={styles.btnOutline}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    zIndex: 0,
  },
  videoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "radial-gradient(1200px 600px at 15% 10%, rgba(215, 241, 236, 0.6) 0%, transparent 55%), radial-gradient(1000px 700px at 85% 15%, rgba(248, 234, 216, 0.6) 0%, transparent 60%), linear-gradient(160deg, rgba(247, 251, 250, 0.7) 0%, rgba(233, 242, 241, 0.7) 45%, rgba(247, 242, 234, 0.7) 100%)",
    zIndex: 1,
  },
  hero: {
    maxWidth: "720px",
    textAlign: "center",
    padding: "42px 38px",
    background: "rgba(255, 255, 255, 0.94)",
    backdropFilter: "blur(16px)",
    borderRadius: "22px",
    boxShadow: "0px 24px 60px rgba(10, 40, 45, 0.18)",
    border: "1px solid rgba(11, 31, 36, 0.12)",
    position: "relative",
    zIndex: 2,
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "800",
    marginBottom: "15px",
    color: "#0b1f24",
    lineHeight: 1.2,
  },
  titleHighlight: {
    background: "linear-gradient(135deg, #0f766e 0%, #1fb29f 55%, #f7c59f 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    fontSize: "1.05rem",
    color: "#3b4c52",
    marginBottom: "35px",
    lineHeight: 1.7,
    maxWidth: "700px",
    margin: "0 auto 35px",
  },
  btnGroup: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginBottom: "40px",
    flexWrap: "wrap",
  },
  btnPrimary: {
    padding: "14px 32px",
    background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)",
    color: "#fff",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: "700",
    fontSize: "1.05rem",
    transition: "all 0.3s ease",
    boxShadow: "0 12px 24px rgba(15, 118, 110, 0.25)",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
  },
  btnOutline: {
    padding: "14px 32px",
    border: "2px solid #0f766e",
    background: "transparent",
    color: "#0f766e",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: "700",
    fontSize: "1.05rem",
    transition: "all 0.3s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
};
