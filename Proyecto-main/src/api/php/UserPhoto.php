<?php
header('Content-Type: application/json');

$targetDir = "uploads/";
$targetFile = $targetDir . uniqid() . "_" . basename($_FILES["file"]["name"]);
$imageFileType = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));

// Validaciones
$allowed = ["jpg","jpeg","png","gif"];
if(!in_array($imageFileType, $allowed)) {
    echo json_encode(["success"=>false,"message"=>"Formato no permitido"]);
    exit;
}

if ($_FILES["file"]["size"] > 2000000) {
    echo json_encode(["success"=>false,"message"=>"Archivo demasiado grande"]);
    exit;
}

// Guardar archivo
if (move_uploaded_file($_FILES["file"]["tmp_name"], $targetFile)) {
    // Aquí deberías guardar $targetFile en la base de datos del usuario
    // UPDATE usuarios SET foto_perfil='$targetFile' WHERE id=...

    echo json_encode(["success"=>true,"url"=>$targetFile]);
} else {
    echo json_encode(["success"=>false,"message"=>"Error al mover archivo"]);
}
?>
