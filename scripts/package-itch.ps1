param(
    [string]$DistPath = "dist",
    [string]$ZipPath = "open-poker-itch.zip"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$dist = Resolve-Path -LiteralPath (Join-Path $root $DistPath)
$zip = Join-Path $root $ZipPath

if (Test-Path -LiteralPath $zip) {
    Remove-Item -LiteralPath $zip -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
$distPrefix = $dist.Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

try {
    Get-ChildItem -LiteralPath $dist -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($distPrefix.Length)
        $entryName = $relativePath.Replace("\", "/")
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)

        $source = [System.IO.File]::OpenRead($_.FullName)
        try {
            $target = $entry.Open()
            try {
                $source.CopyTo($target)
            }
            finally {
                $target.Dispose()
            }
        }
        finally {
            $source.Dispose()
        }
    }
}
finally {
    $archive.Dispose()
}

$hasBackslashes = [System.IO.Compression.ZipFile]::OpenRead($zip).Entries |
    Where-Object { $_.FullName.Contains("\") } |
    Select-Object -First 1

if ($hasBackslashes) {
    throw "itch.io package contains Windows path separators: $($hasBackslashes.FullName)"
}

Write-Host "Created itch.io package: $zip"
