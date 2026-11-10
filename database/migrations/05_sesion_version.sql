/* =========================================================
   ContainerTrack - 05: Version de sesion por usuario
   Al cambiar o restablecer una contrasena, o desactivar una cuenta, la version
   aumenta y todas las sesiones abiertas de ese usuario dejan de ser validas.
   Idempotente: si la columna ya existe, no hace nada. No borra datos.
   ========================================================= */
SET NOCOUNT ON;
USE [$(DB_NAME)];
GO

IF COL_LENGTH('dbo.Usuarios', 'SesionVersion') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios ADD SesionVersion INT NOT NULL
        CONSTRAINT DF_Usuarios_SesionVersion DEFAULT 0 WITH VALUES;
    PRINT 'Columna Usuarios.SesionVersion agregada.';
END
ELSE
    PRINT 'Usuarios.SesionVersion ya existia.';
GO
