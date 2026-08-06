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
	public class GroupedReferrersQueryerTests
	{
		[Test]
		public void Query_should_return_list()
		{
			// arrange
			var connector = new RnaApiConnector(DoorzoekerConfig.Current.RnaToolsetConfig.BaseUrl, DoorzoekerConfig.Current.RnaToolsetConfig.ApiKey);
			var client = new LocalWebApiV1Client(connector);
			var context = RnaContext.OpenCoreModelOnly(connector);
			var session = context.StartBasicSession();
			var referrerQueryer = new ReferrerQueryer(new GroupedItemsQueryer(client, new ItemsResultParser(), new FacetsResultParser(new FacetRegistry((IItemStore) session.ItemRepository))), client);
			
			// act
			var result = referrerQueryer.QueryGroupings("http://www.rnaproject.org/data/6b5fbc6e-cc58-45e6-889b-cb194642b0ff");
			
			// assert
			Assert.IsNotNull(result);
			Assert.AreEqual(3, result.FacetValues.Count());
		}
	}
}
