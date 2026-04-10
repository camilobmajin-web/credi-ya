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

type Cliente = {
id: string;
nombre: string;
telefono: string;
documento?: string;
direccion?: string;
trabajo?: string;
referencia?: string;
notas?: string;
ruta?: string;
score: number;
nivel: "VIP" | "BUENO" | "REGULAR" | "MOROSO";
};

type Prestamo = {
id: string;
client_id: string;
monto: number;
interes: number;
frecuencia: "DIARIO" | "SEMANAL" | "MENSUAL";
cuotas: number;
total: number;
cuota: number;
saldo: number;
estado: "AL DÍA" | "COBRAR HOY" | "VENCIDO" | "PAGADO";
fecha_inicio: string;
};

type Cuota = {
id: string;
prestamo_id: string;
numero: number;
fecha: string;
monto: number;
pagado: number;
restante: number;
estado: "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA";
};

type Pago = {
id: string;
prestamo_id: string;
fecha: string;
monto: number;
metodo: string;
puntual: boolean;
nota?: string;
};

type UsuarioApp = {
id: string;
nombre: string;
usuario: string;
password: string;
};

type BusinessSettings = {
negocio: string;
logoBase64: string;
};

const BG = "#f3f4f6";
const CARD_BG = "#ffffff";
const BORDER = "#cbd5e1";
const TEXT = "#0f172a";
const MUTED = "#374151";
const PRIMARY = "#0f172a";
const SUCCESS = "#15803d";
const WARNING = "#d97706";
const DANGER = "#dc2626";
const INFO = "#2563eb";

function todayISO() {
return new Date().toISOString().slice(0, 10);
}

function formatEUR(n: number) {
return new Intl.NumberFormat("es-ES", {
style: "currency",
currency: "EUR",
}).format(Number(n || 0));
}

function getNivel(score: number): Cliente["nivel"] {
if (score >= 20) return "VIP";
if (score >= 10) return "BUENO";
if (score >= 0) return "REGULAR";
return "MOROSO";
}

function badgeColor(value: string) {
if (value === "VIP" || value === "AL DÍA" || value === "PAGADA" || value === "DEUDA PAGADA") return SUCCESS;
if (value === "BUENO" || value === "COBRAR HOY" || value === "PARCIAL") return WARNING;
if (value === "REGULAR") return "#64748b";
if (value === "MOROSO" || value === "VENCIDO" || value === "VENCIDA") return DANGER;
if (value === "PAGADO") return INFO;
return TEXT;
}

function cardStyle(): CSSProperties {
return {
background: CARD_BG,
border: `1px solid ${BORDER}`,
borderRadius: 20,
padding: 16,
boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
color: TEXT,
};
}

function inputStyle(): CSSProperties {
return {
width: "100%",
minHeight: 48,
borderRadius: 14,
border: `1px solid ${BORDER}`,
padding: "12px 14px",
fontSize: 16,
color: TEXT,
background: "#fff",
outline: "none",
};
}

function buttonStyle(primary = false): CSSProperties {
return {
minHeight: 48,
borderRadius: 16,
border: primary ? "none" : `1px solid ${BORDER}`,
padding: "12px 16px",
fontSize: 16,
fontWeight: 700,
cursor: "pointer",
background: primary ? PRIMARY : "#fff",
color: primary ? "#fff" : TEXT,
};
}

function dangerButtonStyle(): CSSProperties {
return {
...buttonStyle(false),
border: "1px solid #fecaca",
color: DANGER,
background: "#fff",
};
}

function badgeStyle(color: string): CSSProperties {
return {
display: "inline-flex",
alignItems: "center",
width: "fit-content",
borderRadius: 999,
padding: "8px 12px",
border: `1px solid ${BORDER}`,
color,
background: "#f8fafc",
fontWeight: 700,
fontSize: 14,
};
}

function roundInstallment(value: number) {
const whole = Math.floor(value);
const decimal = value - whole;
if (decimal === 0) return value;
if (decimal <= 0.5) return whole + 0.5;
return whole + 1;
}

function addDays(dateString: string, days: number) {
const d = new Date(dateString + "T12:00:00");
d.setDate(d.getDate() + days);
return d.toISOString().slice(0, 10);
}

function addBusinessDays(dateString: string, businessDays: number) {
const d = new Date(dateString + "T12:00:00");
let added = 0;
while (added < businessDays) {
d.setDate(d.getDate() + 1);
const day = d.getDay();
if (day !== 0 && day !== 6) added += 1;
}
return d.toISOString().slice(0, 10);
}

function addMonths(dateString: string, months: number) {
const d = new Date(dateString + "T12:00:00");
d.setMonth(d.getMonth() + months);
return d.toISOString().slice(0, 10);
}

function daysLate(fromDate: string) {
const today = new Date(todayISO() + "T12:00:00").getTime();
const due = new Date(fromDate + "T12:00:00").getTime();
const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
return diff > 0 ? diff : 0;
}

function fileToBase64(file: File) {
return new Promise<string>((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(String(reader.result || ""));
reader.onerror = reject;
reader.readAsDataURL(file);
});
}

export default function App() {
const [screen, setScreen] = useState<Screen>("login");

const [clientes, setClientes] = useState<Cliente[]>([]);
const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
const [cuotas, setCuotas] = useState<Cuota[]>([]);
const [pagos, setPagos] = useState<Pago[]>([]);
const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);

const [usuarioLogin, setUsuarioLogin] = useState("");
const [passwordLogin, setPasswordLogin] = useState("");
const [usuarioActual, setUsuarioActual] = useState<UsuarioApp | null>(null);

const [business, setBusiness] = useState<BusinessSettings>({
negocio: "CREDI YA",
logoBase64: "",
});

const [loadingClientes, setLoadingClientes] = useState(false);
const [loadingPrestamos, setLoadingPrestamos] = useState(false);
const [loadingCuotas, setLoadingCuotas] = useState(false);
const [loadingPagos, setLoadingPagos] = useState(false);

const [busquedaClientes, setBusquedaClientes] = useState("");
const [busquedaPrestamos, setBusquedaPrestamos] = useState("");
const [busquedaCobros, setBusquedaCobros] = useState("");
const [busquedaPagos, setBusquedaPagos] = useState("");
const [busquedaMorosos, setBusquedaMorosos] = useState("");
const [soloCobrosHoy, setSoloCobrosHoy] = useState(false);

const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
const [editandoClienteId, setEditandoClienteId] = useState<string | null>(null);

const [clienteNombre, setClienteNombre] = useState("");
const [clienteTelefono, setClienteTelefono] = useState("");
const [clienteDocumento, setClienteDocumento] = useState("");
const [clienteDireccion, setClienteDireccion] = useState("");
const [clienteTrabajo, setClienteTrabajo] = useState("");
const [clienteReferencia, setClienteReferencia] = useState("");
const [clienteNotas, setClienteNotas] = useState("");
const [clienteRuta, setClienteRuta] = useState("");

