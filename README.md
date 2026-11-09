# ContainerTrack

Sistema web de gestión y rastreo de contenedores marítimos y embarcaciones.

**Stack:** React + Vite · Node.js + Express · SQL Server 2022 · Docker · Leaflet

## Estructura

```text
ContainerTrack/
├── frontend/          React + Vite
├── backend/           API REST (Express)
│   └── src/
│       ├── config/        Conexión a SQL Server
│       ├── routes/        URLs de la API
│       ├── controllers/   HTTP <-> servicio
│       ├── services/      Reglas de negocio (validación ISO 6346, estados)
│       ├── models/        Consultas SQL parametrizadas
│       └── middleware/    Manejo de errores
├── database/
│   ├── scripts/       01 base de datos y usuario · 02 esquema
│   ├── seeders/       03 datos simulados
│   └── setup.ps1      Ejecuta todo con sqlcmd
└── docs/
```

## Puesta en marcha (Windows)

Requisitos: Node 20+, SQL Server 2022 con **TCP/IP** y **autenticación mixta** activados, `sqlcmd`.

```powershell
# 1. Variables de entorno
copy backend\.env.example backend\.env      # y ajusta DB_PASSWORD

# 2. Base de datos (crea BD, usuario, tablas y datos de prueba)
powershell -ExecutionPolicy Bypass -File database\setup.ps1

# 3. Backend
cd backend; npm install; npm run dev        # http://localhost:3000/api/health

# 4. Frontend (otra terminal)
cd frontend; npm install; npm run dev       # http://localhost:5173
```

## Modelo de datos

| Tabla | Contenido |
|---|---|
| Usuarios | Cuentas, rol (ADMIN, OPERADOR, CONSULTA), hash bcrypt |
| Puertos | Código UN/LOCODE y coordenadas |
| Embarcaciones | IMO, MMSI, naviera, capacidad TEU, estado |
| RutasMaritimas | Puerto origen → destino, distancia y duración |
| Contenedores | Número ISO 6346, tipo, puertos, barco actual, estado |
| Ubicaciones | Posiciones de cada barco (lat, lon, velocidad, rumbo) |
| HistorialMovimientos | Eventos del contenedor (carga, salida, arribo, aduana…) |

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado de la API y la base de datos |
| GET | `/api/contenedores?estado=&naviera=` | Listar contenedores |
| GET | `/api/contenedores/:numero` | Consultar un contenedor |
| POST | `/api/contenedores` | Registrar contenedor |
| PATCH | `/api/contenedores/:numero` | Editar contenedor |
| DELETE | `/api/contenedores/:numero` | Eliminar contenedor |
| GET | `/api/contenedores/:numero/historial` | Historial de movimientos |
| POST | `/api/contenedores/:numero/movimientos` | Registrar evento (actualiza el estado) |
| GET | `/api/embarcaciones` | Barcos con su última posición |
| GET | `/api/embarcaciones/:imo` | Detalle de un barco |
| GET | `/api/embarcaciones/:imo/ubicaciones?limite=` | Trayectoria reciente |
| GET | `/api/puertos` | Catálogo de puertos |

Ejemplo de alta:

```json
POST /api/contenedores
{
  "numeroContenedor": "MSCU7777771",
  "tipoContenedor": "40HC",
  "naviera": "MSC",
  "puertoOrigen": "CNSHA",
  "puertoDestino": "MXZLO",
  "embarcacionImo": "9800001"
}
```

El número se valida con el dígito de control ISO 6346; si es incorrecto, la API indica cuál debería ser.

## Estado

- [x] Fase 2 · Repositorio, React + Vite, Express, conexión a SQL Server
- [x] Fase 3 · Esquema de 7 tablas con relaciones, restricciones e índices
- [ ] Fase 4 · Autenticación JWT, módulos de rastreo
- [ ] Fase 5 · Dashboard, formularios y mapa con Leaflet
- [ ] Docker Compose
