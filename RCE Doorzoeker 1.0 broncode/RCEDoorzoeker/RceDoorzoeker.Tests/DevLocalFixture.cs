using System;
using System.IO;
using NUnit.Framework;
using RceDoorzoeker.Configuration;

namespace RceDoorzoeker.Tests
{
	[SetUpFixture]
	public class DevLocalFixture
	{
		[SetUp]
		public void LoadConfig()
		{
			var filePathName = Path.Combine(Environment.CurrentDirectory, "..\\..\\..\\..\\InstanceRegistry.cfg");

			if (!File.Exists(filePathName))
			{
				filePathName = @"C:\Development\RCE\Doorzoeker\InstanceRegistry.cfg";
			}

			var instanceRegistry = InstanceRegistry.Load(filePathName);

			var instance = instanceRegistry.Get("DEV-LOCAL");
			DoorzoekerConfig.Current = DoorzoekerConfig.Load(instance.Config);
		}
	}
}
