param([string]$targetPrinter = "")

try {
    $p = if ($targetPrinter -and $targetPrinter.Trim() -ne "") { $targetPrinter } else { $null }
    if (-not $p) {
        $p = (Get-CimInstance Win32_Printer | Where-Object { $_.Name -like "*POS*" -or $_.DriverName -like "*POS*" -or $_.Name -like "*Receipt*" -or $_.Name -like "*Thermal*" -or $_.Name -like "*58*" -or $_.Name -like "*80*" } | Select-Object -First 1).Name
    }
    if (-not $p) {
        $p = (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name
    }
    if (-not $p) {
        Write-Output "NO_PRINTER"
        exit 0
    }

    $csharp = @"
using System;
using System.Runtime.InteropServices;

public class CashDrawerKick {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendKick(string printerName) {
        // Secuencias universales ESC/POS de apertura de gaveta (Pin 2, Pin 5 y Star/Epson)
        byte[] bytes = new byte[] { 27, 112, 0, 25, 250, 27, 112, 1, 25, 250, 16, 20, 1, 0, 5 };
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Open Drawer Pulse";
        di.pDataType = "RAW";

        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanaged = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanaged, bytes.Length);
                    int written;
                    WritePrinter(hPrinter, pUnmanaged, bytes.Length, out written);
                    Marshal.FreeCoTaskMem(pUnmanaged);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }
}
"@

    Add-Type -TypeDefinition $csharp -Language CSharp -ErrorAction SilentlyContinue
    $sent = [CashDrawerKick]::SendKick($p)
    Write-Output "PULSE_SENT | $sent | $p"
} catch {
    Write-Output "ERROR | $($_.Exception.Message)"
}
