<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

include "../config/conexion.php";

$method = $_SERVER["REQUEST_METHOD"];

// ===== REGISTRO o SUBIDA DE IMAGEN =====
if ($method === "POST") {

    // Si viene archivo → es subida de imagen (simulamos PUT con _method)
    if (!empty($_FILES["file"])) {
        $id_usuario = $_POST["id_usuario"] ?? null;
        if (!$id_usuario) { echo json_encode(["error" => "ID requerido"]); exit(); }

        $targetDir = "../../img/";

        $targetFile = $targetDir . uniqid() . "_" . basename($_FILES["file"]["name"]);
        $imageFileType = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));
        $allowed       = ["jpg", "jpeg", "png", "gif"];

        if (!in_array($imageFileType, $allowed)) {
            echo json_encode(["error" => "Formato no permitido"]); exit();
        }
        if ($_FILES["file"]["size"] > 2000000) {
            echo json_encode(["error" => "Archivo demasiado grande"]); exit();
        }

        if (move_uploaded_file($_FILES["file"]["tmp_name"], $targetFile)) {
            $rutaCompleta = "img/" . basename($targetFile);
            $query     = "EXEC sp_ActualizarUsuario @id_usuario=?, @avatar=?";
            $params    = [(int)$id_usuario, $rutaCompleta];
            $resultado = sqlsrv_query($conexion, $query, $params);

if ($resultado === false) {
    $errores = sqlsrv_errors();
    echo json_encode(["error" => $errores[0]["message"] ?? "Error al actualizar"]);
} else {
    echo json_encode(["ok" => true]);
}
        } else {
            echo json_encode(["error" => "Error al mover archivo"]);
        }

    } else {
        // Registro normal de usuario nuevo
        $datos         = json_decode(file_get_contents("php://input"), true);
        $telefono      = $datos["telefono"];
        $nombre        = $datos["nombre"];
        $password_hash = password_hash($datos["password"], PASSWORD_BCRYPT);
        $correo        = $datos["correo"] ?? null;
        $universidad   = $datos["universidad"] ?? 1;

    $query  = "EXEC sp_CrearUsuario @telefono=?, @password_hash=?, @nombre=?, @correo=?, @universidad=?";
    $params = [$telefono, $password_hash, $nombre, $correo, $universidad];

        $resultado = sqlsrv_query($conexion, $query, $params);

        if ($resultado === false) {
            $errores = sqlsrv_errors();
            echo json_encode(["error" => $errores[0]["message"] ?? "Error al crear usuario"]);
        } else {
            echo json_encode(["mensaje" => "Cuenta creada exitosamente"]);
        }
    }

// ===== LOGIN y GET PERFIL =====
} else if ($method === "GET") {

    if (isset($_GET["telefono"]) && isset($_GET["password"])) {
        $telefono  = $_GET["telefono"];
        $password  = $_GET["password"];

        $query     = "SELECT id_usuario, nombre, telefono, password_hash FROM usuarios WHERE telefono = ?";
        $params    = [$telefono];
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

    } else if (isset($_GET["id"])) {
        $id        = $_GET["id"];
        $query     = "SELECT nombre, telefono, correo, descripcion, avatar, fecha_registro, universidad FROM usuarios WHERE id_usuario = ?";
        $params    = [$id];
        $resultado = sqlsrv_query($conexion, $query, $params);

        if ($resultado === false) {
            echo json_encode(["error" => "Error en la consulta"]);
        } else {
            $usuario = sqlsrv_fetch_array($resultado, SQLSRV_FETCH_ASSOC);
            if ($usuario) {
                if ($usuario["fecha_registro"] instanceof DateTime) {
                    $usuario["fecha_registro"] = $usuario["fecha_registro"]->format("Y-m-d");
                }
                echo json_encode($usuario);
            } else {
                echo json_encode(["error" => "Usuario no encontrado"]);
            }
        }

    } else {
        echo json_encode(["error" => "Parámetros insuficientes"]);
    }

// ===== ACTUALIZAR USUARIO =====
} else if ($method === "PUT") {
    $datos = json_decode(file_get_contents("php://input"), true);

    $id_usuario  = $datos["id_usuario"]  ?? null;
    $telefono    = $datos["telefono"]    ?? null;
    $password    = $datos["password"]    ?? null;
    $nombre      = $datos["nombre"]      ?? null;
    $descripcion = $datos["descripcion"] ?? null;
    $correo      = $datos["correo"]      ?? null;
    $estado      = $datos["estado"]      ?? null;
    $universidad = $datos["universidad"] ?? null;
    $avatar      = $datos["avatar"]      ?? null;

    if (!$id_usuario) {
        echo json_encode(["error" => "ID de usuario requerido"]);
        exit();
    }

    $password_hash = $password ? password_hash($password, PASSWORD_BCRYPT) : null;

    $query  = "EXEC sp_ActualizarUsuario @id_usuario=?, @telefono=?, @password_hash=?, @nombre=?, @descripcion=?, @correo=?, @estado=?, @universidad=?, @avatar=?";
    $params = [
        (int)$id_usuario,
        $telefono,
        $password_hash,
        $nombre,
        $descripcion,
        $correo,
        $estado     !== null ? (int)$estado     : null,
        $universidad !== null ? (int)$universidad : null,
        $avatar
    ];

    $resultado = sqlsrv_query($conexion, $query, $params);

    if ($resultado === false) {
        $errores = sqlsrv_errors();
        echo json_encode(["error" => $errores[0]["message"] ?? "Error al actualizar"]);
    } else {
        echo json_encode(["ok" => true]);
    }
}

sqlsrv_close($conexion);
?>