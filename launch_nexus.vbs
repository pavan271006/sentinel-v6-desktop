Set WshShell = CreateObject("WScript.Shell")

' 1. Check if server is running on port 1420
Dim oExec
Set oExec = WshShell.Exec("cmd /c netstat -ano | findstr :1420 | findstr LISTENING")
Do While oExec.Status = 0
    WScript.Sleep 50
Loop

' 2. If not listening, start Vite server on 0.0.0.0:1420
If oExec.ExitCode <> 0 Then
    WshShell.Run "cmd /c cd /d ""C:\Users\Legion 5 pro\Desktop\cyber sec"" && npx vite --host 0.0.0.0 --port 1420 --strictPort", 0, False
    WScript.Sleep 2000
End If

' 3. Launch dedicated standalone desktop app window pointing to 127.0.0.1:1420
WshShell.Run """C:\Program Files\Google\Chrome\Application\chrome.exe"" --app=http://127.0.0.1:1420/ --window-size=1400,900 --user-data-dir=""C:\Users\Legion 5 pro\AppData\Local\Nexus_Profile""", 1, False
