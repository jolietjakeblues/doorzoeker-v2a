using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using NUnit.Framework;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services.RnaApiClient;
using Trezorix.RnaRemote;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class LocalWebApiV2Tests
	{
		private LocalWebApiV2Client _client;

		[SetUp]
		public void Setup()
		{
			var connector = new RnaApiConnector(DoorzoekerConfig.Current.RnaToolsetConfig.BaseUrl, DoorzoekerConfig.Current.RnaToolsetConfig.ApiKey);
			_client = new LocalWebApiV2Client(connector);
		}

		[Test]
		[ExpectedException(typeof(HttpException))]
		public void GetChildrenPage_with_bad_uri_should_throw()
		{
			// arrange
			
			// act
			var result = _client.GetChildrenPage("bad uri", 0, 50);
			
			// assert
			
		}

		[Test]
		public void GetChildrenPage_metaal_should_result_in_children()
		{
			// arrange
			
			const string metaal = "http://www.rnaproject.org/data/842b1c9e-e76d-4838-af3f-63491bfa6c8b";

			// act
			var result = _client.GetChildrenPage(metaal, 0, 50);

			// assert
			Assert.AreEqual(10, result.Items.Count());
		}

	}
}
