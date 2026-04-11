"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const BG = "#f5f7fb";
const CARD = "#ffffff";
const TEXT = "#0f172a";
const MUTED = "#6b7280";
const PRIMARY = "#0f172a";
const DANGER = "#dc2626";

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatEUR = (n: number) =>
 new Intl.NumberFormat("es-ES", {
 style: "currency",
 currency: "EUR",
 }).format(Number(n || 0));

type Usuario = {
 id: string;
 usuario: string;
 password: string;
 nombre?: string;
 activo?: boolean;
};

type Cliente = {
 id: string;
 usuario_id: string;
 nombre: string;
 telefono?: string;
 documento?: string;
 direccion?: string;
 trabajo?: string;
 referencia?: string;
 notas?: string;
 ruta?: string;
};

type Prestamo = {
 id: string;
 usuario_id: string;
 client_id: string;
 monto: number;
 interes?: number;
 frecuencia?: string;
 cuotas?: number;
 total?: number;
 cuota?: number;
 saldo?: number;
 estado?: string;
 fecha_inicio?: string;
};

type Cuota = {
 id: string;
 usuario_id: string;
 prestamo_id: string;
 numero?: number;
 fecha: string;
 monto?: number;
 pagado?: number;
 restante: number;
 estado?: string;
};

type Pago = {
 id: string;
 usuario_id: string;
 prestamo_id?: string;
 cliente_id?: string;
 fecha: string;
 monto: number;
 metodo?: string;
 puntual?: boolean;
 nota?: string;
};

type BusinessSettings = {
 id?: string;
 usuario_id?: string;
 negocio?: string;
 logo_base64?: string;
 interes_mora_diario?: number;
};

const cardStyle = () => ({
 background: CARD,
 padding: 16,
 borderRadius: 12,
 border: "1px solid #e5e7eb",
});

const inputStyle = () => ({
 padding: 12,
 borderRadius: 10,
 border: "1px solid #d1d5db",
 width: "100%",
 fontSize: 16,
});

const buttonStyle = (primary = false) => ({
 padding: "12px 16px",
 borderRadius: 12,
 border: "none",
 background: primary ? PRIMARY : "#e5e7eb",
 color: primary ? "#fff" : TEXT,
 cursor: "pointer",
 fontSize: 16,
 fontWeight: 600 as const,
});

const SectionTitle = ({
 title,
 subtitle,
}: {
 title: string;
 subtitle?: string;
}) => (
 <div style={{ display: "grid", gap: 4 }}>
 <h2 style={{ margin: 0, color: TEXT }}>{title}</h2>
 {subtitle ? <p style={{ margin: 0, color: MUTED }}>{subtitle}</p> : null}
 </div>
);

const MetricCard = ({
 title,
 value,
}: {
 title: string;
 value: string | number;
}) => (
 <div style={cardStyle()}>
 <p style={{ margin: 0, color: MUTED }}>{title}</p>
 <h3 style={{ margin: "10px 0 0", fontSize: 28, color: TEXT }}>{value}</h3>
 </div>
);