const [mostrarFormPrestamo, setMostrarFormPrestamo] = useState(false);
const [prestamoClienteId, setPrestamoClienteId] = useState("");
const [prestamoMonto, setPrestamoMonto] = useState("");
const [prestamoInteres, setPrestamoInteres] = useState("0.15");
const [prestamoFrecuencia, setPrestamoFrecuencia] = useState<Prestamo["frecuencia"]>("DIARIO");
const [prestamoCuotas, setPrestamoCuotas] = useState("20");
const [prestamoFechaInicio, setPrestamoFechaInicio] = useState(todayISO());

const [cuotaSeleccionadaId, setCuotaSeleccionadaId] = useState<string | null>(null);
const [pagoMonto, setPagoMonto] = useState("");
const [pagoMetodo, setPagoMetodo] = useState("EFECTIVO");
const [pagoFecha, setPagoFecha] = useState(todayISO());
const [pagoNota, setPagoNota] = useState("");

const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);

useEffect(() => {
const raw = localStorage.getItem("crediya_business_settings");
if (raw) {
try {
const parsed = JSON.parse(raw) as BusinessSettings;
setBusiness({
negocio: parsed.negocio || "CREDI YA",
logoBase64: parsed.logoBase64 || "",
});
} catch {}
}
}, []);

useEffect(() => {
localStorage.setItem("crediya_business_settings", JSON.stringify(business));
}, [business]);

async function cargarUsuarios() {
const { data, error } = await supabase
.from("usuarios_app")
.select("*")
.order("created_at", { ascending: true });

if (!error) setUsuarios((data || []) as UsuarioApp[]);
}

async function cargarClientes() {
setLoadingClientes(true);
const { data, error } = await supabase
.from("clientes")
.select("*")
.order("created_at", { ascending: false });

if (error) {
alert("Error cargando clientes: " + error.message);
setLoadingClientes(false);
return;
}

const lista: Cliente[] = (data || []).map((c: any) => ({
id: c.id,
nombre: c.nombre || "",
telefono: c.telefono || "",
documento: c.documento || "",
direccion: c.direccion || "",
trabajo: c.trabajo || "",
referencia: c.referencia || "",
notas: c.notas || "",
ruta: c.ruta || "",
score: Number(c.score || 0),
nivel: getNivel(Number(c.score || 0)),
}));

setClientes(lista);
setLoadingClientes(false);
}

async function cargarPrestamos() {
setLoadingPrestamos(true);
const { data, error } = await supabase
.from("prestamos")
.select("*")
.order("created_at", { ascending: false });

if (error) {
alert("Error cargando préstamos: " + error.message);
setLoadingPrestamos(false);
return;
}

const lista: Prestamo[] = (data || []).map((p: any) => ({
id: p.id,
client_id: p.client_id,
monto: Number(p.monto || 0),
interes: Number(p.interes || 0),
frecuencia: p.frecuencia || "DIARIO",
cuotas: Number(p.cuotas || 0),
total: Number(p.total || 0),
cuota: Number(p.cuota || 0),
saldo: Number(p.saldo || 0),
estado: p.estado || "AL DÍA",
fecha_inicio: p.fecha_inicio || todayISO(),
}));

setPrestamos(lista);
setLoadingPrestamos(false);
}

async function cargarCuotas() {
setLoadingCuotas(true);
const { data, error } = await supabase
.from("cuotas")
.select("*")
.order("fecha", { ascending: true });

if (error) {
alert("Error cargando cuotas: " + error.message);
setLoadingCuotas(false);
return;
}

const hoy = todayISO();

const lista: Cuota[] = (data || []).map((c: any) => {
let estado = (c.estado || "PENDIENTE") as Cuota["estado"];
if (estado !== "PAGADA" && Number(c.restante || 0) > 0 && c.fecha < hoy) {
estado = "VENCIDA";
}

return {
id: c.id,
prestamo_id: c.prestamo_id,
numero: Number(c.numero || 0),
fecha: c.fecha || hoy,
monto: Number(c.monto || 0),
pagado: Number(c.pagado || 0),
restante: Number(c.restante || 0),
estado,
};
});

setCuotas(lista);
setLoadingCuotas(false);
}

async function cargarPagos() {
setLoadingPagos(true);
const { data, error } = await supabase
.from("pagos")
.select("*")
.order("created_at", { ascending: false });

if (error) {
alert("Error cargando pagos: " + error.message);
setLoadingPagos(false);
return;
}

const lista: Pago[] = (data || []).map((p: any) => ({
id: p.id,
prestamo_id: p.prestamo_id,
fecha: p.fecha || "",
monto: Number(p.monto || 0),
metodo: p.metodo || "",
puntual: !!p.puntual,
nota: p.nota || "",
}));

setPagos(lista);
setLoadingPagos(false);
}

async function recargarTodo() {
await Promise.all([
cargarUsuarios(),
cargarClientes(),
cargarPrestamos(),
cargarCuotas(),
cargarPagos(),
]);
}

useEffect(() => {
recargarTodo();
}, []);

function limpiarFormularioCliente() {
setEditandoClienteId(null);
setClienteNombre("");
setClienteTelefono("");
setClienteDocumento("");
setClienteDireccion("");
setClienteTrabajo("");
setClienteReferencia("");
setClienteNotas("");
setClienteRuta("");
}

function limpiarFormularioPrestamo() {
setPrestamoClienteId("");
setPrestamoMonto("");
setPrestamoInteres("0.15");
setPrestamoFrecuencia("DIARIO");
setPrestamoCuotas("20");
setPrestamoFechaInicio(todayISO());
}

async function login() {
const user = usuarios.find(
(u) => u.usuario === usuarioLogin && u.password === passwordLogin
);

if (!user) {
alert("Usuario o contraseña incorrectos");
return;
}

setUsuarioActual(user);
setScreen("dashboard");
}

async function crearUsuarioRapido() {
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
},
]);

if (error) {
alert("Error creando usuario: " + error.message);
return;
}

alert("Usuario creado");
await cargarUsuarios();
}

async function guardarCliente() {
if (!clienteNombre.trim()) {
alert("El nombre es obligatorio");
return;
}

const payload = {
nombre: clienteNombre,
telefono: clienteTelefono,
documento: clienteDocumento,
direccion: clienteDireccion,
trabajo: clienteTrabajo,
referencia: clienteReferencia,
notas: clienteNotas,
ruta: clienteRuta,
};

if (editandoClienteId) {
const { error } = await supabase
.from("clientes")
.update(payload)
.eq("id", editandoClienteId);

if (error) {
alert("Error actualizando cliente: " + error.message);
return;
}

alert("Cliente actualizado");
} else {
const { error } = await supabase.from("clientes").insert([
{
...payload,
score: 0,
},
]);

if (error) {
alert("Error creando cliente: " + error.message);
return;
}

alert("Cliente creado");
}

limpiarFormularioCliente();
setMostrarFormCliente(false);
await cargarClientes();
}

