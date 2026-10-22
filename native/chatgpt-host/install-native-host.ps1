param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId,

    [ValidateSet('chrome', 'edge', 'opera', 'all')]
    [string]$Browser = 'chrome',

    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
if ($ExtensionId -notmatch '^[a-p]{32}$') {
    throw 'ExtensionId must be the 32-character ID shown on the browser extensions page.'
}

$registryRoots = @{
    chrome = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts'
    edge   = 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts'
    opera  = 'HKCU:\Software\Opera Software\NativeMessagingHosts'
}
$selectedBrowsers = if ($Browser -eq 'all') { @('chrome', 'edge', 'opera') } else { @($Browser) }
$manifestName = 'com.jdscan.chatgpt'
$hostDirectory = Join-Path $PSScriptRoot 'bin'

if ($Uninstall) {
    foreach ($selectedBrowser in $selectedBrowsers) {
        $registryPath = Join-Path $registryRoots[$selectedBrowser] $manifestName
        if (Test-Path $registryPath) { Remove-Item -LiteralPath $registryPath -Recurse -Force }
    }
    Write-Output "Removed the JD Scan ChatGPT helper registration for: $($selectedBrowsers -join ', ')."
    exit 0
}

Push-Location $PSScriptRoot
try {
    New-Item -ItemType Directory -Force -Path $hostDirectory | Out-Null
    $executablePath = Join-Path $hostDirectory 'jdscan-chatgpt-host.exe'
    & go build -trimpath -ldflags '-s -w' -o $executablePath .
    if ($LASTEXITCODE -ne 0) { throw 'Go could not build the local ChatGPT helper.' }

    foreach ($selectedBrowser in $selectedBrowsers) {
        $manifestPath = Join-Path $hostDirectory "$manifestName.$selectedBrowser.json"
        $manifest = @{
            name = $manifestName
            description = 'Local ChatGPT plan sign-in and inference for JD Scan'
            path = $executablePath
            type = 'stdio'
            allowed_origins = @("chrome-extension://$ExtensionId/")
        } | ConvertTo-Json -Depth 4
        [System.IO.File]::WriteAllText($manifestPath, $manifest, [System.Text.UTF8Encoding]::new($false))
        $registryPath = Join-Path $registryRoots[$selectedBrowser] $manifestName
        New-Item -Force -Path $registryPath | Out-Null
        Set-Item -LiteralPath $registryPath -Value $manifestPath
    }
} finally {
    Pop-Location
}

Write-Output "Installed the JD Scan ChatGPT helper for: $($selectedBrowsers -join ', '). Restart the browser to load the native messaging host."
