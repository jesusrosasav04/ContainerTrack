/* =========================================================
   ContainerTrack - 03: Datos simulados (Nivel 1)
   Barcos ficticios; numeros de contenedor con digito de control ISO 6346 valido.
   ========================================================= */
SET NOCOUNT ON;
USE [$(DB_NAME)];
GO

INSERT INTO dbo.Puertos (Codigo, Nombre, Pais, Latitud, Longitud) VALUES
('MXZLO', N'Manzanillo',       N'México',         19.052400, -104.315800),
('MXLZC', N'Lázaro Cárdenas',  N'México',         17.939200, -102.183300),
('MXVER', N'Veracruz',         N'México',         19.207300,  -96.133400),
('USLAX', N'Los Ángeles',      N'Estados Unidos', 33.729300, -118.262000),
('CNSHA', N'Shanghái',         N'China',          31.230400,  121.473700),
('SGSIN', N'Singapur',         N'Singapur',        1.264000,  103.840000),
('NLRTM', N'Róterdam',         N'Países Bajos',   51.948900,    4.142400),
('PABLB', N'Balboa',           N'Panamá',          8.950000,  -79.566700);

INSERT INTO dbo.Embarcaciones (IMO, MMSI, Nombre, Bandera, Naviera, CapacidadTEU, Estado) VALUES
('9800001', '355000001', N'Pacific Aurora',  N'Panamá',  N'MSC',         14000, 'NAVEGANDO'),
('9800002', '219000002', N'Nordic Horizon',  N'Dinamarca', N'Maersk',    15500, 'NAVEGANDO'),
('9800003', '228000003', N'Atlantic Meridian', N'Francia', N'CMA CGM',   11000, 'EN_PUERTO'),
('9800004', '211000004', N'Hanse Pioneer',   N'Alemania', N'Hapag-Lloyd', 9000, 'FONDEADA');

INSERT INTO dbo.RutasMaritimas (Nombre, PuertoOrigenId, PuertoDestinoId, DistanciaMN, DuracionEstimadaDias)
SELECT r.Nombre, o.Id, d.Id, r.Distancia, r.Dias
FROM (VALUES
    (N'Transpacífico Asia - México', 'CNSHA', 'MXZLO', 6900, 18),
    (N'Asia Sudeste - Pacífico MX',  'SGSIN', 'MXLZC', 8600, 24),
    (N'Golfo de México - Europa',    'MXVER', 'NLRTM', 5100, 16),
    (N'Costa Pacífico Norte',        'MXZLO', 'USLAX', 1250,  4)
) AS r(Nombre, Origen, Destino, Distancia, Dias)
JOIN dbo.Puertos o ON o.Codigo = r.Origen
JOIN dbo.Puertos d ON d.Codigo = r.Destino;

INSERT INTO dbo.Contenedores (NumeroContenedor, TipoContenedor, Naviera, PuertoOrigenId, PuertoDestinoId, EmbarcacionId, Estado)
SELECT c.Numero, c.Tipo, c.Naviera, o.Id, d.Id, e.Id, c.Estado
FROM (VALUES
    ('MSCU1234566', '40HC', N'MSC',         'CNSHA', 'MXZLO', '9800001', 'EN_TRANSITO'),
    ('MSCU5566770', '20GP', N'MSC',         'CNSHA', 'MXZLO', '9800001', 'EN_TRANSITO'),
    ('MAEU7654320', '40GP', N'Maersk',      'SGSIN', 'MXLZC', '9800002', 'EN_TRANSITO'),
    ('MAEU1122335', '40RF', N'Maersk',      'SGSIN', 'MXLZC', '9800002', 'EN_TRANSITO'),
    ('CMAU4455661', '20GP', N'CMA CGM',     'MXVER', 'NLRTM', '9800003', 'EN_PUERTO'),
    ('HLXU9988779', '40HC', N'Hapag-Lloyd', 'MXZLO', 'USLAX', '9800004', 'EN_ADUANA'),
    ('ONEU3344557', '20RF', N'ONE',         'CNSHA', 'MXZLO', NULL,      'ENTREGADO'),
    ('TGHU8700116', '40GP', N'Triton',      'MXLZC', 'USLAX', NULL,      'REGISTRADO')
) AS c(Numero, Tipo, Naviera, Origen, Destino, IMO, Estado)
JOIN dbo.Puertos o ON o.Codigo = c.Origen
JOIN dbo.Puertos d ON d.Codigo = c.Destino
LEFT JOIN dbo.Embarcaciones e ON e.IMO = c.IMO;

-- Historial: cada contenedor arranca con REGISTRO en su puerto de origen
INSERT INTO dbo.HistorialMovimientos (ContenedorId, Evento, PuertoId, Descripcion, FechaEvento)
SELECT Id, 'REGISTRO', PuertoOrigenId, N'Contenedor registrado en el sistema', DATEADD(DAY, -20, SYSUTCDATETIME())
FROM dbo.Contenedores;

-- Carga y salida para los que van en un barco
INSERT INTO dbo.HistorialMovimientos (ContenedorId, Evento, PuertoId, EmbarcacionId, Descripcion, FechaEvento)
SELECT Id, 'CARGA', PuertoOrigenId, EmbarcacionId, N'Cargado a bordo', DATEADD(DAY, -12, SYSUTCDATETIME())
FROM dbo.Contenedores WHERE EmbarcacionId IS NOT NULL
UNION ALL
SELECT Id, 'SALIDA', PuertoOrigenId, EmbarcacionId, N'Zarpe del puerto de origen', DATEADD(DAY, -11, SYSUTCDATETIME())
FROM dbo.Contenedores WHERE EmbarcacionId IS NOT NULL AND Estado <> 'EN_PUERTO';

INSERT INTO dbo.HistorialMovimientos (ContenedorId, Evento, PuertoId, Descripcion, FechaEvento)
SELECT Id, 'ADUANA', PuertoDestinoId, N'En revisión aduanal', DATEADD(DAY, -1, SYSUTCDATETIME())
FROM dbo.Contenedores WHERE Estado = 'EN_ADUANA'
UNION ALL
SELECT Id, 'ENTREGA', PuertoDestinoId, N'Entregado al consignatario', DATEADD(DAY, -2, SYSUTCDATETIME())
FROM dbo.Contenedores WHERE Estado = 'ENTREGADO';

-- Posiciones simuladas de los barcos (las mas recientes al final)
INSERT INTO dbo.Ubicaciones (EmbarcacionId, Latitud, Longitud, VelocidadNudos, Rumbo, FechaRegistro)
SELECT e.Id, u.Lat, u.Lon, u.Vel, u.Rumbo, DATEADD(HOUR, -u.Horas, SYSUTCDATETIME())
FROM (VALUES
    ('9800001', 30.10,  140.20, 18.5,  95, 48),
    ('9800001', 27.40,  165.80, 19.0,  98, 24),
    ('9800001', 24.60, -170.30, 18.8, 100,  0),
    ('9800002',  8.20,  130.50, 17.2,  70, 48),
    ('9800002', 12.90,  155.10, 17.6,  72, 24),
    ('9800002', 15.30,  178.40, 17.9,  75,  0),
    ('9800003', 19.207300, -96.133400, 0.0, 0, 0),
    ('9800004', 33.650000, -118.300000, 0.3, 180, 0)
) AS u(IMO, Lat, Lon, Vel, Rumbo, Horas)
JOIN dbo.Embarcaciones e ON e.IMO = u.IMO;
GO

PRINT 'Datos simulados cargados.';
GO
