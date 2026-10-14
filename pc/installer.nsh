!macro customInstall
  ; Raccourcis avec l'icône calendrier (l'exe lui-même garde l'icône par défaut)
  CreateShortCut "$DESKTOP\GESTIME.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\icon.ico" 0
  CreateDirectory "$SMPROGRAMS"
  CreateShortCut "$SMPROGRAMS\GESTIME.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\icon.ico" 0
!macroend
