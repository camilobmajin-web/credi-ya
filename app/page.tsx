"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";

type Screen =
 | "login"
 | "dashboard"
 | "clientes"
 | "clienteDetalle"
 | "prestamos"
 | "cobros"
 | "pagos"
 | "morosos"
 | "configuracion";

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
 score?: number;
 created_at?: string;
};

type Prestamo = {
 id: string;
 usuario_id: string;
 client_id: string;
 monto: number;
 interes?: number;
 frecuencia?: "DIARIO" | "SEMANAL" | "MENSUAL" | string;
 cuotas?: number;
 total?: number;
 cuota?: number;
 saldo?: number;
 estado?: string;
 fecha_inicio?: string;
 created_at?: string;
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
 created_at?: string;
};

type Pago = {
 id: string;
 usuario_id: string;
 prestamo_id?: string | null;
 fecha: string;
 monto: number;
 metodo?: string;
 puntual?: boolean;
 nota?: string;
 created_at?: string;
};

type BusinessSettings = {
  id?: string;
  usuario_id?: string;
  negocio?: string;
  logo_base64?: string;
  interes_mora_diario?: number;
  moneda?: string;
};

type PrestamoReal = Prestamo & {
 cliente?: Cliente | null;
 cuotasLista: Cuota[];
 saldoBase: number;
 mora: number;
 saldoReal: number;
 estadoReal: string;
};

const BG = "#f5f7fb";
const CARD = "#ffffff";
const TEXT = "#0f172a";
const MUTED = "#6b7280";
const BORDER = "#cbd5e1";
const PRIMARY = "#0f172a";
const SUCCESS = "#15803d";
const WARNING = "#d97706";
const DANGER = "#dc2626";
const INFO = "#2563eb";
const SESSION_KEY = "crediya_usuario_actual";

const todayISO = () => new Date().toISOString().slice(0, 10);


function cardStyle(): CSSProperties {
 return {
 background: CARD,
 padding: 16,
 borderRadius: 16,
 border: `1px solid ${BORDER}`,
 boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
 };
}

function inputStyle(): CSSProperties {
 return {
 width: "100%",
 padding: 12,
 borderRadius: 12,
 border: `1px solid ${BORDER}`,
 fontSize: 16,
 background: "#fff",
 color: TEXT,
 };
}

function buttonStyle(primary = false): CSSProperties {
 return {
 padding: "12px 16px",
 borderRadius: 12,
 border: primary ? "none" : `1px solid ${BORDER}`,
 background: primary ? PRIMARY : "#fff",
 color: primary ? "#fff" : TEXT,
 cursor: "pointer",
 fontSize: 16,
 fontWeight: 700,
 };
}

function badgeColor(value: string) {
 if (value === "ACTIVO" || value === "AL DÍA" || value === "PAGADA") return SUCCESS;
 if (value === "COBRAR HOY" || value === "PARCIAL") return WARNING;
 if (value === "MOROSO" || value === "VENCIDO" || value === "MOROSO") return DANGER;
 if (value === "PAGADO") return INFO;
 return TEXT;
}

function badgeStyle(color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "7px 12px",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: "#ffffff",
    color,
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 0.3,
  };
}

function todayMid(dateISO: string) {
 return new Date(`${dateISO}T12:00:00`).getTime();
}

function daysLate(fecha: string) {
 const diff = Math.floor((todayMid(todayISO()) - todayMid(fecha)) / (1000 * 60 * 60 * 24));
 return diff > 0 ? diff : 0;
}

function calcularMora(fecha: string, restante: number, interesMoraDiario: number) {
 const saldo = Number(restante || 0);
 const interes = Number(interesMoraDiario || 0);
 if (!saldo || saldo <= 0 || !interes) return 0;
 const atraso = daysLate(fecha);
 if (atraso <= 0) return 0;
 return Number((saldo * interes * atraso).toFixed(2));
}

function addDays(dateISO: string, days: number) {
 const d = new Date(`${dateISO}T12:00:00`);
 d.setDate(d.getDate() + days);
 return d.toISOString().slice(0, 10);
}

function addBusinessDays(dateISO: string, businessDays: number) {
 const d = new Date(`${dateISO}T12:00:00`);
 let added = 0;
 while (added < businessDays) {
 if (added === 0) break;
 d.setDate(d.getDate() + 1);
 const day = d.getDay();
 if (day !== 0 && day !== 6) added += 1;
 }
 return d.toISOString().slice(0, 10);
}

function nextBusinessDate(dateISO: string, offset: number) {
 if (offset === 0) return dateISO;
 let current = dateISO;
 let added = 0;
 while (added < offset) {
 current = addDays(current, 1);
 const day = new Date(`${current}T12:00:00`).getDay();
 if (day !== 0 && day !== 6) added += 1;
 }
 return current;
}

function addMonths(dateISO: string, months: number) {
 const d = new Date(`${dateISO}T12:00:00`);
 d.setMonth(d.getMonth() + months);
 return d.toISOString().slice(0, 10);
}

function getNivelByScore(score: number) {
 if (score >= 20) return "VIP";
 if (score >= 10) return "BUENO";
 if (score >= 0) return "REGULAR";
 return "MOROSO";
}

function fileToBase64(file: File) {
 return new Promise<string>((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => resolve(String(reader.result || ""));
 reader.onerror = reject;
 reader.readAsDataURL(file);
 });
}

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
 <div style={{ display: "grid", gap: 4 }}>
 <h2 style={{ margin: 0, color: TEXT }}>{title}</h2>
 {subtitle ? <p style={{ margin: 0, color: MUTED }}>{subtitle}</p> : null}
 </div>
);

const MetricCard = ({ title, value, danger = false }: { title: string; value: string | number; danger?: boolean }) => (
 <div style={cardStyle()}>
 <p style={{ margin: 0, color: MUTED }}>{title}</p>
 <h3 style={{ margin: "10px 0 0", fontSize: 30, color: danger ? DANGER : TEXT }}>{value}</h3>
 </div>
);

const NavBtn = ({ to, label, screen, setScreen }: { to: Screen; label: string; screen: Screen; setScreen: (v: Screen) => void }) => (
 <button
 style={{
 ...buttonStyle(screen === to),
 background: screen === to ? PRIMARY : "#fff",
 color: screen === to ? "#fff" : TEXT,
 }}
 onClick={() => setScreen(to)}
 >
 {label}
 </button>
);

