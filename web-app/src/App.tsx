import InspectionForm from "./components/InspectionForm";

const BASE = import.meta.env.BASE_URL ?? "/";

function ocultarSiFalla(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <img
          className="app-logo"
          src={`${BASE}tacker-logo.png`}
          alt="Tacker Solutions"
          onError={ocultarSiFalla}
        />
        <div className="app-titulos">
          <h1>Check List Equipo de Torre</h1>
          <p>POWWO001-A2-1 · REV2</p>
        </div>
      </header>

      <div className="app-banner">
        <img
          src={`${BASE}header-equipo-torre.jpg`}
          alt="Equipo de torre Tacker Solutions"
          loading="eager"
          onError={ocultarSiFalla}
        />
      </div>

      <main className="app-main">
        <InspectionForm />
      </main>

      <footer className="app-footer">
        Tacker · Sistema de Gestión Integrado — completá el formulario y enviá. Tus datos quedan
        guardados en este dispositivo hasta que el envío se confirme.
      </footer>
    </div>
  );
}
