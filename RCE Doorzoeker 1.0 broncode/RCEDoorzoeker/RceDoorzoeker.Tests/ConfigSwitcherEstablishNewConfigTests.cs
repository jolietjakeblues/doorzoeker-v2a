using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using NUnit.Framework;
using RceDoorzoeker.Services.ConfigSwitcher;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class ConfigSwitcherEstablishNewConfigTests
	{
		private static readonly string s_mainCfg;
		private string _configFile;
		private ConfigSwitcher _configSwitcher;

		static ConfigSwitcherEstablishNewConfigTests()
		{
			s_mainCfg = Path.Combine(TestFileHelper.GetAppDir(), "Configs\\Tests", "Doorzoeker.default.cfg");
			
		}

		[SetUp]
		public void Setup()
		{
			var cfgDirectory = Path.GetDirectoryName(s_mainCfg);
			if (!Directory.Exists(cfgDirectory))
			{
				Directory.CreateDirectory(cfgDirectory);
			}

			foreach (var file in Directory.EnumerateFiles(cfgDirectory))
			{
				File.Delete(file);
			}

			var defaultCfg = Path.Combine(TestFileHelper.GetAppDir(), "Configs", "Doorzoeker.default.cfg");
			File.Copy(defaultCfg, s_mainCfg);

			CreateIncomingFile();

			_configSwitcher = new ConfigSwitcher(s_mainCfg);

		}

		private void CreateIncomingFile()
		{
			var sourceConfigFile = Path.Combine(TestFileHelper.GetAppDir(), "Configs",
				"Doorzoeker.valid.cfg");

			_configFile = Path.Combine(Path.GetDirectoryName(s_mainCfg), "incoming.cfg");

			File.Copy(sourceConfigFile, _configFile);
		}

		[Test]
		public void EstablishNewConfig_replaces_existing_file()
		{
			// arrange
			
			// act
			_configSwitcher.EstablishNewConfig(_configFile);

			// assert

			var lines = File.ReadAllLines(s_mainCfg);
			Assert.That(lines[1].Contains("cfg: valid config"), "New config not found.");

			// should have created backup
			var bakFile = Path.Combine(Path.GetDirectoryName(s_mainCfg), "Doorzoeker.default.bak01.cfg");
			var backupLines = File.ReadAllLines(bakFile);
			Assert.That(backupLines[1].Contains("cfg: default config (base)"), "No backup file found.");
		}

		[Test]
		public void EstablishNewConfig_creates_backup()
		{
			// arrange
			
			// act
			_configSwitcher.EstablishNewConfig(_configFile);

			// assert
			var bakFile = Path.Combine(Path.GetDirectoryName(s_mainCfg), "Doorzoeker.default.bak01.cfg");
			var lines = File.ReadAllLines(bakFile);
			Assert.That(lines[1].Contains("cfg: default config (base)"), "No backup file found.");
		}

		[Test]
		public void EstablishNewConfig_increments_leaving_previous_bak_files_intact()
		{
			// arrange
			_configSwitcher.EstablishNewConfig(_configFile);
			CreateIncomingFile();

			// act
			_configSwitcher.EstablishNewConfig(_configFile);
			
			// assert
			var bakFile1 = Path.Combine(Path.GetDirectoryName(s_mainCfg), "Doorzoeker.default.bak01.cfg");
			Assert.That(File.Exists(bakFile1));
			var bakFile2 = Path.Combine(Path.GetDirectoryName(s_mainCfg), "Doorzoeker.default.bak02.cfg");
			Assert.That(File.Exists(bakFile2));
		}

		[Test]
		public void DetermineBackupNumber_parse()
		{
			// arrange
			var bakFiles = new[]
				{
					"Doorzoeker.default.bak01.cfg"
				};

			// act
			var result = ConfigSwitcher.DetermineBackupNumber(bakFiles, "Doorzoeker.default");

			// assert
			Assert.That(result == 1);

		}

		[Test]
		public void DetermineBackupNumber_takes_maximum_number()
		{
			// arrange
			var bakFiles = new List<string>()
				{
					
					"Doorzoeker.default.bak03.cfg",
					"Doorzoeker.default.bak10.cfg",
					"Doorzoeker.default.bak01.cfg"
				};

			// act
			var regex = new Regex(string.Format("{0}.bak([0-9]*).cfg$", "Doorzoeker.default"));
			var bakNumber = bakFiles.Max(b => Convert.ToInt32(regex.Match(b).Groups[1].Value));
			var result = bakNumber;

			// assert
			Assert.That(result == 10);

		}
	}
}
