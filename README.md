# Mis Gastos

PWA local para celular que registra ingresos, gastos, historial, estadísticas y metas mensuales usando `localStorage`.

## Cómo abrirla

Opción rápida:

1. Abre `index.html` en el navegador.
2. La app funcionará localmente, pero el service worker PWA solo se activa con servidor HTTP.

Opción recomendada para PWA:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory outputs\mis-gastos
```

Luego abre:

```text
http://127.0.0.1:4173
```

## Incluye

- Resumen mensual de ingresos, gastos, saldo y presupuesto usado.
- Formularios para gastos e ingresos.
- Historial ordenado por fecha con eliminación de movimientos.
- Estadísticas por categoría, gasto más alto y promedio diario.
- Metas con presupuesto mensual, progreso y alerta al superar 80%.
- Persistencia en `localStorage`.
- Manifest e icono para instalación como PWA.
