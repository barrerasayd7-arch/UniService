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
# 3. Crear los Procedimientos Almacenados de Actualización
echo "Ejecutando script de procedimientos..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Uniservicio58414555 -d UniService -i /docker-entrypoint-initdb.d/03_Procedure_Actualizar.sql -C

# 4. Crear los Procedimientos Almacenados de Leer
echo "Ejecutando script de procedimientos..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Uniservicio58414555 -d UniService -i /docker-entrypoint-initdb.d/04_Procedure_Leer.sql -C

# 5. Crear Triggers
echo "Ejecutando script de triggers..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Uniservicio58414555 -d UniService -i /docker-entrypoint-initdb.d/05_Triggers.sql -C

# 6. Insertar Datos de Prueba
echo "Ejecutando script de datos de prueba..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Uniservicio58414555 -d UniService -i /docker-entrypoint-initdb.d/06_Insertar.sql -C


echo "¡Base de datos UniService lista!"