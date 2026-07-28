<#
.SYNOPSIS
    Crea (idempotente) las columnas de las listas del Check List Equipo de Torre.

.DESCRIPTION
    POWWO001-A2-1 REV2.

    IMPORTANTE — lo que este script NO hace (y no puede hacer):
      * NO crea las listas. Muchos tenants bloquean POST /_api/web/lists con HTTP 400
        por policy. Creá las dos listas a mano desde la UI antes de correr esto:
          https://tackersrl505.sharepoint.com/sites/TODOTACKER480/Lists/Check%20List%20Equipo%20de%20Torre/AllItems.aspx?npsAction=createList
          https://tackersrl505.sharepoint.com/sites/TODOTACKER480/Lists/CheckListEquipodeTorre%20Items/AllItems.aspx?npsAction=createList
      * NO crea la columna Lookup `Inspeccion`. SP.FieldLookup por REST devuelve 400
        en la mayoría de los tenants. Se crea a mano en la lista HIJA (ver el final).

    Autenticación: device code flow v1 contra el cliente first-party pre-consentido
    de SharePoint Online Management Shell (no requiere aprobación de admin).
    El refresh_token se cachea protegido con DPAPI en %LOCALAPPDATA%.

.NOTES
    Este archivo DEBE guardarse como UTF-8 CON BOM. PowerShell 5.1 lee .ps1 como ANSI
    si no hay BOM y rompe en las líneas con acentos ("Falta la cadena en el terminador").
#>

[CmdletBinding()]
param(
    [string] $Hostname   = "tackersrl505.sharepoint.com",
    [string] $SitePath   = "/sites/TODOTACKER480",
    # Slugs de URL de las listas (lo que se ve en la barra de direcciones).
    [string] $HeaderSlug = "Check List Equipo de Torre",
    [string] $ChildSlug  = "CheckListEquipodeTorre Items"
)

$ErrorActionPreference = "Stop"

$ClientId  = "9bc3ab49-b65d-410a-85ad-de819febfddc"  # SharePoint Online Management Shell
$Resource  = "https://$Hostname"
$ApiSP     = "$Resource$SitePath/_api"
$TokenFile = Join-Path $env:LOCALAPPDATA "tacker-sp-eqtorre.rt"

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

