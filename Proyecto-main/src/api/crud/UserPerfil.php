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

// Result set 1 — datos básicos
$perfil = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
if (!$perfil) {
    echo json_encode(["error" => "Usuario no encontrado"]);
    exit();
}

// Formatear fecha
if ($perfil["fecha_registro"] instanceof DateTime) {
    $perfil["fecha_registro"] = $perfil["fecha_registro"]->format("Y-m-d");
}

// Result set 2 — seguidores
sqlsrv_next_result($resultado);
$row = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
$perfil["total_seguidores"] = $row["total_seguidores"] ?? 0;

// Result set 3 — siguiendo
sqlsrv_next_result($resultado);
$row = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
$perfil["total_siguiendo"] = $row["total_siguiendo"] ?? 0;

// Result set 4 — publicaciones
sqlsrv_next_result($resultado);
$row = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
$perfil["total_publicaciones"] = $row["total_publicaciones"] ?? 0;

// Result set 5 — reputación
sqlsrv_next_result($resultado);
$row = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
$perfil["reputacion"]            = $row["reputacion"] ?? "N/A";
$perfil["total_calificaciones"]  = $row["total_calificaciones"] ?? 0;

echo json_encode($perfil);

sqlsrv_close($conexion);
?>