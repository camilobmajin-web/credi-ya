"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";

type Screen =
  | "login"
  | "dashboard"
  | "clientes"
  | "prestamos"
  | "cobros"
  | "pagos"
  | "clienteDetalle";

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

const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#374151";
const BORDER_COLOR = "#cbd5e1";
const BG = "#f3f4f6";
const CARD_BG = "#ffffff";
const PRIMARY = "#0f172a";
const DANGER = "#b91c1c";

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
  if (score > 20) return "VIP";
  if (score >= 10) return "BUENO";
  if (score < 0) return "MOROSO";
  return "REGULAR";
}

function getRecommendation(score: number) {
  if (score > 20) return { accion: "PRESTAR", monto: 800, interes: "12%" };
  if (score >= 10) return { accion: "PRESTAR", monto: 500, interes: "15%" };
  if (score >= 0) return { accion: "PRESTAR CON CUIDADO", monto: 250, interes: "18%" };
  return { accion: "NO PRESTAR", monto: 0, interes: "-" };
}

function colorNivel(nivel: Cliente["nivel"]) {
  switch (nivel) {
    case "VIP":
      return "#15803d";
    case "BUENO":
      return "#16a34a";
    case "REGULAR":
      return "#d97706";
    case "MOROSO":
      return "#dc2626";
  }
}

function colorEstadoPrestamo(estado: Prestamo["estado"]) {
  switch (estado) {
    case "AL DÍA":
      return "#16a34a";
    case "COBRAR HOY":
      return "#d97706";
    case "VENCIDO":
      return "#dc2626";
    case "PAGADO":
      return "#2563eb";
  }
}

function colorEstadoCuota(estado: Cuota["estado"]) {
  switch (estado) {
    case "PENDIENTE":
      return "#6b7280";
    case "PARCIAL":
      return "#d97706";
    case "PAGADA":
      return "#2563eb";
    case "VENCIDA":
      return "#dc2626";
  }
}

function cardStyle(): CSSProperties {
  return {
    background: CARD_BG,
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
    border: `1px solid ${BORDER_COLOR}`,
    color: TEXT_PRIMARY,
  };
}

function buttonStyle(primary = false): CSSProperties {
  return {
    padding: "14px 18px",
    borderRadius: 16,
    border: primary ? "none" : `1px solid ${BORDER_COLOR}`,
    background: primary ? PRIMARY : "white",
    color: primary ? "white" : TEXT_PRIMARY,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
    minHeight: 48,
  };
}

function dangerButtonStyle(): CSSProperties {
  return {
    ...buttonStyle(),
    border: "1px solid #fecaca",
    color: DANGER,
    background: "#fff",
  };
}

function inputStyle(): CSSProperties {
  return {
    padding: 14,
    borderRadius: 14,
    border: `1px solid ${BORDER_COLOR}`,
    width: "100%",
    color: TEXT_PRIMARY,
    background: "white",
    fontSize: 16,
    minHeight: 48,
    outline: "none",
  };
}

