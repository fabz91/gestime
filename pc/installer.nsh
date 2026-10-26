!macro customInstall
  ; Raccourcis avec l'icône GESTIME (fichier gestime-icone.ico : nouveau nom pour que Windows n'affiche plus l'ancienne icône bleue)
  CreateShortCut "$DESKTOP\GESTIME.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\gestime-icone.ico" 0
  CreateDirectory "$SMPROGRAMS"
  CreateShortCut "$SMPROGRAMS\GESTIME.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\gestime-icone.ico" 0
!macroend
