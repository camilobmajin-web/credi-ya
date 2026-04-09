"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";

type Screen =
  | "login"
  | "dashboard"
  | "clientes"
  | "prestamos"
  | "pagos"
  | "cobros"
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

type Pago = {
  id: string;
  prestamo_id: string;
  fecha: string;
  monto: number;
  metodo: string;
  puntual: boolean;
  nota?: string;
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

type UsuarioApp = {
  id: string;
  nombre: string;
  usuario: string;
  password: string;
};

function formatEUR(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(n || 0));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb",
  };
}

function buttonStyle(primary = false): CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 14,
    border: primary ? "none" : "1px solid #d1d5db",
    background: primary ? "#111827" : "white",
    color: primary ? "white" : "#111827",
    cursor: "pointer",
    fontWeight: 600,
  };
}

function inputStyle(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    width: "100%",
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

  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [cargandoPrestamos, setCargandoPrestamos] = useState(false);
  const [cargandoPagos, setCargandoPagos] = useState(false);
  const [cargandoCuotas, setCargandoCuotas] = useState(false);

  const [busquedaPrestamo, setBusquedaPrestamo] = useState("");
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);

  async function cargarUsuarios() {
    const { data, error } = await supabase
      .from("usuarios_app")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) return;
    setUsuarios((data || []) as UsuarioApp[]);
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

    const { error } = await supabase.from("usuarios_app").insert([
      { nombre, usuario, password },
    ]);

    if (error) {
      alert("Error creando usuario: " + error.message);
      return;
    }

    alert("Usuario creado");
    await cargarUsuarios();
  }

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

    const formateados: Cliente[] = (data || []).map((c: any) => ({
      id: c.id,
      nombre: c.nombre || "",
      telefono: c.telefono || "",
      documento: c.documento || "",
      direccion: c.direccion || "",
      trabajo: c.trabajo || "",
      referencia: c.referencia || "",
      notas: c.notas || "",
      score: c.score || 0,
      nivel: getNivel(c.score || 0),
    }));

    setClientes(formateados);
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

    const formateados: Prestamo[] = (data || []).map((p: any) => ({
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

    setPrestamos(formateados);
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

    const formateados: Pago[] = (data || []).map((p: any) => ({
      id: p.id,
      prestamo_id: p.prestamo_id,
      fecha: p.fecha || "",
      monto: Number(p.monto || 0),
      metodo: p.metodo || "",
      puntual: !!p.puntual,
      nota: p.nota || "",
    }));

    setPagos(formateados);
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

    const formateadas: Cuota[] = (data || []).map((c: any) => {
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

    setCuotas(formateadas);
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

  async function crearCliente() {
    const nombre = prompt("Nombre del cliente");
    if (!nombre) return;

    const telefono = prompt("Teléfono") || "";
    const documento = prompt("Número de documento") || "";
    const direccion = prompt("Dirección") || "";
    const trabajo = prompt("Trabajo") || "";
    const referencia = prompt("Referencia") || "";
    const notas = prompt("Notas") || "";

    const { error } = await supabase.from("clientes").insert([
      {
        nombre,
        telefono,
        documento,
        direccion,
        trabajo,
        referencia,
        notas,
        score: 0,
      },
    ]);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    alert("Cliente creado");
    await cargarClientes();
  }

  async function editarCliente(cliente: Cliente) {
    const nombre = prompt("Nombre", cliente.nombre ?? "") ?? cliente.nombre ?? "";
    const telefono = prompt("Teléfono", cliente.telefono ?? "") ?? cliente.telefono ?? "";
    const documento = prompt("Documento", cliente.documento ?? "") ?? cliente.documento ?? "";
    const direccion = prompt("Dirección", cliente.direccion ?? "") ?? cliente.direccion ?? "";
    const trabajo = prompt("Trabajo", cliente.trabajo ?? "") ?? cliente.trabajo ?? "";
    const referencia = prompt("Referencia", cliente.referencia ?? "") ?? cliente.referencia ?? "";
    const notas = prompt("Notas", cliente.notas ?? "") ?? cliente.notas ?? "";

    const { error } = await supabase
      .from("clientes")
      .update({
        nombre,
        telefono,
        documento,
        direccion,
        trabajo,
        referencia,
        notas,
      })
      .eq("id", cliente.id);

    if (error) {
      alert("Error actualizando cliente: " + error.message);
      return;
    }

    alert("Cliente actualizado");
    await cargarClientes();
  }

  async function crearPrestamo() {
    if (clientes.length === 0) {
      alert("Primero crea un cliente");
      return;
    }

    const lista = clientes
      .map((c, i) => `${i + 1}. ${c.nombre} - ${c.telefono}`)
      .join("\n");

    const seleccion = prompt("Selecciona el número del cliente:\n\n" + lista);
    if (!seleccion) return;

    const index = Number(seleccion) - 1;
    const cliente = clientes[index];

    if (!cliente) {
      alert("Cliente no válido");
      return;
    }

    const monto = Number(prompt("Monto prestado", "100") || 0);
    if (!monto) return;

    const frecuenciaInput =
      (prompt("Frecuencia: DIARIO / SEMANAL / MENSUAL", "DIARIO") || "DIARIO")
        .toUpperCase()
        .trim() as Prestamo["frecuencia"];

    const frecuencia: Prestamo["frecuencia"] =
      frecuenciaInput === "SEMANAL" || frecuenciaInput === "MENSUAL"
        ? frecuenciaInput
        : "DIARIO";

    const interes = Number(prompt("Interés (ejemplo 0.15 para 15%)", "0.15") || 0);
    if (Number.isNaN(interes)) return;

    const cuotasDefault =
      frecuencia === "DIARIO" ? 20 : frecuencia === "SEMANAL" ? 4 : 1;

    const cuotasCount = Number(
      prompt(
        frecuencia === "MENSUAL" ? "Meses" : "Número de cuotas",
        String(cuotasDefault)
      ) || cuotasDefault
    );

    const fecha_inicio =
      prompt("Fecha inicio (YYYY-MM-DD)", todayISO()) || todayISO();

    let total = 0;
    if (frecuencia === "MENSUAL") total = monto * (1 + interes * cuotasCount);
    else total = monto * (1 + interes);

    const cuotaBase = total / cuotasCount;
    const cuotaRedondeada = roundInstallment(cuotaBase);
    const saldo = cuotaRedondeada * cuotasCount;

    const { data: prestamoCreado, error } = await supabase
      .from("prestamos")
      .insert([
        {
          client_id: cliente.id,
          monto,
          interes,
          frecuencia,
          cuotas: cuotasCount,
          total,
          cuota: cuotaRedondeada,
          saldo,
          estado: frecuencia === "DIARIO" ? "COBRAR HOY" : "AL DÍA",
          fecha_inicio,
        },
      ])
      .select()
      .single();

    if (error || !prestamoCreado) {
      alert("Error: " + (error?.message || "No se pudo crear préstamo"));
      return;
    }

    const cuotasInsert = Array.from({ length: cuotasCount }).map((_, i) => {
      let fecha = fecha_inicio;

      if (frecuencia === "DIARIO") fecha = addBusinessDays(fecha_inicio, i);
      if (frecuencia === "SEMANAL") fecha = addDays(fecha_inicio, (i + 1) * 7);
      if (frecuencia === "MENSUAL") fecha = addMonths(fecha_inicio, i + 1);

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
      alert("Préstamo creado, pero error creando cuotas: " + errorCuotas.message);
      return;
    }

    alert("Préstamo y cuotas creados");
    await recargarTodo();
  }

  async function registrarPago() {
    const pendientes = cuotas.filter((c) => c.estado !== "PAGADA");

    if (pendientes.length === 0) {
      alert("No hay cuotas pendientes");
      return;
    }

    const lista = pendientes
      .map((c, i) => {
        const prestamo = prestamos.find((p) => p.id === c.prestamo_id);
        const cliente = clientes.find((x) => x.id === prestamo?.client_id);
        return `${i + 1}. ${cliente?.nombre || "Cliente"} - Cuota ${c.numero} - ${formatEUR(c.monto)} - Restante ${formatEUR(c.restante || c.monto)} - ${c.fecha} - ${c.estado}`;
      })
      .join("\n");

    const seleccion = prompt("Selecciona una cuota del préstamo a cobrar:\n\n" + lista);
    if (!seleccion) return;

    const index = Number(seleccion) - 1;
    const cuotaBase = pendientes[index];

    if (!cuotaBase) {
      alert("Cuota no válida");
      return;
    }

    const montoPago = Number(prompt("Monto pagado", String(cuotaBase.restante || cuotaBase.monto)) || 0);
    if (!montoPago) return;

    const metodo = prompt("Método: EFECTIVO / BIZUM / TRANSFERENCIA", "EFECTIVO") || "EFECTIVO";
    const fecha = prompt("Fecha (YYYY-MM-DD)", todayISO()) || todayISO();
    const nota = prompt("Nota", "") || "";
    const puntual = fecha <= cuotaBase.fecha;

    const prestamo = prestamos.find((p) => p.id === cuotaBase.prestamo_id);
    if (!prestamo) {
      alert("No se encontró el préstamo");
      return;
    }

    const cuotasPrestamo = cuotas
      .filter((c) => c.prestamo_id === prestamo.id && c.estado !== "PAGADA")
      .sort((a, b) => a.numero - b.numero);

    let restantePago = montoPago;

    for (const cuota of cuotasPrestamo) {
      if (restantePago <= 0) break;

      const pagadoActual = Number(cuota.pagado || 0);
      const restanteActual = Number(cuota.restante || cuota.monto);

      if (restanteActual <= 0) continue;

      const abono = Math.min(restantePago, restanteActual);
      const nuevoPagado = pagadoActual + abono;
      const nuevoRestante = Math.max(0, cuota.monto - nuevoPagado);

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
        monto: montoPago,
        metodo,
        puntual,
        nota,
      },
    ]);

    if (errorPago) {
      alert("Error guardando pago: " + errorPago.message);
      return;
    }

    const cuotasActualizadasRaw = await supabase
      .from("cuotas")
      .select("*")
      .eq("prestamo_id", prestamo.id);

    if (cuotasActualizadasRaw.error) {
      alert("Error recalculando préstamo: " + cuotasActualizadasRaw.error.message);
      return;
    }

    const cuotasActualizadas = cuotasActualizadasRaw.data || [];
    const nuevoSaldo = cuotasActualizadas.reduce(
      (acc, c) => acc + Number(c.restante || c.monto || 0),
      0
    );

    let nuevoEstadoPrestamo: "AL DÍA" | "COBRAR HOY" | "VENCIDO" | "PAGADO" = "AL DÍA";
    const hoy = todayISO();
    const tieneHoy = cuotasActualizadas.some((c) => c.fecha === hoy && c.estado !== "PAGADA");
    const tieneVencidas = cuotasActualizadas.some((c) => c.fecha < hoy && c.estado !== "PAGADA");

    if (nuevoSaldo <= 0) nuevoEstadoPrestamo = "PAGADO";
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

    const cliente = clientes.find((c) => c.id === prestamo.client_id);
    if (cliente) {
      const nuevoScore = cliente.score + (puntual ? 2 : -5);

      const { error: errorCliente } = await supabase
        .from("clientes")
        .update({ score: nuevoScore })
        .eq("id", cliente.id);

      if (errorCliente) {
        alert("Error actualizando cliente: " + errorCliente.message);
        return;
      }
    }

    alert("Pago registrado correctamente");
    await recargarTodo();
  }

  const prestamosConEstadoReal = useMemo(() => {
    const hoy = todayISO();

    return prestamos.map((p) => {
      const cuotasPrestamo = cuotas.filter((c) => c.prestamo_id === p.id);
      const tieneHoy = cuotasPrestamo.some((c) => c.fecha === hoy && c.estado !== "PAGADA");
      const tieneVencidas = cuotasPrestamo.some((c) => c.fecha < hoy && c.estado !== "PAGADA");

      let estado: Prestamo["estado"] = p.estado;
      if (p.saldo <= 0) estado = "PAGADO";
      else if (tieneVencidas) estado = "VENCIDO";
      else if (tieneHoy) estado = "COBRAR HOY";
      else estado = "AL DÍA";

      return { ...p, estado };
    });
  }, [prestamos, cuotas]);

  const prestamosFiltrados = useMemo(() => {
    return prestamosConEstadoReal.filter((p) => {
      const cliente = clientes.find((c) => c.id === p.client_id);
      const texto = `${cliente?.nombre || ""} ${cliente?.telefono || ""}`.toLowerCase();
      return texto.includes(busquedaPrestamo.toLowerCase());
    });
  }, [prestamosConEstadoReal, clientes, busquedaPrestamo]);

  const cobrosHoyList = useMemo(() => {
    const hoy = todayISO();

    return cuotas
      .filter((c) => c.fecha === hoy && c.estado !== "PAGADA")
      .map((c) => {
        const prestamo = prestamosConEstadoReal.find((p) => p.id === c.prestamo_id);
        const cliente = clientes.find((cl) => cl.id === prestamo?.client_id);
        return { cuota: c, prestamo, cliente };
      });
  }, [cuotas, prestamosConEstadoReal, clientes]);

  const totalPrestado = useMemo(
    () => prestamos.reduce((acc, p) => acc + p.monto, 0),
    [prestamos]
  );

  const totalPendiente = useMemo(
    () => prestamos.reduce((acc, p) => acc + p.saldo, 0),
    [prestamos]
  );

  const totalCobrado = useMemo(
    () => pagos.reduce((acc, p) => acc + p.monto, 0),
    [pagos]
  );

  const cobrosHoy = cobrosHoyList.length;

  const clientesVip = clientes.filter((c) => c.nivel === "VIP").length;
  const clientesBuenos = clientes.filter((c) => c.nivel === "BUENO").length;
  const clientesRegulares = clientes.filter((c) => c.nivel === "REGULAR").length;
  const clientesMorosos = clientes.filter((c) => c.nivel === "MOROSO").length;

  const clienteSeleccionado = clientes.find((c) => c.id === clienteSeleccionadoId) || null;
  const prestamosCliente = prestamosConEstadoReal.filter((p) => p.client_id === clienteSeleccionadoId);
  const pagosCliente = pagos.filter((p) => {
    const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
    return prestamo?.client_id === clienteSeleccionadoId;
  });

  if (screen === "login") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div style={{ ...cardStyle(), width: "100%", maxWidth: 420, display: "grid", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>CREDI YA</h1>
            <p style={{ color: "#6b7280", marginBottom: 0 }}>
              Control de préstamos y cobros
            </p>
          </div>

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

          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            Usuarios creados: {usuarios.length}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: 20 }}>
      <div style={{ maxWidth: 1150, margin: "0 auto", display: "grid", gap: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>CREDI YA</h1>
            <p style={{ color: "#6b7280", marginTop: 6 }}>
              Usuario: {usuarioActual?.nombre || usuarioActual?.usuario || "-"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={buttonStyle(screen === "dashboard")} onClick={() => setScreen("dashboard")}>
              Dashboard
            </button>
            <button style={buttonStyle(screen === "clientes")} onClick={() => setScreen("clientes")}>
              Clientes
            </button>
            <button style={buttonStyle(screen === "prestamos")} onClick={() => setScreen("prestamos")}>
              Préstamos
            </button>
            <button style={buttonStyle(screen === "cobros")} onClick={() => setScreen("cobros")}>
              Cobros hoy
            </button>
            <button style={buttonStyle(screen === "pagos")} onClick={() => setScreen("pagos")}>
              Pagos
            </button>
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

        {screen === "dashboard" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>Total prestado</p>
                <h2>{formatEUR(totalPrestado)}</h2>
              </div>
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>Total cobrado</p>
                <h2>{formatEUR(totalCobrado)}</h2>
              </div>
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>Saldo pendiente</p>
                <h2>{formatEUR(totalPendiente)}</h2>
              </div>
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>Cobros hoy</p>
                <h2>{cobrosHoy}</h2>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>VIP</p>
                <h2>{clientesVip}</h2>
              </div>
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>Buenos</p>
                <h2>{clientesBuenos}</h2>
              </div>
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>Regulares</p>
                <h2>{clientesRegulares}</h2>
              </div>
              <div style={cardStyle()}>
                <p style={{ color: "#6b7280", margin: 0 }}>Morosos</p>
                <h2>{clientesMorosos}</h2>
              </div>
            </div>

            <div style={cardStyle()}>
              <h3>Acciones rápidas</h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button style={buttonStyle(true)} onClick={crearCliente}>
                  Nuevo cliente
                </button>
                <button style={buttonStyle()} onClick={crearPrestamo}>
                  Nuevo préstamo
                </button>
                <button style={buttonStyle()} onClick={registrarPago}>
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
              <h3 style={{ margin: 0 }}>Clientes</h3>
              <button style={buttonStyle(true)} onClick={crearCliente}>
                Nuevo cliente
              </button>
            </div>

            {cargandoClientes ? (
              <p style={{ color: "#6b7280" }}>Cargando clientes...</p>
            ) : clientes.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No hay clientes todavía.</p>
            ) : (
              clientes.map((c) => {
                const recommendation = getRecommendation(c.score);

                return (
                  <div
                    key={c.id}
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong>{c.nombre}</strong>
                        <p style={{ margin: 0, color: "#6b7280" }}>Tel: {c.telefono}</p>
                        <p style={{ margin: 0, color: "#6b7280" }}>Doc: {c.documento || "-"}</p>
                        <p style={{ margin: 0, color: "#6b7280" }}>Score: {c.score}</p>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: "#f3f4f6",
                            color: colorNivel(c.nivel),
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {c.nivel}
                        </span>

                        <button
                          style={buttonStyle()}
                          onClick={() => {
                            setClienteSeleccionadoId(c.id);
                            setScreen("clienteDetalle");
                          }}
                        >
                          Ficha
                        </button>

                        <button style={buttonStyle()} onClick={() => editarCliente(c)}>
                          Editar
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 8,
                        fontSize: 14,
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
              <h3 style={{ margin: 0 }}>Ficha del cliente</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={buttonStyle()} onClick={() => editarCliente(clienteSeleccionado)}>
                  Editar
                </button>
                <button style={buttonStyle()} onClick={() => setScreen("clientes")}>
                  Volver
                </button>
              </div>
            </div>

            <div style={{ ...cardStyle(), boxShadow: "none" }}>
              <p><strong>Nombre:</strong> {clienteSeleccionado.nombre}</p>
              <p><strong>Teléfono:</strong> {clienteSeleccionado.telefono || "-"}</p>
              <p><strong>Documento:</strong> {clienteSeleccionado.documento || "-"}</p>
              <p><strong>Dirección:</strong> {clienteSeleccionado.direccion || "-"}</p>
              <p><strong>Trabajo:</strong> {clienteSeleccionado.trabajo || "-"}</p>
              <p><strong>Referencia:</strong> {clienteSeleccionado.referencia || "-"}</p>
              <p><strong>Notas:</strong> {clienteSeleccionado.notas || "-"}</p>
              <p><strong>Score:</strong> {clienteSeleccionado.score}</p>
              <p><strong>Nivel:</strong> {clienteSeleccionado.nivel}</p>
            </div>

            <div style={{ ...cardStyle(), boxShadow: "none" }}>
              <h4>Préstamos del cliente</h4>
              {prestamosCliente.length === 0 ? (
                <p style={{ color: "#6b7280" }}>No tiene préstamos.</p>
              ) : (
                prestamosCliente.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: 12,
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <p style={{ margin: 0 }}><strong>Monto:</strong> {formatEUR(p.monto)}</p>
                    <p style={{ margin: 0 }}><strong>Cuota:</strong> {formatEUR(p.cuota)}</p>
                    <p style={{ margin: 0 }}><strong>Saldo:</strong> {formatEUR(p.saldo)}</p>
                    <p style={{ margin: 0 }}><strong>Frecuencia:</strong> {p.frecuencia}</p>
                    <p style={{ margin: 0 }}><strong>Estado:</strong> {p.estado}</p>
                  </div>
                ))
              )}
            </div>

            <div style={{ ...cardStyle(), boxShadow: "none" }}>
              <h4>Pagos del cliente</h4>
              {pagosCliente.length === 0 ? (
                <p style={{ color: "#6b7280" }}>No tiene pagos.</p>
              ) : (
                pagosCliente.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: 12,
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <p style={{ margin: 0 }}><strong>Fecha:</strong> {p.fecha}</p>
                    <p style={{ margin: 0 }}><strong>Monto:</strong> {formatEUR(p.monto)}</p>
                    <p style={{ margin: 0 }}><strong>Método:</strong> {p.metodo}</p>
                    <p style={{ margin: 0 }}><strong>Puntual:</strong> {p.puntual ? "Sí" : "No"}</p>
                    <p style={{ margin: 0 }}><strong>Nota:</strong> {p.nota || "-"}</p>
                  </div>
                ))
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
              <h3 style={{ margin: 0 }}>Préstamos</h3>
              <button style={buttonStyle(true)} onClick={crearPrestamo}>
                Nuevo préstamo
              </button>
            </div>

            <input
              placeholder="Buscar por cliente o teléfono"
              value={busquedaPrestamo}
              onChange={(e) => setBusquedaPrestamo(e.target.value)}
              style={inputStyle()}
            />

            {cargandoPrestamos ? (
              <p style={{ color: "#6b7280" }}>Cargando préstamos...</p>
            ) : prestamosFiltrados.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No hay préstamos todavía.</p>
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
                      padding: 14,
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <strong>{cliente?.nombre || "Cliente sin nombre"}</strong>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 8,
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
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 8,
                        fontSize: 14,
                      }}
                    >
                      <span>Pagadas: {pagadas}</span>
                      <span>Parciales: {parciales}</span>
                      <span>Pendientes: {pendientes}</span>
                      <span>Vencidas: {vencidas}</span>
                    </div>

                    <span
                      style={{
                        width: "fit-content",
                        background: "#f3f4f6",
                        color: colorEstadoPrestamo(p.estado),
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {p.estado}
                    </span>

                    <div style={{ display: "grid", gap: 6 }}>
                      {cuotasPrestamo.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
                            gap: 8,
                            padding: 8,
                            border: "1px solid #f0f0f0",
                            borderRadius: 10,
                            fontSize: 14,
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
            <h3 style={{ margin: 0 }}>Cobros de hoy</h3>

            {cargandoCuotas ? (
              <p style={{ color: "#6b7280" }}>Cargando cobros...</p>
            ) : cobrosHoyList.length === 0 ? (
              <p style={{ color: "#6b7280" }}>Hoy no hay cobros programados.</p>
            ) : (
              cobrosHoyList.map(({ cuota, cliente, prestamo }) => (
                <div
                  key={cuota.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{cliente?.nombre || "Cliente"}</strong>
                    <p style={{ margin: 0, color: "#6b7280" }}>{cliente?.telefono || ""}</p>
                    <p style={{ margin: 0, color: "#6b7280" }}>
                      Cuota {cuota.numero} · Total {formatEUR(cuota.monto)} · Restante {formatEUR(cuota.restante)}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: "#f3f4f6",
                        color: colorEstadoPrestamo(prestamo?.estado || "COBRAR HOY"),
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {prestamo?.estado || "COBRAR HOY"}
                    </span>

                    <button style={buttonStyle(true)} onClick={registrarPago}>
                      Cobrar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {screen === "pagos" && (
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
              <h3 style={{ margin: 0 }}>Pagos</h3>
              <button style={buttonStyle(true)} onClick={registrarPago}>
                Registrar pago
              </button>
            </div>

            {cargandoPagos ? (
              <p style={{ color: "#6b7280" }}>Cargando pagos...</p>
            ) : pagos.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No hay pagos todavía.</p>
            ) : (
              pagos.map((p) => {
                const prestamo = prestamos.find((x) => x.id === p.prestamo_id);
                const cliente = clientes.find((c) => c.id === prestamo?.client_id);

                return (
                  <div
                    key={p.id}
                    style={{
                      padding: 14,
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <strong>{cliente?.nombre || "Cliente"}</strong>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 8,
                      }}
                    >
                      <span>Fecha: {p.fecha}</span>
                      <span>Monto: {formatEUR(p.monto)}</span>
                      <span>Método: {p.metodo}</span>
                      <span>Puntual: {p.puntual ? "Sí" : "No"}</span>
                    </div>
                    {p.nota ? (
                      <p style={{ margin: 0, color: "#6b7280" }}>Nota: {p.nota}</p>
                    ) : null}
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