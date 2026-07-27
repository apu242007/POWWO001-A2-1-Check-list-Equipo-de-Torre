import InspectionForm from "./components/InspectionForm";

const BASE = import.meta.env.BASE_URL ?? "/";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <img
          className="app-logo"
          src={`${BASE}tacker-logo.png`}
          alt="Tacker"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="app-titulos">
          <h1>Check List Equipo de Torre</h1>
          <p>POWWO001-A2-1 · REV2</p>
        </div>
      </header>

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