export default function App() {
 const [screen, setScreen] = useState<Screen>("login");
const [prestamoPlanSemanal, setPrestamoPlanSemanal] = useState("4");
 const [usuarios, setUsuarios] = useState<Usuario[]>([]);
 const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
const [prestamoPlanMensual, setPrestamoPlanMensual] = useState("1");
 const [usuarioLogin, setUsuarioLogin] = useState("");
 const [passwordLogin, setPasswordLogin] = useState("");

 const [clientes, setClientes] = useState<Cliente[]>([]);
 const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
 const [cuotas, setCuotas] = useState<Cuota[]>([]);
 const [pagos, setPagos] = useState<Pago[]>([]);
 const [business, setBusiness] = useState<BusinessSettings | null>(null);
const formatMoney = (
  n: number,
  currency = business?.moneda || "EUR",
  locale = "es-ES"
) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(Number(n || 0));
 const [loading, setLoading] = useState(false);
 const [busquedaClientes, setBusquedaClientes] = useState("");
 const [busquedaPrestamos, setBusquedaPrestamos] = useState("");
 const [busquedaCobros, setBusquedaCobros] = useState("");
 const [busquedaPagos, setBusquedaPagos] = useState("");
 const [busquedaMorosos, setBusquedaMorosos] = useState("");
 const [soloCobrosHoy, setSoloCobrosHoy] = useState(true);

 const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

 const [clienteNombre, setClienteNombre] = useState("");
 const [clienteTelefono, setClienteTelefono] = useState("");
 const [clienteDocumento, setClienteDocumento] = useState("");
 const [clienteDireccion, setClienteDireccion] = useState("");
 const [clienteTrabajo, setClienteTrabajo] = useState("");
 const [clienteReferencia, setClienteReferencia] = useState("");
 const [clienteNotas, setClienteNotas] = useState("");
 const [clienteRuta, setClienteRuta] = useState("");
 const [editingClienteId, setEditingClienteId] = useState<string | null>(null);

 const [prestamoClienteId, setPrestamoClienteId] = useState("");
 const [prestamoMonto, setPrestamoMonto] = useState("");
 const [prestamoInteres, setPrestamoInteres] = useState("0.15");
 const [prestamoFrecuencia, setPrestamoFrecuencia] = useState<"DIARIO" | "SEMANAL" | "MENSUAL">("DIARIO");
 const [prestamoCuotas, setPrestamoCuotas] = useState("20");
 const [prestamoFechaInicio, setPrestamoFechaInicio] = useState(todayISO());
const [prestamoPlanDiario, setPrestamoPlanDiario] = useState("20");
 const [selectedCobroCuotaId, setSelectedCobroCuotaId] = useState<string | null>(null);
 const [pagoMonto, setPagoMonto] = useState("");
 const [pagoMetodo, setPagoMetodo] = useState("EFECTIVO");
 const [pagoFecha, setPagoFecha] = useState(todayISO());
 const [pagoNota, setPagoNota] = useState("");

 const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
 const [mostrarFormPrestamo, setMostrarFormPrestamo] = useState(false);
 const [mostrarFormPago, setMostrarFormPago] = useState(false);

 const [configNegocio, setConfigNegocio] = useState("CREDI YA");
 const [configInteresMora, setConfigInteresMora] = useState("0.01");
 const [configLogoBase64, setConfigLogoBase64] = useState("");
const [configMoneda, setConfigMoneda] = useState("EUR");

 useEffect(() => {
 void cargarUsuarios();
 const raw = localStorage.getItem(SESSION_KEY);
 if (!raw) return;
 try {
 const user = JSON.parse(raw) as Usuario;
 setUsuarioActual(user);
 setScreen("dashboard");
 } catch {
 localStorage.removeItem(SESSION_KEY);
 }
 }, []);

 useEffect(() => {
 if (!usuarioActual?.id) return;
 localStorage.setItem(SESSION_KEY, JSON.stringify(usuarioActual));
 void cargarDatosUsuario(usuarioActual.id);
 void cargarBusiness(usuarioActual.id);
 }, [usuarioActual?.id]);

 async function cargarUsuarios() {
 const { data, error } = await supabase.from("usuarios_app").select("*").order("created_at", { ascending: true });
 if (error) {
 alert(`Error cargando usuarios: ${error.message}`);
 return;
 }
 setUsuarios((data || []) as Usuario[]);
 }

 async function cargarBusiness(usuarioId: string) {
 const { data } = await supabase.from("business_settings").select("*").eq("usuario_id", usuarioId).maybeSingle();
 if (data) {
 const cfg = data as BusinessSettings;
 setBusiness(cfg);
 setConfigNegocio(cfg.negocio || "CREDI YA");
 setConfigInteresMora(String(cfg.interes_mora_diario ?? 0.01));
 setConfigLogoBase64(cfg.logo_base64 || "");
 setConfigMoneda(cfg.moneda || "EUR");
 } else {
 setBusiness(null);
 setConfigNegocio("CREDI YA");
 setConfigInteresMora("0.01");
 setConfigLogoBase64("");
 setConfigMoneda("EUR");
 }
 }

 async function guardarBusiness() {
 if (!usuarioActual?.id) return;
 const payload = {
 usuario_id: usuarioActual.id,
 negocio: configNegocio || "CREDI YA",
 logo_base64: configLogoBase64 || "",
 interes_mora_diario: Number(configInteresMora || 0.01),
 moneda: configMoneda || "EUR"
 };

 if (business?.id) {
 const { error } = await supabase.from("business_settings").update(payload).eq("id", business.id);
 if (error) {
 alert(`Error guardando configuración: ${error.message}`);
 return;
 }
 } else {
 const { data, error } = await supabase.from("business_settings").insert([payload]).select().maybeSingle();
 if (error) {
 alert(`Error guardando configuración: ${error.message}`);
 return;
 }
 if (data) setBusiness(data as BusinessSettings);
 }

 alert("Configuración guardada");
 void cargarBusiness(usuarioActual.id);
 }

 async function onLogoChange(file: File | null) {
 if (!file) return;
 const base64 = await fileToBase64(file);
 setConfigLogoBase64(base64);
 }

 async function login() {
 const { data, error } = await supabase
 .from("usuarios_app")
 .select("*")
 .eq("usuario", usuarioLogin)
 .eq("password", passwordLogin)
 .maybeSingle();

 if (error) {
 alert(`Error en login: ${error.message}`);
 return;
 }
 if (!data) {
 alert("Usuario o contraseña incorrectos");
 return;
 }

 setUsuarioActual(data as Usuario);
 setScreen("dashboard");
 }

 async function crearUsuarioRapido() {
 const nombre = prompt("Nombre del usuario");
 if (!nombre) return;
 const usuario = prompt("Usuario");
 if (!usuario) return;
 const password = prompt("Contraseña");
 if (!password) return;

 const { error } = await supabase.from("usuarios_app").insert([{ nombre, usuario, password, activo: true }]);
 if (error) {
 alert(`Error creando usuario: ${error.message}`);
 return;
 }

 alert("Usuario creado");
 void cargarUsuarios();
 }

 function cerrarSesion() {
 localStorage.removeItem(SESSION_KEY);
 setUsuarioActual(null);
 setUsuarioLogin("");
 setPasswordLogin("");
 setClientes([]);
 setPrestamos([]);
 setCuotas([]);
 setPagos([]);
 setBusiness(null);
 setScreen("login");
 setSelectedClienteId(null);
 }

 async function cargarDatosUsuario(usuarioId: string) {
 setLoading(true);
 const [clientesRes, prestamosRes, cuotasRes, pagosRes] = await Promise.all([
 supabase.from("clientes").select("*").eq("usuario_id", usuarioId).order("created_at", { ascending: false }),
 supabase.from("prestamos").select("*").eq("usuario_id", usuarioId).order("created_at", { ascending: false }),
 supabase.from("cuotas").select("*").eq("usuario_id", usuarioId).order("numero", { ascending: true }),
 supabase.from("pagos").select("*").eq("usuario_id", usuarioId).order("created_at", { ascending: false }),
 ]);

 if (clientesRes.error) return alert(`Error cargando clientes: ${clientesRes.error.message}`);
 if (prestamosRes.error) return alert(`Error cargando préstamos: ${prestamosRes.error.message}`);
 if (cuotasRes.error) return alert(`Error cargando cuotas: ${cuotasRes.error.message}`);
 if (pagosRes.error) return alert(`Error cargando pagos: ${pagosRes.error.message}`);

 setClientes((clientesRes.data || []) as Cliente[]);
 setPrestamos((prestamosRes.data || []) as Prestamo[]);
 setCuotas((cuotasRes.data || []) as Cuota[]);
 setPagos((pagosRes.data || []) as Pago[]);
 setLoading(false);
 }

 function limpiarFormularioCliente() {
 setClienteNombre("");
 setClienteTelefono("");
 setClienteDocumento("");
 setClienteDireccion("");
 setClienteTrabajo("");
 setClienteReferencia("");
 setClienteNotas("");
 setClienteRuta("");
 setEditingClienteId(null);
 }

 async function guardarCliente() {
 if (!usuarioActual?.id) return;
 if (!clienteNombre.trim()) return alert("El nombre es obligatorio");

 const payload = {
 usuario_id: usuarioActual.id,
 nombre: clienteNombre.trim(),
 telefono: clienteTelefono.trim(),
 documento: clienteDocumento.trim(),
 direccion: clienteDireccion.trim(),
 trabajo: clienteTrabajo.trim(),
 referencia: clienteReferencia.trim(),
 notas: clienteNotas.trim(),
 ruta: clienteRuta.trim(),
 };

 if (editingClienteId) {
 const { error } = await supabase.from("clientes").update(payload).eq("id", editingClienteId);
 if (error) return alert(`Error actualizando cliente: ${error.message}`);
 alert("Cliente actualizado");
 } else {
 const { error } = await supabase.from("clientes").insert([payload]);
 if (error) return alert(`Error creando cliente: ${error.message}`);
 alert("Cliente creado");
 }

 limpiarFormularioCliente();
 setMostrarFormCliente(false);
 void cargarDatosUsuario(usuarioActual.id);
 }

 function editarCliente(cliente: Cliente) {
 setEditingClienteId(cliente.id);
 setClienteNombre(cliente.nombre || "");
 setClienteTelefono(cliente.telefono || "");
 setClienteDocumento(cliente.documento || "");
 setClienteDireccion(cliente.direccion || "");
 setClienteTrabajo(cliente.trabajo || "");
 setClienteReferencia(cliente.referencia || "");
 setClienteNotas(cliente.notas || "");
 setClienteRuta(cliente.ruta || "");
 setMostrarFormCliente(true);
 setScreen("clientes");
 }

 async function eliminarCliente(clienteId: string) {
 if (!confirm("¿Seguro que quieres borrar este cliente?")) return;
 const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
 if (error) return alert(`Error borrando cliente: ${error.message}`);
 if (selectedClienteId === clienteId) {
 setSelectedClienteId(null);
 setScreen("clientes");
 }
 if (usuarioActual?.id) void cargarDatosUsuario(usuarioActual.id);
 }

 async function guardarPrestamo() {
 if (!usuarioActual?.id) return;
 if (!prestamoClienteId) return alert("Selecciona cliente");
 if (!prestamoMonto) return alert("Ingresa monto");

 const monto = Number(prestamoMonto || 0);
 const interes = Number(prestamoInteres || 0.15);
 const cuotasCount = Number(prestamoCuotas || 0);
 const frecuencia = prestamoFrecuencia;
 const fechaInicio = prestamoFechaInicio || todayISO();

 if (!monto || !cuotasCount) return alert("Monto o cuotas inválidos");

 const total = Number((monto * (1 + interes)).toFixed(2));
 const valorCuota = Number((total / cuotasCount).toFixed(2));

 const { data: prestamoCreado, error } = await supabase
 .from("prestamos")
 .insert([
 {
 usuario_id: usuarioActual.id,
 client_id: prestamoClienteId,
 monto,
 interes,
 frecuencia,
 cuotas: cuotasCount,
 total,
 cuota: valorCuota,
 saldo: total,
 estado: frecuencia === "DIARIO" ? "COBRAR HOY" : "AL DÍA",
 fecha_inicio: fechaInicio,
 },
 ])
 .select()
 .maybeSingle();

 if (error || !prestamoCreado) {
 alert(`Error creando préstamo: ${error?.message || "desconocido"}`);
 return;
 }

 const cuotasInsert = Array.from({ length: cuotasCount }).map((_, i) => {
 let fecha = fechaInicio;
 if (frecuencia === "DIARIO") fecha = nextBusinessDate(fechaInicio, i);
 if (frecuencia === "SEMANAL") fecha = addDays(fechaInicio, (i + 1) * 7);
 if (frecuencia === "MENSUAL") fecha = addMonths(fechaInicio, i + 1);
 return {
 usuario_id: usuarioActual.id,
 prestamo_id: prestamoCreado.id,
 numero: i + 1,
 fecha,
 monto: valorCuota,
 pagado: 0,
 restante: valorCuota,
 estado: fecha < todayISO() ? "VENCIDA" : fecha === todayISO() ? "PENDIENTE" : "PENDIENTE",
 };
 });

 const { error: cuotasError } = await supabase.from("cuotas").insert(cuotasInsert);
 if (cuotasError) {
 alert(`Error creando cuotas: ${cuotasError.message}`);
 return;
 }

 alert("Préstamo creado");
 setPrestamoClienteId("");
 setPrestamoMonto("");
 setPrestamoInteres("0.15");
 setPrestamoFrecuencia("DIARIO");
 setPrestamoCuotas("20");
 setPrestamoFechaInicio(todayISO());
 setMostrarFormPrestamo(false);
 void cargarDatosUsuario(usuarioActual.id);
 }

 function generarReciboPDF(args: {
  cliente: Cliente | null;
  prestamo: Prestamo | undefined;
  monto: number;
  fecha: string;
  metodo: string;
  nota: string;
  mora: number;
  saldo: number;
  cuotasPendientes: number;
  cuotasPagadas: number;
  cuotaActual: number;
  cuotasTotales: number;
  montoPrestamo: number;
  totalPrestamo: number;
  frecuencia: string;
}) {
  const doc = new jsPDF();

  const negocio = business?.negocio || "CREDI YA";
  const estado = args.saldo <= 0 ? "PAZ Y SALVO" : "DEUDA ACTIVA";

  let y = 20;

  try {
    if (business?.logo_base64) {
      doc.addImage(business.logo_base64, "PNG", 20, 12, 32, 18);
    }
  } catch (e) {
    // si el logo falla, el PDF sigue normal
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(negocio, 60, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Recibo profesional de pago", 60, 28);

  y = 42;

  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  const line = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(`${label}: ${value}`, 20, y);
    y += 8;
  };

  line("Cliente", args.cliente?.nombre || "Cliente", true);
  line("Documento", args.cliente?.documento || "No registrado");
  line("Teléfono", args.cliente?.telefono || "-");
  line("Fecha", args.fecha);

  y += 4;
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Detalle del préstamo", 20, y);
  y += 8;

  line("Préstamo entregado", formatMoney(args.montoPrestamo));
line("Total del préstamo", formatMoney(args.totalPrestamo));
line("Frecuencia", args.frecuencia);
line("Estado actual", estado, true);
  line("Deuda activa", formatMoney(args.saldo), true);
  line("Mora acumulada", formatMoney(args.mora));

  y += 4;
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Detalle de cuotas", 20, y);
  y += 8;

  line("Cuota pagada", `Cuota ${args.cuotaActual}`);
  line("Cuotas pagadas", String(args.cuotasPagadas));
  line("Cuotas pendientes", String(args.cuotasPendientes));
  line("Total cuotas", String(args.cuotasTotales));

  y += 4;
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Detalle del pago", 20, y);
  y += 8;

  line("Monto pagado", formatMoney(args.monto), true);
  line("Método", args.metodo);
  line("Nota", args.nota || "-");

  y += 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(
    estado === "PAZ Y SALVO"
      ? "Comprobante generado: cliente al día y sin saldo pendiente."
      : "Comprobante generado: pago aplicado correctamente al préstamo.",
    20,
    y
  );

  doc.save(
    `recibo-${(args.cliente?.nombre || "cliente")
      .replace(/\\s+/g, "-")
      .toLowerCase()}.pdf`
  );
}
async function recalcularPrestamo(prestamoId: string) {
  const cuotasPrestamo = cuotas
    .filter((c) => c.prestamo_id === prestamoId)
    .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

  const saldoBase = cuotasPrestamo.reduce(
    (acc, c) => acc + Number(c.restante || 0),
    0
  );

  const mora = cuotasPrestamo.reduce(
    (acc, c) =>
      acc +
      calcularMora(
        c.fecha,
        Number(c.restante || 0),
        Number(business?.interes_mora_diario || 0.01)
      ),
    0
  );

  const saldoReal = Number((saldoBase + mora).toFixed(2));

  const tieneVencidas = cuotasPrestamo.some(
    (c) => c.fecha < todayISO() && Number(c.restante || 0) > 0
  );

  const tieneHoy = cuotasPrestamo.some(
    (c) => c.fecha === todayISO() && Number(c.restante || 0) > 0
  );

  const estadoPrestamo =
    saldoBase <= 0
      ? "PAGADO"
      : tieneVencidas
      ? "VENCIDO"
      : tieneHoy
      ? "COBRAR HOY"
      : "AL DÍA";

  const { error } = await supabase
    .from("prestamos")
    .update({
      saldo: saldoReal,
      estado: estadoPrestamo,
    })
    .eq("id", prestamoId);

  if (error) {
    alert("Error actualizando préstamo: " + error.message);
  }
}
 async function registrarPago() {
 if (!usuarioActual?.id) return;
 if (!selectedCobroCuotaId) return alert("Selecciona una cuota a cobrar");
 const cuotaSeleccionada = cuotas.find((c) => c.id === selectedCobroCuotaId);
 if (!cuotaSeleccionada) return alert("Cuota no encontrada");

 const prestamo = prestamos.find((p) => p.id === cuotaSeleccionada.prestamo_id);
 if (!prestamo) return alert("Préstamo no encontrado");
 const cliente = clientes.find((c) => c.id === prestamo.client_id) || null;

 const montoAbono = Number(pagoMonto || 0);
 if (!montoAbono || montoAbono <= 0) return alert("Monto inválido");

 const cuotasPrestamo = cuotas
 .filter((c) => c.prestamo_id === prestamo.id && Number(c.restante || 0) > 0)
 .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

 let restantePorAplicar = montoAbono;
 for (const cuota of cuotasPrestamo) {
 if (restantePorAplicar <= 0) break;
 const restanteActual = Number(cuota.restante || 0);
 const pagadoActual = Number(cuota.pagado || 0);
 const abono = Math.min(restantePorAplicar, restanteActual);
 const nuevoPagado = pagadoActual + abono;
 const nuevoRestante = Number((restanteActual - abono).toFixed(2));

 let nuevoEstado = "PENDIENTE";
 if (nuevoRestante <= 0) nuevoEstado = "PAGADA";
 else if (nuevoPagado > 0) nuevoEstado = "PARCIAL";
 if (nuevoRestante > 0 && cuota.fecha < todayISO()) nuevoEstado = "VENCIDA";

 const { error } = await supabase
 .from("cuotas")
 .update({ pagado: nuevoPagado, restante: nuevoRestante, estado: nuevoEstado })
 .eq("id", cuota.id);
 if (error) return alert(`Error actualizando cuota: ${error.message}`);

 restantePorAplicar = Number((restantePorAplicar - abono).toFixed(2));
 }

 const puntual = pagoFecha <= cuotaSeleccionada.fecha;
 const { error: pagoError } = await supabase.from("pagos").insert([
 {
 usuario_id: usuarioActual.id,
 prestamo_id: prestamo.id,
 fecha: pagoFecha,
 monto: montoAbono,
 metodo: pagoMetodo,
 puntual,
 nota: pagoNota,
 },
 ]);
 if (pagoError) return alert(`Error creando pago: ${pagoError.message}`);

 await recalcularPrestamo(prestamo.id);

const { data: cuotasFresh, error: cuotasFreshError } = await supabase
  .from("cuotas")
  .select("*")
  .eq("prestamo_id", prestamo.id)
  .order("numero", { ascending: true });

if (cuotasFreshError) {
  alert(`Error recargando cuotas: ${cuotasFreshError.message}`);
  return;
}

const cuotasPrestamoActualizadas = (cuotasFresh || []) as Cuota[];

const saldoBase = cuotasPrestamoActualizadas.reduce(
  (acc, c) => acc + Number(c.restante || 0),
  0
);

const mora = cuotasPrestamoActualizadas.reduce(
  (acc, c) =>
    acc +
    calcularMora(
      c.fecha,
      Number(c.restante || 0),
      Number(business?.interes_mora_diario || 0.01)
    ),
  0
);

const saldoReal = Number((saldoBase + mora).toFixed(2));

const cuotasPendientes = cuotasPrestamoActualizadas.filter(
  (c) => Number(c.restante || 0) > 0
).length;

const cuotasPagadas = cuotasPrestamoActualizadas.filter(
  (c) => Number(c.restante || 0) <= 0
).length;

generarReciboPDF({
  cliente,
  prestamo,
  monto: montoAbono,
  fecha: pagoFecha,
  metodo: pagoMetodo,
  nota: pagoNota,
  mora,
  saldo: saldoReal,
  cuotasPendientes,
  cuotasPagadas,
  cuotaActual: Number(cuotaSeleccionada.numero || 0),
  cuotasTotales: Number(prestamo.cuotas || 0),
  montoPrestamo: Number(prestamo.monto || 0),
  totalPrestamo: Number(prestamo.total || 0),
  frecuencia:  prestamo?.frecuencia || "-",
});

await cargarDatosUsuario(usuarioActual.id);

 setPagoMonto("");
 setPagoMetodo("EFECTIVO");
 setPagoFecha(todayISO());
 setPagoNota("");
 setSelectedCobroCuotaId(null);
 setMostrarFormPago(false);
 alert("Pago registrado");
 await cargarDatosUsuario(usuarioActual.id);
 }

 const clienteById = useMemo(() => {
 const map = new Map<string, Cliente>();
 clientes.forEach((c) => map.set(c.id, c));
 return map;
 }, [clientes]);

 const prestamosReales = useMemo<PrestamoReal[]>(() => {
 return prestamos.map((p) => {
 const cuotasLista = cuotas.filter((c) => c.prestamo_id === p.id).sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
 const saldoBase = cuotasLista.reduce((acc, c) => acc + Number(c.restante || 0), 0);
 const mora = cuotasLista.reduce(
 (acc, c) => acc + calcularMora(c.fecha, Number(c.restante || 0), Number(business?.interes_mora_diario || 0.01)),
 0
 );
 const saldoReal = Number((saldoBase + mora).toFixed(2));
 const tieneVencidas = cuotasLista.some((c) => c.fecha < todayISO() && Number(c.restante || 0) > 0);
 const tieneHoy = cuotasLista.some((c) => c.fecha === todayISO() && Number(c.restante || 0) > 0);
 const estadoReal = saldoBase <= 0 ? "PAGADO" : tieneVencidas ? "MOROSO" : tieneHoy ? "COBRAR HOY" : "ACTIVO";
 return {
 ...p,
 cliente: clienteById.get(p.client_id) || null,
 cuotasLista,
 saldoBase,
 mora,
 saldoReal,
 estadoReal,
 };
 });
 }, [prestamos, cuotas, business?.interes_mora_diario, clienteById]);

 const clientesFiltrados = useMemo(() => {
 const q = busquedaClientes.toLowerCase().trim();
 return clientes.filter((c) => `${c.nombre} ${c.telefono || ""} ${c.documento || ""} ${c.ruta || ""}`.toLowerCase().includes(q));
 }, [clientes, busquedaClientes]);

 const prestamosFiltrados = useMemo(() => {
 const q = busquedaPrestamos.toLowerCase().trim();
 return prestamosReales.filter((p) => `${p.cliente?.nombre || ""} ${p.cliente?.telefono || ""} ${p.estadoReal}`.toLowerCase().includes(q));
 }, [prestamosReales, busquedaPrestamos]);

 const cobrosFiltrados = useMemo(() => {
 const q = busquedaCobros.toLowerCase().trim();
 return cuotas
 .filter((c) => Number(c.restante || 0) > 0)
 .map((cuota) => {
 const prestamo = prestamosReales.find((p) => p.id === cuota.prestamo_id);
 const cliente = prestamo?.cliente || null;
 return { cuota, prestamo, cliente };
 })
 .filter((row) => {
 const txt = `${row.cliente?.nombre || ""} ${row.cliente?.telefono || ""} ${row.cuota.fecha}`.toLowerCase();
 const pasaBusqueda = txt.includes(q);
 const pasaHoy = soloCobrosHoy ? row.cuota.fecha === todayISO() : true;
 return pasaBusqueda && pasaHoy;
 })
 .sort((a, b) => todayMid(a.cuota.fecha) - todayMid(b.cuota.fecha));
 }, [cuotas, prestamosReales, busquedaCobros, soloCobrosHoy]);

 const pagosFiltrados = useMemo(() => {
 const q = busquedaPagos.toLowerCase().trim();
 return pagos.filter((p) => {
 const prestamo = prestamosReales.find((x) => x.id === p.prestamo_id);
 const cliente = prestamo?.cliente;
 return `${cliente?.nombre || ""} ${p.metodo || ""} ${p.fecha}`.toLowerCase().includes(q);
 });
 }, [pagos, prestamosReales, busquedaPagos]);

 const morosos = useMemo(() => {
 const q = busquedaMorosos.toLowerCase().trim();
 const map = new Map<string, { cliente: Cliente; totalVencido: number; totalMora: number; diasMax: number; cuotasVencidas: number }>();

 cuotas
 .filter((c) => c.fecha < todayISO() && Number(c.restante || 0) > 0)
 .forEach((cuota) => {
 const prestamo = prestamos.find((p) => p.id === cuota.prestamo_id);
 const cliente = prestamo ? clienteById.get(prestamo.client_id) : null;
 if (!cliente) return;
 const prev = map.get(cliente.id);
 const mora = calcularMora(cuota.fecha, Number(cuota.restante || 0), Number(business?.interes_mora_diario || 0.01));
 const dias = daysLate(cuota.fecha);
 if (!prev) {
 map.set(cliente.id, {
 cliente,
 totalVencido: Number(cuota.restante || 0),
 totalMora: mora,
 diasMax: dias,
 cuotasVencidas: 1,
 });
 } else {
 prev.totalVencido += Number(cuota.restante || 0);
 prev.totalMora += mora;
 prev.diasMax = Math.max(prev.diasMax, dias);
 prev.cuotasVencidas += 1;
 }
 });

 return Array.from(map.values()).filter((item) => `${item.cliente.nombre} ${item.cliente.telefono || ""}`.toLowerCase().includes(q));
 }, [cuotas, prestamos, clienteById, business?.interes_mora_diario, busquedaMorosos]);

 const selectedCliente = clientes.find((c) => c.id === selectedClienteId) || null;
 const prestamosCliente = prestamosReales.filter((p) => p.client_id === selectedClienteId);
 const pagosCliente = pagos.filter((p) => {
 const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
 return prestamo?.client_id === selectedClienteId;
 });

 const totalPrestado = useMemo(() => prestamosReales.reduce((acc, p) => acc + Number(p.monto || 0), 0), [prestamosReales]);
 const totalCobrado = useMemo(() => pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0), [pagos]);
 const saldoPendiente = useMemo(() => prestamosReales.reduce((acc, p) => acc + Number(p.saldoReal || 0), 0), [prestamosReales]);
 const totalVencido = useMemo(
 () => cuotas.filter((c) => c.fecha < todayISO() && Number(c.restante || 0) > 0).reduce((acc, c) => acc + Number(c.restante || 0), 0),
 [cuotas]
 );
 const moraTotal = useMemo(
 () => cuotas.reduce((acc, c) => acc + calcularMora(c.fecha, Number(c.restante || 0), Number(business?.interes_mora_diario || 0.01)), 0),
 [cuotas, business?.interes_mora_diario]
 );
 const cobrosHoy = useMemo(() => cuotas.filter((c) => c.fecha === todayISO() && Number(c.restante || 0) > 0).length, [cuotas]);
 const clientesVip = clientes.filter((c) => getNivelByScore(Number(c.score || 0)) === "VIP").length;
 const clientesBuenos = clientes.filter((c) => getNivelByScore(Number(c.score || 0)) === "BUENO").length;
 const clientesRegulares = clientes.filter((c) => getNivelByScore(Number(c.score || 0)) === "REGULAR").length;
 const clientesMorosos = morosos.length;

 if (!usuarioActual) {
 return (
 <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
 <div style={{ ...cardStyle(), width: "100%", maxWidth: 430, display: "grid", gap: 16 }}>
 <SectionTitle title="CREDI YA" subtitle="Control profesional de préstamos y cobros" />

 <input style={inputStyle()} placeholder="Usuario" value={usuarioLogin} onChange={(e) => setUsuarioLogin(e.target.value)} />
 <input style={inputStyle()} placeholder="Contraseña" type="password" value={passwordLogin} onChange={(e) => setPasswordLogin(e.target.value)} />
 <button style={buttonStyle(true)} onClick={login}>Entrar</button>
 <button style={buttonStyle()} onClick={crearUsuarioRapido}>Crear usuario</button>
 <p style={{ margin: 0, color: MUTED }}>Usuarios creados: {usuarios.length}</p>
 </div>
 </div>
 );
 }

 return (
 <div style={{ minHeight: "100vh", background: BG, padding: 16 }}>
 <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
 <div style={{ display: "grid", gap: 6 }}>
 <h1 style={{ margin: 0, fontSize: 34, color: TEXT }}>{configNegocio || business?.negocio || "CREDI YA"}</h1>
 <p style={{ margin: 0, color: MUTED }}>Usuario: {usuarioActual.nombre || usuarioActual.usuario}</p>
 </div>

 <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 <NavBtn to="dashboard" label="Dashboard" screen={screen} setScreen={setScreen} />
 <NavBtn to="clientes" label="Clientes" screen={screen} setScreen={setScreen} />
 <NavBtn to="prestamos" label="Préstamos" screen={screen} setScreen={setScreen} />
 <NavBtn to="cobros" label="Cobros" screen={screen} setScreen={setScreen} />
 <NavBtn to="pagos" label="Pagos" screen={screen} setScreen={setScreen} />
 <NavBtn to="morosos" label="Morosos" screen={screen} setScreen={setScreen} />
 <NavBtn to="configuracion" label="Config" screen={screen} setScreen={setScreen} />
 <button style={buttonStyle()} onClick={cerrarSesion}>Salir</button>
 </div>
 </div>
 </div>

 {screen === "dashboard" && (
 <>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
 <MetricCard title="Total prestado" value={formatMoney(totalPrestado)} />
 <MetricCard title="Total cobrado" value={formatMoney(totalCobrado)} />
 <MetricCard title="Saldo pendiente" value={formatMoney(saldoPendiente)} />
 <MetricCard title="Deuda vencida" value={formatMoney(totalVencido)} />
 <MetricCard title="Mora acumulada" value={formatMoney(moraTotal)} danger />
 <MetricCard title="Cobros hoy" value={cobrosHoy} />
 <MetricCard title="Clientes VIP" value={clientesVip} />
 <MetricCard title="Clientes buenos" value={clientesBuenos} />
 <MetricCard title="Clientes regulares" value={clientesRegulares} />
 <MetricCard title="Morosos" value={clientesMorosos} />
 </div>
 </>
 )}

 {screen === "clientes" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <SectionTitle title="Clientes" subtitle="Búsqueda, edición y ficha completa" />

 <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
 <button style={buttonStyle(true)} onClick={() => { setMostrarFormCliente((v) => !v); if (!mostrarFormCliente) limpiarFormularioCliente(); }}>
 {mostrarFormCliente ? "Cerrar formulario" : editingClienteId ? "Editar cliente" : "Nuevo cliente"}
 </button>
 </div>

 <input style={inputStyle()} placeholder="Buscar por nombre, teléfono, documento o ruta" value={busquedaClientes} onChange={(e) => setBusquedaClientes(e.target.value)} />

 {mostrarFormCliente && (
 <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
 <SectionTitle title={editingClienteId ? "Editar cliente" : "Nuevo cliente"} />
 <input style={inputStyle()} placeholder="Nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
 <input style={inputStyle()} placeholder="Teléfono" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
 <input style={inputStyle()} placeholder="Documento" value={clienteDocumento} onChange={(e) => setClienteDocumento(e.target.value)} />
 <input style={inputStyle()} placeholder="Dirección" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} />
 <input style={inputStyle()} placeholder="Trabajo" value={clienteTrabajo} onChange={(e) => setClienteTrabajo(e.target.value)} />
 <input style={inputStyle()} placeholder="Referencia" value={clienteReferencia} onChange={(e) => setClienteReferencia(e.target.value)} />
 <input style={inputStyle()} placeholder="Notas" value={clienteNotas} onChange={(e) => setClienteNotas(e.target.value)} />
 <input style={inputStyle()} placeholder="Ruta" value={clienteRuta} onChange={(e) => setClienteRuta(e.target.value)} />
 <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 <button style={buttonStyle(true)} onClick={guardarCliente}>Guardar</button>
 <button style={buttonStyle()} onClick={() => { limpiarFormularioCliente(); setMostrarFormCliente(false); }}>Cancelar</button>
 </div>
 </div>
 )}

 <div style={{ display: "grid", gap: 10 }}>
 {clientesFiltrados.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay clientes.</p>
 ) : (
 clientesFiltrados.map((c) => (
 <div key={c.id} style={{ ...cardStyle(), display: "grid", gap: 8 }}>
 <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
 <div style={{ display: "grid", gap: 6 }}>
 <strong>{c.nombre}</strong>
 <span style={{ color: MUTED }}>{c.telefono || "-"}</span>
 <span style={badgeStyle(badgeColor(getNivelByScore(Number(c.score || 0))))}>{getNivelByScore(Number(c.score || 0))}</span>
 </div>
 <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 <button style={buttonStyle()} onClick={() => { setSelectedClienteId(c.id); setScreen("clienteDetalle"); }}>Ficha</button>
 <button style={buttonStyle()} onClick={() => editarCliente(c)}>Editar</button>
 <button style={{ ...buttonStyle(), color: DANGER, border: `1px solid ${DANGER}` }} onClick={() => void eliminarCliente(c.id)}>Borrar</button>
 </div>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 {screen === "clienteDetalle" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
 <SectionTitle title="Ficha del cliente" subtitle="Historial y datos completos" />
 <div style={{ display: "flex", gap: 8 }}>
 <button style={buttonStyle()} onClick={() => selectedCliente && editarCliente(selectedCliente)}>Editar</button>
 <button style={buttonStyle()} onClick={() => setScreen("clientes")}>Volver</button>
 </div>
 </div>

 {selectedCliente ? (
 <>
 <div style={{ ...cardStyle(), display: "grid", gap: 8 }}>
 <p style={{ margin: 0 }}><strong>Nombre:</strong> {selectedCliente.nombre}</p>
 <p style={{ margin: 0 }}><strong>Teléfono:</strong> {selectedCliente.telefono || "-"}</p>
 <p style={{ margin: 0 }}><strong>Documento:</strong> {selectedCliente.documento || "-"}</p>
 <p style={{ margin: 0 }}><strong>Ruta:</strong> {selectedCliente.ruta || "-"}</p>
 <p style={{ margin: 0 }}><strong>Dirección:</strong> {selectedCliente.direccion || "-"}</p>
 <p style={{ margin: 0 }}><strong>Trabajo:</strong> {selectedCliente.trabajo || "-"}</p>
 <p style={{ margin: 0 }}><strong>Referencia:</strong> {selectedCliente.referencia || "-"}</p>
 <p style={{ margin: 0 }}><strong>Notas:</strong> {selectedCliente.notas || "-"}</p>
 <p style={{ margin: 0 }}><strong>Score:</strong> {Number(selectedCliente.score || 0)}</p>
 <p style={{ margin: 0 }}><strong>Nivel:</strong> {getNivelByScore(Number(selectedCliente.score || 0))}</p>
 </div>

 <div style={{ ...cardStyle(), display: "grid", gap: 10 }}>
 <SectionTitle title="Préstamos" />
 {prestamosCliente.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay préstamos.</p>
 ) : (
 prestamosCliente.map((p) => (
 <div key={p.id} style={{ ...cardStyle(), display: "grid", gap: 6 }}>
 <span>Monto: {formatMoney(Number(p.monto || 0))}</span>
 <span>Cuota: {formatMoney(Number(p.cuota || 0))}</span>
 <span>Saldo real: {formatMoney(Number(p.saldoReal || 0))}</span>
 <span style={badgeStyle(badgeColor(p.estadoReal))}>{p.estadoReal}</span>
 </div>
 ))
 )}
 </div>

 <div style={{ ...cardStyle(), display: "grid", gap: 10 }}>
 <SectionTitle title="Pagos" />
 {pagosCliente.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay pagos.</p>
 ) : (
 pagosCliente.map((p) => (
 <div key={p.id} style={{ ...cardStyle(), display: "grid", gap: 6 }}>
 <strong>{formatMoney(Number(p.monto || 0))}</strong>
 <span style={{ color: MUTED }}>{p.metodo || "EFECTIVO"} · {p.fecha}</span>
 <span style={{ color: MUTED }}>{p.nota || "-"}</span>
 </div>
 ))
 )}
 </div>
 </>
 ) : (
 <p style={{ margin: 0, color: MUTED }}>No hay cliente seleccionado.</p>
 )}
 </div>
 )}

 {screen === "prestamos" && (
  <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
    <SectionTitle
      title="Préstamos"
      subtitle="Interés por defecto 15% y frecuencia diaria/semanal/mensual"
    />

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button
        style={buttonStyle(true)}
        onClick={() => setMostrarFormPrestamo((v) => !v)}
      >
        {mostrarFormPrestamo ? "Cerrar formulario" : "Nuevo préstamo"}
      </button>
    </div>

    <input
      style={inputStyle()}
      placeholder="Buscar por cliente o estado"
      value={busquedaPrestamos}
      onChange={(e) => setBusquedaPrestamos(e.target.value)}
    />

    {mostrarFormPrestamo && (
      <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
        <select
          style={inputStyle()}
          value={prestamoClienteId}
          onChange={(e) => setPrestamoClienteId(e.target.value)}
        >
          <option value="">Selecciona cliente</option>
          {clientes.map((c) => (
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
          placeholder="Interés (por defecto 0.15)"
          value={prestamoInteres}
          onChange={(e) => setPrestamoInteres(e.target.value)}
        />

        <select
          style={inputStyle()}
          value={prestamoFrecuencia}
          onChange={(e) => {
            const nuevaFrecuencia = e.target.value as
              | "DIARIO"
              | "SEMANAL"
              | "MENSUAL";

            setPrestamoFrecuencia(nuevaFrecuencia);

            if (nuevaFrecuencia === "DIARIO") {
              setPrestamoPlanDiario("20");
              setPrestamoCuotas("20");
            } if (nuevaFrecuencia === "SEMANAL") {
  setPrestamoPlanSemanal("4");
  setPrestamoCuotas("4");
}  else if (nuevaFrecuencia === "MENSUAL") {
  setPrestamoPlanMensual("1");
  setPrestamoCuotas("1");
}
          }}
        >
          <option value="DIARIO">DIARIO</option>
          <option value="SEMANAL">SEMANAL</option>
          <option value="MENSUAL">MENSUAL</option>
        </select>

        {prestamoFrecuencia === "DIARIO" && (
          <select
            style={inputStyle()}
            value={prestamoPlanDiario}
            onChange={(e) => {
              const dias = e.target.value;
              setPrestamoPlanDiario(dias);
              setPrestamoCuotas(dias);
            }}
          >
            <option value="20">20 días</option>
            <option value="24">24 días</option>
            <option value="30">30 días</option>
          </select>
        )}
{prestamoFrecuencia === "SEMANAL" && (
  <select
    style={inputStyle()}
    value={prestamoPlanSemanal}
    onChange={(e) => {
      const semanas = e.target.value;
      setPrestamoPlanSemanal(semanas);
      setPrestamoCuotas(semanas);
    }}
  >
    <option value="4">4 semanas</option>
    <option value="6">6 semanas</option>
    <option value="8">8 semanas</option>
  </select>
)}
{prestamoFrecuencia === "MENSUAL" && (
  <select
    style={inputStyle()}
    value={prestamoPlanMensual}
    onChange={(e) => {
      const meses = e.target.value;
      setPrestamoPlanMensual(meses);
      setPrestamoCuotas(meses);
    }}
  >
    <option value="1">1 mes</option>
    <option value="2">2 meses</option>
    <option value="3">3 meses</option>
  </select>
)}
        <input
          style={inputStyle()}
          placeholder="Número de cuotas"
          value={prestamoCuotas}
          onChange={(e) => setPrestamoCuotas(e.target.value)}
        />

        <input
          style={inputStyle()}
          type="date"
          value={prestamoFechaInicio}
          onChange={(e) => setPrestamoFechaInicio(e.target.value)}
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
        prestamosFiltrados.map((p) => (
          <div key={p.id} style={{ ...cardStyle(), display: "grid", gap: 8 }}>
           <strong
  style={{
    color: "#111",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.3,
  }}
>
  {p.cliente?.nombre || "Cliente"}
</strong>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 8,
                color: MUTED,
              }}
            >
              <span>Monto: {formatMoney(Number(p.monto || 0))}</span>
              <span>Total: {formatMoney(Number(p.total || 0))}</span>
              <span>Cuota: {formatMoney(Number(p.cuota || 0))}</span>
              <span>Saldo real: {formatMoney(Number(p.saldoReal || 0))}</span>
              <span>Frecuencia: {p.frecuencia || "-"}</span>
              <span>Inicio: {p.fecha_inicio || "-"}</span>
            </div>

            <span style={badgeStyle(badgeColor(p.estadoReal))}>
              {p.estadoReal}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
)}

 {screen === "cobros" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <SectionTitle title="Cobros" subtitle="Filtro cobrar hoy y registro de abonos" />
 <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 <button style={buttonStyle(soloCobrosHoy)} onClick={() => setSoloCobrosHoy(true)}>Solo hoy</button>
 <button style={buttonStyle(!soloCobrosHoy)} onClick={() => setSoloCobrosHoy(false)}>Todos</button>
 </div>
 <input style={inputStyle()} placeholder="Buscar por cliente o fecha" value={busquedaCobros} onChange={(e) => setBusquedaCobros(e.target.value)} />

 {mostrarFormPago && selectedCobroCuotaId && (
 <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
 <SectionTitle title="Registrar pago" />
 <input style={inputStyle()} placeholder="Monto" value={pagoMonto} onChange={(e) => setPagoMonto(e.target.value)} />
 <input style={inputStyle()} type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
 <input style={inputStyle()} placeholder="Método" value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)} />
 <input style={inputStyle()} placeholder="Nota" value={pagoNota} onChange={(e) => setPagoNota(e.target.value)} />
 <div style={{ display: "flex", gap: 8 }}>
 <button style={buttonStyle(true)} onClick={() => void registrarPago()}>Guardar pago</button>
 <button style={buttonStyle()} onClick={() => { setMostrarFormPago(false); setSelectedCobroCuotaId(null); }}>Cancelar</button>
 </div>
 </div>
 )}

 <div style={{ display: "grid", gap: 10 }}>
 {cobrosFiltrados.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay cobros pendientes.</p>
 ) : (
 cobrosFiltrados.map(({ cuota, prestamo, cliente }) => {
 const mora = calcularMora(cuota.fecha, Number(cuota.restante || 0), Number(business?.interes_mora_diario || 0.01));
 return (
 <div key={cuota.id} style={{ ...cardStyle(), display: "grid", gap: 8 }}>
 <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
 <div style={{ display: "grid", gap: 6 }}>
 <strong>{cliente?.nombre || "Cliente"}</strong>
 <span style={{ color: MUTED }}>Fecha: {cuota.fecha}</span>
 <span style={{ color: MUTED }}>Cuota #{Number(cuota.numero || 0)}</span>
 <span style={{ color: MUTED }}>Restante: {formatMoney(Number(cuota.restante || 0))}</span>
 <span style={{ color: DANGER }}>Mora: {formatMoney(mora)}</span>
 </div>
 <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
 <span style={badgeStyle(badgeColor(cuota.fecha < todayISO() ? "VENCIDA" : cuota.fecha === todayISO() ? "COBRAR HOY" : cuota.estado || "PENDIENTE"))}>
 {cuota.fecha < todayISO() ? "VENCIDA" : cuota.fecha === todayISO() ? "COBRAR HOY" : cuota.estado || "PENDIENTE"}
 </span>
 <button
 style={buttonStyle(true)}
 onClick={() => {
 setSelectedCobroCuotaId(cuota.id);
 setPagoMonto(String(Number(cuota.restante || 0)));
 setPagoFecha(todayISO());
 setPagoMetodo("EFECTIVO");
 setPagoNota("");
 setMostrarFormPago(true);
 }}
 >
 Cobrar / abonar
 </button>
 </div>
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>
 )}

 {screen === "pagos" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <SectionTitle title="Pagos" subtitle="Historial completo" />
 <input style={inputStyle()} placeholder="Buscar por cliente, fecha o método" value={busquedaPagos} onChange={(e) => setBusquedaPagos(e.target.value)} />
 <div style={{ display: "grid", gap: 10 }}>
 {pagosFiltrados.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay pagos.</p>
 ) : (
 pagosFiltrados.map((p) => {
 const prestamo = prestamosReales.find((x) => x.id === p.prestamo_id);
 const cliente = prestamo?.cliente;
 return (
 <div key={p.id} style={{ ...cardStyle(), display: "grid", gap: 6 }}>
 <strong>{cliente?.nombre || "Cliente"}</strong>
 <span style={{ color: MUTED }}>Fecha: {p.fecha} · Monto: {formatMoney(Number(p.monto || 0))}</span>
 <span style={{ color: MUTED }}>Método: {p.metodo || "EFECTIVO"} · Puntual: {p.puntual ? "Sí" : "No"}</span>
 <span style={{ color: MUTED }}>Nota: {p.nota || "-"}</span>
 </div>
 );
 })
 )}
 </div>
 </div>
 )}

 {screen === "morosos" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
 <SectionTitle title="Morosos" subtitle="Clientes con cuotas vencidas y mora acumulada" />
 <input style={inputStyle()} placeholder="Buscar morosos" value={busquedaMorosos} onChange={(e) => setBusquedaMorosos(e.target.value)} />
 <div style={{ display: "grid", gap: 10 }}>
 {morosos.length === 0 ? (
 <p style={{ margin: 0, color: MUTED }}>No hay morosos.</p>
 ) : (
 morosos.map((item) => (
 <div key={item.cliente.id} style={{ ...cardStyle(), display: "grid", gap: 6 }}>
 <strong>{item.cliente.nombre}</strong>
 <span style={{ color: MUTED }}>Teléfono: {item.cliente.telefono || "-"}</span>
 <span style={{ color: MUTED }}>Total vencido: {formatMoney(item.totalVencido)}</span>
 <span style={{ color: DANGER }}>Mora acumulada: {formatMoney(item.totalMora)}</span>
 <span style={{ color: MUTED }}>Días de atraso: {item.diasMax}</span>
 <span style={{ color: MUTED }}>Cuotas vencidas: {item.cuotasVencidas}</span>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 {screen === "configuracion" && (
 <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
 <SectionTitle title="Configuración" subtitle="Nombre del negocio, logo e interés de mora por usuario" />
 <input style={inputStyle()} placeholder="Nombre del negocio" value={configNegocio} onChange={(e) => setConfigNegocio(e.target.value)} />
 <input style={inputStyle()} placeholder="Interés mora diario. Ej: 0.01" value={configInteresMora} onChange={(e) => setConfigInteresMora(e.target.value)} />
 <select
  style={inputStyle()}
  value={configMoneda}
  onChange={(e) => setConfigMoneda(e.target.value)}
>
  <option value="EUR">Euro (€)</option>
  <option value="USD">Dólar ($)</option>
  <option value="COP">Peso colombiano ($)</option>
  <option value="MXN">Peso mexicano ($)</option>
  <option value="DOP">Peso dominicano (RD$)</option>
</select>
 <input type="file" accept="image/*" onChange={(e) => void onLogoChange(e.target.files?.[0] || null)} />
 {configLogoBase64 ? <img src={configLogoBase64} alt="logo" style={{ width: 120, height: 60, objectFit: "contain", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff" }} /> : null}
 <button style={buttonStyle(true)} onClick={() => void guardarBusiness()}>Guardar configuración</button>
 <p style={{ margin: 0, color: MUTED }}>Negocio actual: {business?.negocio || configNegocio || "CREDI YA"}</p>
 </div>
 )}

 {loading ? <p style={{ color: MUTED, margin: 0 }}>Cargando...</p> : null}
 </div>
 </div>
 );
}