const NavBtn = ({
 to,
 label,
 screen,
 setScreen,
}: {
 to: string;
 label: string;
 screen: string;
 setScreen: (v: any) => void;
}) => (
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

export default function App() {
 const [screen, setScreen] = useState("dashboard");

 const [usuarios, setUsuarios] = useState<Usuario[]>([]);
 const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);

 const [usuarioLogin, setUsuarioLogin] = useState("");
 const [passwordLogin, setPasswordLogin] = useState("");

 const [clientes, setClientes] = useState<Cliente[]>([]);
 const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
 const [cuotas, setCuotas] = useState<Cuota[]>([]);
 const [pagos, setPagos] = useState<Pago[]>([]);
 const [business, setBusiness] = useState<BusinessSettings | null>(null);

 const [clienteNombre, setClienteNombre] = useState("");
 const [clienteTelefono, setClienteTelefono] = useState("");
 const [clienteDocumento, setClienteDocumento] = useState("");
 const [clienteDireccion, setClienteDireccion] = useState("");
 const [clienteTrabajo, setClienteTrabajo] = useState("");
 const [clienteReferencia, setClienteReferencia] = useState("");
 const [clienteNotas, setClienteNotas] = useState("");
 const [clienteRuta, setClienteRuta] = useState("");

 const [prestamoClienteId, setPrestamoClienteId] = useState("");
 const [prestamoMonto, setPrestamoMonto] = useState("");
 const [prestamoInteres, setPrestamoInteres] = useState("0.2");
 const [prestamoFrecuencia, setPrestamoFrecuencia] = useState("DIARIO");
 const [prestamoCuotas, setPrestamoCuotas] = useState("20");

 const [pagoClienteId, setPagoClienteId] = useState("");
 const [pagoMonto, setPagoMonto] = useState("");
 const [pagoMetodo, setPagoMetodo] = useState("EFECTIVO");
 const [pagoNota, setPagoNota] = useState("");

 const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
 const [mostrarFormPrestamo, setMostrarFormPrestamo] = useState(false);
 const [mostrarFormPago, setMostrarFormPago] = useState(false);

 useEffect(() => {
 cargarUsuarios();
 }, []);

 useEffect(() => {
 if (usuarioActual?.id) {
 cargarDatosUsuario(usuarioActual.id);
 cargarBusiness(usuarioActual.id);
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

 const cargarBusiness = async (usuarioId: string) => {
 const { data } = await supabase
 .from("business_settings")
 .select("*")
 .eq("usuario_id", usuarioId)
 .maybeSingle();

 if (data) setBusiness(data);
 else setBusiness(null);
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
 setBusiness(null);
 setScreen("login");
 };

 const cargarDatosUsuario = async (usuarioId: string) => {
 const [
 { data: clientesData, error: clientesError },
 { data: prestamosData, error: prestamosError },
 { data: cuotasData, error: cuotasError },
 { data: pagosData, error: pagosError },
 ] = await Promise.all([
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

 const guardarCliente = async () => {
 if (!usuarioActual?.id) return;

 const { error } = await supabase.from("clientes").insert([
 {
 usuario_id: usuarioActual.id,
 nombre: clienteNombre,
 telefono: clienteTelefono,
 documento: clienteDocumento,
 direccion: clienteDireccion,
 trabajo: clienteTrabajo,
 referencia: clienteReferencia,
 notas: clienteNotas,
 ruta: clienteRuta,
 },
 ]);

 if (error) {
 alert("Error creando cliente: " + error.message);
 return;
 }

 alert("Cliente creado");
 setClienteNombre("");
 setClienteTelefono("");
 setClienteDocumento("");
 setClienteDireccion("");
 setClienteTrabajo("");
 setClienteReferencia("");
 setClienteNotas("");
 setClienteRuta("");
 setMostrarFormCliente(false);
 cargarDatosUsuario(usuarioActual.id);
 };

 const guardarPrestamo = async () => {
 if (!usuarioActual?.id) return;
 if (!prestamoClienteId || !prestamoMonto) return;

 const monto = Number(prestamoMonto);
 const interes = Number(prestamoInteres || 0);
 const cuotasCount = Number(prestamoCuotas || 0);
 const total = monto + monto * interes;
 const valorCuota = cuotasCount > 0 ? total / cuotasCount : total;

 const { data: prestamoCreado, error } = await supabase
 .from("prestamos")
 .insert([
 {
 usuario_id: usuarioActual.id,
 client_id: prestamoClienteId,
 monto,
 interes,
 frecuencia: prestamoFrecuencia,
 cuotas: cuotasCount,
 total,
 cuota: valorCuota,
 saldo: total,
 estado: "AL DIA",
 fecha_inicio: todayISO(),
 },
 ])
 .select()
 .maybeSingle();

 if (error || !prestamoCreado) {
 alert("Error creando préstamo: " + (error?.message || ""));
 return;
 }

 const cuotasInsert = Array.from({ length: cuotasCount }).map((_, i) => ({
 usuario_id: usuarioActual.id,
 prestamo_id: prestamoCreado.id,
 numero: i + 1,
 fecha: todayISO(),
 monto: valorCuota,
 pagado: 0,
 restante: valorCuota,
 estado: "PENDIENTE",
 }));

 const { error: cuotasError } = await supabase.from("cuotas").insert(cuotasInsert);

 if (cuotasError) {
 alert("Error creando cuotas: " + cuotasError.message);
 return;
 }

 alert("Préstamo creado");
 setPrestamoClienteId("");
 setPrestamoMonto("");
 setPrestamoInteres("0.2");
 setPrestamoFrecuencia("DIARIO");
 setPrestamoCuotas("20");
 setMostrarFormPrestamo(false);
 cargarDatosUsuario(usuarioActual.id);
 };

 const guardarPago = async () => {
 if (!usuarioActual?.id) return;
 if (!pagoClienteId || !pagoMonto) return;

 const clientePrestamos = prestamos.filter((p) => p.client_id === pagoClienteId);
 const prestamo = clientePrestamos[0];

 const { error } = await supabase.from("pagos").insert([
 {
 usuario_id: usuarioActual.id,
 cliente_id: pagoClienteId,
 prestamo_id: prestamo?.id || null,
 fecha: todayISO(),
 monto: Number(pagoMonto),
 metodo: pagoMetodo,
 puntual: true,
 nota: pagoNota,
 },
 ]);

 if (error) {
 alert("Error creando pago: " + error.message);
 return;
 }

 alert("Pago guardado");
 setPagoClienteId("");
 setPagoMonto("");
 setPagoMetodo("EFECTIVO");
 setPagoNota("");
 setMostrarFormPago(false);
 cargarDatosUsuario(usuarioActual.id);
 };

 const clientesFiltrados = useMemo(
 () => clientes.filter((c) => c.usuario_id === usuarioActual?.id),
 [clientes, usuarioActual]
 );

 const prestamosFiltrados = useMemo(
 () => prestamos.filter((p) => p.usuario_id === usuarioActual?.id),
 [prestamos, usuarioActual]
 );

 const cuotasFiltradas = useMemo(
 () => cuotas.filter((c) => c.usuario_id === usuarioActual?.id),
 [cuotas, usuarioActual]
 );

 const pagosFiltrados = useMemo(
 () => pagos.filter((p) => p.usuario_id === usuarioActual?.id),
 [pagos, usuarioActual]
 );

 const totalPrestado = useMemo(
 () => prestamosFiltrados.reduce((acc, p) => acc + Number(p.monto || 0), 0),
 [prestamosFiltrados]
 );

 const totalCobrado = useMemo(
 () => pagosFiltrados.reduce((acc, p) => acc + Number(p.monto || 0), 0),
 [pagosFiltrados]
 );

 const saldoPendiente = useMemo(
 () => cuotasFiltradas.reduce((acc, c) => acc + Number(c.restante || 0), 0),
 [cuotasFiltradas]
 );

 const totalVencido = useMemo(
 () =>
 cuotasFiltradas
 .filter((c) => c.estado === "VENCIDA" || c.fecha < todayISO())
 .reduce((acc, c) => acc + Number(c.restante || 0), 0),
 [cuotasFiltradas]
 );

 const cobrosHoy = useMemo(
 () =>
 cuotasFiltradas.filter(
 (c) => c.fecha === todayISO() && Number(c.restante || 0) > 0
 ).length,
 [cuotasFiltradas]
 );

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
 title="CREDI YA"
 subtitle="Control profesional de préstamos y cobros"
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
 <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
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
 {business?.negocio || "CREDI YA"}
 </h1>
 <p style={{ margin: 0, color: MUTED }}>
 Usuario: {usuarioActual.nombre || usuarioActual.usuario}
 </p>
 </div>

 <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 <NavBtn to="dashboard" label="Dashboard" screen={screen} setScreen={setScreen} />
 <NavBtn to="clientes" label="Clientes" screen={screen} setScreen={setScreen} />
 <NavBtn to="prestamos" label="Préstamos" screen={screen} setScreen={setScreen} />
 <NavBtn to="cobros" label="Cobros" screen={screen} setScreen={setScreen} />
 <NavBtn to="pagos" label="Pagos" screen={screen} setScreen={setScreen} />
 <NavBtn to="morosos" label="Morosos" screen={screen} setScreen={setScreen} />
 <NavBtn to="configuracion" label="Config" screen={screen} setScreen={setScreen} />
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
 <MetricCard title="Total prestado" value={formatEUR(totalPrestado)} />
 <MetricCard title="Total cobrado" value={formatEUR(totalCobrado)} />
 <MetricCard title="Saldo pendiente" value={formatEUR(saldoPendiente)} />
 <MetricCard title="Deuda vencida" value={formatEUR(totalVencido)} />
 <MetricCard title="Cobros hoy" value={cobrosHoy} />
 </div>
 </>
 )}


 {screen === "clientes" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <SectionTitle title="Clientes" subtitle="Alta y listado por usuario" />

 <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
 <button
 style={buttonStyle(true)}
 onClick={() => setMostrarFormCliente((v) => !v)}
 >
 {mostrarFormCliente ? "Cerrar formulario" : "Nuevo cliente"}
 </button>
 </div>

 {mostrarFormCliente && (
 <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
 <input
 style={inputStyle()}
 placeholder="Nombre"
 value={clienteNombre}
 onChange={(e) => setClienteNombre(e.target.value)}
 />
 <input
 style={inputStyle()}
 placeholder="Teléfono"
 value={clienteTelefono}
 onChange={(e) => setClienteTelefono(e.target.value)}
 />
 <input
 style={inputStyle()}
 placeholder="Documento"
 value={clienteDocumento}
 onChange={(e) => setClienteDocumento(e.target.value)}
 />
 <input
 style={inputStyle()}
 placeholder="Dirección"
 value={clienteDireccion}
 onChange={(e) => setClienteDireccion(e.target.value)}
 />
 <input
 style={inputStyle()}
 placeholder="Trabajo"
 value={clienteTrabajo}
 onChange={(e) => setClienteTrabajo(e.target.value)}
 />
 <input
 style={inputStyle()}
 placeholder="Referencia"
 value={clienteReferencia}
 onChange={(e) => setClienteReferencia(e.target.value)}
 />
 <input
 style={inputStyle()}
 placeholder="Notas"
 value={clienteNotas}
 onChange={(e) => setClienteNotas(e.target.value)}
 />
 <input
 style={inputStyle()}
 placeholder="Ruta"
 value={clienteRuta}
 onChange={(e) => setClienteRuta(e.target.value)}
 />

 <button style={buttonStyle(true)} onClick={guardarCliente}>
 Guardar cliente
 </button>
 </div>
 )}

 <div style={{ display: "grid", gap: 10 }}>
 {clientesFiltrados.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay clientes.</p>
 ) : (
 clientesFiltrados.map((c) => (
 <div key={c.id} style={cardStyle()}>
 <strong>{c.nombre}</strong>
 <p style={{ margin: "6px 0 0", color: MUTED }}>
 {c.telefono || "-"}
 </p>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 {screen === "prestamos" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <SectionTitle title="Préstamos" subtitle="Crear préstamo por usuario" />

 <button
 style={buttonStyle(true)}
 onClick={() => setMostrarFormPrestamo((v) => !v)}
 >
 {mostrarFormPrestamo ? "Cerrar formulario" : "Nuevo préstamo"}
 </button>

 {mostrarFormPrestamo && (
 <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
 <select
 style={inputStyle()}
 value={prestamoClienteId}
 onChange={(e) => setPrestamoClienteId(e.target.value)}
 >
 <option value="">Selecciona cliente</option>
 {clientesFiltrados.map((c) => (
 <option key={c.id} value={c.id}>
 {c.nombre}
 </option>
 ))}
 </select>

 <input
 style={inputStyle()}
 placeholder="Monto"
 value={prestamoMonto}
 onChange={(e) => setPrestamoMonto(e.target.value)}
 />

 <input
 style={inputStyle()}
 placeholder="Interés. Ej: 0.2"
 value={prestamoInteres}
 onChange={(e) => setPrestamoInteres(e.target.value)}
 />

 <select
 style={inputStyle()}
 value={prestamoFrecuencia}
 onChange={(e) => setPrestamoFrecuencia(e.target.value)}
 >
 <option value="DIARIO">DIARIO</option>
 <option value="SEMANAL">SEMANAL</option>
 <option value="MENSUAL">MENSUAL</option>
 </select>

 <input
 style={inputStyle()}
 placeholder="Número de cuotas"
 value={prestamoCuotas}
 onChange={(e) => setPrestamoCuotas(e.target.value)}
 />

 <button style={buttonStyle(true)} onClick={guardarPrestamo}>
 Guardar préstamo
 </button>
 </div>
 )}

 <div style={{ display: "grid", gap: 10 }}>
 {prestamosFiltrados.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay préstamos.</p>
 ) : (
 prestamosFiltrados.map((p) => {
 const cliente = clientesFiltrados.find((c) => c.id === p.client_id);
 return (
 <div key={p.id} style={cardStyle()}>
 <strong>{cliente?.nombre || "Cliente"}</strong>
 <p style={{ margin: "6px 0 0", color: MUTED }}>
 Monto: {formatEUR(Number(p.monto || 0))}
 </p>
 </div>
 );
 })
 )}
 </div>
 </div>
 )}

 {screen === "pagos" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <SectionTitle title="Pagos" subtitle="Registrar pagos por usuario" />

 <button
 style={buttonStyle(true)}
 onClick={() => setMostrarFormPago((v) => !v)}
 >
 {mostrarFormPago ? "Cerrar formulario" : "Nuevo pago"}
 </button>

 {mostrarFormPago && (
 <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
 <select
 style={inputStyle()}
 value={pagoClienteId}
 onChange={(e) => setPagoClienteId(e.target.value)}
 >
 <option value="">Selecciona cliente</option>
 {clientesFiltrados.map((c) => (
 <option key={c.id} value={c.id}>
 {c.nombre}
 </option>
 ))}
 </select>

 <input
 style={inputStyle()}
 placeholder="Monto"
 value={pagoMonto}
 onChange={(e) => setPagoMonto(e.target.value)}
 />

 <input
 style={inputStyle()}
 placeholder="Método"
 value={pagoMetodo}
 onChange={(e) => setPagoMetodo(e.target.value)}
 />

 <input
 style={inputStyle()}
 placeholder="Nota"
 value={pagoNota}
 onChange={(e) => setPagoNota(e.target.value)}
 />

 <button style={buttonStyle(true)} onClick={guardarPago}>
 Guardar pago
 </button>
 </div>
 )}

 <div style={{ display: "grid", gap: 10 }}>
 {pagosFiltrados.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay pagos.</p>
 ) : (
 pagosFiltrados.map((p) => (
 <div key={p.id} style={cardStyle()}>
 <strong>{formatEUR(Number(p.monto || 0))}</strong>
 <p style={{ margin: "6px 0 0", color: MUTED }}>
 {p.metodo || "EFECTIVO"} · {p.fecha}
 </p>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 {screen === "cobros" && (
 <div style={cardStyle()}>
 <SectionTitle
 title="Cobros"
 subtitle="Pantalla preparada para seguir ampliando"
 />
 </div>
 )}

 {screen === "morosos" && (
 <div style={cardStyle()}>
 <SectionTitle
 title="Morosos"
 subtitle="Pantalla preparada para seguir ampliando"
 />
 </div>
 )}

 {screen === "configuracion" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
 <SectionTitle
 title="Configuración"
 subtitle="Por ahora se lee desde business_settings"
 />
 <p style={{ margin: 0, color: MUTED }}>
 Negocio: {business?.negocio || "CREDI YA"}
 </p>
 <p style={{ margin: 0, color: MUTED }}>
 Interés mora diario: {business?.interes_mora_diario ?? 0}
 </p>
 </div>
 )}
 </div>
 </div>
 );
}