FROM php:8.3-apache

# Instalar dependencias
RUN apt-get update && apt-get install -y \
    curl apt-transport-https gnupg2 lsb-release

# Agregar repositorio de Microsoft (método moderno sin apt-key)
RUN curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
    | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg \
    && curl -sSL https://packages.microsoft.com/config/debian/12/prod.list \
    > /etc/apt/sources.list.d/mssql-release.list

# Instalar ODBC driver
RUN apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev

# Instalar extensiones PHP para SQL Server
RUN pecl install sqlsrv pdo_sqlsrv \
    && docker-php-ext-enable sqlsrv pdo_sqlsrv

RUN a2enmod rewrite