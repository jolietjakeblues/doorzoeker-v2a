using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using NUnit.Framework;
using RceDoorzoeker.Configuration;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class DoorzoekerConfigTests
	{
		[Test]
		public void Load()
		{
			// arrange
			var testConfigFilePathName = Path.Combine(TestFileHelper.GetAppDir(), "Doorzoeker.cfg");

			// act
			
			var cfg = DoorzoekerConfig.Load(testConfigFilePathName);

			// assert
			Assert.IsNotNull(cfg);
			Assert.Greater(cfg.Languages.Count, 1);
		}

		[Test]
		public void Save()
		{
			// arrange
			var cfg = new DoorzoekerConfig()
				{
					RnaToolsetConfig =
						{
							BaseUrl = "http://someURL",
							ApiKey = "some_api_key"
						}
				};

			// act
			var testFile = TestFileHelper.PrepareTestFile("TestConfigSave.cfg");

			cfg.Save(testFile);

			// assert
			var data = File.ReadAllText(testFile);

			Assert.That(data.Contains("some_api_key"));
			Assert.That(data.Contains("<?xml"));
			Assert.That(data.Contains("<DoorzoekerConfig"));

		}
	}
}