function empezarEditarCliente(cliente: Cliente) {
setEditandoClienteId(cliente.id);
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

async function borrarCliente(cliente: Cliente) {
const ok = confirm(`¿Seguro que quieres borrar a ${cliente.nombre}?`);
if (!ok) return;

const { error } = await supabase.from("clientes").delete().eq("id", cliente.id);

if (error) {
alert("Error borrando cliente: " + error.message);
return;
}

if (clienteSeleccionadoId === cliente.id) {
setClienteSeleccionadoId(null);
setScreen("clientes");
}

alert("Cliente borrado");
await recargarTodo();
}

async function guardarPrestamo() {
if (!prestamoClienteId) {
alert("Selecciona cliente");
return;
}

const monto = Number(prestamoMonto || 0);
const interes = Number(prestamoInteres || 0);
const cuotasCount = Number(prestamoCuotas || 0);
const fechaInicio = prestamoFechaInicio || todayISO();

if (!monto || !interes || !cuotasCount) {
alert("Completa monto, interés y cuotas");
return;
}

let total = 0;
if (prestamoFrecuencia === "MENSUAL") total = monto * (1 + interes * cuotasCount);
else total = monto * (1 + interes);

const cuotaBase = roundInstallment(total / cuotasCount);
const saldo = cuotaBase * cuotasCount;

const { data: prestamoCreado, error } = await supabase
.from("prestamos")
.insert([
{
client_id: prestamoClienteId,
monto,
interes,
frecuencia: prestamoFrecuencia,
cuotas: cuotasCount,
total,
cuota: cuotaBase,
saldo,
estado: prestamoFrecuencia === "DIARIO" ? "COBRAR HOY" : "AL DÍA",
fecha_inicio: fechaInicio,
},
])
.select()
.single();

if (error || !prestamoCreado) {
alert("Error creando préstamo: " + (error?.message || ""));
return;
}

const cuotasInsert = Array.from({ length: cuotasCount }).map((_, i) => {
let fecha = fechaInicio;
if (prestamoFrecuencia === "DIARIO") fecha = addBusinessDays(fechaInicio, i);
if (prestamoFrecuencia === "SEMANAL") fecha = addDays(fechaInicio, (i + 1) * 7);
if (prestamoFrecuencia === "MENSUAL") fecha = addMonths(fechaInicio, i + 1);

return {
prestamo_id: prestamoCreado.id,
numero: i + 1,
fecha,
monto: cuotaBase,
pagado: 0,
restante: cuotaBase,
estado: "PENDIENTE",
};
});

const { error: errorCuotas } = await supabase.from("cuotas").insert(cuotasInsert);

if (errorCuotas) {
alert("Error creando cuotas: " + errorCuotas.message);
return;
}

alert("Préstamo creado");
limpiarFormularioPrestamo();
setMostrarFormPrestamo(false);
await recargarTodo();
}

function generarReciboPDF(params: {
clienteNombre: string;
clienteDocumento?: string;
clienteTelefono?: string;
fecha: string;
monto: number;
metodo: string;
nota?: string;
saldoRestante: number;
numeroCuota?: number;
cuotasPendientes?: number;
estadoDeuda?: string;
negocio?: string;
logo?: string;
}) {
const doc = new jsPDF();
const negocio = params.negocio || "CREDI YA";
const logo = params.logo;

try {
if (logo) {
const format = logo.includes("image/png") ? "PNG" : "JPEG";
doc.addImage(logo, format, 20, 10, 40, 20);
} else {
doc.setFontSize(18);
doc.text(negocio, 20, 20);
}
} catch {
doc.setFontSize(18);
doc.text(negocio, 20, 20);
}

doc.setFontSize(12);
doc.text("RECIBO DE PAGO", 20, 30);

let y = 45;

const line = (label: string, value: string) => {
doc.text(`${label}: ${value}`, 20, y);
y += 10;
};

line("Cliente", params.clienteNombre || "Cliente");
line("Documento", params.clienteDocumento || "No registrado");
line("Telefono", params.clienteTelefono || "-");
line("Fecha", params.fecha || "-");
line("Monto pagado", formatEUR(params.monto || 0));
line("Metodo", params.metodo || "-");
line("Saldo restante", formatEUR(params.saldoRestante || 0));
line("Cuota", params.numeroCuota ? String(params.numeroCuota) : "-");
line("Cuotas pendientes", String(params.cuotasPendientes || 0));
line("Estado", params.estadoDeuda || "DEUDA ACTIVA");
line("Nota", params.nota || "-");

const nombreArchivo = (params.clienteNombre || "cliente")
.replace(/\s+/g, "-")
.toLowerCase();

doc.save(`recibo-${nombreArchivo}.pdf`);
}

async function registrarPagoVisual() {
if (!cuotaSeleccionadaId) {
alert("Selecciona una cuota");
return;
}

const cuotaBase = cuotas.find((c) => c.id === cuotaSeleccionadaId);
if (!cuotaBase) {
alert("Cuota no válida");
return;
}

const prestamo = prestamos.find((p) => p.id === cuotaBase.prestamo_id);
if (!prestamo) {
alert("No se encontró el préstamo");
return;
}

const cliente = clientes.find((c) => c.id === prestamo.client_id);

const montoPagoNum = Number(pagoMonto || 0);
if (isNaN(montoPagoNum) || montoPagoNum <= 0) {
alert("Monto inválido");
return;
}

const fecha = pagoFecha || todayISO();
const puntual = fecha <= cuotaBase.fecha;

const cuotasPendientesOrdenadas = cuotas
.filter((c) => c.prestamo_id === prestamo.id && Number(c.restante || 0) > 0)
.sort((a, b) => a.numero - b.numero);

let restantePago = montoPagoNum;

for (const cuota of cuotasPendientesOrdenadas) {
if (restantePago <= 0) break;

const pagadoActual = Number(cuota.pagado || 0);
const restanteActual = Number(cuota.restante || 0);
if (restanteActual <= 0) continue;

const abono = Math.min(restantePago, restanteActual);
const nuevoPagado = pagadoActual + abono;
const nuevoRestante = Math.max(0, Number(cuota.monto) - nuevoPagado);

let nuevoEstado: "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA" = "PENDIENTE";
if (nuevoRestante === 0) nuevoEstado = "PAGADA";
else if (nuevoPagado > 0) nuevoEstado = "PARCIAL";
else if (cuota.fecha < todayISO()) nuevoEstado = "VENCIDA";

const { error: errorCuota } = await supabase
.from("cuotas")
.update({
pagado: nuevoPagado,
restante: nuevoRestante,
estado: nuevoEstado,
})
.eq("id", cuota.id);

if (errorCuota) {
alert("Error actualizando cuota: " + errorCuota.message);
return;
}

restantePago -= abono;
}

const { error: errorPago } = await supabase.from("pagos").insert([
{
prestamo_id: prestamo.id,
fecha,
monto: montoPagoNum,
metodo: pagoMetodo,
puntual,
nota: pagoNota,
},
]);

if (errorPago) {
alert("Error guardando pago: " + errorPago.message);
return;
}

const cuotasActualizadasRaw = await supabase
.from("cuotas")
.select("*")
.eq("prestamo_id", prestamo.id)
.order("numero", { ascending: true });

if (cuotasActualizadasRaw.error) {
alert("Error recalculando préstamo: " + cuotasActualizadasRaw.error.message);
return;
}

const cuotasActualizadas = cuotasActualizadasRaw.data || [];

const nuevoSaldo = Math.max(
cuotasActualizadas.reduce((acc: number, c: any) => acc + Number(c.restante || 0), 0),
0
);

const cuotasPendientes = cuotasActualizadas.filter(
(c: any) => Number(c.restante || 0) > 0
).length;

const deudaPagada = nuevoSaldo <= 0 || cuotasPendientes === 0;
const estadoDeuda = deudaPagada ? "DEUDA PAGADA" : "DEUDA ACTIVA";

let nuevoEstadoPrestamo: "AL DÍA" | "COBRAR HOY" | "VENCIDO" | "PAGADO" = "AL DÍA";
const hoy = todayISO();

const tieneHoy = cuotasActualizadas.some(
(c: any) => c.fecha === hoy && Number(c.restante || 0) > 0
);

const tieneVencidas = cuotasActualizadas.some(
(c: any) => c.fecha < hoy && Number(c.restante || 0) > 0
);

if (deudaPagada) nuevoEstadoPrestamo = "PAGADO";
else if (tieneVencidas) nuevoEstadoPrestamo = "VENCIDO";
else if (tieneHoy) nuevoEstadoPrestamo = "COBRAR HOY";
else nuevoEstadoPrestamo = "AL DÍA";

const { error: errorPrestamo } = await supabase
.from("prestamos")
.update({
saldo: nuevoSaldo,
estado: nuevoEstadoPrestamo,
})
.eq("id", prestamo.id);

if (errorPrestamo) {
alert("Error actualizando préstamo: " + errorPrestamo.message);
return;
}

if (cliente) {
const nuevoScore = Number(cliente.score || 0) + (puntual ? 2 : -5);

const { error: errorCliente } = await supabase
.from("clientes")
.update({ score: nuevoScore })
.eq("id", cliente.id);

if (errorCliente) {
alert("Error actualizando cliente: " + errorCliente.message);
return;
}
}

generarReciboPDF({
clienteNombre: cliente?.nombre || "Cliente",
clienteDocumento: cliente?.documento || "No registrado",
clienteTelefono: cliente?.telefono || "-",
fecha,
monto: montoPagoNum,
metodo: pagoMetodo,
nota: pagoNota,
saldoRestante: deudaPagada ? 0 : nuevoSaldo,
numeroCuota: cuotaBase.numero,
cuotasPendientes: deudaPagada ? 0 : cuotasPendientes,
estadoDeuda,
negocio: business.negocio || "CREDI YA",
logo: business.logoBase64 || "",
});

alert(deudaPagada ? "Pago registrado. Deuda pagada." : "Pago registrado correctamente");

setCuotaSeleccionadaId(null);
setPagoMonto("");
setPagoMetodo("EFECTIVO");
setPagoFecha(todayISO());
setPagoNota("");

await recargarTodo();
}

const prestamosConEstadoReal = useMemo(() => {
const hoy = todayISO();

return prestamos.map((p) => {
const cuotasPrestamo = cuotas.filter((c) => c.prestamo_id === p.id);
const saldoReal = cuotasPrestamo.reduce((acc, c) => acc + Number(c.restante || 0), 0);
const tieneHoy = cuotasPrestamo.some((c) => c.fecha === hoy && Number(c.restante || 0) > 0);
const tieneVencidas = cuotasPrestamo.some((c) => c.fecha < hoy && Number(c.restante || 0) > 0);

let estado: Prestamo["estado"] = p.estado;
if (saldoReal <= 0) estado = "PAGADO";
else if (tieneVencidas) estado = "VENCIDO";
else if (tieneHoy) estado = "COBRAR HOY";
else estado = "AL DÍA";

return {
...p,
saldo: saldoReal,
estado,
};
});
}, [prestamos, cuotas]);

const clienteSeleccionado = clientes.find((c) => c.id === clienteSeleccionadoId) || null;

const clientesFiltrados = useMemo(() => {
const q = busquedaClientes.toLowerCase().trim();
return clientes.filter((c) => {
const txt = `${c.nombre} ${c.telefono} ${c.documento || ""} ${c.ruta || ""}`.toLowerCase();
return txt.includes(q);
});
}, [clientes, busquedaClientes]);

const prestamosFiltrados = useMemo(() => {
const q = busquedaPrestamos.toLowerCase().trim();
return prestamosConEstadoReal.filter((p) => {
const cliente = clientes.find((c) => c.id === p.client_id);
const txt = `${cliente?.nombre || ""} ${cliente?.telefono || ""} ${cliente?.ruta || ""}`.toLowerCase();
return txt.includes(q);
});
}, [prestamosConEstadoReal, clientes, busquedaPrestamos]);

const cobrosFiltrados = useMemo(() => {
const hoy = todayISO();
const q = busquedaCobros.toLowerCase().trim();

return cuotas
.filter((c) => Number(c.restante || 0) > 0)
.map((cuota) => {
const prestamo = prestamosConEstadoReal.find((p) => p.id === cuota.prestamo_id);
const cliente = clientes.find((c) => c.id === prestamo?.client_id);
return { cuota, prestamo, cliente };
})
.filter(({ cuota, cliente }) => {
const txt = `${cliente?.nombre || ""} ${cliente?.telefono || ""} ${cliente?.ruta || ""} ${cuota.fecha}`.toLowerCase();
const pasaBusqueda = txt.includes(q);
const pasaHoy = soloCobrosHoy ? cuota.fecha === hoy : true;
return pasaBusqueda && pasaHoy;
})
.sort((a, b) => new Date(a.cuota.fecha).getTime() - new Date(b.cuota.fecha).getTime());
}, [cuotas, prestamosConEstadoReal, clientes, busquedaCobros, soloCobrosHoy]);

const pagosFiltrados = useMemo(() => {
const q = busquedaPagos.toLowerCase().trim();
return pagos.filter((p) => {
const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
const cliente = clientes.find((c) => c.id === prestamo?.client_id);
const txt = `${cliente?.nombre || ""} ${cliente?.telefono || ""} ${p.metodo || ""} ${p.fecha || ""}`.toLowerCase();
return txt.includes(q);
});
}, [pagos, prestamos, clientes, busquedaPagos]);

const morosos = useMemo(() => {
const q = busquedaMorosos.toLowerCase().trim();

const grupos = cuotas
.filter((c) => c.estado === "VENCIDA" || (c.fecha < todayISO() && Number(c.restante || 0) > 0))
.map((cuota) => {
const prestamo = prestamosConEstadoReal.find((p) => p.id === cuota.prestamo_id);
const cliente = clientes.find((c) => c.id === prestamo?.client_id);
return { cuota, prestamo, cliente };
})
.filter((row) => !!row.cliente);

const map = new Map<
string,
{
cliente: Cliente;
totalVencido: number;
maxDias: number;
cuotasVencidas: number;
}
>();

for (const row of grupos) {
const cliente = row.cliente as Cliente;
const prev = map.get(cliente.id);
const atraso = daysLate(row.cuota.fecha);
const vencido = Number(row.cuota.restante || 0);

if (!prev) {
map.set(cliente.id, {
cliente,
totalVencido: vencido,
maxDias: atraso,
cuotasVencidas: 1,
});
} else {
prev.totalVencido += vencido;
prev.maxDias = Math.max(prev.maxDias, atraso);
prev.cuotasVencidas += 1;
}
}

return Array.from(map.values())
.filter(({ cliente }) => {
const txt = `${cliente.nombre} ${cliente.telefono} ${cliente.ruta || ""}`.toLowerCase();
return txt.includes(q);
})
.sort((a, b) => b.maxDias - a.maxDias);
}, [cuotas, prestamosConEstadoReal, clientes, busquedaMorosos]);

const prestamosCliente = prestamosConEstadoReal.filter((p) => p.client_id === clienteSeleccionadoId);
const pagosCliente = pagos.filter((p) => {
const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
return prestamo?.client_id === clienteSeleccionadoId;
});

const totalPrestado = useMemo(() => prestamos.reduce((acc, p) => acc + p.monto, 0), [prestamos]);
const totalCobrado = useMemo(() => pagos.reduce((acc, p) => acc + p.monto, 0), [pagos]);
const saldoPendiente = useMemo(
() => cuotas.reduce((acc, c) => acc + Number(c.restante || 0), 0),
[cuotas]
);
const totalVencido = useMemo(
() =>
cuotas
.filter((c) => c.estado === "VENCIDA" || (c.fecha < todayISO() && Number(c.restante || 0) > 0))
.reduce((acc, c) => acc + Number(c.restante || 0), 0),
[cuotas]
);

const cobrosHoy = useMemo(
() => cuotas.filter((c) => c.fecha === todayISO() && Number(c.restante || 0) > 0).length,
[cuotas]
);

const clientesVip = clientes.filter((c) => c.nivel === "VIP").length;
const clientesBuenos = clientes.filter((c) => c.nivel === "BUENO").length;
const clientesRegulares = clientes.filter((c) => c.nivel === "REGULAR").length;
const clientesMorosos = clientes.filter((c) => c.nivel === "MOROSO").length;
const prestamosPagados = prestamosConEstadoReal.filter((p) => p.estado === "PAGADO").length;

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
return (
<div style={{ display: "grid", gap: 4 }}>
<h2 style={{ margin: 0, color: TEXT, fontSize: 28 }}>{title}</h2>
{subtitle ? (
<p style={{ margin: 0, color: MUTED, fontSize: 15 }}>{subtitle}</p>
) : null}
</div>
);
}

