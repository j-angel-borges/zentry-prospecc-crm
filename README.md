# 🎯 Zentry Prospecc (ZentryOS Lead Capture & Cloud CRM)

> Sistema de Prospección en Frío, Calificación de Diagnóstico Infantil y CRM de Alta Conversión para Eventos Masivos (Expo Maternidad) y Venta Consultiva.
> Publicado en: **https://zentry-prospecc.web.app**

---

## 🏛️ Arquitectura y Tecnologías
- **Framework Web**: React 19 + TypeScript + Vite + Tailwind CSS v4.
- **Base de Datos Cloud**: Google Cloud Firestore (`leads_expo_maternidad`).
- **Sincronización en Tiempo Real**: Listeners bi-direccionales `onSnapshot` con soporte offline y memoria local.
- **Hosting & CDN**: Firebase Hosting Multisite en el proyecto `zentryos` (`zentry-prospecc.web.app`).

---

## 📋 Módulos Principales

### 1. 🎯 Modo Prospección (Diagnostic Wizard de 7 Pasos)
- Diseñado para asesores comerciales en campo (dispositivos móviles/tablets).
- Flujo interactivo de alta velocidad:
  1. **Portada & Atribución**: Selección del asesor comercial en turno.
  2. **Nivel de Preocupación**: Termómetro interactivo de alarma cognitiva (1 - 10).
  3. **Diagnóstico del Daño**: Detección de irritabilidad, berrinches, falta de sueño y desatención.
  4. **Segmentación por Cohorte**: 👶 Menores (3-9a), 🧑 Mayores (10-17a) y 👨‍👩‍👧‍👦 Familias mixtas.
  5. **Pregunta y Respuesta Dinámica**: Ramificación adaptativa según la edad del menor.
  6. **Intencionalidad de Solución (Pitch ZentryOS)**: Gamificación bilateral de retos pedagógicos.
  7. **Datos del Titular**: Captura de Padre/Madre, WhatsApp Perú (+51) y Distrito de Lima.
  8. **Cierre, vCard QR y Clasificación**: Código QR interactivo de contacto y calificación térmica (🔥 Caliente, ⛅ Tibio, ❄️ Frío).

### 2. 📊 Hoja de Cálculo Interactiva (`Leads_ExpoMaternidad`)
- Espejo digitalizado de la hoja Google Sheets original con capacidades de base de datos relacional/NoSQL:
  - Búsqueda universal por cualquier campo.
  - Filtros avanzados por Asesor, Temperatura, Estado CRM y Distrito.
  - Edición en caliente de celdas y estados.
  - Disparadores de WhatsApp con mensajes prefabricados a un clic.
  - Exportación total a `.CSV` estructurado compatible con Excel y Google Sheets.
  - Sembrador de datos muestra oficiales acumulados de la Expo Maternidad.

### 3. 📋 Pipeline CRM (Vista Kanban)
- Gestión del embudo comercial en 5 etapas:
  1. 📥 **Nuevos Leads**
  2. 📞 **Contactados / En Seguimiento**
  3. 📅 **DemoBook Agendada**
  4. 🏆 **Ventas Cerradas (Ganadas)**
  5. 🚫 **Descartados / No Calificados**
- Transición de etapas con 1 clic y métricas de flujo.

### 4. 📈 Analítica & Control de Eventos
- Barra de progreso hacia la meta diaria (120 leads/día).
- Tasa de alta intención y nivel de dolor promedio reportado.
- Leaderboard de asesores con mayor volumen de captación.
- Mapa demográfico de distritos con mayor interés en ZentryOS.

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
