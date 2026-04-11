"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

// ====== COLORES ======
const BG = "#f5f7fb";
const CARD = "#ffffff";
const TEXT = "#0f172a";
const MUTED = "#6b7280";
const PRIMARY = "#0f172a";
const DANGER = "#dc2626";

// ====== HELPERS ======
const todayISO = () => new Date().toISOString().slice(0, 10);

const formatEUR = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);

// ====== TYPES ======
type Usuario = {
  id: string;
  usuario: string;
  password: string;
  nombre?: string;
};

type Cliente = {
  id: string;
  nombre: string;
  telefono?: string;
  ruta?: string;
  user_id: string;
};

type Prestamo = {
  id: string;
  cliente_id: string;
  monto: number;
  user_id: string;
};

type Cuota = {
  id: string;
  prestamo_id: string;
  fecha: string;
  restante: number;
  estado?: string;
  user_id: string;
};

type Pago = {
  id: string;
  cliente_id: string;
  monto: number;
  fecha: string;
  metodo?: string;
  user_id: string;
};

// ====== STYLES ======
const cardStyle = () => ({
  background: CARD,
  padding: 16,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
});

const inputStyle = () => ({
  padding: 10,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  width: "100%",
});

const buttonStyle = (primary = false) => ({
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: primary ? PRIMARY : "#e5e7eb",
  color: primary ? "#fff" : TEXT,
  cursor: "pointer",
});

// ====== COMPONENTES ======
const SectionTitle = ({ title, subtitle }: any) => (
  <div>
    <h2 style={{ margin: 0 }}>{title}</h2>
    <p style={{ margin: 0, color: MUTED }}>{subtitle}</p>
  </div>
);

const MetricCard = ({ title, value }: any) => (
  <div style={cardStyle()}>
    <p style={{ margin: 0, color: MUTED }}>{title}</p>
    <h3 style={{ margin: "10px 0 0 0", fontSize: 28 }}>{value}</h3>
  </div>
);

const NavBtn = ({ to, label, screen, setScreen }: any) => (
  <button
    style={{
      ...buttonStyle(screen === to),
      background: screen === to ? PRIMARY : "#e5e7eb",
      color: screen === to ? "#fff" : TEXT,
    }}
    onClick={() => setScreen(to)}
  >
    {label}
  </button>
);

