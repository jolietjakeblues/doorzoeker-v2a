using System.IO;
using System.Reflection;

namespace RceDoorzoeker.Tests
{
	internal static class TestFileHelper
	{
		public static string PrepareTestFile(string fileName)
		{
			var testFile = Path.Combine(GetAppDir(), fileName);

			if (File.Exists(testFile))
			{
				File.Delete(testFile);
			}

			return testFile;
		}

		public static string GetAppDir()
		{
			var appPath = Assembly.GetExecutingAssembly().Location;
			return Path.GetDirectoryName(appPath);
		}

	}
}