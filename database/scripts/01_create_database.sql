/* =========================================================
   ContainerTrack - 01: Base de datos, login y usuario
   Se ejecuta con sqlcmd (ver database/setup.ps1).
   Variables: $(DB_NAME), $(APP_USER), $(APP_PASSWORD)
   ========================================================= */
SET NOCOUNT ON;

IF CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS INT) = 1
    PRINT 'AVISO: SQL Server solo acepta autenticacion de Windows. Activa el modo mixto (SSMS > Properties > Security) y reinicia el servicio, o la API no podra conectarse.';
GO

IF DB_ID(N'$(DB_NAME)') IS NULL
BEGIN
    CREATE DATABASE [$(DB_NAME)];
    PRINT 'Base de datos $(DB_NAME) creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(APP_USER)')
BEGIN
    CREATE LOGIN [$(APP_USER)] WITH PASSWORD = N'$(APP_PASSWORD)', CHECK_POLICY = ON;
    PRINT 'Login $(APP_USER) creado.';
END
ELSE
    ALTER LOGIN [$(APP_USER)] WITH PASSWORD = N'$(APP_PASSWORD)';
GO

USE [$(DB_NAME)];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(APP_USER)')
    CREATE USER [$(APP_USER)] FOR LOGIN [$(APP_USER)];
GO

-- Permisos minimos para la API: leer y escribir datos, sin modificar el esquema.
ALTER ROLE db_datareader ADD MEMBER [$(APP_USER)];
ALTER ROLE db_datawriter ADD MEMBER [$(APP_USER)];
GO
