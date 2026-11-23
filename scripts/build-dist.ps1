<#
.SYNOPSIS
    Stove 럭키 캡슐 '한번 더' 뽑기 도우미 확장 프로그램 배포용 ZIP 빌드 스크립트

.DESCRIPTION
    app/manifest.json 의 버전을 자동으로 읽어와 dist/ 디렉터리에
    'stove-flake-helper-extension-v{version}.zip' 형태의 경량 배포 패키지를 생성합니다.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# 프로젝트 루트 경로 계산
$rootDir = (Resolve-Path "$PSScriptRoot/..").Path
$manifestPath = Join-Path $rootDir "app/manifest.json"
$distDir = Join-Path $rootDir "dist"
$appDir = Join-Path $rootDir "app"

if (-not (Test-Path $manifestPath)) {
    Write-Error "[오류] manifest.json 파일을 찾을 수 없습니다: $manifestPath"
    exit 1
}

# 1. 버전 파싱
$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version

if ([string]::IsNullOrWhiteSpace($version)) {
    Write-Error "[오류] manifest.json 에서 버전을 찾을 수 없습니다."
    exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Stove 럭키 캡슐 '한번 더' 뽑기 도우미 확장 프로그램 빌드" -ForegroundColor Cyan
Write-Host " 버전: v$version" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

# 2. dist 디렉터리 준비
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

$zipFileName = "stove-flake-helper-extension-v$version.zip"
$zipFilePath = Join-Path $distDir $zipFileName

if (Test-Path $zipFilePath) {
    Remove-Item $zipFilePath -Force
    Write-Host "기존 아티팩트 제거: $zipFileName" -ForegroundColor Gray
}

# 3. 임시 스테이징 디렉터리 구성 (불필요한 파일 제외하고 app 폴더 패키징)
$tempStageDir = Join-Path ([System.IO.Path]::GetTempPath()) "stove-ext-build-$([System.Guid]::NewGuid().ToString('N'))"
$stagedAppDir = Join-Path $tempStageDir "app"

New-Item -ItemType Directory -Path $stagedAppDir -Force | Out-Null

try {
    # 필수 파일만 복사
    Copy-Item (Join-Path $appDir "manifest.json") $stagedAppDir
    Copy-Item (Join-Path $appDir "content.js") $stagedAppDir
    Copy-Item (Join-Path $appDir "background.js") $stagedAppDir
    Copy-Item (Join-Path $appDir "popup.html") $stagedAppDir
    Copy-Item (Join-Path $appDir "popup.js") $stagedAppDir
    Copy-Item (Join-Path $appDir "popup.css") $stagedAppDir
    Copy-Item (Join-Path $appDir "icons") $stagedAppDir -Recurse

    # 4. 압축 파일 생성
    Write-Host "배포용 ZIP 패키징 중..." -ForegroundColor Yellow
    Compress-Archive -Path $stagedAppDir -DestinationPath $zipFilePath -CompressionLevel Optimal

    $fileSize = (Get-Item $zipFilePath).Length
    $formattedSize = [math]::Round($fileSize / 1KB, 2)

    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "🎉 빌드 성공!" -ForegroundColor Green
    Write-Host " 산출물: dist/$zipFileName ($formattedSize KB)" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Green
}
finally {
    # 임시 디렉터리 정리
    if (Test-Path $tempStageDir) {
        Remove-Item $tempStageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
