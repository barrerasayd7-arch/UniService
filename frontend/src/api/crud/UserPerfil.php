<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

include "../config/conexion.php";

$id_usuario = $_GET["id"] ?? null;

if (!$id_usuario) {
    echo json_encode(["error" => "ID de usuario requerido"]);
    exit();
}

$query     = "EXEC sp_ObtenerPerfilCompleto @id_usuario=?";
$params    = [(int)$id_usuario];
$resultado = sqlsrv_query($conexion, $query, $params);

if ($resultado === false) {
    $errores = sqlsrv_errors();
    echo json_encode(["error" => $errores[0]["message"] ?? "Error al obtener perfil"]);
    exit();
}

// Obtener los datos — todo viene en un solo result set
$perfil = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
if (!$perfil) {
    echo json_encode(["error" => "Usuario no encontrado"]);
    exit();
}

// Formatear fecha
if ($perfil["fecha_registro"] instanceof DateTime) {
    $perfil["fecha_registro"] = $perfil["fecha_registro"]->format("Y-m-d");
}

echo json_encode($perfil);

sqlsrv_close($conexion);
?>