<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

include "../config/conexion.php";

$method = $_SERVER["REQUEST_METHOD"];

// ===== REGISTRO =====
if ($method === "POST") {
    $datos    = json_decode(file_get_contents("php://input"), true);
    $telefono      = $datos["telefono"];
    $nombre        = $datos["nombre"];
    $password_hash = password_hash($datos["password"], PASSWORD_BCRYPT);
    $correo        = isset($datos["correo"]) ? $datos["correo"] : null;
    $universidad   = isset($datos["universidad"]) ? $datos["universidad"] : 1;

    $query  = "EXEC sp_CrearUsuario @telefono=?, @password_hash=?, @nombre=?, @correo=?, @universidad=?";
    $params = [$telefono, $password_hash, $nombre, $correo, $universidad];

    $resultado = sqlsrv_query($conexion, $query, $params);

    if ($resultado === false) {
        $errores = sqlsrv_errors();
        $mensaje = $errores[0]["message"] ?? "Error al crear el usuario";
        echo json_encode(["error" => $mensaje]);
    } else {
        echo json_encode(["mensaje" => "Cuenta creada exitosamente"]);
    }

// ===== LOGIN =====
} else if ($method === "GET") {
    $telefono = $_GET["telefono"] ?? "";
    $password = $_GET["password"] ?? "";

    if (!$telefono || !$password) {
        echo json_encode(["error" => "Datos incompletos"]);
        exit();
    }

    $query  = "SELECT id_usuario, nombre, telefono, password_hash FROM usuarios WHERE telefono = ?";
    $params = [$telefono];
    $resultado = sqlsrv_query($conexion, $query, $params);

    if ($resultado === false) {
        echo json_encode(["error" => "Error en la consulta"]);
    } else {
        $usuario = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
        if ($usuario && password_verify($password, $usuario["password_hash"])) {
            echo json_encode([
                "ok"       => true,
                "id"       => $usuario["id_usuario"],
                "nombre"   => $usuario["nombre"],
                "telefono" => $usuario["telefono"]
            ]);
        } else {
            echo json_encode(["ok" => false]);
        }
    }
}

sqlsrv_close($conexion);
?>