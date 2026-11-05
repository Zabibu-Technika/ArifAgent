using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

internal static class Program
{
    private static int Main(string[] args)
    {
        string root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        string node = Path.Combine(root, "runtime", "node.exe");
        string entry = Path.Combine(root, "app", "cli", "index.ts");

        if (!File.Exists(node))
        {
            Console.Error.WriteLine("arif-agent: runtime\\node.exe is missing. Reinstall the Windows package.");
            return 2;
        }
        if (!File.Exists(entry))
        {
            Console.Error.WriteLine("arif-agent: app\\cli\\index.ts is missing. Reinstall the Windows package.");
            return 2;
        }

        var start = new ProcessStartInfo
        {
            FileName = node,
            Arguments = Quote(entry) + (args.Length == 0 ? "" : " " + string.Join(" ", Array.ConvertAll(args, Quote))),
            UseShellExecute = false,
            WorkingDirectory = Environment.CurrentDirectory
        };
        start.EnvironmentVariables["ARIF_AGENT_PACKAGED"] = "1";

        try
        {
            using (var child = Process.Start(start))
            {
                child.WaitForExit();
                return child.ExitCode;
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("arif-agent: could not start the bundled runtime: " + error.Message);
            return 2;
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
