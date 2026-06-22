try {
    eval(WScript.Arguments(0));
    WScript.Echo('Syntax OK');
} catch (e) {
    WScript.Echo('Syntax Error: ' + e.message);
}