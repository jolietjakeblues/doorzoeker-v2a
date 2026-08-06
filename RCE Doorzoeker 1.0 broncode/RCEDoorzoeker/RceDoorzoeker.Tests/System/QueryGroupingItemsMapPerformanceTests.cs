using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using NUnit.Framework;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services.Querying;
using RceDoorzoeker.Services.RnaApiClient;
using Trezorix.RnaRemote;
using Trezorix.RnaRemote.Core.ContentItems;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Tests.System
{
	[TestFixture]
	public class QueryGroupingItemsMapPerformanceTests
	{
		private RnaApiConnector _connector;

		[SetUp]
		public void Setup()
		{
			var filePathName = Path.Combine(Environment.CurrentDirectory, "..\\..\\..\\..\\InstanceRegistry.cfg");

			if (!File.Exists(filePathName))
			{
				filePathName = @"C:\Development\RCE\Doorzoeker\InstanceRegistry.cfg";
			}

			var instanceRegistry = InstanceRegistry.Load(filePathName);

			var instance = instanceRegistry.Get("DEV-LOCAL");
			DoorzoekerConfig.Current = DoorzoekerConfig.Load(instance.Config);

			_connector = new RnaApiConnector(DoorzoekerConfig.Current.RnaToolsetConfig.BaseUrl, DoorzoekerConfig.Current.RnaToolsetConfig.ApiKey) { AllowIndexStaleness = true };
			
		}
	
		[Explicit]
		[Test]
		public void CreateTestItems()
		{
			var remote = RnaContext.OpenCoreModelOnly(_connector);
			var session = remote.StartSession();

			var lat = session.PredicateRepository.Get("http://www.rnaproject.org/data/c5b51e33-914b-485b-a0bd-7e04d140dac7");
			var lng = session.PredicateRepository.Get("http://www.rnaproject.org/data/412d6de9-d3ca-4c9e-9309-d9d5618f0b45");

			var location = session.ItemTypeRepository.Get("http://www.rnaproject.org/data/fd3d5b7f-b561-4957-96f8-799129d52bdd");

			for (var i = 0; i < 10000; i++)
			{
				var newItem = new ContentItem("http://www.rnaproject.org/data/de2a8b88-cfa0-44cb-954d-ac9a5e876da3");

				var label = "Item " + Guid.NewGuid();
				newItem.PrefLabel.AddRange(new List<SkosProperty>
					{
						new SkosProperty() { Language = "sys", Value = label },
						new SkosProperty() { Language = "dut", Value = label }
					});
				newItem.Name = label;

				newItem.ItemType = location;

				newItem.Statements.Add(new Statement(lat) { Object = new ObjectLiteral() { Literal = "51.86795901" }});
				newItem.Statements.Add(new Statement(lng) { Object = new ObjectLiteral() { Literal = "4.99497898" }});
				
				session.ContentItemRepository.Add(newItem);
			}
			session.Commit();
		}

		[Test]
		public void Test()
		{
			// arrange
			
			var client = new LocalWebApiV1Client(_connector);
			var queryer = new GroupedItemsQueryer(client, null, null);
			
			// act
			var sw = new Stopwatch();
			var swTotal = new Stopwatch();
			swTotal.Start();
			for (int i = 0; i < 10; i++)
			{
				
				sw.Start();
				var result = queryer.QueryGroupingItemsMap("*", "root", "http://www.rnaproject.org/data/de2a8b88-cfa0-44cb-954d-ac9a5e876da3", 0.02);
				sw.Stop();
				double timingPerItem = 0;
				if (result.TotalCount > 0)
				{
					timingPerItem = (Double)sw.ElapsedMilliseconds / result.TotalCount;
				}
				Trace.WriteLine(string.Format("Queried {2} map items in {0:0.000} sec. Averaging {1:0.000} msec per item.", sw.ElapsedMilliseconds / 1000.0, timingPerItem, result.TotalCount));
				sw.Reset();
			}
			swTotal.Stop();
			Trace.WriteLine(string.Format("Queried map items in {0:0.000} sec.", swTotal.ElapsedMilliseconds / 1000.0));
			
			// assert
			//Assert.That(result.Items.Count, Is.GreaterThan(0));

		}
	}
}
