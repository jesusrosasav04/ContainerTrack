/* =========================================================
   ContainerTrack - 02: Esquema
   ATENCION: recrea las tablas (borra los datos). Uso en desarrollo.
   ========================================================= */
SET NOCOUNT ON;
USE [$(DB_NAME)];
GO

-- Borrado en orden inverso a las dependencias
DROP TABLE IF EXISTS dbo.HistorialMovimientos;
DROP TABLE IF EXISTS dbo.Ubicaciones;
DROP TABLE IF EXISTS dbo.Contenedores;
DROP TABLE IF EXISTS dbo.RutasMaritimas;
DROP TABLE IF EXISTS dbo.Embarcaciones;
DROP TABLE IF EXISTS dbo.Puertos;
DROP TABLE IF EXISTS dbo.Usuarios;
GO

/* ---------- Usuarios ---------- */
CREATE TABLE dbo.Usuarios (
    Id             INT IDENTITY(1,1) CONSTRAINT PK_Usuarios PRIMARY KEY,
    Nombre         NVARCHAR(100) NOT NULL,
    Email          NVARCHAR(150) NOT NULL CONSTRAINT UQ_Usuarios_Email UNIQUE,
    PasswordHash   NVARCHAR(100) NOT NULL,              -- hash bcrypt, nunca la contrasena
    Rol            VARCHAR(20)   NOT NULL CONSTRAINT DF_Usuarios_Rol DEFAULT 'CONSULTA'
                   CONSTRAINT CK_Usuarios_Rol CHECK (Rol IN ('ADMIN','OPERADOR','CONSULTA')),
    Activo         BIT           NOT NULL CONSTRAINT DF_Usuarios_Activo DEFAULT 1,
    FechaRegistro  DATETIME2(0)  NOT NULL CONSTRAINT DF_Usuarios_Fecha DEFAULT SYSUTCDATETIME()
);

/* ---------- Puertos (codigo UN/LOCODE) ---------- */
CREATE TABLE dbo.Puertos (
    Id        INT IDENTITY(1,1) CONSTRAINT PK_Puertos PRIMARY KEY,
    Codigo    CHAR(5)       NOT NULL CONSTRAINT UQ_Puertos_Codigo UNIQUE,
    Nombre    NVARCHAR(100) NOT NULL,
    Pais      NVARCHAR(60)  NOT NULL,
    Latitud   DECIMAL(9,6)  NOT NULL CONSTRAINT CK_Puertos_Lat CHECK (Latitud  BETWEEN -90  AND 90),
    Longitud  DECIMAL(9,6)  NOT NULL CONSTRAINT CK_Puertos_Lon CHECK (Longitud BETWEEN -180 AND 180)
);

/* ---------- Embarcaciones (IMO de 7 digitos) ---------- */
CREATE TABLE dbo.Embarcaciones (
    Id                   INT IDENTITY(1,1) CONSTRAINT PK_Embarcaciones PRIMARY KEY,
    IMO                  CHAR(7)       NOT NULL CONSTRAINT UQ_Embarcaciones_IMO UNIQUE
                         CONSTRAINT CK_Embarcaciones_IMO CHECK (IMO NOT LIKE '%[^0-9]%'),
    MMSI                 CHAR(9)       NULL,
    Nombre               NVARCHAR(100) NOT NULL,
    Bandera              NVARCHAR(60)  NULL,
    Naviera              NVARCHAR(100) NOT NULL,
    CapacidadTEU         INT           NULL CONSTRAINT CK_Embarcaciones_TEU CHECK (CapacidadTEU > 0),
    Estado               VARCHAR(20)   NOT NULL CONSTRAINT DF_Embarcaciones_Estado DEFAULT 'EN_PUERTO'
                         CONSTRAINT CK_Embarcaciones_Estado CHECK (Estado IN ('NAVEGANDO','EN_PUERTO','FONDEADA')),
    FechaRegistro        DATETIME2(0)  NOT NULL CONSTRAINT DF_Embarcaciones_Fecha DEFAULT SYSUTCDATETIME()
);

/* ---------- Rutas maritimas ---------- */
CREATE TABLE dbo.RutasMaritimas (
    Id                    INT IDENTITY(1,1) CONSTRAINT PK_RutasMaritimas PRIMARY KEY,
    Nombre                NVARCHAR(100) NOT NULL,
    PuertoOrigenId        INT NOT NULL CONSTRAINT FK_Rutas_Origen  REFERENCES dbo.Puertos(Id),
    PuertoDestinoId       INT NOT NULL CONSTRAINT FK_Rutas_Destino REFERENCES dbo.Puertos(Id),
    DistanciaMN           INT NULL,     -- millas nauticas
    DuracionEstimadaDias  INT NULL,
    CONSTRAINT CK_Rutas_Puertos CHECK (PuertoOrigenId <> PuertoDestinoId)
);