function Save-RefreshToken {
    param([string] $Token)
    try {
        Add-Type -AssemblyName System.Security
        $bytes     = [System.Text.Encoding]::UTF8.GetBytes($Token)
        $protected = [System.Security.Cryptography.ProtectedData]::Protect(
            $bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        [System.IO.File]::WriteAllBytes($TokenFile, $protected)
    } catch {
        Write-Warning "No se pudo cachear el refresh token: $($_.Exception.Message)"
    }
}

function Read-RefreshToken {
    if (-not (Test-Path $TokenFile)) { return $null }
    try {
        Add-Type -AssemblyName System.Security
        $protected = [System.IO.File]::ReadAllBytes($TokenFile)
        $bytes     = [System.Security.Cryptography.ProtectedData]::Unprotect(
            $protected, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {
        return $null
    }
}

function Get-AccessToken {
    # 1) Intento silencioso con el refresh token cacheado.
    $rt = Read-RefreshToken
    if ($rt) {
        try {
            $body = "grant_type=refresh_token&client_id=$ClientId&refresh_token=$rt&resource=$([uri]::EscapeDataString($Resource))"
            $tok  = Invoke-RestMethod -Method POST `
                -Uri "https://login.microsoftonline.com/common/oauth2/token" `
                -ContentType "application/x-www-form-urlencoded" -Body $body
            if ($tok.refresh_token) { Save-RefreshToken $tok.refresh_token }
            Write-Host "Token renovado en silencio." -ForegroundColor DarkGray
            return $tok.access_token
        } catch {
            Write-Host "El refresh token cacheado no sirve, pido device code." -ForegroundColor DarkYellow
        }
    }

    # 2) Device code flow. Requiere un humano — no se puede automatizar.
    $dc = Invoke-RestMethod -Method POST `
        -Uri "https://login.microsoftonline.com/common/oauth2/devicecode" `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "client_id=$ClientId&resource=$([uri]::EscapeDataString($Resource))"

    Write-Host ""
    Write-Host "  ABRÍ ESTA URL:  https://microsoft.com/devicelogin" -ForegroundColor Cyan
    Write-Host "  CÓDIGO:         $($dc.user_code)"                  -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Esperando autenticación (hasta 15 minutos)..." -ForegroundColor DarkGray

    $deadline = (Get-Date).AddMinutes(15)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        try {
            $tok = Invoke-RestMethod -Method POST `
                -Uri "https://login.microsoftonline.com/common/oauth2/token" `
                -ContentType "application/x-www-form-urlencoded" `
                -Body "grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=$ClientId&code=$($dc.device_code)"
            if ($tok.refresh_token) { Save-RefreshToken $tok.refresh_token }
            Write-Host "Autenticado." -ForegroundColor Green
            return $tok.access_token
        } catch {
            $msg = $_.ErrorDetails.Message
            if ($msg -notmatch "authorization_pending" -and $msg -notmatch "slow_down") { throw }
        }
    }
    throw "Se agotó el tiempo de espera del device code."
}

$script:Token = Get-AccessToken

function Get-AuthHeaders {
    return @{
        Authorization = "Bearer $($script:Token)"
        Accept        = "application/json;odata=verbose"
    }
}

# Reintento que re-tokeniza ante 401: SPO devuelve 401 transitorio justo después
# de emitir un token nuevo.
function Invoke-SP {
    param(
        [string] $Method = "GET",
        [Parameter(Mandatory = $true)][string] $Uri,
        [object] $Body,
        [hashtable] $ExtraHeaders
    )
    for ($intento = 1; $intento -le 3; $intento++) {
        try {
            $h = Get-AuthHeaders
            if ($ExtraHeaders) { foreach ($k in $ExtraHeaders.Keys) { $h[$k] = $ExtraHeaders[$k] } }
            if ($null -ne $Body) {
                # SIEMPRE bytes UTF-8: Invoke-RestMethod manda strings como ISO-8859-1 y
                # SharePoint rechaza con 400 "Unable to translate bytes [F3]..." ante acentos.
                $h["Content-Type"] = "application/json;odata=verbose;charset=utf-8"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
                return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $h -Body $bytes
            }
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $h
        } catch {
            $code = $null
            try { $code = [int]$_.Exception.Response.StatusCode } catch { }
            if ($code -eq 401 -and $intento -lt 3) {
                Start-Sleep -Milliseconds 800
                $script:Token = Get-AccessToken
                continue
            }
            if (($code -eq 429 -or $code -eq 503) -and $intento -lt 3) {
                Start-Sleep -Seconds 3
                continue
            }
            throw
        }
    }
}

# ---------------------------------------------------------------------------
# Resolución de listas (por URL server-relative, no por Title)
# ---------------------------------------------------------------------------

function Resolve-List {
    param([string] $Slug)
    $rel = "$SitePath/Lists/$Slug"
    $enc = [uri]::EscapeDataString($rel)
    try {
        $r = Invoke-SP -Uri "$ApiSP/web/GetList('$enc')?`$select=Id,Title,ItemCount"
        return [pscustomobject]@{
            Id    = $r.d.Id
            Title = $r.d.Title
            Rel   = $rel
        }
    } catch {
        Write-Host ""
        Write-Host "No se encontró la lista en $rel" -ForegroundColor Red
        Write-Host "Listas visibles en el sitio:" -ForegroundColor Yellow
        $todas = Invoke-SP -Uri "$ApiSP/web/lists?`$select=Title,Id&`$filter=Hidden eq false"
        $todas.d.results | ForEach-Object { Write-Host "  - $($_.Title)" }
        throw
    }
}

function Get-ListApi {
    param([string] $ListId)
    return "$ApiSP/web/lists(guid'$ListId')"
}

# ---------------------------------------------------------------------------
# Columnas
# ---------------------------------------------------------------------------

function Test-FieldExists {
    param([string] $ListId, [string] $Name)
    try {
        Invoke-SP -Uri "$(Get-ListApi $ListId)/fields/getbyinternalnameortitle('$Name')" | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Add-ToDefaultView {
    param([string] $ListId, [string] $Name)
    try {
        $uri = "$(Get-ListApi $ListId)/DefaultView/ViewFields/addviewfield('$Name')"
        Invoke-SP -Method POST -Uri $uri -Body "{}" | Out-Null
    } catch {
        # No es crítico: la columna existe igual, sólo no queda en la vista por defecto.
    }
}

<#
  Crea una columna si no existe.
  -Name  : InternalName. SIEMPRE ASCII y sin colisionar con columnas ocultas
           de SharePoint (Categoria, Author, Editor, ContentType...).
  -Title : nombre visible. Acá sí van los acentos.
#>
function Ensure-Field {
    param(
        [Parameter(Mandatory = $true)][string] $ListId,
        [Parameter(Mandatory = $true)][string] $Name,
        [Parameter(Mandatory = $true)][string] $Title,
        [Parameter(Mandatory = $true)][ValidateSet("Text", "Note", "DateOnly", "DateTime", "Number", "Boolean", "Choice")]
        [string] $Type,
        [string[]] $Choices,
        [switch] $NoView
    )

    if (Test-FieldExists -ListId $ListId -Name $Name) {
        Write-Host ("  = {0,-24} ya existe" -f $Name) -ForegroundColor DarkGray
        if (-not $NoView) { Add-ToDefaultView -ListId $ListId -Name $Name }
        return
    }

    # SharePoint deriva el InternalName del Title en el momento de crear la columna.
    # Por eso se crea con Title = $Name (ASCII, sin acentos) y RECIÉN DESPUÉS se
    # renombra el Title al nombre visible. Si se creara directo con acentos, el
    # InternalName quedaría como 'Fundaci_x00f3_n' y el flow no lo encontraría.
    switch ($Type) {
        "Text"     { $meta = @{ "__metadata" = @{ type = "SP.FieldText" };          FieldTypeKind = 2; Title = $Name; MaxLength = 255 } }
        "Note"     { $meta = @{ "__metadata" = @{ type = "SP.FieldMultiLineText" }; FieldTypeKind = 3; Title = $Name; NumberOfLines = 6; RichText = $false; AppendOnly = $false } }
        "DateOnly" { $meta = @{ "__metadata" = @{ type = "SP.FieldDateTime" };      FieldTypeKind = 4; Title = $Name; DisplayFormat = 0 } }
        "DateTime" { $meta = @{ "__metadata" = @{ type = "SP.FieldDateTime" };      FieldTypeKind = 4; Title = $Name; DisplayFormat = 1 } }
        "Number"   { $meta = @{ "__metadata" = @{ type = "SP.FieldNumber" };        FieldTypeKind = 9; Title = $Name } }
        "Boolean"  { $meta = @{ "__metadata" = @{ type = "SP.Field" };              FieldTypeKind = 8; Title = $Name } }
        "Choice"   {
            $meta = @{
                "__metadata"   = @{ type = "SP.FieldChoice" }
                FieldTypeKind  = 6
                Title          = $Name
                Choices        = @{ "__metadata" = @{ type = "Collection(Edm.String)" }; results = $Choices }
                EditFormat     = 0
                FillInChoice   = $false
            }
        }
    }

    $json = $meta | ConvertTo-Json -Depth 8 -Compress
    try {
        Invoke-SP -Method POST -Uri "$(Get-ListApi $ListId)/fields" -Body $json | Out-Null
        Write-Host ("  + {0,-24} creada ({1})" -f $Name, $Type) -ForegroundColor Green

        if ($Name -ne $Title) {
            $rename = @{ "__metadata" = @{ type = $meta["__metadata"].type }; Title = $Title } | ConvertTo-Json -Depth 4 -Compress
            Invoke-SP -Method POST `
                -Uri "$(Get-ListApi $ListId)/fields/getbyinternalnameortitle('$Name')" `
                -Body $rename -ExtraHeaders @{ "X-HTTP-Method" = "MERGE"; "IF-MATCH" = "*" } | Out-Null
            Write-Host ("    -> nombre visible: {0}" -f $Title) -ForegroundColor DarkGray
        }
        if (-not $NoView) { Add-ToDefaultView -ListId $ListId -Name $Name }
    } catch {
        Write-Host ("  ! {0,-24} ERROR: {1}" -f $Name, $_.Exception.Message) -ForegroundColor Red
        if ($_.ErrorDetails.Message) { Write-Host "    $($_.ErrorDetails.Message)" -ForegroundColor DarkRed }
    }
}

# ---------------------------------------------------------------------------
# Ejecución
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "=== Check List Equipo de Torre (POWWO001-A2-1 REV2) ===" -ForegroundColor Cyan

$header = Resolve-List -Slug $HeaderSlug
Write-Host "Lista cabecera : '$($header.Title)'  ($($header.Id))" -ForegroundColor Cyan
$child = Resolve-List -Slug $ChildSlug
Write-Host "Lista de ítems : '$($child.Title)'  ($($child.Id))" -ForegroundColor Cyan

# ---- Cabecera ----
Write-Host ""
Write-Host "[1/2] Columnas de la lista cabecera" -ForegroundColor Cyan

Ensure-Field -ListId $header.Id -Name "SiteConducted"        -Title "Site conducted"                 -Type Text
Ensure-Field -ListId $header.Id -Name "ConductedOn"          -Title "Conducted on"                   -Type DateTime
Ensure-Field -ListId $header.Id -Name "PreparedBy"           -Title "Confeccionado por"              -Type Text
Ensure-Field -ListId $header.Id -Name "Ubicacion"            -Title "Location"                       -Type Text

# Campos de texto que identifican cada sección
Ensure-Field -ListId $header.Id -Name "SecFundacion"         -Title "Fundación"                      -Type Text
Ensure-Field -ListId $header.Id -Name "SecHerramientasMano"  -Title "Herramientas de mano"           -Type Text
Ensure-Field -ListId $header.Id -Name "SecCondicionMastil"   -Title "Condición de trabajo mástil"    -Type Text
Ensure-Field -ListId $header.Id -Name "SecMastilTorre"       -Title "Mástil - Torre"                 -Type Text
Ensure-Field -ListId $header.Id -Name "SecLlavePotencia"     -Title "Condiciones llave de potencia"  -Type Text
Ensure-Field -ListId $header.Id -Name "SecConjuntoPozo"      -Title "Conjunto del pozo / aparejo"    -Type Text
Ensure-Field -ListId $header.Id -Name "SecSistemaCirculacion" -Title "Sistema de circulación / lodo" -Type Text
Ensure-Field -ListId $header.Id -Name "SecVehiculos"         -Title "Vehículos"                      -Type Text
Ensure-Field -ListId $header.Id -Name "SecCasillaPersonal"   -Title "Casilla de personal"            -Type Text
Ensure-Field -ListId $header.Id -Name "SecCamionTransporte"  -Title "Camión de transporte"           -Type Text
Ensure-Field -ListId $header.Id -Name "SecEstacionOperacion" -Title "Estación de operación / piso"   -Type Text
Ensure-Field -ListId $header.Id -Name "SecEquipamientoPozo"  -Title "Equipamiento control del pozo"  -Type Text
Ensure-Field -ListId $header.Id -Name "SecSafetyEquipment"   -Title "Safety Equipment"               -Type Text
Ensure-Field -ListId $header.Id -Name "SecAnnex"             -Title "Annex"                          -Type Text

Ensure-Field -ListId $header.Id -Name "EstadoGeneral"        -Title "Estado general"                 -Type Choice -Choices @("OK", "OBSERVADO")
Ensure-Field -ListId $header.Id -Name "TotalItems"           -Title "Total ítems respondidos"        -Type Number
Ensure-Field -ListId $header.Id -Name "TotalBien"            -Title "Total BIEN"                     -Type Number
Ensure-Field -ListId $header.Id -Name "TotalMal"             -Title "Total MAL"                      -Type Number
Ensure-Field -ListId $header.Id -Name "TotalNa"              -Title "Total N/A"                      -Type Number
Ensure-Field -ListId $header.Id -Name "ObservacionesResumen" -Title "Observaciones relevantes"       -Type Note

Ensure-Field -ListId $header.Id -Name "JefeEquipoNombre"     -Title "Jefe de Equipo"                 -Type Text
Ensure-Field -ListId $header.Id -Name "JefeEquipoFecha"      -Title "Fecha Jefe de Equipo"           -Type DateOnly
Ensure-Field -ListId $header.Id -Name "TecnicoHseNombre"     -Title "Técnico HSE"                    -Type Text
Ensure-Field -ListId $header.Id -Name "TecnicoHseFecha"      -Title "Fecha Técnico HSE"              -Type DateOnly
Ensure-Field -ListId $header.Id -Name "ClienteNombre"        -Title "Inspección Cliente"             -Type Text
Ensure-Field -ListId $header.Id -Name "ClienteFecha"         -Title "Fecha Inspección Cliente"       -Type DateOnly

Ensure-Field -ListId $header.Id -Name "DeclaracionAceptada"  -Title "Declaración aceptada"           -Type Boolean
Ensure-Field -ListId $header.Id -Name "Latitud"              -Title "Latitud"                        -Type Number -NoView
Ensure-Field -ListId $header.Id -Name "Longitud"             -Title "Longitud"                       -Type Number -NoView

# ---- Ítems ----
Write-Host ""
Write-Host "[2/2] Columnas de la lista de ítems" -ForegroundColor Cyan

# OJO: el InternalName es 'CategoriaItem', no 'Categoria' — este último colisiona
# con una columna oculta por defecto de SharePoint y devuelve 400.
Ensure-Field -ListId $child.Id -Name "CategoriaItem"     -Title "Categoría"             -Type Text
Ensure-Field -ListId $child.Id -Name "Estado"            -Title "Estado"                -Type Choice -Choices @("BIEN", "MAL", "N/A", "Abierto", "Cerrado")
Ensure-Field -ListId $child.Id -Name "Comentarios"       -Title "Comentarios"           -Type Note
Ensure-Field -ListId $child.Id -Name "EvidenciaURL"      -Title "Evidencia (archivo)"   -Type Text
Ensure-Field -ListId $child.Id -Name "Orden"             -Title "Orden"                 -Type Number
Ensure-Field -ListId $child.Id -Name "TipoRegistro"      -Title "Tipo"                  -Type Choice -Choices @("ITEM", "OBSERVACION")
Ensure-Field -ListId $child.Id -Name "FechaCumplimiento" -Title "Fecha de cumplimiento" -Type DateOnly

Write-Host ""
Write-Host "=== Listo ===" -ForegroundColor Green
Write-Host ""
Write-Host "PASO MANUAL PENDIENTE — columna Lookup (REST devuelve 400, hay que hacerlo por UI):" -ForegroundColor Yellow
Write-Host "  1. Abrí la lista de ÍTEMS: $Resource$($child.Rel)"
Write-Host "  2. + Agregar columna -> Búsqueda (Lookup)"
Write-Host "  3. Nombre: Inspeccion"
Write-Host "  4. Seleccionar información de: '$($header.Title)'"
Write-Host "  5. En esta columna: Título"
Write-Host ""
Write-Host "La lookup va en la lista HIJA, nunca en la cabecera." -ForegroundColor Yellow
