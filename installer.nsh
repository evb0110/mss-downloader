; Custom NSIS installer script for MSS Downloader
; Optimized for better antivirus compatibility

!macro customHeader
  ; Set installer attributes for better AV detection
  VIProductVersion "${VERSION}.0"
  VIAddVersionKey "ProductName" "Abba Ababus MSS Downloader"
  VIAddVersionKey "CompanyName" "Abba Ababus Manuscripts"
  VIAddVersionKey "LegalCopyright" "© 2024 Abba Ababus Manuscripts"
  VIAddVersionKey "FileDescription" "Manuscript Downloader Installation"
  VIAddVersionKey "FileVersion" "${VERSION}"
!macroend

!macro customInit
  ; Ensure clean installation environment
  SetShellVarContext current
!macroend

!macro customInstall
  ; Custom installation steps if needed
!macroend

!macro customUnInstall
  ; Custom uninstallation steps if needed
!macroend