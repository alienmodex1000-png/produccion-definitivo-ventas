Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' 1. Ubicar la carpeta del sistema de forma dinámica
CurrentDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = CurrentDir

' Iniciar Servidor Backend en segundo plano sin ventana negra de consola
If FSO.FileExists(CurrentDir & "\node.exe") Then
    WshShell.Run "cmd /c cd /d """ & CurrentDir & "\backend"" && """ & CurrentDir & "\node.exe"" server.js", 0
ElseIf FSO.FileExists(CurrentDir & "\produccion_definitivo\node.exe") Then
    WshShell.Run "cmd /c cd /d """ & CurrentDir & "\backend"" && """ & CurrentDir & "\produccion_definitivo\node.exe"" server.js", 0
ElseIf FSO.FileExists(CurrentDir & "\..\node.exe") Then
    WshShell.Run "cmd /c cd /d """ & CurrentDir & "\backend"" && """ & CurrentDir & "\..\node.exe"" server.js", 0
Else
    WshShell.Run "cmd /c cd /d """ & CurrentDir & "\backend"" && node server.js", 0
End If

' Esperar 2.5 segundos para que el servidor Express esté listo en el puerto 3005
WScript.Sleep 2500

' 2. Verificar preferencia de Impresión Silenciosa (A voluntad desde Ajustes)
Dim KioskParam, LauncherCfg, StreamCfg, CfgText
KioskParam = "" ' Por defecto muestra la ventana de Windows

LauncherCfg = CurrentDir & "\datos_negocio\launcher_config.json"
If FSO.FileExists(LauncherCfg) Then
    On Error Resume Next
    Set StreamCfg = FSO.OpenTextFile(LauncherCfg, 1)
    If Not StreamCfg Is Nothing Then
        CfgText = StreamCfg.ReadAll
        StreamCfg.Close
        Set StreamCfg = Nothing
        If InStr(CfgText, """kiosk_printing"": true") > 0 Or InStr(CfgText, """kiosk_printing"":true") > 0 Then
            KioskParam = " --kiosk-printing"
        End If
    End If
    On Error Goto 0
End If

TargetUrl = "http://localhost:3005"
BrowserCmd = ""

ProgramFilesX86 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%")
ProgramFilesDir = WshShell.ExpandEnvironmentStrings("%ProgramFiles%")
LocalAppDataDir = WshShell.ExpandEnvironmentStrings("%LocalAppData%")

Edge1 = ProgramFilesX86 & "\Microsoft\Edge\Application\msedge.exe"
Edge2 = ProgramFilesDir & "\Microsoft\Edge\Application\msedge.exe"

Chrome1 = ProgramFilesDir & "\Google\Chrome\Application\chrome.exe"
Chrome2 = ProgramFilesX86 & "\Google\Chrome\Application\chrome.exe"
Chrome3 = LocalAppDataDir & "\Google\Chrome\Application\chrome.exe"

PosDataDir = LocalAppDataDir & "\TiendaPOS\pos_profile"
If Not FSO.FolderExists(LocalAppDataDir & "\TiendaPOS") Then
    On Error Resume Next
    FSO.CreateFolder(LocalAppDataDir & "\TiendaPOS")
    On Error Goto 0
End If
If Not FSO.FolderExists(PosDataDir) Then
    On Error Resume Next
    FSO.CreateFolder(PosDataDir)
    On Error Goto 0
End If

UserDataParam = " --user-data-dir=""" & PosDataDir & """"

If FSO.FileExists(Chrome1) Then
    BrowserCmd = """" & Chrome1 & """ --app=" & TargetUrl & UserDataParam & KioskParam
ElseIf FSO.FileExists(Chrome2) Then
    BrowserCmd = """" & Chrome2 & """ --app=" & TargetUrl & UserDataParam & KioskParam
ElseIf FSO.FileExists(Chrome3) Then
    BrowserCmd = """" & Chrome3 & """ --app=" & TargetUrl & UserDataParam & KioskParam
ElseIf FSO.FileExists(Edge1) Then
    BrowserCmd = """" & Edge1 & """ --app=" & TargetUrl & UserDataParam & KioskParam
ElseIf FSO.FileExists(Edge2) Then
    BrowserCmd = """" & Edge2 & """ --app=" & TargetUrl & UserDataParam & KioskParam
Else
    BrowserCmd = TargetUrl
End If

WshShell.Run BrowserCmd
Set WshShell = Nothing
Set FSO = Nothing
