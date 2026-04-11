<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type");

include("../config/conexion.php"); // tu archivo de conexión

$method = $_SERVER["REQUEST_METHOD"];

switch($method){

/* =========================
   OBTENER SERVICIOS
========================= */
case "GET":

    if(isset($_GET["id_servicio"])){

        $id = $_GET["id_servicio"];

        $sql = "SELECT * FROM servicios WHERE id_servicio = ?";
        $stmt = sqlsrv_query($conexion, $sql, array($id));

        $data = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);

        echo json_encode($data);

    }else{

        $sql = "SELECT * FROM servicios";
        $stmt = sqlsrv_query($conexion, $sql);

        $servicios = [];

        while($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)){
            $servicios[] = $row;
        }

        echo json_encode($servicios);
    }

break;


/* =========================
   CREAR SERVICIO
========================= */
case "POST":

    $input = json_decode(file_get_contents("php://input"), true);

    $sql = "INSERT INTO servicios
    (id_proveedor, titulo, descripcion, id_categoria, precio_hora, contacto, modalidad, icono, disponibilidad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

    $params = array(
        $input["id_proveedor"],
        $input["titulo"],
        $input["descripcion"],
        $input["id_categoria"],
        $input["precio_hora"],
        $input["contacto"],
        $input["modalidad"],
        $input["icono"],
        $input["disponibilidad"]
    );

    $stmt = sqlsrv_query($conexion, $sql, $params);
    

    if($stmt){
    echo json_encode(["ok"=>true, "mensaje"=>"Servicio creado"]);
    }else{
    echo json_encode([
        "error"=>"Error al crear servicio",
        "sql_error"=> sqlsrv_errors()
    ]);
    }

break;


/* =========================
   ACTUALIZAR SERVICIO
========================= */
case "PUT":

    $input = json_decode(file_get_contents("php://input"), true);

    $sql = "UPDATE servicios SET
        titulo = ?,
        descripcion = ?,
        id_categoria = ?,
        precio_hora = ?,
        contacto = ?,
        modalidad = ?,
        icono = ?,
        disponibilidad = ?
        WHERE id_servicio = ?";

    $params = array(
        $input["titulo"],
        $input["descripcion"],
        $input["id_categoria"],
        $input["precio_hora"],
        $input["contacto"],
        $input["modalidad"],
        $input["icono"],
        $input["disponibilidad"],
        $input["id_servicio"]
    );

    $stmt = sqlsrv_query($conexion, $sql, $params);

    if($stmt){
        echo json_encode(["ok"=>true, "mensaje"=>"Servicio actualizado"]);
    }else{
        echo json_encode(["error"=>"Error al actualizar"]);
    }

break;


/* =========================
   ELIMINAR SERVICIO
========================= */
case "DELETE":

    $input = json_decode(file_get_contents("php://input"), true);

    $sql = "DELETE FROM servicios WHERE id_servicio = ?";

    $stmt = sqlsrv_query($conexion, $sql, array($input["id_servicio"]));

    if($stmt){
        echo json_encode(["ok"=>true, "mensaje"=>"Servicio eliminado"]);
    }else{
        echo json_encode(["error"=>"Error al eliminar"]);
    }

break;

}
?>