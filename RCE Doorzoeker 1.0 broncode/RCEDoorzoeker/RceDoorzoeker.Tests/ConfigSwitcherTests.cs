using System.IO;
using System.Linq;
using NUnit.Framework;
using RceDoorzoeker.Services.ConfigSwitcher;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class ConfigSwitcherTests
	{
		private ConfigSwitcher configSwitcher;

		[SetUp]
		public void Setup()
		{
			configSwitcher = new ConfigSwitcher(null);
		}

		[Test]
		public void ValidateConfig_Valid()
		{
			// arrange
			var configFile = Path.Combine(TestFileHelper.GetAppDir(), "Configs", 
				"Doorzoeker.valid.cfg");
			
			// act
			var result = configSwitcher.ValidateConfig(configFile);

			// assert
			Assert.IsFalse(result.Any());
		}

		[Test]
		[TestCase("Doorzoeker.corrupt.cfg")]
		[TestCase("Doorzoeker.corrupt2.cfg")]
		public void ValidateConfig_Corrupt(string fileName)
		{
			// arrange
			var configFile = Path.Combine(TestFileHelper.GetAppDir(), "Configs", 
				fileName);

			// act
			var result = configSwitcher.ValidateConfig(configFile);

			// assert
			Assert.IsTrue(result.Any());
			Assert.That(
				result.Where(vm => vm.Level == ValidationResultLevels.Error)
					.Any(vm => 
						vm.Message.Contains("Fout opgetreden bij inladen")
						&& vm.Details.Contains("exception")));
		}

		[Test]
		public void ValidateConfig_NoEnabledFacets()
		{
			// arrange
			var configFile = Path.Combine(TestFileHelper.GetAppDir(), "Configs",
				"Doorzoeker.incomplete.cfg");

			// act
			var result = configSwitcher.ValidateConfig(configFile);

			// assert
			Assert.That(result.Any(vm => 
				vm.Level == ValidationResultLevels.Error 
				&& vm.Message.Contains("geen facetten die enabled zijn")));
		}

		[Test]
		public void ValidateConfig_NoEnabledItemTypes()
		{
			// arrange
			var configFile = Path.Combine(TestFileHelper.GetAppDir(), "Configs",
				"Doorzoeker.incomplete.cfg");

			// act
			var result = configSwitcher.ValidateConfig(configFile);

			// assert
			Assert.That(result.Any(vm =>
				vm.Level == ValidationResultLevels.Error
				&& vm.Message.Contains("geen item types die enabled zijn")));
		}

		[Test]
		public void ValidateConfig_NoEnabledStructures()
		{
			// arrange
			var configFile = Path.Combine(TestFileHelper.GetAppDir(), "Configs",
				"Doorzoeker.incomplete.cfg");

			// act
			var result = configSwitcher.ValidateConfig(configFile);

			// assert
			Assert.That(result.Any(vm =>
				vm.Level == ValidationResultLevels.Error
				&& vm.Message.Contains("geen structuren die enabled zijn")));
		}

	}

	
}