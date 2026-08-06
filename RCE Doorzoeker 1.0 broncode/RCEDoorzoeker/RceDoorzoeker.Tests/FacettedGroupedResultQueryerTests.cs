using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using NUnit.Framework;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services;
using RceDoorzoeker.Services.Querying;
using RceDoorzoeker.Services.RnaApiClient;
using Trezorix.RnaRemote;
using Trezorix.RnaRemote.RepositoryBase;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class FacettedGroupedResultQueryerTests
	{
		[Test]
		public void Test()
		{
			// arrange
			var connector = new RnaApiConnector(DoorzoekerConfig.Current.RnaToolsetConfig.BaseUrl, DoorzoekerConfig.Current.RnaToolsetConfig.ApiKey);
			var context = RnaContext.OpenCoreModelOnly(connector);
			var client = new LocalWebApiV1Client(connector);
			var session = context.StartSession();

			// ToDo: Model will access Config

			var facetRegistry = new FacetRegistry((IItemStore) session.ItemRepository);

			// ToDo: move this bit to separate test
			var resultQueryer = new FacetQueryer(client, new FacetsResultParser(facetRegistry), facetRegistry);
			
			// act
			var result = resultQueryer.QueryFacets("molen", "root", 100);

			// assert
			Assert.IsNotNull(result);
			Assert.AreEqual(7, result.Count());
		}
	}
}