function NavBtn({ to, label }: { to: Screen; label: string }) {
return (
<button style={buttonStyle(screen === to)} onClick={() => setScreen(to)}>
{label}
</button>
);
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
return (
<div style={cardStyle()}>
<p style={{ margin: 0, color: MUTED }}>{title}</p>
<h3 style={{ margin: "10px 0 0", fontSize: 32, color: TEXT }}>{value}</h3>
</div>
);
}

if (screen === "login") {
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
<div style={{ ...cardStyle(), width: "100%", maxWidth: 430, display: "grid", gap: 16 }}>
<SectionTitle
title={business.negocio || "CREDI YA"}
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
<h1 style={{ margin: 0, fontSize: 34, color: TEXT }}>
{business.negocio || "CREDI YA"}
</h1>
<p style={{ margin: 0, color: MUTED }}>
Usuario: {usuarioActual?.nombre || usuarioActual?.usuario || "-"}
</p>
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<NavBtn to="dashboard" label="Dashboard" />
<NavBtn to="clientes" label="Clientes" />
<NavBtn to="prestamos" label="Préstamos" />
<NavBtn to="cobros" label="Cobros" />
<NavBtn to="pagos" label="Pagos" />
<NavBtn to="morosos" label="Morosos" />
<NavBtn to="configuracion" label="Config" />
<button
style={buttonStyle()}
onClick={() => {
setUsuarioActual(null);
setUsuarioLogin("");
setPasswordLogin("");
setScreen("login");
}}
>
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
<MetricCard title="Clientes morosos" value={clientesMorosos} />
<MetricCard title="Préstamos pagados" value={prestamosPagados} />
</div>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 16,
}}
>
<MetricCard title="Clientes buenos" value={clientesBuenos} />
<MetricCard title="Clientes regulares" value={clientesRegulares} />
</div>

