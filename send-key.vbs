Set w = CreateObject("WScript.Shell")
For Each arg In WScript.Arguments
  w.SendKeys Chr(CInt(arg))
Next

