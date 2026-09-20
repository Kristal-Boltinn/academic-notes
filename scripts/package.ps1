$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid version' }
$dist = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$stage = Join-Path $dist 'source-stage'
$releaseStage = Join-Path $dist 'release-stage'
foreach ($target in @($stage, $releaseStage)) {
    $absolute = [IO.Path]::GetFullPath($target)
    if (-not $absolute.StartsWith([IO.Path]::GetFullPath($dist) + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe staging path' }
    if (Test-Path -LiteralPath $absolute) { Remove-Item -LiteralPath $absolute -Recurse -Force }
    New-Item -ItemType Directory -Path (Join-Path $absolute 'academic-notes') -Force | Out-Null
}
# Deliberate allowlist: never copy a vault, local settings, dependencies, or generated test output.
$sourceEntries = @('src','snippets','scripts','tests','examples','screenshots','licenses','.github',
    '.gitignore','.gitattributes','package.json','package-lock.json','tsconfig.json','esbuild.config.mjs','eslint.config.mjs',
    'main.js','styles.css','manifest.json','versions.json','README.md','README.zh-CN.md','CHANGELOG.md','RELEASING.md',
    'VALIDATION.md','REVIEW-NOTES.md','LICENSE','THIRD-PARTY-NOTICES.md','安装说明.md')
foreach ($entry in $sourceEntries) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination (Join-Path $stage 'academic-notes') -Recurse -Force
}
foreach ($entry in @('main.js','styles.css','manifest.json')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination (Join-Path $releaseStage 'academic-notes') -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($kind in @('source','plugin')) {
    $archive = Join-Path $dist "academic-notes-$version-$kind.zip"
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    $folder = if ($kind -eq 'source') { $stage } else { $releaseStage }
    [IO.Compression.ZipFile]::CreateFromDirectory($folder, $archive)
    Get-FileHash -LiteralPath $archive -Algorithm SHA256
}