<div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
<SectionTitle title="Acciones rápidas" subtitle="Lo que más usarás" />
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button
style={buttonStyle(true)}
onClick={() => {
limpiarFormularioCliente();
setMostrarFormCliente(true);
setScreen("clientes");
}}
>
Nuevo cliente
</button>

<button
style={buttonStyle()}
onClick={() => {
limpiarFormularioPrestamo();
setMostrarFormPrestamo(true);
setScreen("prestamos");
}}
>
Nuevo préstamo
</button>

<button style={buttonStyle()} onClick={() => setScreen("cobros")}>
Registrar pago
</button>

<button style={buttonStyle()} onClick={recargarTodo}>
Recargar datos
</button>
</div>
</div>
</>
)}

{screen === "clientes" && (
<div style={{ ...cardStyle(), display: "grid", gap: 14 }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
<SectionTitle title="Clientes" subtitle="Búsqueda, edición y ficha completa" />
<button
style={buttonStyle(true)}
onClick={() => {
limpiarFormularioCliente();
setMostrarFormCliente((v) => !v);
}}
>
{mostrarFormCliente ? "Cerrar formulario" : "Nuevo cliente"}
</button>
</div>

<input
style={inputStyle()}
placeholder="Buscar por nombre, teléfono, documento o ruta"
value={busquedaClientes}
onChange={(e) => setBusquedaClientes(e.target.value)}
/>

{mostrarFormCliente && (
<div style={{ ...cardStyle(), boxShadow: "none", display: "grid", gap: 10 }}>
<h3 style={{ margin: 0, color: TEXT }}>
{editandoClienteId ? "Editar cliente" : "Nuevo cliente"}
</h3>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 10,
}}
>
<input style={inputStyle()} placeholder="Nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
<input style={inputStyle()} placeholder="Teléfono" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
<input style={inputStyle()} placeholder="Documento" value={clienteDocumento} onChange={(e) => setClienteDocumento(e.target.value)} />
<input style={inputStyle()} placeholder="Ruta de cobro" value={clienteRuta} onChange={(e) => setClienteRuta(e.target.value)} />
<input style={inputStyle()} placeholder="Dirección" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} />
<input style={inputStyle()} placeholder="Trabajo" value={clienteTrabajo} onChange={(e) => setClienteTrabajo(e.target.value)} />
<input style={inputStyle()} placeholder="Referencia" value={clienteReferencia} onChange={(e) => setClienteReferencia(e.target.value)} />
<input style={inputStyle()} placeholder="Notas" value={clienteNotas} onChange={(e) => setClienteNotas(e.target.value)} />
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button style={buttonStyle(true)} onClick={guardarCliente}>
Guardar
</button>
<button
style={buttonStyle()}
onClick={() => {
limpiarFormularioCliente();
setMostrarFormCliente(false);
}}
>
Cancelar
</button>
</div>
</div>
)}

