ALTER TABLE solicitudes
ADD 
    tipo_servicio NVARCHAR(100),
    tema NVARCHAR(150),
    descripcion NVARCHAR(MAX),
    fecha_deseada DATE,
    hora_deseada TIME,
    duracion NVARCHAR(50),
    modalidad NVARCHAR(50),
    metodo_pago NVARCHAR(50),
    presupuesto DECIMAL(10,2),
    pago_anticipado BIT DEFAULT 0,
    urgencia NVARCHAR(20),
    archivo NVARCHAR(255),
    estado NVARCHAR(20) DEFAULT 'Pendiente',
    motivo_rechazo NVARCHAR(MAX),
    contraoferta DECIMAL(10,2);
GO