function badgeStyle(textColor: string): CSSProperties {
  return {
    background: "#f8fafc",
    color: textColor,
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    border: `1px solid ${BORDER_COLOR}`,
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

export default function App() {
  
  const [screen, setScreen] = useState<Screen>("login");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);

  const [usuarioLogin, setUsuarioLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [usuarioActual, setUsuarioActual] = useState<UsuarioApp | null>(null);

  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);

  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [cargandoPrestamos, setCargandoPrestamos] = useState(false);
  const [cargandoPagos, setCargandoPagos] = useState(false);
  const [cargandoCuotas, setCargandoCuotas] = useState(false);

  const [busquedaClientes, setBusquedaClientes] = useState("");
  const [busquedaPrestamos, setBusquedaPrestamos] = useState("");
  const [busquedaCobros, setBusquedaCobros] = useState("");
  const [busquedaPagos, setBusquedaPagos] = useState("");
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
  const [prestamoFrecuencia, setPrestamoFrecuencia] =
    useState<Prestamo["frecuencia"]>("DIARIO");
  const [prestamoCuotas, setPrestamoCuotas] = useState("20");
  const [prestamoFechaInicio, setPrestamoFechaInicio] = useState(todayISO());

  const [cuotaSeleccionadaId, setCuotaSeleccionadaId] = useState<string | null>(null);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState("EFECTIVO");
  const [pagoFecha, setPagoFecha] = useState(todayISO());
  const [pagoNota, setPagoNota] = useState("");

  async function cargarUsuarios() {
    const { data, error } = await supabase
      .from("usuarios_app")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error) setUsuarios((data || []) as UsuarioApp[]);
  }

  async function cargarClientes() {
    setCargandoClientes(true);

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Error cargando clientes: " + error.message);
      setCargandoClientes(false);
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
    setCargandoClientes(false);
  }

  async function cargarPrestamos() {
    setCargandoPrestamos(true);

    const { data, error } = await supabase
      .from("prestamos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Error cargando préstamos: " + error.message);
      setCargandoPrestamos(false);
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
    setCargandoPrestamos(false);
  }

  async function cargarPagos() {
    setCargandoPagos(true);

    const { data, error } = await supabase
      .from("pagos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Error cargando pagos: " + error.message);
      setCargandoPagos(false);
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
    setCargandoPagos(false);
  }

  async function cargarCuotas() {
    setCargandoCuotas(true);

    const { data, error } = await supabase
      .from("cuotas")
      .select("*")
      .order("fecha", { ascending: true });

    if (error) {
      alert("Error cargando cuotas: " + error.message);
      setCargandoCuotas(false);
      return;
    }

    const hoy = todayISO();

    const lista: Cuota[] = (data || []).map((c: any) => {
      let estado = (c.estado || "PENDIENTE") as Cuota["estado"];

      if (estado !== "PAGADA" && c.fecha < hoy && Number(c.restante || c.monto || 0) > 0) {
        estado = "VENCIDA";
      }

      return {
        id: c.id,
        prestamo_id: c.prestamo_id,
        numero: Number(c.numero || 0),
        fecha: c.fecha || hoy,
        monto: Number(c.monto || 0),
        pagado: Number(c.pagado || 0),
        restante: Number(c.restante ?? c.monto ?? 0),
        estado,
      };
    });

    setCuotas(lista);
    setCargandoCuotas(false);
  }

  async function recargarTodo() {
    await Promise.all([
      cargarUsuarios(),
      cargarClientes(),
      cargarPrestamos(),
      cargarPagos(),
      cargarCuotas(),
    ]);
  }

  useEffect(() => {
    recargarTodo();
  }, []);

  async function login() {
    const encontrado = usuarios.find(
      (u) => u.usuario === usuarioLogin && u.password === passwordLogin
    );

    if (!encontrado) {
      alert("Usuario o contraseña incorrectos");
      return;
    }

    setUsuarioActual(encontrado);
    setScreen("dashboard");
  }

  async function registrarUsuario() {
    const nombre = prompt("Nombre del usuario");
    if (!nombre) return;

    const usuario = prompt("Usuario") || "";
    const password = prompt("Contraseña") || "";

    if (!usuario || !password) {
      alert("Usuario y contraseña obligatorios");
      return;
    }

    const { error } = await supabase
      .from("usuarios_app")
      .insert([{ nombre, usuario, password }]);

    if (error) {
      alert("Error creando usuario: " + error.message);
      return;
    }

    alert("Usuario creado");
    await cargarUsuarios();
  }

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

  function empezarCrearCliente() {
    limpiarFormularioCliente();
    setMostrarFormCliente(true);
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
      const { error } = await supabase
        .from("clientes")
        .insert([{ ...payload, score: 0 }]);

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

  async function borrarCliente(cliente: Cliente) {
    const confirmado = confirm(
      `¿Seguro que quieres borrar a ${cliente.nombre}?\n\nEsto borrará también sus préstamos, cuotas y pagos relacionados.`
    );

    if (!confirmado) return;

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", cliente.id);

    if (error) {
      alert("Error borrando cliente: " + error.message);
      return;
    }

    if (clienteSeleccionadoId === cliente.id) {
      setClienteSeleccionadoId(null);
      setScreen("clientes");
    }

    alert("Cliente borrado correctamente");
    await recargarTodo();
  }

  function limpiarFormularioPrestamo() {
    setPrestamoClienteId("");
    setPrestamoMonto("");
    setPrestamoInteres("0.15");
    setPrestamoFrecuencia("DIARIO");
    setPrestamoCuotas("20");
    setPrestamoFechaInicio(todayISO());
  }

  async function guardarPrestamo() {
    if (!prestamoClienteId) {
      alert("Selecciona un cliente");
      return;
    }

    const monto = Number(prestamoMonto || 0);
    const interes = Number(prestamoInteres || 0);
    const cuotasCount = Number(prestamoCuotas || 0);
    const fecha_inicio = prestamoFechaInicio || todayISO();

    if (!monto || !interes || !cuotasCount) {
      alert("Completa monto, interés y cuotas");
      return;
    }

    let total = 0;
    if (prestamoFrecuencia === "MENSUAL") total = monto * (1 + interes * cuotasCount);
    else total = monto * (1 + interes);

    const cuotaBase = total / cuotasCount;
    const cuotaRedondeada = roundInstallment(cuotaBase);
    const saldo = cuotaRedondeada * cuotasCount;

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
          cuota: cuotaRedondeada,
          saldo,
          estado: prestamoFrecuencia === "DIARIO" ? "COBRAR HOY" : "AL DÍA",
          fecha_inicio,
        },
      ])
      .select()
      .single();

    if (error || !prestamoCreado) {
      alert("Error creando préstamo: " + (error?.message || ""));
      return;
    }

    const cuotasInsert = Array.from({ length: cuotasCount }).map((_, i) => {
      let fecha = fecha_inicio;

      if (prestamoFrecuencia === "DIARIO") fecha = addBusinessDays(fecha_inicio, i);
      if (prestamoFrecuencia === "SEMANAL") fecha = addDays(fecha_inicio, (i + 1) * 7);
      if (prestamoFrecuencia === "MENSUAL") fecha = addMonths(fecha_inicio, i + 1);

      return {
        prestamo_id: prestamoCreado.id,
        numero: i + 1,
        fecha,
        monto: cuotaRedondeada,
        pagado: 0,
        restante: cuotaRedondeada,
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

    if (nuevoRestante === 0) {
      nuevoEstado = "PAGADA";
    } else if (nuevoPagado > 0) {
      nuevoEstado = "PARCIAL";
    } else if (cuota.fecha < todayISO()) {
      nuevoEstado = "VENCIDA";
    }

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

  const nuevoSaldo = cuotasActualizadas.reduce(
    (acc: number, c: any) => acc + Number(c.restante || 0),
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
    clienteDocumento: cliente?.documento || "",
    clienteTelefono: cliente?.telefono || "",
    fecha,
    monto: montoPagoNum,
    metodo: pagoMetodo,
    nota: pagoNota,
    saldoRestante: deudaPagada ? 0 : nuevoSaldo,
    numeroCuota: cuotaBase.numero,
    cuotasPendientes: deudaPagada ? 0 : cuotasPendientes,
    estadoDeuda,
    logo: "CREDI YA",
  });

  alert(deudaPagada ? "Pago registrado. Deuda pagada." : "Pago registrado correctamente");

  setCuotaSeleccionadaId(null);
  setPagoMonto("");
  setPagoMetodo("EFECTIVO");
  setPagoFecha(todayISO());
  setPagoNota("");

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
  logo?: string;
}) {
  const doc = new jsPDF();

  const negocio = params.logo || "CREDI YA";

  const logo = params.logo; // base64 o URL en el futuro

if (logo) {
  doc.addImage(logo, "PNG", 20, 10, 40, 20);
} else {
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
  line("DOCUMENTO", params.clienteDocumento || "NO REGISTRO");
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
  const prestamosConEstadoReal = useMemo(() => {
    const hoy = todayISO();

    return prestamos.map((p) => {
      const cuotasPrestamo = cuotas.filter((c) => c.prestamo_id === p.id);
      const saldoReal = cuotasPrestamo.reduce((acc, c) => acc + Number(c.restante || 0), 0);
      const tieneHoy = cuotasPrestamo.some((c) => c.fecha === hoy && c.estado !== "PAGADA");
      const tieneVencidas = cuotasPrestamo.some((c) => c.fecha < hoy && c.estado !== "PAGADA");

      let estado: Prestamo["estado"] = p.estado;
      if (saldoReal <= 0) estado = "PAGADO";
      else if (tieneVencidas) estado = "VENCIDO";
      else if (tieneHoy) estado = "COBRAR HOY";
      else estado = "AL DÍA";

      return { ...p, saldo: saldoReal, estado };
    });
  }, [prestamos, cuotas]);

  const clientesFiltrados = useMemo(() => {
    const q = busquedaClientes.toLowerCase().trim();
    return clientes.filter((c) => {
      const texto = `${c.nombre} ${c.telefono} ${c.documento || ""} ${c.ruta || ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [clientes, busquedaClientes]);

  const prestamosFiltrados = useMemo(() => {
    const q = busquedaPrestamos.toLowerCase().trim();

    return prestamosConEstadoReal.filter((p) => {
      const cliente = clientes.find((c) => c.id === p.client_id);
      const texto = `${cliente?.nombre || ""} ${cliente?.telefono || ""} ${cliente?.ruta || ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [prestamosConEstadoReal, clientes, busquedaPrestamos]);

  const cobrosHoyCount = useMemo(() => {
    const hoy = todayISO();
    return cuotas.filter((c) => c.fecha === hoy && c.estado !== "PAGADA").length;
  }, [cuotas]);

  const cobrosFiltrados = useMemo(() => {
    const hoy = todayISO();
    const q = busquedaCobros.toLowerCase().trim();

    return cuotas
      .filter((c) => c.estado !== "PAGADA")
      .map((c) => {
        const prestamo = prestamosConEstadoReal.find((p) => p.id === c.prestamo_id);
        const cliente = clientes.find((cl) => cl.id === prestamo?.client_id);
        return { cuota: c, prestamo, cliente };
      })
      .filter(({ cuota, cliente }) => {
        const texto =
          `${cliente?.nombre || ""} ${cliente?.telefono || ""} ${cliente?.ruta || ""} ${cuota.fecha}`.toLowerCase();
        const coincideBusqueda = texto.includes(q);
        const coincideHoy = soloCobrosHoy ? cuota.fecha === hoy : true;
        return coincideBusqueda && coincideHoy;
      })
      .sort((a, b) => {
        const aTime = new Date(a.cuota.fecha).getTime();
        const bTime = new Date(b.cuota.fecha).getTime();
        return aTime - bTime;
      });
  }, [cuotas, prestamosConEstadoReal, clientes, busquedaCobros, soloCobrosHoy]);

  const pagosFiltrados = useMemo(() => {
    const q = busquedaPagos.toLowerCase().trim();

    return pagos.filter((p) => {
      const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
      const cliente = clientes.find((c) => c.id === prestamo?.client_id);
      const texto = `${cliente?.nombre || ""} ${cliente?.telefono || ""} ${p.metodo || ""} ${p.fecha || ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [pagos, prestamos, clientes, busquedaPagos]);

  const totalPrestado = useMemo(
    () => prestamos.reduce((acc, p) => acc + p.monto, 0),
    [prestamos]
  );

  const totalPendiente = useMemo(
    () => cuotas.reduce((acc, c) => acc + Number(c.restante || 0), 0),
    [cuotas]
  );

  const totalCobrado = useMemo(
    () => pagos.reduce((acc, p) => acc + p.monto, 0),
    [pagos]
  );

  const clientesVip = clientes.filter((c) => c.nivel === "VIP").length;
  const clientesBuenos = clientes.filter((c) => c.nivel === "BUENO").length;
  const clientesRegulares = clientes.filter((c) => c.nivel === "REGULAR").length;
  const clientesMorosos = clientes.filter((c) => c.nivel === "MOROSO").length;

  const clienteSeleccionado =
    clientes.find((c) => c.id === clienteSeleccionadoId) || null;

  const prestamosCliente = prestamosConEstadoReal.filter(
    (p) => p.client_id === clienteSeleccionadoId
  );

  const pagosCliente = pagos.filter((p) => {
    const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
    return prestamo?.client_id === clienteSeleccionadoId;
  });

  const cuotaSeleccionada =
    cuotas.find((c) => c.id === cuotaSeleccionadaId) || null;

  function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 28, color: TEXT_PRIMARY }}>{title}</h2>
        {subtitle ? (
          <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 15 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
    );
  }

  function MetricCard({ label, value }: { label: string; value: string | number }) {
    return (
      <div style={cardStyle()}>
        <p style={{ color: TEXT_SECONDARY, margin: 0, fontSize: 15 }}>{label}</p>
        <h2 style={{ color: TEXT_PRIMARY, margin: "10px 0 0", fontSize: 28 }}>{value}</h2>
      </div>
    );
  }

  function NavButton({ value, label }: { value: Screen; label: string }) {
    return (
      <button style={buttonStyle(screen === value)} onClick={() => setScreen(value)}>
        {label}
      </button>
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
        <div style={{ ...cardStyle(), width: "100%", maxWidth: 420, display: "grid", gap: 16 }}>
          <SectionTitle title="CREDI YA" subtitle="Control profesional de préstamos y cobros" />

          <input
            placeholder="Usuario"
            style={inputStyle()}
            value={usuarioLogin}
            onChange={(e) => setUsuarioLogin(e.target.value)}
          />

          <input
            placeholder="Contraseña"
            type="password"
            style={inputStyle()}
            value={passwordLogin}
            onChange={(e) => setPasswordLogin(e.target.value)}
          />

          <button style={buttonStyle(true)} onClick={login}>
            Entrar
          </button>

          <button style={buttonStyle()} onClick={registrarUsuario}>
            Crear usuario
          </button>

          <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 14 }}>
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
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, color: TEXT_PRIMARY, fontSize: 34 }}>CREDI YA</h1>
              <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 16 }}>
                Usuario: {usuarioActual?.nombre || usuarioActual?.usuario || "-"}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NavButton value="dashboard" label="Dashboard" />
              <NavButton value="clientes" label="Clientes" />
              <NavButton value="prestamos" label="Préstamos" />
              <NavButton value="cobros" label="Cobros" />
              <NavButton value="pagos" label="Pagos" />
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
              <MetricCard label="Total prestado" value={formatEUR(totalPrestado)} />
              <MetricCard label="Total cobrado" value={formatEUR(totalCobrado)} />
              <MetricCard label="Saldo pendiente" value={formatEUR(totalPendiente)} />
              <MetricCard label="Cobros hoy" value={cobrosHoyCount} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <MetricCard label="VIP" value={clientesVip} />
              <MetricCard label="Buenos" value={clientesBuenos} />
              <MetricCard label="Regulares" value={clientesRegulares} />
              <MetricCard label="Morosos" value={clientesMorosos} />
            </div>

            <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
              <SectionTitle title="Acciones rápidas" subtitle="Trabaja más rápido desde aquí" />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={buttonStyle(true)} onClick={empezarCrearCliente}>
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
          <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <SectionTitle title="Clientes" subtitle="Gestión, riesgo y rutas" />
              <button style={buttonStyle(true)} onClick={empezarCrearCliente}>
                Nuevo cliente
              </button>
            </div>

            <input
              placeholder="Buscar por nombre, teléfono, documento o ruta"
              value={busquedaClientes}
              onChange={(e) => setBusquedaClientes(e.target.value)}
              style={inputStyle()}
            />

            {mostrarFormCliente && (
              <div style={{ ...cardStyle(), display: "grid", gap: 12, boxShadow: "none" }}>
                <h3 style={{ margin: 0, color: TEXT_PRIMARY }}>
                  {editandoClienteId ? "Editar cliente" : "Nuevo cliente"}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  <input placeholder="Nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} style={inputStyle()} />
                  <input placeholder="Teléfono" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} style={inputStyle()} />
                  <input placeholder="Documento" value={clienteDocumento} onChange={(e) => setClienteDocumento(e.target.value)} style={inputStyle()} />
                  <input placeholder="Ruta de cobro" value={clienteRuta} onChange={(e) => setClienteRuta(e.target.value)} style={inputStyle()} />
                  <input placeholder="Dirección" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} style={inputStyle()} />
                  <input placeholder="Trabajo" value={clienteTrabajo} onChange={(e) => setClienteTrabajo(e.target.value)} style={inputStyle()} />
                  <input placeholder="Referencia" value={clienteReferencia} onChange={(e) => setClienteReferencia(e.target.value)} style={inputStyle()} />
                  <input placeholder="Notas" value={clienteNotas} onChange={(e) => setClienteNotas(e.target.value)} style={inputStyle()} />
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

            {cargandoClientes ? (
              <p style={{ color: TEXT_SECONDARY }}>Cargando clientes...</p>
            ) : clientesFiltrados.length === 0 ? (
              <p style={{ color: TEXT_SECONDARY }}>No hay clientes todavía.</p>
            ) : (
              clientesFiltrados.map((c) => {
                const recommendation = getRecommendation(c.score);

                return (
                  <div
                    key={c.id}
                    style={{
                      display: "grid",
                      gap: 12,
                      padding: 16,
                      border: `1px solid ${BORDER_COLOR}`,
                      borderRadius: 18,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <strong style={{ fontSize: 20, color: TEXT_PRIMARY }}>{c.nombre}</strong>
                        <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 15 }}>Tel: {c.telefono}</p>
                        <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 15 }}>Doc: {c.documento || "-"}</p>
                        <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 15 }}>Ruta: {c.ruta || "-"}</p>
                        <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 15 }}>Score: {c.score}</p>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={badgeStyle(colorNivel(c.nivel))}>{c.nivel}</span>

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

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                        fontSize: 15,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      <span>Acción: {recommendation.accion}</span>
                      <span>Monto recomendado: {formatEUR(recommendation.monto)}</span>
                      <span>Interés sugerido: {recommendation.interes}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {screen === "clienteDetalle" && clienteSeleccionado && (
          <div style={{ ...cardStyle(), display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <SectionTitle title="Ficha del cliente" subtitle="Información completa" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={buttonStyle()} onClick={() => empezarEditarCliente(clienteSeleccionado)}>
                  Editar
                </button>
                <button style={dangerButtonStyle()} onClick={() => borrarCliente(clienteSeleccionado)}>
                  Borrar
                </button>
                <button style={buttonStyle()} onClick={() => setScreen("clientes")}>
                  Volver
                </button>
              </div>
            </div>

            <div style={{ ...cardStyle(), boxShadow: "none", display: "grid", gap: 8 }}>
              <p style={{ margin: 0 }}><strong>Nombre:</strong> {clienteSeleccionado.nombre}</p>
              <p style={{ margin: 0 }}><strong>Teléfono:</strong> {clienteSeleccionado.telefono || "-"}</p>
              <p style={{ margin: 0 }}><strong>Documento:</strong> {clienteSeleccionado.documento || "-"}</p>
              <p style={{ margin: 0 }}><strong>Ruta:</strong> {clienteSeleccionado.ruta || "-"}</p>
              <p style={{ margin: 0 }}><strong>Dirección:</strong> {clienteSeleccionado.direccion || "-"}</p>
              <p style={{ margin: 0 }}><strong>Trabajo:</strong> {clienteSeleccionado.trabajo || "-"}</p>
              <p style={{ margin: 0 }}><strong>Referencia:</strong> {clienteSeleccionado.referencia || "-"}</p>
              <p style={{ margin: 0 }}><strong>Notas:</strong> {clienteSeleccionado.notas || "-"}</p>
              <p style={{ margin: 0 }}><strong>Score:</strong> {clienteSeleccionado.score}</p>
              <p style={{ margin: 0 }}><strong>Nivel:</strong> {clienteSeleccionado.nivel}</p>
            </div>

            <div style={{ ...cardStyle(), boxShadow: "none" }}>
              <h3 style={{ marginTop: 0, color: TEXT_PRIMARY }}>Préstamos del cliente</h3>
              {prestamosCliente.length === 0 ? (
                <p style={{ color: TEXT_SECONDARY }}>No tiene préstamos.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {prestamosCliente.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: 12,
                        border: `1px solid ${BORDER_COLOR}`,
                        borderRadius: 14,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <p style={{ margin: 0 }}><strong>Monto:</strong> {formatEUR(p.monto)}</p>
                      <p style={{ margin: 0 }}><strong>Cuota:</strong> {formatEUR(p.cuota)}</p>
                      <p style={{ margin: 0 }}><strong>Saldo:</strong> {formatEUR(p.saldo)}</p>
                      <p style={{ margin: 0 }}><strong>Frecuencia:</strong> {p.frecuencia}</p>
                      <p style={{ margin: 0 }}><strong>Estado:</strong> {p.estado}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...cardStyle(), boxShadow: "none" }}>
              <h3 style={{ marginTop: 0, color: TEXT_PRIMARY }}>Pagos del cliente</h3>
              {pagosCliente.length === 0 ? (
                <p style={{ color: TEXT_SECONDARY }}>No tiene pagos.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {pagosCliente.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: 12,
                        border: `1px solid ${BORDER_COLOR}`,
                        borderRadius: 14,
                        display: "grid",
                        gap: 6,
                      }}
                    >
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
          <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <SectionTitle title="Préstamos" subtitle="Control completo de cuotas y saldo" />
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
              <div style={{ ...cardStyle(), display: "grid", gap: 12, boxShadow: "none" }}>
                <h3 style={{ margin: 0, color: TEXT_PRIMARY }}>Nuevo préstamo</h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  <select
                    value={prestamoClienteId}
                    onChange={(e) => setPrestamoClienteId(e.target.value)}
                    style={inputStyle()}
                  >
                    <option value="">Selecciona cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} - {c.telefono}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="Monto"
                    value={prestamoMonto}
                    onChange={(e) => setPrestamoMonto(e.target.value)}
                    style={inputStyle()}
                  />

                  <input
                    placeholder="Interés (ej 0.15)"
                    value={prestamoInteres}
                    onChange={(e) => setPrestamoInteres(e.target.value)}
                    style={inputStyle()}
                  />

                  <select
                    value={prestamoFrecuencia}
                    onChange={(e) => {
                      const val = e.target.value as Prestamo["frecuencia"];
                      setPrestamoFrecuencia(val);
                      if (val === "DIARIO") setPrestamoCuotas("20");
                      if (val === "SEMANAL") setPrestamoCuotas("4");
                      if (val === "MENSUAL") setPrestamoCuotas("1");
                    }}
                    style={inputStyle()}
                  >
                    <option value="DIARIO">DIARIO</option>
                    <option value="SEMANAL">SEMANAL</option>
                    <option value="MENSUAL">MENSUAL</option>
                  </select>

                  <input
                    placeholder={prestamoFrecuencia === "MENSUAL" ? "Meses" : "Número de cuotas"}
                    value={prestamoCuotas}
                    onChange={(e) => setPrestamoCuotas(e.target.value)}
                    style={inputStyle()}
                  />

                  <input
                    type="date"
                    value={prestamoFechaInicio}
                    onChange={(e) => setPrestamoFechaInicio(e.target.value)}
                    style={inputStyle()}
                  />
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
              placeholder="Buscar por cliente, teléfono o ruta"
              value={busquedaPrestamos}
              onChange={(e) => setBusquedaPrestamos(e.target.value)}
              style={inputStyle()}
            />

            {cargandoPrestamos ? (
              <p style={{ color: TEXT_SECONDARY }}>Cargando préstamos...</p>
            ) : prestamosFiltrados.length === 0 ? (
              <p style={{ color: TEXT_SECONDARY }}>No hay préstamos todavía.</p>
            ) : (
              prestamosFiltrados.map((p) => {
                const cliente = clientes.find((c) => c.id === p.client_id);
                const cuotasPrestamo = cuotas.filter((c) => c.prestamo_id === p.id);

                const pagadas = cuotasPrestamo.filter((c) => c.estado === "PAGADA").length;
                const parciales = cuotasPrestamo.filter((c) => c.estado === "PARCIAL").length;
                const pendientes = cuotasPrestamo.filter((c) => c.estado === "PENDIENTE").length;
                const vencidas = cuotasPrestamo.filter((c) => c.estado === "VENCIDA").length;

                return (
                  <div
                    key={p.id}
                    style={{
                      padding: 16,
                      border: `1px solid ${BORDER_COLOR}`,
                      borderRadius: 18,
                      display: "grid",
                      gap: 12,
                      background: "#fff",
                    }}
                  >
                    <strong style={{ fontSize: 20, color: TEXT_PRIMARY }}>
                      {cliente?.nombre || "Cliente sin nombre"}
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 10,
                        color: TEXT_SECONDARY,
                        fontSize: 15,
                      }}
                    >
                      <span>Monto: {formatEUR(p.monto)}</span>
                      <span>Total: {formatEUR(p.total)}</span>
                      <span>Cuota: {formatEUR(p.cuota)}</span>
                      <span>Saldo: {formatEUR(p.saldo)}</span>
                      <span>Frecuencia: {p.frecuencia}</span>
                      <span>Cuotas: {p.cuotas}</span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: 10,
                        color: TEXT_SECONDARY,
                        fontSize: 15,
                      }}
                    >
                      <span>Pagadas: {pagadas}</span>
                      <span>Parciales: {parciales}</span>
                      <span>Pendientes: {pendientes}</span>
                      <span>Vencidas: {vencidas}</span>
                    </div>

                    <span style={badgeStyle(colorEstadoPrestamo(p.estado))}>{p.estado}</span>

                    <div style={{ display: "grid", gap: 8 }}>
                      {cuotasPrestamo.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                            gap: 8,
                            padding: 12,
                            border: `1px solid ${BORDER_COLOR}`,
                            borderRadius: 14,
                            fontSize: 15,
                            color: TEXT_SECONDARY,
                          }}
                        >
                          <span>Cuota {c.numero}</span>
                          <span>{c.fecha}</span>
                          <span>Total: {formatEUR(c.monto)}</span>
                          <span>Pagado: {formatEUR(c.pagado)}</span>
                          <span>Restante: {formatEUR(c.restante)}</span>
                          <span style={{ color: colorEstadoCuota(c.estado), fontWeight: 700 }}>
                            {c.estado}
                          </span>
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
          <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
            <SectionTitle
              title="Cobros y abonos"
              subtitle="Busca cualquier cliente y registra cobros, atrasos o abonos a capital"
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={buttonStyle(!soloCobrosHoy)}
                onClick={() => setSoloCobrosHoy(false)}
              >
                Todos los pendientes
              </button>

              <button
                style={buttonStyle(soloCobrosHoy)}
                onClick={() => setSoloCobrosHoy(true)}
              >
                Solo hoy
              </button>
            </div>

            <input
              placeholder="Buscar cliente, teléfono, ruta o fecha"
              value={busquedaCobros}
              onChange={(e) => setBusquedaCobros(e.target.value)}
              style={inputStyle()}
            />

            {cuotaSeleccionada && (
              <div style={{ ...cardStyle(), display: "grid", gap: 12, boxShadow: "none" }}>
                <h3 style={{ margin: 0, color: TEXT_PRIMARY }}>Registrar pago o abono</h3>
                <p style={{ margin: 0, color: TEXT_SECONDARY }}>
                  Cuota {cuotaSeleccionada.numero} · Restante {formatEUR(cuotaSeleccionada.restante)}
                </p>
                <p style={{ margin: 0, color: TEXT_SECONDARY }}>
                  El sistema repartirá el pago automáticamente sobre las cuotas pendientes del préstamo.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  <input
                    placeholder="Monto pagado"
                    value={pagoMonto}
                    onChange={(e) => setPagoMonto(e.target.value)}
                    style={inputStyle()}
                  />

                  <select
                    value={pagoMetodo}
                    onChange={(e) => setPagoMetodo(e.target.value)}
                    style={inputStyle()}
                  >
                    <option value="EFECTIVO">EFECTIVO</option>
                    <option value="BIZUM">BIZUM</option>
                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                  </select>

                  <input
                    type="date"
                    value={pagoFecha}
                    onChange={(e) => setPagoFecha(e.target.value)}
                    style={inputStyle()}
                  />

                  <input
                    placeholder="Nota"
                    value={pagoNota}
                    onChange={(e) => setPagoNota(e.target.value)}
                    style={inputStyle()}
                  />
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
                      setPagoMetodo("EFECTIVO");
                      setPagoFecha(todayISO());
                      setPagoNota("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {cargandoCuotas ? (
              <p style={{ color: TEXT_SECONDARY }}>Cargando cobros...</p>
            ) : cobrosFiltrados.length === 0 ? (
              <p style={{ color: TEXT_SECONDARY }}>
                No hay cuotas pendientes con ese filtro.
              </p>
            ) : (
              cobrosFiltrados.map(({ cuota, cliente, prestamo }) => {
                const hoy = todayISO();
                const esVencida = cuota.fecha < hoy;
                const esHoy = cuota.fecha === hoy;

                return (
                  <div
                    key={cuota.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      border: `1px solid ${BORDER_COLOR}`,
                      borderRadius: 16,
                      flexWrap: "wrap",
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ fontSize: 18, color: TEXT_PRIMARY }}>
                        {cliente?.nombre || "Cliente"}
                      </strong>

                      <p style={{ margin: 0, color: TEXT_SECONDARY }}>
                        {cliente?.telefono || ""}
                      </p>

                      <p style={{ margin: 0, color: TEXT_SECONDARY }}>
                        Ruta: {cliente?.ruta || "-"}
                      </p>

                      <p style={{ margin: 0, color: TEXT_SECONDARY }}>
                        Cuota {cuota.numero} · Fecha {cuota.fecha}
                      </p>

                      <p style={{ margin: 0, color: TEXT_SECONDARY }}>
                        Total {formatEUR(cuota.monto)} · Pagado {formatEUR(cuota.pagado)} · Restante {formatEUR(cuota.restante)}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={badgeStyle(
                          esVencida ? "#dc2626" : esHoy ? "#d97706" : colorEstadoPrestamo(prestamo?.estado || "AL DÍA")
                        )}
                      >
                        {esVencida ? "VENCIDA" : esHoy ? "COBRAR HOY" : "PENDIENTE"}
                      </span>

                      <button
                        style={buttonStyle(true)}
                        onClick={() => {
                          setCuotaSeleccionadaId(cuota.id);
                          setPagoMonto(String(cuota.restante));
                          setPagoMetodo("EFECTIVO");
                          setPagoFecha(todayISO());
                          setPagoNota("");
                        }}
                      >
                        Abonar / Cobrar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {screen === "pagos" && (
          <div style={{ ...cardStyle(), display: "grid", gap: 12 }}>
            <SectionTitle title="Pagos" subtitle="Historial con buscador" />

            <input
              placeholder="Buscar por cliente, fecha o método"
              value={busquedaPagos}
              onChange={(e) => setBusquedaPagos(e.target.value)}
              style={inputStyle()}
            />

            {cargandoPagos ? (
              <p style={{ color: TEXT_SECONDARY }}>Cargando pagos...</p>
            ) : pagosFiltrados.length === 0 ? (
              <p style={{ color: TEXT_SECONDARY }}>No hay pagos todavía.</p>
            ) : (
              pagosFiltrados.map((p) => {
                const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
                const cliente = clientes.find((c) => c.id === prestamo?.client_id);

                return (
                  <div
                    key={p.id}
                    style={{
                      padding: 14,
                      border: `1px solid ${BORDER_COLOR}`,
                      borderRadius: 16,
                      display: "grid",
                      gap: 8,
                      background: "#fff",
                    }}
                  >
                    <strong style={{ fontSize: 18, color: TEXT_PRIMARY }}>
                      {cliente?.nombre || "Cliente"}
                    </strong>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 8,
                        color: TEXT_SECONDARY,
                        fontSize: 15,
                      }}
                    >
                      <span>Fecha: {p.fecha}</span>
                      <span>Monto: {formatEUR(p.monto)}</span>
                      <span>Método: {p.metodo}</span>
                      <span>Puntual: {p.puntual ? "Sí" : "No"}</span>
                    </div>
                    {p.nota ? <p style={{ margin: 0, color: TEXT_SECONDARY }}>Nota: {p.nota}</p> : null}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}