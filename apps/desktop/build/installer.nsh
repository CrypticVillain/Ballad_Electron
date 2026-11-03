; installer.nsh: Ballad's additions to the electron-builder installer
; (picked up from build/ automatically; electron-builder.yml has the rest).
;
; Pages, in the app's Display style (the art is installerSidebar.bmp and
; installerHeader.bmp, made by npm run icon):
;   Welcome      what Ballad is
;   (folder)     electron-builder's
;   Appearance   Theme: Match Windows (the default) / Light / Dark
;                App Icon: Match Windows / Light / Dark (the default)
;   (install, Finish)
;
; The choices are written to $INSTDIR\resources\theme and \app-icon, which
; the app reads (src/main/appIcon.ts, src/main/ipc.ts; a later change in
; Settings > Appearance wins). The app icon also goes on the Start Menu and
; Desktop shortcuts (which Windows uses for the taskbar)
; and the entry in Settings > Apps; "Match Windows" starts from the
; taskbar's current mode, and the app follows it from then on. Ballad.exe's
; own file icon is built in and stays dark.
;
; Silent installs: /THEME=system|light|dark and /ICON=dark|light|system.
; A reinstall starts from the last install's choices.

!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  !include LogicLib.nsh
  !include FileFunc.nsh

  Var theme
  Var appIcon
  Var themeRadio1
  Var themeRadio2
  Var themeRadio3
  Var iconRadio1
  Var iconRadio2
  Var iconRadio3
  Var iconImage1
  Var iconImage2
  Var iconImage3

  !macro customHeader
    ; The Finish page in Ballad's words (electron-builder keeps its Run Ballad box).
    !define MUI_FINISHPAGE_TITLE "Ballad is ready"
    !define MUI_FINISHPAGE_TEXT "Find Ballad in the Start menu or on your desktop.$\r$\n$\r$\nEverything you make is saved on this computer, in a local vault. No account needed."
  !macroend

  !macro customInit
    StrCpy $theme "system"
    StrCpy $appIcon "dark"
    ${GetParameters} $R0
    ClearErrors
    ${GetOptions} $R0 "/THEME=" $R1
    ${IfNot} ${Errors}
      ${If} $R1 == "light"
      ${OrIf} $R1 == "dark"
        StrCpy $theme $R1
      ${EndIf}
    ${EndIf}
    ClearErrors
    ${GetOptions} $R0 "/ICON=" $R1
    ${IfNot} ${Errors}
      ${If} $R1 == "light"
      ${OrIf} $R1 == "system"
        StrCpy $appIcon $R1
      ${EndIf}
    ${EndIf}
  !macroend

  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Welcome to Ballad"
    !define MUI_WELCOMEPAGE_TEXT "Write your stories and build the worlds they happen in: manuscript, characters, places, lore and timelines, in one calm app.$\r$\n$\r$\nNext you can pick where it goes and how it looks.$\r$\n$\r$\nClick Next to continue."
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; Reads a hand-off file from the last install, if there is one, into $R1.
  !macro balladReadChoice file
    StrCpy $R1 ""
    ${If} ${FileExists} "$INSTDIR\resources\${file}"
      FileOpen $R0 "$INSTDIR\resources\${file}" r
      FileRead $R0 $R1
      FileClose $R0
    ${EndIf}
  !macroend

  ; The page and its functions go here rather than at the top: this macro expands where the
  ; installer lists its pages, after the Modern UI (MUI_HEADER_TEXT) is loaded.
  !macro customPageAfterChangeDir
    Page custom appearancePage appearancePageLeave

    Function appearancePage
      ; A reinstall: start from the last install's choices.
      !insertmacro balladReadChoice "theme"
      ${If} $R1 == "system"
      ${OrIf} $R1 == "light"
      ${OrIf} $R1 == "dark"
        StrCpy $theme $R1
      ${EndIf}
      !insertmacro balladReadChoice "app-icon"
      ${If} $R1 == "system"
      ${OrIf} $R1 == "light"
      ${OrIf} $R1 == "dark"
        StrCpy $appIcon $R1
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "Appearance" "Choose how Ballad looks. You can change both later in Settings > Appearance."
      nsDialogs::Create 1018
      Pop $R0
      ${If} $R0 == error
        Abort
      ${EndIf}

      ; Theme: the app's colors.
      ${NSD_CreateLabel} 0u 0u 100% 10u "THEME"
      Pop $R0
      ${NSD_CreateRadioButton} 8u 13u 80u 12u "&Match Windows"
      Pop $themeRadio1
      ${NSD_AddStyle} $themeRadio1 ${WS_GROUP}
      ${NSD_CreateRadioButton} 98u 13u 70u 12u "L&ight"
      Pop $themeRadio2
      ${NSD_CreateRadioButton} 178u 13u 70u 12u "Dar&k"
      Pop $themeRadio3
      ${If} $theme == "light"
        ${NSD_Check} $themeRadio2
      ${ElseIf} $theme == "dark"
        ${NSD_Check} $themeRadio3
      ${Else}
        ${NSD_Check} $themeRadio1
      ${EndIf}

      ; App Icon: the taskbar, Start menu and desktop.
      ${NSD_CreateLabel} 0u 36u 100% 10u "APP ICON"
      Pop $R0
      InitPluginsDir
      File /oname=$PLUGINSDIR\ballad-dark.ico "${BUILD_RESOURCES_DIR}\icons\ballad-dark.ico"
      File /oname=$PLUGINSDIR\ballad-light.ico "${BUILD_RESOURCES_DIR}\icons\ballad-light.ico"
      File /oname=$PLUGINSDIR\ballad-match.ico "${BUILD_RESOURCES_DIR}\installer-match.ico"
      ; Same order as Theme: Match Windows, Light, Dark.
      ${NSD_CreateIcon} 14u 50u 24u 24u ""
      Pop $R0
      ${NSD_SetIcon} $R0 "$PLUGINSDIR\ballad-match.ico" $iconImage1
      ${NSD_CreateIcon} 104u 50u 24u 24u ""
      Pop $R0
      ${NSD_SetIcon} $R0 "$PLUGINSDIR\ballad-light.ico" $iconImage2
      ${NSD_CreateIcon} 184u 50u 24u 24u ""
      Pop $R0
      ${NSD_SetIcon} $R0 "$PLUGINSDIR\ballad-dark.ico" $iconImage3
      ${NSD_CreateRadioButton} 8u 78u 80u 12u "Match &Windows"
      Pop $iconRadio1
      ${NSD_AddStyle} $iconRadio1 ${WS_GROUP}
      ${NSD_CreateRadioButton} 98u 78u 70u 12u "&Light"
      Pop $iconRadio2
      ${NSD_CreateRadioButton} 178u 78u 70u 12u "&Dark"
      Pop $iconRadio3
      ${If} $appIcon == "light"
        ${NSD_Check} $iconRadio2
      ${ElseIf} $appIcon == "system"
        ${NSD_Check} $iconRadio1
      ${Else}
        ${NSD_Check} $iconRadio3
      ${EndIf}

      ${NSD_CreateLabel} 0u 100u 100% 24u "Match Windows follows your Windows light or dark mode (for the icon, the taskbar's), and changes when it does."
      Pop $R0

      nsDialogs::Show
      ${NSD_FreeIcon} $iconImage1
      ${NSD_FreeIcon} $iconImage2
      ${NSD_FreeIcon} $iconImage3
    FunctionEnd

    Function appearancePageLeave
      ${NSD_GetState} $themeRadio2 $R0
      ${NSD_GetState} $themeRadio3 $R1
      ${If} $R0 == ${BST_CHECKED}
        StrCpy $theme "light"
      ${ElseIf} $R1 == ${BST_CHECKED}
        StrCpy $theme "dark"
      ${Else}
        StrCpy $theme "system"
      ${EndIf}
      ${NSD_GetState} $iconRadio1 $R0
      ${NSD_GetState} $iconRadio2 $R1
      ${If} $R0 == ${BST_CHECKED}
        StrCpy $appIcon "system"
      ${ElseIf} $R1 == ${BST_CHECKED}
        StrCpy $appIcon "light"
      ${Else}
        StrCpy $appIcon "dark"
      ${EndIf}
    FunctionEnd
  !macroend

  !macro balladIconShortcut link ico
    ${If} ${FileExists} "${link}"
      CreateShortCut "${link}" "$appExe" "" "${ico}" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "${link}" "${APP_ID}"
    ${EndIf}
  !macroend

  !macro balladWriteChoice file value
    FileOpen $R0 "$INSTDIR\resources\${file}" w
    FileWrite $R0 ${value}
    FileClose $R0
  !macroend

  !macro customInstall
    ; Tell the app.
    !insertmacro balladWriteChoice "theme" $theme
    !insertmacro balladWriteChoice "app-icon" $appIcon
    ; The icon to show now: "system" goes by the taskbar's mode (1 = light).
    StrCpy $R2 $appIcon
    ${If} $R2 == "system"
      ClearErrors
      ReadRegDWORD $R3 HKCU "Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "SystemUsesLightTheme"
      ${If} ${Errors}
      ${OrIf} $R3 != 1
        StrCpy $R2 "dark"
      ${Else}
        StrCpy $R2 "light"
      ${EndIf}
    ${EndIf}
    StrCpy $R2 "$INSTDIR\resources\icons\ballad-$R2.ico"
    ; The shortcuts electron-builder just made, with that icon (and its app ID, as it sets them).
    !insertmacro balladIconShortcut "$newStartMenuLink" $R2
    !insertmacro balladIconShortcut "$newDesktopLink" $R2
    ; Settings > Apps.
    WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" $R2
  !macroend
!endif

