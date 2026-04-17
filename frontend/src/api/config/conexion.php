<?php
$servidor = "sqlserver,1433";
$baseDatos = "UniService";
$usuario = "sa";
$password = "Uniservicio58414555";

$conexion = sqlsrv_connect($servidor, [
    "Database" => $baseDatos,
    "UID"      => $usuario,
    "PWD"      => $password,
    "CharacterSet" => "UTF-8",
    "TrustServerCertificate" => true,
    "QuotedId" => true
]);

if (!$conexion) {
    $errores = sqlsrv_errors();
    die(json_encode([
        "error" => "No se pudo conectar a la base de datos",
        "detalle" => $errores
    ]));
}
?>