{loadingClientes ? (
<p style={{ color: MUTED }}>Cargando clientes...</p>
) : clientesFiltrados.length === 0 ? (
<p style={{ color: MUTED }}>No hay clientes.</p>
) : (
clientesFiltrados.map((c) => (
<div
key={c.id}
style={{
padding: 16,
border: `1px solid ${BORDER}`,
borderRadius: 18,
display: "grid",
gap: 10,
background: "#fff",
}}
>
<div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
<div style={{ display: "grid", gap: 5 }}>
<strong style={{ fontSize: 20, color: TEXT }}>{c.nombre}</strong>
<span style={{ color: MUTED }}>Tel: {c.telefono || "-"}</span>
<span style={{ color: MUTED }}>Documento: {c.documento || "No registrado"}</span>
<span style={{ color: MUTED }}>Ruta: {c.ruta || "-"}</span>
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<span style={badgeStyle(badgeColor(c.nivel))}>{c.nivel}</span>
<button
style={buttonStyle()}
onClick={() => {
setClienteSeleccionadoId(c.id);
setScreen("clienteDetalle");
}}
>
Ficha
</button>
<button style={buttonStyle()} onClick={() => empezarEditarCliente(c)}>
Editar
</button>
<button style={dangerButtonStyle()} onClick={() => borrarCliente(c)}>
Borrar
</button>
</div>
</div>
</div>
))
)}
</div>
)}

{screen === "clienteDetalle" && clienteSeleccionado && (
<div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
<SectionTitle title="Ficha del cliente" subtitle="Historial y datos completos" />
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button style={buttonStyle()} onClick={() => empezarEditarCliente(clienteSeleccionado)}>
Editar
</button>
<button style={buttonStyle()} onClick={() => setScreen("clientes")}>
Volver
</button>
</div>
</div>

<div style={{ ...cardStyle(), boxShadow: "none", display: "grid", gap: 6, color: TEXT,}}>
<p style={{ margin: 0 }}><strong>Nombre:</strong> {clienteSeleccionado.nombre}</p>
<p style={{ margin: 0 }}><strong>Teléfono:</strong> {clienteSeleccionado.telefono || "-"}</p>
<p style={{ margin: 0 }}><strong>Documento:</strong> {clienteSeleccionado.documento || "No registrado"}</p>
<p style={{ margin: 0 }}><strong>Ruta:</strong> {clienteSeleccionado.ruta || "-"}</p>
<p style={{ margin: 0 }}><strong>Dirección:</strong> {clienteSeleccionado.direccion || "-"}</p>
<p style={{ margin: 0 }}><strong>Trabajo:</strong> {clienteSeleccionado.trabajo || "-"}</p>
<p style={{ margin: 0 }}><strong>Referencia:</strong> {clienteSeleccionado.referencia || "-"}</p>
<p style={{ margin: 0 }}><strong>Notas:</strong> {clienteSeleccionado.notas || "-"}</p>
<p style={{ margin: 0 }}><strong>Score:</strong> {clienteSeleccionado.score}</p>
<p style={{ margin: 0 }}><strong>Nivel:</strong> {clienteSeleccionado.nivel}</p>
</div>

<div style={{ ...cardStyle(), boxShadow: "none" }}>
<h3 style={{ marginTop: 0 }}>Préstamos</h3>
{prestamosCliente.length === 0 ? (
<p style={{ color: MUTED }}>Sin préstamos.</p>
) : (
<div style={{ display: "grid", gap: 10 }}>
{prestamosCliente.map((p) => (
<div key={p.id} style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 14, color:TEXT,background: "#fff" }}>
<p style={{ margin: 0 }}><strong>Monto:</strong> {formatEUR(p.monto)}</p>
<p style={{ margin: 0 }}><strong>Cuota:</strong> {formatEUR(p.cuota)}</p>
<p style={{ margin: 0 }}><strong>Saldo:</strong> {formatEUR(p.saldo)}</p>
<p style={{ margin: 0 }}><strong>Estado:</strong> {p.estado}</p>
<p style={{ margin: 0 }}><strong>Frecuencia:</strong> {p.frecuencia}</p>
</div>
))}
</div>
)}
</div>

<div style={{ ...cardStyle(), boxShadow: "none" }}>
<h3 style={{ marginTop: 0 }}>Pagos</h3>
{pagosCliente.length === 0 ? (
<p style={{ color: MUTED }}>Sin pagos.</p>
) : (
<div style={{ display: "grid", gap: 10 }}>
{pagosCliente.map((p) => (
<div key={p.id} style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 14, color: TEXT,background: "#fff", }}>
<p style={{ margin: 0 }}><strong>Fecha:</strong> {p.fecha}</p>
<p style={{ margin: 0 }}><strong>Monto:</strong> {formatEUR(p.monto)}</p>
<p style={{ margin: 0 }}><strong>Método:</strong> {p.metodo}</p>
<p style={{ margin: 0 }}><strong>Puntual:</strong> {p.puntual ? "Sí" : "No"}</p>
<p style={{ margin: 0 }}><strong>Nota:</strong> {p.nota || "-"}</p>
</div>
))}
</div>
)}
</div>
</div>
)}

