# 🎯 Zentry Prospecc (ZentryOS Lead Capture & Cloud CRM)

> Sistema de Prospección en Frío, Calificación de Diagnóstico Infantil y CRM de Alta Conversión para Eventos Masivos (Expo Maternidad) y Venta Consultiva.
> - **App de Prospección (Formulario)**: `https://zentry-prospecc.web.app/`
> - **CRM & Control Comercial Dedicado**: `https://zentry-prospecc.web.app/crm`

---

## 🏛️ Arquitectura y Backend Cloud en Tiempo Real
- **Framework Web**: React 19 + TypeScript + Vite + Tailwind CSS v4.
- **Acceso Aislado CRM / Prospecc**: Enrutamiento SPA dinámico (`/crm` vs `/`) con sincronización con historial del navegador y compatibilidad multi-dominio/subdominio.
- **Base de Datos Cloud SSOT**: Google Cloud Firestore (`leads_expo_maternidad` y `crm_settings/config`).
- **Sincronización Multi-dispositivo en Vivo**:
  - **Pestañas en la nube**: Cualquier pestaña creada en un dispositivo se difunde inmediatamente a todos los demás clientes en tiempo real.
  - **Ediciones y Estados**: Modificaciones de texto, transferencias entre pestañas, calificaciones y cambios de embudo CRM persisten en Firestore con `setDoc(..., { merge: true })`.
  - **Historial de Llamadas**: Registro con estampa de tiempo, observación y estados (SC, NC, Col, Bz, ll), con eliminación individual y limpieza masiva de NC.
- **Hosting & CDN**: Firebase Hosting en el proyecto `zentryos`.

---

## 📋 Módulos Principales

### 1. 🎯 Modo Prospección (Diagnostic Wizard de 7 Pasos)
- Diseñado para asesores comerciales en campo (dispositivos móviles/tablets).
- Botón superior derecho **📊 CRM** que redirecciona de forma inmediata a la vista y URL aislada del CRM.
- Selector de pestaña de destino sincronizado en tiempo real con la nube.
- Creación automática de nuevas pestañas en la nube durante la captura.
- Guardado instantáneo en Firestore con actualización del contador en tiempo real.

### 2. 📊 CRM & Control de Leads (`/crm`)
- Vista independiente y dedicada sin superposición modal:
  - **Pestañas Cloud en Vivo**: `Expo M (JA)`, `Expo M (R)`, pestañas personalizadas con conteos en tiempo real y botón para agregar (`+ Nueva Pestaña`) o eliminar pestañas.
  - **Hoja de Cálculo Interactiva**: Edición en línea con lápiz/doble clic, búsqueda universal, filtros por distrito, ocultar/mostrar columnas y presets rápidos (CRM, Stand, Todos).
  - **Gestión Call Center**: Selector de estado de llamada (SC, NC, Col, Bz, ll) + confirmación de estampa de tiempo y modal de historial.
  - **Reasignación de Pestaña**: Transferencia directa de prospectos entre pestañas con persistencia cloud.
  - **Pipeline CRM Kanban**: Flujo visual de embudo (Nuevos, Contactados, Demo Agendada, Ventas Cerradas, Descartados).
  - **Exportación CSV**: Descarga de datos filtrados por pestaña o generales.
  - **Enlace de Regreso**: Botón `📝 Captura de Leads` para retornar al formulario de campo.

---

## 🚀 Despliegue y Comandos

```bash
# Instalar dependencias
npm install

# Iniciar servidor local
npm run dev

# Compilar para producción
npm run build

# Desplegar a Firebase Hosting
firebase deploy --only hosting:prospecc --project zentryos
```

