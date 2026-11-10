#!/bin/bash
# Inicializa la base de datos en Docker. Idempotente:
#  - Primera vez: crea BD, usuario, tablas y datos simulados.
#  - Siguientes: solo asegura usuario/contrasena y aplica migraciones. Nunca borra datos.
set -euo pipefail

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
[ -x "$SQLCMD" ] || SQLCMD=/opt/mssql-tools/bin/sqlcmd

run() {
  "$SQLCMD" -S db -U sa -P "$SA_PASSWORD" -C -b -f 65001 \
    -v DB_NAME="$DB_NAME" APP_USER="$DB_USER" APP_PASSWORD="$DB_PASSWORD" "$@"
}

echo "==> Base de datos y usuario de la API"
run -i /scripts/scripts/01_create_database.sql

EXISTE=$(run -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN OBJECT_ID('[$DB_NAME].dbo.Contenedores') IS NULL THEN 0 ELSE 1 END" | tr -d '[:space:]')

if [ "$EXISTE" = "0" ]; then
  echo "==> Primera instalacion: esquema y datos simulados"
  run -i /scripts/scripts/02_schema.sql
  run -i /scripts/migrations/05_sesion_version.sql
  run -i /scripts/seeders/03_seed.sql
  run -i /scripts/seeders/04_historico.sql
else
  echo "==> La base de datos ya existe: solo migraciones"
  run -i /scripts/migrations/05_sesion_version.sql
fi

echo "==> Base de datos lista"