/* ---------- Contenedores (ISO 6346: 4 letras + 7 digitos) ---------- */
CREATE TABLE dbo.Contenedores (
    Id                INT IDENTITY(1,1) CONSTRAINT PK_Contenedores PRIMARY KEY,
    NumeroContenedor  CHAR(11)      NOT NULL CONSTRAINT UQ_Contenedores_Numero UNIQUE
                      CONSTRAINT CK_Contenedores_Numero CHECK (NumeroContenedor LIKE '[A-Z][A-Z][A-Z][UJZ][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    TipoContenedor    VARCHAR(4)    NOT NULL
                      CONSTRAINT CK_Contenedores_Tipo CHECK (TipoContenedor IN ('20GP','40GP','40HC','20RF','40RF')),
    Naviera           NVARCHAR(100) NOT NULL,
    PuertoOrigenId    INT NOT NULL CONSTRAINT FK_Contenedores_Origen  REFERENCES dbo.Puertos(Id),
    PuertoDestinoId   INT NOT NULL CONSTRAINT FK_Contenedores_Destino REFERENCES dbo.Puertos(Id),
    EmbarcacionId     INT NULL     CONSTRAINT FK_Contenedores_Embarcacion REFERENCES dbo.Embarcaciones(Id),
    Estado            VARCHAR(20)   NOT NULL CONSTRAINT DF_Contenedores_Estado DEFAULT 'REGISTRADO'
                      CONSTRAINT CK_Contenedores_Estado CHECK (Estado IN ('REGISTRADO','EN_PUERTO','EN_TRANSITO','EN_ADUANA','ENTREGADO')),
    FechaRegistro     DATETIME2(0)  NOT NULL CONSTRAINT DF_Contenedores_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Contenedores_Puertos CHECK (PuertoOrigenId <> PuertoDestinoId)
);

/* ---------- Ubicaciones de embarcaciones (posiciones tipo AIS) ---------- */
CREATE TABLE dbo.Ubicaciones (
    Id             BIGINT IDENTITY(1,1) CONSTRAINT PK_Ubicaciones PRIMARY KEY,
    EmbarcacionId  INT          NOT NULL CONSTRAINT FK_Ubicaciones_Embarcacion REFERENCES dbo.Embarcaciones(Id) ON DELETE CASCADE,
    Latitud        DECIMAL(9,6) NOT NULL CONSTRAINT CK_Ubicaciones_Lat CHECK (Latitud  BETWEEN -90  AND 90),
    Longitud       DECIMAL(9,6) NOT NULL CONSTRAINT CK_Ubicaciones_Lon CHECK (Longitud BETWEEN -180 AND 180),
    VelocidadNudos DECIMAL(5,2) NULL,
    Rumbo          SMALLINT     NULL CONSTRAINT CK_Ubicaciones_Rumbo CHECK (Rumbo BETWEEN 0 AND 359),
    FechaRegistro  DATETIME2(0) NOT NULL CONSTRAINT DF_Ubicaciones_Fecha DEFAULT SYSUTCDATETIME()
);

/* ---------- Historial de movimientos de contenedores ---------- */
CREATE TABLE dbo.HistorialMovimientos (
    Id             BIGINT IDENTITY(1,1) CONSTRAINT PK_HistorialMovimientos PRIMARY KEY,
    ContenedorId   INT           NOT NULL CONSTRAINT FK_Historial_Contenedor  REFERENCES dbo.Contenedores(Id) ON DELETE CASCADE,
    Evento         VARCHAR(30)   NOT NULL
                   CONSTRAINT CK_Historial_Evento CHECK (Evento IN ('REGISTRO','CARGA','SALIDA','ARRIBO','DESCARGA','ADUANA','ENTREGA')),
    PuertoId       INT           NULL CONSTRAINT FK_Historial_Puerto      REFERENCES dbo.Puertos(Id),
    EmbarcacionId  INT           NULL CONSTRAINT FK_Historial_Embarcacion REFERENCES dbo.Embarcaciones(Id),
    Descripcion    NVARCHAR(250) NULL,
    FechaEvento    DATETIME2(0)  NOT NULL CONSTRAINT DF_Historial_Fecha DEFAULT SYSUTCDATETIME()
);
GO

/* ---------- Indices para las consultas frecuentes ---------- */
CREATE INDEX IX_Contenedores_Estado      ON dbo.Contenedores (Estado);
CREATE INDEX IX_Contenedores_Embarcacion ON dbo.Contenedores (EmbarcacionId);
CREATE INDEX IX_Historial_Contenedor     ON dbo.HistorialMovimientos (ContenedorId, FechaEvento DESC);
CREATE INDEX IX_Ubicaciones_Embarcacion  ON dbo.Ubicaciones (EmbarcacionId, FechaRegistro DESC);
GO

PRINT 'Esquema creado: 7 tablas.';
GO