{screen === "prestamos" && (
<div style={{ ...cardStyle(), display: "grid", gap: 14 }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
<SectionTitle title="Préstamos" subtitle="Control total de saldo y cuotas" />
<button
style={buttonStyle(true)}
onClick={() => {
limpiarFormularioPrestamo();
setMostrarFormPrestamo((v) => !v);
}}
>
{mostrarFormPrestamo ? "Cerrar formulario" : "Nuevo préstamo"}
</button>
</div>

{mostrarFormPrestamo && (
<div style={{ ...cardStyle(), boxShadow: "none", display: "grid", gap: 10 }}>
<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 10,
}}
>
<select style={inputStyle()} value={prestamoClienteId} onChange={(e) => setPrestamoClienteId(e.target.value)}>
<option value="">Selecciona cliente</option>
{clientes.map((c) => (
<option key={c.id} value={c.id}>
{c.nombre} - {c.telefono}
</option>
))}
</select>

<input style={inputStyle()} placeholder="Monto" value={prestamoMonto} onChange={(e) => setPrestamoMonto(e.target.value)} />
<input style={inputStyle()} placeholder="Interés (ej 0.15)" value={prestamoInteres} onChange={(e) => setPrestamoInteres(e.target.value)} />

<select
style={inputStyle()}
value={prestamoFrecuencia}
onChange={(e) => {
const value = e.target.value as Prestamo["frecuencia"];
setPrestamoFrecuencia(value);
if (value === "DIARIO") setPrestamoCuotas("20");
if (value === "SEMANAL") setPrestamoCuotas("4");
if (value === "MENSUAL") setPrestamoCuotas("1");
}}
>
<option value="DIARIO">DIARIO</option>
<option value="SEMANAL">SEMANAL</option>
<option value="MENSUAL">MENSUAL</option>
</select>

<input style={inputStyle()} placeholder="Número de cuotas" value={prestamoCuotas} onChange={(e) => setPrestamoCuotas(e.target.value)} />
<input style={inputStyle()} type="date" value={prestamoFechaInicio} onChange={(e) => setPrestamoFechaInicio(e.target.value)} />
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button style={buttonStyle(true)} onClick={guardarPrestamo}>
Guardar préstamo
</button>
<button
style={buttonStyle()}
onClick={() => {
limpiarFormularioPrestamo();
setMostrarFormPrestamo(false);
}}
>
Cancelar
</button>
</div>
</div>
)}

<input
style={inputStyle()}
placeholder="Buscar por cliente, teléfono o ruta"
value={busquedaPrestamos}
onChange={(e) => setBusquedaPrestamos(e.target.value)}
/>

{loadingPrestamos ? (
<p style={{ color: MUTED }}>Cargando préstamos...</p>
) : prestamosFiltrados.length === 0 ? (
<p style={{ color: MUTED }}>No hay préstamos.</p>
) : (
prestamosFiltrados.map((p) => {
const cliente = clientes.find((c) => c.id === p.client_id);
const cuotasPrestamo = cuotas.filter((c) => c.prestamo_id === p.id);
const pagadas = cuotasPrestamo.filter((c) => c.estado === "PAGADA").length;
const parciales = cuotasPrestamo.filter((c) => c.estado === "PARCIAL").length;
const pendientes = cuotasPrestamo.filter((c) => c.estado === "PENDIENTE").length;
const vencidas = cuotasPrestamo.filter((c) => c.estado === "VENCIDA").length;

return (
<div key={p.id} style={{ padding: 16, border: `1px solid ${BORDER}`, borderRadius: 18, display: "grid", gap: 12 }}>
<strong style={{ fontSize: 20 }}>{cliente?.nombre || "Cliente"}</strong>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
gap: 8,
color: MUTED,
}}
>
<span>Monto: {formatEUR(p.monto)}</span>
<span>Total: {formatEUR(p.total)}</span>
<span>Cuota: {formatEUR(p.cuota)}</span>
<span>Saldo: {formatEUR(p.saldo)}</span>
<span>Frecuencia: {p.frecuencia}</span>
<span>Cuotas: {p.cuotas}</span>
</div>

<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, color: MUTED }}>
<span>Pagadas: {pagadas}</span>
<span>Parciales: {parciales}</span>
<span>Pendientes: {pendientes}</span>
<span>Vencidas: {vencidas}</span>
</div>

<span style={badgeStyle(badgeColor(p.estado))}>{p.estado}</span>

<div style={{ display: "grid", gap: 8 }}>
{cuotasPrestamo.map((c) => (
<div
key={c.id}
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
gap: 8,
padding: 12,
border: `1px solid ${BORDER}`,
borderRadius: 14,
color: MUTED,
}}
>
<span>Cuota {c.numero}</span>
<span>{c.fecha}</span>
<span>Total: {formatEUR(c.monto)}</span>
<span>Pagado: {formatEUR(c.pagado)}</span>
<span>Restante: {formatEUR(c.restante)}</span>
<span style={{ color: badgeColor(c.estado), fontWeight: 700 }}>{c.estado}</span>
</div>
))}
</div>
</div>
);
})
)}
</div>
)}

{screen === "cobros" && (
<div style={{ ...cardStyle(), display: "grid", gap: 14 }}>
<SectionTitle title="Cobros y abonos" subtitle="Busca y cobra rápido" />

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button style={buttonStyle(!soloCobrosHoy)} onClick={() => setSoloCobrosHoy(false)}>
Todos
</button>
<button style={buttonStyle(soloCobrosHoy)} onClick={() => setSoloCobrosHoy(true)}>
Solo hoy
</button>
</div>

<input
style={inputStyle()}
placeholder="Buscar cliente, teléfono, ruta o fecha"
value={busquedaCobros}
onChange={(e) => setBusquedaCobros(e.target.value)}
/>

{cuotaSeleccionadaId && (
<div style={{ ...cardStyle(), boxShadow: "none", display: "grid", gap: 12 }}>
<h3 style={{ margin: 0 }}>Registrar pago</h3>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 10,
}}
>
<input style={inputStyle()} placeholder="Monto" value={pagoMonto} onChange={(e) => setPagoMonto(e.target.value)} />
<select style={inputStyle()} value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)}>
<option value="EFECTIVO">EFECTIVO</option>
<option value="BIZUM">BIZUM</option>
<option value="TRANSFERENCIA">TRANSFERENCIA</option>
</select>
<input style={inputStyle()} type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
<input style={inputStyle()} placeholder="Nota" value={pagoNota} onChange={(e) => setPagoNota(e.target.value)} />
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button style={buttonStyle(true)} onClick={registrarPagoVisual}>
Confirmar pago
</button>
<button
style={buttonStyle()}
onClick={() => {
setCuotaSeleccionadaId(null);
setPagoMonto("");
setPagoFecha(todayISO());
setPagoNota("");
setPagoMetodo("EFECTIVO");
}}
>
Cancelar
</button>
</div>
</div>
)}

