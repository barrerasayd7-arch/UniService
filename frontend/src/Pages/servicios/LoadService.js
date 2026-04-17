function renderServiciosRecientes() {

    const contenedor = document.getElementById("contenedor-tarjetas");
    contenedor.innerHTML = "";

    fetch("http://localhost/api/crud/Servicios_Crud.php")
        .then(res => res.json())
        .then(data => {

            // ordenar por fecha y tomar solo 6
            data.slice(0, 4).forEach(servicio => {

                const estrellasTexto = typeof calcularEstrellas === 'function'
                    ? calcularEstrellas(servicio.estrellas)
                    : "☆☆☆☆☆ (0)";

                const numReseñas = servicio.estrellas ? servicio.estrellas.length : 0;
                let descripcion = servicio.descripcion;
                if (descripcion.length > 70) {
                    descripcion = descripcion.substring(0, 70) + "...";
                }

                const tarjeta = `
                    <a href="Servicio.html?id=${servicio.id_servicio}" class="card-servicio card-3d">
                    <div class="card-icono card-icono-azul">${servicio.icono || "📌"}</div>
                    <div class="card-body-custom">

                        <span class="etiqueta et-azul">
                        ${servicio.nombre_categoria || "Categoría no especificada"}
                        </span>

                        <p class="card-meta">
                        ${servicio.universidad === 1
                        ? "Universidad Popular del Cesar"
                        : "Universidad no especificada"}
                        </p>

                        <h5>${servicio.titulo}</h5>

                        <p class="texto-muted">
                        ${descripcion}
                        </p>

                        <div class="card-autor">
                            <div class="avatar avatar-azul">👤</div>
                            <span class="texto-muted">
                            ${servicio.proveedor || "Proveedor anónimo"}
                            </span>
                        </div>

                        <div class="texto-fecha">
                        ${servicio.fecha_publicacion || ""}
                        </div>

                        <div class="card-footer">
                            <div>
                                <hr class="card-divider">
                                <div class="estrellas">${estrellasTexto}</div>
                                <div class="texto-muted">${numReseñas} reseñas</div>
                            </div>

                            <div class="precio">${servicio.precio_hora}$</div>
                        </div>

                    </div>
                    </a>
                `;

                contenedor.innerHTML += tarjeta;

            });

        })
        .catch(err => {
            console.error("Error cargando servicios:", err);
        });
}

window.addEventListener("load", renderServiciosRecientes);