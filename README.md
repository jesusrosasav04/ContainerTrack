# ContainerTrack

Sistema web de gestión y rastreo de contenedores marítimos y embarcaciones.

Permite registrar contenedores, seguir su recorrido entre puertos, visualizar embarcaciones y rutas en un mapa y consultar estadísticas de la operación.

## Funcionalidades

- Inicio de sesión con roles de usuario.
- Panel general con mapa de embarcaciones, rutas y puertos.
- Registro de contenedores con validación del número según la norma ISO 6346.
- Historial de movimientos de cada contenedor, desde su registro hasta la entrega.
- Estadísticas anuales para administradores.
- Actualización automática de posiciones y estados.

## Tecnologías

| Área | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Base de datos | Microsoft SQL Server |
| Mapas | Leaflet + OpenStreetMap |
| Autenticación | JWT + bcrypt |

## Estructura

```text
ContainerTrack/
├── frontend/    Interfaz web
├── backend/     API REST
├── database/    Scripts de base de datos
└── docs/        Documentación
```

## Estado del proyecto

- [x] Base de datos y API REST
- [x] Autenticación y roles
- [x] Panel con mapa, registro de contenedores y estadísticas
- [x] Rastreo simulado
- [ ] Pruebas automáticas
- [ ] Docker y despliegue

Las posiciones de las embarcaciones son simuladas; no corresponden a datos AIS en tiempo real.

## Autor

Jesus Rosas