// ====== APP ======
export default function App() {
  const [screen, setScreen] = useState("dashboard");

  // ====== MULTIUSUARIO ======
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);

  const [usuarioLogin, setUsuarioLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
const [cuotas, setCuotas] = useState<Cuota[]>([]);
const [pagos, setPagos] = useState<Pago[]>([]);
  useEffect(() => {
    cargarUsuarios();
  }, []);

  useEffect(() => {
    if (usuarioActual?.id) {
      cargarDatosUsuario(usuarioActual.id);
    }
  }, [usuarioActual]);

  const cargarUsuarios = async () => {
    const { data, error } = await supabase
      .from("usuarios_app")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      alert("Error cargando usuarios: " + error.message);
      return;
    }

    setUsuarios(data || []);
  };

  const login = async () => {
    const { data, error } = await supabase
      .from("usuarios_app")
      .select("*")
      .eq("usuario", usuarioLogin)
      .eq("password", passwordLogin)
      .maybeSingle();

    if (error) {
      alert("Error en login: " + error.message);
      return;
    }

    if (!data) {
      alert("Usuario o contraseña incorrectos");
      return;
    }

    setUsuarioActual(data);
    setScreen("dashboard");
  };

  const crearUsuarioRapido = async () => {
    const nombre = prompt("Nombre del usuario");
    if (!nombre) return;

    const usuario = prompt("Usuario");
    if (!usuario) return;

    const password = prompt("Contraseña");
    if (!password) return;

    const { error } = await supabase.from("usuarios_app").insert([
      {
        nombre,
        usuario,
        password,
        activo: true,
      },
    ]);

    if (error) {
      alert("Error creando usuario: " + error.message);
      return;
    }

    alert("Usuario creado");
    cargarUsuarios();
  };

  const cerrarSesion = () => {
    setUsuarioActual(null);
    setUsuarioLogin("");
    setPasswordLogin("");
    setClientes([]);
    setPrestamos([]);
    setCuotas([]);
    setPagos([]);
    setScreen("login");
  };

  const cargarDatosUsuario = async (usuarioId: string) => {
    const [{ data: clientesData, error: clientesError },
      { data: prestamosData, error: prestamosError },
      { data: cuotasData, error: cuotasError },
      { data: pagosData, error: pagosError }] = await Promise.all([
      supabase.from("clientes").select("*").eq("usuario_id", usuarioId),
      supabase.from("prestamos").select("*").eq("usuario_id", usuarioId),
      supabase.from("cuotas").select("*").eq("usuario_id", usuarioId),
      supabase.from("pagos").select("*").eq("usuario_id", usuarioId),
    ]);

    if (clientesError) {
      alert("Error cargando clientes: " + clientesError.message);
      return;
    }
    if (prestamosError) {
      alert("Error cargando préstamos: " + prestamosError.message);
      return;
    }
    if (cuotasError) {
      alert("Error cargando cuotas: " + cuotasError.message);
      return;
    }
    if (pagosError) {
      alert("Error cargando pagos: " + pagosError.message);
      return;
    }

    setClientes(clientesData || []);
    setPrestamos(prestamosData || []);
    setCuotas(cuotasData || []);
    setPagos(pagosData || []);
  };
  // ====== DATA ======
 
    // ====== LOGIN ======
  
  

  // ====== FILTRO MULTIUSUARIO ======
  const clientesFiltrados = useMemo(
    () =>
      clientes.filter((c) => c.user_id === usuarioActual?.id),
    [clientes, usuarioActual]
  );

  const prestamosFiltrados = useMemo(
    () =>
      prestamos.filter((p) => p.user_id === usuarioActual?.id),
    [prestamos, usuarioActual]
  );

  const cuotasFiltradas = useMemo(
    () =>
      cuotas.filter((c) => c.user_id === usuarioActual?.id),
    [cuotas, usuarioActual]
  );

  const pagosFiltrados = useMemo(
    () =>
      pagos.filter((p) => p.user_id === usuarioActual?.id),
    [pagos, usuarioActual]
  );

  // ====== MÉTRICAS ======
  const totalPrestado = useMemo(
    () =>
      prestamosFiltrados.reduce((acc, p) => acc + p.monto, 0),
    [prestamosFiltrados]
  );

  const totalCobrado = useMemo(
    () =>
      pagosFiltrados.reduce((acc, p) => acc + p.monto, 0),
    [pagosFiltrados]
  );

  const saldoPendiente = useMemo(
    () =>
      cuotasFiltradas.reduce(
        (acc, c) => acc + Number(c.restante || 0),
        0
      ),
    [cuotasFiltradas]
  );

  const totalVencido = useMemo(
    () =>
      cuotasFiltradas
        .filter(
          (c) =>
            c.estado === "VENCIDA" ||
            c.fecha < todayISO()
        )
        .reduce(
          (acc, c) => acc + Number(c.restante || 0),
          0
        ),
    [cuotasFiltradas]
  );

  const cobrosHoy = useMemo(
    () =>
      cuotasFiltradas.filter(
        (c) =>
          c.fecha === todayISO() &&
          Number(c.restante || 0) > 0
      ).length,
    [cuotasFiltradas]
  );

  const clientesVip = useMemo(
    () => clientesFiltrados.length,
    [clientesFiltrados]
  );
    // ====== LOGIN SCREEN ======
  if (!usuarioActual) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            ...cardStyle(),
            width: "100%",
            maxWidth: 430,
            display: "grid",
            gap: 16,
          }}
        >
          <SectionTitle
            title="CREDI YA MULTIUSUARIO"
            subtitle="Entra con tu usuario y verás solo tus datos"
          />

          <input
            style={inputStyle()}
            placeholder="Usuario"
            value={usuarioLogin}
            onChange={(e) => setUsuarioLogin(e.target.value)}
          />

          <input
            style={inputStyle()}
            placeholder="Contraseña"
            type="password"
            value={passwordLogin}
            onChange={(e) => setPasswordLogin(e.target.value)}
          />

          <button style={buttonStyle(true)} onClick={login}>
            Entrar
          </button>

          <button style={buttonStyle()} onClick={crearUsuarioRapido}>
            Crear usuario
          </button>

          <p style={{ margin: 0, color: MUTED }}>
            Usuarios creados: {usuarios.length}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: 16 }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: 34, color: TEXT }}>
                CREDI YA
              </h1>
              <p style={{ margin: 0, color: MUTED }}>
                Usuario: {usuarioActual.nombre || usuarioActual.usuario}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NavBtn
                to="dashboard"
                label="Dashboard"
                screen={screen}
                setScreen={setScreen}
              />
              <NavBtn
                to="clientes"
                label="Clientes"
                screen={screen}
                setScreen={setScreen}
              />
              <NavBtn
                to="prestamos"
                label="Préstamos"
                screen={screen}
                setScreen={setScreen}
              />
              <NavBtn
                to="cobros"
                label="Cobros"
                screen={screen}
                setScreen={setScreen}
              />
              <NavBtn
                to="pagos"
                label="Pagos"
                screen={screen}
                setScreen={setScreen}
              />
              <NavBtn
                to="morosos"
                label="Morosos"
                screen={screen}
                setScreen={setScreen}
              />
              <NavBtn
                to="configuracion"
                label="Config"
                screen={screen}
                setScreen={setScreen}
              />
              <button style={buttonStyle()} onClick={cerrarSesion}>
                Salir
              </button>
            </div>
          </div>
        </div>

        {screen === "dashboard" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <MetricCard
                title="Total prestado"
                value={formatEUR(totalPrestado)}
              />
              <MetricCard
                title="Total cobrado"
                value={formatEUR(totalCobrado)}
              />
              <MetricCard
                title="Saldo pendiente"
                value={formatEUR(saldoPendiente)}
              />
              <MetricCard
                title="Deuda vencida"
                value={formatEUR(totalVencido)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <MetricCard title="Cobros hoy" value={cobrosHoy} />
              <MetricCard title="Clientes VIP" value={clientesVip} />
            </div>
          </>
        )}

        {screen !== "dashboard" && (
          <div style={cardStyle()}>
            <SectionTitle
              title={screen.charAt(0).toUpperCase() + screen.slice(1)}
              subtitle="Pantalla preparada para seguir conectando multiusuario"
            />

            <p style={{ color: MUTED, marginTop: 12 }}>
              Esta parte la dejamos simple por ahora para comprobar que el
              login multiusuario funciona y que cada cuenta entra por separado.
            </p>

            <p style={{ color: TEXT, fontWeight: 700 }}>
              Usuario actual: {usuarioActual.nombre || usuarioActual.usuario}
            </p>

            <p style={{ color: MUTED }}>
              Clientes del usuario: {clientesFiltrados.length}
            </p>
            <p style={{ color: MUTED }}>
              Préstamos del usuario: {prestamosFiltrados.length}
            </p>
            <p style={{ color: MUTED }}>
              Cuotas del usuario: {cuotasFiltradas.length}
            </p>
            <p style={{ color: MUTED }}>
              Pagos del usuario: {pagosFiltrados.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}