#!/bin/bash

# Esperar a que SQL Server termine de arrancar
echo "Esperando a que SQL Server inicie..."
sleep 30s

# 1. Crear la Base de Datos y las Tablas
# Nota: Usamos la ruta tools18 y el parámetro -C
echo "Ejecutando script de tablas..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Uniservicio58414555 -d master -i /docker-entrypoint-initdb.d/01_Create_Tables.sql -C

# 2. Crear los Procedimientos Almacenados
echo "Ejecutando script de procedimientos..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Uniservicio58414555 -d UniService -i /docker-entrypoint-initdb.d/02_Procedures_Create.sql -C

echo "¡Base de datos UniService lista!"