# Prueba HTTP sin Supabase, Brevo ni credenciales reales. Ejecutar desde la raíz del workspace.
$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$apiDll = Join-Path $workspacePath 'UniserviceAPI/UniserviceAPI/bin/Debug/net8.0/UniserviceAPI.dll'
$scratchPath = Join-Path ([IO.Path]::GetTempPath()) ('uniservice-otp-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratchPath | Out-Null
$apiProcess = $null
$environmentBefore = @{}
foreach ($keyName in @('Jwt__Key', 'InstitutionalEmail__CodeKey', 'Brevo__ApiKey', 'ASPNETCORE_ENVIRONMENT')) {
    $environmentBefore[$keyName] = [Environment]::GetEnvironmentVariable($keyName)
}
try {
    # Valores efímeros y exclusivamente locales; impedir envío de correos reales.
    [Environment]::SetEnvironmentVariable('Jwt__Key', [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))
    [Environment]::SetEnvironmentVariable('InstitutionalEmail__CodeKey', 'test-not-configured')
    [Environment]::SetEnvironmentVariable('Brevo__ApiKey', 'test-not-configured')
    [Environment]::SetEnvironmentVariable('ASPNETCORE_ENVIRONMENT', 'Development')
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $portNumber = $listener.LocalEndpoint.Port
    $listener.Stop()
    $baseUrl = 'http://127.0.0.1:' + $portNumber
    $apiProcess = Start-Process -FilePath 'dotnet' -ArgumentList @($apiDll, '--urls', $baseUrl) -WorkingDirectory $scratchPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $scratchPath 'stdout.log') -RedirectStandardError (Join-Path $scratchPath 'stderr.log')
    Add-Type -AssemblyName System.Net.Http
    $httpClient = [Net.Http.HttpClient]::new()
    $httpClient.Timeout = [TimeSpan]::FromSeconds(5)
    $ready = $false
    for ($readyAttempt = 0; $readyAttempt -lt 30; $readyAttempt++) {
        try {
            $response = $httpClient.GetAsync($baseUrl + '/swagger/v1/swagger.json').GetAwaiter().GetResult()
            if ($response.IsSuccessStatusCode) { $ready = $true; $response.Dispose(); break }
            $response.Dispose()
        } catch { }
        if ($apiProcess.HasExited) { throw 'La API terminó antes de arrancar' }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'La API no arrancó' }
    $script:checks = 0
    function Test-Post([string]$endpoint, [string]$body, [int]$expectedStatus) {
        $content = [Net.Http.StringContent]::new($body, [Text.Encoding]::UTF8, 'application/json')
        try {
            $response = $httpClient.PostAsync($baseUrl + $endpoint, $content).GetAwaiter().GetResult()
            try {
                if ([int]$response.StatusCode -ne $expectedStatus) { throw "HTTP $([int]$response.StatusCode), se esperaba $expectedStatus en $endpoint" }
                $script:checks++
            } finally { $response.Dispose() }
        } finally { $content.Dispose() }
    }
    $sendRoute = '/api/auth/institutional-email/send-code'
    $verifyRoute = '/api/auth/institutional-email/verify-code'
    Test-Post $sendRoute '{"correo":"user@example.com"}' 400
    Test-Post $sendRoute '{"correo":"user@unicesar.edu.co.evil.test"}' 400
    Test-Post $sendRoute '{"correo":""}' 400
    Test-Post $sendRoute '{"correo":" USER@UNICESAR.EDU.CO "}' 503
    Test-Post $verifyRoute '{"correo":"user@unicesar.edu.co","codigo":"123"}' 400
    Test-Post $verifyRoute '{"correo":"user@unicesar.edu.co","codigo":"123456"}' 503
    # Agotar el límite sin consultar DB ni enviar correo.
    for ($requestNumber = 6; $requestNumber -lt 20; $requestNumber++) {
        Test-Post $sendRoute '{"correo":"user@example.com"}' 400
    }
    Test-Post $sendRoute '{"correo":"user@example.com"}' 429
    Write-Output "PASS: $script:checks comprobaciones HTTP; sin DB ni envío real."
    $httpClient.Dispose()
} finally {
    if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id }
    foreach ($keyName in $environmentBefore.Keys) { [Environment]::SetEnvironmentVariable($keyName, $environmentBefore[$keyName]) }
    # Los logs temporales quedan disponibles para diagnosticar fallos.
}