{loadingCuotas ? (
<p style={{ color: MUTED }}>Cargando cobros...</p>
) : cobrosFiltrados.length === 0 ? (
<p style={{ color: MUTED }}>No hay cobros con ese filtro.</p>
) : (
cobrosFiltrados.map(({ cuota, cliente, prestamo }) => (
<div
key={cuota.id}
style={{
padding: 14,
border: `1px solid ${BORDER}`,
borderRadius: 16,
display: "flex",
justifyContent: "space-between",
gap: 12,
flexWrap: "wrap",
alignItems: "center",
}}
>
<div style={{ display: "grid", gap: 4 }}>
<strong style={{ fontSize: 18 }}>{cliente?.nombre || "Cliente"}</strong>
<span style={{ color: MUTED }}>Tel: {cliente?.telefono || "-"}</span>
<span style={{ color: MUTED }}>Ruta: {cliente?.ruta || "-"}</span>
<span style={{ color: MUTED }}>Cuota {cuota.numero} · Fecha {cuota.fecha}</span>
<span style={{ color: MUTED }}>
Restante {formatEUR(cuota.restante)} · Estado {prestamo?.estado || "-"}
</span>
</div>

<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
<span style={badgeStyle(badgeColor(cuota.estado))}>{cuota.estado}</span>
<button
style={buttonStyle(true)}
onClick={() => {
setCuotaSeleccionadaId(cuota.id);
setPagoMonto(String(cuota.restante));
setPagoFecha(todayISO());
setPagoMetodo("EFECTIVO");
setPagoNota("");
}}
>
Cobrar / Abonar
</button>
</div>
</div>
))
)}
</div>
)}

{screen === "pagos" && (
<div style={{ ...cardStyle(), display: "grid", gap: 14 }}>
<SectionTitle title="Pagos" subtitle="Historial completo" />

<input
style={inputStyle()}
placeholder="Buscar por cliente, fecha o método"
value={busquedaPagos}
onChange={(e) => setBusquedaPagos(e.target.value)}
/>

{loadingPagos ? (
<p style={{ color: MUTED }}>Cargando pagos...</p>
) : pagosFiltrados.length === 0 ? (
<p style={{ color: MUTED }}>No hay pagos registrados.</p>
) : (
pagosFiltrados.map((p) => {
const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
const cliente = clientes.find((c) => c.id === prestamo?.client_id);

return (
<div key={p.id} style={{ padding: 14, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
<strong style={{ fontSize: 18 }}>{cliente?.nombre || "Cliente"}</strong>
<div
style={{
marginTop: 8,
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
gap: 8,
color: MUTED,
}}
>
<span>Fecha: {p.fecha}</span>
<span>Monto: {formatEUR(p.monto)}</span>
<span>Método: {p.metodo}</span>
<span>Puntual: {p.puntual ? "Sí" : "No"}</span>
</div>
{p.nota ? <p style={{ margin: "8px 0 0", color: MUTED }}>Nota: {p.nota}</p> : null}
</div>
);
})
)}
</div>
)}

{screen === "morosos" && (
<div style={{ ...cardStyle(), display: "grid", gap: 14 }}>
<SectionTitle title="Morosos" subtitle="Clientes con cuotas vencidas" />

<input
style={inputStyle()}
placeholder="Buscar por nombre, teléfono o ruta"
value={busquedaMorosos}
onChange={(e) => setBusquedaMorosos(e.target.value)}
/>

{morosos.length === 0 ? (
<p style={{ color: MUTED }}>No hay morosos ahora mismo.</p>
) : (
morosos.map((item) => (
<div
key={item.cliente.id}
style={{
padding: 16,
border: `1px solid ${BORDER}`,
borderRadius: 18,
display: "grid",
gap: 10,
background: "#fff",
}}
>
<div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
<div style={{ display: "grid", gap: 5 }}>
<strong style={{ fontSize: 20 }}>{item.cliente.nombre}</strong>
<span style={{ color: MUTED }}>Tel: {item.cliente.telefono || "-"}</span>
<span style={{ color: MUTED }}>Ruta: {item.cliente.ruta || "-"}</span>
</div>
<span style={badgeStyle(DANGER)}>MOROSO</span>
</div>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
gap: 8,
color: MUTED,
}}
>
<span>Total vencido: {formatEUR(item.totalVencido)}</span>
<span>Días de atraso: {item.maxDias}</span>
<span>Cuotas vencidas: {item.cuotasVencidas}</span>
</div>
</div>
))
)}
</div>
)}

{screen === "configuracion" && (
<div style={{ ...cardStyle(), display: "grid", gap: 14 }}>
<SectionTitle title="Configuración" subtitle="Nombre del negocio y logo del PDF" />

<div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
<label style={{ display: "grid", gap: 6 }}>
<span style={{ color: MUTED }}>Nombre del negocio</span>
<input
style={inputStyle()}
value={business.negocio}
onChange={(e) =>
setBusiness((prev) => ({ ...prev, negocio: e.target.value }))
}
placeholder="Ej: CREDI YA"
/>
</label>

<label style={{ display: "grid", gap: 6 }}>
<span style={{ color: MUTED }}>Logo para el PDF</span>
<input
style={inputStyle()}
type="file"
accept="image/png,image/jpeg,image/webp"
onChange={async (e) => {
const file = e.target.files?.[0];
if (!file) return;
try {
const base64 = await fileToBase64(file);
setBusiness((prev) => ({ ...prev, logoBase64: base64 }));
alert("Logo guardado");
} catch {
alert("No se pudo cargar el logo");
}
}}
/>
</label>

{business.logoBase64 ? (
<div style={{ ...cardStyle(), boxShadow: "none", display: "grid", gap: 10 }}>
<span style={{ color: MUTED }}>Vista previa del logo</span>
<img
src={business.logoBase64}
alt="Logo"
style={{ maxWidth: 180, maxHeight: 80, objectFit: "contain" }}
/>
<button
style={dangerButtonStyle()}
onClick={() => setBusiness((prev) => ({ ...prev, logoBase64: "" }))}
>
Quitar logo
</button>
</div>
) : null}

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button style={buttonStyle(true)} onClick={() => alert("Configuración guardada")}>
Guardar configuración
</button>
<button
style={buttonStyle()}
onClick={() =>
setBusiness({
negocio: "CREDI YA",
logoBase64: "",
})
}
>
Restablecer
</button>
</div>
</div>
</div>
)}
</div>
</div>
);
}