$code = Get-Content 'D:\-- Probuild Samui Development --\--- AI --- App\Stock App\logic.js' -Raw
$sc = New-Object -ComObject MSScriptControl.ScriptControl
$sc.Language = 'JScript'
try {
    $sc.AddCode($code)
    Write-Host 'No syntax errors'
} catch {
    Write-Host $_.Exception.Message
}
